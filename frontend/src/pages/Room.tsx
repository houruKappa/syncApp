import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Grid, Box, Paper, CircularProgress, Alert, Snackbar, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { Fullscreen, FullscreenExit, Share } from '@mui/icons-material';
import { RootState } from '../store';
import { socketService } from '../services/socket';
import { voiceChatService } from '../services/voiceChat';
import {
    setRoom,
    setUsers,
    addUser,
    removeUser,
    setVideoQueue,
    setPlayerState,
    setCurrentTime,
    setCurrentVideoUrl,
    setConnected,
    resetRoom,
} from '../store/slices/roomSlice';
import { addMessage, addSystemMessage } from '../store/slices/chatSlice';
import { roomService } from '../services';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import UserList from '../components/UserList';
import VideoQueue from '../components/VideoQueue';
import VoiceControls from '../components/VoiceControls';
import VoiceAudio from '../components/VoiceAudio';

const Room: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { accessToken, user } = useSelector((state: RootState) => state.auth);
    const { currentRoom } = useSelector((state: RootState) => state.room);
    const [loading, setLoading] = useState(true);
    const [roomClosed, setRoomClosed] = useState(false);
    const [theaterMode, setTheaterMode] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [voiceActive, setVoiceActive] = useState(false);
    const [peerStreams, setPeerStreams] = useState<{ userId: string; stream: MediaStream }[]>([]);

    useEffect(() => {
        // Initialize voice chat service
        voiceChatService.initialize();

        // Setup peer stream callback
        voiceChatService.onPeerStream((userId, stream) => {
            console.log('Received peer stream:', userId);
            setPeerStreams((prev) => {
                // Remove existing stream for this user
                const filtered = prev.filter((p) => p.userId !== userId);
                return [...filtered, { userId, stream }];
            });
        });

        // Setup peer left callback
        voiceChatService.onPeerLeft((userId) => {
            console.log('Peer left:', userId);
            setPeerStreams((prev) => prev.filter((p) => p.userId !== userId));
        });

        return () => {
            // Leave voice chat on unmount
            if (voiceActive) {
                voiceChatService.leave();
            }
        };
    }, []);

    const handleToggleVoice = async () => {
        if (voiceActive) {
            await voiceChatService.leave();
            setVoiceActive(false);
        } else {
            const success = await voiceChatService.join();
            setVoiceActive(success);
        }
    };

    useEffect(() => {
        if (!id || !accessToken) {
            console.log('No id or accessToken');
            return;
        }

        const initRoom = async () => {
            try {
                // Fetch room data
                const response = await roomService.getRoomById(id);
                const room = response.data.room;

                // If room has password and user not yet in room, show password dialog
                // Check if current user is in the room by looking for their userId in users list
                const userInRoom = response.data.users.some((roomUser: any) => roomUser.id === user?.id);
                if (room.has_password && !userInRoom) {
                    setPasswordDialogOpen(true);
                    setLoading(false);
                    return;
                }

                dispatch(setRoom(room));
                dispatch(setUsers(response.data.users));

                // Connect socket
                const socket = socketService.connect(accessToken);

                // Join room
                socketService.joinRoom(id);

                // Setup socket listeners
                socket.on('user-joined', (data) => {
                    dispatch(addUser(data.user));
                    dispatch(addSystemMessage({
                        text: `${data.user.username} присоединился к комнате`,
                        timestamp: new Date().toISOString(),
                    }));
                });

                socket.on('user-left', (data) => {
                    dispatch(removeUser(data.userId));
                });

                socket.on('room-state', (data) => {
                    if (data.currentVideoUrl) {
                        dispatch(setCurrentVideoUrl(data.currentVideoUrl));
                    }
                    if (data.currentTime !== undefined) {
                        dispatch(setCurrentTime(data.currentTime));
                    }
                    if (data.playerState) {
                        dispatch(setPlayerState(data.playerState));
                    }
                    // Update users list if provided (includes moderator status)
                    if (data.users) {
                        dispatch(setUsers(data.users));
                    }
                });

                socket.on('player-sync', (data) => {
                    dispatch(setPlayerState(data.action === 'play' ? 'playing' : 'paused'));
                    if (data.time !== undefined) {
                        dispatch(setCurrentTime(data.time));
                    }
                });

                socket.on('new-message', (data) => {
                    dispatch(addMessage(data));
                });

                socket.on('system-message', (data) => {
                    dispatch(addSystemMessage(data));
                });

                socket.on('queue-updated', (data) => {
                    dispatch(setVideoQueue(data.videos));
                });

                socket.on('video-changed', (data) => {
                    if (data.videoUrl) {
                        dispatch(setCurrentVideoUrl(data.videoUrl));
                        dispatch(setCurrentTime(0));
                        if (data.state === 'playing') {
                            dispatch(setPlayerState('playing'));
                        } else {
                            dispatch(setPlayerState('paused'));
                        }
                    } else {
                        // Queue is empty
                        dispatch(setCurrentVideoUrl(''));
                        dispatch(setPlayerState('paused'));
                    }
                });

                socket.on('room-closed', (data) => {
                    console.log('Room closed event received:', data);
                    setRoomClosed(true);

                    // Leave voice chat if active
                    if (voiceActive) {
                        voiceChatService.leave();
                        setVoiceActive(false);
                        setPeerStreams([]);
                    }

                    dispatch(addSystemMessage({
                        text: data.message,
                        timestamp: new Date().toISOString(),
                    }));

                    // Clear room state
                    dispatch(resetRoom());

                    // Redirect to main page
                    setTimeout(() => {
                        socketService.disconnect();
                        navigate('/');
                    }, 2000);
                });

                socket.on('kicked', (data) => {
                    console.log('Kicked from room:', data);
                    alert(data.message);
                    dispatch(resetRoom());
                    socketService.disconnect();
                    navigate('/');
                });

                socket.on('connect', () => {
                    dispatch(setConnected(true));
                });

                socket.on('disconnect', () => {
                    dispatch(setConnected(false));
                });

                setLoading(false);
            } catch (error) {
                console.error('Failed to initialize room:', error);
                setLoading(false);
            }
        };

        initRoom();

        // Cleanup
        return () => {
            if (id) {
                socketService.leaveRoom(id);
            }
            dispatch(resetRoom());
        };
    }, [id, accessToken, dispatch, navigate]);

    // Handle ESC key to exit theater mode
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && theaterMode) {
                setTheaterMode(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [theaterMode]);

    const toggleTheaterMode = () => {
        setTheaterMode(!theaterMode);
    };

    const handleCopyInviteLink = async () => {
        const inviteLink = `${window.location.origin}/room/${id}`;
        try {
            await navigator.clipboard.writeText(inviteLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    };

    const handleJoinWithPassword = async () => {
        try {
            setPasswordError('');
            await roomService.joinRoom(id!, roomPassword);
            setPasswordDialogOpen(false);
            setRoomPassword('');
            // Reload room after successful password entry
            window.location.reload();
        } catch (error: any) {
            setPasswordError(error.response?.data?.message || 'Неверный пароль');
        }
    };

    const handleCancelPasswordDialog = () => {
        setPasswordDialogOpen(false);
        setRoomPassword('');
        setPasswordError('');
        navigate('/');
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth={theaterMode ? false : 'xl'} sx={{ mt: 2, mb: 2, px: theaterMode ? 0 : undefined }}>
            {/* Password Dialog */}
            <Dialog open={passwordDialogOpen} onClose={handleCancelPasswordDialog}>
                <DialogTitle>Эта комната защищена паролем</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Пароль"
                        type="password"
                        fullWidth
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        error={!!passwordError}
                        helperText={passwordError}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleJoinWithPassword();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelPasswordDialog}>Отмена</Button>
                    <Button onClick={handleJoinWithPassword} variant="contained">Войти</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={roomClosed}
                autoHideDuration={3000}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="warning" sx={{ width: '100%' }}>
                    Комната закрыта. Перенаправление на главную...
                </Alert>
            </Snackbar>

            {/* Theater mode toggle button and Share button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Button
                    variant="outlined"
                    startIcon={<Share />}
                    onClick={handleCopyInviteLink}
                    size="small"
                >
                    Поделиться
                </Button>
                <Tooltip title={theaterMode ? 'Выход из полноэкранного режима (ESC)' : 'Полноэкранный режим'}>
                    <IconButton onClick={toggleTheaterMode} color="primary">
                        {theaterMode ? <FullscreenExit /> : <Fullscreen />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Link copied notification */}
            <Snackbar
                open={linkCopied}
                autoHideDuration={3000}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                onClose={() => setLinkCopied(false)}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    Ссылка скопирована!
                </Alert>
            </Snackbar>

            <Grid container spacing={2}>
                {/* Video Player */}
                <Grid item xs={12} md={theaterMode ? 12 : 8}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <VideoPlayer />
                        <Box sx={{ mt: 2 }}>
                            <VideoQueue />
                        </Box>
                    </Paper>
                </Grid>

                {/* Sidebar - hidden in theater mode */}
                {!theaterMode && (
                    <Grid item xs={12} md={4}>
                        <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
                            <UserList voiceActive={voiceActive} />
                        </Paper>
                        <Paper elevation={3} sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
                            <VoiceControls isActive={voiceActive} onToggle={handleToggleVoice} />
                        </Paper>
                        <Paper elevation={3} sx={{ p: 2, height: '500px', display: 'flex', flexDirection: 'column' }}>
                            <Chat />
                        </Paper>
                    </Grid>
                )}
            </Grid>

            {/* Voice chat audio elements */}
            {peerStreams.map(({ userId, stream }) => (
                <VoiceAudio key={userId} userId={userId} stream={stream} />
            ))}
        </Container>
    );
};

export default Room;
