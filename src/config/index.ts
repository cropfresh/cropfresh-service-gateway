import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.GATEWAY_PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    jwtSecret: process.env.JWT_SECRET || 'default_secret_do_not_use_in_prod',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    services: {
        auth: {
            host: process.env.AUTH_SERVICE_HOST || 'localhost',
            port: process.env.AUTH_SERVICE_PORT || '50051',
        },
        catalog: {
            host: process.env.CATALOG_SERVICE_HOST || 'localhost',
            port: process.env.CATALOG_SERVICE_PORT || '50052',
        },
        order: {
            host: process.env.ORDER_SERVICE_HOST || 'localhost',
            port: process.env.ORDER_SERVICE_PORT || '50053',
        },
        // Add other services as needed
    },
};
