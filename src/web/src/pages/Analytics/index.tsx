import React, { useCallback, useEffect, useState } from 'react';
import { Container, Typography, Box, Button, Skeleton } from '@mui/material'; // v5.14.0
import { Refresh as RefreshIcon, GetApp as ExportIcon } from '@mui/icons-material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0

import Dashboard from '../../components/analytics/Dashboard';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * Sets up auto-refresh functionality with visibility awareness
 * @param refreshFunction - Function to call for refresh
 * @param intervalMs - Interval in milliseconds
 * @returns Cleanup function
 */
const setupAutoRefresh = (
  refreshFunction: () => void,
  intervalMs: number
): () => void => {
  let intervalId: NodeJS.Timeout;

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshFunction();
      intervalId = setInterval(refreshFunction, intervalMs);
    } else {
      clearInterval(intervalId);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  intervalId = setInterval(refreshFunction, intervalMs);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(intervalId);
  };
};

/**
 * Analytics page component that displays comprehensive analytics dashboard
 * with real-time updates and export capabilities
 */
const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  
  // Initialize analytics hook with default time range
  const {
    loading,
    error,
    data,
    refreshDashboard,
    exportData
  } = useAnalytics('last_24h');

  // Handle data export with loading state
  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      await exportData();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [exportData]);

  // Set up auto-refresh with visibility awareness
  useEffect(() => {
    const cleanup = setupAutoRefresh(
      () => refreshDashboard('last_24h'),
      300000 // 5 minutes
    );
    return cleanup;
  }, [refreshDashboard]);

  // Handle error state
  if (error) {
    return (
      <Container>
        <Box py={4} textAlign="center">
          <Typography color="error" variant="h6" gutterBottom>
            {t('analytics.error.title')}
          </Typography>
          <Typography color="textSecondary">
            {t('analytics.error.message')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => refreshDashboard('last_24h')}
            startIcon={<RefreshIcon />}
            sx={{ mt: 2 }}
          >
            {t('analytics.actions.retry')}
          </Button>
        </Box>
      </Container>
    );
  }

  // Handle loading state
  if (loading && !data) {
    return (
      <Container>
        <Box py={3}>
          <Skeleton variant="text" width="30%" height={40} />
          <Skeleton variant="rectangular" height={400} sx={{ mt: 3 }} />
          <Box display="flex" gap={2} mt={3}>
            <Skeleton variant="rectangular" width={200} height={100} />
            <Skeleton variant="rectangular" width={200} height={100} />
            <Skeleton variant="rectangular" width={200} height={100} />
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <Box py={3}>
        {/* Header Section */}
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={3}
        >
          <Box>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom
              aria-label={t('analytics.title')}
            >
              {t('analytics.title')}
            </Typography>
            <Typography 
              variant="body1" 
              color="textSecondary"
              aria-label={t('analytics.description')}
            >
              {t('analytics.description')}
            </Typography>
          </Box>
          
          {/* Action Buttons */}
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExport}
              disabled={isExporting || loading}
              aria-label={t('analytics.actions.export')}
            >
              {isExporting ? t('analytics.actions.exporting') : t('analytics.actions.export')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refreshDashboard('last_24h')}
              disabled={loading}
              aria-label={t('analytics.actions.refresh')}
            >
              {t('analytics.actions.refresh')}
            </Button>
          </Box>
        </Box>

        {/* Dashboard Component */}
        <Dashboard 
          data={data}
          className="analytics-dashboard"
          aria-label={t('analytics.dashboard.aria-label')}
        />
      </Box>
    </Container>
  );
};

// Wrap component with error boundary
const AnalyticsPageWithErrorBoundary = withErrorBoundary(AnalyticsPage, {
  fallback: (
    <Container>
      <Box py={4} textAlign="center">
        <Typography variant="h6" color="error" gutterBottom>
          {t('analytics.error.boundary.title')}
        </Typography>
        <Typography color="textSecondary">
          {t('analytics.error.boundary.message')}
        </Typography>
      </Box>
    </Container>
  ),
  onError: (error, info) => {
    // Log error to monitoring service
    console.error('Analytics Error:', error, info);
  }
});

export default AnalyticsPageWithErrorBoundary;