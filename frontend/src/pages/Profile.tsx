import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Container,
    Paper,
    Box,
    Avatar,
    Typography,
    TextField,
    Button,
    Grid,
    IconButton,
} from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { RootState } from '../store';
import { setUser } from '../store/slices/authSlice';
import { userService } from '../services';
import { API_URL } from '../services/api';

const Profile: React.FC = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state: RootState) => state.auth);
    const [username, setUsername] = useState(user?.username || '');
    const [loading, setLoading] = useState(false);

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const response = await userService.updateProfile({ username });
            dispatch(setUser(response.data.user));
            alert('Профиль обновлен успешно');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Ошибка при обновлении профиля');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const response = await userService.uploadAvatar(file);
            dispatch(setUser(response.data.user));
            alert('Аватар обновлен успешно');
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Ошибка при загрузке аватара');
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Профиль пользователя
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            src={user?.avatar_url ? `${API_URL}${user.avatar_url}` : undefined}
                            sx={{ width: 120, height: 120, mb: 2 }}
                        />
                        <IconButton
                            color="primary"
                            component="label"
                            sx={{
                                position: 'absolute',
                                bottom: 16,
                                right: -8,
                                bgcolor: 'background.paper',
                            }}
                        >
                            <input hidden accept="image/*" type="file" onChange={handleAvatarUpload} />
                            <PhotoCamera />
                        </IconButton>
                    </Box>
                    <Typography variant="h6">{user?.username}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {user?.email}
                    </Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Имя пользователя"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Email"
                            value={user?.email}
                            disabled
                            helperText="Email нельзя изменить"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleUpdateProfile}
                            disabled={loading || username === user?.username}
                        >
                            Сохранить изменения
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
};

export default Profile;
