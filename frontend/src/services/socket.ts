import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

class SocketService {
    private socket: Socket | null = null;

    connect(token: string): Socket {
        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(WS_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            // Don't auto-logout on socket errors - let the user work
            // Only logout if they explicitly get authentication error from server
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            // Don't auto-logout on connection errors
            // User can manually logout if needed
        });

        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinRoom(roomId: string): void {
        if (this.socket) {
            this.socket.emit('join-room', { roomId });
        }
    }

    leaveRoom(roomId: string): void {
        if (this.socket) {
            this.socket.emit('leave-room', { roomId });
        }
    }

    sendPlayerAction(action: 'play' | 'pause' | 'seek', time: number): void {
        if (this.socket) {
            this.socket.emit('player-action', { action, time, timestamp: Date.now() });
        }
    }

    sendChatMessage(text: string): void {
        if (this.socket) {
            this.socket.emit('chat-message', { text });
        }
    }

    addToQueue(videoUrl: string, videoTitle?: string): void {
        if (this.socket) {
            this.socket.emit('add-to-queue', { videoUrl, videoTitle });
        }
    }

    playNext(): void {
        if (this.socket) {
            this.socket.emit('play-next');
        }
    }

    skipVideo(): void {
        if (this.socket) {
            this.socket.emit('skip-video');
        }
    }

    removeFromQueue(videoId: string): void {
        if (this.socket) {
            this.socket.emit('remove-from-queue', { videoId });
        }
    }

    kickUser(roomId: string, userId: string): void {
        if (this.socket) {
            this.socket.emit('kick-user', { roomId, userId });
        }
    }

    deleteRoom(roomId: string): void {
        if (this.socket) {
            this.socket.emit('delete-room', { roomId });
        }
    }

    reorderQueue(videos: Array<{ id: string; queue_position: number }>): void {
        if (this.socket) {
            this.socket.emit('reorder-queue', { videos });
        }
    }

    emit(event: string, data?: any): void {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    on(event: string, callback: (...args: any[]) => void): void {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event: string, callback?: (...args: any[]) => void): void {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    getSocket(): Socket | null {
        return this.socket;
    }
}

export const socketService = new SocketService();
