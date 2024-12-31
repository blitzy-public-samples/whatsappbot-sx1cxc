// @package axios ^1.6.0
import { AxiosError } from 'axios';
import { ApiError, ValidationError, isApiError, isAxiosError } from '../types/api';

/**
 * Error severity levels for logging and monitoring
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Standard HTTP and custom error codes mapping
 */
export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Cache configuration for error messages to improve performance
 */
const ERROR_CACHE_TTL = 300000; // 5 minutes in milliseconds
const errorCache = new Map<string, { message: string; timestamp: number }>();

/**
 * Default error message when specific error details are not available
 */
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

/**
 * Enhanced type guard to check if an error contains validation errors
 * @param error - Error object to validate
 * @returns boolean indicating if the error contains valid validation errors
 */
export function isValidationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const potentialError = error as { errors?: ValidationError[] };

  if (!Array.isArray(potentialError.errors)) {
    return false;
  }

  return potentialError.errors.every(err => 
    typeof err === 'object' &&
    err !== null &&
    typeof err.field === 'string' &&
    typeof err.message === 'string' &&
    (!err.code || typeof err.code === 'string') &&
    (!err.context || (typeof err.context === 'object' && err.context !== null))
  );
}

/**
 * Normalizes API errors into a standard format with enhanced tracking
 * @param error - Original error object
 * @param context - Additional context for error tracking
 * @returns Normalized ApiError object
 */
export function handleApiError(error: unknown, context: Record<string, unknown> = {}): ApiError {
  // Check error cache first
  const cacheKey = JSON.stringify({ error, context });
  const cachedError = errorCache.get(cacheKey);
  
  if (cachedError && (Date.now() - cachedError.timestamp) < ERROR_CACHE_TTL) {
    return JSON.parse(cachedError.message) as ApiError;
  }

  let normalizedError: ApiError = {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: DEFAULT_ERROR_MESSAGE,
    errors: [],
    timestamp: new Date().toISOString(),
    path: '',
    requestId: crypto.randomUUID()
  };

  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    normalizedError = {
      code: axiosError.response?.status || ERROR_CODES.INTERNAL_ERROR,
      message: axiosError.response?.data?.message || axiosError.message,
      errors: axiosError.response?.data?.errors || [],
      timestamp: new Date().toISOString(),
      path: axiosError.config?.url || '',
      requestId: axiosError.response?.headers['x-request-id'] || crypto.randomUUID()
    };
  } else if (isApiError(error)) {
    normalizedError = error;
  }

  // Add additional context while sanitizing sensitive data
  normalizedError = {
    ...normalizedError,
    context: sanitizeErrorContext(context)
  };

  // Cache the normalized error
  errorCache.set(cacheKey, {
    message: JSON.stringify(normalizedError),
    timestamp: Date.now()
  });

  return normalizedError;
}

/**
 * Extracts and formats user-friendly error messages with localization support
 * @param error - Error object
 * @param locale - Locale for message translation
 * @returns Localized user-friendly error message
 */
export function getErrorMessage(error: unknown, locale: string = 'en'): string {
  const normalizedError = handleApiError(error);
  
  // Load localized messages based on locale
  const messages = getLocalizedMessages(locale);
  
  if (normalizedError.errors.length > 0) {
    // Format validation errors
    const validationMessages = normalizedError.errors
      .map(err => messages[err.code] || err.message)
      .join('. ');
    return validationMessages;
  }

  // Return localized message or fallback to default
  return messages[normalizedError.code.toString()] || 
         normalizedError.message || 
         DEFAULT_ERROR_MESSAGE;
}

/**
 * Enhanced error logging with monitoring service integration
 * @param error - Error object to log
 * @param context - Additional context for error tracking
 * @param severity - Error severity level
 */
export function logError(
  error: unknown,
  context: Record<string, unknown> = {},
  severity: ErrorSeverity = ErrorSeverity.ERROR
): void {
  const normalizedError = handleApiError(error, context);
  
  const errorLog = {
    ...normalizedError,
    severity,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    version: process.env.REACT_APP_VERSION
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]:', errorLog);
  }

  // Send to monitoring service (implementation depends on service used)
  sendToMonitoringService(errorLog);
}

/**
 * Helper function to sanitize error context and remove sensitive data
 * @param context - Context object to sanitize
 * @returns Sanitized context object
 */
function sanitizeErrorContext(context: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...context };

  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Helper function to get localized error messages
 * @param locale - Locale code
 * @returns Object containing localized messages
 */
function getLocalizedMessages(locale: string): Record<string, string> {
  // Implementation would typically load messages from a localization service
  // This is a simplified example
  return {
    [ERROR_CODES.BAD_REQUEST]: 'Invalid request parameters',
    [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
    [ERROR_CODES.FORBIDDEN]: 'Access denied',
    [ERROR_CODES.NOT_FOUND]: 'Resource not found',
    [ERROR_CODES.VALIDATION_ERROR]: 'Validation failed',
    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests',
    [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable'
  };
}

/**
 * Helper function to send errors to monitoring service
 * @param errorLog - Error log object
 */
function sendToMonitoringService(errorLog: Record<string, unknown>): void {
  // Implementation would depend on the monitoring service being used
  // This is a placeholder for the actual implementation
  if (typeof window !== 'undefined' && window.navigator.onLine) {
    // Example: Send to monitoring service
    // monitoringService.logError(errorLog);
  }
}