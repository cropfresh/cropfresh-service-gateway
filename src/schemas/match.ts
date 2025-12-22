/**
 * Match Validation Schemas - Story 3.5
 * 
 * Zod schemas for validating Match related API requests.
 */

import { z } from 'zod';

export const acceptMatchSchema = z.object({
    isPartial: z.boolean(),
    acceptedQuantity: z.number().positive().optional(),
}).refine(data => !data.isPartial || (data.acceptedQuantity !== undefined && data.acceptedQuantity > 0), {
    message: "acceptedQuantity is required for partial acceptance",
    path: ["acceptedQuantity"]
});

export const rejectMatchSchema = z.object({
    reason: z.enum(['QUALITY_CHANGED', 'SOLD_ELSEWHERE', 'CHANGED_MIND', 'OTHER']),
    otherReasonText: z.string().optional(),
}).refine(data => data.reason !== 'OTHER' || (!!data.otherReasonText && data.otherReasonText.trim().length > 0), {
    message: "otherReasonText is required when reason is OTHER",
    path: ["otherReasonText"]
});

export const listMatchesQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
});

export const matchIdParamSchema = z.object({
    id: z.string().uuid({ message: "Invalid match ID format" }),
});
