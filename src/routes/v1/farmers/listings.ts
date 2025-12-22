/**
 * Farmers Listings Routes - REST API
 * 
 * SITUATION: Mobile app needs REST endpoints for listing management
 * TASK: Provide REST routes that call catalog-service via gRPC
 * ACTION: Validate requests with Zod, authenticate with JWT, forward to gRPC
 * RESULT: Mobile-friendly REST API with proper auth and validation
 * 
 * Base path: /v1/farmers/listings
 * 
 * @module FarmersListingsRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    createListingSchema,
    updateListingSchema,
    listListingsQuerySchema,
    listingIdParamSchema,
} from '../../../schemas/listing';
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
 * POST /v1/farmers/listings
 * Create a new crop listing
 */
router.post(
    '/',
    validateBody(createListingSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const listing = await catalogGrpcClient.createListing({
                farmerId,
                cropId: req.body.cropId,
                quantityKg: req.body.quantityKg,
                unit: req.body.unit,
                displayQty: req.body.displayQty,
                entryMode: req.body.entryMode.toUpperCase(),
                voiceText: req.body.voiceText,
                voiceLanguage: req.body.voiceLanguage,
                qualityGrade: req.body.qualityGrade,
                harvestDate: req.body.harvestDate,
            });

            logger.info({ listingId: listing.id, farmerId }, 'Listing created via REST');
            return successResponse(res, listing, 201);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * GET /v1/farmers/listings
 * Get all listings for the authenticated farmer
 */
router.get(
    '/',
    validateQuery(listListingsQuerySchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const query = req.query as any;
            const result = await catalogGrpcClient.listFarmerListings({
                farmerId,
                status: query.status,
                page: query.page,
                pageSize: query.pageSize,
            });

            return successResponse(res, result);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * GET /v1/farmers/listings/:id
 * Get a specific listing by ID
 */
router.get(
    '/:id',
    validateParams(listingIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const id = (req.params as any).id;
            const listing = await catalogGrpcClient.getListing({ id, farmerId });

            return successResponse(res, listing);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * PATCH /v1/farmers/listings/:id
 * Update a listing
 */
router.patch(
    '/:id',
    validateParams(listingIdParamSchema),
    validateBody(updateListingSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const id = (req.params as any).id;
            const listing = await catalogGrpcClient.updateListing({
                id,
                farmerId,
                ...req.body,
            });

            logger.info({ listingId: id, farmerId }, 'Listing updated via REST');
            return successResponse(res, listing);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * DELETE /v1/farmers/listings/:id
 * Cancel a listing
 */
router.delete(
    '/:id',
    validateParams(listingIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHORIZED', 'Authentication required', 401);
            }

            const id = (req.params as any).id;
            await catalogGrpcClient.cancelListing({ id, farmerId });

            logger.info({ listingId: id, farmerId }, 'Listing cancelled via REST');
            return successResponse(res, { success: true, message: 'Listing cancelled' });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
