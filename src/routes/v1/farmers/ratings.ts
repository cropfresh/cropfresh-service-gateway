/**
 * Ratings Routes - Story 3.10
 *
 * REST endpoints for farmer quality ratings and feedback.
 * Forwards requests to Order Service via gRPC.
 *
 * AC1: GET /v1/farmers/ratings - List farmer's ratings with pagination
 * AC2: GET /v1/farmers/ratings/summary - Get aggregate stats
 * AC4: GET /v1/farmers/ratings/:id - Get single rating details
 * AC8: PATCH /v1/farmers/ratings/:id/seen - Mark rating as viewed
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    getRatingsQuerySchema,
    getRatingSummaryQuerySchema,
    getRatingDetailsParamsSchema,
    markRatingSeenParamsSchema
} from '../../../schemas/rating.schema';

const router = Router();

// Middleware to extract farmer ID from auth token (placeholder)
const extractFarmerId = (req: Request): number => {
    // In production, extract from JWT token
    const farmerId = req.headers['x-farmer-id'] || req.query.farmerId;
    return Number(farmerId) || 0;
};

// Zod validation middleware
const validate = <T extends z.ZodSchema>(schema: T, source: 'query' | 'params' = 'query') => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const target = source === 'params' ? req.params : req.query;
            schema.parse(target);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.issues
                });
                return;
            }
            next(error);
        }
    };
};

/**
 * GET /v1/farmers/ratings - AC1, AC2, AC3
 * Returns paginated rating list with summary stats.
 */
router.get('/', validate(getRatingsQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const query = getRatingsQuerySchema.parse(req.query);

        // TODO: Call Order Service gRPC GetFarmerRatings
        // For now, return mock data following API design from story
        const mockRatings = {
            ratings: [
                {
                    id: 'r1-uuid-1234',
                    orderId: 1234,
                    cropType: 'Tomato',
                    cropIcon: '🍅',
                    quantityKg: 50,
                    rating: 5,
                    comment: 'Excellent quality! Very fresh produce.',
                    qualityIssues: [],
                    ratedAt: '2025-12-25T10:00:00Z',
                    seenByFarmer: true
                },
                {
                    id: 'r2-uuid-5678',
                    orderId: 1235,
                    cropType: 'Potato',
                    cropIcon: '🥔',
                    quantityKg: 100,
                    rating: 4,
                    comment: 'Good quality overall.',
                    qualityIssues: [],
                    ratedAt: '2025-12-24T14:30:00Z',
                    seenByFarmer: true
                },
                {
                    id: 'r3-uuid-9012',
                    orderId: 1236,
                    cropType: 'Onion',
                    cropIcon: '🧅',
                    quantityKg: 75,
                    rating: 3,
                    comment: 'Some items were bruised.',
                    qualityIssues: ['BRUISING'],
                    ratedAt: '2025-12-23T09:15:00Z',
                    seenByFarmer: false
                }
            ],
            pagination: {
                page: query.page,
                limit: query.limit,
                total: 23,
                hasMore: true
            },
            summary: {
                overallScore: 4.7,
                totalOrders: 23,
                starBreakdown: { star5: 18, star4: 4, star3: 1, star2: 0, star1: 0 },
                monthlyTrend: [
                    { month: '2025-11', avgRating: 4.5, count: 10 },
                    { month: '2025-12', avgRating: 4.8, count: 13 }
                ],
                bestCropType: 'Tomato',
                unseenCount: 2
            }
        };

        res.json(mockRatings);
    } catch (error) {
        console.error('Error fetching ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

/**
 * GET /v1/farmers/ratings/summary - AC2
 * Returns aggregate rating stats without list.
 */
router.get('/summary', validate(getRatingSummaryQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC GetFarmerRatingSummary
        const mockSummary = {
            overallScore: 4.7,
            totalOrders: 23,
            starBreakdown: { star5: 18, star4: 4, star3: 1, star2: 0, star1: 0 },
            monthlyTrend: [
                { month: '2025-11', avgRating: 4.5, count: 10 },
                { month: '2025-12', avgRating: 4.8, count: 13 }
            ],
            bestCropType: 'Tomato',
            unseenCount: 2
        };

        res.json(mockSummary);
    } catch (error) {
        console.error('Error fetching rating summary:', error);
        res.status(500).json({ error: 'Failed to fetch rating summary' });
    }
});

/**
 * GET /v1/farmers/ratings/:id - AC4, AC5
 * Returns full rating details with recommendations.
 */
router.get('/:id', validate(getRatingDetailsParamsSchema, 'params'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC GetRatingDetails
        const mockDetails = {
            id,
            orderId: 1236,
            cropType: 'Onion',
            cropIcon: '🧅',
            quantityKg: 75,
            rating: 3,
            comment: 'Some items were bruised. Overall acceptable but could be better.',
            qualityIssues: ['BRUISING'],
            recommendations: [
                {
                    issue: 'BRUISING',
                    title: 'Bruising detected',
                    recommendation: 'Handle produce gently during transport. Use padded crates and avoid stacking too high.',
                    tutorialId: 'handling-101'
                }
            ],
            ratedAt: '2025-12-23T09:15:00Z',
            deliveredAt: '2025-12-22T15:00:00Z',
            aiGradedPhotoUrl: null,
            buyerPhotoUrl: null
        };

        res.json(mockDetails);
    } catch (error) {
        console.error('Error fetching rating details:', error);
        res.status(500).json({ error: 'Failed to fetch rating details' });
    }
});

/**
 * PATCH /v1/farmers/ratings/:id/seen - AC8
 * Marks rating as seen by farmer.
 */
router.patch('/:id/seen', validate(markRatingSeenParamsSchema, 'params'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC MarkRatingSeen
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking rating as seen:', error);
        res.status(500).json({ error: 'Failed to mark rating as seen' });
    }
});

export default router;
