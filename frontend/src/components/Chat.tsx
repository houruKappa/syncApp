import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box,
    TextField,
    IconButton,
    List,
    ListItem,
    Typography,
    Avatar,
    Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { RootState } from '../store';
import { socketService } from '../services/socket';

const Chat: React.FC = () => {
    const dispatch = useDispatch();
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { messages } = useSelector((state: RootState) => state.chat);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = () => {
        if (!message.trim()) return;
        socketService.sendChatMessage(message);
        setMessage('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Чат
            </Typography>

            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
                <List>
                    {messages.map((msg, index) => (
                        <ListItem key={index} sx={{ alignItems: 'flex-start', px: 0 }}>
                            {msg.type === 'system' ? (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    {msg.text}
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'flex', width: '100%' }}>
                                    <Avatar
                                        src={
                                            msg.user.avatar_url
                                                ? `${process.env.REACT_APP_API_URL}${msg.user.avatar_url}`
                                                : undefined
                                        }
                                        sx={{ width: 32, height: 32, mr: 1 }}
                                    >
                                        {msg.user.username[0]}
                                    </Avatar>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle2">{msg.user.username}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                            {msg.text}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </ListItem>
                    ))}
                    <div ref={messagesEndRef} />
                </List>
            </Box>

            {/* Input */}
            <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Написать сообщение..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <IconButton color="primary" onClick={handleSendMessage} disabled={!message.trim()}>
                    <SendIcon />
                </IconButton>
            </Box>
        </Box>
    );
};

export default Chat;
