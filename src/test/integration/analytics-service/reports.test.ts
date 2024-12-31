// External imports with versions
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import dayjs from 'dayjs'; // ^1.11.9

// Internal imports
import { TestDatabase } from '../utils/test-database';

// Constants
const TEST_ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const BASE_URL = '/api/v1/analytics/reports';
const TEST_TIMEOUT = 60000; // 60 seconds for handling large datasets

// Global test instances
let testDb: TestDatabase;
let request: supertest.SuperTest<supertest.Test>;

// Test data interfaces
interface ReportTestData {
  organizationId: string;
  startTime: Date;
  endTime: Date;
  metrics: any[];
}

describe('Analytics Service - Report Generation', () => {
  beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabase({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      username: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
      database: process.env.TEST_DB_NAME || 'test_analytics',
      ssl_enabled: false
    });

    await testDb.connect();
    await testDb.setupSchema();

    // Initialize supertest instance
    request = supertest(process.env.API_URL || 'http://localhost:3000');
  });

  afterAll(async () => {
    await testDb.cleanup({ truncate: true, cascade: true });
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup({ truncate: true });
    await testDb.seedData();
  });

  describe('Delivery Reports', () => {
    test('should generate message delivery report with SLA validation', async () => {
      // Prepare test data with known delivery metrics
      const testData: ReportTestData = {
        organizationId: TEST_ORGANIZATION_ID,
        startTime: dayjs().subtract(7, 'day').toDate(),
        endTime: dayjs().toDate(),
        metrics: [
          { status: 'delivered', count: 990 },
          { status: 'failed', count: 8 },
          { status: 'pending', count: 2 }
        ]
      };

      await testDb.seedData({ messages: testData.metrics });

      // Test delivery report generation
      const response = await request
        .get(`${BASE_URL}/delivery`)
        .query({
          organizationId: testData.organizationId,
          startTime: testData.startTime.toISOString(),
          endTime: testData.endTime.toISOString()
        })
        .expect(200);

      // Validate report structure and metrics
      expect(response.body).toMatchObject({
        deliveryRate: expect.any(Number),
        totalMessages: 1000,
        statusBreakdown: expect.any(Object),
        timeSeriesData: expect.any(Array)
      });

      // Verify SLA compliance (>99% delivery rate)
      expect(response.body.deliveryRate).toBeGreaterThanOrEqual(99);

      // Validate status breakdown
      expect(response.body.statusBreakdown).toMatchObject({
        delivered: 990,
        failed: 8,
        pending: 2
      });
    });
  });

  describe('Engagement Reports', () => {
    test('should generate user engagement report with segment analysis', async () => {
      const response = await request
        .get(`${BASE_URL}/engagement`)
        .query({
          organizationId: TEST_ORGANIZATION_ID,
          startTime: dayjs().subtract(30, 'day').toISOString(),
          endTime: dayjs().toISOString(),
          segment: 'business'
        })
        .expect(200);

      // Validate engagement metrics
      expect(response.body).toMatchObject({
        totalInteractions: expect.any(Number),
        responseRate: expect.any(Number),
        averageResponseTime: expect.any(Number),
        segmentAnalysis: expect.any(Object),
        timeSeriesData: expect.any(Array)
      });

      // Verify segment analysis
      expect(response.body.segmentAnalysis).toMatchObject({
        segmentName: 'business',
        totalUsers: expect.any(Number),
        activeUsers: expect.any(Number),
        engagementRate: expect.any(Number)
      });
    });
  });

  describe('System Performance Reports', () => {
    test('should generate system performance report with SLA validation', async () => {
      const response = await request
        .get(`${BASE_URL}/system-performance`)
        .query({
          startTime: dayjs().subtract(24, 'hour').toISOString(),
          endTime: dayjs().toISOString()
        })
        .expect(200);

      // Validate system performance metrics
      expect(response.body).toMatchObject({
        averageResponseTime: expect.any(Number),
        requestCount: expect.any(Number),
        errorRate: expect.any(Number),
        concurrentUsers: expect.any(Number),
        resourceUtilization: expect.any(Object)
      });

      // Verify SLA compliance (<2s response time)
      expect(response.body.averageResponseTime).toBeLessThan(2000);

      // Verify concurrent user handling (1000+ users)
      expect(response.body.concurrentUsers).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Report Filtering', () => {
    test('should correctly filter reports based on multiple criteria', async () => {
      const response = await request
        .get(`${BASE_URL}/delivery`)
        .query({
          organizationId: TEST_ORGANIZATION_ID,
          startTime: dayjs().subtract(7, 'day').toISOString(),
          endTime: dayjs().toISOString(),
          status: ['delivered', 'failed'],
          messageType: 'template',
          templateId: 'test-template'
        })
        .expect(200);

      // Validate filtered results
      expect(response.body.filteredCount).toBeLessThanOrEqual(response.body.totalCount);
      expect(response.body.statusBreakdown).toHaveProperty('delivered');
      expect(response.body.statusBreakdown).toHaveProperty('failed');
      expect(response.body.statusBreakdown).not.toHaveProperty('pending');
    });
  });

  describe('Report Pagination', () => {
    test('should handle pagination for large datasets', async () => {
      // Test first page
      const firstPage = await request
        .get(`${BASE_URL}/delivery`)
        .query({
          organizationId: TEST_ORGANIZATION_ID,
          page: 1,
          pageSize: 50
        })
        .expect(200);

      // Validate pagination metadata
      expect(firstPage.body).toMatchObject({
        data: expect.any(Array),
        pagination: {
          currentPage: 1,
          pageSize: 50,
          totalPages: expect.any(Number),
          totalItems: expect.any(Number)
        }
      });

      // Verify data consistency
      expect(firstPage.body.data.length).toBeLessThanOrEqual(50);

      // Test last page
      const lastPage = await request
        .get(`${BASE_URL}/delivery`)
        .query({
          organizationId: TEST_ORGANIZATION_ID,
          page: firstPage.body.pagination.totalPages,
          pageSize: 50
        })
        .expect(200);

      // Verify last page data
      expect(lastPage.body.data.length).toBeGreaterThan(0);
      expect(lastPage.body.data.length).toBeLessThanOrEqual(50);
    });
  });
});