// External dependencies
import express, { Router, Request, Response } from 'express'; // v4.18.x
import axios from 'axios'; // v1.6.x
import compression from 'compression'; // v1.7.x
import Joi from 'joi'; // v17.9.x

// Internal dependencies
import { authenticate, authorize } from '../middleware/auth';
import rateLimitMiddleware from '../middleware/rateLimit';
import { validateSchema, sanitizeInput } from '../middleware/validation';
import { 
  UserRole, 
  AuthenticatedRequest, 
  ServiceError, 
  createApiResponse, 
  createErrorResponse 
} from '../types';
import { config } from '../config';

// Constants
const MESSAGE_ENDPOINTS = {
  CREATE: '/api/v1/messages',
  GET_ALL: '/api/v1/messages',
  GET_BY_ID: '/api/v1/messages/:id',
  UPDATE_STATUS: '/api/v1/messages/:id/status',
  BULK_SEND: '/api/v1/messages/bulk',
  SCHEDULE: '/api/v1/messages/schedule'
} as const;

const ERROR_CODES = {
  VALIDATION_ERROR: 4000,
  NOT_FOUND: 4004,
  RATE_LIMIT_EXCEEDED: 4029,
  SECURITY_ERROR: 4030,
  MEDIA_ERROR: 4040,
  SERVICE_ERROR: 5000
} as const;

const RATE_LIMITS = {
  CREATE: 100,
  GET_ALL: 200,
  GET_BY_ID: 300,
  UPDATE_STATUS: 150,
  BULK_SEND: 50
} as const;

// Validation schemas
const messageSchema = Joi.object({
  body: Joi.object({
    content: Joi.string().required().max(4096),
    recipients: Joi.array().items(
      Joi.string().pattern(/^\+[1-9]\d{1,14}$/)
    ).required().max(1000),
    templateId: Joi.string().uuid().optional(),
    variables: Joi.object().optional(),
    attachments: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'document', 'audio').required(),
        url: Joi.string().uri().required(),
        name: Joi.string().max(255).optional(),
        size: Joi.number().max(16 * 1024 * 1024) // 16MB max
      })
    ).optional().max(10),
    scheduledAt: Joi.date().iso().min('now').optional()
  }).required()
});

const bulkMessageSchema = Joi.object({
  body: Joi.object({
    messages: Joi.array().items(messageSchema).min(1).max(1000).required(),
    options: Joi.object({
      priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
      retryAttempts: Joi.number().min(0).max(5).default(3)
    }).optional()
  }).required()
});

// Initialize router
const router: Router = express.Router();

/**
 * Create a new message with enhanced validation and security
 */
router.post(
  MESSAGE_ENDPOINTS.CREATE,
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT]),
  rateLimitMiddleware({ limit: RATE_LIMITS.CREATE }),
  validateSchema(messageSchema),
  compression(),
  async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const requestId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log incoming request
      console.info('Message creation request', {
        requestId,
        userId: authenticatedReq.user.id,
        orgId: authenticatedReq.user.orgId,
        timestamp: new Date().toISOString()
      });

      // Validate media attachments if present
      if (req.body.attachments?.length) {
        await validateAttachments(req.body.attachments);
      }

      // Forward request to message service
      const response = await axios.post(
        `${config.services.messageService.url}/messages`,
        {
          ...req.body,
          metadata: {
            requestId,
            userId: authenticatedReq.user.id,
            orgId: authenticatedReq.user.orgId
          }
        },
        {
          headers: {
            'X-Request-ID': requestId,
            'Authorization': req.headers.authorization
          },
          timeout: config.services.messageService.timeout
        }
      );

      // Return success response
      res.status(201).json(createApiResponse(
        {
          messageId: response.data.id,
          status: response.data.status,
          trackingId: requestId
        },
        {
          timestamp: Date.now(),
          requestId,
          version: config.server.apiVersion
        }
      ));
    } catch (error) {
      handleMessageError(error, res, requestId);
    }
  }
);

/**
 * Send bulk messages with rate limiting and validation
 */
router.post(
  MESSAGE_ENDPOINTS.BULK_SEND,
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  rateLimitMiddleware({ limit: RATE_LIMITS.BULK_SEND }),
  validateSchema(bulkMessageSchema),
  compression(),
  async (req: Request, res: Response) => {
    const requestId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      const authenticatedReq = req as AuthenticatedRequest;

      // Log bulk request
      console.info('Bulk message request', {
        requestId,
        userId: authenticatedReq.user.id,
        orgId: authenticatedReq.user.orgId,
        messageCount: req.body.messages.length,
        timestamp: new Date().toISOString()
      });

      // Forward to message service
      const response = await axios.post(
        `${config.services.messageService.url}/messages/bulk`,
        {
          ...req.body,
          metadata: {
            requestId,
            userId: authenticatedReq.user.id,
            orgId: authenticatedReq.user.orgId
          }
        },
        {
          headers: {
            'X-Request-ID': requestId,
            'Authorization': req.headers.authorization
          },
          timeout: config.services.messageService.timeout * 2 // Double timeout for bulk
        }
      );

      // Return success response
      res.status(202).json(createApiResponse(
        {
          batchId: response.data.batchId,
          accepted: response.data.accepted,
          rejected: response.data.rejected,
          trackingId: requestId
        },
        {
          timestamp: Date.now(),
          requestId,
          version: config.server.apiVersion
        }
      ));
    } catch (error) {
      handleMessageError(error, res, requestId);
    }
  }
);

/**
 * Validate message attachments
 */
async function validateAttachments(attachments: any[]): Promise<void> {
  const validationPromises = attachments.map(async (attachment) => {
    try {
      const response = await axios.head(attachment.url, {
        timeout: 5000,
        maxRedirects: 5
      });

      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      if (contentLength > 16 * 1024 * 1024) { // 16MB limit
        throw new ServiceError(
          ERROR_CODES.MEDIA_ERROR,
          'Attachment size exceeds limit',
          {
            field: 'attachments',
            reason: 'size_exceeded',
            value: contentLength,
            context: { maxSize: '16MB' }
          }
        );
      }
    } catch (error) {
      throw new ServiceError(
        ERROR_CODES.MEDIA_ERROR,
        'Invalid attachment URL',
        {
          field: 'attachments',
          reason: 'invalid_url',
          value: attachment.url,
          context: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      );
    }
  });

  await Promise.all(validationPromises);
}

/**
 * Handle message-related errors
 */
function handleMessageError(error: any, res: Response, requestId: string): void {
  console.error('Message error:', {
    requestId,
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString()
  });

  if (error instanceof ServiceError) {
    res.status(400).json(createErrorResponse(error, {
      timestamp: Date.now(),
      requestId,
      version: config.server.apiVersion
    }));
  } else if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status || 500;
    const serviceError = new ServiceError(
      ERROR_CODES.SERVICE_ERROR,
      'Message service error',
      {
        field: 'service',
        reason: error.message,
        value: undefined,
        context: { 
          requestId,
          status: statusCode,
          service: 'message-service'
        }
      }
    );
    res.status(statusCode).json(createErrorResponse(serviceError, {
      timestamp: Date.now(),
      requestId,
      version: config.server.apiVersion
    }));
  } else {
    const serviceError = new ServiceError(
      ERROR_CODES.SERVICE_ERROR,
      'Internal server error',
      {
        field: 'server',
        reason: error instanceof Error ? error.message : 'Unknown error',
        value: undefined,
        context: { requestId }
      }
    );
    res.status(500).json(createErrorResponse(serviceError, {
      timestamp: Date.now(),
      requestId,
      version: config.server.apiVersion
    }));
  }
}

export default router;