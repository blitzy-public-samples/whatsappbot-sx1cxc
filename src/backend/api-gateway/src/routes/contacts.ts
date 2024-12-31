// External imports
import express, { Router, Response } from 'express'; // v4.18.x
import Joi from 'joi'; // v17.9.x

// Internal imports
import { authenticate, authorize } from '../middleware/auth';
import { validateSchema } from '../middleware/validation';
import rateLimitMiddleware from '../middleware/rateLimit';
import { 
  UserRole, 
  AuthenticatedRequest, 
  ApiResponse, 
  ServiceError,
  createApiResponse,
  createErrorResponse
} from '../types';

// Constants for validation schemas
const CONTACT_VALIDATION_SCHEMAS = {
  create: Joi.object({
    firstName: Joi.string().required().max(50).trim(),
    lastName: Joi.string().required().max(50).trim(),
    phoneNumber: Joi.string().required().pattern(/^\+[1-9]\d{1,14}$/).message('Invalid phone number format'),
    email: Joi.string().email().optional(),
    groups: Joi.array().items(Joi.string().uuid()).optional(),
    tags: Joi.array().items(Joi.string().max(30)).optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    firstName: Joi.string().max(50).trim().optional(),
    lastName: Joi.string().max(50).trim().optional(),
    phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).message('Invalid phone number format').optional(),
    email: Joi.string().email().optional(),
    groups: Joi.array().items(Joi.string().uuid()).optional(),
    tags: Joi.array().items(Joi.string().max(30)).optional(),
    metadata: Joi.object().optional()
  }),

  import: Joi.object({
    file: Joi.any().required(),
    format: Joi.string().valid('csv', 'json', 'xlsx').required(),
    options: Joi.object({
      headerRow: Joi.boolean().default(true),
      mapping: Joi.object().optional(),
      skipDuplicates: Joi.boolean().default(true)
    }).optional()
  }),

  search: Joi.object({
    query: Joi.string().optional(),
    groups: Joi.array().items(Joi.string().uuid()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    lastContact: Joi.object({
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().optional()
    }).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('firstName', 'lastName', 'lastContact').default('lastName'),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
  })
};

// Initialize router
const router: Router = express.Router();

/**
 * GET /contacts
 * Retrieve paginated list of contacts with filtering and sorting
 */
router.get('/contacts',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT]),
  rateLimitMiddleware,
  validateSchema(CONTACT_VALIDATION_SCHEMAS.search),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query, groups, tags, lastContact, page, limit, sortBy, sortOrder } = req.query;
      
      // Forward request to contact service with user context
      const response = await fetch(`${process.env.CONTACT_SERVICE_URL}/contacts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': req.user.id,
          'X-Organization-ID': req.user.orgId
        },
        body: JSON.stringify({
          query, groups, tags, lastContact, page, limit, sortBy, sortOrder
        })
      });

      const data = await response.json();
      
      res.setHeader('X-Total-Count', data.metadata.total);
      res.json(createApiResponse(data.contacts, {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0'
      }));
    } catch (error) {
      const serviceError = new ServiceError(
        3001,
        'Failed to retrieve contacts',
        {
          field: 'contacts',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
      res.status(500).json(createErrorResponse(serviceError, {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0'
      }));
    }
  }
);

/**
 * POST /contacts
 * Create a new contact
 */
router.post('/contacts',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  rateLimitMiddleware,
  validateSchema(CONTACT_VALIDATION_SCHEMAS.create),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const response = await fetch(`${process.env.CONTACT_SERVICE_URL}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': req.user.id,
          'X-Organization-ID': req.user.orgId
        },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      
      res.status(201).json(createApiResponse(data.contact, {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0'
      }));
    } catch (error) {
      const serviceError = new ServiceError(
        3002,
        'Failed to create contact',
        {
          field: 'contact',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
      res.status(500).json(createErrorResponse(serviceError, {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0'
      }));
    }
  }
);

// Additional endpoints would follow the same pattern...

export default router;