import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { mapGrpcStatusToHttp } from '../utils/grpc-status-mapper';

export interface ErrorResponse {
    data: null;
    meta: {
        timestamp: string;
        request_id: string;
    };
    error: {
        code: string;
        message: string;
        details?: any;
    };
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const traceId = (res.getHeader('X-Trace-ID') as string) || (req.headers['x-trace-id'] as string);

    // Log the error
    logger.error({ err, trace_id: traceId }, 'Request failed');

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details = undefined;

    // Handle gRPC Errors
    if (err.code !== undefined && typeof err.code === 'number') {
        statusCode = mapGrpcStatusToHttp(err.code);
        errorCode = 'SERVICE_ERROR'; // Could map specific codes to strings if needed
        message = err.details || err.message;
    }
    // Handle Zod Validation Errors (if attached directly, though usually handled in validation middleware)
    else if (err.name === 'ZodError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = err.issues;
    }
    // Handle Standard Errors
    else if (err instanceof Error) {
        message = err.message;
    }

    const response: ErrorResponse = {
        data: null,
        meta: {
            timestamp: new Date().toISOString(),
            request_id: traceId,
        },
        error: {
            code: errorCode,
            message,
            details,
        },
    };

    res.status(statusCode).json(response);
};
