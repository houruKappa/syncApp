import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    CardActions,
    Button,
    Grid,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
    TextField,
    InputAdornment,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { userService, roomService } from '../services';

interface HistoryRoom {
    id: string;
    name: string;
    is_public: boolean;
    created_at: string;
    joined_at: string;
    is_moderator: boolean;
    deleted: boolean;
}

const History: React.FC = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<HistoryRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const response = await userService.getRoomHistory();
            setRooms(response.data.rooms);
        } catch (error) {
            console.error('Failed to fetch room history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoom = async (roomId: string, roomName: string) => {
        if (window.confirm(`Удалить комнату "${roomName}"? Это действие нельзя отменить.`)) {
            try {
                await roomService.deleteRoom(roomId);
                // Обновляем список
                setRooms(rooms.filter(r => r.id !== roomId));
            } catch (error: any) {
                alert(error.response?.data?.message || 'Не удалось удалить комнату');
            }
        }
    };

    const handleClearHistory = async () => {
        if (window.confirm('Очистить всю историю комнат? Это действие нельзя отменить.')) {
            try {
                await userService.clearRoomHistory();
                setRooms([]);
            } catch (error: any) {
                alert(error.response?.data?.message || 'Не удалось очистить историю');
            }
        }
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
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon /> История комнат
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Комнаты, которые вы посещали
                    </Typography>
                </Box>
                {rooms.length > 0 && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleClearHistory}
                    >
                        Очистить историю
                    </Button>
                )}
            </Box>

            {/* Search field */}
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Поиск по названию комнаты..."
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
                    <Typography variant="h6" color="text.secondary">
                        {searchQuery ? 'Ничего не найдено' : 'История пуста'}
                    </Typography>
                    <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => navigate('/')}
                    >
                        Перейти к комнатам
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {filteredRooms.map((room) => (
                        <Grid item xs={12} sm={6} md={4} key={room.id}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            {room.name}
                                            {!room.is_public && (
                                                <LockIcon fontSize="small" color="action" />
                                            )}
                                        </Typography>
                                        {room.is_moderator && !room.deleted && (
                                            <Tooltip title="Удалить комнату">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteRoom(room.id, room.name)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Посещена: {new Date(room.joined_at).toLocaleString('ru-RU')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                        {room.is_moderator && (
                                            <Chip label="Модератор" size="small" color="primary" />
                                        )}
                                        {room.deleted && (
                                            <Chip label="Удалена" size="small" color="error" />
                                        )}
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        onClick={() => navigate(`/room/${room.id}`)}
                                        disabled={room.deleted}
                                    >
                                        Открыть
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    );
};

export default History;
