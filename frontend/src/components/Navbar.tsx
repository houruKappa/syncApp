import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, IconButton, Tooltip } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { socketService } from '../services/socket';
import { API_URL } from '../services/api';
import { useThemeMode } from '../contexts/ThemeContext';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
    const { mode, toggleTheme } = useThemeMode();

    const handleLogout = () => {
        dispatch(logout());
        socketService.disconnect();
        navigate('/login');
    };

    return (
        <AppBar position="fixed">
            <Toolbar>
                <Typography
                    variant="h6"
                    component="div"
                    sx={{ flexGrow: 1, cursor: 'pointer' }}
                    onClick={() => navigate('/')}
                >
                    SyncWatch
                </Typography>

                {isAuthenticated && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button color="inherit" onClick={() => navigate('/')}>
                            Комнаты
                        </Button>
                        <Button color="inherit" onClick={() => navigate('/history')}>
                            История
                        </Button>
                        <Tooltip title={mode === 'dark' ? 'Светлая тема' : 'Темная тема'}>
                            <IconButton color="inherit" onClick={toggleTheme}>
                                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                            </IconButton>
                        </Tooltip>
                        <Button color="inherit" onClick={() => navigate('/profile')}>
                            <Avatar
                                src={user?.avatar_url ? `${API_URL}${user.avatar_url}` : undefined}
                                sx={{ width: 32, height: 32, mr: 1 }}
                            />
                            {user?.username}
                        </Button>
                        <Button color="inherit" onClick={handleLogout}>
                            Выход
                        </Button>
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
