import { Router } from 'express';
import { loginSchema } from '../../schemas';
import { authClient, createMetadata } from '../../grpc/clients';
import { sendSuccess } from '../../utils/response-handler';
import { logger } from '../../utils/logger';

const router = Router();

router.post('/login', async (req, res, next) => {
    try {
        // Validate request
        const { body } = await loginSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;

        // Call gRPC service
        authClient.Login(
            { phoneNumber: body.phoneNumber, otp: body.otp },
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
