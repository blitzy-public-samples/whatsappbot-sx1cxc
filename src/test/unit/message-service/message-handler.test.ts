// External imports with versions
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3

// Internal imports
import { TestLogger } from '../../utils/test-logger';
import { TestDataGenerator } from '../../utils/test-data-generator';
import { MessageHandler } from '../../../backend/message-service/internal/handlers/message_handler';
import { MessageStatus } from '../../../backend/message-service/pkg/whatsapp/types';

// Initialize test utilities
const testLogger = new TestLogger({
  level: 'debug',
  outputFile: 'logs/message-handler.test.log'
});

const testDataGenerator = new TestDataGenerator();

// Mock dependencies
const mockMessageService = {
  ProcessMessage: jest.fn(),
  ProcessBatch: jest.fn(),
  GetMetrics: jest.fn()
};

const mockTracer = {
  startSpan: jest.fn(() => ({
    setTag: jest.fn(),
    finish: jest.fn(),
    context: jest.fn()
  }))
};

const mockCircuitBreaker = {
  Execute: jest.fn(),
  State: jest.fn()
};

const mockMetrics = {
  register: jest.fn()
};

let messageHandler: MessageHandler;

describe('MessageHandler', () => {
  beforeAll(async () => {
    testLogger.info('Initializing test suite', {
      testName: 'MessageHandler',
      testPhase: 'setup',
      timestamp: new Date(),
      correlationId: 'test-setup-001'
    });

    messageHandler = await MessageHandler.NewMessageHandler(
      mockMessageService,
      mockTracer,
      mockMetrics,
      mockCircuitBreaker
    );
  });

  afterAll(async () => {
    testLogger.info('Cleaning up test suite', {
      testName: 'MessageHandler',
      testPhase: 'cleanup',
      timestamp: new Date(),
      correlationId: 'test-cleanup-001'
    });
  });

  describe('HandleSendMessage', () => {
    test('should successfully send a valid message with media attachments', async () => {
      const message = testDataGenerator.generateMessage({}, { withMedia: true });
      const mockContext = { params: {}, body: message };

      mockCircuitBreaker.Execute.mockImplementationOnce((fn) => fn());
      mockMessageService.ProcessMessage.mockResolvedValueOnce(null);

      await messageHandler.HandleSendMessage(mockContext);

      expect(mockMessageService.ProcessMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          id: message.id,
          content: expect.objectContaining({
            media_url: expect.any(String),
            media_type: expect.any(String)
          })
        })
      );
    });

    test('should handle invalid phone number formats with detailed errors', async () => {
      const invalidMessage = testDataGenerator.generateMessage({
        recipient_phone: 'invalid-number'
      });
      const mockContext = { params: {}, body: invalidMessage };

      await messageHandler.HandleSendMessage(mockContext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('invalid phone number')
        })
      );
    });

    test('should enforce rate limiting with retry mechanism', async () => {
      const message = testDataGenerator.generateMessage();
      const mockContext = { params: {}, body: message };

      // Simulate rate limit exceeded
      mockCircuitBreaker.Execute.mockImplementationOnce(() => {
        throw new Error('rate limit exceeded');
      });

      await messageHandler.HandleSendMessage(mockContext);

      expect(mockContext.status).toBe(429);
      expect(mockContext.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('rate limit exceeded')
        })
      );
    });
  });

  describe('HandleSendBatchMessages', () => {
    test('should process valid batch with mixed media types', async () => {
      const messages = await testDataGenerator.generateBulk('message', 5, {
        withMedia: true
      });
      const mockContext = { params: {}, body: messages };

      mockCircuitBreaker.Execute.mockImplementationOnce((fn) => fn());
      mockMessageService.ProcessBatch.mockResolvedValueOnce(null);

      await messageHandler.HandleSendBatchMessages(mockContext);

      expect(mockMessageService.ProcessBatch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.objectContaining({
              media_url: expect.any(String)
            })
          })
        ])
      );
    });

    test('should handle partial failures with detailed error reporting', async () => {
      const messages = await testDataGenerator.generateBulk('message', 3);
      const mockContext = { params: {}, body: messages };

      mockCircuitBreaker.Execute.mockImplementationOnce(() => {
        throw new Error('partial batch failure: 1/3 messages failed');
      });

      await messageHandler.HandleSendBatchMessages(mockContext);

      expect(mockContext.status).toBe(500);
      expect(mockContext.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('partial batch failure'),
          failed_count: 1,
          total_count: 3
        })
      );
    });
  });

  describe('HandleScheduleMessage', () => {
    test('should schedule messages across different time zones', async () => {
      const scheduledMessage = testDataGenerator.generateMessage({}, {
        scheduled: true
      });
      const mockContext = { params: {}, body: scheduledMessage };

      mockCircuitBreaker.Execute.mockImplementationOnce((fn) => fn());
      mockMessageService.ProcessMessage.mockResolvedValueOnce(null);

      await messageHandler.HandleScheduleMessage(mockContext);

      expect(mockMessageService.ProcessMessage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          scheduled_at: expect.any(Date),
          status: 'scheduled'
        })
      );
    });

    test('should validate minimum scheduling interval', async () => {
      const invalidSchedule = testDataGenerator.generateMessage({
        scheduled_at: new Date(Date.now() - 1000) // Past date
      });
      const mockContext = { params: {}, body: invalidSchedule };

      await messageHandler.HandleScheduleMessage(mockContext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('scheduled time must be in the future')
        })
      );
    });
  });

  describe('HandleGetMessageStatus', () => {
    test('should track message delivery stages', async () => {
      const message = testDataGenerator.generateMessage({
        status: MessageStatus.SENT
      });
      const mockContext = { params: { id: message.id } };

      mockMessageService.GetMessageStatus.mockResolvedValueOnce({
        status: MessageStatus.DELIVERED,
        delivered_at: new Date(),
        attempts: 1
      });

      await messageHandler.HandleGetMessageStatus(mockContext);

      expect(mockContext.body).toEqual(
        expect.objectContaining({
          status: MessageStatus.DELIVERED,
          delivered_at: expect.any(Date),
          delivery_info: expect.objectContaining({
            attempts: 1
          })
        })
      );
    });

    test('should handle status webhooks', async () => {
      const webhookEvent = {
        message_id: testDataGenerator.generateMessage().id,
        status: MessageStatus.DELIVERED,
        timestamp: new Date(),
        delivery_info: {
          attempts: 1,
          delivered_at: new Date()
        }
      };
      const mockContext = { params: {}, body: webhookEvent };

      await messageHandler.HandleStatusWebhook(mockContext);

      expect(mockMessageService.UpdateMessageStatus).toHaveBeenCalledWith(
        expect.any(Object),
        webhookEvent.message_id,
        webhookEvent.status,
        expect.any(Object)
      );
    });
  });
});