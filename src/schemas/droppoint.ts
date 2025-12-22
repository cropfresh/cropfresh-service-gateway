/**
 * Drop Point Zod Schemas (Story 3.4 - Task 3.4)
 * 
 * SITUATION: REST endpoints need request/response validation
 * TASK: Define Zod schemas for drop point operations
 * ACTION: Create validation schemas matching gRPC message types
 * RESULT: Type-safe validation for REST layer
 * 
 * @module droppoint-schemas
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

/** Path parameter: listing ID */
export const listingIdParamSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
});

/** POST /assign-droppoint request body */
export const assignDropPointSchema = z.object({
    farmer_location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
    }),
    crop_type: z.string().min(1).max(50),
    quantity_kg: z.number().positive().max(10000),
    preferred_date: z.string().datetime().optional(),
});

/** GET /droppoints/nearby query params */
export const nearbyDropPointsQuerySchema = z.object({
    lat: z.string().regex(/^-?\d+\.?\d*$/).transform(Number),
    lng: z.string().regex(/^-?\d+\.?\d*$/).transform(Number),
    radius_km: z.string().regex(/^\d+\.?\d*$/).transform(Number).optional().default(() => 20),
});

// ============================================================================
// Response Types (for documentation, runtime is validated by gRPC)
// ============================================================================

export const geoLocationSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});

export const dropPointSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    address: z.string(),
    location: geoLocationSchema,
    distance_km: z.number(),
    is_open: z.boolean().optional(),
});

export const pickupWindowSchema = z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
});

export const dropPointAssignmentResponseSchema = z.object({
    assignment_id: z.string(),
    listing_id: z.number(),
    drop_point: dropPointSchema,
    pickup_window: pickupWindowSchema,
    crates_needed: z.number(),
    status: z.string(),
    listing_status: z.string(),
});

export const nearbyDropPointsResponseSchema = z.object({
    drop_points: z.array(dropPointSchema),
});

// ============================================================================
// Export types
// ============================================================================

export type AssignDropPointInput = z.infer<typeof assignDropPointSchema>;
export type NearbyDropPointsQuery = z.infer<typeof nearbyDropPointsQuerySchema>;
export type DropPointAssignmentResponse = z.infer<typeof dropPointAssignmentResponseSchema>;
