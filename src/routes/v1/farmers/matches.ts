/**
 * Farmers Matches Routes - REST API (Story 3.5)
 * 
 * SITUATION: Mobile app needs REST endpoints for match management
 * TASK: Provide REST routes that call order-service MatchService via gRPC
 * ACTION: Validate requests with Zod, authenticate with JWT, forward to gRPC
 * RESULT: Mobile-friendly REST API for match view/accept/reject
 * 
 * Base path: /v1/farmers/matches
 * 
 * @module FarmersMatchesRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    acceptMatchSchema,
    rejectMatchSchema,
    matchIdParamSchema,
    listMatchesQuerySchema,
} from '../../../schemas/match';
import { orderMatchGrpcClient } from '../../../grpc/order-match-client';
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

function validateQuery<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return res.status(400).json({
                data: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid query parameters',
                    details: result.error.flatten().fieldErrors,
                },
            });
        }
        req.query = result.data as any;
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
        return errorResponse(res, 'NOT_FOUND', error.message || 'Match not found', 404);
    }
    if (error.code === grpc.status.PERMISSION_DENIED) {
        return errorResponse(res, 'FORBIDDEN', error.message || 'Access denied', 403);
    }
    if (error.code === grpc.status.INVALID_ARGUMENT) {
        return errorResponse(res, 'BAD_REQUEST', error.message || 'Invalid input', 400);
    }
    if (error.code === grpc.status.FAILED_PRECONDITION) {
        return errorResponse(res, 'CONFLICT', error.message || 'Match expired or already actioned', 409);
    }

    logger.error({ error }, 'Unhandled gRPC error in matches route');
    return errorResponse(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /v1/farmers/matches
 * List pending matches for the authenticated farmer (AC6)
 */
router.get(
    '/',
    validateQuery(listMatchesQuerySchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const query = req.query as any;
            const result = await orderMatchGrpcClient.getPendingMatches(
                String(farmerId),
                query.limit || 10,
                ((query.page || 1) - 1) * (query.limit || 10) // offset calculation
            );

            // Transform snake_case to camelCase for mobile app
            const matches = result.matches.map(m => ({
                id: m.id,
                listingId: m.listing_id,
                orderId: m.order_id,
                quantityMatched: m.quantity_matched,
                pricePerKg: m.price_per_kg,
                totalAmount: m.total_amount,
                status: m.status,
                expiresAt: m.expires_at,
                createdAt: m.created_at,
                buyer: {
                    id: m.buyer_id,
                    businessType: m.buyer_business_type,
                    city: m.buyer_city,
                    area: m.buyer_area,
                },
                deliveryDate: m.delivery_date,
            }));

            return successResponse(res, {
                matches,
                totalCount: result.total_count,
                page: query.page || 1,
                limit: query.limit || 10,
            });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * GET /v1/farmers/matches/:id
 * Get details of a specific match (AC2)
 */
router.get(
    '/:id',
    validateParams(matchIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const matchId = (req.params as any).id;
            const result = await orderMatchGrpcClient.getMatchById(matchId);

            if (!result.match) {
                return errorResponse(res, 'NOT_FOUND', 'Match not found', 404);
            }

            const m = result.match;
            const match = {
                id: m.id,
                listingId: m.listing_id,
                orderId: m.order_id,
                quantityMatched: m.quantity_matched,
                pricePerKg: m.price_per_kg,
                totalAmount: m.total_amount,
                status: m.status,
                expiresAt: m.expires_at,
                createdAt: m.created_at,
                buyer: {
                    id: m.buyer_id,
                    businessType: m.buyer_business_type,
                    city: m.buyer_city,
                    area: m.buyer_area,
                },
                deliveryDate: m.delivery_date,
            };

            return successResponse(res, match);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * POST /v1/farmers/matches/:id/accept
 * Accept a match (full or partial) (AC3, AC5)
 */
router.post(
    '/:id/accept',
    validateParams(matchIdParamSchema),
    validateBody(acceptMatchSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const matchId = (req.params as any).id;
            const { isPartial, acceptedQuantity } = req.body;

            const result = await orderMatchGrpcClient.acceptMatch(
                matchId,
                isPartial,
                acceptedQuantity
            );

            logger.info({ matchId, farmerId, isPartial }, 'Match accepted via REST');

            return successResponse(res, {
                success: result.success,
                orderId: result.order_id,
                message: result.message || 'Match accepted successfully',
            });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * POST /v1/farmers/matches/:id/reject
 * Reject a match with reason (AC4)
 */
router.post(
    '/:id/reject',
    validateParams(matchIdParamSchema),
    validateBody(rejectMatchSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const matchId = (req.params as any).id;
            const { reason, otherReasonText } = req.body;

            const result = await orderMatchGrpcClient.rejectMatch(
                matchId,
                reason,
                otherReasonText
            );

            logger.info({ matchId, farmerId, reason }, 'Match rejected via REST');

            return successResponse(res, {
                success: result.success,
                message: 'Match rejected successfully',
            });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
