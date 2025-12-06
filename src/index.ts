// Tracing (Must be first)
import './tracing';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import v1Router from './routes/v1';

import { requestLogger, traceIdMiddleware } from './middleware/logging';
import { monitoringMiddleware, metricsHandler } from './middleware/monitoring';
import { livenessHandler, createReadinessHandler } from './middleware/health';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());

// Request ID (Must be early)
app.use(requestIdMiddleware);

// JSON Body Parser
app.use(express.json());

// Monitoring Middleware (Prometheus metrics)
app.use(monitoringMiddleware);

// Standard Logging Middleware
app.use(traceIdMiddleware);
app.use(requestLogger);

// Health check endpoints (Kubernetes probes)
app.get('/health', livenessHandler);
app.get('/ready', createReadinessHandler());

// Metrics Endpoint
app.get('/metrics', metricsHandler);

// Routes
app.use('/v1', v1Router);

// Error Handler (Must be last)
app.use(errorHandler);

// Start Server
if (require.main === module) {
    app.listen(config.port, () => {
        logger.info(`Gateway Service running on port ${config.port}`);
    });
}

export default app;
