/**
 * @fileoverview Main router configuration for template service with enhanced security,
 * monitoring, and standardized error handling.
 * @version 1.0.0
 */

// External imports with versions
import express, { Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import rateLimit from 'express-rate-limit'; // v7.0.0
import winston from 'winston'; // v3.10.0

// Internal imports
import templateRouter from './templates';
import { config } from '../config';
import { TemplateValidationError } from '../types';

// Initialize Express router
const router = express.Router();

// Initialize logger
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

// Configure security middleware
router.use(helmet({
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
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
}));

// Configure CORS
router.use(cors({
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-user-id'],
    exposedHeaders: ['Content-Length', 'X-Rate-Limit-Remaining'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

// Configure rate limiting
const limiter = rateLimit({
    windowMs: config.security.rateLimit.window,
    max: config.security.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many requests, please try again later',
        code: 'ERR_RATE_LIMIT_EXCEEDED'
    }
});

router.use(limiter);

// Request logging middleware
router.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('Request processed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            organizationId: req.headers['x-organization-id'],
            userId: req.headers['x-user-id']
        });
    });

    next();
});

// Authentication check middleware
router.use((req: Request, res: Response, next: NextFunction) => {
    const organizationId = req.headers['x-organization-id'];
    const userId = req.headers['x-user-id'];

    if (!organizationId || !userId) {
        return res.status(401).json({
            status: 'error',
            message: 'Missing required authentication headers',
            code: 'ERR_UNAUTHORIZED'
        });
    }

    next();
});

// Mount template routes
router.use('/templates', templateRouter);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'success',
        data: {
            service: 'template-service',
            version: process.env.npm_package_version,
            timestamp: new Date().toISOString()
        }
    });
});

// Global error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        organizationId: req.headers['x-organization-id']
    });

    if (err instanceof SyntaxError) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid request body',
            code: 'ERR_INVALID_JSON'
        });
    }

    if (Array.isArray(err) && err[0] instanceof TemplateValidationError) {
        return res.status(400).json({
            status: 'error',
            message: 'Template validation failed',
            code: 'ERR_VALIDATION_FAILED',
            errors: err
        });
    }

    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'ERR_INTERNAL_SERVER'
    });
});

// 404 handler
router.use((req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: 'Resource not found',
        code: 'ERR_NOT_FOUND'
    });
});

export default router;