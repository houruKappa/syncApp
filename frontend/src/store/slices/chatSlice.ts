import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
    id: string;
    username: string;
    avatar_url?: string;
}

interface Message {
    id?: string;
    user: User;
    text: string;
    timestamp: string;
    type?: 'user' | 'system';
}

interface ChatState {
    messages: Message[];
    isOpen: boolean;
}

const initialState: ChatState = {
    messages: [],
    isOpen: true,
};

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        addMessage: (state, action: PayloadAction<Message>) => {
            state.messages.push(action.payload);
        },
        addSystemMessage: (state, action: PayloadAction<{ text: string; timestamp: string }>) => {
            state.messages.push({
                user: { id: 'system', username: 'System' },
                text: action.payload.text,
                timestamp: action.payload.timestamp,
                type: 'system',
            });
        },
        clearMessages: (state) => {
            state.messages = [];
        },
        toggleChat: (state) => {
            state.isOpen = !state.isOpen;
        },
        setChatOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen = action.payload;
        },
    },
});

export const { addMessage, addSystemMessage, clearMessages, toggleChat, setChatOpen } =
    chatSlice.actions;

export default chatSlice.reducer;
