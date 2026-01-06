/**
 * Buyer Orders REST Endpoints - Story 4.3
 *
 * SITUATION: Buyer places order specifying quantity and delivery preferences
 * TASK: Provide REST endpoints for order placement, payment callback, cancellation
 * ACTION: Validate request, call Order Service gRPC, return JSON
 * RESULT: Complete order placement flow for buyer app
 *
 * ACs:
 * - AC1-5: Order form with quantity, address, delivery time, summary, escrow info
 * - AC6: Create order with PENDING_PAYMENT status
 * - AC7-9: UPI payment flow and escrow
 * - AC10-13: Payment secured, confirmation screen
 * - AC14-15: Payment failure retry, cancellation
 *
 * @module BuyerOrdersRoutes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { orderClient, catalogClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { authMiddleware } from '../../../middleware/auth';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'buyer-orders-routes' });

// =====================================================
// Zod Validation Schemas
// =====================================================

/**
 * Schema for creating a buyer order (AC1-6)
 */
const createOrderSchema = z.object({
    body: z.object({
        listingId: z.number().int().positive('Listing ID must be a positive integer'),
        quantity: z.number().positive('Quantity must be greater than 0'),
        deliveryAddressId: z.string().min(1, 'Delivery address is required'),
        deliveryTimePref: z.enum(['MORNING', 'AFTERNOON', 'EVENING']),
    }),
});

/**
 * Schema for payment callback (AC8-10, AC14)
 */
const paymentCallbackSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
    body: z.object({
        upiTransactionId: z.string().optional(),
        status: z.enum(['SUCCESS', 'FAILED', 'PENDING']),
        errorMessage: z.string().optional(),
    }),
});

/**
 * Schema for cancel order (AC15)
 */
const cancelOrderSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

// =====================================================
// Response Types
// =====================================================

interface CreateOrderResponse {
    orderId: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    upiPaymentLink: string;
    estimatedDelivery: string;
    produceDetails: {
        cropType: string;
        quantityKg: number;
        qualityGrade: string;
    };
}

// =====================================================
// Delivery Time Enum Mapping
// =====================================================

const DELIVERY_TIME_MAP: Record<string, number> = {
    MORNING: 0,
    AFTERNOON: 1,
    EVENING: 2,
};

// =====================================================
// Route Handlers
// =====================================================

/**
 * POST /v1/buyers/orders
 *
 * Create a new buyer order (AC1-7)
 *
 * STAR:
 * - Situation: Buyer confirmed order on produce detail screen
 * - Task: Create order with delivery preferences, initiate payment
 * - Action: Fetch listing, validate, call Order Service, return payment link
 * - Result: Order created with UPI payment link for mobile app
 */
async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = req.headers['x-request-id'] as string || `req-${Date.now()}`;

    try {
        // Validate request
        const validated = createOrderSchema.parse({ body: req.body });
        const { listingId, quantity, deliveryAddressId, deliveryTimePref } = validated.body;

        // Get buyer ID from auth middleware
        const buyerId = (req as any).user?.userId;
        if (!buyerId) {
            sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            return;
        }

        logger.info({ correlationId, listingId, quantity, buyerId }, 'Creating buyer order');

        // Step 1: Fetch listing details from Catalog Service
        const listingResult = await new Promise<any>((resolve, reject) => {
            catalogClient.GetListingDetails(
                { listing_id: listingId },
                createMetadata(correlationId),
                (err: any, response: any) => {
                    if (err) reject(err);
                    else resolve(response);
                }
            );
        });

        if (!listingResult || !listingResult.listing) {
            sendError(res, 404, 'NOT_FOUND', 'Listing not found');
            return;
        }

        const listing = listingResult.listing;

        // Step 2: Call Order Service to create order
        const orderResult = await new Promise<any>((resolve, reject) => {
            orderClient.CreateBuyerOrder(
                {
                    listing_id: listingId,
                    buyer_id: buyerId,
                    quantity_kg: quantity,
                    delivery_address_id: deliveryAddressId,
                    delivery_time_pref: DELIVERY_TIME_MAP[deliveryTimePref],
                    listing_data: {
                        farmer_id: listing.farmer_id,
                        crop_type: listing.crop_type,
                        crop_emoji: listing.crop_emoji,
                        quantity_kg: listing.quantity_kg,
                        price_per_kg: listing.price_per_kg,
                        quality_grade: listing.quality_grade,
                        farmer_zone: listing.farmer_zone,
                        status: listing.status,
                    },
                },
                createMetadata(correlationId),
                (err: any, response: any) => {
                    if (err) reject(err);
                    else resolve(response);
                }
            );
        });

        // Map response to camelCase for mobile client
        const response: CreateOrderResponse = {
            orderId: orderResult.order_id,
            orderNumber: orderResult.order_number,
            status: orderResult.status,
            totalAmount: orderResult.total_amount,
            upiPaymentLink: orderResult.upi_payment_link,
            estimatedDelivery: orderResult.estimated_delivery,
            produceDetails: {
                cropType: listing.crop_type,
                quantityKg: quantity,
                qualityGrade: listing.quality_grade || 'N/A',
            },
        };

        logger.info({ correlationId, orderId: response.orderId }, 'Order created successfully');
        sendSuccess(res, response, 201, { requestId: correlationId });
    } catch (error: any) {
        handleGrpcError(error, res, correlationId, next);
    }
}

