/**
 * Story 2.8: Session Management REST Endpoints
 *
 * Routes:
 * - GET    /v1/users/sessions          - List active sessions (AC3)
 * - DELETE /v1/users/sessions/:id      - Revoke specific session (AC4)
 * - DELETE /v1/users/sessions          - Revoke all except current (AC5)
 */

import { Router } from 'express';
import { authClient, createMetadata } from '../../grpc/clients';
import { sendSuccess, sendError } from '../../utils/response-handler';
import { logger } from '../../utils/logger';
import {
    listSessionsSchema,
    revokeSessionSchema,
    revokeAllSessionsSchema,
} from '../../schemas/session-schemas';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// All session routes require authentication
router.use(authMiddleware);

/**
 * GET /v1/users/sessions
 * List all active sessions for the current user (AC3)
 */
router.get('/', async (req, res, next) => {
    try {
        await listSessionsSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;
        const { userId, sessionId } = req.user as { userId: number; sessionId: number };

        logger.info({ userId }, 'List sessions request received');

        authClient.ListActiveSessions(
            {
                userId: String(userId),
                currentSessionId: sessionId,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    return next(err);
                }

                sendSuccess(res, {
                    sessions: response.sessions?.map((s: any) => ({
                        id: s.id,
                        device_name: s.deviceName || 'Unknown Device',
                        device_id: s.deviceId,
                        login_time: s.loginTime,
                        last_active_at: s.lastActiveAt,
                        location_city: s.locationCity,
                        location_region: s.locationRegion,
                        ip_address: s.ipAddress,
                        is_current_device: s.isCurrentDevice,
                    })) || [],
                    current_session_id: response.currentSessionId,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /v1/users/sessions/:sessionId
 * Revoke a specific session (remote logout) (AC4)
 */
router.delete('/:sessionId', async (req, res, next) => {
    try {
        const { params } = await revokeSessionSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;
        const { userId, sessionId: currentSessionId } = req.user as {
            userId: number;
            sessionId: number;
        };

        const targetSessionId = parseInt(params.sessionId, 10);

        logger.info({ userId, targetSessionId }, 'Revoke session request received');

        // Prevent revoking current session via this endpoint
        if (targetSessionId === currentSessionId) {
            return sendError(
                res,
                400,
                'CANNOT_REVOKE_CURRENT_SESSION',
                'Cannot revoke current session. Use POST /v1/auth/logout instead.'
            );
        }

        authClient.RevokeSession(
            {
                userId: String(userId),
                sessionId: targetSessionId,
                currentSessionId,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    return next(err);
                }

                if (!response.success) {
                    return sendError(
                        res,
                        404,
                        response.error || 'SESSION_NOT_FOUND',
                        response.message || 'Session not found or already revoked'
                    );
                }

                sendSuccess(res, {
                    message: 'Device logged out successfully',
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /v1/users/sessions
 * Revoke all sessions except current (AC5)
 */
router.delete('/', async (req, res, next) => {
    try {
        await revokeAllSessionsSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;
        const { userId, sessionId: currentSessionId, phone } = req.user as {
            userId: number;
            sessionId: number;
            phone: string;
        };

        logger.info({ userId }, 'Revoke all sessions request received');

        authClient.RevokeAllSessions(
            {
                userId: String(userId),
                currentSessionId,
                phone: phone || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    return next(err);
                }

                sendSuccess(res, {
                    revoked_count: response.revokedCount,
                    message: response.revokedCount > 0
                        ? 'All other devices logged out'
                        : 'No other sessions to logout',
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;
