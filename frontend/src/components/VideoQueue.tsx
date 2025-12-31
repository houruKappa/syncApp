import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    TextField,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    LinearProgress,
    Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { RootState } from '../store';
import { socketService } from '../services/socket';
import { videoService } from '../services';
import YouTubeSearch from './YouTubeSearch';

const VideoQueue: React.FC = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const { videoQueue, users } = useSelector((state: RootState) => state.room);
    const { user } = useSelector((state: RootState) => state.auth);

    const isModerator = users.find((u) => u.id === user?.id)?.is_moderator || false;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            if (!allowedTypes.includes(file.type)) {
                setError('Поддерживаются только файлы MP4, WebM и OGG');
                return;
            }
            // Validate file size (max 200MB)
            const maxSize = 200 * 1024 * 1024;
            if (file.size > maxSize) {
                setError('Файл слишком большой. Максимальный размер: 200MB');
                return;
            }
            setSelectedFile(file);
            setVideoTitle(file.name.replace(/\.[^/.]+$/, '')); // Set filename as title
            setError(null);
        }
    };

    const handleUploadVideo = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            const response = await videoService.uploadVideo(selectedFile, (progress) => {
                setUploadProgress(progress);
            });

            const videoUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/videos/${response.data.video.filename}`;

            socketService.addToQueue(videoUrl, videoTitle || selectedFile.name);

            // Reset form
            setSelectedFile(null);
            setVideoTitle('');
            setVideoUrl('');
            setDialogOpen(false);
            setTabValue(0);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки видео');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleAddToQueue = () => {
        if (!videoUrl.trim()) return;
        socketService.addToQueue(videoUrl, videoTitle || 'Untitled');
        setVideoUrl('');
        setVideoTitle('');
        setDialogOpen(false);
        setTabValue(0);
    };

    const handleAddYouTubeVideo = (videoUrl: string, title: string) => {
        socketService.addToQueue(videoUrl, title);
        setDialogOpen(false);
        setTabValue(0);
    };

    const handlePlayNext = () => {
        socketService.playNext();
    };

    const handleSkipVideo = () => {
        socketService.skipVideo();
    };

    const handleRemoveFromQueue = (videoId: string) => {
        socketService.removeFromQueue(videoId);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !isModerator) return;

        const items = Array.from(videoQueue);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update queue positions and send to server
        const updatedVideos = items.map((video, index) => ({
            id: video.id,
            queue_position: index
        }));

        socketService.emit('reorder-queue', { videos: updatedVideos });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Очередь видео</Typography>
                <Box>
                    {isModerator && videoQueue.length > 0 && (
                        <Button
                            startIcon={<SkipNextIcon />}
                            onClick={handleSkipVideo}
                            size="small"
                            sx={{ mr: 1 }}
                            color="warning"
                        >
                            Пропустить
                        </Button>
                    )}
                    <Button startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} size="small">
                        Добавить
                    </Button>
                </Box>
            </Box>

            {videoQueue.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Очередь пуста
                </Typography>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="video-queue">
                        {(provided) => (
                            <List dense {...provided.droppableProps} ref={provided.innerRef}>
                                {videoQueue.map((video, index) => (
                                    <Draggable
                                        key={video.id}
                                        draggableId={video.id}
                                        index={index}
                                        isDragDisabled={!isModerator}
                                    >
                                        {(provided, snapshot) => (
                                            <ListItem
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                sx={{
                                                    bgcolor: snapshot.isDragging ? 'action.hover' :
                                                        index === 0 ? 'action.selected' : 'transparent',
                                                    borderRadius: 1,
                                                    mb: 0.5,
                                                    cursor: isModerator ? 'grab' : 'default',
                                                }}
                                                secondaryAction={
                                                    isModerator ? (
                                                        <Box>
                                                            {index === 0 ? (
                                                                <IconButton edge="end" onClick={handlePlayNext} title="Воспроизвести">
                                                                    <PlayArrowIcon />
                                                                </IconButton>
                                                            ) : null}
                                                            <IconButton
                                                                edge="end"
                                                                onClick={() => handleRemoveFromQueue(video.id)}
                                                                title="Удалить"
                                                                color="error"
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Box>
                                                    ) : null
                                                }
                                            >
                                                {isModerator && (
                                                    <Box {...provided.dragHandleProps} sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                                        <DragIndicatorIcon color="action" />
                                                    </Box>
                                                )}
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Typography variant="body2" sx={{ fontWeight: index === 0 ? 'bold' : 'normal' }}>
                                                                {index + 1}. {video.video_title}
                                                            </Typography>
                                                            {index === 0 && (
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        ml: 1,
                                                                        px: 1,
                                                                        py: 0.3,
                                                                        bgcolor: 'primary.main',
                                                                        color: 'white',
                                                                        borderRadius: 1
                                                                    }}
                                                                >
                                                                    Сейчас
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                    secondary={video.video_url}
                                                    secondaryTypographyProps={{
                                                        noWrap: true,
                                                        sx: { maxWidth: '300px' },
                                                    }}
                                                />
                                            </ListItem>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </List>
                        )}
                    </Droppable>
                </DragDropContext>
            )}

            {/* Add Video Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Добавить видео в очередь</DialogTitle>
                <DialogContent>
                    <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                        <Tab label="Поиск YouTube" />
                        <Tab label="URL видео" />
                        <Tab label="Загрузить с ПК" />
                    </Tabs>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {tabValue === 0 && (
                        <YouTubeSearch onAddVideo={handleAddYouTubeVideo} />
                    )}

                    {tabValue === 1 && (
                        <>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="URL видео"
                                type="url"
                                fullWidth
                                required
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                helperText="YouTube ссылки или прямые ссылки на видео"
                            />
                            <TextField
                                margin="dense"
                                label="Название (опционально)"
                                type="text"
                                fullWidth
                                value={videoTitle}
                                onChange={(e) => setVideoTitle(e.target.value)}
                            />
                        </>
                    )}

                    {tabValue === 2 && (
                        <>
                            <Button
                                variant="outlined"
                                component="label"
                                fullWidth
                                startIcon={<CloudUploadIcon />}
                                sx={{ mb: 2, mt: 1, py: 2 }}
                                disabled={uploading}
                            >
                                {selectedFile ? selectedFile.name : 'Выберите видео файл'}
                                <input
                                    type="file"
                                    hidden
                                    accept="video/mp4,video/webm,video/ogg"
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                />
                            </Button>

                            {selectedFile && (
                                <>
                                    <TextField
                                        margin="dense"
                                        label="Название видео"
                                        type="text"
                                        fullWidth
                                        value={videoTitle}
                                        onChange={(e) => setVideoTitle(e.target.value)}
                                        disabled={uploading}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                        Размер: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </Typography>
                                </>
                            )}

                            {uploading && (
                                <Box sx={{ mt: 2 }}>
                                    <LinearProgress variant="determinate" value={uploadProgress} />
                                    <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                                        Загрузка... {uploadProgress}%
                                    </Typography>
                                </Box>
                            )}

                            <Alert severity="info" sx={{ mt: 2 }}>
                                Поддерживаются: MP4, WebM, OGG. Максимальный размер: 200MB
                            </Alert>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setDialogOpen(false);
                        setTabValue(0);
                        setSelectedFile(null);
                        setError(null);
                    }} disabled={uploading}>
                        Отмена
                    </Button>
                    {tabValue === 1 ? (
                        <Button onClick={handleAddToQueue} variant="contained" disabled={!videoUrl.trim()}>
                            Добавить
                        </Button>
                    ) : tabValue === 2 ? (
                        <Button
                            onClick={handleUploadVideo}
                            variant="contained"
                            disabled={!selectedFile || uploading}
                            startIcon={uploading ? undefined : <CloudUploadIcon />}
                        >
                            {uploading ? 'Загрузка...' : 'Загрузить'}
                        </Button>
                    ) : null}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default VideoQueue;
