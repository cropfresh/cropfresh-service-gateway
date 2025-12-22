/**
 * Farmers Listings Route - Unit Tests
 * 
 * Tests REST endpoints with mocked gRPC client.
 */

import request from 'supertest';
import express from 'express';
import listingsRouter from '../../src/routes/v1/farmers/listings';

// ============================================================================
// Mocks
// ============================================================================

// Mock gRPC client
const mockGrpcClient = {
    createListing: jest.fn(),
    getListing: jest.fn(),
    listFarmerListings: jest.fn(),
    updateListing: jest.fn(),
    cancelListing: jest.fn(),
};

jest.mock('../../src/grpc/catalog-client', () => ({
    catalogGrpcClient: mockGrpcClient,
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

// ============================================================================
// Test App Setup
// ============================================================================

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
    req.user = { id: 1, role: 'FARMER' };
    next();
});

app.use('/v1/farmers/listings', listingsRouter);

// ============================================================================
// Test Suite
// ============================================================================

describe('Farmers Listings Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --------------------------------------------------------------------------
    // POST /v1/farmers/listings
    // --------------------------------------------------------------------------
    describe('POST /v1/farmers/listings', () => {
        it('should create listing with valid data', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                cropName: 'Tomato',
                quantityKg: 50,
                unit: 'kg',
                status: 'DRAFT',
                entryMode: 'MANUAL',
                estimatedPrice: 1500,
                createdAt: new Date().toISOString(),
            };

            mockGrpcClient.createListing.mockResolvedValue(mockListing);

            // Act
            const response = await request(app)
                .post('/v1/farmers/listings')
                .send({
                    cropId: 10,
                    quantityKg: 50,
                    unit: 'kg',
                    entryMode: 'manual',
                    qualityGrade: 'A',
                });

            // Assert
            expect(response.status).toBe(201);
            expect(response.body.data.id).toBe(1);
            expect(response.body.error).toBeNull();
        });

        it('should return 400 for invalid cropId', async () => {
            // Act
            const response = await request(app)
                .post('/v1/farmers/listings')
                .send({
                    cropId: -1, // Invalid
                    quantityKg: 50,
                    entryMode: 'manual',
                });

            // Assert
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for missing quantityKg', async () => {
            // Act
            const response = await request(app)
                .post('/v1/farmers/listings')
                .send({
                    cropId: 10,
                    entryMode: 'manual',
                });

            // Assert
            expect(response.status).toBe(400);
        });
    });

    // --------------------------------------------------------------------------
    // GET /v1/farmers/listings
    // --------------------------------------------------------------------------
    describe('GET /v1/farmers/listings', () => {
        it('should return paginated listings', async () => {
            // Arrange
            const mockResponse = {
                listings: [
                    { id: 1, cropName: 'Tomato', quantityKg: 50, status: 'ACTIVE' },
                    { id: 2, cropName: 'Potato', quantityKg: 100, status: 'DRAFT' },
                ],
                total: 2,
                page: 1,
                pageSize: 20,
                hasMore: false,
            };

            mockGrpcClient.listFarmerListings.mockResolvedValue(mockResponse);

            // Act
            const response = await request(app)
                .get('/v1/farmers/listings')
                .query({ page: 1, pageSize: 20 });

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.data.listings.length).toBe(2);
            expect(response.body.data.total).toBe(2);
        });

        it('should filter by status', async () => {
            // Arrange
            mockGrpcClient.listFarmerListings.mockResolvedValue({
                listings: [],
                total: 0,
                page: 1,
                pageSize: 20,
                hasMore: false,
            });

            // Act
            const response = await request(app)
                .get('/v1/farmers/listings')
                .query({ status: 'ACTIVE' });

            // Assert
            expect(response.status).toBe(200);
            expect(mockGrpcClient.listFarmerListings).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'ACTIVE' })
            );
        });
    });

    // --------------------------------------------------------------------------
    // GET /v1/farmers/listings/:id
    // --------------------------------------------------------------------------
    describe('GET /v1/farmers/listings/:id', () => {
        it('should return listing by id', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                cropName: 'Tomato',
                quantityKg: 50,
                status: 'ACTIVE',
            };

            mockGrpcClient.getListing.mockResolvedValue(mockListing);

            // Act
            const response = await request(app)
                .get('/v1/farmers/listings/1');

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe(1);
        });

        it('should return 400 for invalid id', async () => {
            // Act
            const response = await request(app)
                .get('/v1/farmers/listings/abc');

            // Assert
            expect(response.status).toBe(400);
        });
    });

    // --------------------------------------------------------------------------
    // DELETE /v1/farmers/listings/:id
    // --------------------------------------------------------------------------
    describe('DELETE /v1/farmers/listings/:id', () => {
        it('should cancel listing', async () => {
            // Arrange
            mockGrpcClient.cancelListing.mockResolvedValue({
                success: true,
                message: 'Listing cancelled',
            });

            // Act
            const response = await request(app)
                .delete('/v1/farmers/listings/1');

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.data.success).toBe(true);
        });
    });
});
