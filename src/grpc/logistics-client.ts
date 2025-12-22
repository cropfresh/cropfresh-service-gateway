/**
 * Logistics gRPC Client (Story 3.4)
 * 
 * SITUATION: Gateway needs to call Logistics service for drop point operations
 * TASK: Create gRPC client for DropPointService
 * ACTION: Load proto, create client stub, wrap with promisified methods
 * RESULT: Type-safe async gRPC calls to logistics service
 * 
 * @module logistics-grpc-client
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const LOGISTICS_SERVICE_URL = process.env.LOGISTICS_SERVICE_URL || 'localhost:50051';
const PROTO_PATH = path.join(__dirname, '../protos/proto/logistics.proto');

// ============================================================================
// Proto Loading
// ============================================================================

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

// ============================================================================
// Client Initialization
// ============================================================================

const dropPointClient = new proto.cropfresh.logistics.DropPointService(
    LOGISTICS_SERVICE_URL,
    grpc.credentials.createInsecure()
);

// ============================================================================
// Promisified Client Methods
// ============================================================================

interface AssignDropPointRequest {
    listingId: number;
    farmerId: number;
    farmerLocation: {
        latitude: number;
        longitude: number;
    };
    cropType: string;
    quantityKg: number;
    preferredDate?: string;
}

interface GetDropPointAssignmentRequest {
    listingId: number;
}

interface GetNearbyDropPointsRequest {
    location: {
        latitude: number;
        longitude: number;
    };
    radiusKm: number;
}

function promisify<TReq, TRes>(
    method: (req: TReq, callback: (err: any, res: TRes) => void) => void
): (req: TReq) => Promise<TRes> {
    return (request: TReq) => {
        return new Promise((resolve, reject) => {
            method.call(dropPointClient, request, (error: any, response: TRes) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    };
}

// ============================================================================
// Exported Client
// ============================================================================

export const logisticsGrpcClient = {
    /**
     * Assign optimal drop point to a listing
     */
    assignDropPoint: promisify<AssignDropPointRequest, any>(dropPointClient.assignDropPoint),

    /**
     * Get existing drop point assignment
     */
    getDropPointAssignment: promisify<GetDropPointAssignmentRequest, any>(
        dropPointClient.getDropPointAssignment
    ),

    /**
     * Get nearby drop points
     */
    getNearbyDropPoints: promisify<GetNearbyDropPointsRequest, any>(
        dropPointClient.getNearbyDropPoints
    ),

    /**
     * Get upcoming deliveries for a farmer
     */
    getUpcomingDeliveries: promisify<{ farmerId: number }, any>(
        dropPointClient.getUpcomingDeliveries
    ),

    /**
     * Reassign to a different drop point
     */
    reassignDropPoint: promisify<{ listingId: number; newDropPointId: string; changeReason: string }, any>(
        dropPointClient.reassignDropPoint
    ),
};

logger.info({ url: LOGISTICS_SERVICE_URL }, 'Logistics gRPC client initialized');
