// @version zod ^3.22.0
import { z } from 'zod';
import { LoadingState, BaseComponentProps } from '../types/common';

/**
 * Maximum length constraints for template-related fields
 */
export const TEMPLATE_NAME_MAX_LENGTH = 100;
export const TEMPLATE_CONTENT_MAX_LENGTH = 4096;
export const TEMPLATE_VARIABLE_NAME_MAX_LENGTH = 50;

/**
 * Enumeration of supported variable types for template placeholders
 */
export enum VariableType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
  CURRENCY = 'CURRENCY'
}

/**
 * Interface defining the structure of a template variable with validation support
 */
export interface TemplateVariable {
  /** Name of the variable (placeholder in template) */
  name: string;
  /** Type of the variable determining allowed values */
  type: VariableType;
  /** Whether this variable must be provided when using the template */
  required: boolean;
  /** Optional default value for the variable */
  defaultValue: string | number | boolean | null;
  /** Optional Zod schema for additional validation rules */
  validation: z.ZodSchema | null;
}

/**
 * Core template interface with multi-tenant support and audit fields
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
  /** Whether the template is currently active */
  isActive: boolean;
}

/**
 * Request type for creating a new template
 */
export interface CreateTemplateRequest {
  /** Name of the new template */
  name: string;
  /** Template content */
  content: string;
  /** Template variables configuration */
  variables: TemplateVariable[];
  /** Organization context */
  organizationId: string;
}

/**
 * Request type for updating an existing template
 */
export interface UpdateTemplateRequest {
  /** ID of the template to update */
  id: string;
  /** Updated template name */
  name: string;
  /** Updated template content */
  content: string;
  /** Updated variables configuration */
  variables: TemplateVariable[];
  /** Updated active status */
  isActive: boolean;
}

/**
 * Props interface for the template editor component
 * Extends BaseComponentProps for consistent component behavior
 */
export interface TemplateEditorProps extends BaseComponentProps {
  /** Template to edit, null for new template creation */
  template: Template | null;
  /** Callback for saving template changes */
  onSave: (template: CreateTemplateRequest | UpdateTemplateRequest) => Promise<void>;
  /** Callback for canceling edit operation */
  onCancel: () => void;
}

/**
 * Props interface for the template list component
 * Extends BaseComponentProps for consistent component behavior
 */
export interface TemplateListProps extends BaseComponentProps {
  /** Array of templates to display */
  templates: Template[];
  /** Callback for editing a template */
  onEdit: (template: Template) => void;
  /** Callback for deleting a template */
  onDelete: (id: string) => Promise<void>;
  /** Current loading state of the list */
  loadingState: LoadingState;
}

/**
 * Zod schema for template variable validation
 */
export const templateVariableSchema = z.object({
  name: z.string()
    .min(1, 'Variable name is required')
    .max(TEMPLATE_VARIABLE_NAME_MAX_LENGTH, `Variable name cannot exceed ${TEMPLATE_VARIABLE_NAME_MAX_LENGTH} characters`),
  type: z.nativeEnum(VariableType),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  validation: z.union([z.instanceof(z.ZodSchema), z.null()])
});

/**
 * Zod schema for template validation
 */
export const templateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(TEMPLATE_NAME_MAX_LENGTH, `Template name cannot exceed ${TEMPLATE_NAME_MAX_LENGTH} characters`),
  content: z.string()
    .min(1, 'Template content is required')
    .max(TEMPLATE_CONTENT_MAX_LENGTH, `Template content cannot exceed ${TEMPLATE_CONTENT_MAX_LENGTH} characters`),
  variables: z.array(templateVariableSchema),
  organizationId: z.string().uuid('Invalid organization ID'),
  isActive: z.boolean()
});

/**
 * Type guard to check if a template variable has validation rules
 */
export const hasValidation = (variable: TemplateVariable): variable is TemplateVariable & { validation: z.ZodSchema } => {
  return variable.validation !== null;
};

/**
 * Type guard to check if a value matches a template variable type
 */
export const isValidVariableValue = (value: unknown, type: VariableType): boolean => {
  switch (type) {
    case VariableType.TEXT:
      return typeof value === 'string';
    case VariableType.NUMBER:
      return typeof value === 'number' && !isNaN(value);
    case VariableType.DATE:
      return value instanceof Date && !isNaN(value.getTime());
    case VariableType.BOOLEAN:
      return typeof value === 'boolean';
    case VariableType.CURRENCY:
      return typeof value === 'number' && !isNaN(value) && value >= 0;
    default:
      return false;
  }
};