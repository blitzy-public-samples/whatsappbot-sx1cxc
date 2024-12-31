// External imports with versions
import { describe, test, beforeAll, afterAll, expect } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.0
import dayjs from 'dayjs'; // ^1.11.0

// Internal imports
import { TestDataGenerator } from '../../utils/test-data-generator';

// Constants for test configuration
const TEST_MESSAGE_COUNT = 10000;
const TEST_USER_COUNT = 1000;
const TEST_DAYS_RANGE = 7;
const PERFORMANCE_TEST_HOURS = 24;
const MIN_DELIVERY_RATE = 99; // 99% minimum delivery rate
const MAX_RESPONSE_TIME = 2000; // 2 seconds maximum response time
const CONCURRENT_USERS = 1000;

// Initialize test utilities
const testDataGenerator = new TestDataGenerator();
const request = supertest(app);

describe('Metrics Integration Tests', () => {
  // Setup test environment and generate base test data
  beforeAll(async () => {
    // Initialize test database with clean state
    await initializeTestDatabase();

    // Generate test data for message delivery metrics
    await testDataGenerator.generateBulkMessages({
      count: TEST_MESSAGE_COUNT,
      distribution: {
        delivered: 0.992, // 99.2% delivery rate
        failed: 0.005,    // 0.5% failure rate
        pending: 0.003    // 0.3% pending rate
      }
    });

    // Generate user engagement test data
    await testDataGenerator.generateEngagementData({
      userCount: TEST_USER_COUNT,
      daysRange: TEST_DAYS_RANGE,
      activityTypes: ['message_sent', 'message_read', 'template_used', 'contact_added']
    });

    // Generate system performance test data
    await testDataGenerator.generatePerformanceData({
      hours: PERFORMANCE_TEST_HOURS,
      metricsInterval: 5, // 5-minute intervals
      includeResourceMetrics: true
    });
  });

  // Cleanup test environment
  afterAll(async () => {
    await cleanupTestDatabase();
    await resetMetricsState();
  });

  test('should validate message delivery metrics and rates', async () => {
    // Test message delivery rate calculation
    const deliveryMetricsResponse = await request
      .get('/api/v1/analytics/metrics/delivery')
      .query({
        startDate: dayjs().subtract(1, 'day').toISOString(),
        endDate: dayjs().toISOString(),
        groupBy: 'hour'
      });

    expect(deliveryMetricsResponse.status).toBe(200);
    expect(deliveryMetricsResponse.body).toMatchObject({
      overall: {
        deliveryRate: expect.any(Number),
        totalMessages: expect.any(Number),
        delivered: expect.any(Number),
        failed: expect.any(Number),
        pending: expect.any(Number)
      },
      timeSeriesData: expect.any(Array)
    });

    // Validate delivery rate meets SLA requirements
    expect(deliveryMetricsResponse.body.overall.deliveryRate).toBeGreaterThanOrEqual(MIN_DELIVERY_RATE);

    // Validate delivery status breakdown
    const { delivered, failed, pending, totalMessages } = deliveryMetricsResponse.body.overall;
    expect(delivered + failed + pending).toBe(totalMessages);
    
    // Validate time series data structure
    deliveryMetricsResponse.body.timeSeriesData.forEach((dataPoint: any) => {
      expect(dataPoint).toMatchObject({
        timestamp: expect.any(String),
        deliveryRate: expect.any(Number),
        messageCount: expect.any(Number),
        deliveryStatus: expect.any(Object)
      });
    });
  });

  test('should validate system performance metrics', async () => {
    // Generate concurrent load
    const concurrentRequests = Array.from({ length: CONCURRENT_USERS }, () =>
      request
        .get('/api/v1/analytics/metrics/performance')
        .query({
          duration: '1h',
          resolution: '1m'
        })
    );

    // Execute concurrent requests and measure response times
    const responses = await Promise.all(concurrentRequests);
    
    // Validate response times
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.header['x-response-time']).toBeDefined();
      expect(parseInt(response.header['x-response-time'])).toBeLessThan(MAX_RESPONSE_TIME);
    });

    // Validate performance metrics structure
    const performanceMetrics = responses[0].body;
    expect(performanceMetrics).toMatchObject({
      systemLoad: {
        cpu: expect.any(Number),
        memory: expect.any(Number),
        activeConnections: expect.any(Number)
      },
      responseTime: {
        p50: expect.any(Number),
        p90: expect.any(Number),
        p99: expect.any(Number)
      },
      throughput: {
        requestsPerSecond: expect.any(Number),
        successRate: expect.any(Number)
      },
      timeSeriesData: expect.any(Array)
    });

    // Validate system can handle required concurrent users
    expect(performanceMetrics.systemLoad.activeConnections).toBeGreaterThanOrEqual(CONCURRENT_USERS);
  });

  test('should calculate user engagement metrics correctly', async () => {
    const engagementResponse = await request
      .get('/api/v1/analytics/metrics/engagement')
      .query({
        startDate: dayjs().subtract(TEST_DAYS_RANGE, 'day').toISOString(),
        endDate: dayjs().toISOString(),
        segmentation: ['user_type', 'message_type']
      });

    expect(engagementResponse.status).toBe(200);
    expect(engagementResponse.body).toMatchObject({
      overview: {
        activeUsers: expect.any(Number),
        messagesSent: expect.any(Number),
        averageResponseTime: expect.any(Number),
        engagementRate: expect.any(Number)
      },
      segmentedData: expect.any(Object),
      trends: expect.any(Array)
    });

    // Validate engagement metrics calculations
    const { overview, segmentedData, trends } = engagementResponse.body;
    
    // Verify active users count
    expect(overview.activeUsers).toBeLessThanOrEqual(TEST_USER_COUNT);
    
    // Verify segmentation data
    expect(segmentedData).toHaveProperty('user_type');
    expect(segmentedData).toHaveProperty('message_type');
    
    // Verify trend data structure
    trends.forEach((trend: any) => {
      expect(trend).toMatchObject({
        date: expect.any(String),
        metrics: {
          activeUsers: expect.any(Number),
          messagesSent: expect.any(Number),
          engagementRate: expect.any(Number)
        }
      });
    });
  });

  test('should aggregate and report metrics correctly', async () => {
    const aggregationResponse = await request
      .get('/api/v1/analytics/metrics/aggregate')
      .query({
        metrics: ['delivery_rate', 'response_time', 'engagement_rate'],
        period: 'day',
        startDate: dayjs().subtract(TEST_DAYS_RANGE, 'day').toISOString(),
        endDate: dayjs().toISOString()
      });

    expect(aggregationResponse.status).toBe(200);
    expect(aggregationResponse.body).toMatchObject({
      aggregations: {
        delivery_rate: {
          average: expect.any(Number),
          min: expect.any(Number),
          max: expect.any(Number)
        },
        response_time: {
          average: expect.any(Number),
          p95: expect.any(Number),
          p99: expect.any(Number)
        },
        engagement_rate: {
          average: expect.any(Number),
          trend: expect.any(Number)
        }
      },
      timeSeriesData: expect.any(Array)
    });

    // Validate aggregation calculations
    const { aggregations, timeSeriesData } = aggregationResponse.body;
    
    // Verify delivery rate aggregation
    expect(aggregations.delivery_rate.average).toBeGreaterThanOrEqual(MIN_DELIVERY_RATE);
    
    // Verify response time aggregation
    expect(aggregations.response_time.p99).toBeLessThan(MAX_RESPONSE_TIME);
    
    // Verify time series data points
    expect(timeSeriesData.length).toBe(TEST_DAYS_RANGE);
    timeSeriesData.forEach((dataPoint: any) => {
      expect(dataPoint).toMatchObject({
        timestamp: expect.any(String),
        metrics: {
          delivery_rate: expect.any(Number),
          response_time: expect.any(Number),
          engagement_rate: expect.any(Number)
        }
      });
    });
  });
});