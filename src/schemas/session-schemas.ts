/**
 * Story 2.8: Session Management Zod Schemas
 *
 * Validation schemas for session management REST endpoints.
 */

import { z } from 'zod';

// Logout request (body optional, token comes from header)
export const logoutSchema = z.object({
    body: z.object({}).optional(),
});

// Revoke specific session
export const revokeSessionSchema = z.object({
    params: z.object({
        sessionId: z.string().regex(/^\d+$/, 'Session ID must be a number'),
    }),
});

// List active sessions (no body needed, user ID from JWT)
export const listSessionsSchema = z.object({
    query: z.object({}).optional(),
});

// Revoke all sessions (no body needed)
export const revokeAllSessionsSchema = z.object({
    body: z.object({}).optional(),
});

// Critical action enum for validation
const criticalActionEnum = z.enum([
    'CHANGE_UPI_ID',
    'CHANGE_BANK_ACCOUNT',
    'ADD_TEAM_MEMBER',
    'AUTHORIZE_LARGE_PAYMENT',
    'DELETE_ACCOUNT',
]);

// Initiate re-authentication
export const initiateReauthSchema = z.object({
    body: z.object({
        action: criticalActionEnum,
    }),
});

// Validate re-authentication
export const validateReauthSchema = z.object({
    body: z.object({
        action: criticalActionEnum,
        reauth_token: z.string().min(1, 'Re-auth token is required'),
        method: z.enum(['PIN', 'OTP', 'PASSWORD']),
        credential: z.string().min(1, 'Credential is required'),
    }),
});

// Request OTP for re-auth
export const requestReauthOtpSchema = z.object({
    body: z.object({
        action: criticalActionEnum,
    }),
});
