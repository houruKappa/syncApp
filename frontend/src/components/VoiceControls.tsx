import React, { useState, useEffect } from 'react';
import {
    Box,
    IconButton,
    Tooltip,
    Menu,
    MenuItem,
    Typography,
    Divider,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import HeadsetIcon from '@mui/icons-material/Headset';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import SettingsIcon from '@mui/icons-material/Settings';
import { voiceChatService } from '../services/voiceChat';

interface VoiceControlsProps {
    isActive: boolean;
    onToggle: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ isActive, onToggle }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [selectedOutput, setSelectedOutput] = useState<string>('');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    useEffect(() => {
        loadDevices();
    }, []);

    useEffect(() => {
        if (isActive) {
            // Sync state with service when voice chat becomes active
            setIsMuted(voiceChatService.getIsMuted());
            setIsDeafened(voiceChatService.getIsDeafened());

            // Subscribe to audio level updates
            const unsubscribe = voiceChatService.onAudioLevel((level) => {
                setAudioLevel(level);
            });

            return () => {
                unsubscribe();
            };
        } else {
            // Reset states when disconnected
            setIsMuted(false);
            setIsDeafened(false);
            setAudioLevel(0);
        }
    }, [isActive]);

    const loadDevices = async () => {
        const inputs = await voiceChatService.getAudioDevices();
        const outputs = await voiceChatService.getAudioOutputDevices();
        setAudioDevices(inputs);
        setOutputDevices(outputs);

        if (inputs.length > 0 && !selectedDevice) {
            setSelectedDevice(inputs[0].deviceId);
        }
        if (outputs.length > 0 && !selectedOutput) {
            setSelectedOutput(outputs[0].deviceId);
        }
    };

    const handleToggleMute = () => {
        const newMutedState = voiceChatService.toggleMute();
        setIsMuted(newMutedState);
    };

    const handleToggleDeafen = () => {
        const newDeafenedState = voiceChatService.toggleDeafen();
        setIsDeafened(newDeafenedState);

        // Update mute state based on service state
        setIsMuted(voiceChatService.getIsMuted());
    };

    const handleDeviceChange = async (deviceId: string) => {
        setSelectedDevice(deviceId);
        if (isActive) {
            await voiceChatService.changeAudioDevice(deviceId);
        }
        setMenuAnchor(null);
    };

    const handleOutputChange = async (deviceId: string) => {
        setSelectedOutput(deviceId);
        // Apply to all audio elements
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach((audio: any) => {
            if (audio.setSinkId) {
                audio.setSinkId(deviceId).catch((err: any) => {
                    console.error('Failed to set audio output device:', err);
                });
            }
        });
        setMenuAnchor(null);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 1,
                p: 2,
                borderTop: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}
        >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Голосовой чат
                </Typography>
                {isActive && (
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'success.main',
                            animation: 'pulse 2s infinite',
                            '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.5 },
                            },
                        }}
                    />
                )}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {isActive ? (
                    <>
                        <Tooltip title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>
                            <IconButton
                                size="small"
                                onClick={handleToggleMute}
                                color={isMuted ? 'error' : 'default'}
                            >
                                {isMuted ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Audio level indicator */}
                        <Box
                            sx={{
                                width: 60,
                                height: 4,
                                bgcolor: 'grey.300',
                                borderRadius: 2,
                                overflow: 'hidden',
                                mx: 0.5,
                            }}
                        >
                            <Box
                                sx={{
                                    width: `${isMuted ? 0 : audioLevel * 100}%`,
                                    height: '100%',
                                    bgcolor: audioLevel > 0.5 ? 'success.main' : 'primary.main',
                                    transition: 'width 0.1s ease-out',
                                }}
                            />
                        </Box>

                        <Tooltip title={isDeafened ? 'Включить звук' : 'Выключить звук'}>
                            <IconButton
                                size="small"
                                onClick={handleToggleDeafen}
                                color={isDeafened ? 'error' : 'default'}
                            >
                                {isDeafened ? <HeadsetOffIcon /> : <HeadsetIcon />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Настройки устройств">
                            <IconButton
                                size="small"
                                onClick={(e) => setMenuAnchor(e.currentTarget)}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Отключиться">
                            <IconButton
                                size="small"
                                onClick={onToggle}
                                color="error"
                                sx={{ ml: 1 }}
                            >
                                ✕
                            </IconButton>
                        </Tooltip>
                    </>
                ) : (
                    <Tooltip title="Подключиться к голосовому чату">
                        <IconButton
                            size="small"
                            onClick={onToggle}
                            color="primary"
                        >
                            <HeadsetIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {/* Device settings menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
            >
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Микрофон
                    </Typography>
                </Box>
                {audioDevices.map((device) => (
                    <MenuItem
                        key={device.deviceId}
                        selected={device.deviceId === selectedDevice}
                        onClick={() => handleDeviceChange(device.deviceId)}
                        sx={{ fontSize: '0.875rem' }}
                    >
                        {device.label || `Микрофон ${device.deviceId.slice(0, 5)}`}
                    </MenuItem>
                ))}

                <Divider sx={{ my: 1 }} />

                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Динамики
                    </Typography>
                </Box>
                {outputDevices.map((device) => (
                    <MenuItem
                        key={device.deviceId}
                        selected={device.deviceId === selectedOutput}
                        onClick={() => handleOutputChange(device.deviceId)}
                        sx={{ fontSize: '0.875rem' }}
                    >
                        {device.label || `Динамики ${device.deviceId.slice(0, 5)}`}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

export default VoiceControls;
