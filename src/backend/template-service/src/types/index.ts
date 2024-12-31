/**
 * @fileoverview Core type definitions for the template service.
 * Provides comprehensive type safety and validation for template management,
 * variable handling, and multi-tenant support.
 * @version 1.0.0
 */

// External imports
import * as z from 'zod'; // v3.22.0 - Runtime type validation

/**
 * Enumeration of supported variable types in templates.
 * Includes business-specific types like CURRENCY for financial templates.
 */
export enum VariableType {
    TEXT = 'text',
    NUMBER = 'number',
    DATE = 'date',
    BOOLEAN = 'boolean',
    CURRENCY = 'currency'
}

/**
 * Comprehensive template interface definition with support for versioning,
 * categorization, and metadata.
 */
export interface Template {
    /** Unique identifier for the template */
    id: string;

    /** Human-readable name of the template */
    name: string;

    /** Template content with variable placeholders */
    content: string;

    /** Array of variables used in the template */
    variables: TemplateVariable[];

    /** Organization ID for multi-tenant support */
    organizationId: string;

    /** User ID who created the template */
    createdBy: string;

    /** Template creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;

    /** Flag indicating if template is currently active */
    isActive: boolean;

    /** Template version number for tracking changes */
    version: number;

    /** Category for template organization and filtering */
    category: string;

    /** Additional template metadata for extensibility */
    metadata: Record<string, unknown>;
}

/**
 * Enhanced template variable structure with validation, i18n support,
 * and documentation.
 */
export interface TemplateVariable {
    /** Variable name used in template placeholders */
    name: string;

    /** Data type of the variable */
    type: VariableType;

    /** Indicates if the variable must be provided */
    required: boolean;

    /** Default value if none provided */
    defaultValue: string | number | boolean | null;

    /** Zod schema for runtime validation */
    validation: z.ZodSchema | null;

    /** Human-readable description of the variable */
    description: string;

    /** Internationalization labels for the variable */
    i18n: Record<string, string>;
}

/**
 * Detailed error type for template validation with enhanced error context.
 * Provides structured error information for better error handling and reporting.
 */
export interface TemplateValidationError {
    /** Field that caused the validation error */
    field: string;

    /** Human-readable error message */
    message: string;

    /** Machine-readable error code */
    code: string;

    /** Additional error context */
    details: Record<string, unknown>;

    /** Path to the error in the object structure */
    path: string[];
}

/**
 * Input type for template creation with category and metadata support.
 * Excludes system-generated fields like id, timestamps, and version.
 */
export interface TemplateCreateInput {
    /** Template name */
    name: string;

    /** Template content */
    content: string;

    /** Template variables */
    variables: TemplateVariable[];

    /** Template category */
    category: string;

    /** Optional metadata */
    metadata: Record<string, unknown>;
}

/**
 * Input type for template updates with enhanced metadata and category support.
 * Includes all mutable fields that can be updated.
 */
export interface TemplateUpdateInput {
    /** Updated template name */
    name: string;

    /** Updated template content */
    content: string;

    /** Updated template variables */
    variables: TemplateVariable[];

    /** Updated active status */
    isActive: boolean;

    /** Updated category */
    category: string;

    /** Updated metadata */
    metadata: Record<string, unknown>;
}