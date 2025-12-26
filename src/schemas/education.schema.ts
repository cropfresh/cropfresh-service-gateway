/**
 * Education Validation Schemas
 * Story 3.11: Educational Content on Quality Best Practices
 * 
 * Zod schemas for validating education API requests.
 */

import { z } from 'zod';

// Valid content categories
const ContentCategoryEnum = z.enum([
    'HARVEST',
    'STORAGE',
    'PHOTOGRAPHY',
    'HANDLING',
    'PACKAGING',
    'GENERAL',
]);

// Valid history types
const HistoryTypeEnum = z.enum(['viewed', 'bookmarked']);

/**
 * GET /v1/education/content
 * Query params for listing educational content
 */
export const getContentQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    category: ContentCategoryEnum.optional(),
    cropType: z.string().max(50).optional(),
});

export type GetContentQuery = z.infer<typeof getContentQuerySchema>;

/**
 * GET /v1/education/content/:id
 * Params for getting content details
 */
export const getContentDetailsParamsSchema = z.object({
    id: z.string().uuid(),
});

export type GetContentDetailsParams = z.infer<typeof getContentDetailsParamsSchema>;

/**
 * POST /v1/education/content/:id/view
 * Body for tracking view progress
 */
export const trackViewBodySchema = z.object({
    progressPercent: z.number().int().min(0).max(100),
});

export type TrackViewBody = z.infer<typeof trackViewBodySchema>;

/**
 * POST /v1/education/content/:id/bookmark
 * Body for toggling bookmark
 */
export const toggleBookmarkBodySchema = z.object({
    bookmarked: z.boolean(),
});

export type ToggleBookmarkBody = z.infer<typeof toggleBookmarkBodySchema>;

/**
 * GET /v1/education/history
 * Query params for getting farmer's content history
 */
export const getHistoryQuerySchema = z.object({
    type: HistoryTypeEnum.default('viewed'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type GetHistoryQuery = z.infer<typeof getHistoryQuerySchema>;
