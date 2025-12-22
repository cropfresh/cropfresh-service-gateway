/**
 * Grading Routes - REST API (Story 3.3)
 * 
 * SITUATION: Mobile app requests AI grading and DPLE pricing for listings
 * TASK: Provide REST endpoints that call catalog-service via gRPC
 * ACTION: Validate requests with Zod, authenticate with JWT, forward to gRPC
 * RESULT: Mobile-friendly REST API for grading and pricing operations
 * 
 * Base path: /v1/farmers/listings/:id/grading
 * 
 * @module GradingRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    listingIdParamSchema,
    gradeListingSchema,
    confirmListingSchema,
    rejectListingSchema,
} from '../../../schemas/grading';
import { catalogGrpcClient } from '../../../grpc/catalog-client';
import { logger } from '../../../utils/logger';

const router = Router();

// ============================================================================
// Type Definitions
// ============================================================================

interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        role: string;
    };
}

// ============================================================================
// Validation Middleware
// ============================================================================

function validateBody<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                data: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: result.error.flatten().fieldErrors,
                },
            });
        }
        req.body = result.data;
        next();
    };
}

function validateParams<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            return res.status(400).json({
                data: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid path parameters',
                    details: result.error.flatten().fieldErrors,
                },
            });
        }
        req.params = result.data as any;
        next();
    };
}

// ============================================================================
// Response Helpers
// ============================================================================

function successResponse(res: Response, data: any, status = 200) {
    return res.status(status).json({
        data,
        error: null,
        meta: {
            timestamp: new Date().toISOString(),
        },
    });
}

function errorResponse(res: Response, code: string, message: string, status = 500, details?: any) {
    return res.status(status).json({
        data: null,
        error: { code, message, details },
        meta: {
            timestamp: new Date().toISOString(),
        },
    });
}

function mapGrpcError(error: any, res: Response) {
    const grpc = require('@grpc/grpc-js');

    if (error.code === grpc.status.NOT_FOUND) {
        return errorResponse(res, 'NOT_FOUND', error.message || 'Resource not found', 404);
    }
    if (error.code === grpc.status.PERMISSION_DENIED) {
        return errorResponse(res, 'FORBIDDEN', error.message || 'Access denied', 403);
    }
    if (error.code === grpc.status.INVALID_ARGUMENT) {
        return errorResponse(res, 'BAD_REQUEST', error.message || 'Invalid input', 400);
    }
    if (error.code === grpc.status.FAILED_PRECONDITION) {
        return errorResponse(res, 'CONFLICT', error.message || 'Operation not allowed', 409);
    }

    logger.error({ error }, 'Unhandled gRPC error');
    return errorResponse(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /v1/farmers/listings/:id/grade
 * 
 * Trigger AI grading and get DPLE price for a listing.
 * Returns grading result with quality indicators and price breakdown.
 */
router.post(
    '/:id/grade',
    validateParams(listingIdParamSchema),
    validateBody(gradeListingSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listingId = (req.params as any).id;

            logger.info({ listingId, farmerId }, 'Grading listing via REST');

            const result = await catalogGrpcClient.gradeAndPrice({
                listingId,
                farmerId,
            });

            return successResponse(res, result);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * POST /v1/farmers/listings/:id/confirm
 * 
 * Farmer accepts the grading result and price.
 * Transitions listing from PENDING_GRADING to ACTIVE.
 */
router.post(
    '/:id/confirm',
    validateParams(listingIdParamSchema),
    validateBody(confirmListingSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listingId = (req.params as any).id;
            const { grading, pricing } = req.body;

            logger.info({ listingId, farmerId, grade: grading.grade }, 'Confirming listing via REST');

            const result = await catalogGrpcClient.confirmListing({
                listingId,
                farmerId,
                grading,
                pricing,
            });

            return successResponse(res, result);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * POST /v1/farmers/listings/:id/reject
 * 
 * Farmer rejects the grading with reason (retake, cancel, list anyway).
 */
router.post(
    '/:id/reject',
    validateParams(listingIdParamSchema),
    validateBody(rejectListingSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listingId = (req.params as any).id;
            const { reason } = req.body;

            logger.info({ listingId, farmerId, reason }, 'Rejecting listing via REST');

            const result = await catalogGrpcClient.rejectListing({
                listingId,
                farmerId,
                reason,
            });

            return successResponse(res, result);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
