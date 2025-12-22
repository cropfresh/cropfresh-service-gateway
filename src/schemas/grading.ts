/**
 * Grading Validation Schemas - Gateway
 * 
 * SITUATION: Mobile app sends grading requests after photo upload
 * TASK: Validate REST payloads before forwarding to catalog-service
 * ACTION: Define Zod schemas with strict validation rules
 * RESULT: Type-safe API with clear error messages
 * 
 * @module GradingSchemas
 */

import { z } from 'zod';

// ============================================================================
// Path Parameters
// ============================================================================

export const listingIdParamSchema = z.object({
    id: z.coerce.number().int().positive('Listing ID must be a positive integer'),
});

export type ListingIdParam = z.infer<typeof listingIdParamSchema>;

// ============================================================================
// Grade Listing Request (POST /listings/:id/grade)
// ============================================================================

export const gradeListingSchema = z.object({
    // Optional: force re-grading even if already graded
    forceRegrade: z.boolean().optional().default(false),
});

export type GradeListingBody = z.infer<typeof gradeListingSchema>;

// ============================================================================
// Calculate Price Request (POST /listings/:id/price)
// ============================================================================

export const calculatePriceSchema = z.object({
    // Grade must be provided for price calculation
    grade: z.enum(['A', 'B', 'C']),
    // Quantity in kg
    quantityKg: z.number().positive('Quantity must be greater than 0'),
    // Optional region for market rate lookup
    region: z.string().max(50).optional(),
});

export type CalculatePriceBody = z.infer<typeof calculatePriceSchema>;

// ============================================================================
// Confirm Listing Request (POST /listings/:id/confirm)
// ============================================================================

export const confirmListingSchema = z.object({
    // Grading result from AI
    grading: z.object({
        grade: z.enum(['A', 'B', 'C']),
        confidence: z.number().min(0).max(1),
        indicators: z.array(z.object({
            type: z.string(),
            score: z.number().min(0).max(1),
            label: z.string(),
        })),
        explanation: z.string(),
    }),
    // Price breakdown from DPLE
    pricing: z.object({
        marketRatePerKg: z.number().positive(),
        gradeAdjustment: z.string(),
        gradeMultiplier: z.number().positive(),
        finalPricePerKg: z.number().positive(),
        totalEarnings: z.number().positive(),
        quantityKg: z.number().positive(),
        currency: z.string().default('INR'),
        paymentTerms: z.string().default('T+0 on delivery'),
    }),
});

export type ConfirmListingBody = z.infer<typeof confirmListingSchema>;

// ============================================================================
// Reject Listing Request (POST /listings/:id/reject)
// ============================================================================

export const rejectListingSchema = z.object({
    reason: z.enum(['RETAKE_PHOTO', 'CANCEL', 'LIST_ANYWAY']),
});

export type RejectListingBody = z.infer<typeof rejectListingSchema>;

// ============================================================================
// Response Types
// ============================================================================

export const gradingResultSchema = z.object({
    grade: z.enum(['A', 'B', 'C']),
    confidence: z.number(),
    indicators: z.array(z.object({
        type: z.string(),
        score: z.number(),
        label: z.string(),
    })),
    explanation: z.string(),
});

export const priceBreakdownSchema = z.object({
    marketRatePerKg: z.number(),
    gradeAdjustment: z.string(),
    gradeMultiplier: z.number(),
    finalPricePerKg: z.number(),
    totalEarnings: z.number(),
    quantityKg: z.number(),
    currency: z.string(),
    paymentTerms: z.string(),
});

export type GradingResult = z.infer<typeof gradingResultSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
