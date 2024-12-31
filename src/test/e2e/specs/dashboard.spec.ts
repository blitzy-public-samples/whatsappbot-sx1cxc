// External imports with versions
import { test, expect } from '@playwright/test'; // ^1.39.0

// Internal imports
import {
  setupTestContext,
  cleanupTestContext,
  waitForApiResponse,
  retryTest,
  TestContext
} from '../utils/test-helpers';

// Constants for test configuration
const TEST_TIMEOUT = 60000;
const RETRY_OPTIONS = {
  retries: 3,
  backoff: 'exponential'
};
const DASHBOARD_URL = '/analytics';
const API_ENDPOINTS = {
  METRICS: '/api/v1/analytics/metrics',
  REPORTS: '/api/v1/analytics/reports',
  REAL_TIME: '/api/v1/analytics/real-time'
};
const PERFORMANCE_THRESHOLDS = {
  LOAD_TIME: 2000,
  CHART_RENDER: 1000,
  API_RESPONSE: 1500
};

// Test suite for analytics dashboard
test.describe('Analytics Dashboard', () => {
  let context: TestContext;

  test.beforeEach(async ({ page }) => {
    // Initialize test context with enhanced error handling
    context = await setupTestContext();
    
    // Navigate to dashboard and wait for initial load
    await page.goto(DASHBOARD_URL);
    await page.waitForSelector('[data-testid="dashboard-container"]', {
      state: 'visible',
      timeout: TEST_TIMEOUT
    });
  });

  test.afterEach(async () => {
    await cleanupTestContext(context);
  });

  test('should load dashboard with all components', async ({ page }) => {
    // Verify core dashboard components
    await expect(page.locator('[data-testid="message-stats-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="delivery-rate-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-performance-table"]')).toBeVisible();

    // Verify initial data load
    const metrics = await waitForApiResponse(page, API_ENDPOINTS.METRICS, {
      timeout: PERFORMANCE_THRESHOLDS.API_RESPONSE
    });
    expect(metrics).toBeTruthy();
    expect(metrics.deliveryRate).toBeGreaterThanOrEqual(99);
  });

  test('should display real-time message statistics', async ({ page }) => {
    // Verify real-time updates
    const initialStats = await page.locator('[data-testid="message-stats"]').innerText();
    
    // Wait for real-time update
    await waitForApiResponse(page, API_ENDPOINTS.REAL_TIME);
    
    const updatedStats = await page.locator('[data-testid="message-stats"]').innerText();
    expect(updatedStats).not.toEqual(initialStats);
  });

  test('should handle chart interactions correctly', async ({ page }) => {
    const chart = page.locator('[data-testid="delivery-rate-chart"]');
    
    // Test zoom functionality
    await chart.locator('[data-testid="zoom-in-button"]').click();
    await expect(chart.locator('.zoom-level')).toHaveText('2x');
    
    // Test tooltip display
    await chart.hover();
    await expect(page.locator('.chart-tooltip')).toBeVisible();
    
    // Verify tooltip data accuracy
    const tooltipData = await page.locator('.chart-tooltip-value').innerText();
    expect(Number(tooltipData)).toBeGreaterThanOrEqual(0);
  });

  test('should filter data by date range', async ({ page }) => {
    // Set custom date range
    await page.locator('[data-testid="date-range-picker"]').click();
    await page.locator('[data-testid="date-range-7d"]').click();
    
    // Verify filtered data
    const response = await waitForApiResponse(page, API_ENDPOINTS.REPORTS);
    expect(response.timeRange).toBe('7d');
    
    // Verify chart update
    await expect(page.locator('[data-testid="chart-title"]'))
      .toContainText('Last 7 Days');
  });

  test('should export dashboard data', async ({ page }) => {
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="export-button"]').click();
    
    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/analytics-report-\d{8}\.csv/);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Simulate API error
    await page.route(API_ENDPOINTS.METRICS, (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Verify error handling
    await page.reload();
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('Failed to load dashboard data');
    
    // Verify retry mechanism
    await page.locator('[data-testid="retry-button"]').click();
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('should validate template performance metrics', async ({ page }) => {
    const performanceTable = page.locator('[data-testid="template-performance-table"]');
    
    // Verify table columns
    const headers = await performanceTable.locator('th').allInnerTexts();
    expect(headers).toContain('Template');
    expect(headers).toContain('Sent');
    expect(headers).toContain('Delivered');
    expect(headers).toContain('Failed');
    expect(headers).toContain('Conversion');
    
    // Verify data accuracy
    const rows = await performanceTable.locator('tr').count();
    expect(rows).toBeGreaterThan(1);
    
    // Verify sorting functionality
    await performanceTable.locator('th:has-text("Conversion")').click();
    const sortedValues = await performanceTable.locator('td:nth-child(5)').allInnerTexts();
    expect(sortedValues).toBeSorted({ descending: true });
  });

  test('should meet performance thresholds', async ({ page }) => {
    const start = Date.now();
    
    // Measure initial load time
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TIME);
    
    // Measure chart render time
    const chartStart = Date.now();
    await page.locator('[data-testid="delivery-rate-chart"]').waitFor();
    const chartRenderTime = Date.now() - chartStart;
    expect(chartRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CHART_RENDER);
  });
});