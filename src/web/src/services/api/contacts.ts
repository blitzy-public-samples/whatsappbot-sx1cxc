// @package axios ^1.6.0
// @package lodash ^4.17.21

import { AxiosResponse, AxiosError, CancelTokenSource } from 'axios';
import { debounce } from 'lodash';
import {
  Contact,
  ContactGroup,
  ContactFormData,
  ContactListResponse,
  ContactGroupListResponse,
  ContactImportOptions,
  ContactExportOptions,
  ContactSearchParams,
  ContactBatchResponse
} from '../../types/contacts';
import apiClient, { API_ENDPOINTS } from '../../config/api';
import { ApiError, RequestConfig, PaginationParams, isApiError } from '../../types/api';

// Constants for caching and performance optimization
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SEARCH_DEBOUNCE_DELAY = 300; // 300ms
const MAX_RETRIES = 3;

// Cache implementation
const contactCache = new Map<string, { data: any; timestamp: number }>();

// Request cancellation tracking
const pendingRequests = new Map<string, CancelTokenSource>();

/**
 * Contact API service with enhanced error handling and caching
 */
export const contactsApi = {
  /**
   * Retrieves a paginated list of contacts with search and filtering
   * @param params Search and pagination parameters
   * @param config Optional request configuration
   * @returns Promise with paginated contact list
   */
  getContacts: async (
    params: ContactSearchParams,
    config?: RequestConfig
  ): Promise<ContactListResponse> => {
    const cacheKey = `contacts-${JSON.stringify(params)}`;
    
    // Cancel any pending requests for the same search
    if (pendingRequests.has(cacheKey)) {
      pendingRequests.get(cacheKey)?.cancel('Request superseded');
      pendingRequests.delete(cacheKey);
    }

    // Check cache
    const cached = contactCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const source = apiClient.CancelToken.source();
    pendingRequests.set(cacheKey, source);

    try {
      const response = await apiClient.get<ContactListResponse>(
        API_ENDPOINTS.CONTACTS.BASE,
        {
          params,
          cancelToken: source.token,
          ...config
        }
      );

      // Cache successful response
      contactCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to fetch contacts');
    } finally {
      pendingRequests.delete(cacheKey);
    }
  },

  /**
   * Retrieves a single contact by ID
   * @param id Contact ID
   * @param config Optional request configuration
   * @returns Promise with contact details
   */
  getContact: async (id: string, config?: RequestConfig): Promise<Contact> => {
    const cacheKey = `contact-${id}`;
    const cached = contactCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await apiClient.get<Contact>(
        `${API_ENDPOINTS.CONTACTS.BASE}/${id}`,
        config
      );

      contactCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to fetch contact');
    }
  },

  /**
   * Creates a new contact
   * @param data Contact form data
   * @param config Optional request configuration
   * @returns Promise with created contact
   */
  createContact: async (
    data: ContactFormData,
    config?: RequestConfig
  ): Promise<Contact> => {
    try {
      const response = await apiClient.post<Contact>(
        API_ENDPOINTS.CONTACTS.BASE,
        data,
        config
      );
      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to create contact');
    }
  },

  /**
   * Updates an existing contact
   * @param id Contact ID
   * @param data Updated contact data
   * @param config Optional request configuration
   * @returns Promise with updated contact
   */
  updateContact: async (
    id: string,
    data: Partial<ContactFormData>,
    config?: RequestConfig
  ): Promise<Contact> => {
    try {
      const response = await apiClient.put<Contact>(
        `${API_ENDPOINTS.CONTACTS.BASE}/${id}`,
        data,
        config
      );

      // Invalidate cache
      contactCache.delete(`contact-${id}`);
      
      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to update contact');
    }
  },

  /**
   * Deletes a contact
   * @param id Contact ID
   * @param config Optional request configuration
   * @returns Promise<void>
   */
  deleteContact: async (id: string, config?: RequestConfig): Promise<void> => {
    try {
      await apiClient.delete(`${API_ENDPOINTS.CONTACTS.BASE}/${id}`, config);
      // Invalidate cache
      contactCache.delete(`contact-${id}`);
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to delete contact');
    }
  },

  /**
   * Imports contacts from a file
   * @param file File to import
   * @param options Import options
   * @param config Optional request configuration
   * @returns Promise with import results
   */
  importContacts: async (
    file: File,
    options: ContactImportOptions,
    config?: RequestConfig
  ): Promise<ContactBatchResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));

    try {
      const response = await apiClient.post<ContactBatchResponse>(
        API_ENDPOINTS.CONTACTS.IMPORT,
        formData,
        {
          ...config,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to import contacts');
    }
  },

  /**
   * Exports contacts based on specified options
   * @param options Export options
   * @param config Optional request configuration
   * @returns Promise with exported file blob
   */
  exportContacts: async (
    options: ContactExportOptions,
    config?: RequestConfig
  ): Promise<Blob> => {
    try {
      const response = await apiClient.post(
        `${API_ENDPOINTS.CONTACTS.BASE}/export`,
        options,
        {
          ...config,
          responseType: 'blob'
        }
      );
      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to export contacts');
    }
  },

  /**
   * Retrieves contact groups
   * @param params Pagination parameters
   * @param config Optional request configuration
   * @returns Promise with paginated group list
   */
  getContactGroups: async (
    params: PaginationParams,
    config?: RequestConfig
  ): Promise<ContactGroupListResponse> => {
    try {
      const response = await apiClient.get<ContactGroupListResponse>(
        API_ENDPOINTS.CONTACTS.GROUPS,
        {
          params,
          ...config
        }
      );
      return response.data;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      throw new Error('Failed to fetch contact groups');
    }
  },

  /**
   * Clears the contact cache
   */
  clearCache: (): void => {
    contactCache.clear();
  }
};

// Export debounced search function for components
export const debouncedContactSearch = debounce(
  (params: ContactSearchParams) => contactsApi.getContacts(params),
  SEARCH_DEBOUNCE_DELAY
);