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

export const sendSuccess = <T>(res: Response, data: T, meta: Record<string, any> = {}) => {
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

    res.status(200).json(response);
};
