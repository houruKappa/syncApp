import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
    id: string;
    username: string;
    avatar_url?: string;
    is_moderator?: boolean;
}

interface Room {
    id: string;
    name: string;
    creator_id: string;
    is_public: boolean;
    current_video_url?: string;
    current_video_time?: number;
    player_state?: 'playing' | 'paused';
}

interface VideoQueueItem {
    id: string;
    video_url: string;
    video_title: string;
    queue_position: number;
}

interface RoomState {
    currentRoom: Room | null;
    users: User[];
    videoQueue: VideoQueueItem[];
    playerState: 'playing' | 'paused';
    currentTime: number;
    currentVideoUrl: string | null;
    isConnected: boolean;
}

const initialState: RoomState = {
    currentRoom: null,
    users: [],
    videoQueue: [],
    playerState: 'paused',
    currentTime: 0,
    currentVideoUrl: null,
    isConnected: false,
};

const roomSlice = createSlice({
    name: 'room',
    initialState,
    reducers: {
        setRoom: (state, action: PayloadAction<Room>) => {
            state.currentRoom = action.payload;
        },
        setUsers: (state, action: PayloadAction<User[]>) => {
            state.users = action.payload;
        },
        addUser: (state, action: PayloadAction<User>) => {
            state.users.push(action.payload);
        },
        removeUser: (state, action: PayloadAction<string>) => {
            state.users = state.users.filter((user) => user.id !== action.payload);
        },
        setVideoQueue: (state, action: PayloadAction<VideoQueueItem[]>) => {
            state.videoQueue = action.payload;
        },
        setPlayerState: (state, action: PayloadAction<'playing' | 'paused'>) => {
            state.playerState = action.payload;
        },
        setCurrentTime: (state, action: PayloadAction<number>) => {
            state.currentTime = action.payload;
        },
        setCurrentVideoUrl: (state, action: PayloadAction<string>) => {
            state.currentVideoUrl = action.payload;
        },
        setConnected: (state, action: PayloadAction<boolean>) => {
            state.isConnected = action.payload;
        },
        resetRoom: (state) => {
            state.currentRoom = null;
            state.users = [];
            state.videoQueue = [];
            state.playerState = 'paused';
            state.currentTime = 0;
            state.currentVideoUrl = null;
            state.isConnected = false;
        },
    },
});

export const {
    setRoom,
    setUsers,
    addUser,
    removeUser,
    setVideoQueue,
    setPlayerState,
    setCurrentTime,
    setCurrentVideoUrl,
    setConnected,
    resetRoom,
} = roomSlice.actions;

export default roomSlice.reducer;
