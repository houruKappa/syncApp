import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Chip,
    IconButton,
    Tooltip,
    Button,
    Divider,
    Slider,
    Popover,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { RootState } from '../store';
import { API_URL } from '../services/api';
import { socketService } from '../services/socket';
import { voiceChatService } from '../services/voiceChat';

interface UserListProps {
    voiceActive: boolean;
}

const UserList: React.FC<UserListProps> = ({ voiceActive }) => {
    const { users } = useSelector((state: RootState) => state.room);
    const { user: currentUser } = useSelector((state: RootState) => state.auth);
    const roomId = window.location.pathname.split('/').pop();
    const [volumeAnchor, setVolumeAnchor] = useState<{ element: HTMLElement; userId: string } | null>(null);
    const [userVolumes, setUserVolumes] = useState<{ [userId: string]: number }>({});

    const currentUserInRoom = users.find(u => u.id === currentUser?.id);
    const isModerator = currentUserInRoom?.is_moderator;

    useEffect(() => {
        // Initialize volumes
        const initialVolumes: { [userId: string]: number } = {};
        users.forEach(user => {
            initialVolumes[user.id] = voiceChatService.getPeerVolume(user.id);
        });
        setUserVolumes(initialVolumes);
    }, [users]);

    const handleKickUser = (userId: string) => {
        if (window.confirm('Исключить этого пользователя?')) {
            socketService.emit('kick-user', { roomId, userId });
        }
    };

    const handleDeleteRoom = () => {
        if (window.confirm('Расформировать комнату? Все участники будут отключены, и комната будет удалена безвозвратно.')) {
            socketService.deleteRoom(roomId!);
        }
    };

    const handleVolumeClick = (event: React.MouseEvent<HTMLElement>, userId: string) => {
        setVolumeAnchor({ element: event.currentTarget, userId });
    };

    const handleVolumeChange = (userId: string, volume: number) => {
        voiceChatService.setPeerVolume(userId, volume);
        setUserVolumes(prev => ({ ...prev, [userId]: volume }));
    };

    const handleVolumeClose = () => {
        setVolumeAnchor(null);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Участники ({users.length})
                </Typography>
                {isModerator && (
                    <Tooltip title="Расформировать комнату">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={handleDeleteRoom}
                        >
                            <DeleteForeverIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {isModerator && (
                <>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        fullWidth
                        startIcon={<DeleteForeverIcon />}
                        onClick={handleDeleteRoom}
                        sx={{ mb: 2 }}
                    >
                        Расформировать комнату
                    </Button>
                    <Divider sx={{ mb: 2 }} />
                </>
            )}

            <List>
                {users.map((user) => (
                    <ListItem
                        key={user.id}
                        secondaryAction={
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {voiceActive && user.id !== currentUser?.id && (
                                    <Tooltip title="Громкость">
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={(e) => handleVolumeClick(e, user.id)}
                                        >
                                            {(userVolumes[user.id] ?? 1) === 0 ? (
                                                <VolumeOffIcon fontSize="small" />
                                            ) : (
                                                <VolumeUpIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {isModerator && user.id !== currentUser?.id && !user.is_moderator && (
                                    <Tooltip title="Исключить">
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            color="error"
                                            onClick={() => handleKickUser(user.id)}
                                        >
                                            <BlockIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        }
                    >
                        <ListItemAvatar>
                            <Avatar
                                src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined}
                            >
                                {user.username[0]}
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={user.username}
                            secondary={user.is_moderator && <Chip label="Модератор" size="small" color="primary" />}
                        />
                    </ListItem>
                ))}
            </List>

            {/* Volume control popover */}
            <Popover
                open={Boolean(volumeAnchor)}
                anchorEl={volumeAnchor?.element}
                onClose={handleVolumeClose}
                anchorOrigin={{
                    vertical: 'center',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'center',
                    horizontal: 'right',
                }}
            >
                <Box sx={{ p: 2, width: 200 }}>
                    <Typography variant="caption" gutterBottom>
                        Громкость: {Math.round((userVolumes[volumeAnchor?.userId ?? ''] ?? 1) * 100)}%
                    </Typography>
                    <Slider
                        value={userVolumes[volumeAnchor?.userId ?? ''] ?? 1}
                        onChange={(_, value) => handleVolumeChange(volumeAnchor?.userId ?? '', value as number)}
                        min={0}
                        max={1}
                        step={0.01}
                        marks={[
                            { value: 0, label: '0%' },
                            { value: 0.5, label: '50%' },
                            { value: 1, label: '100%' },
                        ]}
                    />
                </Box>
            </Popover>
        </Box>
    );
};

export default UserList;
