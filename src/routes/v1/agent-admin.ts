/**
 * Agent Admin Routes - Story 2.6
 * 
 * REST endpoints for District Manager operations:
 * - POST /v1/admin/agents - Create field agent (AC2, AC3)
 * - GET /v1/admin/agents - List agents with filters (AC1)
 * - GET /v1/admin/agents/:id - Get agent details (AC7)
 * - PUT /v1/admin/agents/:id/zone - Reassign zone (AC7)
 * - POST /v1/admin/agents/:id/deactivate - Deactivate agent (AC7)
 * - GET /v1/admin/zones - Get zones for dropdown
 * 
 * @module routes/v1/agent-admin
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authClient } from '../../grpc/clients';

const router = Router();

// Zod validation schemas
const createAgentSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    mobile_number: z.string().regex(/^\+91\d{10}$/, 'Invalid Indian mobile format (+91XXXXXXXXXX)'),
    zone_id: z.string().min(1, 'Zone is required'),
    start_date: z.string().optional(),
    employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR']),
});

const reassignZoneSchema = z.object({
    new_zone_id: z.string().min(1, 'New zone is required'),
    effective_date: z.string().optional(),
});

const deactivateSchema = z.object({
    reason: z.enum(['RESIGNED', 'TERMINATED', 'TRANSFERRED', 'LEAVE']),
});

/**
 * POST /v1/admin/agents - Create a new field agent
 * Requires: DISTRICT_MANAGER role
 */
router.post('/agents', async (req: Request, res: Response) => {
    try {
        // Validate request body
        const parsed = createAgentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: parsed.error.issues[0].message,
            });
        }

        // Get user from auth token (middleware should populate this)
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.CreateFieldAgent({
                ...parsed.data,
                created_by_user_id: parseInt(userId),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(400).json({
                success: false,
                error: 'CREATE_FAILED',
                message: response.message,
            });
        }

        res.status(201).json({
            success: true,
            message: response.message,
            data: {
                agent_id: response.agent_id,
                employee_id: response.employee_id,
                status: response.status,
                sms_sent: response.sms_sent,
            },
        });
    } catch (error: any) {
        console.error('Create agent error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to create agent',
        });
    }
});

/**
 * GET /v1/admin/agents - List agents with filters
 */
router.get('/agents', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        const { status, zone_id, search, page = '1', limit = '20' } = req.query;

        const response = await new Promise<any>((resolve, reject) => {
            authClient.ListFieldAgents({
                status_filter: status as string,
                zone_id: zone_id as string,
                search: search as string,
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                district_manager_id: parseInt(userId),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        res.json({
            success: true,
            data: {
                agents: response.agents || [],
                ...response.pagination,
            },
        });
    } catch (error: any) {
        console.error('List agents error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to list agents',
        });
    }
});

/**
 * GET /v1/admin/agents/:id - Get agent details
 */
router.get('/agents/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const response = await new Promise<any>((resolve, reject) => {
            authClient.GetAgentDetails({ agent_id: id }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success || !response.agent) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Agent not found',
            });
        }

        res.json({
            success: true,
            data: response.agent,
        });
    } catch (error: any) {
        console.error('Get agent error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to get agent',
        });
    }
});

/**
 * PUT /v1/admin/agents/:id/zone - Reassign agent to new zone
 */
router.put('/agents/:id/zone', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        const parsed = reassignZoneSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: parsed.error.issues[0].message,
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.ReassignAgentZone({
                agent_id: id,
                new_zone_id: parsed.data.new_zone_id,
                effective_date: parsed.data.effective_date,
                assigned_by_user_id: parseInt(userId),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(400).json({
                success: false,
                error: 'REASSIGN_FAILED',
                message: response.message,
            });
        }

        res.json({
            success: true,
            message: response.message,
        });
    } catch (error: any) {
        console.error('Reassign zone error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to reassign zone',
        });
    }
});

/**
 * POST /v1/admin/agents/:id/deactivate - Deactivate agent
 */
router.post('/agents/:id/deactivate', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        const parsed = deactivateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: parsed.error.issues[0].message,
            });
        }

        const response = await new Promise<any>((resolve, reject) => {
            authClient.DeactivateAgent({
                agent_id: id,
                reason: parsed.data.reason,
                deactivated_by_user_id: parseInt(userId),
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!response.success) {
            return res.status(400).json({
                success: false,
                error: 'DEACTIVATE_FAILED',
                message: response.message,
            });
        }

        res.json({
            success: true,
            message: response.message,
            data: {
                status: response.new_status,
                sms_sent: response.sms_sent,
            },
        });
    } catch (error: any) {
        console.error('Deactivate agent error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to deactivate agent',
        });
    }
});

/**
 * GET /v1/admin/zones - Get zones for dropdown
 */
router.get('/zones', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { parent_zone_id } = req.query;

        const response = await new Promise<any>((resolve, reject) => {
            authClient.GetZones({
                district_manager_id: userId ? parseInt(userId) : 0,
                parent_zone_id: parent_zone_id as string,
            }, (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        res.json({
            success: true,
            data: {
                zones: response.zones || [],
            },
        });
    } catch (error: any) {
        console.error('Get zones error:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || 'Failed to get zones',
        });
    }
});

export default router;
