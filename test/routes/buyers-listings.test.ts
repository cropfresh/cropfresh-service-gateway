/**
 * Buyers Listings Route - Unit Tests (Story 4.2)
 * 
 * Tests REST endpoint GET /v1/buyers/listings/:id with mocked gRPC client.
 */

import request from 'supertest';
import express from 'express';
import listingsRouter from '../../src/routes/v1/buyers/listings';

// ============================================================================
// Mocks
// ============================================================================

// Mock gRPC client
const mockCatalogClient = {
    GetListingDetails: jest.fn(),
};

// Mock createMetadata
const mockCreateMetadata = jest.fn().mockReturnValue({});

jest.mock('../../src/grpc/clients', () => ({
    catalogClient: mockCatalogClient,
    createMetadata: mockCreateMetadata,
}));

// Mock logger
jest.mock('pino', () => () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

// Mock response handler
jest.mock('../../src/utils/response-handler', () => ({
    sendSuccess: (res: any, data: any) => res.json({ data, error: null }),
    sendError: (res: any, status: number, code: string, message: string, details?: any) =>
        res.status(status).json({ data: null, error: { code, message, details } }),
}));

// ============================================================================
// Test App Setup
// ============================================================================

const app = express();
app.use(express.json());

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => ({
    authMiddleware: (req: any, res: any, next: any) => {
        req.user = { id: 1, role: 'BUYER' };
        next();
    },
}));

app.use('/v1/buyers/listings', listingsRouter);

// ============================================================================
// Test Suite
// ============================================================================

describe('Buyers Listings Routes - Story 4.2', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --------------------------------------------------------------------------
    // GET /v1/buyers/listings/:id - Listing Details
    // --------------------------------------------------------------------------
    describe('GET /v1/buyers/listings/:id', () => {
        const mockListingDetailsResponse = {
            id: 1,
            cropType: 'Tomato',
            cropCategory: 'Vegetables',
            photos: [
                {
                    id: 1,
                    photoUrl: 'https://s3.example.com/farmer-photo.jpg',
                    thumbnailUrl: 'https://s3.example.com/farmer-thumb.jpg',
                    isPrimary: true,
                    validationStatus: 'VALID',
                    qualityScore: 0.85,
                },
            ],
            primaryPhotoUrl: 'https://s3.example.com/farmer-photo.jpg',
            qualityGrade: 'A',
            aiConfidence: 0.95,
            shelfLifeDays: 5,
            shelfLifeDisplay: '3-5 days',
            farmerZone: 'Kolar region',
            pricePerKg: 36,
            priceBreakdown: {
                basePrice: 30,
                qualityAdjustment: 3,
                logisticsCost: 2,
                platformFee: 1.5,
                finalPrice: 36.5,
            },
            quantityKg: 50,
            stockStatus: 'AVAILABLE',
            deliveryOptions: [
                { date: '2026-01-05T00:00:00Z', label: 'Today', isAvailable: true },
                { date: '2026-01-06T00:00:00Z', label: 'Tomorrow', isAvailable: true },
            ],
            digitalTwin: {
                harvestTimestamp: '2026-01-03T06:00:00Z',
                verificationStatus: 'VERIFIED',
                freshnessScore: 0.92,
                defectCount: 1,
                aiGradingDetails: {
                    grade: 'A',
                    confidence: 0.95,
                    gradedAt: '2026-01-03T08:00:00Z',
                },
            },
            createdAt: '2026-01-03T06:00:00Z',
            updatedAt: '2026-01-03T08:00:00Z',
        };

        it('Story 4.2: should return listing details with all AC fields', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe(1);
            expect(response.body.data.cropType).toBe('Tomato');
        });

        it('Story 4.2 AC1: should return photos with validation status', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.photos).toHaveLength(1);
            expect(response.body.data.photos[0].isPrimary).toBe(true);
            expect(response.body.data.photos[0].validationStatus).toBe('VALID');
            expect(response.body.data.primaryPhotoUrl).toBe('https://s3.example.com/farmer-photo.jpg');
        });

        it('Story 4.2 AC2: should return quality grade with confidence', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.qualityGrade).toBe('A');
            expect(response.body.data.aiConfidence).toBe(0.95);
        });

        it('Story 4.2 AC3: should return shelf life display', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.shelfLifeDays).toBe(5);
            expect(response.body.data.shelfLifeDisplay).toBe('3-5 days');
        });

        it('Story 4.2 AC4: should return farmer zone (anonymized)', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.farmerZone).toBe('Kolar region');
        });

        it('Story 4.2 AC5: should return AISP price breakdown', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.priceBreakdown).toBeDefined();
            expect(response.body.data.priceBreakdown.basePrice).toBe(30);
            expect(response.body.data.priceBreakdown.qualityAdjustment).toBe(3);
            expect(response.body.data.priceBreakdown.logisticsCost).toBe(2);
            expect(response.body.data.priceBreakdown.platformFee).toBe(1.5);
            expect(response.body.data.priceBreakdown.finalPrice).toBe(36.5);
        });

        it('Story 4.2 AC6: should return quantity with stock status', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.quantityKg).toBe(50);
            expect(response.body.data.stockStatus).toBe('AVAILABLE');
        });

        it('Story 4.2 AC7: should return delivery options', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.deliveryOptions).toHaveLength(2);
            expect(response.body.data.deliveryOptions.map((d: any) => d.label)).toContain('Today');
            expect(response.body.data.deliveryOptions.map((d: any) => d.label)).toContain('Tomorrow');
        });

        it('Story 4.2 AC9: should return Digital Twin preview', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback(null, mockListingDetailsResponse);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.body.data.digitalTwin).toBeDefined();
            expect(response.body.data.digitalTwin.verificationStatus).toBe('VERIFIED');
            expect(response.body.data.digitalTwin.aiGradingDetails.grade).toBe('A');
        });

        it('should return 404 when listing not found', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback({ code: 5, message: 'NOT_FOUND' }, null);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/999');

            // Assert
            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('NOT_FOUND');
        });

        it('should return 400 for invalid id format', async () => {
            // Act
            const response = await request(app).get('/v1/buyers/listings/abc');

            // Assert
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 503 when Catalog service unavailable', async () => {
            // Arrange
            mockCatalogClient.GetListingDetails.mockImplementation(
                (req: any, meta: any, callback: any) => {
                    callback({ code: 14, message: 'UNAVAILABLE' }, null);
                }
            );

            // Act
            const response = await request(app).get('/v1/buyers/listings/1');

            // Assert
            expect(response.status).toBe(503);
            expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });
});
