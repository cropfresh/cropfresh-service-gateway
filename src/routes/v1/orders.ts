import { Router } from 'express';
import { createOrderSchema } from '../../schemas';
import { orderClient, createMetadata } from '../../grpc/clients';
import { sendSuccess } from '../../utils/response-handler';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { body } = await createOrderSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;
        const userId = (req as AuthRequest).user.id;

        orderClient.CreateOrder(
            {
                userId,
                items: body.items,
                deliveryAddressId: body.deliveryAddressId
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    return next(err);
                }
                sendSuccess(res, response);
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;
