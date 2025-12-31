import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

interface AuthSocket extends Socket {
    userId?: string;
}

interface PlayerAction {
    action: 'play' | 'pause' | 'seek';
    time: number;
    timestamp: number;
}

interface ChatMessage {
    text: string;
}

interface VideoQueueItem {
    videoUrl: string;
    videoTitle?: string;
}

export const initializeSocketHandlers = (io: Server): void => {
    // Authentication middleware for Socket.io
    io.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            socket.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: AuthSocket) => {
        logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

        // Join room
        socket.on('join-room', async (data: { roomId: string }) => {
            try {
                const { roomId } = data;

                // Check if user is banned from this room
                const banCheck = await pool.query(
                    'SELECT id FROM banned_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (banCheck.rows.length > 0) {
                    socket.emit('error', { message: 'Вы исключены из этой комнаты', code: 'BANNED' });
                    return;
                }

                // Verify room exists and user has access
                const roomResult = await pool.query(
                    'SELECT id, name, current_video_url, current_video_time, player_state, deleted, creator_id FROM rooms WHERE id = $1',
                    [roomId]
                );

                if (roomResult.rows.length === 0 || roomResult.rows[0].deleted) {
                    socket.emit('error', { message: 'Room not found or has been deleted', code: 'ROOM_NOT_FOUND' });
                    return;
                }

                const room = roomResult.rows[0];
                const isCreator = room.creator_id === socket.userId;

                // Get user info
                const userResult = await pool.query(
                    'SELECT id, username, avatar_url FROM users WHERE id = $1',
                    [socket.userId]
                );

                if (userResult.rows.length === 0) {
                    socket.emit('error', { message: 'User not found' });
                    return;
                }

                const user = userResult.rows[0];

                // Check if user is already in room_users
                const existingUser = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                let isNewUser = false;
                if (existingUser.rows.length === 0) {
                    // Add user to room_users with moderator status if they are the creator
                    await pool.query(
                        'INSERT INTO room_users (room_id, user_id, is_moderator) VALUES ($1, $2, $3)',
                        [roomId, socket.userId, isCreator]
                    );
                    isNewUser = true;
                } else if (isCreator && !existingUser.rows[0].is_moderator) {
                    // If creator rejoins, restore moderator status
                    await pool.query(
                        'UPDATE room_users SET is_moderator = true WHERE room_id = $1 AND user_id = $2',
                        [roomId, socket.userId]
                    );
                }

                // Add to room history (or update if exists)
                await pool.query(
                    `INSERT INTO room_history (room_id, room_name, user_id, is_moderator, is_public, joined_at)
                     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                     ON CONFLICT DO NOTHING`,
                    [roomId, room.name, socket.userId, isCreator, true]
                );

                // Join socket room
                socket.join(roomId);

                // Store user-room mapping in Redis
                await redisClient.set(`socket:${socket.id}:room`, roomId, { EX: 86400 });
                await redisClient.sAdd(`room:${roomId}:users`, socket.userId!);

                // Get all users in the room with moderator status
                const roomUsersResult = await pool.query(
                    `SELECT u.id, u.username, u.avatar_url, ru.is_moderator
                     FROM room_users ru
                     JOIN users u ON u.id = ru.user_id
                     WHERE ru.room_id = $1`,
                    [roomId]
                );

                // Notify others only if this is a new user joining
                if (isNewUser) {
                    socket.to(roomId).emit('user-joined', {
                        user: {
                            id: user.id,
                            username: user.username,
                            avatar_url: user.avatar_url,
                        },
                    });
                }

                // Send current room state to the user, including moderator status and all users
                socket.emit('room-state', {
                    currentVideoUrl: room.current_video_url,
                    currentTime: room.current_video_time,
                    playerState: room.player_state,
                    isModerator: isCreator,
                    users: roomUsersResult.rows,
                });

                // Get and send video queue
                const queueResult = await pool.query(
                    `SELECT id, video_url, video_title, queue_position
           FROM video_queue
           WHERE room_id = $1 AND is_played = false
           ORDER BY queue_position ASC`,
                    [roomId]
                );

                socket.emit('queue-updated', { videos: queueResult.rows });

                logger.info(`User ${socket.userId} joined room ${roomId}`);
            } catch (error) {
                logger.error('Error joining room:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // Leave room
        socket.on('leave-room', async (data: { roomId: string }) => {
            try {
                const { roomId } = data;

                socket.leave(roomId);
                await redisClient.sRem(`room:${roomId}:users`, socket.userId!);

                // Remove user from room_users (including moderators)
                await pool.query(
                    'DELETE FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                // Check if room is now empty (based on Redis active users)
                const remainingUsers = await redisClient.sMembers(`room:${roomId}:users`);

                if (remainingUsers.length === 0) {
                    // Set empty_since timer when all users leave
                    await pool.query(
                        'UPDATE rooms SET empty_since = CURRENT_TIMESTAMP WHERE id = $1 AND deleted = false',
                        [roomId]
                    );
                    logger.info(`Room ${roomId} is now empty, cleanup timer started`);
                } else {
                    // Clear empty_since if users remain
                    await pool.query(
                        'UPDATE rooms SET empty_since = NULL WHERE id = $1',
                        [roomId]
                    );
                }

                // Notify others
                socket.to(roomId).emit('user-left', { userId: socket.userId });

                logger.info(`User ${socket.userId} left room ${roomId}`);
            } catch (error) {
                logger.error('Error leaving room:', error);
            }
        });

        // Player actions (play, pause, seek)
        socket.on('player-action', async (data: PlayerAction) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    socket.emit('error', { message: 'Not in a room' });
                    return;
                }

                // Check if user is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    socket.emit('error', { message: 'Only moderators can control the player' });
                    return;
                }

                // Update room state in database
                await pool.query(
                    'UPDATE rooms SET player_state = $1, current_video_time = $2 WHERE id = $3',
                    [data.action === 'play' ? 'playing' : 'paused', data.time, roomId]
                );

                // Broadcast to all users in the room
                io.to(roomId).emit('player-sync', {
                    action: data.action,
                    time: data.time,
                    timestamp: Date.now(),
                });

                logger.info(`Player action in room ${roomId}: ${data.action} at ${data.time}`);
            } catch (error) {
                logger.error('Error handling player action:', error);
                socket.emit('error', { message: 'Failed to sync player' });
            }
        });

        // Chat message
        socket.on('chat-message', async (data: ChatMessage) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    socket.emit('error', { message: 'Not in a room' });
                    return;
                }

                // Get user info
                const userResult = await pool.query(
                    'SELECT id, username, avatar_url FROM users WHERE id = $1',
                    [socket.userId]
                );

                if (userResult.rows.length === 0) {
                    return;
                }

                const user = userResult.rows[0];

                // Save message to database
                await pool.query(
                    'INSERT INTO messages (room_id, user_id, text) VALUES ($1, $2, $3)',
                    [roomId, socket.userId, data.text]
                );

                // Broadcast message
                io.to(roomId).emit('new-message', {
                    user: {
                        id: user.id,
                        username: user.username,
                        avatar_url: user.avatar_url,
                    },
                    text: data.text,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                logger.error('Error sending chat message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Add video to queue
        socket.on('add-to-queue', async (data: VideoQueueItem) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    socket.emit('error', { message: 'Not in a room' });
                    return;
                }

                // Get next queue position
                const posResult = await pool.query(
                    'SELECT COALESCE(MAX(queue_position), 0) + 1 as next_pos FROM video_queue WHERE room_id = $1',
                    [roomId]
                );

                const nextPosition = posResult.rows[0].next_pos;

                // Add to queue
                const result = await pool.query(
                    `INSERT INTO video_queue (room_id, video_url, video_title, added_by, queue_position)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, video_url, video_title, queue_position`,
                    [roomId, data.videoUrl, data.videoTitle || 'Untitled', socket.userId, nextPosition]
                );

                // Get updated queue
                const queueResult = await pool.query(
                    `SELECT id, video_url, video_title, queue_position
           FROM video_queue
           WHERE room_id = $1 AND is_played = false
           ORDER BY queue_position ASC`,
                    [roomId]
                );

                // Broadcast updated queue
                io.to(roomId).emit('queue-updated', { videos: queueResult.rows });

                // Send system message
                const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [
                    socket.userId,
                ]);

                if (userResult.rows.length > 0) {
                    io.to(roomId).emit('system-message', {
                        text: `${userResult.rows[0].username} добавил "${data.videoTitle || 'видео'}" в очередь`,
                        timestamp: new Date().toISOString(),
                    });
                }

                // Auto-play if this is the first video
                if (nextPosition === 1) {
                    await pool.query(
                        'UPDATE rooms SET current_video_url = $1, current_video_time = 0, player_state = $2 WHERE id = $3',
                        [data.videoUrl, 'playing', roomId]
                    );

                    io.to(roomId).emit('video-changed', {
                        videoUrl: data.videoUrl,
                        state: 'playing',
                        time: 0
                    });
                }

                logger.info(`Video added to queue in room ${roomId}`);
            } catch (error) {
                logger.error('Error adding to queue:', error);
                socket.emit('error', { message: 'Failed to add to queue' });
            }
        });

        // Skip current video and play next
        socket.on('skip-video', async () => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    return;
                }

                // Check if user is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    return;
                }

                // Get current video and mark as played
                const currentResult = await pool.query(
                    'SELECT id FROM video_queue WHERE room_id = $1 AND is_played = false ORDER BY queue_position ASC LIMIT 1',
                    [roomId]
                );

                if (currentResult.rows.length > 0) {
                    await pool.query('UPDATE video_queue SET is_played = true WHERE id = $1', [currentResult.rows[0].id]);
                }

                // Get next video
                const nextResult = await pool.query(
                    'SELECT id, video_url, video_title FROM video_queue WHERE room_id = $1 AND is_played = false ORDER BY queue_position ASC LIMIT 1',
                    [roomId]
                );

                if (nextResult.rows.length > 0) {
                    const nextVideo = nextResult.rows[0];
                    await pool.query(
                        'UPDATE rooms SET current_video_url = $1, current_video_time = 0, player_state = $2 WHERE id = $3',
                        [nextVideo.video_url, 'playing', roomId]
                    );

                    io.to(roomId).emit('video-changed', {
                        videoUrl: nextVideo.video_url,
                        state: 'playing',
                        time: 0
                    });

                    io.to(roomId).emit('system-message', {
                        text: `Пропущено. Воспроизведение: "${nextVideo.video_title}"`,
                        timestamp: new Date().toISOString(),
                    });
                } else {
                    await pool.query(
                        'UPDATE rooms SET current_video_url = NULL, player_state = $1 WHERE id = $2',
                        ['paused', roomId]
                    );
                    io.to(roomId).emit('video-changed', { videoUrl: null });
                    io.to(roomId).emit('system-message', {
                        text: 'Очередь пуста',
                        timestamp: new Date().toISOString(),
                    });
                }

                // Update queue
                const queueResult = await pool.query(
                    'SELECT id, video_url, video_title, queue_position FROM video_queue WHERE room_id = $1 AND is_played = false ORDER BY queue_position ASC',
                    [roomId]
                );
                io.to(roomId).emit('queue-updated', { videos: queueResult.rows });

            } catch (error) {
                logger.error('Error skipping video:', error);
            }
        });

        // Remove video from queue
        socket.on('remove-from-queue', async (data: { videoId: string }) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    return;
                }

                // Check if user is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    return;
                }

                // Check if removing current video (first in queue)
                const currentVideoCheck = await pool.query(
                    'SELECT queue_position FROM video_queue WHERE id = $1 AND room_id = $2',
                    [data.videoId, roomId]
                );

                const wasCurrentVideo = currentVideoCheck.rows.length > 0 && currentVideoCheck.rows[0].queue_position === 0;

                // Delete the video
                await pool.query('DELETE FROM video_queue WHERE id = $1 AND room_id = $2', [data.videoId, roomId]);

                // Update queue positions
                await pool.query(
                    'UPDATE video_queue SET queue_position = queue_position - 1 WHERE room_id = $1 AND queue_position > $2',
                    [roomId, currentVideoCheck.rows[0]?.queue_position || 0]
                );

                // Get updated queue
                const queueResult = await pool.query(
                    'SELECT id, video_url, video_title, queue_position FROM video_queue WHERE room_id = $1 AND is_played = false ORDER BY queue_position ASC',
                    [roomId]
                );
                io.to(roomId).emit('queue-updated', { videos: queueResult.rows });

                // If current video was removed
                if (wasCurrentVideo) {
                    if (queueResult.rows.length > 0) {
                        // Play next video
                        const nextVideo = queueResult.rows[0];
                        await pool.query(
                            'UPDATE rooms SET current_video_url = $1, current_video_time = 0, player_state = $2 WHERE id = $3',
                            [nextVideo.video_url, 'playing', roomId]
                        );

                        io.to(roomId).emit('video-changed', {
                            videoUrl: nextVideo.video_url,
                            state: 'playing',
                            currentTime: 0
                        });
                    } else {
                        // No more videos, stop playback
                        await pool.query(
                            'UPDATE rooms SET current_video_url = NULL, player_state = $1 WHERE id = $2',
                            ['paused', roomId]
                        );

                        io.to(roomId).emit('video-changed', {
                            videoUrl: null,
                            state: 'paused'
                        });
                    }
                }

            } catch (error) {
                logger.error('Error removing from queue:', error);
            }
        });

        // Reorder queue
        socket.on('reorder-queue', async (data: { videos: Array<{ id: string; queue_position: number }> }) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    return;
                }

                // Check if user is moderator (only moderators can reorder)
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    socket.emit('error', { message: 'Только модератор может менять порядок' });
                    return;
                }

                // Update queue positions
                for (const video of data.videos) {
                    await pool.query(
                        'UPDATE video_queue SET queue_position = $1 WHERE id = $2 AND room_id = $3',
                        [video.queue_position, video.id, roomId]
                    );
                }

                // Get updated queue
                const queueResult = await pool.query(
                    'SELECT id, video_url, video_title, queue_position FROM video_queue WHERE room_id = $1 AND is_played = false ORDER BY queue_position ASC',
                    [roomId]
                );

                io.to(roomId).emit('queue-updated', { videos: queueResult.rows });
                logger.info(`Queue reordered in room ${roomId}`);

            } catch (error) {
                logger.error('Error reordering queue:', error);
            }
        });

        // Change video (play next in queue)
        socket.on('play-next', async () => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (!roomId) {
                    return;
                }

                // Check if user is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    return;
                }

                // Get current video (first in queue)
                const currentVideoResult = await pool.query(
                    `SELECT id FROM video_queue
           WHERE room_id = $1 AND is_played = false
           ORDER BY queue_position ASC
           LIMIT 1`,
                    [roomId]
                );

                // Delete current video if exists
                if (currentVideoResult.rows.length > 0) {
                    await pool.query('DELETE FROM video_queue WHERE id = $1', [currentVideoResult.rows[0].id]);
                }

                // Get next video in queue
                const queueResult = await pool.query(
                    `SELECT id, video_url, video_title FROM video_queue
           WHERE room_id = $1 AND is_played = false
           ORDER BY queue_position ASC`,
                    [roomId]
                );

                // Emit updated queue
                io.to(roomId).emit('queue-updated', { videos: queueResult.rows });

                if (queueResult.rows.length === 0) {
                    // No more videos
                    await pool.query(
                        'UPDATE rooms SET current_video_url = NULL, current_video_time = 0, player_state = $1 WHERE id = $2',
                        ['paused', roomId]
                    );

                    io.to(roomId).emit('video-changed', {
                        videoUrl: null,
                        state: 'paused',
                    });
                    return;
                }

                const nextVideo = queueResult.rows[0];

                // Update room's current video
                await pool.query(
                    'UPDATE rooms SET current_video_url = $1, current_video_time = 0, player_state = $2 WHERE id = $3',
                    [nextVideo.video_url, 'playing', roomId]
                );

                // Broadcast new video
                io.to(roomId).emit('video-changed', {
                    videoUrl: nextVideo.video_url,
                    state: 'playing',
                    currentTime: 0
                });

                logger.info(`Playing next video in room ${roomId}`);
            } catch (error) {
                logger.error('Error playing next video:', error);
            }
        });

        // Leave room
        socket.on('leave-room', async () => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (roomId) {
                    // Remove user from room_users (including moderators)
                    await pool.query('DELETE FROM room_users WHERE room_id = $1 AND user_id = $2', [roomId, socket.userId]);
                    await redisClient.sRem(`room:${roomId}:users`, socket.userId!);

                    // Notify others
                    socket.to(roomId).emit('user-left', { userId: socket.userId });

                    socket.leave(roomId);
                }

                await redisClient.del(`socket:${socket.id}:room`);

            } catch (error) {
                logger.error('Error leaving room:', error);
            }
        });

        // Kick user (moderator only)
        socket.on('kick-user', async (data: { roomId: string; userId: string }) => {
            try {
                const { roomId, userId } = data;

                // Check if sender is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    socket.emit('error', { message: 'Только модератор может исключать пользователей' });
                    return;
                }

                // Add user to banned list
                await pool.query(
                    'INSERT INTO banned_users (room_id, user_id, banned_by) VALUES ($1, $2, $3) ON CONFLICT (room_id, user_id) DO NOTHING',
                    [roomId, userId, socket.userId]
                );

                // Remove user from room_users
                await pool.query(
                    'DELETE FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, userId]
                );

                // Remove from Redis
                await redisClient.sRem(`room:${roomId}:users`, userId);

                // Find user's socket and kick them
                const roomSockets = await io.in(roomId).fetchSockets();
                for (const sock of roomSockets) {
                    const sockUserId = (sock as any).userId;
                    if (sockUserId === userId) {
                        sock.emit('kicked', { message: 'Вы исключены из комнаты модератором' });
                        sock.leave(roomId);
                        await redisClient.del(`socket:${sock.id}:room`);
                    }
                }

                // Notify room about user removal
                io.to(roomId).emit('user-left', { userId });

                logger.info(`User ${userId} kicked from room ${roomId} by ${socket.userId}`);
            } catch (error) {
                logger.error('Error kicking user:', error);
                socket.emit('error', { message: 'Не удалось исключить пользователя' });
            }
        });

        // Delete room (moderator only)
        socket.on('delete-room', async (data: { roomId: string }) => {
            try {
                const { roomId } = data;

                // Check if sender is moderator
                const modResult = await pool.query(
                    'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                    [roomId, socket.userId]
                );

                if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                    socket.emit('error', { message: 'Только модератор может удалить комнату' });
                    return;
                }

                // Mark room as deleted
                await pool.query(
                    'UPDATE rooms SET deleted = true, empty_since = CURRENT_TIMESTAMP WHERE id = $1',
                    [roomId]
                );

                // Clean up voice chat for all users in the room
                const voiceChatKey = `room:${roomId}:voice-users`;
                await redisClient.del(voiceChatKey);
                logger.info(`Cleared voice chat users for room ${roomId}`);

                // Notify all users in the room to leave voice chat and close room
                io.to(roomId).emit('room-closed', {
                    message: 'Комната расформирована модератором.'
                });

                logger.info(`Room ${roomId} marked as deleted by moderator ${socket.userId}`);
            } catch (error) {
                logger.error('Error deleting room:', error);
                socket.emit('error', { message: 'Не удалось удалить комнату' });
            }
        });

        // WebRTC Voice Chat - Signal handlers
        socket.on('voice:join', async () => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (!roomId) {
                    logger.warn(`No room found for socket ${socket.id}`);
                    return;
                }

                logger.info(`User ${socket.userId} joining voice chat in room ${roomId}`);

                // Get all sockets in the room
                const socketsInRoom = await io.in(roomId).fetchSockets();
                logger.info(`Found ${socketsInRoom.length} sockets in room ${roomId}`);

                // Get users already in voice chat from Redis
                const voiceChatKey = `room:${roomId}:voice-users`;
                const existingUsers = await redisClient.sMembers(voiceChatKey);
                logger.info(`Existing voice chat users: ${existingUsers.join(', ')}`);

                // Send existing voice chat users to the new joiner
                for (const existingUserId of existingUsers) {
                    // Find socket for this user (userId is directly on socket, not in data)
                    const existingSocket = socketsInRoom.find((s: any) => (s as any).userId === existingUserId) as any;
                    if (existingSocket) {
                        socket.emit('voice:user-joined', {
                            userId: existingSocket.userId,
                            socketId: existingSocket.id
                        });
                        logger.info(`Notified ${socket.userId} about existing user ${existingSocket.userId}`);
                    }
                }

                // Add this user to voice chat set
                if (socket.userId) {
                    await redisClient.sAdd(voiceChatKey, socket.userId);
                }

                // Notify others that this user joined voice chat
                socket.to(roomId).emit('voice:user-joined', {
                    userId: socket.userId,
                    socketId: socket.id
                });

                logger.info(`User ${socket.userId} joined voice chat in room ${roomId}, notified others`);
            } catch (error) {
                logger.error('Error joining voice chat:', error);
            }
        });

        socket.on('voice:offer', async (data: { targetSocketId: string; offer: any }) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (!roomId) return;

                // Forward offer to target peer
                io.to(data.targetSocketId).emit('voice:offer', {
                    fromSocketId: socket.id,
                    fromUserId: socket.userId,
                    offer: data.offer
                });

                logger.info(`Forwarded voice offer from ${socket.id} to ${data.targetSocketId}`);
            } catch (error) {
                logger.error('Error forwarding voice offer:', error);
            }
        });

        socket.on('voice:answer', async (data: { targetSocketId: string; answer: any }) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (!roomId) return;

                // Forward answer to target peer
                io.to(data.targetSocketId).emit('voice:answer', {
                    fromSocketId: socket.id,
                    fromUserId: socket.userId,
                    answer: data.answer
                });

                logger.info(`Forwarded voice answer from ${socket.id} to ${data.targetSocketId}`);
            } catch (error) {
                logger.error('Error forwarding voice answer:', error);
            }
        });

        socket.on('voice:ice-candidate', async (data: { targetSocketId: string; candidate: any }) => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (!roomId) return;

                // Forward ICE candidate to target peer
                io.to(data.targetSocketId).emit('voice:ice-candidate', {
                    fromSocketId: socket.id,
                    fromUserId: socket.userId,
                    candidate: data.candidate
                });

                logger.info(`Forwarded ICE candidate from ${socket.id} to ${data.targetSocketId}`);
            } catch (error) {
                logger.error('Error forwarding ICE candidate:', error);
            }
        });

        socket.on('voice:leave', async () => {
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (!roomId || !socket.userId) return;

                // Remove from voice chat set
                const voiceChatKey = `room:${roomId}:voice-users`;
                await redisClient.sRem(voiceChatKey, socket.userId);

                // Notify others that this user left voice chat
                socket.to(roomId).emit('voice:user-left', {
                    userId: socket.userId,
                    socketId: socket.id
                });

                logger.info(`User ${socket.userId} left voice chat in room ${roomId}`);
            } catch (error) {
                logger.error('Error leaving voice chat:', error);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            try {
                // Remove from voice chat if user was in one
                const roomId = await redisClient.get(`socket:${socket.id}:room`);
                if (roomId && socket.userId) {
                    const voiceChatKey = `room:${roomId}:voice-users`;
                    await redisClient.sRem(voiceChatKey, socket.userId);

                    // Notify others that this user left voice chat
                    socket.to(roomId).emit('voice:user-left', {
                        userId: socket.userId,
                        socketId: socket.id
                    });
                    logger.info(`User ${socket.userId} removed from voice chat on disconnect`);
                }
            } catch (error) {
                logger.error('Error cleaning up voice chat on disconnect:', error);
            }
            try {
                const roomId = await redisClient.get(`socket:${socket.id}:room`);

                if (roomId) {
                    // Remove from voice chat set
                    if (socket.userId) {
                        const voiceChatKey = `room:${roomId}:voice-users`;
                        await redisClient.sRem(voiceChatKey, socket.userId);

                        // Notify others that this user left voice chat
                        socket.to(roomId).emit('voice:user-left', {
                            userId: socket.userId,
                            socketId: socket.id
                        });
                    }

                    // Check if user is moderator
                    const modResult = await pool.query(
                        'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                        [roomId, socket.userId]
                    );

                    const isModerator = modResult.rows.length > 0 && modResult.rows[0].is_moderator;

                    await redisClient.sRem(`room:${roomId}:users`, socket.userId!);

                    if (isModerator) {
                        // Set moderator_left_at timestamp instead of deleting
                        await pool.query(
                            'UPDATE rooms SET moderator_left_at = CURRENT_TIMESTAMP WHERE id = $1',
                            [roomId]
                        );

                        io.to(roomId).emit('system-message', {
                            text: 'Модератор покинул комнату. Комната будет удалена через 30 минут.',
                            timestamp: new Date().toISOString()
                        });

                        logger.info(`Moderator left room ${roomId}, cleanup timer started`);
                    } else {
                        socket.to(roomId).emit('user-left', { userId: socket.userId });
                    }
                }

                await redisClient.del(`socket:${socket.id}:room`);

                logger.info(`Socket disconnected: ${socket.id}`);
            } catch (error) {
                logger.error('Error on disconnect:', error);
            }
        });
    });
};
