import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    password: process.env.REDIS_PASSWORD || undefined,
});

const redisPubClient = redisClient.duplicate();
const redisSubClient = redisClient.duplicate();

export const setupRedis = async (): Promise<void> => {
    try {
        await redisClient.connect();
        await redisPubClient.connect();
        await redisSubClient.connect();

        redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
        redisPubClient.on('error', (err) => logger.error('Redis Pub Error:', err));
        redisSubClient.on('error', (err) => logger.error('Redis Sub Error:', err));

        logger.info('Redis clients connected successfully');
    } catch (error) {
        logger.error('Redis setup error:', error);
        throw error;
    }
};

export { redisClient, redisPubClient, redisSubClient };
