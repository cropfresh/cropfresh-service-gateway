/**
 * Buyer Delivery Addresses REST Endpoints - Story 2.7 (AC2)
 * 
 * Endpoints for managing buyer delivery addresses:
 * - GET /v1/buyers/addresses - List all addresses
 * - POST /v1/buyers/addresses - Add new address
 * - PUT /v1/buyers/addresses/:id - Update address
 * - DELETE /v1/buyers/addresses/:id - Delete address
 */

import { Router } from 'express';
import { z } from 'zod';
import { authClient, createMetadata } from '../../../grpc/clients';
import { sendSuccess, sendError } from '../../../utils/response-handler';
import { authMiddleware } from '../../../middleware/auth';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'buyer-addresses-routes' });

// =====================================================
// Zod Validation Schemas
// =====================================================

const addAddressSchema = z.object({
    body: z.object({
        label: z.string().min(1).max(50),
        address_line1: z.string().min(1).max(255),
        address_line2: z.string().max(255).optional(),
        city: z.string().min(1).max(100),
        pincode: z.string().regex(/^\d{6}$/),
        instructions: z.string().max(500).optional(),
        is_default: z.boolean().optional().default(false),
    }),
});

const updateAddressSchema = z.object({
    body: z.object({
        label: z.string().min(1).max(50).optional(),
        address_line1: z.string().min(1).max(255).optional(),
        address_line2: z.string().max(255).optional(),
        city: z.string().min(1).max(100).optional(),
        pincode: z.string().regex(/^\d{6}$/).optional(),
        instructions: z.string().max(500).optional(),
        is_default: z.boolean().optional(),
    }),
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

const deleteAddressSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
});

// =====================================================
// Delivery Address Endpoints
// =====================================================

/**
 * GET /v1/buyers/addresses
 * List all delivery addresses for the authenticated buyer
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can access delivery addresses');
        }

        logger.info({ userId }, 'List delivery addresses request');

        authClient.ListDeliveryAddresses(
            { user_id: String(userId) },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'ListDeliveryAddresses gRPC error');
                    return next(err);
                }

                sendSuccess(res, {
                    addresses: response.addresses || [],
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/buyers/addresses
 * Add a new delivery address
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can add delivery addresses');
        }

        const { body } = await addAddressSchema.parseAsync(req);

        logger.info({ userId, label: body.label }, 'Add delivery address request');

        authClient.AddDeliveryAddress(
            {
                user_id: String(userId),
                label: body.label,
                address_line1: body.address_line1,
                address_line2: body.address_line2 || '',
                city: body.city,
                pincode: body.pincode,
                instructions: body.instructions || '',
                is_default: body.is_default,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'AddDeliveryAddress gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 400, 'ADD_FAILED', response.message);
                }

                sendSuccess(res, {
                    message: response.message,
                    address: response.address,
                }, 201);
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /v1/buyers/addresses/:id
 * Update an existing delivery address
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can update delivery addresses');
        }

        const { body, params } = await updateAddressSchema.parseAsync(req);

        logger.info({ userId, addressId: params.id }, 'Update delivery address request');

        authClient.UpdateDeliveryAddress(
            {
                address_id: params.id,
                user_id: String(userId),
                label: body.label,
                address_line1: body.address_line1,
                address_line2: body.address_line2,
                city: body.city,
                pincode: body.pincode,
                instructions: body.instructions,
                is_default: body.is_default,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'UpdateDeliveryAddress gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 404, 'NOT_FOUND', response.message);
                }

                sendSuccess(res, {
                    message: response.message,
                    address: response.address,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /v1/buyers/addresses/:id
 * Delete a delivery address
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as any).user?.id;
        const userType = (req as any).user?.role;
        const traceId = req.headers['x-trace-id'] as string;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        }

        if (userType !== 'BUYER') {
            return sendError(res, 403, 'FORBIDDEN', 'Only buyers can delete delivery addresses');
        }

        const { params } = await deleteAddressSchema.parseAsync(req);

        logger.info({ userId, addressId: params.id }, 'Delete delivery address request');

        authClient.DeleteDeliveryAddress(
            {
                address_id: params.id,
                user_id: String(userId),
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    logger.error({ err, userId }, 'DeleteDeliveryAddress gRPC error');
                    return next(err);
                }

                if (!response.success) {
                    return sendError(res, 404, 'NOT_FOUND', response.message);
                }

                sendSuccess(res, { message: response.message });
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;
