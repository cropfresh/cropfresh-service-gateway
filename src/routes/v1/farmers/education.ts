/**
 * Education Routes - Story 3.11
 * 
 * REST endpoints for farmer educational content.
 * Follows patterns established in ratings.ts.
 * 
 * AC1: GET /v1/farmers/education/content - List educational content
 * AC3-4: GET /v1/farmers/education/content/:id - Get content details
 * AC7: POST /v1/farmers/education/content/:id/view - Track view progress
 * AC7: POST /v1/farmers/education/content/:id/bookmark - Toggle bookmark
 * AC7: GET /v1/farmers/education/history - Get farmer's history
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    getContentQuerySchema,
    getContentDetailsParamsSchema,
    trackViewBodySchema,
    toggleBookmarkBodySchema,
    getHistoryQuerySchema,
} from '../../../schemas/education.schema';

const router = Router();

// Middleware to extract farmer ID from auth token (placeholder)
const extractFarmerId = (req: Request): number => {
    // In production, extract from JWT token
    const farmerId = req.headers['x-farmer-id'] || req.query.farmerId;
    return Number(farmerId) || 0;
};

// Zod validation middleware
const validate = <T extends z.ZodSchema>(schema: T, source: 'query' | 'params' | 'body' = 'query') => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const target = source === 'params' ? req.params : source === 'body' ? req.body : req.query;
            schema.parse(target);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.issues,
                });
                return;
            }
            next(error);
        }
    };
};

/**
 * GET /v1/farmers/education/content - AC1, AC2, AC6
 * Returns paginated educational content with recommendations.
 */
router.get('/content', validate(getContentQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const query = getContentQuerySchema.parse(req.query);

        // TODO: Call Catalog Service gRPC GetEducationalContent
        // For now, return mock data following API design from story
        const mockResponse = {
            content: [
                {
                    id: 'uuid-1234-harvest',
                    type: 'VIDEO',
                    title: 'Best Tomato Harvest Techniques',
                    titleRegional: { kn: 'ಟೊಮೇಟೊ ಕೊಯ್ಲು ತಂತ್ರಗಳು', hi: 'टमाटर की सबसे अच्छी तुड़ाई तकनीक' },
                    description: 'Learn the optimal time and method to harvest tomatoes.',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
                    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    durationSeconds: 180,
                    readTimeMinutes: null,
                    language: 'en',
                    categories: ['HARVEST'],
                    cropTypes: ['TOMATO'],
                    isFeatured: true,
                    isNew: true,
                    isBookmarked: false,
                    viewProgress: 0,
                },
                {
                    id: 'uuid-5678-handling',
                    type: 'VIDEO',
                    title: 'Gentle Handling Techniques',
                    titleRegional: { kn: 'ಮೃದುವಾಗಿ ನಿರ್ವಹಿಸುವ ತಂತ್ರಗಳು' },
                    description: 'Essential techniques to handle produce gently and avoid bruising.',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1498579397066-22750a3cb424?w=400',
                    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    durationSeconds: 240,
                    readTimeMinutes: null,
                    language: 'en',
                    categories: ['HANDLING'],
                    cropTypes: ['TOMATO', 'POTATO', 'ONION'],
                    isFeatured: true,
                    isNew: false,
                    isBookmarked: true,
                    viewProgress: 50,
                },
                {
                    id: 'uuid-9012-storage',
                    type: 'ARTICLE',
                    title: 'Pre-Delivery Storage Tips',
                    titleRegional: { kn: 'ವಿತರಣೆ ಮೊದಲು ಸಂಗ್ರಹಣೆ' },
                    description: 'How to keep produce fresh the night before drop-off.',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
                    contentUrl: '## Pre-Delivery Storage Tips\n\n### The Night Before\n1. Inspect your produce...',
                    durationSeconds: null,
                    readTimeMinutes: 4,
                    language: 'en',
                    categories: ['STORAGE'],
                    cropTypes: ['TOMATO', 'ONION', 'POTATO'],
                    isFeatured: false,
                    isNew: true,
                    isBookmarked: false,
                    viewProgress: 0,
                },
            ],
            pagination: {
                page: query.page,
                limit: query.limit,
                total: 14,
                hasMore: true,
            },
            recommendations: [
                {
                    section: 'Improve Your Score',
                    reason: 'Based on your recent bruising feedback',
                    content: [
                        {
                            id: 'uuid-5678-handling',
                            type: 'VIDEO',
                            title: 'Gentle Handling Techniques',
                            thumbnailUrl: 'https://images.unsplash.com/photo-1498579397066-22750a3cb424?w=400',
                            durationSeconds: 240,
                            categories: ['HANDLING'],
                        },
                    ],
                },
                {
                    section: 'Because you grow Tomatoes',
                    reason: 'Based on your crop profile',
                    content: [
                        {
                            id: 'uuid-1234-harvest',
                            type: 'VIDEO',
                            title: 'Best Tomato Harvest Techniques',
                            thumbnailUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
                            durationSeconds: 180,
                            categories: ['HARVEST'],
                        },
                    ],
                },
            ],
            unseenCount: 8,
        };

        res.json(mockResponse);
    } catch (error) {
        console.error('Error fetching educational content:', error);
        res.status(500).json({ error: 'Failed to fetch educational content' });
    }
});

/**
 * GET /v1/farmers/education/content/:id - AC3, AC4, AC5
 * Returns full content details with related content.
 */
