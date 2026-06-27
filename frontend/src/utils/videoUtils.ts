// Utility functions for parsing video URLs from different platforms

export interface VideoInfo {
    platform: 'youtube' | 'rutube' | 'vimeo' | 'direct';
    id: string;
    url: string;
}

export const parseVideoUrl = (url: string): VideoInfo | null => {
    const trimmedUrl = url.trim();

    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of youtubePatterns) {
        const match = trimmedUrl.match(pattern);
        if (match) {
            return {
                platform: 'youtube',
                id: match[1],
                url: `https://www.youtube.com/watch?v=${match[1]}`,
            };
        }
    }

    // Rutube patterns
    const rutubePatterns = [
        /rutube\.ru\/video\/([a-zA-Z0-9]+)/,
        /rutube\.ru\/play\/embed\/([a-zA-Z0-9]+)/,
    ];

    for (const pattern of rutubePatterns) {
        const match = trimmedUrl.match(pattern);
        if (match) {
            return {
                platform: 'rutube',
                id: match[1],
                url: `https://rutube.ru/video/${match[1]}`,
            };
        }
    }

    // Vimeo patterns
    const vimeoPatterns = [
        /vimeo\.com\/(\d+)/,
        /player\.vimeo\.com\/video\/(\d+)/,
    ];

    for (const pattern of vimeoPatterns) {
        const match = trimmedUrl.match(pattern);
        if (match) {
            return {
                platform: 'vimeo',
                id: match[1],
                url: `https://vimeo.com/${match[1]}`,
            };
        }
    }

    // Check if it's a direct video URL (mp4, webm, etc.)
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmedUrl)) {
        return {
            platform: 'direct',
            id: trimmedUrl,
            url: trimmedUrl,
        };
    }

    return null;
};

export const getEmbedUrl = (videoInfo: VideoInfo): string => {
    switch (videoInfo.platform) {
        case 'youtube':
            return `https://www.youtube.com/embed/${videoInfo.id}`;
        case 'rutube':
            return `https://rutube.ru/play/embed/${videoInfo.id}`;
        case 'vimeo':
            return `https://player.vimeo.com/video/${videoInfo.id}`;
        case 'direct':
            return videoInfo.url;
        default:
            return '';
    }
};

export const getPlatformName = (platform: string): string => {
    switch (platform) {
        case 'youtube':
            return 'YouTube';
        case 'rutube':
            return 'RuTube';
        case 'vimeo':
            return 'Vimeo';
        case 'direct':
            return 'Прямая ссылка';
        default:
            return 'Неизвестно';
    }
};
