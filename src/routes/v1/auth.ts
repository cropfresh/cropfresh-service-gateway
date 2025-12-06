import { Router } from 'express';
import { loginSchema, requestOtpSchema, loginRequestOtpSchema, loginVerifyOtpSchema } from '../../schemas';
import { authClient, createMetadata } from '../../grpc/clients';
import { sendSuccess, sendError } from '../../utils/response-handler';
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

router.post('/otp/request', async (req, res, next) => {
    try {
        // Validate request
        const { body } = await requestOtpSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;

        // Call gRPC service
        authClient.RequestOtp(
            { phoneNumber: body.phoneNumber },
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

// Story 2.2 - Farmer Passwordless Login Endpoints

/**
 * POST /v1/auth/login/request-otp
 * Request OTP for farmer login (checks if phone is registered)
 */
router.post('/login/request-otp', async (req, res, next) => {
    try {
        const { body } = await loginRequestOtpSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;

        logger.info({ phoneNumber: body.phone_number }, 'Login OTP request received');

        authClient.RequestLoginOtp(
            { phoneNumber: body.phone_number },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    // Handle specific error codes
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'PHONE_NOT_REGISTERED') {
                            return sendError(res, 404, errorDetails.error, errorDetails.message);
                        }
                        if (errorDetails.error === 'ACCOUNT_LOCKED') {
                            return sendError(res, 403, errorDetails.error, errorDetails.message, {
                                locked_until: errorDetails.lockedUntil,
                            });
                        }
                    } catch {
                        // Not a structured error, pass to error handler
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    message: response.message,
                    expires_in: response.expiresIn,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/login/verify-otp
 * Verify OTP and complete farmer login
 */
router.post('/login/verify-otp', async (req, res, next) => {
    try {
        const { body } = await loginVerifyOtpSchema.parseAsync(req);
        const traceId = req.headers['x-trace-id'] as string;

        logger.info({ phoneNumber: body.phone_number, deviceId: body.device_id }, 'Login OTP verify request received');

        authClient.VerifyLoginOtp(
            {
                phoneNumber: body.phone_number,
                otp: body.otp,
                deviceId: body.device_id,
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    // Handle specific error codes
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'INVALID_OTP') {
                            return sendError(res, 401, errorDetails.error, errorDetails.message, {
                                remaining_attempts: errorDetails.remainingAttempts,
                            });
                        }
                        if (errorDetails.error === 'ACCOUNT_LOCKED') {
                            return sendError(res, 403, errorDetails.error, errorDetails.message, {
                                locked_until: errorDetails.lockedUntil,
                            });
                        }
                        if (errorDetails.error === 'PHONE_NOT_REGISTERED') {
                            return sendError(res, 404, errorDetails.error, errorDetails.message);
                        }
                    } catch {
                        // Not a structured error, pass to error handler
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    token: response.token,
                    user: {
                        id: response.user.id,
                        name: response.user.name,
                        phone: response.user.phone,
                        user_type: response.user.userType,
                        language: response.user.language,
                    },
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;
