/**
 * Transaction Routes - Story 3.7
 * 
 * REST endpoints for farmer transaction history and earnings.
 * Forwards requests to Order Service via gRPC.
 * 
 * AC1: GET /v1/farmers/earnings - Earnings summary
 * AC2-3: GET /v1/farmers/transactions - Transaction list with filters
 * AC4: GET /v1/farmers/transactions/:id - Transaction details
 * AC5: GET /v1/farmers/transactions/:id/receipt - Download PDF receipt
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    getEarningsQuerySchema,
    getTransactionsQuerySchema,
    getTransactionDetailsParamsSchema,
    getReceiptParamsSchema
} from '../../../schemas/transaction.schema';

const router = Router();

// Middleware to extract farmer ID from auth token (placeholder)
const extractFarmerId = (req: Request): number => {
    // In production, extract from JWT token
    // For now, use query param or header
    const farmerId = req.headers['x-farmer-id'] || req.query.farmerId;
    return Number(farmerId) || 0;
};

// Zod validation middleware
const validate = <T extends z.ZodSchema>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const target = Object.keys(req.params).length > 0 ? req.params : req.query;
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
 * GET /v1/farmers/earnings - AC1
 * Returns farmer earnings summary (total, monthly, pending).
 */
router.get('/earnings', validate(getEarningsQuerySchema), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC GetFarmerEarnings
        // For now, return mock data following API design from story
        const mockEarnings = {
            earnings: {
                total: 45000,
                thisMonth: 8500,
                pending: 1800,
                orderCount: { total: 45, thisMonth: 8 },
                newSinceLastVisit: 3
            },
            currency: 'INR'
        };

        res.json(mockEarnings);
    } catch (error) {
        console.error('Error fetching earnings:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

/**
 * GET /v1/farmers/transactions - AC2, AC3
 * Returns paginated transaction list with optional filters.
 */
router.get('/transactions', validate(getTransactionsQuerySchema), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // Parse query params
        const query = getTransactionsQuerySchema.parse(req.query);

        // TODO: Call Order Service gRPC GetFarmerTransactions
        // For now, return mock data
        const mockTransactions = {
            transactions: [
                {
                    id: 'ORD-2025-001234',
                    date: '2025-12-20T10:00:00+05:30',
                    crop: { type: 'Tomato', icon: '🍅', quantityKg: 50 },
                    buyer: { type: 'Restaurant', city: 'Bangalore' },
                    amount: 1800,
                    status: 'completed',
                    qualityGrade: 'A'
                },
                {
                    id: 'ORD-2025-001235',
                    date: '2025-12-19T14:30:00+05:30',
                    crop: { type: 'Potato', icon: '🥔', quantityKg: 100 },
                    buyer: { type: 'Hotel', city: 'Mysore' },
                    amount: 2500,
                    status: 'pending',
                    qualityGrade: 'B'
                }
            ],
            pagination: {
                page: query.page,
                limit: query.limit,
                total: 45,
                hasMore: true
            }
        };

        res.json(mockTransactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

/**
 * GET /v1/farmers/transactions/:id - AC4
 * Returns full transaction details with timeline and payment breakdown.
 */
router.get('/transactions/:id', validate(getTransactionDetailsParamsSchema), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC GetTransactionDetails
        // For now, return mock data following API design from story
        const mockDetails = {
            transaction: {
                id,
                listing: {
                    id: 'LST-001234',
                    cropType: 'Tomato',
                    cropEmoji: '🍅',
                    quantityKg: 50,
                    photoUrl: ''
                },
                buyer: {
                    businessType: 'Restaurant',
                    city: 'Bangalore',
                    area: 'Koramangala'
                },
                dropPoint: {
                    name: 'Kolar Village Drop Point',
                    address: 'Main Road, Kolar 563101'
                },
                createdAt: '2025-12-20T08:00:00+05:30'
            },
            timeline: [
                { step: 1, status: 'LISTED', label: 'Listed', completed: true, active: false, timestamp: '2025-12-20T08:00:00+05:30' },
                { step: 2, status: 'MATCHED', label: 'Matched', completed: true, active: false, timestamp: '2025-12-20T08:15:00+05:30' },
                { step: 3, status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', completed: true, active: false, timestamp: '2025-12-20T09:00:00+05:30' },
                { step: 4, status: 'AT_DROP_POINT', label: 'At Drop Point', completed: true, active: false, timestamp: '2025-12-20T10:00:00+05:30' },
                { step: 5, status: 'IN_TRANSIT', label: 'In Transit', completed: true, active: false, timestamp: '2025-12-20T11:00:00+05:30' },
                { step: 6, status: 'DELIVERED', label: 'Delivered', completed: true, active: false, timestamp: '2025-12-20T14:00:00+05:30' },
                { step: 7, status: 'PAID', label: 'Payment Received', completed: true, active: true, timestamp: '2025-12-20T15:30:00+05:30' }
            ],
            payment: {
                baseAmount: 1750,
                qualityBonus: 50,
                platformFee: 0, // Farmers pay 0% commission
                netAmount: 1800,
                upiTxnId: '****ABCD1234',
                paidAt: '2025-12-20T15:30:00+05:30'
            },
            canDownloadReceipt: true
        };

        res.json(mockDetails);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
});

/**
 * GET /v1/farmers/transactions/:id/receipt - AC5
 * Returns PDF receipt for download.
 */
router.get('/transactions/:id/receipt', validate(getReceiptParamsSchema), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Order Service gRPC to verify receipt availability
        // TODO: Call ReceiptService to generate/retrieve PDF

        // For now, return a placeholder response
        res.status(501).json({
            message: 'Receipt generation not yet implemented',
            transactionId: id,
            note: 'Task 4 - ReceiptService will implement PDF generation'
        });
    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});

export default router;
