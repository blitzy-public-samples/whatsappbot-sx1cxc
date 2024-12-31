// @version axios ^1.6.0

import { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest, 
  ValidationResult,
  templateSchema,
  TEMPLATE_NAME_MAX_LENGTH,
  TEMPLATE_CONTENT_MAX_LENGTH
} from '../../types/templates';
import { 
  ApiResponse, 
  PaginatedResponse, 
  ApiError, 
  PaginationParams,
  DEFAULT_PAGINATION_PARAMS
} from '../../types/api';
import { 
  apiClient, 
  API_ENDPOINTS, 
  CircuitBreaker 
} from '../../config/api';
import { AxiosError } from 'axios';

// Circuit breaker configuration for template operations
const templateBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000
});

// Interface for template filtering options
interface TemplateFilters {
  isActive?: boolean;
  organizationId?: string;
  createdBy?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

// Interface for template validation options
interface ValidationOptions {
  checkVariables?: boolean;
  strictMode?: boolean;
  organizationRules?: boolean;
}

/**
 * Templates API service providing CRUD operations and validation
 */
const templatesApi = {
  /**
   * Retrieves a paginated list of templates with filtering and sorting
   * @param page Current page number (1-based)
   * @param pageSize Number of items per page
   * @param sortBy Field to sort by
   * @param sortOrder Sort direction
   * @param filters Optional filtering criteria
   * @returns Paginated template response
   */
  async getTemplates(
    page: number = 1,
    pageSize: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filters?: TemplateFilters
  ): Promise<PaginatedResponse<Template>> {
    try {
      const params: PaginationParams = {
        ...DEFAULT_PAGINATION_PARAMS,
        page: Math.max(0, page - 1), // Convert to 0-based for API
        pageSize,
        sortBy,
        sortOrder,
        filters: filters || {},
        search: filters?.search || ''
      };

      const response = await templateBreaker.run(() => 
        apiClient.get<PaginatedResponse<Template>>(
          API_ENDPOINTS.TEMPLATES.BASE,
          { params }
        )
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Retrieves a single template by ID
   * @param id Template ID
   * @returns Template response
   */
  async getTemplateById(id: string): Promise<ApiResponse<Template>> {
    try {
      if (!id.trim()) {
        throw new Error('Template ID is required');
      }

      const response = await templateBreaker.run(() =>
        apiClient.get<ApiResponse<Template>>(`${API_ENDPOINTS.TEMPLATES.BASE}/${id}`)
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Creates a new template with validation
   * @param template Template creation request
   * @returns Created template response
   */
  async createTemplate(template: CreateTemplateRequest): Promise<ApiResponse<Template>> {
    try {
      // Validate template data against schema
      const validationResult = templateSchema.safeParse(template);
      if (!validationResult.success) {
        throw new Error(validationResult.error.message);
      }

      // Sanitize template content
      const sanitizedTemplate = {
        ...template,
        name: template.name.trim(),
        content: this.sanitizeTemplateContent(template.content)
      };

      const response = await templateBreaker.run(() =>
        apiClient.post<ApiResponse<Template>>(
          API_ENDPOINTS.TEMPLATES.BASE,
          sanitizedTemplate
        )
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Updates an existing template with validation
   * @param template Template update request
   * @returns Updated template response
   */
  async updateTemplate(template: UpdateTemplateRequest): Promise<ApiResponse<Template>> {
    try {
      if (!template.id) {
        throw new Error('Template ID is required for update');
      }

      // Validate template data against schema
      const validationResult = templateSchema.safeParse(template);
      if (!validationResult.success) {
        throw new Error(validationResult.error.message);
      }

      // Sanitize template content
      const sanitizedTemplate = {
        ...template,
        name: template.name.trim(),
        content: this.sanitizeTemplateContent(template.content)
      };

      const response = await templateBreaker.run(() =>
        apiClient.put<ApiResponse<Template>>(
          `${API_ENDPOINTS.TEMPLATES.BASE}/${template.id}`,
          sanitizedTemplate
        )
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Deletes a template with usage verification
   * @param id Template ID
   * @returns Deletion confirmation
   */
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    try {
      if (!id.trim()) {
        throw new Error('Template ID is required');
      }

      const response = await templateBreaker.run(() =>
        apiClient.delete<ApiResponse<void>>(`${API_ENDPOINTS.TEMPLATES.BASE}/${id}`)
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Validates a template against defined rules
   * @param template Template to validate
   * @param options Validation options
   * @returns Validation results
   */
  async validateTemplate(
    template: CreateTemplateRequest | UpdateTemplateRequest,
    options: ValidationOptions = {}
  ): Promise<ApiResponse<ValidationResult>> {
    try {
      const response = await templateBreaker.run(() =>
        apiClient.post<ApiResponse<ValidationResult>>(
          API_ENDPOINTS.TEMPLATES.VALIDATE,
          {
            template,
            options: {
              checkVariables: options.checkVariables ?? true,
              strictMode: options.strictMode ?? false,
              organizationRules: options.organizationRules ?? true
            }
          }
        )
      );

      return response.data;
    } catch (error) {
      throw this.handleTemplateError(error as AxiosError<ApiError>);
    }
  },

  /**
   * Sanitizes template content to prevent XSS and maintain length limits
   * @param content Template content to sanitize
   * @returns Sanitized content
   */
  private sanitizeTemplateContent(content: string): string {
    // Remove potentially harmful HTML/script tags
    let sanitized = content.replace(/<[^>]*>/g, '');
    
    // Ensure content length is within limits
    if (sanitized.length > TEMPLATE_CONTENT_MAX_LENGTH) {
      sanitized = sanitized.substring(0, TEMPLATE_CONTENT_MAX_LENGTH);
    }

    return sanitized;
  },

  /**
   * Handles and enhances template-related errors
   * @param error Original error
   * @returns Enhanced error with template context
   */
  private handleTemplateError(error: AxiosError<ApiError>): Error {
    if (error.response?.data) {
      const apiError = error.response.data;
      return new Error(`Template operation failed: ${apiError.message}`);
    }
    return new Error('Template operation failed: Network or server error');
  }
};

export default templatesApi;