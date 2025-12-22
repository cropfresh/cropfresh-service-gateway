/**
 * Photo Routes - REST API for Farmers
 * 
 * SITUATION: Mobile app needs REST endpoints for photo operations
 * TASK: Provide REST routes for presign, confirm, validate, delete
 * ACTION: Validate with Zod, authenticate with JWT, forward to gRPC
 * RESULT: RESTful photo management for mobile clients
 * 
 * @module PhotoRoutes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { catalogGrpcClient } from '../../../grpc/catalog-client';
import {
    presignRequestSchema,
    confirmUploadSchema,
    listingIdParamSchema,
    photoIdParamSchema,
} from '../../../schemas/photo';
import { logger } from '../../../utils/logger';

const router = Router({ mergeParams: true });

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

function validateBody<T extends z.ZodTypeAny>(schema: T) {
    return (req: Request, res: Response, next: Function) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                data: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request body',
                    details: result.error.flatten(),
                },
            });
        }
        req.body = result.data;
        next();
    };
}

function validateParams<T extends z.ZodTypeAny>(schema: T) {
    return (req: Request, res: Response, next: Function) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            return res.status(400).json({
                data: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid path parameters',
                    details: result.error.flatten(),
                },
            });
        }
        Object.assign(req.params, result.data);
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
    });
}

function errorResponse(
    res: Response,
    code: string,
    message: string,
    status = 500,
    details?: any
) {
    return res.status(status).json({
        data: null,
        error: { code, message, details },
    });
}

function mapGrpcError(error: any, res: Response) {
    const grpcCode = error.code;

    switch (grpcCode) {
        case 3: // INVALID_ARGUMENT
            return errorResponse(res, 'INVALID_ARGUMENT', error.details, 400);
        case 5: // NOT_FOUND
            return errorResponse(res, 'NOT_FOUND', error.details, 404);
        case 7: // PERMISSION_DENIED
            return errorResponse(res, 'PERMISSION_DENIED', error.details, 403);
        case 16: // UNAUTHENTICATED
            return errorResponse(res, 'UNAUTHENTICATED', error.details, 401);
        default:
            logger.error({ error }, 'gRPC error');
            return errorResponse(res, 'INTERNAL_ERROR', 'An error occurred', 500);
    }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /v1/farmers/listings/:listingId/photos/presign
 * Generate presigned URL for direct S3 upload
 */
router.post(
    '/:listingId/photos/presign',
    validateParams(listingIdParamSchema),
    validateBody(presignRequestSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHENTICATED', 'Not authenticated', 401);
            }

            const listingId = Number(req.params.listingId);

            const result = await catalogGrpcClient.getPresignedUrl({
                farmerId,
                listingId,
                fileName: req.body.fileName,
                contentType: req.body.contentType,
            });

            return successResponse(res, {
                photoId: result.photoId,
                presignedUrl: result.presignedUrl,
                expiresIn: result.expiresIn,
            }, 201);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * POST /v1/farmers/listings/:listingId/photos/:photoId/confirm
 * Confirm photo upload and store metadata
 */
router.post(
    '/:listingId/photos/:photoId/confirm',
    validateParams(photoIdParamSchema),
    validateBody(confirmUploadSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHENTICATED', 'Not authenticated', 401);
            }

            const listingId = Number(req.params.listingId);
            const photoId = Number(req.params.photoId);

            const photo = await catalogGrpcClient.confirmPhotoUpload({
                farmerId,
                listingId,
                photoId,
                ...req.body,
            });

            return successResponse(res, photo);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * GET /v1/farmers/listings/:listingId/photos
 * Get all photos for a listing
 */
router.get(
    '/:listingId/photos',
    validateParams(listingIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHENTICATED', 'Not authenticated', 401);
            }

            const listingId = Number(req.params.listingId);

            const result = await catalogGrpcClient.getListingPhotos({
                farmerId,
                listingId,
            });

            return successResponse(res, result.photos);
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

/**
 * DELETE /v1/farmers/listings/:listingId/photos/:photoId
 * Delete a photo
 */
router.delete(
    '/:listingId/photos/:photoId',
    validateParams(photoIdParamSchema),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const farmerId = req.user?.id;
            if (!farmerId) {
                return errorResponse(res, 'UNAUTHENTICATED', 'Not authenticated', 401);
            }

            const listingId = Number(req.params.listingId);
            const photoId = Number(req.params.photoId);

            await catalogGrpcClient.deletePhoto({
                farmerId,
                listingId,
                photoId,
            });

            return successResponse(res, { success: true, message: 'Photo deleted' });
        } catch (error) {
            return mapGrpcError(error, res);
        }
    }
);

export default router;
