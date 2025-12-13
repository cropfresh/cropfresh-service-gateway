/**
 * Agent Routes - Story 2.6
 * 
 * REST endpoints for Agent mobile app:
 * - POST /v1/agent/login - First-time login with temp PIN (AC4)
 * - POST /v1/agent/set-pin - Set new permanent PIN (AC4)
 * - POST /v1/agent/complete-training - Mark training done (AC5)
 * - GET /v1/agent/dashboard - Get dashboard data (AC6)
 * 
 * NO self-registration endpoint (AC8)
 * 
 * @module routes/v1/agent
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authClient } from '../../grpc/clients';

const router = Router();

// Zod validation schemas
const loginSchema = z.object({
    mobile_number: z.string().regex(/^\+91\d{10}$/, 'Invalid mobile format'),
    pin: z.string().length(6, 'PIN must be 6 digits'),
});

const setPinSchema = z.object({
    temporary_token: z.string().min(1, 'Token is required'),
    new_pin: z.string().length(4, 'PIN must be 4 digits'),
    confirm_pin: z.string().length(4, 'Confirm PIN must be 4 digits'),
});

/**
 * POST /v1/agent/login - First-time agent login with temporary PIN
 * Returns temporary token for PIN change flow
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: parsed.error.issues[0].message,
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.AgentFirstLogin({
                mobile_number: parsed.data.mobile_number,
                pin: parsed.data.pin,
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            // Map error codes to HTTP status
            const status = response.message.includes('expired') ? 401 : 400;
            return res.status(status).json({
                success: false,
                error: response.message.includes('expired') ? 'PIN_EXPIRED' : 'INVALID_PIN',
                message: response.message,
            });
        }

        res.json({
            success: true,
            message: response.message,
            data: {
                requires_pin_change: response.requires_pin_change,
                temporary_token: response.temporary_token,
                agent_name: response.agent_name,
            },
        });
    } catch (error: any) {
        console.error('Agent login error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Login failed. Please try again.',
        });
    }
});

/**
 * POST /v1/agent/set-pin - Set new permanent PIN after first login
 * Returns JWT tokens for app access
 */
router.post('/set-pin', async (req: Request, res: Response) => {
    try {
        const parsed = setPinSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: parsed.error.issues[0].message,
            });
        }

        // Basic PIN match validation at gateway level
        if (parsed.data.new_pin !== parsed.data.confirm_pin) {
            return res.status(400).json({
                success: false,
                error: 'PIN_MISMATCH',
                message: 'PINs do not match. Try again.',
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.AgentSetPin({
                temporary_token: parsed.data.temporary_token,
                new_pin: parsed.data.new_pin,
                confirm_pin: parsed.data.confirm_pin,
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(400).json({
                success: false,
                error: 'SET_PIN_FAILED',
                message: response.message,
            });
        }

        res.json({
            success: true,
            message: response.message,
            data: {
                access_token: response.access_token,
                refresh_token: response.refresh_token,
                requires_training: response.requires_training,
            },
        });
    } catch (error: any) {
        console.error('Set PIN error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to set PIN. Please try again.',
        });
    }
});

/**
 * POST /v1/agent/complete-training - Mark onboarding training as complete
 * Transitions status from TRAINING to ACTIVE
 */
router.post('/complete-training', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.CompleteAgentTraining({
                user_id: userId.toString(),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(400).json({
                success: false,
                error: 'TRAINING_FAILED',
                message: response.message,
            });
        }

        res.json({
            success: true,
            message: response.message,
            data: {
                status: response.status,
                dashboard_unlocked: response.dashboard_unlocked,
            },
        });
    } catch (error: any) {
        console.error('Complete training error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to complete training.',
        });
    }
});

/**
 * GET /v1/agent/dashboard - Get agent dashboard data
 * Returns zone info, pending tasks, and performance metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.GetAgentDashboard({
                user_id: userId.toString(),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Agent profile not found',
            });
        }

        res.json({
            success: true,
            data: {
                agent_name: response.agent_name,
                pending_tasks: response.pending_tasks,
                zone: {
                    name: response.zone_name,
                    villages: response.villages || [],
                    farmer_count: response.farmer_count,
                },
                performance: {
                    verifications_today: response.verifications_today,
                    accuracy_percent: response.accuracy_percent,
                },
            },
        });
    } catch (error: any) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to load dashboard.',
        });
    }
});

export default router;
