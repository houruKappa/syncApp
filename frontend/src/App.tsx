import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from './store';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import Profile from './pages/Profile';
import History from './pages/History';

// Components
import Navbar from './components/Navbar';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';

// Theme
import { ThemeContextProvider } from './contexts/ThemeContext';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    return isAuthenticated ? (
        <AuthGuard>{children}</AuthGuard>
    ) : (
        <Navigate to="/login" replace />
    );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ThemeContextProvider>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                    <Navbar />
                    <Box component="main" sx={{ flexGrow: 1, pt: 8 }}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route
                                path="/"
                                element={
                                    <PrivateRoute>
                                        <Dashboard />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/room/:id"
                                element={
                                    <PrivateRoute>
                                        <Room />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <PrivateRoute>
                                        <Profile />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/history"
                                element={
                                    <PrivateRoute>
                                        <History />
                                    </PrivateRoute>
                                }
                            />
                        </Routes>
                    </Box>
                </Box>
            </ThemeContextProvider>
        </ErrorBoundary>
    );
};

export default App;
