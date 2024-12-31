// @package axios ^1.6.0
// @package axios-retry ^3.8.0
// @package circuit-breaker-js ^0.5.0

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'circuit-breaker-js';
import { ApiError, RequestConfig, isApiError, isAxiosError } from '../types/api';

// API Configuration Constants
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const API_TIMEOUT = 30000;

// Retry Configuration
const RETRY_CONFIG = {
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error: AxiosError) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response?.status === 429);
  }
};

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000
};

// API Endpoints Configuration
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile'
  },
  MESSAGES: {
    BASE: '/messages',
    SEND: '/messages/send',
    SCHEDULE: '/messages/schedule',
    STATUS: '/messages/status',
    METRICS: '/messages/metrics'
  },
  CONTACTS: {
    BASE: '/contacts',
    GROUPS: '/contacts/groups',
    IMPORT: '/contacts/import',
    VALIDATE: '/contacts/validate'
  },
  TEMPLATES: {
    BASE: '/templates',
    VALIDATE: '/templates/validate',
    METRICS: '/templates/metrics'
  },
  ANALYTICS: {
    BASE: '/analytics',
    METRICS: '/analytics/metrics',
    REPORTS: '/analytics/reports',
    PERFORMANCE: '/analytics/performance'
  }
};

// Request metrics storage
const requestMetrics = new Map<string, {
  timestamp: number;
  duration: number;
  status: number;
}>();

/**
 * Creates and configures an axios instance with enhanced security and monitoring
 * @param config Optional request configuration
 * @returns Configured axios instance
 */
export function createApiClient(config?: Partial<RequestConfig>): AxiosInstance {
  // Create base axios instance
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: config?.timeout || API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config?.headers
    }
  });

  // Configure retry mechanism
  axiosRetry(instance, RETRY_CONFIG);

  // Initialize circuit breaker
  const breaker = new CircuitBreaker(CIRCUIT_BREAKER_CONFIG);

  // Request interceptor for authentication and tracking
  instance.interceptors.request.use((config) => {
    const requestId = generateRequestId();
    config.headers['X-Request-ID'] = requestId;
    
    // Start timing the request
    requestMetrics.set(requestId, {
      timestamp: Date.now(),
      duration: 0,
      status: 0
    });

    // Sanitize request data
    if (config.data) {
      config.data = sanitizeRequestData(config.data);
    }

    return config;
  });

  // Response interceptor for error handling and metrics
  instance.interceptors.response.use(
    (response) => {
      const requestId = response.config.headers['X-Request-ID'];
      if (requestId) {
        const metrics = requestMetrics.get(requestId);
        if (metrics) {
          metrics.duration = Date.now() - metrics.timestamp;
          metrics.status = response.status;
        }
      }
      return response;
    },
    async (error: AxiosError) => {
      const enhancedError = await handleApiError(error);
      throw enhancedError;
    }
  );

  // Add circuit breaker wrapper
  const originalRequest = instance.request;
  instance.request = async function(...args) {
    return breaker.run(() => originalRequest.apply(this, args));
  };

  return instance;
}

/**
 * Enhanced error handler with detailed error information
 * @param error Axios error object
 * @returns Enhanced API error object
 */
async function handleApiError(error: AxiosError): Promise<ApiError> {
  const requestId = error.config?.headers?.['X-Request-ID'] as string || generateRequestId();
  
  let apiError: ApiError = {
    code: error.response?.status || 500,
    message: '',
    requestId,
    details: {},
    timestamp: new Date().toISOString()
  };

  if (isAxiosError(error)) {
    if (error.response?.data && isApiError(error.response.data)) {
      apiError = { ...error.response.data, requestId };
    } else {
      apiError.message = error.message;
      apiError.details = {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status
      };
    }
  }

  // Log error for monitoring
  logError(apiError);

  return apiError;
}

/**
 * Generates a unique request ID
 * @returns Unique request ID string
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitizes request data to prevent XSS and injection attacks
 * @param data Request data to sanitize
 * @returns Sanitized data
 */
function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    return data.replace(/<[^>]*>/g, '');
  }
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).reduce((acc, key) => ({
      ...acc,
      [key]: sanitizeRequestData(data[key])
    }), {});
  }
  return data;
}

/**
 * Logs error information for monitoring
 * @param error API error object
 */
function logError(error: ApiError): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API Error]', {
      requestId: error.requestId,
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp
    });
  }
  // In production, you would send this to your error monitoring service
}

// Create and export the default API client instance
const apiClient = createApiClient();

export default apiClient;

// Export utility functions for monitoring
export const getRequestMetrics = () => Array.from(requestMetrics.entries());
export const getCircuitBreakerStatus = () => ({
  isOpen: apiClient.defaults.circuitBreaker?.isOpen() || false,
  failureCount: apiClient.defaults.circuitBreaker?.getFailureCount() || 0
});