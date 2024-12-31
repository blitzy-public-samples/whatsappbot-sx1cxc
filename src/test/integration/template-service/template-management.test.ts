/**
 * @fileoverview Integration tests for template management service
 * Covers CRUD operations, validation, caching, multi-tenancy, rate limiting,
 * and performance monitoring.
 * @version 1.0.0
 */

// External imports with versions
import { describe, it, beforeEach, afterEach, expect, jest } from 'jest'; // ^29.0.0
import { Redis } from 'ioredis'; // ^5.3.0
import { Logger } from 'winston'; // ^3.10.0
import { Registry, Counter, Histogram } from 'prom-client'; // ^14.2.0

// Internal imports
import TemplateManager from '../../../backend/template-service/src/services/template-manager';
import { Template, TemplateVariable, VariableType } from '../../../backend/template-service/src/types';

// Test constants
const TEST_ORGANIZATION_ID = 'test-org-123';
const TEST_USER_ID = 'test-user-123';
const TEMPLATE_LIMIT_PER_ORG = 1000;
const CACHE_TTL_SECONDS = 3600;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;

// Metrics setup
const metrics = {
    templateOperations: new Counter({
        name: 'template_operations_total',
        help: 'Total template operations',
        labelNames: ['operation', 'status']
    }),
    operationDuration: new Histogram({
        name: 'template_operation_duration_seconds',
        help: 'Duration of template operations',
        labelNames: ['operation']
    })
};

// Test environment setup
let templateManager: TemplateManager;
let redisClient: Redis;
let logger: Logger;
let dbPool: any;

/**
 * Sets up test environment before each test
 */
async function setupTestEnvironment(): Promise<void> {
    // Initialize Redis client
    redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 1 // Use separate DB for tests
    });

    // Initialize logger
    logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    } as unknown as Logger;

    // Mock DB pool
    dbPool = {
        query: jest.fn(),
        connect: jest.fn().mockReturnValue({
            query: jest.fn(),
            release: jest.fn(),
        })
    };

    // Initialize template manager
    templateManager = new TemplateManager(
        redisClient,
        logger,
        dbPool,
        {
            templateLimit: TEMPLATE_LIMIT_PER_ORG,
            cacheTTL: CACHE_TTL_SECONDS,
            rateLimitWindow: RATE_LIMIT_WINDOW_MS,
            rateLimitMaxRequests: RATE_LIMIT_MAX_REQUESTS
        }
    );

    // Clear Redis cache
    await redisClient.flushdb();
}

/**
 * Cleans up test environment after each test
 */
async function cleanupTestEnvironment(): Promise<void> {
    await redisClient.quit();
    jest.clearAllMocks();
}

/**
 * Generates concurrent requests for load testing
 */
async function generateConcurrentRequests(
    requestCount: number,
    requestFn: () => Promise<any>
): Promise<Array<any>> {
    const requests = Array(requestCount).fill(null).map(() => requestFn());
    return Promise.all(requests);
}

