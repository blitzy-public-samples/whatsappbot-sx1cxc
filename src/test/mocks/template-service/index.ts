/**
 * @fileoverview Mock implementation of the template service for testing purposes.
 * Provides controlled test data and behavior simulation with support for
 * multi-tenancy, versioning, and template categorization.
 * @version 1.0.0
 */

import { Template, TemplateCreateInput, TemplateUpdateInput } from '../../../backend/template-service/src/types';
import { jest } from 'jest'; // v29.0.0

/**
 * In-memory storage for mock templates with enhanced metadata
 */
const mockTemplates = new Map<
  string,
  Template & { organizationId: string; userId: string; createdAt: Date; updatedAt: Date }
>();

/**
 * Counter for generating unique template IDs
 */
let mockTemplateCounter = 0;

/**
 * Creates a mock template with auto-generated ID and enhanced metadata
 * @param input Template creation input data
 * @param organizationId Organization identifier for multi-tenancy
 * @param userId User identifier for audit tracking
 * @returns Created mock template object with metadata
 */
export const createMockTemplate = async (
  input: TemplateCreateInput,
  organizationId: string,
  userId: string
): Promise<Template> => {
  const templateId = `template_${++mockTemplateCounter}`;
  const now = new Date();

  const template: Template = {
    id: templateId,
    name: input.name,
    content: input.content,
    variables: input.variables,
    organizationId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    version: 1,
    category: input.category,
    metadata: input.metadata || {}
  };

  mockTemplates.set(templateId, {
    ...template,
    organizationId,
    userId,
    createdAt: now,
    updatedAt: now
  });

  return template;
};

/**
 * Retrieves a mock template by ID with organization validation
 * @param templateId Template identifier
 * @param organizationId Organization identifier for access control
 * @returns Template if found and authorized, null otherwise
 */
export const getMockTemplate = async (
  templateId: string,
  organizationId: string
): Promise<Template | null> => {
  const template = mockTemplates.get(templateId);
  
  if (!template || template.organizationId !== organizationId) {
    return null;
  }

  return template;
};

/**
 * Lists all mock templates for an organization with filtering
 * @param organizationId Organization identifier
 * @param filters Optional filters for category and active status
 * @returns Array of filtered templates
 */
export const listMockTemplates = async (
  organizationId: string,
  filters?: { category?: string; isActive?: boolean }
): Promise<Template[]> => {
  const templates = Array.from(mockTemplates.values())
    .filter(template => template.organizationId === organizationId)
    .filter(template => {
      if (filters?.category && template.category !== filters.category) {
        return false;
      }
      if (filters?.isActive !== undefined && template.isActive !== filters.isActive) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return templates;
};

/**
 * Updates a mock template with version tracking
 * @param templateId Template identifier
 * @param input Template update input data
 * @param organizationId Organization identifier for access control
 * @returns Updated template object
 * @throws Error if template not found or unauthorized
 */
export const updateMockTemplate = async (
  templateId: string,
  input: TemplateUpdateInput,
  organizationId: string
): Promise<Template> => {
  const existingTemplate = mockTemplates.get(templateId);

  if (!existingTemplate || existingTemplate.organizationId !== organizationId) {
    throw new Error(`Template not found or unauthorized: ${templateId}`);
  }

  const updatedTemplate: Template = {
    ...existingTemplate,
    name: input.name,
    content: input.content,
    variables: input.variables,
    isActive: input.isActive,
    category: input.category,
    metadata: input.metadata || {},
    version: existingTemplate.version + 1,
    updatedAt: new Date()
  };

  mockTemplates.set(templateId, updatedTemplate);

  return updatedTemplate;
};

/**
 * Deletes a mock template with validation
 * @param templateId Template identifier
 * @param organizationId Organization identifier for access control
 * @throws Error if template not found or unauthorized
 */
export const deleteMockTemplate = async (
  templateId: string,
  organizationId: string
): Promise<void> => {
  const template = mockTemplates.get(templateId);

  if (!template || template.organizationId !== organizationId) {
    throw new Error(`Template not found or unauthorized: ${templateId}`);
  }

  mockTemplates.delete(templateId);
};

/**
 * Resets all mock data for test isolation
 * Useful for cleaning up between tests
 */
export const resetMockTemplates = (): void => {
  mockTemplates.clear();
  mockTemplateCounter = 0;
};