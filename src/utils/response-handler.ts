import { Response } from 'express';

export interface StandardResponse<T> {
    data: T;
    meta: {
        timestamp: string;
        request_id: string;
        [key: string]: any;
    };
    error: null;
}

export interface ErrorResponse {
    data: null;
    meta: {
        timestamp: string;
        request_id: string;
    };
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
}

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200, meta: Record<string, any> = {}) => {
    const traceId = res.getHeader('X-Trace-ID') as string;

    const response: StandardResponse<T> = {
        data,
        meta: {
            timestamp: new Date().toISOString(),
            request_id: traceId,
            ...meta,
        },
        error: null,
    };

    res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, any>
) => {
    const traceId = res.getHeader('X-Trace-ID') as string;

    const response: ErrorResponse = {
        data: null,
        meta: {
            timestamp: new Date().toISOString(),
            request_id: traceId,
        },
        error: {
            code,
            message,
            ...(details && { details }),
        },
    };

    res.status(statusCode).json(response);
};
