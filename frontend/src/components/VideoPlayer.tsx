import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Button, Menu, MenuItem } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import './VideoPlayer.css';
import 'videojs-youtube';
import { RootState } from '../store';
import { socketService } from '../services/socket';
import { parseVideoUrl, getEmbedUrl } from '../utils/videoUtils';

// Extend videojs types
declare module 'video.js' {
    export interface VideoJsPlayer {
        qualityLevels?: () => any;
    }
}

const VideoPlayer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isModerator, setIsModerator] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [isYouTubeVideo, setIsYouTubeVideo] = useState(false);
    const [availableQualities, setAvailableQualities] = useState<string[]>([]);
    const [currentQuality, setCurrentQuality] = useState<string>('auto');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [qualityButtonEl, setQualityButtonEl] = useState<HTMLElement | null>(null); const [videoPlatform, setVideoPlatform] = useState<string>('youtube');
    const [embedUrl, setEmbedUrl] = useState<string>(''); const { currentVideoUrl, playerState, currentTime, users, videoQueue } = useSelector(
        (state: RootState) => state.room
    );
    const { user } = useSelector((state: RootState) => state.auth);

    console.log('VideoPlayer render - currentVideoUrl:', currentVideoUrl, 'playerState:', playerState);

    // Get quality label
    const getQualityLabel = (quality: string): string => {
        const labels: { [key: string]: string } = {
            'highres': '4K',
            'hd1440': '1440p',
            'hd1080': '1080p',
            'hd720': '720p',
            'large': '480p',
            'medium': '360p',
            'small': '240p',
            'tiny': '144p',
            'auto': 'Авто'
        };
        return labels[quality] || quality;
    };

    // Change YouTube quality
    const handleQualityChange = (quality: string) => {
        if (!playerRef.current || !isYouTubeVideo) return;

        try {
            const ytPlayer = playerRef.current.tech({ IWillNotUseThisInPlugins: true })?.ytPlayer;
            if (ytPlayer && typeof ytPlayer.setPlaybackQuality === 'function') {
                const currentTime = playerRef.current.currentTime();
                const isPaused = playerRef.current.paused();

                ytPlayer.setPlaybackQuality(quality);
                setCurrentQuality(quality);

                // Restore playback state
                setTimeout(() => {
                    if (playerRef.current) {
                        playerRef.current.currentTime(currentTime);
                        if (!isPaused) {
                            playerRef.current.play();
                        }
                    }
                }, 200);

                console.log('Changed quality to:', quality);
            }
        } catch (error) {
            console.error('Error changing YouTube quality:', error);
        }

        setMenuAnchor(null);
    };

    // Get available YouTube qualities
    const loadYouTubeQualities = () => {
        if (!playerRef.current || !isYouTubeVideo) return;

        try {
            const ytPlayer = playerRef.current.tech({ IWillNotUseThisInPlugins: true })?.ytPlayer;
            if (ytPlayer && typeof ytPlayer.getAvailableQualityLevels === 'function') {
                const qualities = ytPlayer.getAvailableQualityLevels();
                console.log('Available YouTube qualities:', qualities);

                if (qualities && qualities.length > 0) {
                    setAvailableQualities(qualities);

                    // Get current quality
                    const current = ytPlayer.getPlaybackQuality();
                    setCurrentQuality(current || 'auto');
                }
            }
        } catch (error) {
            console.error('Error getting YouTube qualities:', error);
        }
    };

    useEffect(() => {
        // Check if user is moderator
        const currentUser = users.find((u) => u.id === user?.id);
        setIsModerator(currentUser?.is_moderator || false);
    }, [users, user]);

    // Initialize video.js player once
    useEffect(() => {
        if (!videoRef.current || hasInitialized) return;

        console.log('Initializing video.js player for the first time');

        // Always initialize with full controls first
        const playerOptions: any = {
            controls: true,
            fluid: true,
            responsive: true,
            preload: 'auto',
            techOrder: ['html5', 'youtube'],
            html5: {
                vhs: {
                    overrideNative: true
                }
            },
            youtube: {
                ytControls: 0,
                iv_load_policy: 3,
                customVars: {
                    wmode: 'transparent'
                }
            }
        };

        playerRef.current = videojs(videoRef.current, playerOptions);

        playerRef.current.ready(() => {
            console.log('Video.js player is ready');

            // Restore saved volume
            const savedVolume = localStorage.getItem('playerVolume');
            if (savedVolume !== null) {
                const volume = parseFloat(savedVolume);
                playerRef.current.volume(volume);
                console.log('Restored volume:', volume);
            }

            setIsReady(true);
            setHasInitialized(true);
        });

        return () => {
            if (playerRef.current && !playerRef.current.isDisposed()) {
                console.log('Disposing video.js player');
                playerRef.current.dispose();
                playerRef.current = null;
                setIsReady(false);
                setHasInitialized(false);
            }
        };
    }, []); // Initialize only once

    // Update controlBar based on moderator status
    useEffect(() => {
        if (!playerRef.current || !isReady) return;

        console.log('Updating controlBar, isModerator:', isModerator);

        const controlBar = playerRef.current.controlBar;

        if (!isModerator) {
            // Hide controls for non-moderators except volume, quality and fullscreen
            controlBar.playToggle?.hide();
            controlBar.currentTimeDisplay?.hide();
            controlBar.timeDivider?.hide();
            controlBar.durationDisplay?.hide();
            controlBar.progressControl?.hide();
            controlBar.remainingTimeDisplay?.hide();
            controlBar.playbackRateMenuButton?.hide();

            // Show only volume, quality button and fullscreen
            controlBar.volumePanel?.show();
            controlBar.fullscreenToggle?.show();
            // Quality button is custom, always visible
        } else {
            // Show all controls for moderators
            controlBar.playToggle?.show();
            controlBar.currentTimeDisplay?.show();
            controlBar.timeDivider?.show();
            controlBar.durationDisplay?.show();
            controlBar.progressControl?.show();
            controlBar.remainingTimeDisplay?.show();
            controlBar.volumePanel?.show();
            controlBar.fullscreenToggle?.show();
        }
    }, [isModerator, isReady]);

    // Load video when URL changes
    useEffect(() => {
        if (!playerRef.current || !isReady) {
            console.log('Player not ready yet');
            return;
        }

        if (!currentVideoUrl) {
            console.log('No video URL, resetting player');
            playerRef.current.reset();
            setIsYouTubeVideo(false);
            setAvailableQualities([]);
            return;
        }

        console.log('Loading video:', currentVideoUrl);

        // Parse video URL to determine platform
        const videoInfo = parseVideoUrl(currentVideoUrl);

        if (!videoInfo) {
            console.error('Unsupported video URL:', currentVideoUrl);
            return;
        }

        const isYouTube = videoInfo.platform === 'youtube';
        setIsYouTubeVideo(isYouTube);
        setVideoPlatform(videoInfo.platform);

        try {
            if (isYouTube) {
                console.log('Loading YouTube video:', videoInfo.id);
                setEmbedUrl('');
                playerRef.current.src({
                    type: 'video/youtube',
                    src: videoInfo.url,
                });

                // Get qualities after video loads
                playerRef.current.one('loadedmetadata', () => {
                    setTimeout(() => {
                        loadYouTubeQualities();
                    }, 2000);
                });
            } else if (videoInfo.platform === 'rutube' || videoInfo.platform === 'vimeo') {
                // For Rutube and Vimeo, use iframe embed
                console.log(`Loading ${videoInfo.platform} video:`, videoInfo.id);

                const embedUrl = getEmbedUrl(videoInfo);
                setEmbedUrl(embedUrl);

                // Hide video.js player for iframe platforms
                playerRef.current.reset();
                setAvailableQualities([]);
            } else if (videoInfo.platform === 'direct') {
                console.log('Loading direct video:', videoInfo.url);
                setEmbedUrl('');

                // Detect video type from extension
                let videoType = 'video/mp4';
                if (videoInfo.url.includes('.webm')) {
                    videoType = 'video/webm';
                } else if (videoInfo.url.includes('.ogg')) {
                    videoType = 'video/ogg';
                }

                playerRef.current.src({
                    type: videoType,
                    src: videoInfo.url,
                });
                setAvailableQualities([]);
            }

            if (!embedUrl) {
                playerRef.current.load();

                // Auto-play if state is playing
                if (playerState === 'playing') {
                    setTimeout(() => {
                        playerRef.current?.play()?.catch((err: any) => {
                            console.error('Autoplay failed:', err);
                        });
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Error loading video:', error);
        }
    }, [currentVideoUrl, isReady]);

    // Sync player state
    useEffect(() => {
        if (!playerRef.current || !isReady) return;

        console.log('Syncing player state:', playerState);

        if (playerState === 'playing') {
            playerRef.current.play()?.catch((err: any) => {
                console.error('Play failed:', err);
            });
        } else if (playerState === 'paused') {
            playerRef.current.pause();
        }
    }, [playerState, isReady]);

    // Sync current time
    useEffect(() => {
        if (!playerRef.current || !isReady) return;

        const currentPlayerTime = playerRef.current.currentTime();
        if (currentTime !== undefined && Math.abs(currentPlayerTime - currentTime) > 2) {
            console.log('Syncing time to:', currentTime);
            playerRef.current.currentTime(currentTime);
        }
    }, [currentTime, isReady]);

    // Setup player event listeners for moderator
    useEffect(() => {
        if (!playerRef.current || !isReady || !isModerator) return;

        const player = playerRef.current;

        const handlePlayerPlay = () => {
            const time = player.currentTime() || 0;
            console.log('Player play event, time:', time);
            socketService.sendPlayerAction('play', time);
        };

        const handlePlayerPause = () => {
            const time = player.currentTime() || 0;
            console.log('Player pause event, time:', time);
            socketService.sendPlayerAction('pause', time);
        };

        const handlePlayerSeeked = () => {
            const time = player.currentTime() || 0;
            const state = player.paused() ? 'pause' : 'play';
            console.log('Player seeked event, time:', time, 'state:', state);
            socketService.sendPlayerAction(state as 'play' | 'pause', time);
        };

        const handlePlayerEnded = () => {
            console.log('Video ended - playing next video');
            socketService.playNext();
        };

        player.on('play', handlePlayerPlay);
        player.on('pause', handlePlayerPause);
        player.on('seeked', handlePlayerSeeked);
        player.on('ended', handlePlayerEnded);

        return () => {
            player.off('play', handlePlayerPlay);
            player.off('pause', handlePlayerPause);
            player.off('seeked', handlePlayerSeeked);
            player.off('ended', handlePlayerEnded);
        };
    }, [isReady, isModerator]);

    // Periodic sync for moderator - send current time every 5 seconds
    useEffect(() => {
        if (!playerRef.current || !isReady || !isModerator) return;

        const syncInterval = setInterval(() => {
            if (playerRef.current && !playerRef.current.paused()) {
                const time = playerRef.current.currentTime() || 0;
                const action = playerRef.current.paused() ? 'pause' : 'play';
                console.log('Periodic sync, time:', time, 'action:', action);
                socketService.sendPlayerAction(action as 'play' | 'pause', time);
            }
        }, 5000);

        return () => clearInterval(syncInterval);
    }, [isReady, isModerator]);

    // Save volume to localStorage on change
    useEffect(() => {
        if (!playerRef.current || !isReady) return;

        const player = playerRef.current;

        const handleVolumeChange = () => {
            const volume = player.volume();
            localStorage.setItem('playerVolume', volume.toString());
            console.log('Volume saved:', volume);
        };

        player.on('volumechange', handleVolumeChange);

        return () => {
            player.off('volumechange', handleVolumeChange);
        };
    }, [isReady]);

    return (
        <Box>
            {/* Quality selector button for YouTube videos */}
            {isYouTubeVideo && availableQualities.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SettingsIcon />}
                        onClick={(e) => setMenuAnchor(e.currentTarget)}
                        sx={{ textTransform: 'none' }}
                    >
                        Качество: {getQualityLabel(currentQuality)}
                    </Button>
                    <Menu
                        anchorEl={menuAnchor}
                        open={Boolean(menuAnchor)}
                        onClose={() => setMenuAnchor(null)}
                    >
                        {availableQualities.map((quality) => (
                            <MenuItem
                                key={quality}
                                selected={quality === currentQuality}
                                onClick={() => handleQualityChange(quality)}
                            >
                                {getQualityLabel(quality)}
                                {quality === currentQuality && ' ✓'}
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>
            )}

            <Box sx={{ position: 'relative', mb: 2 }}>
                {/* Placeholder when no video */}
                {!currentVideoUrl && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            minHeight: '400px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'grey.900',
                            borderRadius: 1,
                            zIndex: 10,
                        }}
                    >
                        <Typography variant="h6" color="grey.400">
                            Видео не выбрано
                        </Typography>
                    </Box>
                )}

                {/* Video player - always present in DOM */}
                <Box
                    ref={containerRef}
                    sx={{
                        opacity: currentVideoUrl ? 1 : 0,
                        minHeight: '400px',
                        position: 'relative',
                    }}
                >
                    {embedUrl ? (
                        // Show iframe for Rutube and Vimeo
                        <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
                            <iframe
                                src={embedUrl}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Video Player"
                            />
                            {!isModerator && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                    }}
                                />
                            )}
                        </Box>
                    ) : (
                        // Show video.js player for YouTube and direct videos
                        <div data-vjs-player>
                            <video
                                ref={videoRef}
                                className="video-js vjs-big-play-centered"
                            />
                        </div>
                    )}
                </Box>
            </Box>

            {isModerator && currentVideoUrl && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Typography variant="caption" color="primary">
                        Вы модератор - управляйте плеером напрямую
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default VideoPlayer;
