import React, { useEffect, useRef } from 'react';
import { voiceChatService } from '../services/voiceChat';

interface VoiceAudioProps {
    userId: string;
    stream: MediaStream;
}

const VoiceAudio: React.FC<VoiceAudioProps> = ({ userId, stream }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && stream) {
            const audioTracks = stream.getAudioTracks();

            console.log(`VoiceAudio: Setting up audio for user ${userId}, tracks: ${audioTracks.length}`);

            audioRef.current.srcObject = stream;

            // Set initial volume from voice chat service
            const volume = voiceChatService.getPeerVolume(userId);
            audioRef.current.volume = volume;

            audioRef.current.play().then(() => {
                console.log(`✓ Audio playback started for user ${userId} (volume: ${Math.round(volume * 100)}%)`);
            }).catch((err) => {
                console.error('✗ Failed to play audio for user:', userId, err);
            });
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.srcObject = null;
            }
        };
    }, [stream, userId]);

    // Update volume when it changes
    useEffect(() => {
        if (!audioRef.current) return;

        const updateVolume = () => {
            if (audioRef.current) {
                const volume = voiceChatService.getPeerVolume(userId);
                audioRef.current.volume = volume;
            }
        };

        // Check volume every 100ms
        const interval = setInterval(updateVolume, 100);

        return () => clearInterval(interval);
    }, [userId]);

    return (
        <audio
            ref={audioRef}
            autoPlay
            style={{ display: 'none' }}
        />
    );
};

export default VoiceAudio;
