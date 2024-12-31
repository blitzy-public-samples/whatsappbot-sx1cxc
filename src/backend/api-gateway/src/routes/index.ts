// External imports
import express, { Router, Request, Response, NextFunction } from 'express'; // v4.18.x
import helmet from 'helmet'; // v7.0.x

// Internal imports
import analyticsRouter from './analytics';
import contactsRouter from './contacts';
import messagesRouter from './messages';
import templatesRouter from './templates';
import healthRouter from './health';
import { validateRequest } from '../middleware/validation';
import { authenticate, securityHeaders } from '../middleware/auth';
import { ServiceError, createErrorResponse } from '../types';
import { config } from '../config';

// Constants
const API_PREFIX = '/api/v1';

const ROUTES = {
  HEALTH: '/health',
  ANALYTICS: '/analytics',
  CONTACTS: '/contacts',
  MESSAGES: '/messages',
  TEMPLATES: '/templates'
} as const;

/**
 * Creates and configures the main API router with all routes and middleware
 * @returns {Router} Configured Express router
 */
function createMainRouter(): Router {
  const router = Router();

  // Apply security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
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
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // Apply common middleware
  router.use(express.json({ limit: '16mb' }));
  router.use(express.urlencoded({ extended: true, limit: '16mb' }));
  router.use(securityHeaders);

  // Request tracking middleware
  router.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = req.headers['x-request-id']?.toString() || 
             `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Mount health check routes (no authentication required)
  router.use(ROUTES.HEALTH, healthRouter);

  // API routes with authentication and versioning
  router.use(API_PREFIX, authenticate, (req: Request, res: Response, next: NextFunction) => {
    // Version check middleware
    const requestedVersion = req.headers['accept-version'];
    if (requestedVersion && requestedVersion !== config.server.apiVersion) {
      return next(new ServiceError(
        9002,
        'API version not supported',
        {
          field: 'version',
          reason: 'unsupported_version',
          value: requestedVersion,
          context: { 
            supportedVersion: config.server.apiVersion 
          }
        }
      ));
    }
    next();
  });

  // Mount service routes
  router.use(`${API_PREFIX}${ROUTES.ANALYTICS}`, analyticsRouter);
  router.use(`${API_PREFIX}${ROUTES.CONTACTS}`, contactsRouter);
  router.use(`${API_PREFIX}${ROUTES.MESSAGES}`, messagesRouter);
  router.use(`${API_PREFIX}${ROUTES.TEMPLATES}`, templatesRouter);

  // Global error handling middleware
  router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Global error handler:', {
      error: err.message,
      stack: err.stack,
      requestId: req.id,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    const statusCode = err instanceof ServiceError ? err.code : 500;
    const serviceError = err instanceof ServiceError ? err : new ServiceError(
      9001,
      'Internal server error',
      {
        field: 'server',
        reason: err.message,
        value: undefined,
        context: { 
          requestId: req.id,
          path: req.path
        }
      }
    );

    res.status(statusCode).json(createErrorResponse(serviceError, {
      timestamp: Date.now(),
      requestId: req.id,
      version: config.server.apiVersion
    }));
  });

  // 404 handler
  router.use((_req: Request, res: Response) => {
    const serviceError = new ServiceError(
      9004,
      'Resource not found',
      {
        field: 'path',
        reason: 'not_found',
        value: undefined,
        context: { timestamp: new Date().toISOString() }
      }
    );

    res.status(404).json(createErrorResponse(serviceError, {
      timestamp: Date.now(),
      requestId: _req.id,
      version: config.server.apiVersion
    }));
  });

  return router;
}

// Create and export the configured router
const router = createMainRouter();
export default router;