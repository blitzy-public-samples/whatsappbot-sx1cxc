// External imports - versions specified for stability
import { describe, it, expect, beforeEach, afterEach } from 'jest'; // ^29.0.0

// Internal imports
import { 
    validateTemplate, 
    validateVariableType, 
    extractVariables 
} from '../../../backend/template-service/src/services/template-validator';
import { 
    Template, 
    TemplateValidationError,
    VariableType 
} from '../../../backend/template-service/src/types';
import { TestDataGenerator } from '../../utils/test-data-generator';

// Mock Redis client
jest.mock('../../../backend/shared/redis-client');

describe('Template Validator', () => {
    let testDataGenerator: TestDataGenerator;

    beforeEach(() => {
        testDataGenerator = new TestDataGenerator();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('validateTemplate', () => {
        it('should validate a valid template successfully', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                name: 'valid_template',
                content: 'Hello {{firstName}}, welcome to {{companyName}}!',
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
                ]
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.details.variableCount).toBe(2);
        });

        it('should reject template with invalid name format', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                name: 'invalid template name!',
                content: 'Valid content'
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].code).toBe('ERR_INVALID_NAME_FORMAT');
        });

        it('should validate template content length restrictions', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                content: 'a'.repeat(1025) // Exceeds max length
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('ERR_CONTENT_TOO_LONG');
            expect(result.details.contentLength).toBe(1025);
        });

        it('should validate variable declarations match usage', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                content: 'Hello {{firstName}}, your balance is {{balance}}',
                variables: [
                    {
                        name: 'firstName',
                        type: VariableType.TEXT,
                        required: true,
                        defaultValue: null,
                        validation: null,
                        description: 'First name',
                        i18n: { en: 'First Name' }
                    }
                    // Missing balance variable declaration
                ]
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('ERR_UNDECLARED_VARIABLE');
            expect(result.errors[0].details.variableName).toBe('balance');
        });

        it('should validate currency variables in correct context', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                content: 'Your payment of {{amount}} is due',
                variables: [
                    {
                        name: 'amount',
                        type: VariableType.CURRENCY,
                        required: true,
                        defaultValue: null,
                        validation: null,
                        description: 'Payment amount',
                        i18n: { en: 'Amount' }
                    }
                ],
                metadata: { context: 'general' } // Invalid context for currency
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('ERR_INVALID_CURRENCY_CONTEXT');
        });

        it('should handle internationalization correctly', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate();
            const locale = 'es';

            // Act
            const result = await validateTemplate(template, locale);

            // Assert
            expect(result.details.localeSupported).toBe(true);
            expect(result.errors.every(error => 
                error.message.startsWith('es.')
            )).toBe(true);
        });

        it('should validate template version consistency', async () => {
            // Arrange
            const template = testDataGenerator.generateTemplate({
                version: 2,
                metadata: { previousVersion: 3 }
            });

            // Act
            const result = await validateTemplate(template);

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('ERR_INVALID_VERSION');
        });
    });

    describe('validateVariableType', () => {
        it('should validate date variable with custom validation', async () => {
            // Arrange
            const variable = {
                name: 'appointmentDate',
                type: VariableType.DATE,
                required: true,
                defaultValue: null,
                validation: {
                    minDate: new Date(),
                    maxDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                description: 'Appointment date',
                i18n: { en: 'Appointment Date' }
            };

            // Act
            const result = await validateVariableType(variable, 'appointment');

            // Assert
            expect(result.isValid).toBe(true);
        });

        it('should validate currency variables with proper formatting', async () => {
            // Arrange
            const variable = {
                name: 'price',
                type: VariableType.CURRENCY,
                required: true,
                defaultValue: null,
                validation: {
                    minAmount: 0,
                    maxAmount: 1000000,
                    decimals: 2
                },
                description: 'Product price',
                i18n: { en: 'Price' }
            };

            // Act
            const result = await validateVariableType(variable, 'pricing');

            // Assert
            expect(result.isValid).toBe(true);
        });
    });

    describe('extractVariables', () => {
        it('should extract all variables from complex template content', async () => {
            // Arrange
            const content = 'Hello {{firstName}} {{lastName}}, your order #{{orderId}} ' +
                          'for {{amount}} will be delivered on {{deliveryDate}}. ' +
                          'Contact {{supportEmail}} for assistance.';

            // Act
            const variables = await extractVariables(content);

            // Assert
            expect(variables).toHaveLength(6);
            expect(variables).toContain('firstName');
            expect(variables).toContain('lastName');
            expect(variables).toContain('orderId');
            expect(variables).toContain('amount');
            expect(variables).toContain('deliveryDate');
            expect(variables).toContain('supportEmail');
        });

        it('should handle nested variable patterns correctly', async () => {
            // Arrange
            const content = 'Hello {{user.firstName}} {{user.lastName}}, ' +
                          'your balance is {{account.balance}}';

            // Act
            const variables = await extractVariables(content);

            // Assert
            expect(variables).toHaveLength(3);
            expect(variables).toContain('user.firstName');
            expect(variables).toContain('user.lastName');
            expect(variables).toContain('account.balance');
        });
    });
});