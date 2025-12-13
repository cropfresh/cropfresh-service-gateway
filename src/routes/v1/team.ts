import express, { Router, Request, Response } from 'express';
import { authClient } from '../../grpc/clients';

const router: Router = express.Router();

/**
 * Story 2.4 - Team Management REST Endpoints
 * Gateway routes proxying to Auth Service gRPC methods
 */

// Helper to extract user from JWT
function getUserFromRequest(req: Request): { userId: number; buyerOrgId: number } | null {
    // In production, extract from verified JWT token
    // For now, use headers for development
    const userId = req.headers['x-user-id'] as string;
    const buyerOrgId = req.headers['x-buyer-org-id'] as string;

    if (!userId || !buyerOrgId) return null;
    return { userId: parseInt(userId, 10), buyerOrgId: parseInt(buyerOrgId, 10) };
}

/**
 * POST /v1/buyer/team/invite
 * Invite a new team member (AC2, AC3)
 */
router.post('/invite', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { email, mobile_number, role, note } = req.body;

        if (!email || !mobile_number || !role) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Email, mobile_number, and role are required',
            });
        }

        authClient.InviteTeamMember({
            buyer_org_id: user.buyerOrgId,
            email,
            mobile_number,
            role,
            note: note || '',
            invited_by_user_id: user.userId,
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

/**
 * POST /v1/buyer/team/accept-invite
 * Accept a team invitation (AC4, AC9)
 */
router.post('/accept-invite', async (req: Request, res: Response) => {
    try {
        const { token, full_name, password } = req.body;

        if (!token || !full_name || !password) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Token, full_name, and password are required',
            });
        }

        authClient.AcceptTeamInvitation({
            token,
            full_name,
            password,
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

/**
 * GET /v1/buyer/team
 * List team members with filters (AC1, AC5)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { page = '1', limit = '10', role, status, search } = req.query;

        authClient.ListTeamMembers({
            buyer_org_id: user.buyerOrgId,
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10),
            role_filter: role as string || '',
            status_filter: status as string || '',
            search: search as string || '',
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * PATCH /v1/buyer/team/:memberId/role
 * Update team member role (AC6)
 */
router.patch('/:memberId/role', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { memberId } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Role is required',
            });
        }

        authClient.UpdateTeamMemberRole({
            buyer_org_id: user.buyerOrgId,
            member_id: memberId,
            new_role: role,
            changed_by_user_id: user.userId,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /v1/buyer/team/:memberId/deactivate
 * Deactivate team member (AC7)
 */
router.post('/:memberId/deactivate', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { memberId } = req.params;

        authClient.DeactivateTeamMember({
            buyer_org_id: user.buyerOrgId,
            member_id: memberId,
            deactivated_by_user_id: user.userId,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, message: 'Member deactivated', data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * DELETE /v1/buyer/team/:memberId
 * Delete team member (AC7)
 */
router.delete('/:memberId', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { memberId } = req.params;

        authClient.DeleteTeamMember({
            buyer_org_id: user.buyerOrgId,
            member_id: memberId,
            deleted_by_user_id: user.userId,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, message: 'Member deleted', data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /v1/buyer/team/invite/:invitationId/resend
 * Resend invitation (AC9)
 */
router.post('/invite/:invitationId/resend', async (req: Request, res: Response) => {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const { invitationId } = req.params;

        authClient.ResendTeamInvitation({
            buyer_org_id: user.buyerOrgId,
            invitation_id: invitationId,
            resent_by_user_id: user.userId,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, message: 'Invitation resent', data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * GET /v1/buyer/team/invitation/:token
 * Validate invitation token (for accept-invite screen)
 */
router.get('/invitation/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        authClient.ValidateInvitationToken({
            token,
        }, (error: any, response: any) => {
            if (error) {
                const errorDetails = parseGrpcError(error);
                return res.status(errorDetails.status).json(errorDetails.body);
            }
            res.json({ success: true, data: response });
        });
    } catch (error: any) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * Parse gRPC error into HTTP response
 */
function parseGrpcError(error: any): { status: number; body: Record<string, any> } {
    const grpcCode = error.code;
    let httpStatus = 500;

    // Map gRPC codes to HTTP status codes
    switch (grpcCode) {
        case 3: // INVALID_ARGUMENT
            httpStatus = 400;
            break;
        case 5: // NOT_FOUND
            httpStatus = 404;
            break;
        case 6: // ALREADY_EXISTS
            httpStatus = 409;
            break;
        case 7: // PERMISSION_DENIED
            httpStatus = 403;
            break;
        case 16: // UNAUTHENTICATED
            httpStatus = 401;
            break;
        default:
            httpStatus = 500;
    }

    let body: Record<string, any>;
    try {
        body = JSON.parse(error.details);
    } catch {
        body = { error: 'ERROR', message: error.details || 'Unknown error' };
    }

    return { status: httpStatus, body };
}

export default router;
