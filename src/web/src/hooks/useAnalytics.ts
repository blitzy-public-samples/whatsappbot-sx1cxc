/**
 * @file Custom React hook for managing analytics state and operations
 * @version 1.0.0
 */

import { useSelector, useDispatch } from 'react-redux'; // v8.1.x
import { useCallback, useEffect, useRef, useState } from 'react'; // v18.2.x
import { 
  TimeRangeFilter,
  AnalyticsDashboard
} from '../../types/analytics';
import {
  analyticsActions,
  selectAnalyticsState
} from '../../store/slices/analyticsSlice';

// Constants for analytics management
const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Interface for the analytics hook return value
 */
interface UseAnalyticsReturn {
  loading: boolean;
  error: Error | null;
  data: AnalyticsDashboard | null;
  fetchMetrics: (metricType: string, timeRange: TimeRangeFilter) => Promise<void>;
  refreshDashboard: (timeRange: TimeRangeFilter) => Promise<void>;
  isStale: boolean;
}

/**
 * Interface for the analytics cache structure
 */
interface AnalyticsCache {
  data: Partial<AnalyticsDashboard>;
  timestamp: number;
  timeRange: TimeRangeFilter;
}

/**
 * Custom hook for managing analytics state and operations
 * @param timeRange - Time range filter for analytics data
 * @param refreshInterval - Interval for auto-refresh in milliseconds
 * @returns Analytics state and operations object
 */
export const useAnalytics = (
  timeRange: TimeRangeFilter,
  refreshInterval: number = DEFAULT_REFRESH_INTERVAL
): UseAnalyticsReturn => {
  const dispatch = useDispatch();
  const analyticsState = useSelector(selectAnalyticsState);
  const [error, setError] = useState<Error | null>(null);

  // Refs for managing pending requests and cache
  const pendingRequests = useRef<Set<string>>(new Set());
  const analyticsCache = useRef<AnalyticsCache>({
    data: {},
    timestamp: 0,
    timeRange: 'last_24h'
  });

  /**
   * Checks if cached data is valid
   */
  const isCacheValid = useCallback((metricType: string): boolean => {
    const cache = analyticsCache.current;
    const now = Date.now();
    return (
      cache.timeRange === timeRange &&
      cache.timestamp + refreshInterval > now &&
      !!cache.data[metricType]
    );
  }, [timeRange, refreshInterval]);

  /**
   * Handles API errors with retry mechanism
   */
  const handleError = useCallback(async (
    error: Error,
    retryFn: () => Promise<void>,
    attempt: number = 0
  ): Promise<void> => {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      try {
        await retryFn();
      } catch (retryError) {
        await handleError(retryError as Error, retryFn, attempt + 1);
      }
    } else {
      setError(error);
    }
  }, []);

  /**
   * Fetches specific metrics with error handling and caching
   */
  const fetchMetrics = useCallback(async (
    metricType: string,
    timeRange: TimeRangeFilter
  ): Promise<void> => {
    // Check if request is already pending
    if (pendingRequests.current.has(metricType)) {
      return;
    }

    // Check cache validity
    if (isCacheValid(metricType)) {
      return;
    }

    try {
      pendingRequests.current.add(metricType);
      setError(null);

      let action;
      switch (metricType) {
        case 'message':
          action = analyticsActions.fetchMessageMetrics(timeRange);
          break;
        case 'engagement':
          action = analyticsActions.fetchEngagementMetrics(timeRange);
          break;
        case 'system':
          action = analyticsActions.fetchSystemMetrics(timeRange);
          break;
        case 'template':
          action = analyticsActions.fetchTemplatePerformance(timeRange);
          break;
        default:
          throw new Error(`Invalid metric type: ${metricType}`);
      }

      const result = await dispatch(action).unwrap();
      
      // Update cache
      analyticsCache.current = {
        data: { ...analyticsCache.current.data, [metricType]: result },
        timestamp: Date.now(),
        timeRange
      };
    } catch (error) {
      await handleError(error as Error, () => fetchMetrics(metricType, timeRange));
    } finally {
      pendingRequests.current.delete(metricType);
    }
  }, [dispatch, handleError, isCacheValid]);

  /**
   * Refreshes all dashboard data
   */
  const refreshDashboard = useCallback(async (
    timeRange: TimeRangeFilter
  ): Promise<void> => {
    if (pendingRequests.current.has('dashboard')) {
      return;
    }

    try {
      pendingRequests.current.add('dashboard');
      setError(null);

      // Clear existing cache
      analyticsCache.current = {
        data: {},
        timestamp: 0,
        timeRange
      };

      const result = await dispatch(
        analyticsActions.fetchDashboardData(timeRange)
      ).unwrap();

      // Update cache with new data
      analyticsCache.current = {
        data: result,
        timestamp: Date.now(),
        timeRange
      };
    } catch (error) {
      await handleError(error as Error, () => refreshDashboard(timeRange));
    } finally {
      pendingRequests.current.delete('dashboard');
    }
  }, [dispatch, handleError]);

  /**
   * Effect for auto-refresh functionality
   */
  useEffect(() => {
    const refresh = () => refreshDashboard(timeRange);
    const intervalId = setInterval(refresh, refreshInterval);

    // Initial fetch
    refresh();

    return () => {
      clearInterval(intervalId);
      pendingRequests.current.clear();
    };
  }, [timeRange, refreshInterval, refreshDashboard]);

  return {
    loading: Object.values(analyticsState.isLoading).some(Boolean),
    error,
    data: analyticsState as AnalyticsDashboard,
    fetchMetrics,
    refreshDashboard,
    isStale: Object.values(analyticsState.isStale).some(Boolean)
  };
};