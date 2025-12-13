/**
 * Hauler Registration REST Endpoints
 * Story 2.5 - Hauler Account Creation with Vehicle Verification
 * 
 * Gateway routes proxying to Auth Service gRPC methods for:
 * - 4-step registration flow (AC1-AC5)
 * - Registration submission (AC6)
 * - Admin verification (AC7)
 * - Vehicle eligibility lookup (AC8)
 * 
 * @author Dev Agent
 * @created 2025-12-12
 */

import express, { Router, Request, Response } from 'express';
import { authClient } from '../../grpc/clients';

const router: Router = express.Router();

// ============ Helper Functions ============

/**
 * Extract user context from request headers (or JWT in production)
 */
function getUserFromRequest(req: Request): { userId: number } | null {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return null;
    return { userId: parseInt(userId, 10) };
}

/**
 * Parse gRPC error into HTTP response
 */
function parseGrpcError(error: any): { status: number; body: Record<string, any> } {
    const grpcCode = error.code;
    let httpStatus = 500;

    switch (grpcCode) {
        case 3: httpStatus = 400; break; // INVALID_ARGUMENT
        case 5: httpStatus = 404; break; // NOT_FOUND
        case 6: httpStatus = 409; break; // ALREADY_EXISTS
        case 7: httpStatus = 403; break; // PERMISSION_DENIED
        case 9: httpStatus = 400; break; // FAILED_PRECONDITION
        case 16: httpStatus = 401; break; // UNAUTHENTICATED
        default: httpStatus = 500;
    }

    let body: Record<string, any>;
    try {
        body = JSON.parse(error.details);
    } catch {
        body = { error: 'ERROR', message: error.details || 'Unknown error' };
    }

    return { status: httpStatus, body };
}

// ============ Step 1: Personal Information ============

/**
 * POST /v1/hauler/register/step1
 * Initiate registration with personal info, sends OTP (AC2)
 */
router.post('/step1', async (req: Request, res: Response) => {
    try {
        const { full_name, mobile_number, alternate_phone } = req.body;

        if (!full_name || !mobile_number) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'full_name and mobile_number are required',
            });
        }

        authClient.HaulerRegisterStep1({
            full_name,
            mobile_number,
            alternate_phone: alternate_phone || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /v1/hauler/register/step1/verify-otp
 * Verify OTP and create user account
 */
router.post('/step1/verify-otp', async (req: Request, res: Response) => {
    try {
        const { registration_token, mobile_number, otp } = req.body;

        if (!registration_token || !mobile_number || !otp) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'registration_token, mobile_number, and otp are required',
            });
        }

        authClient.HaulerVerifyOtp({
            registration_token,
            mobile_number,
            otp,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Step 2: Vehicle Information ============

/**
 * POST /v1/hauler/register/step2
 * Add vehicle information and photos (AC3)
 * Note: For multipart/form-data with file uploads, add multer middleware
 */
router.post('/step2', async (req: Request, res: Response) => {
    try {
        const {
            registration_token,
            vehicle_type,
            vehicle_number,
            payload_capacity_kg,
            photo_front_url,
            photo_side_url,
            photo_other_urls,
        } = req.body;

        if (!registration_token || !vehicle_type || !vehicle_number) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'registration_token, vehicle_type, and vehicle_number are required',
            });
        }

        authClient.HaulerAddVehicleInfo({
            registration_token,
            vehicle_type,
            vehicle_number,
            payload_capacity_kg: payload_capacity_kg || 0,
            photo_front_url: photo_front_url || '',
            photo_side_url: photo_side_url || '',
            photo_other_urls: photo_other_urls || [],
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Step 3: License Information ============

/**
 * POST /v1/hauler/register/step3
 * Add driving license information and photos (AC4)
 */
router.post('/step3', async (req: Request, res: Response) => {
    try {
        const {
            registration_token,
            dl_number,
            dl_expiry,
            dl_front_url,
            dl_back_url,
        } = req.body;

        if (!registration_token || !dl_number || !dl_expiry) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'registration_token, dl_number, and dl_expiry are required',
            });
        }

        authClient.HaulerAddLicenseInfo({
            registration_token,
            dl_number,
            dl_expiry,
            dl_front_url: dl_front_url || '',
            dl_back_url: dl_back_url || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Step 4: Payment Information ============

/**
 * POST /v1/hauler/register/step4
 * Add payment details with UPI verification (AC5)
 */
router.post('/step4', async (req: Request, res: Response) => {
    try {
        const {
            registration_token,
            upi_id,
            bank_account,
            ifsc_code,
        } = req.body;

        if (!registration_token || !upi_id) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'registration_token and upi_id are required',
            });
        }

        authClient.HaulerAddPaymentInfo({
            registration_token,
            upi_id,
            bank_account: bank_account || '',
            ifsc_code: ifsc_code || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Submit Registration ============

/**
 * POST /v1/hauler/register/submit
 * Submit completed registration for verification (AC6)
 */
router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { registration_token } = req.body;

        if (!registration_token) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'registration_token is required',
            });
        }

        authClient.HaulerSubmitRegistration({
            registration_token,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(201).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Vehicle Eligibility ============

/**
 * GET /v1/hauler/register/eligibility
 * Get vehicle eligibility rules (AC8)
 */
router.get('/eligibility', async (req: Request, res: Response) => {
    try {
        const { vehicle_type } = req.query;

        authClient.GetVehicleEligibility({
            vehicle_type: vehicle_type as string || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Hauler Profile ============

/**
 * GET /v1/hauler/profile
 * Get current hauler's profile
 */
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        authClient.GetHaulerProfile({
            user_id: user.userId.toString(),
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

export default router;
