import express, { Application } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { setupDatabase, pool } from './config/database';
import { setupRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import roomRoutes from './routes/room.routes';
import videoRoutes from './routes/video.routes';

// Socket handlers
import { initializeSocketHandlers } from './socket';

dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Static files for uploaded videos with CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static('uploads', {
    setHeaders: (res, path) => {
        if (path.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (path.endsWith('.webm')) {
            res.setHeader('Content-Type', 'video/webm');
        } else if (path.endsWith('.ogg')) {
            res.setHeader('Content-Type', 'video/ogg');
        }
    }
}));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/videos', videoRoutes);

// Error handling
app.use(errorHandler);

// Initialize Socket.io handlers
initializeSocketHandlers(io);

// Start server
const startServer = async () => {
    try {
        // Setup database
        await setupDatabase();
        logger.info('Database connected successfully');

        // Setup Redis
        await setupRedis();
        logger.info('Redis connected successfully');

        // Room cleanup task - runs every minute
        setInterval(async () => {
            try {
                const fs = require('fs').promises;
                const path = require('path');

                // 1. Clean up rooms marked as deleted by moderator
                const deletedRooms = await pool.query(
                    `SELECT id, name FROM rooms WHERE deleted = true`
                );

                for (const room of deletedRooms.rows) {
                    logger.info(`Cleaning up deleted room: ${room.id}`);

                    // Delete video files
                    const videosResult = await pool.query(
                        'SELECT video_url FROM video_queue WHERE room_id = $1',
                        [room.id]
                    );

                    for (const video of videosResult.rows) {
                        if (video.video_url && video.video_url.includes('/uploads/videos/')) {
                            const filename = video.video_url.split('/').pop();
                            const filePath = path.join(process.cwd(), 'uploads', 'videos', filename);
                            try {
                                await fs.unlink(filePath);
                                logger.info(`Deleted video file: ${filename}`);
                            } catch (err) {
                                logger.error(`Failed to delete video: ${filename}`, err);
                            }
                        }
                    }

                    // Notify any remaining users
                    io.to(room.id).emit('room-closed', {
                        message: 'Комната удалена модератором.'
                    });

                    // Permanently delete room
                    await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]);

                    logger.info(`Deleted room ${room.id} permanently deleted`);
                }

                // 2. Clean up empty rooms after 5 minutes
                const emptyRooms = await pool.query(
                    `SELECT id, name FROM rooms
                     WHERE empty_since IS NOT NULL
                     AND empty_since < NOW() - INTERVAL '5 minutes'
                     AND deleted = false`
                );

                for (const room of emptyRooms.rows) {
                    logger.info(`Cleaning up empty room: ${room.id}`);

                    // Delete video files
                    const videosResult = await pool.query(
                        'SELECT video_url FROM video_queue WHERE room_id = $1',
                        [room.id]
                    );

                    for (const video of videosResult.rows) {
                        if (video.video_url && video.video_url.includes('/uploads/videos/')) {
                            const filename = video.video_url.split('/').pop();
                            const filePath = path.join(process.cwd(), 'uploads', 'videos', filename);
                            try {
                                await fs.unlink(filePath);
                                logger.info(`Deleted video file: ${filename}`);
                            } catch (err) {
                                logger.error(`Failed to delete video: ${filename}`, err);
                            }
                        }
                    }

                    // Permanently delete room
                    await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]);

                    logger.info(`Empty room ${room.id} permanently deleted`);
                }
            } catch (error) {
                logger.error('Error in room cleanup task:', error);
            }
        }, 60 * 1000); // Every minute

        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
            logger.info('Room cleanup task started (runs every minute)');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export { io };
