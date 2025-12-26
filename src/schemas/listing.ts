/**
 * Listing Validation Schemas - Gateway
 * 
 * Zod schemas for validating REST request payloads
 * before forwarding to catalog-service via gRPC.
 * 
 * @module ListingSchemas
 */

import { z } from 'zod';

// ============================================================================
// Create Listing
// ============================================================================

export const createListingSchema = z.object({
    cropId: z.number().int().positive('Crop ID must be a positive integer'),
    quantityKg: z.number().positive('Quantity must be greater than 0'),
    unit: z.string().max(20).default('kg'),
    displayQty: z.number().positive().optional(),
    entryMode: z.enum(['manual', 'voice', 'photo']).default('manual'),
    voiceText: z.string().max(500).optional(),
    voiceLanguage: z.enum(['en', 'kn', 'hi', 'ta', 'te']).optional(),
    qualityGrade: z.enum(['A', 'B', 'C']).optional(),
    harvestDate: z.string().datetime().optional(),
});

export type CreateListingBody = z.infer<typeof createListingSchema>;

// ============================================================================
// Update Listing
// ============================================================================

export const updateListingSchema = z.object({
    quantityKg: z.number().positive().optional(),
    unit: z.string().max(20).optional(),
    qualityGrade: z.enum(['A', 'B', 'C']).optional(),
    photoUrl: z.string().url().optional(),
    photoThumbnail: z.string().url().optional(),
    harvestDate: z.string().datetime().optional(),
});

export type UpdateListingBody = z.infer<typeof updateListingSchema>;

// ============================================================================
// Query Parameters
// ============================================================================

export const listListingsQuerySchema = z.object({
    status: z.enum([
        'DRAFT', 'PENDING_PHOTO', 'PENDING_GRADING', 'ACTIVE',
        'MATCHED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED',
        'CANCELLED', 'EXPIRED'
    ]).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;

// ============================================================================
// Path Parameters
// ============================================================================

export const listingIdParamSchema = z.object({
    id: z.coerce.number().int().positive('Listing ID must be a positive integer'),
});

export type ListingIdParam = z.infer<typeof listingIdParamSchema>;

// ============================================================================
// Story 3.9: Cancel Listing - Request Body
// ============================================================================

/**
 * Cancel listing request body schema
 * 
 * SITUATION: Farmer cancels a listing with reason selection (AC7)
 * TASK: Validate cancellation reason is one of allowed values
 * ACTION: Zod enum validation before gRPC call
 * RESULT: Typed reason passed to catalog-service
 */
export const cancelListingSchema = z.object({
    reason: z.enum([
        'SOLD_ELSEWHERE',
        'QUALITY_CHANGED',
        'CHANGED_MIND',
        'OTHER'
    ]).describe('Why the farmer is cancelling the listing'),
});

export type CancelListingBody = z.infer<typeof cancelListingSchema>;

