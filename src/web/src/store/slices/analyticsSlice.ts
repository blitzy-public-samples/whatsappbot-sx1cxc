/**
 * @file Redux slice for managing analytics state in the WhatsApp Web Enhancement Application
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.x
import {
  TimeRangeFilter,
  MessageMetrics,
  EngagementMetrics,
  SystemMetrics,
  TemplatePerformance,
  AnalyticsDashboard
} from '../../types/analytics';

// Constants for analytics configuration
const STALENESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MIN_UPDATE_INTERVAL = 30 * 1000; // 30 seconds
const MAX_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes
const DEFAULT_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Extended interface for analytics state including caching metadata
 */
interface AnalyticsState {
  messageMetrics: MessageMetrics | null;
  engagementMetrics: EngagementMetrics | null;
  systemMetrics: SystemMetrics | null;
  templatePerformance: TemplatePerformance[];
  timeRange: TimeRangeFilter;
  isLoading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastUpdated: Record<string, number>;
  isStale: Record<string, boolean>;
  updateInterval: number;
}

/**
 * Initial state for the analytics slice
 */
const initialState: AnalyticsState = {
  messageMetrics: null,
  engagementMetrics: null,
  systemMetrics: null,
  templatePerformance: [],
  timeRange: 'last_24h',
  isLoading: {},
  error: {},
  lastUpdated: {},
  isStale: {},
  updateInterval: DEFAULT_UPDATE_INTERVAL
};

/**
 * Async thunk for fetching analytics dashboard data
 */
export const fetchAnalyticsDashboard = createAsyncThunk(
  'analytics/fetchDashboard',
  async (timeRange: TimeRangeFilter, { rejectWithValue }) => {
    try {
      // API call implementation would go here
      const response = await fetch(`/api/v1/analytics/dashboard?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics data');
      const data: AnalyticsDashboard = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Analytics slice definition using Redux Toolkit
 */
export const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    /**
     * Updates the selected time range for analytics data
     */
    setTimeRange: (state, action: PayloadAction<TimeRangeFilter>) => {
      state.timeRange = action.payload;
      // Mark data as stale when time range changes
      Object.keys(state.isStale).forEach(key => {
        state.isStale[key] = true;
      });
    },

    /**
     * Clears stale analytics data based on threshold
     */
    clearStaleData: (state, action: PayloadAction<number>) => {
      const threshold = action.payload;
      const now = Date.now();
      
      Object.keys(state.lastUpdated).forEach(key => {
        if (now - state.lastUpdated[key] > threshold) {
          switch (key) {
            case 'messageMetrics':
              state.messageMetrics = null;
              break;
            case 'engagementMetrics':
              state.engagementMetrics = null;
              break;
            case 'systemMetrics':
              state.systemMetrics = null;
              break;
            case 'templatePerformance':
              state.templatePerformance = [];
              break;
          }
          state.isStale[key] = true;
        }
      });
    },

    /**
     * Sets the update interval for analytics data refresh
     */
    setUpdateInterval: (state, action: PayloadAction<number>) => {
      const interval = Math.min(
        Math.max(action.payload, MIN_UPDATE_INTERVAL),
        MAX_UPDATE_INTERVAL
      );
      state.updateInterval = interval;
    },

    /**
     * Resets the analytics state to initial values
     */
    resetState: (state) => {
      Object.assign(state, {
        ...initialState,
        updateInterval: state.updateInterval // Preserve update interval setting
      });
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchAnalyticsDashboard pending state
      .addCase(fetchAnalyticsDashboard.pending, (state) => {
        state.isLoading['dashboard'] = true;
        state.error['dashboard'] = null;
      })
      // Handle fetchAnalyticsDashboard fulfilled state
      .addCase(fetchAnalyticsDashboard.fulfilled, (state, action) => {
        const now = Date.now();
        state.messageMetrics = action.payload.messageMetrics;
        state.engagementMetrics = action.payload.engagementMetrics;
        state.systemMetrics = action.payload.systemMetrics;
        state.templatePerformance = action.payload.templatePerformance;
        
        // Update metadata
        ['messageMetrics', 'engagementMetrics', 'systemMetrics', 'templatePerformance'].forEach(key => {
          state.lastUpdated[key] = now;
          state.isStale[key] = false;
        });
        
        state.isLoading['dashboard'] = false;
        state.error['dashboard'] = null;
      })
      // Handle fetchAnalyticsDashboard rejected state
      .addCase(fetchAnalyticsDashboard.rejected, (state, action) => {
        state.isLoading['dashboard'] = false;
        state.error['dashboard'] = action.payload as string;
      });
  }
});

// Export actions
export const {
  setTimeRange,
  clearStaleData,
  setUpdateInterval,
  resetState
} = analyticsSlice.actions;

// Export reducer
export default analyticsSlice.reducer;

/**
 * Selector for checking if any analytics data is stale
 */
export const selectHasStaleData = (state: { analytics: AnalyticsState }) => 
  Object.values(state.analytics.isStale).some(Boolean);

/**
 * Selector for getting the current update interval
 */
export const selectUpdateInterval = (state: { analytics: AnalyticsState }) =>
  state.analytics.updateInterval;

/**
 * Selector for getting the loading state of the dashboard
 */
export const selectDashboardLoading = (state: { analytics: AnalyticsState }) =>
  state.analytics.isLoading['dashboard'] || false;

/**
 * Selector for getting the error state of the dashboard
 */
export const selectDashboardError = (state: { analytics: AnalyticsState }) =>
  state.analytics.error['dashboard'] || null;