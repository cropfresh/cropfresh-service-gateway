/**
 * Drop Point Routes - REST API (Story 3.4 - Task 3)
 * 
 * SITUATION: Mobile app needs REST endpoints for drop point operations
 * TASK: Provide REST endpoints that call logistics-service via gRPC
 * ACTION: Validate with Zod, authenticate, forward to gRPC
 * RESULT: Mobile-friendly REST API for drop point assignment
 * 
 * Base path: /v1/farmers/listings/:id (nested under listings)
 * Additional: /v1/farmers/droppoints (top-level for nearby query)
 * 
 * @module DropPointRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    listingIdParamSchema,
    assignDropPointSchema,
    nearbyDropPointsQuerySchema,
} from '../../../schemas/droppoint';
import { logisticsGrpcClient } from '../../../grpc/logistics-client';
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
 * POST /v1/farmers/listings/:id/assign-droppoint (Task 3.1)
 * 
 * Assign optimal drop point to a listing based on farmer location.
 * Returns drop point details with pickup window.
 */
router.post(
    '/:id/assign-droppoint',
    validateParams(listingIdParamSchema),
    validateBody(assignDropPointSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listingId = (req.params as any).id;
            const { farmer_location, crop_type, quantity_kg, preferred_date } = req.body;

            logger.info({ listingId, farmerId }, 'Assigning drop point via REST');

            const result = await logisticsGrpcClient.assignDropPoint({
                listingId,
                farmerId,
                farmerLocation: {
                    latitude: farmer_location.latitude,
                    longitude: farmer_location.longitude,
                },
                cropType: crop_type,
                quantityKg: quantity_kg,
                preferredDate: preferred_date,
            });

            // Map gRPC response to REST response format
            return successResponse(res, {
                drop_point: {
                    id: result.dropPoint?.id,
                    name: result.dropPoint?.name,
                    address: result.dropPoint?.address,
                    location: {
                        lat: result.dropPoint?.location?.latitude,
                        lng: result.dropPoint?.location?.longitude,
                    },
                    distance_km: result.dropPoint?.distanceKm,
                },
                pickup_window: {
                    start: result.pickupWindow?.start,
                    end: result.pickupWindow?.end,
                },
                crates_needed: result.cratesNeeded,
                listing_status: result.listingStatus,
            }, 201);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * GET /v1/farmers/listings/:id/droppoint (Task 3.2)
 * 
 * Get existing drop point assignment for a listing.
 */
router.get(
    '/:id/droppoint',
    validateParams(listingIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listingId = (req.params as any).id;

            logger.info({ listingId, farmerId }, 'Getting drop point assignment via REST');

            const result = await logisticsGrpcClient.getDropPointAssignment({
                listingId,
            });

            return successResponse(res, {
                drop_point: {
                    id: result.dropPoint?.id,
                    name: result.dropPoint?.name,
                    address: result.dropPoint?.address,
                    location: {
                        lat: result.dropPoint?.location?.latitude,
                        lng: result.dropPoint?.location?.longitude,
                    },
                    distance_km: result.dropPoint?.distanceKm,
                },
                pickup_window: {
                    start: result.pickupWindow?.start,
                    end: result.pickupWindow?.end,
                },
                crates_needed: result.cratesNeeded,
                status: result.status,
            });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