/**
 * POST /v1/buyers/orders/:id/payment-callback
 *
 * Handle UPI payment callback (AC8-10, AC14)
 *
 * STAR:
 * - Situation: UPI payment completed (success or failure)
 * - Task: Update order payment status
 * - Action: Call Order Service PaymentCallback gRPC
 * - Result: Order status updated, confirmation or retry
 */
async function paymentCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = req.headers['x-request-id'] as string || `req-${Date.now()}`;

    try {
        const validated = paymentCallbackSchema.parse({ params: req.params, body: req.body });
        const orderId = validated.params.id;
        const { upiTransactionId, status, errorMessage } = validated.body;

        logger.info({ correlationId, orderId, status }, 'Processing payment callback');

        const result = await new Promise<any>((resolve, reject) => {
            orderClient.PaymentCallback(
                {
                    order_id: orderId,
                    success: status === 'SUCCESS',
                    transaction_id: upiTransactionId,
                    error_message: errorMessage,
                },
                createMetadata(correlationId),
                (err: any, response: any) => {
                    if (err) reject(err);
                    else resolve(response);
                }
            );
        });

        sendSuccess(res, {
            success: result.success,
            message: result.message,
        }, 200, { requestId: correlationId });
    } catch (error: any) {
        handleGrpcError(error, res, correlationId, next);
    }
}

/**
 * POST /v1/buyers/orders/:id/cancel
 *
 * Cancel order before payment (AC15)
 *
 * STAR:
 * - Situation: Buyer cancels before completing payment
 * - Task: Cancel order, release reserved quantity
 * - Action: Call Order Service CancelOrder gRPC
 * - Result: Order cancelled, listing quantity restored
 */
async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = req.headers['x-request-id'] as string || `req-${Date.now()}`;

    try {
        const validated = cancelOrderSchema.parse({ params: req.params });
        const orderId = validated.params.id;

        const buyerId = (req as any).user?.userId;
        if (!buyerId) {
            sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            return;
        }

        logger.info({ correlationId, orderId, buyerId }, 'Cancelling order');

        const result = await new Promise<any>((resolve, reject) => {
            orderClient.CancelOrder(
                {
                    order_id: orderId,
                    buyer_id: buyerId,
                },
                createMetadata(correlationId),
                (err: any, response: any) => {
                    if (err) reject(err);
                    else resolve(response);
                }
            );
        });

        sendSuccess(res, {
            success: result.success,
            message: result.message,
        }, 200, { requestId: correlationId });
    } catch (error: any) {
        handleGrpcError(error, res, correlationId, next);
    }
}

// =====================================================
// Error Handling
// =====================================================

function handleGrpcError(
    error: any,
    res: Response,
    correlationId: string,
    next: NextFunction
): void {
    if (error instanceof z.ZodError) {
        const issues = error.issues || [];
        const message = issues.map((e: z.ZodIssue) => e.message).join(', ');
        sendError(res, 400, 'VALIDATION_ERROR', message || 'Validation failed');
        return;
    }

    // Handle gRPC errors
    if (error.code !== undefined) {
        const grpcCode = error.code;
        let httpStatus = 500;

        switch (grpcCode) {
            case 3: // INVALID_ARGUMENT
                httpStatus = 400;
                break;
            case 5: // NOT_FOUND
                httpStatus = 404;
                break;
            case 7: // PERMISSION_DENIED
                httpStatus = 403;
                break;
            case 9: // FAILED_PRECONDITION
                httpStatus = 409;
                break;
            case 14: // UNAVAILABLE
                httpStatus = 503;
                break;
            case 16: // UNAUTHENTICATED
                httpStatus = 401;
                break;
        }

        logger.warn(
            { correlationId, grpcCode, message: error.message },
            'gRPC error in orders route'
        );
        sendError(res, httpStatus, 'GRPC_ERROR', error.message || 'Service error');
        return;
    }

    // Log unexpected errors
    logger.error({ correlationId, error }, 'Unexpected error in orders route');
    next(error);
}

// =====================================================
// Route Registration
// =====================================================

// All routes require buyer authentication
router.use(authMiddleware);

router.post('/', createOrder);
router.post('/:id/payment-callback', paymentCallback);
router.post('/:id/cancel', cancelOrder);

export default router;
