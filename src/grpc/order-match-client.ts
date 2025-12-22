/**
 * Order Match gRPC Client - Story 3.5
 * 
 * Promisified wrapper for Match Service gRPC calls.
 * Handles communication with Order Service for match operations.
 */

import { matchClient } from './clients';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GetPendingMatchesRequest {
    farmer_id: string; // Proto expects string (but we might pass int as string)
    limit?: number;
    offset?: number;
}

export interface MatchData {
    id: string;
    listing_id: string;
    order_id?: string;
    quantity_matched: number;
    price_per_kg: number;
    total_amount: number;
    status: number | string; // Enum value or name
    expires_at: string;
    created_at: string;
    buyer_id: string;
    buyer_business_type: string;
    buyer_city: string;
    buyer_area?: string;
    delivery_date?: string;
}

export interface GetPendingMatchesResponse {
    matches: MatchData[];
    total_count: number;
}

export interface GetMatchByIdRequest {
    match_id: string;
}

export interface MatchResponse {
    match: MatchData;
}

export interface AcceptMatchRequest {
    match_id: string;
    is_partial: boolean;
    accepted_quantity?: number;
}

export interface AcceptMatchResponse {
    success: boolean;
    order_id: string;
    message: string;
}

export interface RejectMatchRequest {
    match_id: string;
    reason_code: string;
    other_reason_text?: string;
}

export interface RejectMatchResponse {
    success: boolean;
}

// ============================================================================
// Promisified Client
// ============================================================================

/**
 * Helper to promisify gRPC calls
 */
function promisify<TRequest, TResponse>(
    method: Function,
    client: any
): (request: TRequest) => Promise<TResponse> {
    return (request: TRequest) => {
        return new Promise((resolve, reject) => {
            // Check if method exists
            if (!method) {
                return reject(new Error('gRPC method not found. Check proto definition and client loading.'));
            }

            method.call(client, request, (error: any, response: TResponse) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    };
}

export const orderMatchGrpcClient = {
    /**
     * Get pending matches for a farmer
     */
    getPendingMatches: (formattedFarmerId: string, limit = 10, offset = 0): Promise<GetPendingMatchesResponse> => {
        return promisify<GetPendingMatchesRequest, GetPendingMatchesResponse>(
            matchClient.GetPendingMatches,
            matchClient
        )({
            farmer_id: formattedFarmerId,
            limit,
            offset
        });
    },

    /**
     * Get match details by ID
     */
    getMatchById: (matchId: string): Promise<MatchResponse> => {
        return promisify<GetMatchByIdRequest, MatchResponse>(
            matchClient.GetMatchById,
            matchClient
        )({
            match_id: matchId
        });
    },

    /**
     * Accept a match
     */
    acceptMatch: (matchId: string, isPartial: boolean, acceptedQuantity?: number): Promise<AcceptMatchResponse> => {
        return promisify<AcceptMatchRequest, AcceptMatchResponse>(
            matchClient.AcceptMatch,
            matchClient
        )({
            match_id: matchId,
            is_partial: isPartial,
            accepted_quantity: acceptedQuantity
        });
    },

    /**
     * Reject a match
     */
    rejectMatch: (matchId: string, reasonCode: string, otherReasonText?: string): Promise<RejectMatchResponse> => {
        return promisify<RejectMatchRequest, RejectMatchResponse>(
            matchClient.RejectMatch,
            matchClient
        )({
            match_id: matchId,
            reason_code: reasonCode,
            other_reason_text: otherReasonText
        });
    }
};
