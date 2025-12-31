import api from './api';

export const authService = {
    register: async (data: { email: string; username: string; password: string }) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    login: async (data: { email: string; password: string }) => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    },

    refreshToken: async (refreshToken: string) => {
        const response = await api.post('/auth/refresh', { refreshToken });
        return response.data;
    },
};

export const userService = {
    getProfile: async () => {
        const response = await api.get('/user/profile');
        return response.data;
    },

    updateProfile: async (data: { username: string }) => {
        const response = await api.put('/user/profile', data);
        return response.data;
    },

    uploadAvatar: async (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);
        const response = await api.post('/user/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    getRoomHistory: async () => {
        const response = await api.get('/user/history');
        return response.data;
    },

    clearRoomHistory: async () => {
        const response = await api.delete('/user/history');
        return response.data;
    },
};

export const roomService = {
    createRoom: async (data: {
        name: string;
        isPublic: boolean;
        password?: string;
        videoUrl?: string;
    }) => {
        const response = await api.post('/rooms', data);
        return response.data;
    },

    getPublicRooms: async () => {
        const response = await api.get('/rooms');
        return response.data;
    },

    getRoomById: async (id: string) => {
        const response = await api.get(`/rooms/${id}`);
        return response.data;
    },

    joinRoom: async (id: string, password?: string) => {
        const response = await api.post(`/rooms/${id}/join`, { password });
        return response.data;
    },

    deleteRoom: async (id: string) => {
        const response = await api.delete(`/rooms/${id}`);
        return response.data;
    },

    transferModerator: async (roomId: string, userId: string) => {
        const response = await api.post(`/rooms/${roomId}/transfer-moderator`, { userId });
        return response.data;
    },

    kickUser: async (roomId: string, userId: string) => {
        const response = await api.delete(`/rooms/${roomId}/users/${userId}`);
        return response.data;
    },
};

export const videoService = {
    uploadVideo: async (file: File, onProgress?: (progress: number) => void, roomId?: string) => {
        const formData = new FormData();
        formData.append('video', file);
        if (roomId) {
            formData.append('roomId', roomId);
        }
        const response = await api.post('/videos/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
        return response.data;
    },

    getVideo: async (id: string) => {
        const response = await api.get(`/videos/${id}`);
        return response.data;
    },

    deleteVideo: async (id: string) => {
        const response = await api.delete(`/videos/${id}`);
        return response.data;
    },
};
