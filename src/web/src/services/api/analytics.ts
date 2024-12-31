// @package axios ^1.6.0
// @package lodash ^4.17.21

import { debounce } from 'lodash';
import apiClient from '../../config/api';
import { API_ENDPOINTS } from '../../config/api';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { 
  AnalyticsTypes, 
  TimeRangeFilter,
  MessageMetrics,
  EngagementMetrics,
  SystemMetrics,
  TemplatePerformance,
  AnalyticsDashboard
} from '../../types/analytics';

// Constants for analytics service configuration
const METRICS_CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_WAIT = 1000; // 1 second

// Cache storage for metrics data
const metricsCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Interface for progress tracking callback
 */
interface ProgressCallback {
  (progress: number): void;
}

/**
 * Validates the time range parameter
 * @param timeRange - Time range filter to validate
 * @throws Error if time range is invalid
 */
const validateTimeRange = (timeRange: TimeRangeFilter): void => {
  const validRanges: TimeRangeFilter[] = ['last_24h', 'last_7d', 'last_30d', 'custom'];
  if (!validRanges.includes(timeRange)) {
    throw new Error(`Invalid time range: ${timeRange}`);
  }
};

/**
 * Retrieves message delivery metrics with caching support
 * @param timeRange - Time period for metrics
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise resolving to message metrics data
 */
export const getMessageMetrics = async (
  timeRange: TimeRangeFilter,
  signal?: AbortSignal
): Promise<ApiResponse<MessageMetrics>> => {
  validateTimeRange(timeRange);

  const cacheKey = `message_metrics_${timeRange}`;
  const cachedData = metricsCache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < METRICS_CACHE_TTL) {
    return cachedData.data;
  }

  try {
    const response = await apiClient.get<ApiResponse<MessageMetrics>>(
      `${API_ENDPOINTS.ANALYTICS.METRICS}/messages`,
      {
        params: { timeRange },
        signal,
      }
    );

    metricsCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves engagement metrics with progress tracking
 * @param timeRange - Time period for metrics
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to engagement metrics data
 */
export const getEngagementMetrics = async (
  timeRange: TimeRangeFilter,
  onProgress?: ProgressCallback
): Promise<ApiResponse<EngagementMetrics>> => {
  validateTimeRange(timeRange);

  try {
    const response = await apiClient.get<ApiResponse<EngagementMetrics>>(
      `${API_ENDPOINTS.ANALYTICS.METRICS}/engagement`,
      {
        params: { timeRange },
        onDownloadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(progress);
          }
        }
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves system performance metrics
 * @param timeRange - Time period for metrics
 * @returns Promise resolving to system metrics data
 */
export const getSystemMetrics = async (
  timeRange: TimeRangeFilter
): Promise<ApiResponse<SystemMetrics>> => {
  validateTimeRange(timeRange);

  try {
    const response = await apiClient.get<ApiResponse<SystemMetrics>>(
      `${API_ENDPOINTS.ANALYTICS.METRICS}/system`,
      {
        params: { timeRange }
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves template performance metrics with pagination
 * @param timeRange - Time period for metrics
 * @param page - Page number for pagination
 * @param pageSize - Number of items per page
 * @returns Promise resolving to paginated template performance data
 */
export const getTemplatePerformance = async (
  timeRange: TimeRangeFilter,
  page: number = 0,
  pageSize: number = 20
): Promise<PaginatedResponse<TemplatePerformance>> => {
  validateTimeRange(timeRange);

  try {
    const response = await apiClient.get<PaginatedResponse<TemplatePerformance>>(
      `${API_ENDPOINTS.ANALYTICS.PERFORMANCE}/templates`,
      {
        params: {
          timeRange,
          page,
          pageSize
        }
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves complete analytics dashboard data
 * @param timeRange - Time period for dashboard data
 * @returns Promise resolving to complete dashboard data
 */
export const getDashboardData = async (
  timeRange: TimeRangeFilter
): Promise<ApiResponse<AnalyticsDashboard>> => {
  validateTimeRange(timeRange);

  try {
    const response = await apiClient.get<ApiResponse<AnalyticsDashboard>>(
      API_ENDPOINTS.ANALYTICS.BASE + '/dashboard',
      {
        params: { timeRange }
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Exports analytics data to CSV format
 * @param timeRange - Time period for export data
 * @param metrics - Array of metric types to export
 * @returns Promise resolving to CSV data URL
 */
export const exportAnalyticsData = async (
  timeRange: TimeRangeFilter,
  metrics: string[]
): Promise<string> => {
  validateTimeRange(timeRange);

  try {
    const response = await apiClient.post<{ downloadUrl: string }>(
      API_ENDPOINTS.ANALYTICS.BASE + '/export',
      {
        timeRange,
        metrics
      },
      {
        responseType: 'blob'
      }
    );

    return response.data.downloadUrl;
  } catch (error) {
    throw error;
  }
};

// Debounced version of getDashboardData for frequent calls
export const getDashboardDataDebounced = debounce(getDashboardData, DEBOUNCE_WAIT);

// Clear metrics cache
export const clearMetricsCache = (): void => {
  metricsCache.clear();
};