/**
 * Buyer Listing Details REST Endpoint - Story 4.2
 * 
 * SITUATION: Buyer taps produce card to view detailed information
 * TASK: Provide REST endpoint that proxies to Catalog Service gRPC
 * ACTION: Parse listing ID, validate, call GetListingDetails gRPC, return JSON
 * RESULT: Complete listing details for buyer detail screen
 * 
 * ACs:
 * - AC1: Photo gallery (farmer + verification photos)
 * - AC2: Quality grade with AI confidence
 * - AC3: Shelf-life display
 * - AC4: Farmer zone (privacy-preserved)
 * - AC5: AISP price breakdown
 * - AC6: Available quantity with stock status
 * - AC7: Delivery date options
 * - AC9: Digital Twin preview
 * 
 * @module ListingDetailsRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { catalogClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { authMiddleware } from '../../../middleware/auth';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'buyer-listing-routes' });

// =====================================================
// Zod Validation Schemas
// =====================================================

/**
 * Path parameter schema for listing ID
 */
const listingIdParamsSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

// =====================================================
// Response Types
// =====================================================

interface ListingPhoto {
    id: number;
    photoUrl: string;
    thumbnailUrl?: string;
    isPrimary: boolean;
    validationStatus: string;
    qualityScore?: number;
}

interface PriceBreakdown {
    basePrice: number;
    qualityAdjustment: number;
    logisticsCost: number;
    platformFee: number;
    finalPrice: number;
}

interface DeliveryOption {
    date: string;
    label: string;
    isAvailable: boolean;
}

interface DigitalTwin {
    harvestTimestamp?: string;
    verificationStatus: string;
    freshnessScore?: number;
    defectCount?: number;
    aiGradingDetails?: {
        grade: string;
        confidence: number;
        gradedAt?: string;
    };
}

interface ListingDetailsResponse {
    id: number;
    cropType: string;
    cropCategory: string;
    photos: ListingPhoto[];
    primaryPhotoUrl?: string;
    qualityGrade: string;
    aiConfidence: number;
    shelfLifeDays: number;
    shelfLifeDisplay: string;
    farmerZone: string;
    pricePerKg: number;
    priceBreakdown: PriceBreakdown;
    quantityKg: number;
    stockStatus: string;
    deliveryOptions: DeliveryOption[];
    digitalTwin: DigitalTwin;
    createdAt: string;
    updatedAt: string;
}

// =====================================================
// Listing Details Endpoint
// =====================================================

/**
 * GET /v1/buyers/listings/:id
 * Get detailed listing information for buyer view
 * 
 * Path Parameters:
 * - id: Listing ID (integer)
 * 
 * Response: ListingDetailsResponse (AC1-9)
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string || 'unknown';

        // Buyer authentication required
        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can view listing details');
        }

        // Parse and validate path params
        const parsed = await listingIdParamsSchema.parseAsync({ params: req.params });
        const listingId = parsed.params.id;

        logger.info({ userId, listingId }, 'Get listing details request');

        // Build gRPC request
        const grpcRequest = { id: listingId };

        // Call Catalog Service via gRPC
        catalogClient.GetListingDetails(
            grpcRequest,
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId, listingId }, 'GetListingDetails gRPC error');

                    // Handle specific gRPC errors
                    if (err.code === 5) { // NOT_FOUND
                        return sendError(res, 404, 'NOT_FOUND', 'Listing not found or not available');
                    }
                    if (err.code === 14) { // UNAVAILABLE
                        return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Catalog service unavailable');
                    }

                    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch listing details');
                }

                // Map gRPC response to REST response (camelCase consistent)
                const result: ListingDetailsResponse = {
                    id: response.id,
                    cropType: response.cropType || response.crop_type,
                    cropCategory: response.cropCategory || response.crop_category,
                    photos: (response.photos || []).map((p: any) => ({
                        id: p.id,
                        photoUrl: p.photoUrl || p.photo_url,
                        thumbnailUrl: p.thumbnailUrl || p.thumbnail_url,
                        isPrimary: p.isPrimary ?? p.is_primary,
                        validationStatus: p.validationStatus || p.validation_status,
                        qualityScore: p.qualityScore ?? p.quality_score,
                    })),
                    primaryPhotoUrl: response.primaryPhotoUrl || response.primary_photo_url,
                    qualityGrade: response.qualityGrade || response.quality_grade,
                    aiConfidence: Number(response.aiConfidence ?? response.ai_confidence ?? 0),
                    shelfLifeDays: Number(response.shelfLifeDays ?? response.shelf_life_days ?? 0),
                    shelfLifeDisplay: response.shelfLifeDisplay || response.shelf_life_display,
                    farmerZone: response.farmerZone || response.farmer_zone,
                    pricePerKg: Number(response.pricePerKg ?? response.price_per_kg ?? 0),
                    priceBreakdown: {
                        basePrice: Number(response.priceBreakdown?.basePrice ?? response.priceBreakdown?.base_price ?? 0),
                        qualityAdjustment: Number(response.priceBreakdown?.qualityAdjustment ?? response.priceBreakdown?.quality_adjustment ?? 0),
                        logisticsCost: Number(response.priceBreakdown?.logisticsCost ?? response.priceBreakdown?.logistics_cost ?? 0),
                        platformFee: Number(response.priceBreakdown?.platformFee ?? response.priceBreakdown?.platform_fee ?? 0),
                        finalPrice: Number(response.priceBreakdown?.finalPrice ?? response.priceBreakdown?.final_price ?? 0),
                    },
                    quantityKg: Number(response.quantityKg ?? response.quantity_kg ?? 0),
                    stockStatus: response.stockStatus || response.stock_status,
                    deliveryOptions: (response.deliveryOptions || response.delivery_options || []).map((d: any) => ({
                        date: d.date,
                        label: d.label,
                        isAvailable: d.isAvailable ?? d.is_available,
                    })),
                    digitalTwin: {
                        harvestTimestamp: response.digitalTwin?.harvestTimestamp || response.digitalTwin?.harvest_timestamp,
                        verificationStatus: response.digitalTwin?.verificationStatus || response.digitalTwin?.verification_status,
                        freshnessScore: response.digitalTwin?.freshnessScore ?? response.digitalTwin?.freshness_score,
                        defectCount: response.digitalTwin?.defectCount ?? response.digitalTwin?.defect_count,
                        aiGradingDetails: response.digitalTwin?.aiGradingDetails ? {
                            grade: response.digitalTwin.aiGradingDetails.grade,
                            confidence: Number(response.digitalTwin.aiGradingDetails.confidence ?? 0),
                            gradedAt: response.digitalTwin.aiGradingDetails.gradedAt || response.digitalTwin.aiGradingDetails.graded_at,
                        } : undefined,
                    },
                    createdAt: response.createdAt || response.created_at,
                    updatedAt: response.updatedAt || response.updated_at,
                };

                logger.info({ userId, listingId }, 'Listing details fetched successfully');
                sendSuccess(res, result);
            }
        );
    } catch (err) {
        // Zod validation errors
        if (err instanceof z.ZodError) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid listing ID', {
                errors: err.issues.map((e: z.ZodIssue) => ({ path: e.path.join('.'), message: e.message }))
            });
        }
        next(err);
    }
});

export default router;
