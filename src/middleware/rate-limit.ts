import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize Redis client
const redis = new Redis(config.redisUrl);

redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
});

const WINDOW_SIZE_IN_HOURS = 1;
const MAX_WINDOW_REQUEST_COUNT = 1000;
const WINDOW_LOG_INTERVAL_IN_HOURS = 1;

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Identify tenant/user. Use IP if no user (e.g. public routes), or user ID if auth.
        // For simplicity, we'll use IP for now, or user ID if available.
        const key = (req as any).user ? `rate-limit:${(req as any).user.id}` : `rate-limit:${req.ip}`;

        const currentRequestCount = await redis.incr(key);

        if (currentRequestCount === 1) {
            await redis.expire(key, WINDOW_SIZE_IN_HOURS * 60 * 60);
        }

        if (currentRequestCount > MAX_WINDOW_REQUEST_COUNT) {
            return next({ code: 429, message: 'Too many requests' });
        }

        next();
    } catch (error) {
        logger.error({ error }, 'Rate limit error');
        // Fail open if Redis is down? Or fail closed?
        // Usually fail open for rate limiting to avoid blocking legit traffic if cache is down.
        next();
    }
};
