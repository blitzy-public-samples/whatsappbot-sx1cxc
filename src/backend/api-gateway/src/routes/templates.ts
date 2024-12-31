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
  Template, 
  PaginationParams 
} from '../types';

// Constants
const TEMPLATE_ROUTES = {
  GET_ALL: '/api/v1/templates',
  GET_ONE: '/api/v1/templates/:id',
  CREATE: '/api/v1/templates',
  UPDATE: '/api/v1/templates/:id',
  DELETE: '/api/v1/templates/:id',
  VERSION_HISTORY: '/api/v1/templates/:id/versions',
  RESTORE_VERSION: '/api/v1/templates/:id/versions/:versionId',
  BULK_OPERATIONS: '/api/v1/templates/bulk'
};

// Validation schemas
const templateBaseSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  content: Joi.string().max(4000).required(),
  variables: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('string', 'number', 'date', 'boolean').required(),
      required: Joi.boolean().default(true),
      defaultValue: Joi.any()
    })
  ).max(20),
  category: Joi.string().required(),
  status: Joi.string().valid('active', 'draft', 'archived').default('draft'),
  tags: Joi.array().items(Joi.string()).max(10)
});

const createTemplateSchema = templateBaseSchema.keys({
  orgId: Joi.string().required()
});

const updateTemplateSchema = templateBaseSchema.keys({
  version: Joi.number().required()
});

const bulkOperationSchema = Joi.object({
  operation: Joi.string().valid('activate', 'archive', 'delete').required(),
  templateIds: Joi.array().items(Joi.string()).min(1).max(100).required()
});

const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt').default('updatedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  category: Joi.string(),
  status: Joi.string().valid('active', 'draft', 'archived'),
  search: Joi.string().max(100)
});

/**
 * Creates and configures the Express router for template management
 * @returns {Router} Configured Express router
 */
function createTemplateRouter(): Router {
  const router = Router();

  // Apply global middleware
  router.use(rateLimitMiddleware);
  router.use(authenticate);

  // GET /templates - Get all templates with pagination and filtering
  router.get(
    TEMPLATE_ROUTES.GET_ALL,
    authorize([UserRole.VIEWER]),
    validateSchema(paginationSchema, { allowUnknown: true }),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const params = req.query as unknown as PaginationParams;
        const { orgId } = req.user;

        // Add cache control headers
        res.setHeader('Cache-Control', 'private, max-age=300');

        const response: ApiResponse<{
          templates: Template[];
          total: number;
          page: number;
          limit: number;
        }> = {
          success: true,
          data: {
            templates: [], // To be implemented with actual service call
            total: 0,
            page: params.page,
            limit: params.limit
          },
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /templates/:id - Get template by ID
  router.get(
    TEMPLATE_ROUTES.GET_ONE,
    authorize([UserRole.VIEWER]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { orgId } = req.user;

        // Add cache control headers
        res.setHeader('Cache-Control', 'private, max-age=300');

        const response: ApiResponse<Template> = {
          success: true,
          data: null, // To be implemented with actual service call
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /templates - Create new template
  router.post(
    TEMPLATE_ROUTES.CREATE,
    authorize([UserRole.MANAGER]),
    validateSchema(createTemplateSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const template = req.body;
        const { orgId } = req.user;

        const response: ApiResponse<Template> = {
          success: true,
          data: null, // To be implemented with actual service call
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /templates/:id - Update template
  router.put(
    TEMPLATE_ROUTES.UPDATE,
    authorize([UserRole.MANAGER]),
    validateSchema(updateTemplateSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const template = req.body;
        const { orgId } = req.user;

        const response: ApiResponse<Template> = {
          success: true,
          data: null, // To be implemented with actual service call
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /templates/:id - Delete template
  router.delete(
    TEMPLATE_ROUTES.DELETE,
    authorize([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { orgId } = req.user;

        const response: ApiResponse<void> = {
          success: true,
          data: null,
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /templates/:id/versions - Get template version history
  router.get(
    TEMPLATE_ROUTES.VERSION_HISTORY,
    authorize([UserRole.VIEWER]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { orgId } = req.user;

        const response: ApiResponse<Template[]> = {
          success: true,
          data: [], // To be implemented with actual service call
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /templates/bulk - Bulk operations on templates
  router.post(
    TEMPLATE_ROUTES.BULK_OPERATIONS,
    authorize([UserRole.ADMIN]),
    validateSchema(bulkOperationSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { operation, templateIds } = req.body;
        const { orgId } = req.user;

        const response: ApiResponse<{
          processed: string[];
          failed: string[];
        }> = {
          success: true,
          data: {
            processed: [],
            failed: []
          },
          error: null,
          metadata: {
            timestamp: Date.now(),
            requestId: req.headers['x-request-id'] as string,
            version: '1.0'
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// Create and export the router
const templateRouter = createTemplateRouter();
export default templateRouter;