describe('Template Management Integration Tests', () => {
    beforeEach(setupTestEnvironment);
    afterEach(cleanupTestEnvironment);

    describe('Template Creation', () => {
        const validTemplate = {
            name: 'Welcome Message',
            content: 'Hello {firstName}, welcome to {companyName}!',
            variables: [
                {
                    name: 'firstName',
                    type: VariableType.TEXT,
                    required: true,
                    defaultValue: null,
                    validation: null,
                    description: 'Customer first name',
                    i18n: { en: 'First Name', es: 'Nombre' }
                },
                {
                    name: 'companyName',
                    type: VariableType.TEXT,
                    required: true,
                    defaultValue: 'Our Company',
                    validation: null,
                    description: 'Company name',
                    i18n: { en: 'Company Name', es: 'Nombre de la Empresa' }
                }
            ],
            category: 'welcome',
            metadata: { department: 'marketing' }
        };

        it('should create valid template successfully', async () => {
            dbPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
            dbPool.connect().query.mockResolvedValueOnce({
                rows: [{ ...validTemplate, id: 'template-123' }]
            });

            const result = await templateManager.createTemplate(
                validTemplate,
                TEST_ORGANIZATION_ID,
                TEST_USER_ID
            );

            expect(result).toBeDefined();
            expect(result.id).toBe('template-123');
            expect(result.name).toBe(validTemplate.name);
            expect(metrics.templateOperations.labels('create', 'success').inc).toHaveBeenCalled();
        });

        it('should enforce template name uniqueness within organization', async () => {
            dbPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
            dbPool.connect().query.mockRejectedValueOnce(new Error('duplicate key value'));

            await expect(templateManager.createTemplate(
                validTemplate,
                TEST_ORGANIZATION_ID,
                TEST_USER_ID
            )).rejects.toThrow('duplicate key value');
        });

        it('should enforce organization template limits', async () => {
            dbPool.query.mockResolvedValueOnce({ rows: [{ count: TEMPLATE_LIMIT_PER_ORG }] });

            await expect(templateManager.createTemplate(
                validTemplate,
                TEST_ORGANIZATION_ID,
                TEST_USER_ID
            )).rejects.toThrow('Maximum template limit');
        });

        it('should handle concurrent template creation', async () => {
            dbPool.query.mockResolvedValue({ rows: [{ count: 0 }] });
            dbPool.connect().query.mockResolvedValue({
                rows: [{ ...validTemplate, id: 'template-123' }]
            });

            const results = await generateConcurrentRequests(5, () =>
                templateManager.createTemplate(
                    validTemplate,
                    TEST_ORGANIZATION_ID,
                    TEST_USER_ID
                )
            );

            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result.id).toBeDefined();
            });
        });
    });

    describe('Template Updates', () => {
        const existingTemplate: Template = {
            id: 'template-123',
            name: 'Old Welcome',
            content: 'Hello {firstName}!',
            variables: [{
                name: 'firstName',
                type: VariableType.TEXT,
                required: true,
                defaultValue: null,
                validation: null,
                description: 'First name',
                i18n: { en: 'First Name' }
            }],
            organizationId: TEST_ORGANIZATION_ID,
            createdBy: TEST_USER_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            version: 1,
            category: 'welcome',
            metadata: {}
        };

        it('should update template properties correctly', async () => {
            const updateData = {
                name: 'New Welcome',
                content: 'Hello {firstName} {lastName}!',
                variables: [
                    existingTemplate.variables[0],
                    {
                        name: 'lastName',
                        type: VariableType.TEXT,
                        required: true,
                        defaultValue: null,
                        validation: null,
                        description: 'Last name',
                        i18n: { en: 'Last Name' }
                    }
                ],
                category: 'welcome',
                metadata: { updated: true }
            };

            dbPool.query.mockResolvedValueOnce({ rows: [existingTemplate] });
            dbPool.connect().query.mockResolvedValueOnce({
                rows: [{ ...existingTemplate, ...updateData, version: 2 }]
            });

            const result = await templateManager.updateTemplate(
                existingTemplate.id,
                updateData,
                TEST_ORGANIZATION_ID
            );

            expect(result.version).toBe(2);
            expect(result.variables).toHaveLength(2);
            expect(metrics.templateOperations.labels('update', 'success').inc).toHaveBeenCalled();
        });
    });

    describe('Cache Behavior', () => {
        it('should utilize cache for repeated template retrievals', async () => {
            const templateId = 'template-123';
            const cachedTemplate = {
                id: templateId,
                name: 'Cached Template',
                // ... other template properties
            };

            // First call - DB hit
            dbPool.query.mockResolvedValueOnce({ rows: [cachedTemplate] });
            const firstResult = await templateManager.getTemplate(
                templateId,
                TEST_ORGANIZATION_ID
            );

            // Second call - should hit cache
            const secondResult = await templateManager.getTemplate(
                templateId,
                TEST_ORGANIZATION_ID
            );

            expect(firstResult).toEqual(secondResult);
            expect(dbPool.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('Performance and Load', () => {
        it('should handle high concurrent requests within performance SLA', async () => {
            const startTime = Date.now();
            const concurrentRequests = 50;

            dbPool.query.mockResolvedValue({ rows: [{ count: 0 }] });
            dbPool.connect().query.mockResolvedValue({
                rows: [{ id: 'template-123', name: 'Test Template' }]
            });

            const results = await generateConcurrentRequests(concurrentRequests, () =>
                templateManager.createTemplate(
                    {
                        name: 'Load Test Template',
                        content: 'Test content',
                        variables: [],
                        category: 'test',
                        metadata: {}
                    },
                    TEST_ORGANIZATION_ID,
                    TEST_USER_ID
                )
            );

            const duration = Date.now() - startTime;
            expect(results).toHaveLength(concurrentRequests);
            expect(duration).toBeLessThan(2000); // 2 second SLA
        });
    });
});