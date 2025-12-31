import { socketService } from './socket';

export interface PeerConnection {
    userId: string;
    socketId: string;
    connection: RTCPeerConnection;
    stream?: MediaStream;
    volume: number; // 0-1
}

class VoiceChatService {
    private localStream: MediaStream | null = null;
    private peers: Map<string, PeerConnection> = new Map();
    private isActive: boolean = false;
    private isMuted: boolean = false;
    private isDeafened: boolean = false;
    private wasMutedBeforeDeafen: boolean = false;
    private savedPeerVolumes: Map<string, number> = new Map();
    private onPeerStreamCallback?: (userId: string, stream: MediaStream) => void;
    private onPeerLeftCallback?: (userId: string) => void;
    private audioContext: AudioContext | null = null;
    private gainNodes: Map<string, GainNode> = new Map();
    private analyser: AnalyserNode | null = null;
    private audioLevelCallbacks: Set<(level: number) => void> = new Set();

    private iceServers: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    private socketListenersSetup = false;

    async initialize() {
        this.audioContext = new AudioContext();
    }

    private ensureSocketListeners() {
        if (this.socketListenersSetup) return;

        const socket = socketService.getSocket();
        if (!socket) {
            console.warn('No socket available for voice chat listeners');
            return;
        }

        this.setupSocketListeners();
        this.socketListenersSetup = true;
    }

    private setupSocketListeners() {
        const socket = socketService.getSocket();
        if (!socket) {
            console.warn('No socket available for voice chat listeners');
            return;
        }

        console.log('Setting up voice chat socket listeners');

        socket.on('voice:user-joined', async (data: { userId: string; socketId: string }) => {
            console.log('Voice: User joined voice chat:', data);

            // Determine who should initiate based on socketId comparison
            // This prevents glare - only one peer will create offer
            const mySocket = socketService.getSocket();
            const mySocketId = mySocket?.id || '';
            const shouldInitiate = mySocketId < data.socketId;

            console.log('Should I initiate?', shouldInitiate, 'My socketId:', mySocketId, 'Their socketId:', data.socketId);

            if (shouldInitiate) {
                await this.createPeerConnection(data.userId, data.socketId, true);
            } else {
                // Don't create peer yet, wait for their offer
                console.log('Waiting for offer from:', data.userId);
            }
        });

        socket.on('voice:offer', async (data: { fromSocketId: string; fromUserId: string; offer: RTCSessionDescriptionInit }) => {
            console.log('Voice: Received offer from:', data.fromUserId);
            await this.handleOffer(data.fromUserId, data.fromSocketId, data.offer);
        });

        socket.on('voice:answer', async (data: { fromSocketId: string; fromUserId: string; answer: RTCSessionDescriptionInit }) => {
            console.log('Voice: Received answer from:', data.fromUserId);
            await this.handleAnswer(data.fromUserId, data.answer);
        });

        socket.on('voice:ice-candidate', async (data: { fromSocketId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
            console.log('Voice: Received ICE candidate from:', data.fromUserId);
            await this.handleIceCandidate(data.fromUserId, data.candidate);
        });

        socket.on('voice:user-left', (data: { userId: string; socketId: string }) => {
            console.log('Voice: User left voice chat:', data);
            this.removePeer(data.userId);
            this.onPeerLeftCallback?.(data.userId);
        });
    }

    async join(audioDeviceId?: string): Promise<boolean> {
        try {
            // Ensure socket listeners are set up before joining
            this.ensureSocketListeners();

            const constraints: MediaStreamConstraints = {
                audio: audioDeviceId
                    ? {
                        deviceId: { exact: audioDeviceId },
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: false, // Disable auto gain control to prevent Windows from changing volume
                        sampleRate: 48000,
                    }
                    : {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: false,
                        sampleRate: 48000,
                    },
                video: false,
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.isActive = true;

            console.log('Local stream acquired, tracks:', this.localStream.getTracks().length);

            // Setup audio level analyzer
            this.setupAudioAnalyzer();

            // Notify server
            socketService.emit('voice:join');

            console.log('Joined voice chat successfully, notified server');
            return true;
        } catch (error) {
            console.error('Failed to join voice chat:', error);
            return false;
        }
    }

    async leave() {
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        for (const [, peer] of this.peers) {
            peer.connection.close();
        }
        this.peers.clear();
        this.gainNodes.clear();
        this.savedPeerVolumes.clear();
        this.analyser = null;
        this.audioLevelCallbacks.clear();

        this.isActive = false;
        this.isMuted = false;
        this.isDeafened = false;
        this.wasMutedBeforeDeafen = false;
        this.socketListenersSetup = false;

        // Notify server
        socketService.emit('voice:leave');

        console.log('Left voice chat, cleared all state');
    }

    private async createPeerConnection(userId: string, socketId: string, isInitiator: boolean) {
        // Check if peer connection already exists
        if (this.peers.has(userId)) {
            console.log('Peer connection already exists for:', userId);
            return;
        }

        console.log('Creating peer connection for:', userId, 'isInitiator:', isInitiator);

        const peerConnection = new RTCPeerConnection(this.iceServers);

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socketService.emit('voice:ice-candidate', {
                    targetSocketId: socketId,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream from:', userId);
            const [remoteStream] = event.streams;

            const peer = this.peers.get(userId);
            if (peer) {
                // Store the original remote stream
                peer.stream = remoteStream;

                // Log tracks for debugging
                console.log('Remote stream tracks:', remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));

                // Notify with the remote stream
                this.onPeerStreamCallback?.(userId, remoteStream);
            }
        };

        // Store peer connection BEFORE adding tracks
        this.peers.set(userId, {
            userId,
            socketId,
            connection: peerConnection,
            volume: 1.0,
        });

        // Add local audio tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                console.log('Adding local track to peer:', userId, 'Track enabled:', track.enabled);
                peerConnection.addTrack(track, this.localStream!);
            });
        } else {
            console.warn('No local stream to add to peer connection');
        }

