/**
 * Photo Schemas - Zod Validation
 * 
 * SITUATION: REST endpoints need request/response validation
 * TASK: Define Zod schemas for photo operations
 * ACTION: Type-safe validation with clear error messages
 * RESULT: Validated requests before hitting service layer
 * 
 * @module PhotoSchemas
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Schema for presigned URL request
 */
export const presignRequestSchema = z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
});

/**
 * Schema for upload confirmation
 */
export const confirmUploadSchema = z.object({
    fileSizeBytes: z.number().int().positive().optional(),
    originalSizeBytes: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    deviceModel: z.string().max(100).optional(),
});

/**
 * Schema for photo validation request
 */
export const validatePhotoSchema = z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
});

// ============================================================================
// Param Schemas
// ============================================================================

export const listingIdParamSchema = z.object({
    listingId: z.string().regex(/^\d+$/).transform(Number),
});

export const photoIdParamSchema = z.object({
    listingId: z.string().regex(/^\d+$/).transform(Number),
    photoId: z.string().regex(/^\d+$/).transform(Number),
});

// ============================================================================
// Response Types
// ============================================================================

export interface PresignedUrlResponse {
    photoId: number;
    presignedUrl: string;
    expiresIn: number;
}

export interface PhotoResponse {
    id: number;
    listingId: number;
    photoUrl: string;
    thumbnailUrl: string | null;
    originalFilename: string | null;
    contentType: string;
    fileSizeBytes: number | null;
    width: number | null;
    height: number | null;
    qualityScore: number | null;
    validationStatus: string;
    validationMessage: string | null;
    isPrimary: boolean;
    createdAt: string;
}

export interface ValidationResponse {
    isValid: boolean;
    qualityScore: number;
    grade: string;
    issues: Array<{
        type: string;
        message: string;
        suggestion: string;
    }>;
}

// ============================================================================
// Type Exports
// ============================================================================

export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type ConfirmUploadRequest = z.infer<typeof confirmUploadSchema>;
export type ValidatePhotoRequest = z.infer<typeof validatePhotoSchema>;
