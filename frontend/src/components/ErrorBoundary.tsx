import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <Container maxWidth="sm">
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '100vh',
                            textAlign: 'center',
                            gap: 3,
                        }}
                    >
                        <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main' }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Что-то пошло не так
                        </Typography>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            Произошла ошибка при загрузке страницы.
                        </Typography>
                        {this.state.error && (
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: 'grey.100',
                                    borderRadius: 1,
                                    maxWidth: '100%',
                                    overflow: 'auto',
                                }}
                            >
                                <Typography variant="caption" component="pre" sx={{ textAlign: 'left' }}>
                                    {this.state.error.toString()}
                                </Typography>
                            </Box>
                        )}
                        <Button variant="contained" size="large" onClick={this.handleReset}>
                            Вернуться на главную
                        </Button>
                    </Box>
                </Container>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
