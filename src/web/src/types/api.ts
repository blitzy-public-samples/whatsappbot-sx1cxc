// @package axios ^1.6.0
import { AxiosError } from 'axios';

/**
 * Global constants for API configuration
 */
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_TIMEOUT = 30000;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

/**
 * Interface for validation errors returned by the API
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Validation error message */
  message: string;
}

/**
 * Generic wrapper interface for all API responses
 * @template T - Type of the response data
 */
export interface ApiResponse<T> {
  /** Response payload */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response message */
  message: string;
  /** Response timestamp in ISO format */
  timestamp: string;
}

/**
 * Interface for paginated API responses
 * @template T - Type of items in the response
 */
export interface PaginatedResponse<T> {
  /** Array of items in the current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (0-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Indicates if there is a next page */
  hasNext: boolean;
  /** Indicates if there is a previous page */
  hasPrevious: boolean;
}

/**
 * Comprehensive API error response interface
 */
export interface ApiError {
  /** Error code (matches HTTP status or custom error code) */
  code: number;
  /** Error message */
  message: string;
  /** Array of validation errors if applicable */
  errors: ValidationError[];
  /** Error timestamp in ISO format */
  timestamp: string;
  /** Request path that generated the error */
  path: string;
  /** Unique request identifier for tracing */
  requestId: string;
}

/**
 * Extended HTTP request configuration options
 */
export interface RequestConfig {
  /** Custom request headers */
  headers: Record<string, string>;
  /** URL query parameters */
  params: Record<string, string | number | boolean>;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether to send cookies with the request */
  withCredentials: boolean;
  /** Number of retry attempts for failed requests */
  retryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
}

/**
 * Interface for pagination, sorting, and filtering parameters
 */
export interface PaginationParams {
  /** Page number (0-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
  /** Key-value pairs for filtering results */
  filters: Record<string, any>;
  /** Search query string */
  search: string;
}

/**
 * Type guard to check if an error is an API error
 * @param error - Error to check
 * @returns boolean indicating if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const potentialApiError = error as Partial<ApiError>;

  // Check required properties and their types
  if (
    typeof potentialApiError.code !== 'number' ||
    typeof potentialApiError.message !== 'string' ||
    !Array.isArray(potentialApiError.errors) ||
    typeof potentialApiError.timestamp !== 'string' ||
    typeof potentialApiError.path !== 'string' ||
    typeof potentialApiError.requestId !== 'string'
  ) {
    return false;
  }

  // Validate that all errors in the errors array are ValidationErrors
  if (!potentialApiError.errors.every(error => 
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ValidationError).field === 'string' &&
    typeof (error as ValidationError).message === 'string'
  )) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if an error is an Axios error
 * @param error - Error to check
 * @returns boolean indicating if error is an AxiosError
 */
export function isAxiosError<T = any>(error: unknown): error is AxiosError<T> {
  return (error as AxiosError)?.isAxiosError === true;
}

/**
 * Type for API response with pagination metadata
 */
export type PaginatedApiResponse<T> = ApiResponse<PaginatedResponse<T>>;

/**
 * Default request configuration
 */
export const DEFAULT_REQUEST_CONFIG: RequestConfig = {
  headers: {},
  params: {},
  timeout: DEFAULT_TIMEOUT,
  withCredentials: true,
  retryAttempts: MAX_RETRY_ATTEMPTS,
  retryDelay: RETRY_DELAY_MS,
};

/**
 * Default pagination parameters
 */
export const DEFAULT_PAGINATION_PARAMS: PaginationParams = {
  page: 0,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  filters: {},
  search: '',
};