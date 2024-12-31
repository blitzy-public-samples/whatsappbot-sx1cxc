/**
 * @fileoverview Express router implementation for template service REST API endpoints
 * with enhanced security, validation, and monitoring.
 * @version 1.0.0
 */

// External imports with versions
import express, { Request, Response, NextFunction } from 'express'; // v4.18.2
import { z } from 'zod'; // v3.22.0
import winston from 'winston'; // v3.10.0
import rateLimit from 'express-rate-limit'; // v6.9.0
import helmet from 'helmet'; // v7.0.0

// Internal imports
import { 
    Template, 
    TemplateCreateInput, 
    TemplateUpdateInput, 
    TemplateValidationError 
} from '../types';
import { config } from '../config';
import TemplateManager from '../services/template-manager';
import { validateTemplate, sanitizeTemplate } from '../services/template-validator';

// Initialize router with security middleware
const router = express.Router();
router.use(helmet());

// Configure rate limiting
const templateRateLimit = rateLimit({
    windowMs: config.security.rateLimit.window,
    max: config.security.rateLimit.max,
    message: 'Too many template requests, please try again later'
});

// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'template-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'template-service-combined.log' })
    ]
});

// Zod schemas for request validation
const createTemplateSchema = z.object({
    name: z.string().min(1).max(64),
    content: z.string().min(1).max(1024),
    variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['text', 'number', 'date', 'boolean', 'currency']),
        required: z.boolean(),
        defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
        validation: z.any().nullable(),
        description: z.string(),
        i18n: z.record(z.string())
    })).max(10),
    category: z.string(),
    metadata: z.record(z.unknown())
});

const updateTemplateSchema = createTemplateSchema.extend({
    isActive: z.boolean()
});

/**
 * Create new template
 * @route POST /api/v1/templates
 */
router.post('/', templateRateLimit, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
        // Extract organization and user from auth context
        const organizationId = req.headers['x-organization-id'] as string;
        const userId = req.headers['x-user-id'] as string;

        if (!organizationId || !userId) {
            throw new Error('Missing required authentication headers');
        }

        // Validate request body
        const validatedInput = await createTemplateSchema.parseAsync(req.body);

        // Validate template structure and content
        const validationResult = await validateTemplate(validatedInput as Template);
        if (!validationResult.isValid) {
            return res.status(400).json({
                status: 'error',
                errors: validationResult.errors
            });
        }

        // Create template
        const template = await req.app.locals.templateManager.createTemplate(
            validatedInput,
            organizationId,
            userId
        );

        // Log success metrics
        logger.info('Template created successfully', {
            templateId: template.id,
            organizationId,
            userId,
            duration: Date.now() - startTime
        });

        res.status(201).json({
            status: 'success',
            data: template
        });

    } catch (error) {
        logger.error('Failed to create template', {
            error,
            duration: Date.now() - startTime,
            body: req.body
        });
        next(error);
    }
});

/**
 * Update existing template
 * @route PUT /api/v1/templates/:id
 */
router.put('/:id', templateRateLimit, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const organizationId = req.headers['x-organization-id'] as string;

        if (!organizationId) {
            throw new Error('Missing required authentication headers');
        }

        // Validate request body
        const validatedInput = await updateTemplateSchema.parseAsync(req.body);

        // Validate template updates
        const validationResult = await validateTemplate({
            ...validatedInput,
            id
        } as Template);

        if (!validationResult.isValid) {
            return res.status(400).json({
                status: 'error',
                errors: validationResult.errors
            });
        }

        // Update template
        const template = await req.app.locals.templateManager.updateTemplate(
            id,
            validatedInput,
            organizationId
        );

        // Log success metrics
        logger.info('Template updated successfully', {
            templateId: id,
            organizationId,
            duration: Date.now() - startTime
        });

        res.json({
            status: 'success',
            data: template
        });

    } catch (error) {
        logger.error('Failed to update template', {
            error,
            templateId: req.params.id,
            duration: Date.now() - startTime,
            body: req.body
        });
        next(error);
    }
});

/**
 * Get template by ID
 * @route GET /api/v1/templates/:id
 */
router.get('/:id', templateRateLimit, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const organizationId = req.headers['x-organization-id'] as string;

        if (!organizationId) {
            throw new Error('Missing required authentication headers');
        }

        const template = await req.app.locals.templateManager.getTemplate(id, organizationId);

        if (!template) {
            return res.status(404).json({
                status: 'error',
                message: 'Template not found'
            });
        }

        logger.info('Template retrieved successfully', {
            templateId: id,
            organizationId,
            duration: Date.now() - startTime
        });

        res.json({
            status: 'success',
            data: template
        });

    } catch (error) {
        logger.error('Failed to get template', {
            error,
            templateId: req.params.id,
            duration: Date.now() - startTime
        });
        next(error);
    }
});

/**
 * Delete template
 * @route DELETE /api/v1/templates/:id
 */
router.delete('/:id', templateRateLimit, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const organizationId = req.headers['x-organization-id'] as string;

        if (!organizationId) {
            throw new Error('Missing required authentication headers');
        }

        await req.app.locals.templateManager.deleteTemplate(id, organizationId);

        logger.info('Template deleted successfully', {
            templateId: id,
            organizationId,
            duration: Date.now() - startTime
        });

        res.status(204).send();

    } catch (error) {
        logger.error('Failed to delete template', {
            error,
            templateId: req.params.id,
            duration: Date.now() - startTime
        });
        next(error);
    }
});

/**
 * List templates with pagination and filtering
 * @route GET /api/v1/templates
 */
router.get('/', templateRateLimit, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
        const organizationId = req.headers['x-organization-id'] as string;
        
        if (!organizationId) {
            throw new Error('Missing required authentication headers');
        }

        const { page = 1, limit = 10, category, isActive } = req.query;

        const templates = await req.app.locals.templateManager.listTemplates(
            organizationId,
            {
                page: Number(page),
                limit: Number(limit),
                category: category as string,
                isActive: isActive === 'true'
            }
        );

        logger.info('Templates listed successfully', {
            organizationId,
            duration: Date.now() - startTime,
            count: templates.length
        });

        res.json({
            status: 'success',
            data: templates
        });

    } catch (error) {
        logger.error('Failed to list templates', {
            error,
            duration: Date.now() - startTime,
            query: req.query
        });
        next(error);
    }
});

export default router;