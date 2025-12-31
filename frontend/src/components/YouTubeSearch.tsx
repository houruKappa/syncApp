import React, { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Grid,
    Card,
    CardMedia,
    CardContent,
    Typography,
    IconButton,
    InputAdornment,
    CircularProgress,
    Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

interface YouTubeVideo {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    duration: string;
}

interface YouTubeSearchProps {
    onAddVideo: (videoUrl: string, title: string) => void;
}

const YouTubeSearch: React.FC<YouTubeSearchProps> = ({ onAddVideo }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeyError, setApiKeyError] = useState(false);

    // YouTube API Key - получите на https://console.cloud.google.com/
    const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY || '';

    const formatDuration = (duration: string): string => {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return '';

        const hours = (match[1] || '').replace('H', '');
        const minutes = (match[2] || '').replace('M', '');
        const seconds = (match[3] || '').replace('S', '');

        const parts = [];
        if (hours) parts.push(hours.padStart(2, '0'));
        if (minutes) parts.push(minutes.padStart(2, '0'));
        else if (hours) parts.push('00');
        if (seconds) parts.push(seconds.padStart(2, '0'));
        else parts.push('00');

        return parts.join(':');
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        if (!YOUTUBE_API_KEY) {
            setApiKeyError(true);
            setError('YouTube API ключ не настроен. Добавьте REACT_APP_YOUTUBE_API_KEY в .env файл');
            return;
        }

        setLoading(true);
        setError(null);
        setApiKeyError(false);

        try {
            // Search for videos
            const searchResponse = await axios.get(
                'https://www.googleapis.com/youtube/v3/search',
                {
                    params: {
                        part: 'snippet',
                        q: searchQuery,
                        type: 'video',
                        maxResults: 12,
                        key: YOUTUBE_API_KEY,
                    },
                }
            );

            const videoIds = searchResponse.data.items
                .map((item: any) => item.id.videoId)
                .join(',');

            // Get video details including duration
            const detailsResponse = await axios.get(
                'https://www.googleapis.com/youtube/v3/videos',
                {
                    params: {
                        part: 'contentDetails',
                        id: videoIds,
                        key: YOUTUBE_API_KEY,
                    },
                }
            );

            const videoDetails = detailsResponse.data.items.reduce(
                (acc: any, item: any) => {
                    acc[item.id] = item.contentDetails.duration;
                    return acc;
                },
                {}
            );

            const formattedVideos: YouTubeVideo[] = searchResponse.data.items.map(
                (item: any) => ({
                    id: item.id.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    channelTitle: item.snippet.channelTitle,
                    publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('ru-RU'),
                    duration: formatDuration(videoDetails[item.id.videoId] || ''),
                })
            );

            setVideos(formattedVideos);
        } catch (err: any) {
            console.error('YouTube API error:', err);
            if (err.response?.status === 403) {
                setError('Ошибка доступа к YouTube API. Проверьте API ключ или квоту запросов');
            } else {
                setError('Ошибка поиска видео. Попробуйте еще раз');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddToQueue = (video: YouTubeVideo) => {
        const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
        onAddVideo(videoUrl, video.title);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <Box>
            <TextField
                fullWidth
                placeholder="Поиск видео на YouTube..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={handleSearch} disabled={loading}>
                                <SearchIcon />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 2 }}
            />

            {error && (
                <Alert
                    severity={apiKeyError ? 'warning' : 'error'}
                    sx={{ mb: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                    {apiKeyError && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block">
                                1. Перейдите на{' '}
                                <a
                                    href="https://console.cloud.google.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Google Cloud Console
                                </a>
                            </Typography>
                            <Typography variant="caption" display="block">
                                2. Создайте проект и включите YouTube Data API v3
                            </Typography>
                            <Typography variant="caption" display="block">
                                3. Создайте API ключ в разделе "Credentials"
                            </Typography>
                            <Typography variant="caption" display="block">
                                4. Добавьте в frontend/.env: REACT_APP_YOUTUBE_API_KEY=ваш_ключ
                            </Typography>
                        </Box>
                    )}
                </Alert>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && videos.length === 0 && !error && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                        Введите запрос для поиска видео на YouTube
                    </Typography>
                </Box>
            )}

            <Grid container spacing={2} sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                {videos.map((video) => (
                    <Grid item xs={12} sm={6} md={4} key={video.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ position: 'relative' }}>
                                <CardMedia
                                    component="img"
                                    height="140"
                                    image={video.thumbnail}
                                    alt={video.title}
                                />
                                {video.duration && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            position: 'absolute',
                                            bottom: 4,
                                            right: 4,
                                            bgcolor: 'rgba(0, 0, 0, 0.8)',
                                            color: 'white',
                                            px: 0.5,
                                            py: 0.2,
                                            borderRadius: 0.5,
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {video.duration}
                                    </Typography>
                                )}
                            </Box>
                            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        mb: 0.5,
                                    }}
                                >
                                    {video.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {video.channelTitle}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {video.publishedAt}
                                </Typography>
                            </CardContent>
                            <Box sx={{ p: 1 }}>
                                <Button
                                    fullWidth
                                    size="small"
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleAddToQueue(video)}
                                >
                                    Добавить в очередь
                                </Button>
                            </Box>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default YouTubeSearch;