        // Create and send offer if initiator
        if (isInitiator) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socketService.emit('voice:offer', {
                targetSocketId: socketId,
                offer: offer,
            });
        }
    }

    private async handleOffer(userId: string, socketId: string, offer: RTCSessionDescriptionInit) {
        let peer = this.peers.get(userId);

        // Create peer if it doesn't exist
        if (!peer) {
            console.log('Creating peer connection on offer from:', userId);
            await this.createPeerConnection(userId, socketId, false);
            peer = this.peers.get(userId);
        }

        if (!peer) return;

        // Check signaling state before setting remote description
        if (peer.connection.signalingState !== 'stable' && peer.connection.signalingState !== 'have-remote-offer') {
            console.warn('Cannot process offer, peer in state:', peer.connection.signalingState);
            return;
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        socketService.emit('voice:answer', {
            targetSocketId: socketId,
            answer: answer,
        });
    }

    private async handleAnswer(userId: string, answer: RTCSessionDescriptionInit) {
        const peer = this.peers.get(userId);
        if (!peer) {
            console.warn('Received answer for non-existent peer:', userId);
            return;
        }

        // Only set remote description if in correct state
        if (peer.connection.signalingState !== 'have-local-offer') {
            console.warn('Received answer in wrong state:', peer.connection.signalingState);
            return;
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    private async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
        const peer = this.peers.get(userId);
        if (!peer) return;

        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    private removePeer(userId: string) {
        const peer = this.peers.get(userId);
        if (peer) {
            peer.connection.close();
            this.peers.delete(userId);
        }
    }

    private setupAudioProcessing(userId: string, stream: MediaStream): MediaStream | null {
        if (!this.audioContext) return null;

        const source = this.audioContext.createMediaStreamSource(stream);
        const gainNode = this.audioContext.createGain();
        const destination = this.audioContext.createMediaStreamDestination();

        source.connect(gainNode);
        gainNode.connect(destination);

        this.gainNodes.set(userId, gainNode);

        // Return the processed stream with volume control
        return destination.stream;
    }

    toggleMute(): boolean {
        this.isMuted = !this.isMuted;

        if (this.localStream) {
            this.localStream.getAudioTracks().forEach((track) => {
                track.enabled = !this.isMuted;
            });
        }

        return this.isMuted;
    }

    toggleDeafen(): boolean {
        this.isDeafened = !this.isDeafened;

        if (this.isDeafened) {
            // Save current volumes and mute state
            this.savedPeerVolumes.clear();
            for (const [userId, peer] of this.peers) {
                this.savedPeerVolumes.set(userId, peer.volume);
                this.setPeerVolume(userId, 0);
            }

            // Save mute state and mute microphone
            this.wasMutedBeforeDeafen = this.isMuted;
            if (!this.isMuted) {
                this.toggleMute();
            }
        } else {
            // Restore volumes
            for (const [userId] of this.peers) {
                const savedVolume = this.savedPeerVolumes.get(userId) ?? 1.0;
                this.setPeerVolume(userId, savedVolume);
            }
            this.savedPeerVolumes.clear();

            // Restore microphone state
            if (!this.wasMutedBeforeDeafen && this.isMuted) {
                this.toggleMute();
            }
        }

        return this.isDeafened;
    }

    setPeerVolume(userId: string, volume: number) {
        const peer = this.peers.get(userId);
        if (peer) {
            peer.volume = volume;
            console.log(`Set volume for user ${userId}: ${Math.round(volume * 100)}%`);
        }
    }

    getPeerVolume(userId: string): number {
        const peer = this.peers.get(userId);
        return peer?.volume ?? 1.0;
    }

    getIsMuted(): boolean {
        return this.isMuted;
    }

    getIsDeafened(): boolean {
        return this.isDeafened;
    }

    async changeAudioDevice(deviceId: string) {
        if (!this.isActive) return;

        // Stop current stream
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
        }

        // Get new stream with selected device
        const constraints: MediaStreamConstraints = {
            audio: {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false,
                sampleRate: 48000,
            },
            video: false,
        };

        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Re-setup audio analyzer with new stream
        this.setupAudioAnalyzer();

        // Update all peer connections with new stream
        for (const [, peer] of this.peers) {
            const senders = peer.connection.getSenders();
            const audioSender = senders.find((sender) => sender.track?.kind === 'audio');

            if (audioSender && this.localStream) {
                const audioTrack = this.localStream.getAudioTracks()[0];
                await audioSender.replaceTrack(audioTrack);
            }
        }

        console.log('Changed audio device to:', deviceId);
    }

    async getAudioDevices(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'audioinput');
    }

    async getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'audiooutput');
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    private setupAudioAnalyzer() {
        if (!this.localStream || !this.audioContext) return;

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        // Create source from local stream
        const source = this.audioContext.createMediaStreamSource(this.localStream);

        // Connect to analyser WITHOUT blocking the stream
        // The analyser will just "listen" to the audio without interrupting it
        source.connect(this.analyser);
        // DO NOT connect analyser to destination - this would block the original stream

        // Start monitoring audio level
        this.monitorAudioLevel();
    }

    private monitorAudioLevel() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        const checkLevel = () => {
            if (!this.analyser || !this.isActive) return;

            // Use time domain data for better voice detection
            this.analyser.getByteTimeDomainData(dataArray);

            // Calculate RMS (Root Mean Square) for more accurate volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
                sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / bufferLength);

            // Apply strong gain to make it more visible (0-1 range)
            // Increased from 5 to 15 for better visibility
            const normalizedLevel = Math.min(rms * 15, 1);

            // Notify all callbacks
            this.audioLevelCallbacks.forEach(callback => callback(normalizedLevel));

            requestAnimationFrame(checkLevel);
        };

        checkLevel();
    }

    onAudioLevel(callback: (level: number) => void) {
        this.audioLevelCallbacks.add(callback);
        return () => this.audioLevelCallbacks.delete(callback);
    }

    getPeers(): PeerConnection[] {
        return Array.from(this.peers.values());
    }

    onPeerStream(callback: (userId: string, stream: MediaStream) => void) {
        this.onPeerStreamCallback = callback;
    }

    onPeerLeft(callback: (userId: string) => void) {
        this.onPeerLeftCallback = callback;
    }
}

export const voiceChatService = new VoiceChatService();
