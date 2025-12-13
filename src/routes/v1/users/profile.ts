/**
 * Profile REST Endpoints - Story 2.7
 * 
 * Endpoints for profile management across all user types:
 * - GET /v1/users/profile - Get current user profile
 * - PATCH /v1/users/profile - Update profile fields
 * - GET /v1/users/profile/history - Get audit log
 * - POST /v1/users/profile/verify - Initiate field verification
 * - POST /v1/users/profile/verify/confirm - Confirm verification
 */

import { Router } from 'express';
import { z } from 'zod';
import { authClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { authMiddleware } from '../../../middleware/auth';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'profile-routes' });

// =====================================================
// Zod Validation Schemas
// =====================================================

const updateFarmerProfileSchema = z.object({
    body: z.object({
        language_preference: z.string().optional(),
        farming_types: z.array(z.string()).optional(),
        village: z.string().optional(),
        taluk: z.string().optional(),
        district: z.string().optional(),
    }),
});

const updateBuyerProfileSchema = z.object({
    body: z.object({
        business_name: z.string().min(1).optional(),
        quality_preference: z.enum(['GRADE_A_ONLY', 'GRADE_A_B', 'ALL_GRADES']).optional(),
        order_frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    }),
});

const updateHaulerProfileSchema = z.object({
    body: z.object({
        vehicle_number: z.string().regex(/^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/).optional(),
        vehicle_capacity_kg: z.number().positive().optional(),
        dl_expiry: z.string().datetime().optional(),
        available_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        available_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        available_days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).optional(),
    }),
});

const updateAgentProfileSchema = z.object({
    body: z.object({
        language_preference: z.string().optional(),
    }),
});

const initiateVerificationSchema = z.object({
    body: z.object({
        field_name: z.enum(['phone', 'email', 'upi_id']),
        new_value: z.string().min(1),
    }),
});

const confirmVerificationSchema = z.object({
    body: z.object({
        field_name: z.enum(['phone', 'email', 'upi_id']),
        token: z.string().min(1),
    }),
});

const auditLogQuerySchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(50),
        offset: z.coerce.number().int().min(0).default(0),
    }),
});

// =====================================================
// Profile Endpoints
// =====================================================

/**
 * GET /v1/users/profile
 * Get current user profile based on user type
 */
