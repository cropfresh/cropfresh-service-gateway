import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next({ code: 401, message: 'No token provided' }); // Handled by error handler
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return next({ code: 401, message: 'Invalid token format' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        return next({ code: 401, message: 'Invalid token' });
    }
};
