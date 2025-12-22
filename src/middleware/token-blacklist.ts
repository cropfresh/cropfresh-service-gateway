/**
 * Story 2.8: Token Blacklist Middleware
 *
 * Checks if a JWT token is blacklisted (invalidated) before allowing access.
 * This is used for immediate token invalidation on:
 * - Logout (AC1)
 * - Remote session revocation (AC4)
 * - Logout from all devices (AC5)
 *
 * Uses Redis for O(1) lookup of blacklisted token hashes.
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config';

// Redis client for token blacklist
let redisClient: Redis | null = null;

/**
 * Get or create Redis client for blacklist checks
 */
function getRedisClient(): Redis {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL || 'redis://localhost:6379';
        redisClient = new Redis(redisUrl, {
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });

        redisClient.on('error', (err) => {
            logger.error({ err }, 'Token blacklist Redis connection error');
        });
    }
    return redisClient;
}

/**
 * Token blacklist key prefix - must match auth-service TokenBlacklistService
 */
const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

/**
 * Hash a token for consistent blacklist lookup
 */
function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        userType?: string;
        sessionId?: number;
        phone?: string;
        [key: string]: unknown;
    };
}

/**
 * Middleware to check if token is blacklisted
 *
 * This should be used AFTER initial JWT validation but BEFORE
 * granting access to protected resources.
 *
 * Flow:
 * 1. Extract token from Authorization header
 * 2. Hash the token
 * 3. Check Redis for existence of blacklist key
 * 4. If blacklisted, reject with 401
 * 5. If not blacklisted, continue to next middleware
 */
export const tokenBlacklistMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Skip if no authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Let auth middleware handle missing token
            return next();
        }

        const token = authHeader.slice(7); // Remove 'Bearer '
        if (!token) {
            return next();
        }

        // Hash the token for lookup
        const tokenHash = hashToken(token);

        // Check Redis blacklist
        const redis = getRedisClient();
        const isBlacklisted = await redis.exists(`${TOKEN_BLACKLIST_PREFIX}${tokenHash}`);

        if (isBlacklisted) {
            logger.info({ tokenHash: tokenHash.slice(0, 8) }, 'Blacklisted token rejected');
            res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_INVALIDATED',
                    message: 'Session has been logged out. Please login again.',
                },
            });
            return;
        }

        // Token not blacklisted, continue
        next();
    } catch (error) {
        // Log error but don't block request - fail open for availability
        // In production, consider failing closed for security
        logger.error({ error }, 'Token blacklist check failed');
        next();
    }
};

/**
 * Close Redis connection gracefully
 */
export const closeBlacklistRedis = async (): Promise<void> => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
};
