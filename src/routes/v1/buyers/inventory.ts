/**
 * Buyer Inventory Browse REST Endpoint - Story 4.1
 * 
 * SITUATION: Buyers browse available produce inventory on mobile app
 * TASK: Provide REST endpoint that proxies to Catalog Service gRPC
 * ACTION: Parse query params, validate, call gRPC, return JSON response
 * RESULT: Paginated inventory with filtering and sorting
 * 
 * ACs:
 * - AC-4.1.1: Display inventory grid with produce cards
 * - AC-4.1.2: Filter by crop type, grade, quantity, delivery date
 * - AC-4.1.3: Sort by price, quality, freshness, quantity
 * 
 * @module InventoryRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { catalogClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { authMiddleware } from '../../../middleware/auth';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'buyer-inventory-routes' });

// =====================================================
// Zod Validation Schemas
// =====================================================

/**
 * Inventory query parameters schema
 * Matches Flutter FilterPreferences.toQueryParams()
 */
const inventoryQuerySchema = z.object({
    query: z.object({
        // Produce type filter (multi-select, comma-separated)
        cropType: z.string().optional().transform((val) =>
            val ? val.split(',').map(s => s.trim()) : undefined
        ),
        // Quality grade filter (A, B, C - comma-separated)
        grade: z.string().optional().transform((val) =>
            val ? val.split(',').map(s => s.trim().toUpperCase()) : undefined
        ),
        // Quantity range
        qtyMin: z.coerce.number().min(0).optional(),
        qtyMax: z.coerce.number().min(0).optional(),
        // Delivery date filter (ISO 8601)
        deliveryDate: z.string().datetime({ offset: true }).optional(),
        // Sort option
        sort: z.enum([
            'price_asc',
            'price_desc',
            'quality_desc',
            'freshness',
            'quantity_desc'
        ]).default('freshness'),
        // Pagination
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

// =====================================================
// Response Types
// =====================================================

interface InventoryItem {
    id: string;
    cropType: string;
    photoUrl?: string;
    quantityKg: number;
    grade: string;
    pricePerKg: number;
    deliveryDate?: string;
    createdAt: string;
    isNew?: boolean;
}

interface InventoryResponse {
    items: InventoryItem[];
    total: number;
    nextCursor?: string;
    hasMore: boolean;
}

// =====================================================
// Inventory Endpoint
// =====================================================

/**
 * GET /v1/buyers/inventory
 * Browse available produce inventory with filters
 * 
 * Query Parameters:
 * - cropType: Produce types (comma-separated, e.g. "Tomatoes,Onions")
 * - grade: Quality grades (comma-separated, e.g. "A,B")
 * - qtyMin: Minimum quantity in kg
 * - qtyMax: Maximum quantity in kg
 * - deliveryDate: ISO 8601 date for delivery filter
 * - sort: Sort option (price_asc, price_desc, quality_desc, freshness, quantity_desc)
 * - cursor: Pagination cursor (last item ID)
 * - limit: Page size (default 20, max 50)
 */
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string || 'unknown';

        // Buyer authentication required
        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can browse inventory');
        }

        // Parse and validate query params
        const parsed = await inventoryQuerySchema.parseAsync({ query: req.query });
        const { cropType, grade, qtyMin, qtyMax, deliveryDate, sort, cursor, limit } = parsed.query;

        logger.info({
            userId,
            filters: { cropType, grade, qtyMin, qtyMax, sort },
            cursor,
            limit
        }, 'Inventory browse request');

        // Build gRPC request
        const grpcRequest = {
            crop_types: cropType || [],
            grades: grade || [],
            quantity_min: qtyMin,
            quantity_max: qtyMax,
            delivery_date: deliveryDate,
            sort,
            cursor,
            limit,
        };

        // Call Catalog Service via gRPC
        catalogClient.GetAvailableInventory(
            grpcRequest,
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'GetAvailableInventory gRPC error');

                    // Handle specific gRPC errors
                    if (err.code === 14) { // UNAVAILABLE
                        return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Catalog service unavailable');
                    }

                    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch inventory');
                }

                // Map gRPC response to REST response
                const result: InventoryResponse = {
                    items: (response.items || []).map((item: any) => ({
                        id: item.id,
                        cropType: item.crop_type || item.cropType,
                        photoUrl: item.photo_url || item.photoUrl,
                        quantityKg: Number(item.quantity_kg || item.quantityKg),
                        grade: item.grade,
                        pricePerKg: Number(item.price_per_kg || item.pricePerKg),
                        deliveryDate: item.delivery_date || item.deliveryDate,
                        createdAt: item.created_at || item.createdAt,
                        isNew: item.is_new || item.isNew || false,
                    })),
                    total: response.total || 0,
                    nextCursor: response.next_cursor || response.nextCursor,
                    hasMore: response.has_more ?? response.hasMore ?? false,
                };

                logger.info({
                    userId,
                    itemCount: result.items.length,
                    total: result.total,
                    hasMore: result.hasMore
                }, 'Inventory browse successful');

                sendSuccess(res, result);
            }
        );
    } catch (err) {
        // Zod validation errors
        if (err instanceof z.ZodError) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', {
                errors: err.issues.map((e: z.ZodIssue) => ({ path: e.path.join('.'), message: e.message }))
            });
        }
        next(err);
    }
});

/**
 * GET /v1/buyers/inventory/crop-types
 * Get available crop types for filter dropdown
 */
router.get('/crop-types', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        const traceId = req.headers['x-trace-id'] as string || 'unknown';

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        logger.info({ userId }, 'Get crop types request');

        // Call Catalog Service - returns available crop types
        catalogClient.ListProduce(
            { page: 1, page_size: 100 }, // Get all crop types
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'ListProduce gRPC error');
                    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch crop types');
                }

                // Extract unique crop names
                const cropTypes = [...new Set(
                    (response.items || []).map((item: any) => item.name).filter(Boolean)
                )].sort();

                sendSuccess(res, { cropTypes });
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;
