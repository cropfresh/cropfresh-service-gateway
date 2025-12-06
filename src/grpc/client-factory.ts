import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger, asyncLocalStorage } from '../utils/logger';

export class GrpcClientFactory {
    static createClient<T extends grpc.Client>(
        serviceName: string,
        protoPath: string,
        address: string
    ): T {
        const packageDefinition = protoLoader.loadSync(protoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });

        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
        
        // Traverse the protoDescriptor to find the service (handles packages like cropfresh.auth.AuthService)
        const servicePath = serviceName.split('.');
        let Service = protoDescriptor;
        for (const segment of servicePath) {
            Service = Service[segment];
            if (!Service) break;
        }

        if (!Service) {
            throw new Error(`Service ${serviceName} not found in proto ${protoPath}`);
        }


        // Interceptor to propagate trace ID
        const interceptor = (options: any, nextCall: any) => {
            return new grpc.InterceptingCall(nextCall(options), {
                start: function (metadata: any, listener: any, next: any) {
                    const store = asyncLocalStorage.getStore();
                    if (store && store.traceId) {
                        metadata.set('trace-id', store.traceId);
                    }
                    next(metadata, listener);
                },
            });
        };

        // Note: grpc-js interceptors are complex. 
        // A simpler approach for this story is to ensure we pass metadata with every call.
        // We will enforce that in the wrapper or usage.

        // Apply interceptor
        const client = new Service(address, grpc.credentials.createInsecure(), { interceptors: [interceptor] });

        return client;
    }
}

export const createMetadata = (traceId: string): grpc.Metadata => {
    const metadata = new grpc.Metadata();
    metadata.set('trace-id', traceId);
    return metadata;
};
