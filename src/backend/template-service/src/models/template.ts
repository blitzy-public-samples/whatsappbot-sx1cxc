/**
 * @fileoverview Enhanced template model implementation with comprehensive validation,
 * i18n support, and multi-tenant isolation for the WhatsApp Web Enhancement Application.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import i18next from 'i18next'; // v23.5.0
import { Template, TemplateVariable, TemplateValidationError } from '../types';
import { validateTemplate } from '../services/template-validator';

// Constants for template configuration
const DEFAULT_TEMPLATE_STATUS = true;
const TEMPLATE_NAME_MAX_LENGTH = 64;
const TEMPLATE_CONTENT_MAX_LENGTH = 4096;
const TEMPLATE_CACHE_TTL = 3600;

/**
 * Options for template initialization and updates
 */
interface TemplateOptions {
    locale?: string;
    validateOnCreate?: boolean;
    strictMode?: boolean;
}

/**
 * Options for template validation
 */
interface ValidationOptions {
    checkI18n?: boolean;
    validateVariables?: boolean;
    context?: string;
}

/**
 * Options for template updates
 */
interface UpdateOptions extends TemplateOptions {
    incrementVersion?: boolean;
    preserveMetadata?: boolean;
}

/**
 * Options for JSON serialization
 */
interface SerializationOptions {
    includeMetadata?: boolean;
    includeValidation?: boolean;
    includeI18n?: boolean;
}

/**
 * Enhanced template model class implementing comprehensive template management
 * with validation and i18n support.
 */
export class TemplateModel {
    private readonly id: string;
    private name: string;
    private content: string;
    private variables: TemplateVariable[];
    private readonly organizationId: string;
    private readonly createdBy: string;
    private readonly createdAt: Date;
    private updatedAt: Date;
    private isActive: boolean;
    private version: number;
    private category: string;
    private metadata: Record<string, unknown>;
    private supportedLocales: string[];

    /**
     * Creates a new template instance with enhanced validation and initialization
     * @param templateData - Initial template data
     * @param options - Template initialization options
     * @throws {Error} If template validation fails
     */
    constructor(templateData: Template, options: TemplateOptions = {}) {
        // Validate input using Zod schema
        const templateSchema = z.object({
            id: z.string().uuid(),
            name: z.string().max(TEMPLATE_NAME_MAX_LENGTH),
            content: z.string().max(TEMPLATE_CONTENT_MAX_LENGTH),
            variables: z.array(z.object({
                name: z.string(),
                type: z.enum(['text', 'number', 'date', 'boolean', 'currency']),
                required: z.boolean(),
                defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
                validation: z.any().nullable(),
                description: z.string(),
                i18n: z.record(z.string())
            })),
            organizationId: z.string().uuid(),
            createdBy: z.string().uuid(),
            category: z.string(),
            metadata: z.record(z.unknown())
        });

        const validatedData = templateSchema.parse(templateData);

        // Initialize core properties
        this.id = validatedData.id;
        this.name = validatedData.name;
        this.content = validatedData.content;
        this.variables = validatedData.variables;
        this.organizationId = validatedData.organizationId;
        this.createdBy = validatedData.createdBy;
        this.category = validatedData.category;
        this.metadata = validatedData.metadata;

        // Initialize system properties
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.isActive = DEFAULT_TEMPLATE_STATUS;
        this.version = 1;
        this.supportedLocales = ['en', 'es', 'pt', 'fr'];

        // Perform enhanced validation if required
        if (options.validateOnCreate) {
            this.validate({ 
                checkI18n: true,
                validateVariables: true,
                context: this.metadata.context as string
            });
        }
    }

    /**
     * Comprehensive template validation with enhanced checks
     * @param options - Validation options
     * @returns Promise resolving to validation result
     */
    async validate(options: ValidationOptions = {}): Promise<{
        isValid: boolean;
        errors: TemplateValidationError[];
    }> {
        const validationResult = await validateTemplate({
            id: this.id,
            name: this.name,
            content: this.content,
            variables: this.variables,
            organizationId: this.organizationId,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isActive: this.isActive,
            version: this.version,
            category: this.category,
            metadata: this.metadata
        }, options.context || 'en');

        // Additional i18n validation if required
        if (options.checkI18n) {
            this.variables.forEach(variable => {
                const missingLocales = this.supportedLocales.filter(
                    locale => !variable.i18n[locale]
                );
                if (missingLocales.length > 0) {
                    validationResult.errors.push({
                        field: `variables.${variable.name}.i18n`,
                        message: `Missing translations for locales: ${missingLocales.join(', ')}`,
                        code: 'ERR_MISSING_TRANSLATIONS',
                        details: { missingLocales },
                        path: ['variables', variable.name, 'i18n']
                    });
                }
            });
        }

        return validationResult;
    }

    /**
     * Updates template with version control and validation
     * @param updateData - Partial template data to update
     * @param options - Update options
     * @throws {Error} If update validation fails
     */
    async update(updateData: Partial<Template>, options: UpdateOptions = {}): Promise<void> {
        // Validate update data
        const updateSchema = z.object({
            name: z.string().max(TEMPLATE_NAME_MAX_LENGTH).optional(),
            content: z.string().max(TEMPLATE_CONTENT_MAX_LENGTH).optional(),
            variables: z.array(z.object({
                name: z.string(),
                type: z.enum(['text', 'number', 'date', 'boolean', 'currency']),
                required: z.boolean(),
                defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
                validation: z.any().nullable(),
                description: z.string(),
                i18n: z.record(z.string())
            })).optional(),
            category: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        });

        const validatedUpdate = updateSchema.parse(updateData);

        // Update properties
        Object.assign(this, validatedUpdate);

        // Update version and timestamp
        if (options.incrementVersion !== false) {
            this.version++;
        }
        this.updatedAt = new Date();

        // Validate updated template
        if (options.strictMode) {
            const validationResult = await this.validate({
                checkI18n: true,
                validateVariables: true,
                context: this.metadata.context as string
            });

            if (!validationResult.isValid) {
                throw new Error(`Template update validation failed: ${
                    validationResult.errors.map(e => e.message).join(', ')
                }`);
            }
        }
    }

    /**
     * Enhanced JSON serialization with metadata
     * @param options - Serialization options
     * @returns JSON representation of the template
     */
    toJSON(options: SerializationOptions = {}): object {
        const base = {
            id: this.id,
            name: this.name,
            content: this.content,
            variables: this.variables,
            category: this.category,
            version: this.version,
            isActive: this.isActive,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };

        if (options.includeMetadata) {
            Object.assign(base, {
                metadata: this.metadata,
                organizationId: this.organizationId,
                createdBy: this.createdBy
            });
        }

        if (options.includeI18n) {
            Object.assign(base, {
                supportedLocales: this.supportedLocales
            });
        }

        return base;
    }
}