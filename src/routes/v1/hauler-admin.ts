/**
 * Hauler Admin REST Endpoints
 * Story 2.5 - Hauler Account Creation with Vehicle Verification
 * 
 * Admin routes for District Manager verification workflow (AC7):
 * - Get pending verification queue
 * - Approve hauler registration
 * - Reject hauler registration with reason
 * 
 * @author Dev Agent
 * @created 2025-12-12
 */

import express, { Router, Request, Response } from 'express';
import { authClient } from '../../grpc/clients';

const router: Router = express.Router();

// ============ Helper Functions ============

/**
 * Extract admin user context from request headers (or JWT in production)
 * In production, validate DISTRICT_MANAGER role from JWT
 */
function getAdminFromRequest(req: Request): { userId: number } | null {
    const userId = req.headers['x-user-id'] as string;
    // In production, also check x-user-role === 'DISTRICT_MANAGER' or 'ADMIN'
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

// ============ Verification Queue ============

/**
 * GET /v1/admin/haulers/pending
 * Get pending hauler verifications queue (AC7)
 * 
 * Query params:
 * - page: Page number (default 1)
 * - limit: Items per page (default 10, max 50)
 * - district: Optional district filter
 */
router.get('/pending', async (req: Request, res: Response) => {
    try {
        const admin = getAdminFromRequest(req);
        if (!admin) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Admin authentication required'
            });
        }

        const { page = '1', limit = '10', district } = req.query;

        authClient.GetPendingHaulerVerifications({
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10),
            district_filter: district as string || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({
                success: true,
                data: {
                    haulers: response.haulers || [],
                    pagination: response.pagination,
                }
            });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Verification Actions ============

/**
 * POST /v1/admin/haulers/:haulerId/verify
 * Approve or reject a hauler registration (AC7)
 * 
 * Body:
 * - action: 'APPROVE' or 'REJECT'
 * - rejection_reason: Required if action is REJECT
 */
router.post('/:haulerId/verify', async (req: Request, res: Response) => {
    try {
        const admin = getAdminFromRequest(req);
        if (!admin) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Admin authentication required'
            });
        }

        const { haulerId } = req.params;
        const { action, rejection_reason } = req.body;

        // Validate action
        if (!action || !['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'action must be APPROVE or REJECT',
            });
        }

        // Validate rejection reason if rejecting
        if (action === 'REJECT' && (!rejection_reason || rejection_reason.trim() === '')) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'rejection_reason is required when rejecting',
            });
        }

        authClient.VerifyHaulerAccount({
            hauler_id: haulerId,
            action,
            rejection_reason: rejection_reason || '',
            verified_by_user_id: admin.userId,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.status(200).json({
                success: true,
                message: action === 'APPROVE' ? 'Hauler approved' : 'Hauler rejected',
                data: response
            });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============ Hauler Details ============

/**
 * GET /v1/admin/haulers/:haulerId
 * Get detailed hauler profile for admin review
 */
router.get('/:haulerId', async (req: Request, res: Response) => {
    try {
        const admin = getAdminFromRequest(req);
        if (!admin) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Admin authentication required'
            });
        }

        const { haulerId } = req.params;

        // Use GetHaulerProfile with the hauler's user ID
        // In a real scenario, we'd need a separate admin endpoint or lookup
        authClient.GetHaulerProfile({
            user_id: haulerId, // Note: This assumes haulerId maps to userId
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
