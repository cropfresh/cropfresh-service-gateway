import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface DependencyCheckResult {
    name: string;
    status: 'ok' | 'failed';
    latency?: number;
    error?: string;
}

export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    checks?: Record<string, string>;
}

/**
 * Liveness check - returns 200 if server is running
 * Does NOT check dependencies (Kubernetes will restart if this fails)
 */
export const livenessHandler = (req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
};

/**
 * Readiness check - returns 200 only if ALL dependencies are accessible
 * Gateway service doesn't have database, only checks downstream gRPC services
 * Kubernetes uses this to determine if pod can receive traffic
 */
export const createReadinessHandler = () => {
    return async (req: Request, res: Response) => {
        const checks: DependencyCheckResult[] = [];
        let allHealthy = true;

        // TODO: Add gRPC service health checks (auth, catalog, order, etc.)
        // For now, return healthy as gateway has no direct database dependencies

        // Build standardized response
        const response: HealthCheckResponse = {
            status: allHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            checks: checks.reduce((acc, check) => {
                acc[check.name] = check.status;
                return acc;
            }, {} as Record<string, string>)
        };

        // Return 503 if any dependency failed
        const statusCode = allHealthy ? 200 : 503;

        if (!allHealthy) {
            logger.warn({ checks }, 'Readiness check failed');
        }

        res.status(statusCode).json(response);
    };
};
