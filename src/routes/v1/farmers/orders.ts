/**
 * Farmer Orders REST Routes - Story 3.6
 * 
 * REST API endpoints for farmer order status tracking.
 * Routes: GET /v1/farmers/orders, GET /v1/farmers/orders/:id, GET /v1/farmers/orders/:id/receipt
 * 
 * STAR: Situation - Mobile app needs REST endpoints for order tracking.
 *       Task - Validate requests, call gRPC, return JSON responses.
 *       Action - Use Zod validation, gRPC client, standard response format.
 *       Result - Clean REST layer with proper error handling.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../../middleware/auth';
import { orderClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { getOrdersQuerySchema, getOrderDetailsParamsSchema } from '../../../schemas/order-status.schema';
import { logger } from '../../../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// GET /v1/farmers/orders - List farmer's orders
// ============================================

/**
 * STAR: Get paginated list of farmer's orders.
 * Situation: Farmer opens "My Orders" screen.
 * Action: Validate query, call gRPC GetFarmerOrders, return list.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';

    try {
        // Validate query params
        const queryResult = getOrdersQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', queryResult.error.format());
        }

        const { status, page, limit } = queryResult.data;
        const farmerId = (req as AuthRequest).user.id;

        logger.info({ correlationId, farmerId, status, page, limit }, 'GET /farmers/orders');

        // Call gRPC
        orderClient.GetFarmerOrders(
            {
                farmer_id: farmerId,
                status_filter: status,
                page,
                limit
            },
            createMetadata(correlationId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ correlationId, error: err }, 'gRPC GetFarmerOrders failed');
                    return next(err);
                }

                // Map snake_case to camelCase for REST response
                const orders = response.orders.map((order: any) => ({
                    id: order.order_id,
                    listing: {
                        id: order.listing?.id || '',
                        cropType: order.listing?.crop_type || '',
                        cropEmoji: order.listing?.crop_emoji || '🌾',
                        quantityKg: order.listing?.quantity_kg || 0,
                        photoUrl: order.listing?.photo_url
                    },
                    buyer: {
                        businessType: order.buyer?.business_type || '',
                        city: order.buyer?.city || '',
                        area: order.buyer?.area
                    },
                    trackingStatus: mapProtoStatus(order.tracking_status),
                    currentStep: order.current_step || 1,
                    totalSteps: order.total_steps || 7,
                    totalAmount: order.total_amount || 0,
                    eta: order.eta || null,
                    delayMinutes: order.delay_minutes || null,
                    createdAt: order.created_at
                }));

                sendSuccess(res, {
                    orders,
                    pagination: {
                        page: response.pagination?.page || page,
                        limit: response.pagination?.limit || limit,
                        total: response.pagination?.total || 0
                    }
                });
            }
        );
    } catch (err) {
        logger.error({ correlationId, error: err }, 'Unexpected error in GET /farmers/orders');
        next(err);
    }
});

// ============================================
// GET /v1/farmers/orders/:id - Order details
// ============================================

/**
 * STAR: Get full order details with timeline.
 * Situation: Farmer taps on order card to view details.
 * Action: Validate orderId, call gRPC GetFarmerOrderDetails, return full order.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';

    try {
        // Validate params
        const paramsResult = getOrderDetailsParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid order ID', paramsResult.error.format());
        }

        const { id: orderId } = paramsResult.data;
        const farmerId = (req as AuthRequest).user.id;

        logger.info({ correlationId, farmerId, orderId }, 'GET /farmers/orders/:id');

        // Call gRPC
        orderClient.GetFarmerOrderDetails(
            {
                order_id: orderId,
                farmer_id: farmerId
            },
            createMetadata(correlationId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ correlationId, error: err }, 'gRPC GetFarmerOrderDetails failed');

                    // Map gRPC errors to HTTP status
                    if (err.code === 5) { // NOT_FOUND
                        return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
                    }
                    if (err.code === 7) { // PERMISSION_DENIED
                        return sendError(res, 403, 'UNAUTHORIZED', 'Not authorized to view this order');
                    }
                    return next(err);
                }

                // Map response to camelCase
                const order = {
                    id: response.order_id,
                    farmerId: response.farmer_id,
                    listing: {
                        id: response.listing?.id || '',
                        cropType: response.listing?.crop_type || '',
                        cropEmoji: response.listing?.crop_emoji || '🌾',
                        quantityKg: response.listing?.quantity_kg || 0,
                        photoUrl: response.listing?.photo_url
                    },
                    buyer: {
                        businessType: response.buyer?.business_type || '',
                        city: response.buyer?.city || '',
                        area: response.buyer?.area
                    },
                    trackingStatus: mapProtoStatus(response.tracking_status),
                    currentStep: response.current_step || 1,
                    totalSteps: response.total_steps || 7,
                    totalAmount: response.total_amount || 0,
                    eta: response.eta || null,
                    delayMinutes: response.delay_minutes || null,
                    delayReason: response.delay_reason || null,
                    hauler: response.hauler ? {
                        id: response.hauler.id,
                        name: response.hauler.name,
                        phone: response.hauler.phone,
                        vehicleType: response.hauler.vehicle_type,
                        vehicleNumber: response.hauler.vehicle_number
                    } : null,
                    statusHistory: (response.status_history || []).map((event: any) => ({
                        step: event.step,
                        status: mapProtoStatus(event.status),
                        label: event.label,
                        completed: event.completed,
                        active: event.active,
                        timestamp: event.timestamp || null,
                        actor: event.actor || null,
                        note: event.note || null
                    })),
                    upiTransactionId: response.upi_transaction_id || null,
                    createdAt: response.created_at,
                    updatedAt: response.updated_at
                };

                sendSuccess(res, order);
            }
        );
    } catch (err) {
        logger.error({ correlationId, error: err }, 'Unexpected error in GET /farmers/orders/:id');
        next(err);
    }
});

// ============================================
// GET /v1/farmers/orders/:id/receipt - Download receipt
// ============================================

/**
 * STAR: Generate PDF receipt for completed order.
 * Situation: Farmer taps "Download Receipt" on completed order.
 * Action: Validate orderId, generate/fetch PDF, return as download.
 * Note: Simplified implementation - returns receipt data for client-side PDF generation.
 */
