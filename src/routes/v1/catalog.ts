import { Router } from 'express';
import { catalogClient, createMetadata } from '../../grpc/clients';
import { sendSuccess } from '../../utils/response-handler';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.get('/products', authMiddleware, (req, res, next) => {
    const traceId = req.headers['x-trace-id'] as string;

    catalogClient.ListProducts(
        {}, // Empty request for listing all
        createMetadata(traceId),
        (err: any, response: any) => {
            if (err) {
                return next(err);
            }
            sendSuccess(res, response.products || []);
        }
    );
});

export default router;
