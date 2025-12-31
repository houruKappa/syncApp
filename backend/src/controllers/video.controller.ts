import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import fs from 'fs/promises';

class VideoController {
    async uploadVideo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            if (!req.file) {
                throw new AppError('No video file uploaded', 400);
            }

            const { roomId } = req.body;

            // Set expiration to 24 hours from now
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const result = await pool.query(
                `INSERT INTO videos (original_name, stored_name, path, size, room_id, uploaded_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, original_name, stored_name as filename, path, size, uploaded_at, expires_at`,
                [
                    req.file.originalname,
                    req.file.filename,
                    `/uploads/videos/${req.file.filename}`,
                    req.file.size,
                    roomId || null,
                    req.userId,
                    expiresAt,
                ]
            );

            logger.info(`Video uploaded: ${result.rows[0].id} by user ${req.userId}`);

            res.status(201).json({
                status: 'success',
                data: { video: result.rows[0] },
            });
        } catch (error) {
            // Clean up uploaded file on error
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => { });
            }
            next(error);
        }
    }

    async getVideo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const result = await pool.query(
                `SELECT id, original_name, path, size, duration, uploaded_at, expires_at
         FROM videos
         WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP`,
                [id]
            );

            if (result.rows.length === 0) {
                throw new AppError('Video not found or expired', 404);
            }

            res.json({
                status: 'success',
                data: { video: result.rows[0] },
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteVideo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const result = await pool.query(
                'SELECT stored_name, uploaded_by FROM videos WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                throw new AppError('Video not found', 404);
            }

            const video = result.rows[0];

            // Check if user is the uploader
            if (video.uploaded_by !== req.userId) {
                throw new AppError('Only the uploader can delete the video', 403);
            }

            // Delete file from disk
            try {
                await fs.unlink(`uploads/videos/${video.stored_name}`);
            } catch (err) {
                logger.error(`Failed to delete video file: ${err}`);
            }

            // Delete from database
            await pool.query('DELETE FROM videos WHERE id = $1', [id]);

            logger.info(`Video deleted: ${id}`);

            res.json({
                status: 'success',
                message: 'Video deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }
}

export const videoController = new VideoController();
