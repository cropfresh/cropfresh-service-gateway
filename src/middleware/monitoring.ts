import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

export const register = new client.Registry();

register.setDefaultLabels({
    app: 'cropfresh-service-gateway',
    service: 'gateway-service'
});

client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

export const httpRequestTotal = new client.Counter({
    name: 'http_request_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

// Gateway has gRPC client metrics (outbound calls)
export const grpcClientDuration = new client.Histogram({
    name: 'grpc_client_duration_seconds',
    help: 'Duration of outbound gRPC client calls',
    labelNames: ['service', 'method', 'status_code'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(grpcClientDuration);

export const grpcClientTotal = new client.Counter({
    name: 'grpc_client_total',
    help: 'Total outbound gRPC client calls',
    labelNames: ['service', 'method', 'status_code']
});
register.registerMetric(grpcClientTotal);

// Active connections gauge (for real-time tracking - NFR-P2)
export const activeWebsocketConnections = new client.Gauge({
    name: 'active_websocket_connections',
    help: 'Number of active WebSocket connections for real-time features'
});
register.registerMetric(activeWebsocketConnections);

export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        const status = res.statusCode.toString();
        httpRequestDuration.labels(req.method, route, status).observe(duration);
        httpRequestTotal.labels(req.method, route, status).inc();
    });
    next();
};

export const metricsHandler = async (req: Request, res: Response) => {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
};
