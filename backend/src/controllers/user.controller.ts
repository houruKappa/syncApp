import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

class UserController {
    async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await pool.query(
                'SELECT id, email, username, avatar_url, created_at, last_seen FROM users WHERE id = $1',
                [req.userId]
            );

            if (result.rows.length === 0) {
                throw new AppError('User not found', 404);
            }

            res.json({
                status: 'success',
                data: { user: result.rows[0] },
            });
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { username } = req.body;

            if (!username || username.trim().length < 3) {
                throw new AppError('Username must be at least 3 characters', 400);
            }

            const result = await pool.query(
                'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, email, username, avatar_url',
                [username, req.userId]
            );

            logger.info(`User profile updated: ${req.userId}`);

            res.json({
                status: 'success',
                data: { user: result.rows[0] },
            });
        } catch (error) {
            next(error);
        }
    }

    async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            if (!req.file) {
                throw new AppError('No file uploaded', 400);
            }

            const avatarUrl = `/uploads/avatars/${req.file.filename}`;

            const result = await pool.query(
                'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, email, username, avatar_url',
                [avatarUrl, req.userId]
            );

            logger.info(`Avatar uploaded: ${req.userId}`);

            res.json({
                status: 'success',
                data: { user: result.rows[0] },
            });
        } catch (error) {
            next(error);
        }
    }

    async getRoomHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await pool.query(
                `SELECT DISTINCT ON (rh.room_id)
                    rh.room_id as id,
                    rh.room_name as name,
                    rh.is_public,
                    rh.joined_at,
                    rh.is_moderator,
                    COALESCE(r.deleted, true) as deleted
                 FROM room_history rh
                 LEFT JOIN rooms r ON rh.room_id = r.id
                 WHERE rh.user_id = $1
                 ORDER BY rh.room_id, rh.joined_at DESC
                 LIMIT 20`,
                [req.userId]
            );

            res.json({
                status: 'success',
                data: { rooms: result.rows },
            });
        } catch (error) {
            next(error);
        }
    }

    async clearRoomHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            await pool.query(
                'DELETE FROM room_history WHERE user_id = $1',
                [req.userId]
            );

            res.json({
                status: 'success',
                message: 'История комнат очищена',
            });
        } catch (error) {
            next(error);
        }
    }
}

export const userController = new UserController();
