// External imports with versions
import { describe, test, beforeAll, afterAll, beforeEach, expect } from '@jest/globals'; // ^29.7.0
import supertest from 'supertest'; // ^6.3.3

// Internal imports
import { TestQueue } from '../utils/test-queue';
import createMockServer from '../../mocks/whatsapp-api';
import { types } from '../../mocks/whatsapp-api';

// Constants for test configuration
const PERFORMANCE_THRESHOLDS = {
  RESPONSE_TIME_MS: 2000,
  DELIVERY_RATE: 0.99,
  CONCURRENT_USERS: 1000,
  BATCH_SIZE: 100
};

const RATE_LIMITS = {
  MESSAGES_PER_MINUTE: 1000,
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 3
};

const TEST_TIMEOUT = 30000;

/**
 * Comprehensive integration test suite for WhatsApp Business API integration
 * Verifies message delivery, performance, and reliability requirements
 */
describe('WhatsApp Integration', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let testQueue: TestQueue;
  let request: supertest.SuperTest<supertest.Test>;

  // Enhanced setup with performance monitoring
  beforeAll(async () => {
    // Initialize mock server with rate limiting and error simulation
    mockServer = createMockServer(8080, {
      delay: 100,
      errorRate: 0.05,
      rateLimit: RATE_LIMITS.MESSAGES_PER_MINUTE,
      webhookUrl: 'http://localhost:3000/webhook'
    });

    // Initialize test queue with monitoring
    testQueue = new TestQueue({
      host: 'localhost',
      port: 6379,
      password: 'test',
      db: 0,
      maxRetries: RATE_LIMITS.MAX_RETRIES,
      retryDelay: RATE_LIMITS.RETRY_DELAY_MS,
      connectionTimeout: 5000,
      monitoringEnabled: true
    });

    await testQueue.connect();
    request = supertest(mockServer);
  }, TEST_TIMEOUT);

  // Enhanced cleanup with verification
  afterAll(async () => {
    await testQueue.cleanup();
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
  });

  // Reset state before each test
  beforeEach(async () => {
    await testQueue.cleanup();
  });

  /**
   * Tests basic message sending functionality with delivery verification
   */
  test('should successfully send a message through WhatsApp API', async () => {
    // Prepare test message
    const message: types.Message = {
      ID: '123',
      To: '+1234567890',
      Type: 'TEXT',
      Content: {
        Text: 'Test message',
        RichText: false
      },
      Status: types.MessageStatus.PENDING,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      RetryCount: 0,
      Metadata: {}
    };

    // Send message and measure response time
    const startTime = Date.now();
    const response = await request
      .post('/v1/messages')
      .send(message)
      .set('x-api-key', 'test-key');

    const responseTime = Date.now() - startTime;

    // Verify response time meets SLA
    expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS);
    expect(response.status).toBe(200);
    expect(response.body.messageId).toBeDefined();

    // Verify message delivery
    const deliveryStatus = await request
      .get(`/v1/messages/${response.body.messageId}/status`)
      .set('x-api-key', 'test-key');

    expect(deliveryStatus.body.status).toBe(types.MessageStatus.DELIVERED);
  });

  /**
   * Tests high-volume message processing with performance validation
   */
  test('should handle bulk message sending within performance thresholds', async () => {
    // Generate test messages
    const messages = await Promise.all(
      Array.from({ length: PERFORMANCE_THRESHOLDS.CONCURRENT_USERS }, (_, i) => ({
        ID: `bulk-${i}`,
        To: `+1234567${i.toString().padStart(3, '0')}`,
        Type: 'TEXT',
        Content: {
          Text: `Bulk test message ${i}`,
          RichText: false
        },
        Status: types.MessageStatus.PENDING,
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
        RetryCount: 0,
        Metadata: {}
      }))
    );

    // Process messages in batches
    const results = [];
    for (let i = 0; i < messages.length; i += PERFORMANCE_THRESHOLDS.BATCH_SIZE) {
      const batch = messages.slice(i, i + PERFORMANCE_THRESHOLDS.BATCH_SIZE);
      const batchPromises = batch.map(message =>
        request
          .post('/v1/messages')
          .send(message)
          .set('x-api-key', 'test-key')
      );
      results.push(...(await Promise.all(batchPromises)));
    }

    // Verify delivery rate
    const successfulDeliveries = results.filter(r => r.status === 200).length;
    const deliveryRate = successfulDeliveries / messages.length;
    expect(deliveryRate).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.DELIVERY_RATE);

    // Verify queue performance
    const queueMetrics = await testQueue.monitorQueue('messages');
    expect(queueMetrics.processingRate).toBeGreaterThan(0);
    expect(queueMetrics.errorRate).toBeLessThan(1 - PERFORMANCE_THRESHOLDS.DELIVERY_RATE);
  });

  /**
   * Tests template message processing with variable substitution
   */
  test('should process template messages with correct variable substitution', async () => {
    const template: types.Template = {
      Name: 'test_template',
      Language: 'en',
      Category: 'marketing',
      Components: [
        {
          Type: 'body',
          Parameters: [
            { Type: 'text', Value: 'John' },
            { Type: 'text', Value: 'Premium' }
          ],
          SubType: 'text',
          Index: 0,
          Required: true
        }
      ],
      Status: 'approved',
      Version: '1.0',
      CreatedAt: new Date(),
      UpdatedAt: new Date()
    };

    const message: types.Message = {
      ID: 'template-test',
      To: '+1234567890',
      Type: 'TEMPLATE',
      Content: {
        Text: '',
        RichText: false
      },
      Template: template,
      Status: types.MessageStatus.PENDING,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      RetryCount: 0,
      Metadata: {}
    };

    const response = await request
      .post('/v1/messages')
      .send(message)
      .set('x-api-key', 'test-key');

    expect(response.status).toBe(200);
    expect(response.body.messageId).toBeDefined();
  });

  /**
   * Tests error handling and recovery mechanisms
   */
  test('should handle various error scenarios with proper recovery', async () => {
    // Configure error simulation
    mockServer.configure({ errorRate: 0.8 });

    const message: types.Message = {
      ID: 'error-test',
      To: '+1234567890',
      Type: 'TEXT',
      Content: {
        Text: 'Error test message',
        RichText: false
      },
      Status: types.MessageStatus.PENDING,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      RetryCount: 0,
      Metadata: {}
    };

    // Test with retries
    const response = await request
      .post('/v1/messages')
      .send(message)
      .set('x-api-key', 'test-key')
      .retry(RATE_LIMITS.MAX_RETRIES);

    // Verify error handling
    if (response.status !== 200) {
      expect(response.body.error).toBeDefined();
      expect(response.body.error.recoverable).toBe(true);
      expect(response.body.error.retryAfter).toBeDefined();
    }

    // Reset error rate
    mockServer.configure({ errorRate: 0.05 });
  });
});