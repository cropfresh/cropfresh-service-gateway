/**
 * Notification Routes - Story 3.8
 * 
 * REST endpoints for farmer notifications:
 * - GET /notifications - Paginated notification list (AC: 3)
 * - GET /notifications/unread-count - Unread count (AC: 3)
 * - POST /notifications/:id/read - Mark as read (AC: 3)
 * - POST /notifications/read-all - Mark all as read (AC: 3)
 * - DELETE /notifications/:id - Delete notification (AC: 3)
 * - GET /notifications/preferences - Get preferences (AC: 4)
 * - PUT /notifications/preferences - Update preferences (AC: 4)
 * - POST /device-token - Register FCM token (AC: 7)
 * - DELETE /device-token - Unregister FCM token (AC: 7)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const getNotificationsQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    unread_only: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
    type: z.string().optional(),
});

const markReadParamsSchema = z.object({
    id: z.string().min(1),
});

const preferencesSchema = z.object({
    sms_enabled: z.boolean().optional(),
    push_enabled: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quiet_hours_enabled: z.boolean().optional(),
    notification_level: z.enum(['ALL', 'CRITICAL', 'MUTE']).optional(),
    order_updates: z.boolean().optional(),
    payment_alerts: z.boolean().optional(),
    educational_content: z.boolean().optional(),
});

const deviceTokenSchema = z.object({
    fcm_token: z.string().min(1),
    device_type: z.enum(['android', 'ios']).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

// Extract farmer ID from auth token (placeholder)
const extractFarmerId = (req: Request): string | null => {
    // In production, extract from JWT token
    const farmerId = req.headers['x-farmer-id'] || req.query.farmerId;
    return farmerId ? String(farmerId) : null;
};

// Zod validation middleware
const validate = <T extends z.ZodSchema>(schema: T, source: 'query' | 'body' | 'params' = 'query') => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = source === 'query' ? req.query : source === 'body' ? req.body : req.params;
            schema.parse(data);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.issues
                });
                return;
            }
            next(error);
        }
    };
};

// ============================================================================
// Notification List Endpoints (AC: 3)
// ============================================================================

/**
 * GET /v1/farmers/notifications
 * Returns paginated notification list.
 */
router.get('/', validate(getNotificationsQuerySchema), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const query = getNotificationsQuerySchema.parse(req.query);

        // TODO: Call Notification Service gRPC GetFarmerNotifications
        // For now, return mock data
        const mockNotifications = {
            notifications: [
                {
                    id: 'notif-001',
                    type: 'ORDER_MATCHED',
                    title: '🎉 Buyer Found!',
                    body: 'Accept match for 50kg Tomato at ₹1,800',
                    deeplink: '/match-details/ORD-001',
                    metadata: { order_id: 'ORD-001', crop_name: 'Tomato' },
                    is_read: false,
                    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
                },
                {
                    id: 'notif-002',
                    type: 'PAYMENT_RECEIVED',
                    title: '💰 Payment Received',
                    body: '₹2,500 for Potato. Check your bank.',
                    deeplink: '/earnings',
                    metadata: { amount: '2500', upi_id: 'XXXX1234' },
                    is_read: false,
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                },
                {
                    id: 'notif-003',
                    type: 'HAULER_EN_ROUTE',
                    title: '🚛 Hauler On The Way',
                    body: 'Ramesh arriving in 15 minutes',
                    deeplink: '/orders/ORD-002',
                    metadata: { hauler_name: 'Ramesh' },
                    is_read: true,
                    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                },
            ],
            unread_count: 2,
            pagination: {
                page: query.page,
                limit: query.limit,
                total: 15,
                has_more: true
            }
        };

        res.json(mockNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * GET /v1/farmers/notifications/unread-count
 * Returns unread notification count for badge.
 */
router.get('/unread-count', async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Notification Service gRPC GetUnreadCount
        const mockCount = { count: 5 };

        res.json(mockCount);
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// ============================================================================
// Mark as Read Endpoints (AC: 3)
// ============================================================================

/**
 * POST /v1/farmers/notifications/:id/read
 * Marks a single notification as read.
 */
router.post('/:id/read', validate(markReadParamsSchema, 'params'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Notification Service gRPC MarkNotificationRead
        res.json({ success: true, notification_id: id });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

/**
 * POST /v1/farmers/notifications/read-all
 * Marks all notifications as read.
 */
router.post('/read-all', async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Notification Service gRPC MarkAllNotificationsRead
        res.json({ success: true, updated_count: 5 });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// ============================================================================
// Delete Notification Endpoint
// ============================================================================

/**
 * DELETE /v1/farmers/notifications/:id
 * Deletes a notification.
 */
router.delete('/:id', validate(markReadParamsSchema, 'params'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);
        const { id } = req.params;

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Notification Service gRPC DeleteNotification
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// ============================================================================
// Preferences Endpoints (AC: 4)
// ============================================================================

/**
 * GET /v1/farmers/notifications/preferences
 * Returns notification preferences.
 */
router.get('/preferences', async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        // TODO: Call Notification Service gRPC GetNotificationPreferences
        const mockPreferences = {
            farmer_id: farmerId,
            sms_enabled: true,
            push_enabled: true,
            quiet_hours_start: '22:00',
            quiet_hours_end: '06:00',
            quiet_hours_enabled: true,
            notification_level: 'ALL',
            order_updates: true,
            payment_alerts: true,
            educational_content: true
        };

        res.json(mockPreferences);
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

/**
 * PUT /v1/farmers/notifications/preferences
 * Updates notification preferences.
 */
router.put('/preferences', validate(preferencesSchema, 'body'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const preferences = preferencesSchema.parse(req.body);

        // TODO: Call Notification Service gRPC UpdateNotificationPreferences
        const updatedPreferences = {
            farmer_id: farmerId,
            sms_enabled: preferences.sms_enabled ?? true,
            push_enabled: preferences.push_enabled ?? true,
            quiet_hours_start: preferences.quiet_hours_start ?? '22:00',
            quiet_hours_end: preferences.quiet_hours_end ?? '06:00',
            quiet_hours_enabled: preferences.quiet_hours_enabled ?? true,
            notification_level: preferences.notification_level ?? 'ALL',
            order_updates: preferences.order_updates ?? true,
            payment_alerts: preferences.payment_alerts ?? true,
            educational_content: preferences.educational_content ?? true
        };

        res.json(updatedPreferences);
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// ============================================================================
// Device Token Endpoints (AC: 7)
// ============================================================================

/**
 * POST /v1/farmers/device-token
 * Registers FCM device token.
 */
router.post('/device-token', validate(deviceTokenSchema, 'body'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const { fcm_token, device_type } = deviceTokenSchema.parse(req.body);

        // TODO: Call Notification Service gRPC RegisterDeviceToken
        res.json({
            success: true,
            token_id: `token-${Date.now()}`
        });
    } catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({ error: 'Failed to register device token' });
    }
});

/**
 * DELETE /v1/farmers/device-token
 * Unregisters FCM device token (logout).
 */
router.delete('/device-token', validate(deviceTokenSchema, 'body'), async (req: Request, res: Response) => {
    try {
        const farmerId = extractFarmerId(req);

        if (!farmerId) {
            res.status(401).json({ error: 'Farmer ID required' });
            return;
        }

        const { fcm_token } = deviceTokenSchema.parse(req.body);

        // TODO: Call Notification Service gRPC UnregisterDeviceToken
        res.json({ success: true });
    } catch (error) {
        console.error('Error unregistering device token:', error);
        res.status(500).json({ error: 'Failed to unregister device token' });
    }
});

export default router;
