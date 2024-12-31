/**
 * @fileoverview Main application entry point for the template service with enhanced security,
 * monitoring, and performance optimizations.
 * @version 1.0.0
 */

// External imports with versions
import express from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import morgan from 'morgan'; // v1.10.0
import winston from 'winston'; // v3.10.0
import Redis from 'ioredis'; // v5.3.0
import compression from 'compression'; // v1.7.4
import rateLimit from 'express-rate-limit'; // v6.9.0
import * as OpenTelemetry from '@opentelemetry/api'; // v1.4.1

// Internal imports
import router from './routes';
import { config } from './config';
import TemplateManager from './services/template-manager';

// Initialize Express application
const app = express();

// Initialize Winston logger
const logger = winston.createLogger({
    level: config.server.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: 'error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'combined.log' 
        })
    ]
});

// Initialize Redis client with cluster support
const redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
    },
    sentinels: config.redis.cluster ? config.redis.sentinels : undefined,
    name: config.redis.cluster ? 'mymaster' : undefined
});

// Initialize OpenTelemetry tracer
const tracer = new OpenTelemetry.TracerProvider();

/**
 * Initializes and configures Express middleware with enhanced security
 */
function initializeMiddleware(): void {
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: "same-site" }
    }));

    // CORS configuration
    app.use(cors({
        origin: config.server.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
        credentials: true,
        maxAge: 86400
    }));

    // Request compression
    app.use(compression());

    // Request parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Rate limiting per organization
    app.use(rateLimit({
        windowMs: config.security.rateLimit.window,
        max: config.security.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.headers['x-organization-id'] as string
    }));

    // Request tracing
    app.use((req, res, next) => {
        const span = tracer.getTracer('template-service').startSpan('http_request');
        req.span = span;
        next();
    });

    // Request logging
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

/**
 * Initializes required services and dependencies
 */
async function initializeServices(): Promise<void> {
    try {
        // Initialize template manager
        const templateManager = new TemplateManager(
            redisClient,
            logger,
            config.database,
            config
        );
        app.locals.templateManager = templateManager;

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: process.env.npm_package_version,
                timestamp: new Date().toISOString()
            });
        });

        // Metrics endpoint
        app.get('/metrics', (req, res) => {
            // Implement metrics collection
            res.json({
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            });
        });

    } catch (error) {
        logger.error('Failed to initialize services', { error });
        throw error;
    }
}

/**
 * Starts the Express server with enhanced monitoring
 */
async function startServer(): Promise<void> {
    try {
        // Initialize middleware and services
        initializeMiddleware();
        await initializeServices();

        // Mount API routes
        app.use('/api/v1', router);

        // Global error handler
        app.use(handleError);

        // Start server
        const server = app.listen(config.server.port, () => {
            logger.info(`Template service started on port ${config.server.port}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                redisClient.quit();
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start server', { error });
        process.exit(1);
    }
}

/**
 * Enhanced global error handling middleware
 */
function handleError(
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
): void {
    const span = req.span;
    if (span) {
        span.setStatus({
            code: OpenTelemetry.SpanStatusCode.ERROR,
            message: error.message
        });
        span.end();
    }

    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        organizationId: req.headers['x-organization-id']
    });

    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'ERR_INTERNAL_SERVER'
    });
}

// Start the server
startServer().catch((error) => {
    logger.error('Fatal error during startup', { error });
    process.exit(1);
});

export default app;