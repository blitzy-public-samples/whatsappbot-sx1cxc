/**
 * @fileoverview Comprehensive unit test suite for TemplateManager service
 * Tests template lifecycle, caching, multi-tenant isolation, and performance
 * @version 1.0.0
 */

// External imports with versions
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import Redis from 'ioredis-mock'; // ^8.0.0
import { Logger } from 'winston'; // ^3.10.0

// Internal imports
import TemplateManager from '../../../backend/template-service/src/services/template-manager';
import { Template, TemplateCreateInput, VariableType } from '../../../backend/template-service/src/types';
import { validateTemplate } from '../../../backend/template-service/src/services/template-validator';

// Test constants
const TEST_ORG_ID = 'test-org-123';
const TEST_USER_ID = 'test-user-123';
const TEMPLATE_CACHE_TTL = 3600;
const MAX_TEMPLATES_PER_ORG = 1000;

// Mock implementations
jest.mock('winston', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

jest.mock('../../../backend/template-service/src/services/template-validator', () => ({
    validateTemplate: jest.fn()
}));

describe('TemplateManager', () => {
    let templateManager: TemplateManager;
    let redisMock: Redis;
    let loggerMock: Logger;
    let dbPoolMock: any;
    let rateLimiterMock: any;

    // Sample template data
    const sampleTemplate: TemplateCreateInput = {
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
        category: 'onboarding',
        metadata: { department: 'marketing' }
    };

    beforeEach(async () => {
        // Initialize Redis mock
        redisMock = new Redis();
        
        // Initialize logger mock
        loggerMock = new Logger({});

        // Initialize DB pool mock
        dbPoolMock = {
            connect: jest.fn().mockResolvedValue({
                query: jest.fn(),
                release: jest.fn(),
            }),
            query: jest.fn()
        };

        // Initialize rate limiter mock
        rateLimiterMock = {
            consume: jest.fn().mockResolvedValue(true)
        };

        // Initialize template manager
        templateManager = new TemplateManager(
            redisMock,
            loggerMock,
            dbPoolMock,
            { rateLimiter: rateLimiterMock }
        );

        // Reset all mocks
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await redisMock.flushall();
    });

    describe('createTemplate', () => {
        test('should create a valid template successfully', async () => {
            // Mock validation success
            (validateTemplate as jest.Mock).mockResolvedValue({ isValid: true, errors: [] });

            // Mock DB response
            const mockTemplate = {
                id: 'template-123',
                ...sampleTemplate,
                organizationId: TEST_ORG_ID,
                createdBy: TEST_USER_ID,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1,
                isActive: true
            };

            dbPoolMock.connect.mockResolvedValue({
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // template count check
                    .mockResolvedValueOnce({ rows: [mockTemplate] }), // template creation
                release: jest.fn()
            });

            const result = await templateManager.createTemplate(
                sampleTemplate,
                TEST_ORG_ID,
                TEST_USER_ID
            );

            expect(result).toEqual(mockTemplate);
            expect(validateTemplate).toHaveBeenCalled();
            expect(redisMock.setex).toHaveBeenCalled();
            expect(loggerMock.info).toHaveBeenCalled();
        });

        test('should throw error when template validation fails', async () => {
            (validateTemplate as jest.Mock).mockResolvedValue({
                isValid: false,
                errors: [{ message: 'Invalid template structure' }]
            });

            await expect(templateManager.createTemplate(
                sampleTemplate,
                TEST_ORG_ID,
                TEST_USER_ID
            )).rejects.toThrow('Template validation failed');
        });

        test('should throw error when org template limit exceeded', async () => {
            dbPoolMock.query.mockResolvedValue({
                rows: [{ count: MAX_TEMPLATES_PER_ORG }]
            });

            await expect(templateManager.createTemplate(
                sampleTemplate,
                TEST_ORG_ID,
                TEST_USER_ID
            )).rejects.toThrow('Maximum template limit');
        });

        test('should enforce rate limits for template creation', async () => {
            rateLimiterMock.consume.mockRejectedValue(new Error('Rate limit exceeded'));

            await expect(templateManager.createTemplate(
                sampleTemplate,
                TEST_ORG_ID,
                TEST_USER_ID
            )).rejects.toThrow('Rate limit exceeded');
        });
    });

    describe('updateTemplate', () => {
        const existingTemplate: Template = {
            id: 'template-123',
            ...sampleTemplate,
            organizationId: TEST_ORG_ID,
            createdBy: TEST_USER_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isActive: true
        };

        test('should update template successfully with version increment', async () => {
            // Mock template retrieval
            dbPoolMock.query.mockResolvedValueOnce({
                rows: [existingTemplate]
            });

            // Mock validation success
            (validateTemplate as jest.Mock).mockResolvedValue({ isValid: true, errors: [] });

            // Mock update success
            const updatedTemplate = {
                ...existingTemplate,
                name: 'Updated Welcome Message',
                version: 2,
                updatedAt: new Date()
            };

            dbPoolMock.connect.mockResolvedValue({
                query: jest.fn().mockResolvedValue({ rows: [updatedTemplate] }),
                release: jest.fn()
            });

            const result = await templateManager.updateTemplate(
                'template-123',
                {
                    ...sampleTemplate,
                    name: 'Updated Welcome Message'
                },
                TEST_ORG_ID
            );

            expect(result).toEqual(updatedTemplate);
            expect(result.version).toBe(2);
            expect(redisMock.setex).toHaveBeenCalled();
        });

        test('should throw error when template not found', async () => {
            dbPoolMock.query.mockResolvedValue({ rows: [] });

            await expect(templateManager.updateTemplate(
                'non-existent-id',
                sampleTemplate,
                TEST_ORG_ID
            )).rejects.toThrow('Template not found or access denied');
        });

        test('should throw error when org id doesn\'t match', async () => {
            await expect(templateManager.updateTemplate(
                'template-123',
                sampleTemplate,
                'different-org-id'
            )).rejects.toThrow('Template not found or access denied');
        });
    });

    describe('getTemplate', () => {
        const cachedTemplate: Template = {
            id: 'template-123',
            ...sampleTemplate,
            organizationId: TEST_ORG_ID,
            createdBy: TEST_USER_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isActive: true
        };

        test('should return template from cache if exists', async () => {
            await redisMock.setex(
                `template:${cachedTemplate.id}`,
                TEMPLATE_CACHE_TTL,
                JSON.stringify(cachedTemplate)
            );

            const result = await templateManager['getTemplate'](
                cachedTemplate.id,
                TEST_ORG_ID
            );

            expect(result).toEqual(cachedTemplate);
            expect(dbPoolMock.query).not.toHaveBeenCalled();
        });

        test('should fetch and cache template if not in cache', async () => {
            dbPoolMock.query.mockResolvedValue({
                rows: [cachedTemplate]
            });

            const result = await templateManager['getTemplate'](
                cachedTemplate.id,
                TEST_ORG_ID
            );

            expect(result).toEqual(cachedTemplate);
            expect(redisMock.setex).toHaveBeenCalled();
        });

        test('should return null for non-existent template', async () => {
            dbPoolMock.query.mockResolvedValue({ rows: [] });

            const result = await templateManager['getTemplate'](
                'non-existent-id',
                TEST_ORG_ID
            );

            expect(result).toBeNull();
        });
    });

    describe('listTemplates', () => {
        test('should list all templates for organization', async () => {
            const templates = [
                {
                    id: 'template-1',
                    ...sampleTemplate,
                    organizationId: TEST_ORG_ID
                },
                {
                    id: 'template-2',
                    ...sampleTemplate,
                    organizationId: TEST_ORG_ID
                }
            ];

            dbPoolMock.query.mockResolvedValue({ rows: templates });

            const result = await templateManager.listTemplates(TEST_ORG_ID);

            expect(result).toEqual(templates);
            expect(dbPoolMock.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [TEST_ORG_ID]
            );
        });
    });

    describe('deleteTemplate', () => {
        test('should delete template successfully', async () => {
            const templateId = 'template-123';

            dbPoolMock.query
                .mockResolvedValueOnce({ rows: [{ id: templateId }] }) // Template exists check
                .mockResolvedValueOnce({ rowCount: 1 }); // Delete operation

            await templateManager.deleteTemplate(templateId, TEST_ORG_ID);

            expect(redisMock.del).toHaveBeenCalledWith(`template:${templateId}`);
            expect(loggerMock.info).toHaveBeenCalledWith(
                'Template deleted successfully',
                expect.any(Object)
            );
        });

        test('should throw error when template not found', async () => {
            dbPoolMock.query.mockResolvedValue({ rows: [] });

            await expect(templateManager.deleteTemplate(
                'non-existent-id',
                TEST_ORG_ID
            )).rejects.toThrow('Template not found or access denied');
        });
    });
});