router.get('/content/:id', validate(getContentDetailsParamsSchema, 'params'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Catalog Service gRPC GetContentDetails
        const mockDetails = {
            id,
            type: 'ARTICLE',
            title: 'Pre-Delivery Storage Tips',
            titleRegional: { kn: 'ವಿತರಣೆ ಮೊದಲು ಸಂಗ್ರಹಣೆ', hi: 'डिलीवरी से पहले स्टोरेज टिप्स' },
            description: 'How to keep produce fresh the night before drop-off.',
            thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
            contentUrl: `## Pre-Delivery Storage Tips

### The Night Before
1. **Inspect your produce** - Remove any damaged items
2. **Clean gently** - Wipe off dirt, don't wash unless necessary
3. **Sort by size** - Similar sizes together for better grading

### Temperature Control
- Keep vegetables cool (not frozen)
- Avoid direct sunlight
- Use shade cloth if storing outdoors

### Morning of Delivery
- Check again for any overnight damage
- Pack carefully in clean crates
- Leave early to avoid heat`,
            readTimeMinutes: 4,
            language: 'en',
            categories: ['STORAGE'],
            cropTypes: ['TOMATO', 'ONION', 'POTATO'],
            qualityIssues: ['FRESHNESS_CONCERNS'],
            isFeatured: false,
            isNew: false,
            isBookmarked: true,
            viewProgress: 75,
            createdAt: '2025-12-20T10:00:00Z',
            relatedContent: [
                {
                    id: 'uuid-storage-2',
                    type: 'VIDEO',
                    title: 'Cold Storage Best Practices',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1595231712325-9fedecef7575?w=400',
                    durationSeconds: 300,
                    categories: ['STORAGE'],
                },
            ],
        };

        res.json(mockDetails);
    } catch (error) {
        console.error('Error fetching content details:', error);
        res.status(500).json({ error: 'Failed to fetch content details' });
    }
});

/**
 * POST /v1/farmers/education/content/:id/view - AC3, AC7
 * Tracks view progress for a content item.
 */
router.post(
    '/content/:id/view',
    validate(getContentDetailsParamsSchema, 'params'),
    validate(trackViewBodySchema, 'body'),
    async (req: Request, res: Response) => {
        try {
            const farmerId = extractFarmerId(req);
            const { id } = req.params;
            const { progressPercent } = trackViewBodySchema.parse(req.body);

            if (!farmerId) {
                res.status(401).json({ error: 'Farmer ID required' });
                return;
            }

            // TODO: Call Catalog Service gRPC TrackContentView
            console.log(`Tracking view: content=${id}, farmer=${farmerId}, progress=${progressPercent}%`);

            res.json({ success: true });
        } catch (error) {
            console.error('Error tracking view:', error);
            res.status(500).json({ error: 'Failed to track view' });
        }
    }
);

/**
 * POST /v1/farmers/education/content/:id/bookmark - AC7
 * Toggles bookmark status for a content item.
 */
router.post(
    '/content/:id/bookmark',
    validate(getContentDetailsParamsSchema, 'params'),
    validate(toggleBookmarkBodySchema, 'body'),
    async (req: Request, res: Response) => {
        try {
            const farmerId = extractFarmerId(req);
            const { id } = req.params;
            const { bookmarked } = toggleBookmarkBodySchema.parse(req.body);

            if (!farmerId) {
                res.status(401).json({ error: 'Farmer ID required' });
                return;
            }

            // TODO: Call Catalog Service gRPC ToggleBookmark
            console.log(`Toggling bookmark: content=${id}, farmer=${farmerId}, bookmarked=${bookmarked}`);

            res.json({ success: true, bookmarked });
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            res.status(500).json({ error: 'Failed to toggle bookmark' });
        }
    }
);

/**
 * GET /v1/farmers/education/history - AC7
 * Returns farmer's viewed or bookmarked content history.
 */
router.get('/history', validate(getHistoryQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const query = getHistoryQuerySchema.parse(req.query);

        // TODO: Call Catalog Service gRPC GetFarmerContentHistory
        const mockHistory = {
            content: query.type === 'bookmarked'
                ? [
                    {
                        id: 'uuid-5678-handling',
                        type: 'VIDEO',
                        title: 'Gentle Handling Techniques',
                        thumbnailUrl: 'https://images.unsplash.com/photo-1498579397066-22750a3cb424?w=400',
                        durationSeconds: 240,
                        categories: ['HANDLING'],
                        isBookmarked: true,
                        viewProgress: 50,
                    },
                ]
                : [
                    {
                        id: 'uuid-9012-storage',
                        type: 'ARTICLE',
                        title: 'Pre-Delivery Storage Tips',
                        thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
                        readTimeMinutes: 4,
                        categories: ['STORAGE'],
                        isBookmarked: false,
                        viewProgress: 75,
                    },
                    {
                        id: 'uuid-5678-handling',
                        type: 'VIDEO',
                        title: 'Gentle Handling Techniques',
                        thumbnailUrl: 'https://images.unsplash.com/photo-1498579397066-22750a3cb424?w=400',
                        durationSeconds: 240,
                        categories: ['HANDLING'],
                        isBookmarked: true,
                        viewProgress: 50,
                    },
                ],
            pagination: {
                page: query.page,
                limit: query.limit,
                total: query.type === 'bookmarked' ? 1 : 2,
                hasMore: false,
            },
        };

        res.json(mockHistory);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

export default router;