router.get('/profile', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        logger.info({ userId }, 'Get profile request');

        authClient.GetUserProfile(
            { user_id: String(userId) },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'GetUserProfile gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 404, 'NOT_FOUND', response.message);
                }

                sendSuccess(res, {
                    user_type: response.user_type,
                    profile: response[`${response.user_type.toLowerCase()}_profile`],
                    pending_verifications: response.pending_verifications || [],
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /v1/users/profile
 * Update profile fields based on user type
 */
router.patch('/profile', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string;
        const ipAddress = req.ip || req.socket.remoteAddress;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        logger.info({ userId, userType }, 'Update profile request');

        // Route to appropriate handler based on user type
        switch (userType) {
            case 'FARMER':
                await handleFarmerUpdate(req, res, next, userId, traceId, ipAddress);
                break;
            case 'BUYER':
                await handleBuyerUpdate(req, res, next, userId, traceId, ipAddress);
                break;
            case 'HAULER':
                await handleHaulerUpdate(req, res, next, userId, traceId, ipAddress);
                break;
            case 'AGENT':
                await handleAgentUpdate(req, res, next, userId, traceId, ipAddress);
                break;
            default:
                sendError(res, 400, 'INVALID_USER_TYPE', 'Profile updates not supported for this user type');
        }
    } catch (err) {
        next(err);
    }
});

/**
 * GET /v1/users/profile/history
 * Get profile change audit log
 */
router.get('/profile/history', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        const { query } = await auditLogQuerySchema.parseAsync(req);

        logger.info({ userId, limit: query.limit, offset: query.offset }, 'Get profile history request');

        authClient.GetProfileAuditLog(
            {
                user_id: String(userId),
                limit: query.limit,
                offset: query.offset,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'GetProfileAuditLog gRPC error');
                    return next(err);
                }

                sendSuccess(res, {
                    entries: response.entries || [],
                    total_count: response.total_count || 0,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/users/profile/verify
 * Initiate field verification
 */
router.post('/profile/verify', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        const { body } = await initiateVerificationSchema.parseAsync(req);

        logger.info({ userId, fieldName: body.field_name }, 'Initiate verification request');

        authClient.InitiateFieldVerification(
            {
                user_id: String(userId),
                field_name: body.field_name,
                new_value: body.new_value,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'InitiateFieldVerification gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 400, 'VERIFICATION_FAILED', response.message);
                }

                sendSuccess(res, {
                    message: response.message,
                    verification_type: response.verification_type,
                    expires_in_seconds: response.expires_in_seconds,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/users/profile/verify/confirm
 * Confirm field verification
 */
router.post('/profile/verify/confirm', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        const { body } = await confirmVerificationSchema.parseAsync(req);

        logger.info({ userId, fieldName: body.field_name }, 'Confirm verification request');

        authClient.ConfirmFieldVerification(
            {
                user_id: String(userId),
                field_name: body.field_name,
                token: body.token,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'ConfirmFieldVerification gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 400, 'VERIFICATION_FAILED', response.message);
                }

                sendSuccess(res, { message: response.message });
            }
        );
    } catch (err) {
        next(err);
    }
});

// =====================================================
// Helper Functions for User-Type-Specific Updates
// =====================================================

async function handleFarmerUpdate(req: any, res: any, next: any, userId: number, traceId: string, ipAddress?: string) {
    const { body } = await updateFarmerProfileSchema.parseAsync(req);

    authClient.UpdateFarmerProfile(
        {
            user_id: String(userId),
            ...body,
            ip_address: ipAddress,
        },
        createMetadata(traceId),
        (err: any, response: any) => {
            if (err) return next(err);
            if (!response.success) {
                return sendError(res, 400, 'UPDATE_FAILED', response.message);
            }
            sendSuccess(res, { message: 'Profile updated successfully', profile: response.profile });
        }
    );
}

async function handleBuyerUpdate(req: any, res: any, next: any, userId: number, traceId: string, ipAddress?: string) {
    const { body } = await updateBuyerProfileSchema.parseAsync(req);

    authClient.UpdateBuyerProfile(
        {
            user_id: String(userId),
            ...body,
            ip_address: ipAddress,
        },
        createMetadata(traceId),
        (err: any, response: any) => {
            if (err) return next(err);
            if (!response.success) {
                return sendError(res, 400, 'UPDATE_FAILED', response.message);
            }
            sendSuccess(res, { message: 'Profile updated successfully', profile: response.profile });
        }
    );
}

async function handleHaulerUpdate(req: any, res: any, next: any, userId: number, traceId: string, ipAddress?: string) {
    const { body } = await updateHaulerProfileSchema.parseAsync(req);

    authClient.UpdateHaulerProfile(
        {
            user_id: String(userId),
            ...body,
            ip_address: ipAddress,
        },
        createMetadata(traceId),
        (err: any, response: any) => {
            if (err) return next(err);
            if (!response.success) {
                return sendError(res, 400, 'UPDATE_FAILED', response.message);
            }
            sendSuccess(res, { message: 'Profile updated successfully', profile: response.profile });
        }
    );
}

async function handleAgentUpdate(req: any, res: any, next: any, userId: number, traceId: string, ipAddress?: string) {
    const { body } = await updateAgentProfileSchema.parseAsync(req);

    authClient.UpdateAgentProfile(
        {
            user_id: String(userId),
            ...body,
            ip_address: ipAddress,
        },
        createMetadata(traceId),
        (err: any, response: any) => {
            if (err) return next(err);
            if (!response.success) {
                return sendError(res, 400, 'UPDATE_FAILED', response.message);
            }
            sendSuccess(res, { message: 'Profile updated successfully', profile: response.profile });
        }
    );
}

export default router;