router.get('/:id/receipt', async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';

    try {
        const paramsResult = getOrderDetailsParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid order ID', paramsResult.error.format());
        }

        const { id: orderId } = paramsResult.data;
        const farmerId = (req as AuthRequest).user.id;

        logger.info({ correlationId, farmerId, orderId }, 'GET /farmers/orders/:id/receipt');

        // Get order details for receipt
        orderClient.GetFarmerOrderDetails(
            {
                order_id: orderId,
                farmer_id: farmerId
            },
            createMetadata(correlationId),
            (err: any, response: any) => {
                if (err) {
                    if (err.code === 5) {
                        return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
                    }
                    return next(err);
                }

                // Only completed (PAID) orders have receipts
                if (response.tracking_status !== 7) { // PAID = 7
                    return sendError(res, 400, 'ORDER_NOT_COMPLETED', 'Receipt only available for completed orders');
                }

                // Return receipt data for client-side PDF generation
                const receiptData = {
                    receiptNumber: `RCP-${orderId}`,
                    orderId: response.order_id,
                    date: response.updated_at || new Date().toISOString(),
                    farmer: {
                        id: response.farmer_id
                        // Name, phone would come from auth context or separate call
                    },
                    listing: {
                        cropType: response.listing?.crop_type,
                        quantityKg: response.listing?.quantity_kg,
                        pricePerKg: response.total_amount / (response.listing?.quantity_kg || 1)
                    },
                    buyer: {
                        businessType: response.buyer?.business_type,
                        city: response.buyer?.city
                    },
                    totalAmount: response.total_amount,
                    upiTransactionId: response.upi_transaction_id,
                    status: 'PAID'
                };

                sendSuccess(res, receiptData);
            }
        );
    } catch (err) {
        logger.error({ correlationId, error: err }, 'Unexpected error in GET /farmers/orders/:id/receipt');
        next(err);
    }
});

// ============================================
// GET /v1/farmers/orders/count - Active order count (badge)
// ============================================

router.get('/count', async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';
    const farmerId = (req as AuthRequest).user.id;

    try {
        logger.info({ correlationId, farmerId }, 'GET /farmers/orders/count');

        orderClient.GetActiveOrderCount(
            { farmer_id: farmerId },
            createMetadata(correlationId),
            (err: any, response: any) => {
                if (err) {
                    return next(err);
                }
                sendSuccess(res, { count: response.count || 0 });
            }
        );
    } catch (err) {
        next(err);
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map proto TrackingStatus enum to string.
 */
function mapProtoStatus(protoStatus: number): string {
    const statusMap: Record<number, string> = {
        0: 'LISTED',
        1: 'LISTED',
        2: 'MATCHED',
        3: 'PICKUP_SCHEDULED',
        4: 'AT_DROP_POINT',
        5: 'IN_TRANSIT',
        6: 'DELIVERED',
        7: 'PAID'
    };
    return statusMap[protoStatus] || 'LISTED';
}

export default router;
