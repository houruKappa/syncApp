import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
    Container,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Typography,
    Box,
    Fab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Checkbox,
    CircularProgress,
    InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import { roomService } from '../services';
import { socketService } from '../services/socket';

interface Room {
    id: string;
    name: string;
    creator_name: string;
    user_count: number;
    created_at: string;
    is_public: boolean;
    has_password: boolean;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { accessToken } = useSelector((state: RootState) => state.auth);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [roomPassword, setRoomPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        isPublic: true,
        password: '',
        videoUrl: '',
    });

    useEffect(() => {
        fetchRooms();

        // Setup socket listeners for live updates
        const socket = socketService.getSocket();
        if (!socket && accessToken) {
            socketService.connect(accessToken);
        }

        const setupListeners = () => {
            const socket = socketService.getSocket();
            if (!socket) return;

            // Refresh rooms when a new room is created or deleted
            socket.on('room-created', () => {
                console.log('New room created, refreshing list');
                fetchRooms();
            });

            socket.on('room-deleted', () => {
                console.log('Room deleted, refreshing list');
                fetchRooms();
            });

            // Refresh periodically to update user counts
            const interval = setInterval(() => {
                fetchRooms();
            }, 30000); // Every 30 seconds

            return () => {
                clearInterval(interval);
                socket.off('room-created');
                socket.off('room-deleted');
            };
        };

        const cleanup = setupListeners();
        return cleanup;
    }, []);

    const fetchRooms = async () => {
        try {
            const response = await roomService.getPublicRooms();
            setRooms(response.data.rooms);
        } catch (error) {
            console.error('Failed to fetch rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = () => {
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setFormData({ name: '', isPublic: true, password: '', videoUrl: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleCreateRoom = async () => {
        try {
            const response = await roomService.createRoom(formData);
            handleCloseDialog();

            // Broadcast room creation to all connected clients
            const socket = socketService.getSocket();
            if (socket) {
                socket.emit('room-created');
            }

            // Refresh room list
            await fetchRooms();

            // Navigate to the new room
            navigate(`/room/${response.data.room.id}`);
        } catch (error) {
            console.error('Failed to create room:', error);
        }
    };

    const handleJoinRoom = (roomId: string, hasPassword: boolean) => {
        if (hasPassword) {
            setSelectedRoomId(roomId);
            setPasswordDialogOpen(true);
        } else {
            navigate(`/room/${roomId}`);
        }
    };

    const handleJoinWithPassword = async () => {
        try {
            setPasswordError('');
            await roomService.joinRoom(selectedRoomId, roomPassword);
            setPasswordDialogOpen(false);
            setRoomPassword('');
            navigate(`/room/${selectedRoomId}`);
        } catch (error: any) {
            setPasswordError(error.response?.data?.message || 'Неверный пароль');
        }
    };

    const handleClosePasswordDialog = () => {
        setPasswordDialogOpen(false);
        setRoomPassword('');
        setPasswordError('');
        setSelectedRoomId('');
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Filter rooms based on search query
    const filteredRooms = rooms.filter((room) =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.creator_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" component="h1">
                    Комнаты для просмотра
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
                    Создать комнату
                </Button>
            </Box>

            {/* Search field */}
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Поиск по названию или создателю..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            {filteredRooms.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 8 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {searchQuery ? 'Ничего не найдено' : 'Нет доступных комнат'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {searchQuery
                            ? 'Попробуйте изменить поисковый запрос'
                            : 'Создайте свою первую комнату для просмотра видео вместе с друзьями'}
                    </Typography>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {filteredRooms.map((room) => (
                        <Grid item xs={12} sm={6} md={4} key={room.id}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {room.name}
                                            {room.has_password && (
                                                <LockIcon fontSize="small" color="action" titleAccess="Требуется пароль" />
                                            )}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Создатель: {room.creator_name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                        <PeopleIcon fontSize="small" sx={{ mr: 0.5 }} />
                                        <Typography variant="body2" color="text.secondary">
                                            {room.user_count} участников
                                        </Typography>
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <Button size="small" onClick={() => handleJoinRoom(room.id, room.has_password)}>
                                        Присоединиться
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Room Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Создать комнату</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Название комнаты"
                        type="text"
                        fullWidth
                        required
                        value={formData.name}
                        onChange={handleChange}
                    />
                    <TextField
                        margin="dense"
                        name="videoUrl"
                        label="URL видео (YouTube или загруженное)"
                        type="text"
                        fullWidth
                        value={formData.videoUrl}
                        onChange={handleChange}
                        helperText="Опционально: можно добавить позже"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="isPublic"
                                checked={formData.isPublic}
                                onChange={handleChange}
                            />
                        }
                        label="Публичная комната"
                    />
                    {!formData.isPublic && (
                        <TextField
                            margin="dense"
                            name="password"
                            label="Пароль"
                            type="password"
                            fullWidth
                            value={formData.password}
                            onChange={handleChange}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Отмена</Button>
                    <Button onClick={handleCreateRoom} variant="contained" disabled={!formData.name}>
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Password Dialog */}
            <Dialog open={passwordDialogOpen} onClose={handleClosePasswordDialog}>
                <DialogTitle>Введите пароль</DialogTitle>
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
                    <Button onClick={handleClosePasswordDialog}>Отмена</Button>
                    <Button onClick={handleJoinWithPassword} variant="contained">Войти</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Dashboard;
