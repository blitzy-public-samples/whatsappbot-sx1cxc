/**
 * @fileoverview Enhanced template validation service with internationalization support
 * and performance optimization for WhatsApp message templates.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import i18next from 'i18next'; // v23.5.0
import {
    Template,
    TemplateVariable,
    TemplateValidationError,
    VariableType
} from '../types';

// Constants for template validation
const MAX_TEMPLATE_NAME_LENGTH = 64;
const MAX_TEMPLATE_CONTENT_LENGTH = 1024;
const MAX_VARIABLES_PER_TEMPLATE = 10;
const VARIABLE_PATTERN = /\{([^}]+)\}/g;
const VALIDATION_CACHE_TTL = 3600;
const SUPPORTED_LOCALES = ['en', 'es', 'pt', 'fr'];

// Zod schemas for validation
const templateSchema = z.object({
    name: z.string()
        .min(1, 'Template name is required')
        .max(MAX_TEMPLATE_NAME_LENGTH, `Template name cannot exceed ${MAX_TEMPLATE_NAME_LENGTH} characters`)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Template name must contain only alphanumeric characters, underscores, and hyphens'),
    content: z.string()
        .min(1, 'Template content is required')
        .max(MAX_TEMPLATE_CONTENT_LENGTH, `Template content cannot exceed ${MAX_TEMPLATE_CONTENT_LENGTH} characters`),
    variables: z.array(z.object({
        name: z.string(),
        type: z.nativeEnum(VariableType),
        validation: z.any().optional(),
    })).max(MAX_VARIABLES_PER_TEMPLATE)
});

/**
 * Interface for validation results with detailed feedback
 */
export interface ValidationResult {
    isValid: boolean;
    errors: TemplateValidationError[];
    details: {
        variableCount: number;
        contentLength: number;
        localeSupported: boolean;
    };
}

/**
 * Cache for validation results to improve performance
 */
const validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();

/**
 * Performance monitoring decorator
 */
function performanceMonitor(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        const start = performance.now();
        const result = await originalMethod.apply(this, args);
        const end = performance.now();
        console.debug(`${propertyKey} execution time: ${end - start}ms`);
        return result;
    };
    return descriptor;
}

/**
 * Validates template input with caching and i18n support
 * @param template - Template to validate
 * @param locale - Locale for error messages
 * @returns Validation result with detailed feedback
 */
@performanceMonitor
export async function validateTemplate(
    template: Template,
    locale: string = 'en'
): Promise<ValidationResult> {
    // Check cache first
    const cacheKey = `${template.id}_${locale}`;
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < VALIDATION_CACHE_TTL * 1000) {
        return cachedResult.result;
    }

    const errors: TemplateValidationError[] = [];
    let isValid = true;

    try {
        // Validate basic structure using Zod
        await templateSchema.parseAsync(template);

        // Validate variables
        const extractedVars = await extractVariables(template.content);
        const declaredVars = new Set(template.variables.map(v => v.name));
        
        // Check for undeclared variables
        extractedVars.forEach(varName => {
            if (!declaredVars.has(varName)) {
                errors.push({
                    field: 'variables',
                    message: i18next.t('errors.undeclaredVariable', { variable: varName }),
                    code: 'ERR_UNDECLARED_VARIABLE',
                    details: { variableName: varName },
                    path: ['variables']
                });
                isValid = false;
            }
        });

        // Validate each variable type and context
        for (const variable of template.variables) {
            const typeValidation = await validateVariableType(variable, template.metadata?.context, locale);
            if (!typeValidation.isValid) {
                errors.push(...typeValidation.errors);
                isValid = false;
            }
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(err => ({
                field: err.path.join('.'),
                message: i18next.t(`errors.${err.code}`, { field: err.path.join('.') }),
                code: `ERR_${err.code}`,
                details: err,
                path: err.path
            })));
            isValid = false;
        } else {
            throw error;
        }
    }

    const result: ValidationResult = {
        isValid,
        errors,
        details: {
            variableCount: template.variables.length,
            contentLength: template.content.length,
            localeSupported: SUPPORTED_LOCALES.includes(locale)
        }
    };

    // Cache the result
    validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
    });

    return result;
}

/**
 * Validates variable type with context awareness
 * @param variable - Variable to validate
 * @param context - Context for validation
 * @param locale - Locale for error messages
 * @returns Validation result
 */
@performanceMonitor
export async function validateVariableType(
    variable: TemplateVariable,
    context?: string,
    locale: string = 'en'
): Promise<ValidationResult> {
    const errors: TemplateValidationError[] = [];
    let isValid = true;

    // Validate based on variable type
    switch (variable.type) {
        case VariableType.CURRENCY:
            if (context && !['invoice', 'payment', 'pricing'].includes(context)) {
                errors.push({
                    field: 'type',
                    message: i18next.t('errors.invalidCurrencyContext'),
                    code: 'ERR_INVALID_CURRENCY_CONTEXT',
                    details: { context },
                    path: ['variables', variable.name, 'type']
                });
                isValid = false;
            }
            break;

        case VariableType.DATE:
            if (variable.validation) {
                try {
                    await variable.validation.parseAsync(new Date());
                } catch (error) {
                    errors.push({
                        field: 'validation',
                        message: i18next.t('errors.invalidDateValidation'),
                        code: 'ERR_INVALID_DATE_VALIDATION',
                        details: { error },
                        path: ['variables', variable.name, 'validation']
                    });
                    isValid = false;
                }
            }
            break;
    }

    return {
        isValid,
        errors,
        details: {
            variableCount: 1,
            contentLength: 0,
            localeSupported: SUPPORTED_LOCALES.includes(locale)
        }
    };
}

/**
 * Extracts variables from template content with enhanced pattern matching
 * @param content - Template content
 * @returns Array of variable names
 */
@performanceMonitor
export async function extractVariables(content: string): Promise<string[]> {
    const variables = new Set<string>();
    let match;

    while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
        variables.add(match[1].trim());
    }

    return Array.from(variables);
}

// Clear validation cache periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of validationCache.entries()) {
        if (now - value.timestamp > VALIDATION_CACHE_TTL * 1000) {
            validationCache.delete(key);
        }
    }
}, VALIDATION_CACHE_TTL * 1000);