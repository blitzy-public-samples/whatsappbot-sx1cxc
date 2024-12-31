import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Grid, Select, MenuItem, CircularProgress } from '@mui/material'; // v5.14.0
import { useAnalytics } from '../../../hooks/useAnalytics';
import { TimeRangeFilter } from '../../../types/analytics';
import BarChart from '../Charts/BarChart';
import LineChart from '../Charts/LineChart';
import PieChart from '../Charts/PieChart';
import MetricsCard from '../MetricsCard';

/**
 * Props interface for the Dashboard component
 */
interface DashboardProps {
  className?: string;
}

/**
 * Main analytics dashboard component that displays comprehensive analytics data
 * with enhanced auto-refresh capabilities and optimized performance.
 */
const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  // State for time range filter
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('last_24h');

  // Initialize analytics hook with auto-refresh
  const {
    loading,
    data,
    refreshDashboard,
    isStale
  } = useAnalytics(timeRange);

  // Handle visibility change for smart refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStale) {
        refreshDashboard(timeRange);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeRange, refreshDashboard, isStale]);

  // Memoized message metrics calculations
  const messageMetrics = useMemo(() => {
    if (!data?.messageMetrics) return null;
    const { totalMessages, deliveredMessages, failedMessages } = data.messageMetrics;
    
    return {
      total: totalMessages,
      delivered: deliveredMessages,
      failed: failedMessages,
      deliveryRate: (deliveredMessages / totalMessages) * 100
    };
  }, [data?.messageMetrics]);

  // Memoized engagement metrics calculations
  const engagementMetrics = useMemo(() => {
    if (!data?.engagementMetrics) return null;
    const { totalInteractions, uniqueUsers, engagementRate } = data.engagementMetrics;
    
    return {
      interactions: totalInteractions,
      users: uniqueUsers,
      rate: engagementRate
    };
  }, [data?.engagementMetrics]);

  // Memoized system metrics calculations
  const systemMetrics = useMemo(() => {
    if (!data?.systemMetrics) return null;
    const { responseTime, cpuUsage, memoryUsage, concurrentUsers } = data.systemMetrics;
    
    return {
      responseTime,
      cpuUsage,
      memoryUsage,
      concurrentUsers
    };
  }, [data?.systemMetrics]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    const newTimeRange = event.target.value as TimeRangeFilter;
    setTimeRange(newTimeRange);
    refreshDashboard(newTimeRange);
  }, [refreshDashboard]);

  if (loading) {
    return (
      <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '400px' }}>
        <CircularProgress size={48} />
      </Grid>
    );
  }

  return (
    <div className={className}>
      <Grid container spacing={3}>
        {/* Time Range Filter */}
        <Grid item xs={12}>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            variant="outlined"
            size="small"
          >
            <MenuItem value="last_24h">Last 24 Hours</MenuItem>
            <MenuItem value="last_7d">Last 7 Days</MenuItem>
            <MenuItem value="last_30d">Last 30 Days</MenuItem>
          </Select>
        </Grid>

        {/* Message Metrics Cards */}
        <Grid item xs={12} md={3}>
          <MetricsCard
            title="Total Messages"
            value={messageMetrics?.total || 0}
            change={10} // Calculate actual change
            isLoading={loading}
            tooltipContent="Total number of messages sent through the platform"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricsCard
            title="Delivery Rate"
            value={messageMetrics?.deliveryRate || 0}
            change={2.5} // Calculate actual change
            formatter={(value) => `${value.toFixed(1)}%`}
            isLoading={loading}
            tooltipContent="Percentage of successfully delivered messages"
            thresholds={{ warning: 95, critical: 90 }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricsCard
            title="Active Users"
            value={engagementMetrics?.users || 0}
            change={5} // Calculate actual change
            isLoading={loading}
            tooltipContent="Number of unique users engaging with messages"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricsCard
            title="Response Time"
            value={systemMetrics?.responseTime || 0}
            change={-15} // Calculate actual change
            formatter={(value) => `${value.toFixed(0)}ms`}
            isLoading={loading}
            tooltipContent="Average system response time"
            thresholds={{ warning: 1000, critical: 2000 }}
          />
        </Grid>

        {/* Message Delivery Trend */}
        <Grid item xs={12} md={8}>
          <LineChart
            data={data?.messageMetrics?.deliveryStatusBreakdown || []}
            title="Message Delivery Trend"
            yAxisLabel="Messages"
            timeRange={timeRange}
            height={300}
          />
        </Grid>

        {/* Message Status Distribution */}
        <Grid item xs={12} md={4}>
          <PieChart
            data={data?.messageMetrics?.deliveryStatusBreakdown || {}}
            title="Message Status Distribution"
            height={300}
            tooltipFormat={(value, label) => `${label}: ${value} messages`}
          />
        </Grid>

        {/* Template Performance */}
        <Grid item xs={12}>
          <BarChart
            data={data?.templatePerformance?.map(t => ({
              label: t.templateName,
              value: t.conversionRate,
              color: '#1976D2'
            })) || []}
            title="Template Performance"
            height={400}
          />
        </Grid>
      </Grid>
    </div>
  );
};

Dashboard.displayName = 'Dashboard';

export default Dashboard;