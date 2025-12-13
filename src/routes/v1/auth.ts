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

        // Call gRPC service - proto defines SendOtp, not RequestOtp
        authClient.SendOtp(
            { phone: body.phoneNumber, user_type: 'farmer' },  // snake_case for proto fields
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

// =====================================================
// Story 2.1 - Complete Onboarding Endpoints
// =====================================================

/**
 * POST /v1/auth/profile
 * Create farmer profile (AC5)
 */
router.post('/profile', async (req, res, next) => {
    try {
        const { user_id, full_name, village, taluk, district, state, pincode } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id || !full_name || !district || !state) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID, full name, district, and state are required');
        }

        authClient.CreateFarmerProfile(
            {
                userId: user_id,
                fullName: full_name,
                village: village || '',
                taluk: taluk || '',
                district,
                state,
                pincode: pincode || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    if (err.code === 6) { // ALREADY_EXISTS
                        return sendError(res, 409, 'PROFILE_EXISTS', 'Profile already exists for this user');
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    message: response.message,
                    profile: {
                        id: response.profile.id,
                        user_id: response.profile.userId,
                        full_name: response.profile.fullName,
                        village: response.profile.village,
                        taluk: response.profile.taluk,
                        district: response.profile.district,
                        state: response.profile.state,
                        pincode: response.profile.pincode,
                    },
                }, 201);
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /v1/auth/profile
 * Update farmer profile (AC5)
 */
router.put('/profile', async (req, res, next) => {
    try {
        const { user_id, full_name, village, taluk, district, state, pincode } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID is required');
        }

        authClient.UpdateFarmerProfile(
            {
                userId: user_id,
                fullName: full_name || '',
                village: village || '',
                taluk: taluk || '',
                district: district || '',
                state: state || '',
                pincode: pincode || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, {
                    message: response.message,
                    profile: {
                        id: response.profile.id,
                        user_id: response.profile.userId,
                        full_name: response.profile.fullName,
                        village: response.profile.village,
                        taluk: response.profile.taluk,
                        district: response.profile.district,
                        state: response.profile.state,
                        pincode: response.profile.pincode,
                        farm_size: response.profile.farmSize,
                        farming_types: response.profile.farmingTypes,
                        main_crops: response.profile.mainCrops,
                    },
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/farm-profile
 * Save farm profile (AC6)
 */
router.post('/farm-profile', async (req, res, next) => {
    try {
        const { user_id, farm_size, farming_types, main_crops } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id || !farm_size) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID and farm size are required');
        }

        authClient.SaveFarmProfile(
            {
                userId: user_id,
                farmSize: farm_size,
                farmingTypes: farming_types || [],
                mainCrops: main_crops || [],
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, {
                    message: response.message,
                    profile: {
                        id: response.profile.id,
                        farm_size: response.profile.farmSize,
                        farming_types: response.profile.farmingTypes,
                        main_crops: response.profile.mainCrops,
                    },
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/payment-details
 * Add payment details (AC7)
 */
router.post('/payment-details', async (req, res, next) => {
    try {
        const { user_id, payment_type, upi_id, bank_account, ifsc_code, bank_name } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id || !payment_type) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID and payment type are required');
        }

        authClient.AddPaymentDetails(
            {
                userId: user_id,
                paymentType: payment_type,
                upiId: upi_id || '',
                bankAccount: bank_account || '',
                ifscCode: ifsc_code || '',
                bankName: bank_name || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, {
                    message: response.message,
                    payment: {
                        id: response.payment.id,
                        payment_type: response.payment.paymentType,
                        upi_id: response.payment.upiId,
                        bank_account: response.payment.bankAccount,
                        ifsc_code: response.payment.ifscCode,
                        bank_name: response.payment.bankName,
                        is_verified: response.payment.isVerified,
                        is_primary: response.payment.isPrimary,
                    },
                }, 201);
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/verify-upi
 * Verify UPI ID (AC7)
 */
router.post('/verify-upi', async (req, res, next) => {
    try {
        const { upi_id } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!upi_id) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'UPI ID is required');
        }

        authClient.VerifyUpi(
            { upi_id: upi_id },  // Use snake_case matching proto field name
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, {
                    valid: response.valid,
                    customer_name: response.customerName,
                    message: response.message,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/test/verify-upi
 * Test endpoint for UPI verification (mock mode - no gRPC required)
 * Use for local development and testing without backend services
 */
router.post('/test/verify-upi', async (req, res) => {
    const { upi_id } = req.body;

    if (!upi_id) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'UPI ID is required');
    }

    // UPI VPA format validation: <username>@<bank_handle>
    const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    const isValidFormat = vpaRegex.test(upi_id);

    if (!isValidFormat) {
        return sendSuccess(res, {
            valid: false,
            customer_name: null,
            message: 'Invalid UPI ID format. Use format: yourname@bankhandle',
            test_mode: true,
        });
    }

    // Mock responses based on UPI ID patterns for testing
    const mockResponses: Record<string, { name: string; valid: boolean }> = {
        'test@upi': { name: 'Test User', valid: true },
        'farmer@ybl': { name: 'Ramesh Kumar', valid: true },
        'demo@paytm': { name: 'Demo Account', valid: true },
        'invalid@xxx': { name: '', valid: false },
    };

    const mockData = mockResponses[upi_id.toLowerCase()];

    if (mockData) {
        return sendSuccess(res, {
            valid: mockData.valid,
            customer_name: mockData.name || null,
            message: mockData.valid ? 'UPI ID verified (test mode)' : 'Invalid UPI ID (test mode)',
            test_mode: true,
        });
    }

    // Default: treat any valid format as valid in test mode
    // Extract name from UPI ID (e.g., "ramesh.kumar@sbi" -> "Ramesh Kumar")
    const username = upi_id.split('@')[0];
    const formattedName = username
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    sendSuccess(res, {
        valid: true,
        customer_name: formattedName,
        message: 'UPI ID format valid (test mode - actual verification requires Razorpay)',
        test_mode: true,
    });
});

/**
 * POST /v1/auth/pin
 * Set PIN (AC8)
 */
router.post('/pin', async (req, res, next) => {
    try {
        const { user_id, pin } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id || !pin) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID and PIN are required');
        }

        if (!/^\d{4}$/.test(pin)) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'PIN must be exactly 4 digits');
        }

        authClient.SetPin(
            { userId: user_id, pin },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, { message: response.message }, 201);
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/login-pin
 * Login with PIN (AC8)
 */
router.post('/login-pin', async (req, res, next) => {
    try {
        const { user_id, pin, device_id } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!user_id || !pin) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'User ID and PIN are required');
        }

        authClient.LoginWithPin(
            {
                userId: user_id,
                pin,
                deviceId: device_id || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'INVALID_PIN') {
                            return sendError(res, 401, errorDetails.error, errorDetails.message, {
                                remaining_attempts: errorDetails.remainingAttempts,
                            });
                        }
                        if (errorDetails.error === 'ACCOUNT_LOCKED') {
                            return sendError(res, 403, errorDetails.error, errorDetails.message, {
                                locked_until: errorDetails.lockedUntil,
                            });
                        }
                    } catch {
                        // Not a structured error
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

// =====================================================
// Story 2.3 - Buyer Business Account Creation Endpoints
// =====================================================

/**
 * POST /v1/auth/buyer/register
 * Step 1: Register buyer and send OTP
 */
router.post('/buyer/register', async (req, res, next) => {
    try {
        const {
            business_name,
            business_type,
            email,
            password,
            mobile_number,
            gst_number
        } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        // Basic validation
        if (!business_name || !business_type || !email || !password || !mobile_number) {
            return sendError(res, 400, 'VALIDATION_ERROR',
                'Business name, type, email, password, and mobile number are required');
        }

        logger.info({ email, mobile_number, business_type }, 'Buyer registration request received');

        authClient.RegisterBuyer(
            {
                businessName: business_name,
                businessType: business_type,
                email,
                password,
                mobileNumber: mobile_number,
                gstNumber: gst_number || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'WEAK_PASSWORD') {
                            return sendError(res, 400, errorDetails.error, errorDetails.message, {
                                password_errors: errorDetails.errors,
                            });
                        }
                        if (errorDetails.error === 'EMAIL_EXISTS') {
                            return sendError(res, 409, errorDetails.error, errorDetails.message);
                        }
                        if (errorDetails.error === 'PHONE_EXISTS') {
                            return sendError(res, 409, errorDetails.error, errorDetails.message);
                        }
                    } catch {
                        // Not a structured error
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
 * POST /v1/auth/buyer/verify-otp
 * Step 2: Verify OTP and complete buyer registration
 */
router.post('/buyer/verify-otp', async (req, res, next) => {
    try {
        const { mobile_number, otp, address } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        // Basic validation
        if (!mobile_number || !otp) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Mobile number and OTP are required');
        }

        if (!address || !address.address_line1 || !address.city || !address.state || !address.pincode) {
            return sendError(res, 400, 'VALIDATION_ERROR',
                'Address with address_line1, city, state, and pincode is required');
        }

        logger.info({ mobile_number }, 'Buyer OTP verification request received');

        authClient.VerifyBuyerOtp(
            {
                mobileNumber: mobile_number,
                otp,
                address: {
                    addressLine1: address.address_line1,
                    addressLine2: address.address_line2 || '',
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                    latitude: address.latitude || 0,
                    longitude: address.longitude || 0,
                },
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'INVALID_OTP') {
                            return sendError(res, 401, errorDetails.error, errorDetails.message);
                        }
                    } catch {
                        // Not a structured error
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    message: response.message,
                    token: response.token,
                    buyer: {
                        id: response.buyer.id,
                        user_id: response.buyer.userId,
                        business_name: response.buyer.businessName,
                        business_type: response.buyer.businessType,
                        email: response.buyer.email,
                        mobile_number: response.buyer.mobileNumber,
                        gst_number: response.buyer.gstNumber,
                        email_verified: response.buyer.emailVerified,
                        address: {
                            address_line1: response.buyer.address.addressLine1,
                            address_line2: response.buyer.address.addressLine2,
                            city: response.buyer.address.city,
                            state: response.buyer.address.state,
                            pincode: response.buyer.address.pincode,
                            latitude: response.buyer.address.latitude,
                            longitude: response.buyer.address.longitude,
                        },
                    },
                }, 201);
            }
        );
    } catch (err) {
        next(err);
    }
});

// =====================================================
// Story 2.3 - Buyer Login & Password Management Endpoints
// =====================================================

/**
 * POST /v1/auth/buyer/login
 * AC7: Buyer email/password login
 */
router.post('/buyer/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!email || !password) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
        }

        logger.info({ email }, 'Buyer login request received');

        authClient.LoginBuyer(
            { email, password },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'INVALID_CREDENTIALS') {
                            return sendError(res, 401, errorDetails.error, errorDetails.message, {
                                remaining_attempts: errorDetails.remainingAttempts,
                            });
                        }
                        if (errorDetails.error === 'ACCOUNT_LOCKED') {
                            return sendError(res, 429, errorDetails.error, errorDetails.message, {
                                locked_until_minutes: errorDetails.lockedUntilMinutes,
                            });
                        }
                    } catch {
                        // Not a structured error
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    message: response.message,
                    token: response.token,
                    user: {
                        id: response.buyer?.userId,
                        business_name: response.buyer?.businessName,
                        business_type: response.buyer?.businessType,
                        email: response.buyer?.email,
                        mobile_number: response.buyer?.mobileNumber,
                        email_verified: response.buyer?.emailVerified,
                    },
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/buyer/logout
 * AC12: Buyer logout - invalidate token
 */
router.post('/buyer/logout', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const traceId = req.headers['x-trace-id'] as string;

        if (!token) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authorization token is required');
        }

        logger.info('Buyer logout request received');

        authClient.LogoutBuyer(
            { token },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, { message: response.message });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/buyer/forgot-password
 * AC9: Request password reset email
 */
router.post('/buyer/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!email) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Email is required');
        }

        logger.info({ email }, 'Forgot password request received');

        authClient.ForgotPassword(
            { email },
            createMetadata(traceId),
            (err: any, response: any) => {
                // Always return success to prevent email enumeration
                if (err) {
                    logger.error({ err }, 'ForgotPassword error (hidden from user)');
                }
                sendSuccess(res, {
                    message: response?.message || 'If this email exists, we\'ve sent a reset link.',
                });
            }
        );
    } catch (err) {
        // Still return success to prevent enumeration
        sendSuccess(res, {
            message: 'If this email exists, we\'ve sent a reset link.',
        });
    }
});

/**
 * POST /v1/auth/buyer/reset-password
 * AC9: Reset password with token
 */
router.post('/buyer/reset-password', async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const traceId = req.headers['x-trace-id'] as string;

        if (!token || !password) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Token and password are required');
        }

        logger.info('Reset password request received');

        authClient.ResetPassword(
            { token, newPassword: password },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) {
                    try {
                        const errorDetails = JSON.parse(err.details);
                        if (errorDetails.error === 'TOKEN_EXPIRED') {
                            return sendError(res, 400, errorDetails.error, errorDetails.message);
                        }
                        if (errorDetails.error === 'INVALID_PASSWORD') {
                            return sendError(res, 400, errorDetails.error, errorDetails.message, {
                                password_errors: errorDetails.passwordErrors,
                            });
                        }
                        if (errorDetails.error === 'INVALID_TOKEN') {
                            return sendError(res, 400, errorDetails.error, errorDetails.message);
                        }
                    } catch {
                        // Not a structured error
                    }
                    return next(err);
                }
                sendSuccess(res, {
                    message: response.message,
                    token: response.token,
                    user: {
                        id: response.buyer?.userId,
                        business_name: response.buyer?.businessName,
                        email: response.buyer?.email,
                    },
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

// =====================================================
// Story 2.8 - Session Management & Re-authentication
// =====================================================

/**
 * POST /v1/auth/logout
 * Universal logout endpoint (AC1)
 */
router.post('/logout', async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const traceId = req.headers['x-trace-id'] as string;

        if (!token) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authorization token is required');
        }

        logger.info('Logout request received');

        authClient.Logout(
            { token },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);
                sendSuccess(res, {
                    success: true,
                    message: 'Logged out successfully',
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/reauth/initiate
 * Initiate re-authentication for critical actions (AC8)
 */
router.post('/reauth/initiate', async (req, res, next) => {
    try {
        const { action } = req.body;
        const token = req.headers.authorization?.replace('Bearer ', '');
        const traceId = req.headers['x-trace-id'] as string;

        if (!token) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authorization token is required');
        }

        if (!action) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Action is required');
        }

        // TODO: Extract user_id and user_type from JWT token
        // For now, these should come from the auth middleware
        const userId = (req as any).user?.userId;
        const userType = (req as any).user?.userType;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
        }

        logger.info({ userId, action }, 'Re-auth initiate request received');

        authClient.InitiateReauth(
            {
                userId: String(userId),
                action,
                userType: userType || 'FARMER',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);

                if (!response.success) {
                    return sendError(res, 400, 'REAUTH_NOT_ALLOWED', response.message);
                }

                sendSuccess(res, {
                    reauth_token: response.reauthToken,
                    expires_in_seconds: response.expiresInSeconds,
                    allowed_methods: response.allowedMethods,
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

/**
 * POST /v1/auth/reauth/verify
 * Verify re-authentication with PIN/OTP/Password (AC8)
 */
router.post('/reauth/verify', async (req, res, next) => {
    try {
        const { action, reauth_token, method, credential } = req.body;
        const token = req.headers.authorization?.replace('Bearer ', '');
        const traceId = req.headers['x-trace-id'] as string;

        if (!token) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authorization token is required');
        }

        if (!action || !reauth_token || !method || !credential) {
            return sendError(res, 400, 'VALIDATION_ERROR',
                'Action, reauth_token, method, and credential are required');
        }

        const userId = (req as any).user?.userId;
        const phone = (req as any).user?.phone;

        if (!userId) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
        }

        logger.info({ userId, action, method }, 'Re-auth verify request received');

        authClient.ValidateReauth(
            {
                userId: String(userId),
                action,
                reauthToken: reauth_token,
                method,
                credential,
                phone: phone || '',
            },
            createMetadata(traceId),
            (err: any, response: any) => {
                if (err) return next(err);

                if (!response.success) {
                    return sendError(res, 401, response.error || 'REAUTH_FAILED', response.message);
                }

                sendSuccess(res, {
                    success: true,
                    message: 'Re-authentication successful',
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

export default router;

