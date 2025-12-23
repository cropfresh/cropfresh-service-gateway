/**
 * Order Status Zod Schemas - Story 3.6
 * 
 * Validation schemas for farmer order tracking REST endpoints.
 * All incoming request data validated before hitting service layer.
 */

import { z } from 'zod';

// ============================================
// QUERY SCHEMAS
// ============================================

/**
 * GET /v1/farmers/orders - List orders
 */
export const getOrdersQuerySchema = z.object({
    status: z.enum(['active', 'completed', 'all']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>;

/**
 * GET /v1/farmers/orders/:id - Order details
 */
export const getOrderDetailsParamsSchema = z.object({
    id: z.string().min(1, 'Order ID is required')
});

export type GetOrderDetailsParams = z.infer<typeof getOrderDetailsParamsSchema>;

// ============================================
// RESPONSE SCHEMAS (for documentation/typing)
// ============================================

export const listingSummarySchema = z.object({
    id: z.string(),
    cropType: z.string(),
    cropEmoji: z.string(),
    quantityKg: z.number(),
    photoUrl: z.string().optional()
});

export const buyerSummarySchema = z.object({
    businessType: z.string(),
    city: z.string(),
    area: z.string().optional()
});

export const haulerInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    vehicleType: z.string().optional(),
    vehicleNumber: z.string().optional()
});

export const timelineEventSchema = z.object({
    step: z.number(),
    status: z.string(),
    label: z.string(),
    completed: z.boolean(),
    active: z.boolean(),
    timestamp: z.string().optional(),
    actor: z.string().optional(),
    note: z.string().optional()
});

export const orderListItemSchema = z.object({
    id: z.string(),
    listing: listingSummarySchema,
    buyer: buyerSummarySchema,
    trackingStatus: z.string(),
    currentStep: z.number(),
    totalSteps: z.number(),
    totalAmount: z.number(),
    eta: z.string().optional(),
    delayMinutes: z.number().optional(),
    createdAt: z.string()
});

export const orderDetailsSchema = z.object({
    id: z.string(),
    farmerId: z.number(),
    listing: listingSummarySchema,
    buyer: buyerSummarySchema,
    trackingStatus: z.string(),
    currentStep: z.number(),
    totalSteps: z.number(),
    totalAmount: z.number(),
    eta: z.string().optional(),
    delayMinutes: z.number().optional(),
    delayReason: z.string().optional(),
    hauler: haulerInfoSchema.optional(),
    statusHistory: z.array(timelineEventSchema),
    upiTransactionId: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
});

export const paginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number()
});

export const ordersListResponseSchema = z.object({
    orders: z.array(orderListItemSchema),
    pagination: paginationSchema
});

// ============================================
// TRACKING STATUS ENUM
// ============================================

export const trackingStatusEnum = z.enum([
    'LISTED',
    'MATCHED',
    'PICKUP_SCHEDULED',
    'AT_DROP_POINT',
    'IN_TRANSIT',
    'DELIVERED',
    'PAID'
]);

export type TrackingStatusEnum = z.infer<typeof trackingStatusEnum>;
