/**
 * Transaction Zod Schemas - Story 3.7
 * 
 * Validation schemas for farmer transaction history and earnings REST endpoints.
 * All incoming request data validated before hitting service layer.
 */

import { z } from 'zod';

// ============================================
// QUERY SCHEMAS
// ============================================

/**
 * GET /v1/farmers/earnings - AC1
 */
export const getEarningsQuerySchema = z.object({});

export type GetEarningsQuery = z.infer<typeof getEarningsQuerySchema>;

/**
 * GET /v1/farmers/transactions - AC2, AC3
 */
export const getTransactionsQuerySchema = z.object({
    status: z.enum(['completed', 'pending', 'all']).default('all'),
    from: z.string().datetime().optional(),  // ISO8601
    to: z.string().datetime().optional(),    // ISO8601
    crop: z.string().optional(),
    sortBy: z.enum(['date', 'amount', 'crop']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;

/**
 * GET /v1/farmers/transactions/:id - AC4
 */
export const getTransactionDetailsParamsSchema = z.object({
    id: z.string().min(1, 'Transaction ID is required')
});

export type GetTransactionDetailsParams = z.infer<typeof getTransactionDetailsParamsSchema>;

/**
 * GET /v1/farmers/transactions/:id/receipt - AC5
 */
export const getReceiptParamsSchema = z.object({
    id: z.string().min(1, 'Transaction ID is required')
});

export type GetReceiptParams = z.infer<typeof getReceiptParamsSchema>;

// ============================================
// RESPONSE SCHEMAS (for documentation/typing)
// ============================================

export const earningsSummarySchema = z.object({
    total: z.number(),
    thisMonth: z.number(),
    pending: z.number(),
    orderCount: z.object({
        total: z.number(),
        thisMonth: z.number()
    }),
    newSinceLastVisit: z.number(),
    currency: z.string()
});

export const transactionListItemSchema = z.object({
    id: z.string(),
    date: z.string(),
    crop: z.object({
        type: z.string(),
        icon: z.string(),
        quantityKg: z.number()
    }),
    buyer: z.object({
        type: z.string(),
        city: z.string()
    }),
    amount: z.number(),
    status: z.enum(['completed', 'pending']),
    qualityGrade: z.string().optional()
});

export const paymentBreakdownSchema = z.object({
    baseAmount: z.number(),
    qualityBonus: z.number(),
    platformFee: z.number(),
    netAmount: z.number(),
    upiTxnId: z.string(),
    paidAt: z.string().optional()
});

export const dropPointSchema = z.object({
    name: z.string(),
    address: z.string()
});

export const transactionDetailsSchema = z.object({
    id: z.string(),
    listing: z.object({
        id: z.string(),
        cropType: z.string(),
        cropEmoji: z.string(),
        quantityKg: z.number(),
        photoUrl: z.string().optional()
    }),
    buyer: z.object({
        businessType: z.string(),
        city: z.string(),
        area: z.string().optional()
    }),
    dropPoint: dropPointSchema.optional(),
    hauler: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string(),
        vehicleType: z.string().optional(),
        vehicleNumber: z.string().optional()
    }).optional(),
    timeline: z.array(z.object({
        step: z.number(),
        status: z.string(),
        label: z.string(),
        completed: z.boolean(),
        active: z.boolean(),
        timestamp: z.string().optional(),
        actor: z.string().optional(),
        note: z.string().optional()
    })),
    payment: paymentBreakdownSchema,
    createdAt: z.string(),
    canDownloadReceipt: z.boolean()
});

export const transactionsPaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean()
});

export const transactionsListResponseSchema = z.object({
    transactions: z.array(transactionListItemSchema),
    pagination: transactionsPaginationSchema
});
