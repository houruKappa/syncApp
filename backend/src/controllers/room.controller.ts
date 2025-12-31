import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

class RoomController {
    async createRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { name, isPublic, password, videoUrl } = req.body;

            let passwordHash = null;
            if (password) {
                passwordHash = await bcrypt.hash(password, 10);
            }

            // Set expiration to 24 hours from now
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const result = await pool.query(
                `INSERT INTO rooms (name, creator_id, is_public, password_hash, current_video_url, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, creator_id, is_public, current_video_url, created_at, expires_at`,
                [name, req.userId, isPublic, passwordHash, videoUrl || null, expiresAt]
            );

            const room = result.rows[0];

            // Add creator as moderator
            await pool.query(
                'INSERT INTO room_users (room_id, user_id, is_moderator) VALUES ($1, $2, true)',
                [room.id, req.userId]
            );

            // Add initial video to queue if provided
            if (videoUrl) {
                await pool.query(
                    'INSERT INTO video_queue (room_id, video_url, video_title, queue_position, is_played) VALUES ($1, $2, $3, 0, false)',
                    [room.id, videoUrl, 'Начальное видео']
                );
            }

            logger.info(`Room created: ${room.id} by user ${req.userId}`);

            res.status(201).json({
                status: 'success',
                data: { room },
            });
        } catch (error) {
            next(error);
        }
    }

    async getPublicRooms(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await pool.query(
                `SELECT r.id, r.name, r.creator_id, r.is_public, r.created_at,
                u.username as creator_name,
                COUNT(ru.user_id) as user_count,
                CASE WHEN r.password_hash IS NOT NULL THEN true ELSE false END as has_password
         FROM rooms r
         INNER JOIN users u ON r.creator_id = u.id
         LEFT JOIN room_users ru ON r.id = ru.room_id
         WHERE r.expires_at > CURRENT_TIMESTAMP AND r.deleted = false
         GROUP BY r.id, u.username, r.password_hash
         ORDER BY r.created_at DESC
         LIMIT 50`
            );

            res.json({
                status: 'success',
                data: { rooms: result.rows },
            });
        } catch (error) {
            next(error);
        }
    }

    async getRoomById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const roomResult = await pool.query(
                `SELECT r.id, r.name, r.creator_id, r.is_public, r.current_video_url,
                r.current_video_time, r.player_state, r.created_at, r.deleted,
                r.password_hash IS NOT NULL AND r.password_hash != '' as has_password,
                u.username as creator_name
         FROM rooms r
         INNER JOIN users u ON r.creator_id = u.id
         WHERE r.id = $1`,
                [id]
            );

            if (roomResult.rows.length === 0 || roomResult.rows[0].deleted) {
                throw new AppError('Room not found or has been deleted', 404);
            }

            const room = roomResult.rows[0];

            // Get users in the room
            const usersResult = await pool.query(
                `SELECT u.id, u.username, u.avatar_url, ru.is_moderator, ru.joined_at
         FROM room_users ru
         INNER JOIN users u ON ru.user_id = u.id
         WHERE ru.room_id = $1`,
                [id]
            );

            res.json({
                status: 'success',
                data: {
                    room,
                    users: usersResult.rows,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async joinRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { password } = req.body;

            // Check if user is banned
            const banCheck = await pool.query(
                'SELECT id FROM banned_users WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            if (banCheck.rows.length > 0) {
                throw new AppError('Вы исключены из этой комнаты', 403);
            }

            // Check if room exists
            const roomResult = await pool.query(
                'SELECT id, password_hash FROM rooms WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP',
                [id]
            );

            if (roomResult.rows.length === 0) {
                throw new AppError('Room not found or expired', 404);
            }

            const room = roomResult.rows[0];

            // Check password if room is private
            if (room.password_hash) {
                if (!password) {
                    throw new AppError('Password required', 400);
                }

                const isPasswordValid = await bcrypt.compare(password, room.password_hash);
                if (!isPasswordValid) {
                    throw new AppError('Invalid password', 401);
                }
            }

            // Check if user is already in the room
            const existingUser = await pool.query(
                'SELECT room_id FROM room_users WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            if (existingUser.rows.length === 0) {
                // Add user to room
                await pool.query(
                    'INSERT INTO room_users (room_id, user_id) VALUES ($1, $2)',
                    [id, req.userId]
                );
            }

            logger.info(`User ${req.userId} joined room ${id}`);

            res.json({
                status: 'success',
                message: 'Joined room successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            // Check if room exists and get its status
            const roomResult = await pool.query(
                'SELECT deleted FROM rooms WHERE id = $1',
                [id]
            );

            if (roomResult.rows.length === 0) {
                throw new AppError('Room not found', 404);
            }

            // If room is already deleted, return success
            if (roomResult.rows[0].deleted) {
                res.json({
                    status: 'success',
                    message: 'Room already deleted',
                });
                return;
            }

            // Check if user is/was moderator of this room
            // First check room_users (if still in room)
            let modResult = await pool.query(
                'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            // If not in room_users, check room_history (for users who left)
            if (modResult.rows.length === 0) {
                modResult = await pool.query(
                    'SELECT is_moderator FROM room_history WHERE room_id = $1 AND user_id = $2 AND is_moderator = true ORDER BY joined_at DESC LIMIT 1',
                    [id, req.userId]
                );
            }

            if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                throw new AppError('Only moderators can delete the room', 403);
            }

            // Mark room as deleted (will be permanently deleted by cleanup task)
            await pool.query(
                'UPDATE rooms SET deleted = true, empty_since = CURRENT_TIMESTAMP WHERE id = $1',
                [id]
            );

            logger.info(`Room marked as deleted by moderator: ${id}`);

            res.json({
                status: 'success',
                message: 'Room deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    async transferModerator(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { userId } = req.body;

            // Check if current user is moderator
            const modResult = await pool.query(
                'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                throw new AppError('Only moderators can transfer rights', 403);
            }

            // Transfer moderator rights
            await pool.query(
                'UPDATE room_users SET is_moderator = false WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            await pool.query(
                'UPDATE room_users SET is_moderator = true WHERE room_id = $1 AND user_id = $2',
                [id, userId]
            );

            logger.info(`Moderator transferred in room ${id} from ${req.userId} to ${userId}`);

            res.json({
                status: 'success',
                message: 'Moderator rights transferred',
            });
        } catch (error) {
            next(error);
        }
    }

    async kickUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id, userId } = req.params;

            // Check if current user is moderator
            const modResult = await pool.query(
                'SELECT is_moderator FROM room_users WHERE room_id = $1 AND user_id = $2',
                [id, req.userId]
            );

            if (modResult.rows.length === 0 || !modResult.rows[0].is_moderator) {
                throw new AppError('Only moderators can kick users', 403);
            }

            await pool.query('DELETE FROM room_users WHERE room_id = $1 AND user_id = $2', [id, userId]);

            logger.info(`User ${userId} kicked from room ${id}`);

            res.json({
                status: 'success',
                message: 'User removed from room',
            });
        } catch (error) {
            next(error);
        }
    }
}

export const roomController = new RoomController();
