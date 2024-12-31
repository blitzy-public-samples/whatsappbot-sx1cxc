/**
 * @fileoverview Enhanced template management service with caching, security, and performance optimizations.
 * Implements comprehensive template lifecycle management for WhatsApp messages.
 * @version 1.0.0
 */

// External imports with versions
import { Redis } from 'ioredis'; // v5.3.0
import { Logger } from 'winston'; // v3.10.0
import { CircuitBreaker } from 'opossum'; // v7.1.0
import { z } from 'zod'; // v3.22.0
import { RateLimiter } from 'rate-limiter-flexible'; // v2.4.1

// Internal imports
import { Template, TemplateCreateInput, TemplateUpdateInput, TemplateValidationError } from '../types';
import { validateTemplate } from './template-validator';

// Constants
const TEMPLATE_CACHE_TTL = 3600; // 1 hour cache TTL
const MAX_TEMPLATES_PER_ORG = 1000;
const CACHE_KEY_PREFIX = 'template:';
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 1000;

// Zod schema for enhanced input validation
const templateInputSchema = z.object({
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

/**
 * Enhanced template management service with caching, security, and performance optimizations.
 */
export class TemplateManager {
    private readonly cacheClient: Redis;
    private readonly logger: Logger;
    private readonly dbCircuitBreaker: CircuitBreaker;
    private readonly rateLimiter: RateLimiter;

    /**
     * Initializes the template manager with required dependencies
     */
    constructor(
        cacheClient: Redis,
        logger: Logger,
        private readonly dbPool: any,
        private readonly config: any
    ) {
        this.cacheClient = cacheClient;
        this.logger = logger;

        // Initialize circuit breaker for DB operations
        this.dbCircuitBreaker = new CircuitBreaker(async (operation: Function) => {
            return operation();
        }, {
            timeout: 5000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        // Initialize rate limiter
        this.rateLimiter = new RateLimiter({
            points: RATE_LIMIT_MAX_REQUESTS,
            duration: RATE_LIMIT_WINDOW
        });

        // Set up error handlers
        this.dbCircuitBreaker.on('open', () => {
            this.logger.error('Circuit breaker opened - DB operations failing');
        });

        this.setupCacheErrorHandling();
    }

    /**
     * Creates a new template with validation and caching
     */
    async createTemplate(
        input: TemplateCreateInput,
        organizationId: string,
        userId: string
    ): Promise<Template> {
        try {
            // Rate limiting check
            await this.checkRateLimit(organizationId);

            // Validate template count
            await this.validateTemplateCount(organizationId);

            // Validate input
            const validatedInput = await templateInputSchema.parseAsync(input);

            // Validate template structure
            const validationResult = await validateTemplate({
                ...validatedInput,
                id: '',
                organizationId,
                createdBy: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true,
                version: 1
            });

            if (!validationResult.isValid) {
                throw new Error('Template validation failed: ' + 
                    validationResult.errors.map(e => e.message).join(', '));
            }

            // Create template in database
            const template = await this.dbCircuitBreaker.fire(async () => {
                const client = await this.dbPool.connect();
                try {
                    await client.query('BEGIN');
                    
                    const result = await client.query(
                        `INSERT INTO templates 
                        (name, content, variables, organization_id, created_by, category, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING *`,
                        [
                            validatedInput.name,
                            validatedInput.content,
                            JSON.stringify(validatedInput.variables),
                            organizationId,
                            userId,
                            validatedInput.category,
                            validatedInput.metadata
                        ]
                    );

                    await client.query('COMMIT');
                    return result.rows[0];
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            });

            // Cache the template
            await this.cacheTemplate(template);

            this.logger.info('Template created successfully', {
                templateId: template.id,
                organizationId
            });

            return template;

        } catch (error) {
            this.logger.error('Failed to create template', {
                error,
                organizationId,
                userId
            });
            throw error;
        }
    }

    /**
     * Updates an existing template with validation and cache invalidation
     */
    async updateTemplate(
        templateId: string,
        input: TemplateUpdateInput,
        organizationId: string
    ): Promise<Template> {
        try {
            // Rate limiting check
            await this.checkRateLimit(organizationId);

            // Validate ownership
            const existingTemplate = await this.getTemplate(templateId, organizationId);
            if (!existingTemplate) {
                throw new Error('Template not found or access denied');
            }

            // Validate input
            const validatedInput = await templateInputSchema.parseAsync(input);

            // Validate template structure
            const validationResult = await validateTemplate({
                ...existingTemplate,
                ...validatedInput
            });

            if (!validationResult.isValid) {
                throw new Error('Template validation failed: ' + 
                    validationResult.errors.map(e => e.message).join(', '));
            }

            // Update template in database
            const template = await this.dbCircuitBreaker.fire(async () => {
                const client = await this.dbPool.connect();
                try {
                    await client.query('BEGIN');
                    
                    const result = await client.query(
                        `UPDATE templates 
                        SET name = $1, content = $2, variables = $3,
                            category = $4, metadata = $5, updated_at = NOW(),
                            version = version + 1
                        WHERE id = $6 AND organization_id = $7
                        RETURNING *`,
                        [
                            validatedInput.name,
                            validatedInput.content,
                            JSON.stringify(validatedInput.variables),
                            validatedInput.category,
                            validatedInput.metadata,
                            templateId,
                            organizationId
                        ]
                    );

                    await client.query('COMMIT');
                    return result.rows[0];
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            });

            // Update cache
            await this.cacheTemplate(template);

            this.logger.info('Template updated successfully', {
                templateId,
                organizationId
            });

            return template;

        } catch (error) {
            this.logger.error('Failed to update template', {
                error,
                templateId,
                organizationId
            });
            throw error;
        }
    }

    /**
     * Retrieves a template with caching
     */
    private async getTemplate(
        templateId: string,
        organizationId: string
    ): Promise<Template | null> {
        const cacheKey = `${CACHE_KEY_PREFIX}${templateId}`;

        try {
            // Check cache first
            const cachedTemplate = await this.cacheClient.get(cacheKey);
            if (cachedTemplate) {
                return JSON.parse(cachedTemplate);
            }

            // Fetch from database
            const template = await this.dbCircuitBreaker.fire(async () => {
                const result = await this.dbPool.query(
                    'SELECT * FROM templates WHERE id = $1 AND organization_id = $2',
                    [templateId, organizationId]
                );
                return result.rows[0] || null;
            });

            if (template) {
                await this.cacheTemplate(template);
            }

            return template;

        } catch (error) {
            this.logger.error('Failed to get template', {
                error,
                templateId,
                organizationId
            });
            throw error;
        }
    }

    /**
     * Caches a template with TTL
     */
    private async cacheTemplate(template: Template): Promise<void> {
        const cacheKey = `${CACHE_KEY_PREFIX}${template.id}`;
        await this.cacheClient.setex(
            cacheKey,
            TEMPLATE_CACHE_TTL,
            JSON.stringify(template)
        );
    }

    /**
     * Validates template count for organization
     */
    private async validateTemplateCount(organizationId: string): Promise<void> {
        const count = await this.dbPool.query(
            'SELECT COUNT(*) FROM templates WHERE organization_id = $1',
            [organizationId]
        );

        if (count.rows[0].count >= MAX_TEMPLATES_PER_ORG) {
            throw new Error(`Maximum template limit (${MAX_TEMPLATES_PER_ORG}) reached for organization`);
        }
    }

    /**
     * Checks rate limit for organization
     */
    private async checkRateLimit(organizationId: string): Promise<void> {
        try {
            await this.rateLimiter.consume(organizationId);
        } catch (error) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
    }

    /**
     * Sets up cache error handling
     */
    private setupCacheErrorHandling(): void {
        this.cacheClient.on('error', (error) => {
            this.logger.error('Redis cache error', { error });
        });

        this.cacheClient.on('connect', () => {
            this.logger.info('Redis cache connected');
        });
    }
}

export default TemplateManager;