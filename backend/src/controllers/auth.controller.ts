import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

class AuthController {
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, username, password } = req.body;

            // Check if user exists
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

            if (existingUser.rows.length > 0) {
                throw new AppError('User with this email already exists', 400);
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const result = await pool.query(
                'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, avatar_url, created_at',
                [email, username, passwordHash]
            );

            const user = result.rows[0];

            // Generate tokens
            // @ts-expect-error - process.env types are compatible with jwt.sign
            const accessToken = jwt.sign(
                { userId: user.id },
                String(process.env.JWT_SECRET),
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            // @ts-expect-error - process.env types are compatible with jwt.sign
            const refreshToken = jwt.sign(
                { userId: user.id },
                String(process.env.JWT_REFRESH_SECRET),
                { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
            );

            logger.info(`User registered: ${user.email}`);

            res.status(201).json({
                status: 'success',
                data: {
                    user,
                    accessToken,
                    refreshToken,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password } = req.body;

            // Find user
            const result = await pool.query(
                'SELECT id, email, username, password_hash, avatar_url FROM users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                throw new AppError('Invalid email or password', 401);
            }

            const user = result.rows[0];

            // Check password
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                throw new AppError('Invalid email or password', 401);
            }

            // Update last_seen
            await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

            // Generate tokens
            // @ts-expect-error - process.env types are compatible with jwt.sign
            const accessToken = jwt.sign(
                { userId: user.id },
                String(process.env.JWT_SECRET),
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            // @ts-expect-error - process.env types are compatible with jwt.sign
            const refreshToken = jwt.sign(
                { userId: user.id },
                String(process.env.JWT_REFRESH_SECRET),
                { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
            );

            const { password_hash, ...userWithoutPassword } = user;

            logger.info(`User logged in: ${user.email}`);

            res.json({
                status: 'success',
                data: {
                    user: userWithoutPassword,
                    accessToken,
                    refreshToken,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                throw new AppError('Refresh token is required', 400);
            }

            const decoded = jwt.verify(
                refreshToken,
                String(process.env.JWT_REFRESH_SECRET)
            ) as { userId: string };

            // @ts-expect-error - process.env types are compatible with jwt.sign
            const accessToken = jwt.sign(
                { userId: decoded.userId },
                String(process.env.JWT_SECRET),
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            res.json({
                status: 'success',
                data: { accessToken },
            });
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                next(new AppError('Invalid refresh token', 401));
            } else {
                next(error);
            }
        }
    }

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // In a production app, you might want to blacklist the token
            res.json({
                status: 'success',
                message: 'Logged out successfully',
            });
        } catch (error) {
            next(error);
        }
    }
}

export const authController = new AuthController();
