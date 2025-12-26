/**
 * Rating Zod Schemas - Story 3.10
 *
 * Validation schemas for farmer quality ratings & feedback REST endpoints.
 * All incoming request data validated before hitting service layer.
 */

import { z } from 'zod';

// ============================================
// QUERY SCHEMAS
// ============================================

/**
 * GET /v1/farmers/ratings - AC1-3
 */
export const getRatingsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cropType: z.string().optional()
});

export type GetRatingsQuery = z.infer<typeof getRatingsQuerySchema>;

/**
 * GET /v1/farmers/ratings/summary - AC2
 */
export const getRatingSummaryQuerySchema = z.object({});

export type GetRatingSummaryQuery = z.infer<typeof getRatingSummaryQuerySchema>;

/**
 * GET /v1/farmers/ratings/:id - AC4
 */
export const getRatingDetailsParamsSchema = z.object({
    id: z.string().uuid('Invalid rating ID format')
});

export type GetRatingDetailsParams = z.infer<typeof getRatingDetailsParamsSchema>;

/**
 * PATCH /v1/farmers/ratings/:id/seen - AC8
 */
export const markRatingSeenParamsSchema = z.object({
    id: z.string().uuid('Invalid rating ID format')
});

export type MarkRatingSeenParams = z.infer<typeof markRatingSeenParamsSchema>;

// ============================================
// RESPONSE SCHEMAS (for documentation/typing)
// ============================================

export const qualityIssueSchema = z.enum([
    'BRUISING',
    'SIZE_INCONSISTENCY',
    'RIPENESS_ISSUES',
    'FRESHNESS_CONCERNS',
    'PACKAGING_PROBLEMS'
]);

export const ratingListItemSchema = z.object({
    id: z.string(),
    orderId: z.number(),
    cropType: z.string(),
    cropIcon: z.string(),
    quantityKg: z.number(),
    rating: z.number().min(1).max(5),
    comment: z.string().nullable(),
    qualityIssues: z.array(qualityIssueSchema),
    ratedAt: z.string(),
    seenByFarmer: z.boolean()
});

export const starBreakdownSchema = z.object({
    star5: z.number(),
    star4: z.number(),
    star3: z.number(),
    star2: z.number(),
    star1: z.number()
});

export const trendItemSchema = z.object({
    month: z.string(),
    avgRating: z.number(),
    count: z.number()
});

export const ratingSummarySchema = z.object({
    overallScore: z.number(),
    totalOrders: z.number(),
    starBreakdown: starBreakdownSchema,
    monthlyTrend: z.array(trendItemSchema),
    bestCropType: z.string().nullable(),
    unseenCount: z.number()
});

export const recommendationSchema = z.object({
    issue: qualityIssueSchema,
    title: z.string(),
    recommendation: z.string(),
    tutorialId: z.string().nullable()
});

export const ratingDetailsSchema = z.object({
    id: z.string(),
    orderId: z.number(),
    cropType: z.string(),
    cropIcon: z.string(),
    quantityKg: z.number(),
    rating: z.number(),
    comment: z.string().nullable(),
    qualityIssues: z.array(qualityIssueSchema),
    recommendations: z.array(recommendationSchema),
    ratedAt: z.string(),
    deliveredAt: z.string().nullable(),
    aiGradedPhotoUrl: z.string().nullable(),
    buyerPhotoUrl: z.string().nullable()
});

export const paginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean()
});

export const ratingsListResponseSchema = z.object({
    ratings: z.array(ratingListItemSchema),
    pagination: paginationSchema,
    summary: ratingSummarySchema
});
