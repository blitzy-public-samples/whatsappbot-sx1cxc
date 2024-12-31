// @package @reduxjs/toolkit ^2.0.0
// @package opossum ^6.0.0

import { Middleware, isRejectedWithValue } from '@reduxjs/toolkit';
import CircuitBreaker from 'opossum';
import apiClient from '../../config/api';
import { ApiError } from '../../types/api';
import { handleApiError } from '../../utils/errorHandling';

// Action Types
export const API_REQUEST = 'api/request';
export const API_SUCCESS = 'api/success';
export const API_ERROR = 'api/error';

// Request Monitor Configuration
const REQUEST_MONITOR_CONFIG = {
  metricsInterval: 60000, // 1 minute
  errorThreshold: 0.1, // 10% error rate threshold
  samplingRate: 0.1, // 10% sampling rate for detailed monitoring
};

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 3000,
  errorThreshold: 50,
  resetTimeout: 30000,
};

// Request Metrics Storage
interface RequestMetric {
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  endpoint: string;
  method: string;
  success: boolean;
}

const requestMetrics = new Map<string, RequestMetric>();

/**
 * Cleans up old metrics data periodically
 */
const cleanupMetrics = () => {
  const now = Date.now();
  requestMetrics.forEach((metric, key) => {
    if (now - metric.startTime > REQUEST_MONITOR_CONFIG.metricsInterval) {
      requestMetrics.delete(key);
    }
  });
};

setInterval(cleanupMetrics, REQUEST_MONITOR_CONFIG.metricsInterval);

/**
 * Tracks request metrics and performance
 * @param requestId Unique request identifier
 * @param metric Request metric data
 */
const trackRequestMetric = (requestId: string, metric: Partial<RequestMetric>) => {
  const existing = requestMetrics.get(requestId) || {
    requestId,
    startTime: Date.now(),
    endpoint: '',
    method: '',
    success: false,
  };
  
  requestMetrics.set(requestId, { ...existing, ...metric });
};

/**
 * Creates enhanced API middleware with monitoring and circuit breaker
 */
export const createApiMiddleware = (): Middleware => {
  // Initialize circuit breaker
  const breaker = new CircuitBreaker((request: any) => apiClient(request), CIRCUIT_BREAKER_CONFIG);

  // Monitor circuit breaker events
  breaker.on('open', () => {
    console.warn('Circuit breaker opened - API requests will be rejected');
  });

  breaker.on('halfOpen', () => {
    console.info('Circuit breaker half-open - testing API availability');
  });

  breaker.on('close', () => {
    console.info('Circuit breaker closed - API requests resumed');
  });

  return ({ dispatch, getState }) => next => action => {
    // Only process API request actions
    if (action.type !== API_REQUEST) {
      return next(action);
    }

    const {
      url,
      method = 'GET',
      data = null,
      headers = {},
      onSuccess,
      onError,
      skipAuth = false,
    } = action.payload;

    // Generate unique request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Start tracking request metrics
    trackRequestMetric(requestId, {
      endpoint: url,
      method,
      startTime: Date.now(),
    });

    // Prepare request headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(!skipAuth && { Authorization: `Bearer ${getState().auth?.token}` }),
      ...headers,
    };

    // Execute request through circuit breaker
    return breaker.fire({
      url,
      method,
      data,
      headers: requestHeaders,
    })
      .then(response => {
        // Track successful request
        trackRequestMetric(requestId, {
          endTime: Date.now(),
          duration: Date.now() - requestMetrics.get(requestId)!.startTime,
          status: response.status,
          success: true,
        });

        // Dispatch success action
        dispatch({
          type: API_SUCCESS,
          payload: {
            requestId,
            data: response.data,
            status: response.status,
          },
        });

        // Execute success callback if provided
        if (onSuccess) {
          dispatch(onSuccess(response.data));
        }

        return response.data;
      })
      .catch(error => {
        // Handle and normalize error
        const normalizedError = handleApiError(error, {
          requestId,
          url,
          method,
        }) as ApiError;

        // Track failed request
        trackRequestMetric(requestId, {
          endTime: Date.now(),
          duration: Date.now() - requestMetrics.get(requestId)!.startTime,
          status: normalizedError.code,
          success: false,
        });

        // Dispatch error action
        dispatch({
          type: API_ERROR,
          payload: normalizedError,
          error: true,
        });

        // Execute error callback if provided
        if (onError) {
          dispatch(onError(normalizedError));
        }

        throw normalizedError;
      });
  };
};

/**
 * Creates an API request action
 * @param config API request configuration
 */
export const createApiRequest = (config: {
  url: string;
  method?: string;
  data?: any;
  headers?: Record<string, string>;
  onSuccess?: (data: any) => any;
  onError?: (error: ApiError) => any;
  skipAuth?: boolean;
}) => ({
  type: API_REQUEST,
  payload: config,
});

/**
 * Returns current request metrics
 */
export const getRequestMetrics = () => {
  const metrics = Array.from(requestMetrics.values());
  return {
    totalRequests: metrics.length,
    successRate: metrics.filter(m => m.success).length / metrics.length,
    averageDuration: metrics.reduce((acc, m) => acc + (m.duration || 0), 0) / metrics.length,
    errorRate: metrics.filter(m => !m.success).length / metrics.length,
    metrics,
  };
};

// Export configured middleware
export const apiMiddleware = createApiMiddleware();