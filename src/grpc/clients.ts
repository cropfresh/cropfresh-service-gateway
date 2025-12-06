import path from 'path';
import { config } from '../config';
import { GrpcClientFactory } from './client-factory';

const PROTO_ROOT = path.resolve(__dirname, '../../protos/proto');

// Define types for clients (using any for now as we don't have generated types yet)
// In a real scenario, we would generate types from protos.

export const authClient = GrpcClientFactory.createClient<any>(
    'cropfresh.auth.AuthService',
    path.join(PROTO_ROOT, 'auth.proto'),
    `${config.services.auth.host}:${config.services.auth.port}`
);

export const catalogClient = GrpcClientFactory.createClient<any>(
    'cropfresh.catalog.CatalogService',
    path.join(PROTO_ROOT, 'catalog.proto'),
    `${config.services.catalog.host}:${config.services.catalog.port}`
);

export const orderClient = GrpcClientFactory.createClient<any>(
    'cropfresh.order.OrderService',
    path.join(PROTO_ROOT, 'order.proto'),
    `${config.services.order.host}:${config.services.order.port}`
);

// Add other clients as needed

export { createMetadata } from './client-factory';
