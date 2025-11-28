import request from 'supertest';
import app from '../../src/index';
import { authClient, catalogClient, orderClient } from '../../src/grpc/clients';

// Mock gRPC clients
jest.mock('../../src/grpc/clients', () => ({
    authClient: {
        Login: jest.fn(),
    },
    catalogClient: {
        ListProducts: jest.fn(),
    },
    orderClient: {
        CreateOrder: jest.fn(),
    },
    createMetadata: jest.fn(() => ({})),
}));

describe('Gateway Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return 200 OK', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('POST /v1/auth/login', () => {
        it('should return 200 on success', async () => {
            (authClient.Login as jest.Mock).mockImplementation((req, meta, callback) => {
                callback(null, { token: 'fake-token' });
            });

            const res = await request(app)
                .post('/v1/auth/login')
                .send({ phoneNumber: '1234567890', otp: '123456' });

            expect(res.status).toBe(200);
            expect(res.body.data.token).toBe('fake-token');
        });

        it('should return 400 on validation error', async () => {
            const res = await request(app)
                .post('/v1/auth/login')
                .send({ phoneNumber: '123', otp: '123' }); // Invalid

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // Add more tests for Catalog and Orders
});
