/**
 * Catalog gRPC Client - Promisified wrapper
 * 
 * Wraps the raw gRPC client with promisified methods
 * for listing and photo operations.
 * 
 * @module CatalogGrpcClient
 */

import { catalogClient } from './clients';

// ============================================================================
// Request/Response Types - Listings
// ============================================================================

interface CreateListingRequest {
    farmerId: number;
    cropId: number;
    quantityKg: number;
    unit?: string;
    displayQty?: number;
    entryMode: string;
    voiceText?: string;
    voiceLanguage?: string;
    qualityGrade?: string;
    harvestDate?: string;
}

interface GetListingRequest {
    id: number;
    farmerId: number;
}

interface ListFarmerListingsRequest {
    farmerId: number;
    status?: string;
    page?: number;
    pageSize?: number;
}

interface UpdateListingRequest {
    id: number;
    farmerId: number;
    quantityKg?: number;
    unit?: string;
    qualityGrade?: string;
    photoUrl?: string;
}

interface CancelListingRequest {
    id: number;
    farmerId: number;
}

interface ListingResponse {
    id: number;
    farmerId: number;
    cropId: number;
    cropName: string;
    quantityKg: number;
    unit: string;
    qualityGrade: string;
    aiGrade: string;
    photoUrl: string;
    entryMode: string;
    status: string;
    estimatedPrice: number;
    pricePerKg: number;
    createdAt: string;
}

interface ListingsResponse {
    listings: ListingResponse[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

interface StatusResponse {
    success: boolean;
    message: string;
}

// ============================================================================
// Request/Response Types - Photos
// ============================================================================

interface PresignedUrlRequest {
    farmerId: number;
    listingId: number;
    fileName: string;
    contentType: string;
}

interface PresignedUrlResponse {
    photoId: number;
    presignedUrl: string;
    s3Key: string;
    expiresIn: number;
}

interface ConfirmUploadRequest {
    farmerId: number;
    photoId: number;
    listingId: number;
    fileSizeBytes?: number;
    originalSizeBytes?: number;
    width?: number;
    height?: number;
    latitude?: number;
    longitude?: number;
    deviceModel?: string;
}

interface PhotoResponse {
    id: number;
    listingId: number;
    photoUrl: string;
    thumbnailUrl: string;
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
    width: number;
    height: number;
    qualityScore: number;
    validationStatus: string;
    validationMessage: string;
    isPrimary: boolean;
    createdAt: string;
}

interface GetPhotosRequest {
    farmerId: number;
    listingId: number;
}

interface PhotosResponse {
    photos: PhotoResponse[];
}

interface DeletePhotoRequest {
    farmerId: number;
    photoId: number;
    listingId: number;
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

/**
 * Catalog gRPC Client with promisified listing and photo methods
 */
export const catalogGrpcClient = {
    // =========================================================================
    // Listing Methods
    // =========================================================================

    /**
     * Create a new listing
     */
    createListing: (request: CreateListingRequest): Promise<ListingResponse> => {
        return promisify<CreateListingRequest, ListingResponse>(
            catalogClient.CreateListing,
            catalogClient
        )(request);
    },

    /**
     * Get listing by ID
     */
    getListing: (request: GetListingRequest): Promise<ListingResponse> => {
        return promisify<GetListingRequest, ListingResponse>(
            catalogClient.GetListing,
            catalogClient
        )(request);
    },

    /**
     * List farmer's listings
     */
    listFarmerListings: (request: ListFarmerListingsRequest): Promise<ListingsResponse> => {
        return promisify<ListFarmerListingsRequest, ListingsResponse>(
            catalogClient.ListFarmerListings,
            catalogClient
        )(request);
    },

    /**
     * Update listing
     */
    updateListing: (request: UpdateListingRequest): Promise<ListingResponse> => {
        return promisify<UpdateListingRequest, ListingResponse>(
            catalogClient.UpdateListing,
            catalogClient
        )(request);
    },

    /**
     * Cancel listing
     */
    cancelListing: (request: CancelListingRequest): Promise<StatusResponse> => {
        return promisify<CancelListingRequest, StatusResponse>(
            catalogClient.CancelListing,
            catalogClient
        )(request);
    },

    // =========================================================================
    // Photo Methods
    // =========================================================================

    /**
     * Get presigned URL for photo upload
     */
    getPresignedUrl: (request: PresignedUrlRequest): Promise<PresignedUrlResponse> => {
        return promisify<PresignedUrlRequest, PresignedUrlResponse>(
            catalogClient.GetPresignedUrl,
            catalogClient
        )(request);
    },

    /**
     * Confirm photo upload after client uploads to S3
     */
    confirmPhotoUpload: (request: ConfirmUploadRequest): Promise<PhotoResponse> => {
        return promisify<ConfirmUploadRequest, PhotoResponse>(
            catalogClient.ConfirmPhotoUpload,
            catalogClient
        )(request);
    },

    /**
     * Get all photos for a listing
     */
    getListingPhotos: (request: GetPhotosRequest): Promise<PhotosResponse> => {
        return promisify<GetPhotosRequest, PhotosResponse>(
            catalogClient.GetListingPhotos,
            catalogClient
        )(request);
    },

    /**
     * Delete a photo
     */
    deletePhoto: (request: DeletePhotoRequest): Promise<StatusResponse> => {
        return promisify<DeletePhotoRequest, StatusResponse>(
            catalogClient.DeletePhoto,
            catalogClient
        )(request);
    },

    // =========================================================================
    // Grading Methods (Story 3.3)
    // =========================================================================

    /**
     * Get AI grading results and DPLE price for a listing
     */
    gradeAndPrice: (request: { listingId: number; farmerId: number }): Promise<{
        grading: {
            grade: string;
            confidence: number;
            indicators: Array<{ type: string; score: number; label: string }>;
            explanation: string;
        };
        pricing: {
            marketRatePerKg: number;
            gradeAdjustment: string;
            gradeMultiplier: number;
            finalPricePerKg: number;
            totalEarnings: number;
            quantityKg: number;
            currency: string;
            paymentTerms: string;
        };
    }> => {
        return promisify<any, any>(
            catalogClient.GradeAndPrice,
            catalogClient
        )(request);
    },

    /**
     * Confirm listing after farmer accepts grading/price
     */
    confirmListing: (request: {
        listingId: number;
        farmerId: number;
        grading: {
            grade: string;
            confidence: number;
            indicators: Array<{ type: string; score: number; label: string }>;
            explanation: string;
        };
        pricing: {
            marketRatePerKg: number;
            gradeAdjustment: string;
            gradeMultiplier: number;
            finalPricePerKg: number;
            totalEarnings: number;
            quantityKg: number;
            currency: string;
            paymentTerms: string;
        };
    }): Promise<StatusResponse> => {
        return promisify<any, StatusResponse>(
            catalogClient.ConfirmListing,
            catalogClient
        )(request);
    },

    /**
     * Reject listing with reason
     */
    rejectListing: (request: {
        listingId: number;
        farmerId: number;
        reason: 'RETAKE_PHOTO' | 'CANCEL' | 'LIST_ANYWAY';
    }): Promise<StatusResponse & { nextStep?: string }> => {
        return promisify<any, StatusResponse & { nextStep?: string }>(
            catalogClient.RejectListing,
            catalogClient
        )(request);
    },
};
