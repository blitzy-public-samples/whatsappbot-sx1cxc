// External imports
import express, { Router, Request, Response } from 'express'; // v4.18.x
import compression from 'compression'; // v1.7.x
import Redis from 'ioredis'; // v5.3.x
import Joi from 'joi'; // v17.9.x

// Internal imports
import { authenticate, authorize } from '../middleware/auth';
import { validateSchema } from '../middleware/validation';
import rateLimitMiddleware from '../middleware/rateLimit';
import { UserRole, AuthenticatedRequest, ServiceError, createApiResponse, createErrorResponse } from '../types';
import { config } from '../config';

// Initialize Redis client for caching
const redis = new Redis(config.redis);

// Constants
const ANALYTICS_CACHE_PREFIX = 'analytics:';
const CACHE_TTL = 300; // 5 minutes

// Validation schemas
const timeframeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  timeframe: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').required(),
  metrics: Joi.array().items(
    Joi.string().valid('messages', 'delivery', 'engagement', 'templates', 'contacts')
  ).min(1).required(),
  filters: Joi.object({
    templateIds: Joi.array().items(Joi.string().uuid()),
    groupIds: Joi.array().items(Joi.string().uuid()),
    status: Joi.array().items(Joi.string())
  }).optional()
}).required();

const dashboardSchema = Joi.object({
  period: Joi.string().valid('today', 'week', 'month', 'custom').required(),
  customRange: Joi.when('period', {
    is: 'custom',
    then: Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    }).required(),
    otherwise: Joi.forbidden()
  })
}).required();

// Create router instance
const router: Router = express.Router();

// Apply middleware
router.use(compression());
router.use(rateLimitMiddleware);
router.use(authenticate);

/**
 * GET /api/v1/analytics/metrics
 * Retrieves detailed analytics metrics with filtering and aggregation
 */
router.get('/metrics',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  validateSchema(timeframeSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, timeframe, metrics, filters } = req.query;
      const cacheKey = `${ANALYTICS_CACHE_PREFIX}metrics:${req.user.orgId}:${JSON.stringify(req.query)}`;

      // Try to get from cache first
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.json(createApiResponse(JSON.parse(cachedData), {
          timestamp: Date.now(),
          requestId: req.id,
          version: config.server.apiVersion
        }));
      }

      // Call analytics service
      const response = await fetch(`${config.services.analyticsService.url}/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.user.id}`,
          'X-Organization-ID': req.user.orgId
        },
        body: JSON.stringify({
          startDate,
          endDate,
          timeframe,
          metrics,
          filters
        })
      });

      if (!response.ok) {
        throw new ServiceError(4001, 'Analytics service error', {
          field: 'service',
          reason: 'external_service_error',
          value: response.status,
          context: { endpoint: 'metrics' }
        });
      }

      const data = await response.json();

      // Cache the response
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));

      res.json(createApiResponse(data, {
        timestamp: Date.now(),
        requestId: req.id,
        version: config.server.apiVersion
      }));
    } catch (error) {
      console.error('Analytics metrics error:', error);
      res.status(error instanceof ServiceError ? error.code : 500)
        .json(createErrorResponse(
          error instanceof ServiceError ? error :
            new ServiceError(4002, 'Failed to retrieve analytics metrics'),
          {
            timestamp: Date.now(),
            requestId: req.id,
            version: config.server.apiVersion
          }
        ));
    }
  }
);

/**
 * GET /api/v1/analytics/dashboard
 * Retrieves dashboard analytics with summarized metrics
 */
router.get('/dashboard',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER]),
  validateSchema(dashboardSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { period, customRange } = req.query;
      const cacheKey = `${ANALYTICS_CACHE_PREFIX}dashboard:${req.user.orgId}:${period}:${JSON.stringify(customRange)}`;

      // Try to get from cache first
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.json(createApiResponse(JSON.parse(cachedData), {
          timestamp: Date.now(),
          requestId: req.id,
          version: config.server.apiVersion
        }));
      }

      // Call analytics service
      const response = await fetch(`${config.services.analyticsService.url}/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.user.id}`,
          'X-Organization-ID': req.user.orgId
        },
        body: JSON.stringify({ period, customRange })
      });

      if (!response.ok) {
        throw new ServiceError(4003, 'Dashboard analytics error', {
          field: 'service',
          reason: 'external_service_error',
          value: response.status,
          context: { endpoint: 'dashboard' }
        });
      }

      const data = await response.json();

      // Cache the response
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));

      res.json(createApiResponse(data, {
        timestamp: Date.now(),
        requestId: req.id,
        version: config.server.apiVersion
      }));
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(error instanceof ServiceError ? error.code : 500)
        .json(createErrorResponse(
          error instanceof ServiceError ? error :
            new ServiceError(4004, 'Failed to retrieve dashboard analytics'),
          {
            timestamp: Date.now(),
            requestId: req.id,
            version: config.server.apiVersion
          }
        ));
    }
  }
);

/**
 * GET /api/v1/analytics/reports
 * Generates and retrieves analytics reports
 */
router.get('/reports',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const response = await fetch(`${config.services.analyticsService.url}/reports`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.user.id}`,
          'X-Organization-ID': req.user.orgId
        }
      });

      if (!response.ok) {
        throw new ServiceError(4005, 'Analytics reports error', {
          field: 'service',
          reason: 'external_service_error',
          value: response.status,
          context: { endpoint: 'reports' }
        });
      }

      const data = await response.json();

      res.json(createApiResponse(data, {
        timestamp: Date.now(),
        requestId: req.id,
        version: config.server.apiVersion
      }));
    } catch (error) {
      console.error('Analytics reports error:', error);
      res.status(error instanceof ServiceError ? error.code : 500)
        .json(createErrorResponse(
          error instanceof ServiceError ? error :
            new ServiceError(4006, 'Failed to retrieve analytics reports'),
          {
            timestamp: Date.now(),
            requestId: req.id,
            version: config.server.apiVersion
          }
        ));
    }
  }
);

export default router;