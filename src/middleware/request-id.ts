import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
    req.headers['x-trace-id'] = traceId;
    res.setHeader('X-Trace-ID', traceId);
    next();
};
