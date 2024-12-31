// @version react ^18.2.0
// @version react-redux ^8.1.0
// @version use-debounce ^9.0.0

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useDebounce } from 'use-debounce';
import {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateValidation
} from '../../types/templates';
import {
  selectTemplates,
  selectTemplateById,
  selectTemplatesLoading,
  selectTemplatesError,
  selectTemplatesPagination,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setSelectedTemplate,
  clearValidationErrors
} from '../../store/slices/templatesSlice';

// Constants for template management
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE = 1;
const VALIDATION_DEBOUNCE_MS = 300;
const MAX_TEMPLATE_SIZE_KB = 64;

/**
 * Custom hook for comprehensive template management with optimistic updates
 * and accessibility support
 */
export const useTemplates = ({
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
  filters = {}
} = {}) => {
  // Redux state management
  const dispatch = useDispatch();
  const templates = useSelector(selectTemplates);
  const loading = useSelector(selectTemplatesLoading);
  const error = useSelector(selectTemplatesError);
  const pagination = useSelector(selectTemplatesPagination);

  // Local state management
  const [selectedTemplate, setSelected] = useState<Template | null>(null);
  const [validationState, setValidationState] = useState<TemplateValidation>({
    isValid: true,
    errors: []
  });

  // Debounced validation to prevent excessive API calls
  const [debouncedValidation] = useDebounce(
    (template: Template) => validateTemplate(template),
    VALIDATION_DEBOUNCE_MS
  );

  /**
   * Fetches templates with pagination and filtering
   */
  const fetchTemplatesData = useCallback(async (
    currentPage = page,
    currentPageSize = pageSize,
    currentFilters = filters
  ) => {
    try {
      await dispatch(fetchTemplates({
        page: currentPage,
        pageSize: currentPageSize,
        filters: currentFilters
      })).unwrap();
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      // Announce error for screen readers
      announceError('Failed to load templates. Please try again.');
    }
  }, [dispatch, page, pageSize, filters]);

  /**
   * Creates a new template with validation
   */
  const createTemplateData = useCallback(async (
    templateData: CreateTemplateRequest
  ): Promise<Template> => {
    try {
      const validationResult = await validateTemplate(templateData as Template);
      if (!validationResult.isValid) {
        throw new Error('Template validation failed');
      }

      const result = await dispatch(createTemplate(templateData)).unwrap();
      announceSuccess('Template created successfully');
      return result;
    } catch (error) {
      console.error('Failed to create template:', error);
      announceError('Failed to create template. Please check your input.');
      throw error;
    }
  }, [dispatch]);

  /**
   * Updates an existing template with optimistic updates
   */
  const updateTemplateData = useCallback(async (
    templateData: UpdateTemplateRequest
  ): Promise<Template> => {
    try {
      const validationResult = await validateTemplate(templateData as Template);
      if (!validationResult.isValid) {
        throw new Error('Template validation failed');
      }

      const result = await dispatch(updateTemplate(templateData)).unwrap();
      announceSuccess('Template updated successfully');
      return result;
    } catch (error) {
      console.error('Failed to update template:', error);
      announceError('Failed to update template. Please check your input.');
      throw error;
    }
  }, [dispatch]);

  /**
   * Deletes a template with confirmation
   */
  const deleteTemplateData = useCallback(async (id: string): Promise<void> => {
    try {
      await dispatch(deleteTemplate(id)).unwrap();
      announceSuccess('Template deleted successfully');
    } catch (error) {
      console.error('Failed to delete template:', error);
      announceError('Failed to delete template. Please try again.');
      throw error;
    }
  }, [dispatch]);

  /**
   * Validates template data against schema and business rules
   */
  const validateTemplate = useCallback(async (
    template: Template
  ): Promise<TemplateValidation> => {
    const errors = [];

    // Size validation
    const templateSize = new Blob([JSON.stringify(template)]).size / 1024;
    if (templateSize > MAX_TEMPLATE_SIZE_KB) {
      errors.push({
        field: 'content',
        message: `Template size exceeds maximum limit of ${MAX_TEMPLATE_SIZE_KB}KB`
      });
    }

    // Variable validation
    const variablePattern = /\{([^}]+)\}/g;
    const contentVariables = Array.from(template.content.matchAll(variablePattern))
      .map(match => match[1]);
    
    const declaredVariables = template.variables.map(v => v.name);
    const undeclaredVariables = contentVariables.filter(
      v => !declaredVariables.includes(v)
    );

    if (undeclaredVariables.length > 0) {
      errors.push({
        field: 'variables',
        message: `Undeclared variables found: ${undeclaredVariables.join(', ')}`
      });
    }

    const validation = {
      isValid: errors.length === 0,
      errors
    };

    setValidationState(validation);
    return validation;
  }, []);

  /**
   * Previews template with variable interpolation
   */
  const previewTemplate = useCallback((
    template: Template,
    variables: Record<string, string>
  ): string => {
    let preview = template.content;
    template.variables.forEach(variable => {
      const value = variables[variable.name] || variable.defaultValue?.toString() || '';
      preview = preview.replace(new RegExp(`\\{${variable.name}\\}`, 'g'), value);
    });
    return preview;
  }, []);

  /**
   * Announces messages for screen readers
   */
  const announceError = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  const announceSuccess = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Initial data fetch
  useEffect(() => {
    fetchTemplatesData();
  }, [fetchTemplatesData]);

  // Cleanup validation state when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearValidationErrors());
    };
  }, [dispatch]);

  // Memoized template selection by ID
  const selectTemplateById = useCallback((id: string) => {
    const template = templates.find(t => t.id === id);
    setSelected(template || null);
  }, [templates]);

  return {
    templates,
    loading,
    selectedTemplate,
    error,
    pagination,
    validation: validationState,
    fetchTemplates: fetchTemplatesData,
    createTemplate: createTemplateData,
    updateTemplate: updateTemplateData,
    deleteTemplate: deleteTemplateData,
    selectTemplate: selectTemplateById,
    clearSelectedTemplate: () => setSelected(null),
    validateTemplate: debouncedValidation,
    previewTemplate
  };
};

export default useTemplates;