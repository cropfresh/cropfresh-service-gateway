/**
 * Droppoints Routes - Top-level REST API (Story 3.4 - Task 3.3)
 * 
 * SITUATION: Mobile app needs to query nearby drop points
 * TASK: Provide GET /nearby endpoint for geolocation-based lookup
 * ACTION: Validate query params, call logistics gRPC, return drop points
 * RESULT: Farmers can see available drop points near their location
 * 
 * Base path: /v1/farmers/droppoints
 * 
 * @module DroppointsRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nearbyDropPointsQuerySchema } from '../../../schemas/droppoint';
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
    if (error.code === grpc.status.INVALID_ARGUMENT) {
        return errorResponse(res, 'BAD_REQUEST', error.message || 'Invalid input', 400);
    }

    logger.error({ error }, 'Unhandled gRPC error');
    return errorResponse(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /v1/farmers/droppoints/nearby (Task 3.3)
 * 
 * Get nearby drop points for a given location.
 * Used for showing alternatives or initial discovery.
 */
router.get(
    '/nearby',
    validateQuery(nearbyDropPointsQuerySchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const { lat, lng, radius_km } = req.query as any;

            logger.info({ lat, lng, radius_km, farmerId }, 'Getting nearby drop points via REST');

            const result = await logisticsGrpcClient.getNearbyDropPoints({
                location: {
                    latitude: lat,
                    longitude: lng,
                },
                radiusKm: Number(radius_km) || 20,
            });

            return successResponse(res, {
                drop_points: (result.dropPoints || []).map((dp: any) => ({
                    id: dp.id,
                    name: dp.name,
                    address: dp.address,
                    location: {
                        lat: dp.location?.latitude,
                        lng: dp.location?.longitude,
                    },
                    distance_km: dp.distanceKm,
                    is_open: dp.isOpen,
                })),
            });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
