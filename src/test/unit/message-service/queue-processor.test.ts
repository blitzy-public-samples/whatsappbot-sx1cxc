// Queue Processor Unit Tests
// Dependencies:
// jest: ^29.x
// redis-mock: ^1.x

import { MessageConsumer } from '../../../backend/message-service/internal/queue/consumer';
import { MessageProducer } from '../../../backend/message-service/internal/queue/producer';
import Redis from 'redis-mock';
import { jest } from '@jest/globals';

// Mock WhatsApp client for testing
const mockWhatsAppClient = {
  sendMessage: jest.fn(),
};

// Mock Redis client using redis-mock
const redisClient = new Redis.createClient();

describe('MessageConsumer', () => {
  let consumer: MessageConsumer;

  beforeAll(() => {
    consumer = new MessageConsumer(redisClient, mockWhatsAppClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    redisClient.flushall();
  });

  afterAll(async () => {
    await consumer.stop();
    redisClient.quit();
  });

  describe('Priority Queue Processing', () => {
    it('should process high priority messages before normal and low priority', async () => {
      // Arrange
      const highPriorityMsg = {
        id: 'high-1',
        content: { text: 'High priority message' },
        template: { name: 'urgent' },
        status: 'pending'
      };
      const normalPriorityMsg = {
        id: 'normal-1',
        content: { text: 'Normal priority message' },
        status: 'pending'
      };
      const lowPriorityMsg = {
        id: 'low-1',
        content: { text: 'Low priority message' },
        status: 'pending'
      };

      // Add messages to respective queues
      await redisClient.lpush('messages:high', JSON.stringify(highPriorityMsg));
      await redisClient.lpush('messages:normal', JSON.stringify(normalPriorityMsg));
      await redisClient.lpush('messages:low', JSON.stringify(lowPriorityMsg));

      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow processing time

      // Assert
      expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(3);
      expect(mockWhatsAppClient.sendMessage.mock.calls[0][0]).toMatchObject({
        content: highPriorityMsg.content
      });
      expect(mockWhatsAppClient.sendMessage.mock.calls[1][0]).toMatchObject({
        content: normalPriorityMsg.content
      });
      expect(mockWhatsAppClient.sendMessage.mock.calls[2][0]).toMatchObject({
        content: lowPriorityMsg.content
      });
    });

    it('should handle empty queues gracefully', async () => {
      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockWhatsAppClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Scheduled Message Processing', () => {
    it('should process scheduled messages at the correct time', async () => {
      // Arrange
      const futureTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now
      const scheduledMsg = {
        id: 'scheduled-1',
        content: { text: 'Scheduled message' },
        status: 'scheduled',
        scheduledAt: futureTime
      };

      await redisClient.zadd('messages:scheduled', futureTime, JSON.stringify(scheduledMsg));

      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for scheduled time

      // Assert
      expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: scheduledMsg.content
        })
      );
    });

    it('should not process messages scheduled for future time', async () => {
      // Arrange
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const scheduledMsg = {
        id: 'future-1',
        content: { text: 'Future message' },
        status: 'scheduled',
        scheduledAt: futureTime
      };

      await redisClient.zadd('messages:scheduled', futureTime, JSON.stringify(scheduledMsg));

      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockWhatsAppClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed messages with exponential backoff', async () => {
      // Arrange
      const failingMsg = {
        id: 'fail-1',
        content: { text: 'Failing message' },
        status: 'pending',
        retryCount: 0
      };

      mockWhatsAppClient.sendMessage.mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ status: 'sent' });

      await redisClient.lpush('messages:normal', JSON.stringify(failingMsg));

      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Allow for retries

      // Assert
      expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should move messages to dead letter queue after max retries', async () => {
      // Arrange
      const failingMsg = {
        id: 'fail-2',
        content: { text: 'Permanently failing message' },
        status: 'pending',
        retryCount: 2
      };

      mockWhatsAppClient.sendMessage.mockRejectedValue(new Error('Permanent API Error'));
      await redisClient.lpush('messages:normal', JSON.stringify(failingMsg));

      // Act
      await consumer.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert
      const deadLetterMsg = await redisClient.lrange('messages:dead', 0, -1);
      expect(deadLetterMsg).toHaveLength(1);
      expect(JSON.parse(deadLetterMsg[0])).toMatchObject({
        id: 'fail-2',
        status: 'failed'
      });
    });
  });
});

describe('MessageProducer', () => {
  let producer: MessageProducer;

  beforeAll(() => {
    producer = new MessageProducer(redisClient, {
      maxBatchSize: 1000,
      retryAttempts: 3,
      retryDelay: 2000,
      operationTimeout: 5000,
      circuitBreakerThreshold: 10,
      healthCheckInterval: 30000
    });
  });

  afterEach(() => {
    redisClient.flushall();
  });

  describe('Message Enqueuing', () => {
    it('should successfully enqueue single message with priority', async () => {
      // Arrange
      const message = {
        id: 'msg-1',
        content: { text: 'Test message' },
        status: 'pending'
      };

      // Act
      await producer.enqueueMessage(message, 'high');

      // Assert
      const queuedMsg = await redisClient.lrange('messages:high', 0, -1);
      expect(queuedMsg).toHaveLength(1);
      expect(JSON.parse(queuedMsg[0])).toMatchObject(message);
    });

    it('should reject invalid messages', async () => {
      // Arrange
      const invalidMessage = {
        id: '', // Invalid: empty ID
        content: { text: 'Test message' }
      };

      // Act & Assert
      await expect(producer.enqueueMessage(invalidMessage, 'normal'))
        .rejects.toThrow('message validation failed');
    });
  });

  describe('Batch Processing', () => {
    it('should successfully enqueue message batch', async () => {
      // Arrange
      const messages = Array.from({ length: 3 }, (_, i) => ({
        id: `batch-${i}`,
        content: { text: `Batch message ${i}` },
        status: 'pending'
      }));

      // Act
      await producer.enqueueBatch(messages, 'normal');

      // Assert
      const queuedMsgs = await redisClient.lrange('messages:normal', 0, -1);
      expect(queuedMsgs).toHaveLength(3);
      queuedMsgs.forEach((msg, i) => {
        expect(JSON.parse(msg)).toMatchObject(messages[i]);
      });
    });

    it('should reject batch exceeding max size', async () => {
      // Arrange
      const messages = Array.from({ length: 1001 }, (_, i) => ({
        id: `batch-${i}`,
        content: { text: `Batch message ${i}` },
        status: 'pending'
      }));

      // Act & Assert
      await expect(producer.enqueueBatch(messages, 'normal'))
        .rejects.toThrow('batch size exceeds maximum limit');
    });
  });

  describe('Message Scheduling', () => {
    it('should schedule message for future delivery', async () => {
      // Arrange
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const message = {
        id: 'scheduled-1',
        content: { text: 'Future message' },
        status: 'scheduled'
      };

      // Act
      await producer.scheduleMessage(message, futureTime);

      // Assert
      const scheduledMsgs = await redisClient.zrange('messages:scheduled', 0, -1);
      expect(scheduledMsgs).toHaveLength(1);
      expect(JSON.parse(scheduledMsgs[0])).toMatchObject(message);
    });

    it('should reject scheduling messages in the past', async () => {
      // Arrange
      const pastTime = new Date(Date.now() - 3600000); // 1 hour ago
      const message = {
        id: 'past-1',
        content: { text: 'Past message' },
        status: 'scheduled'
      };

      // Act & Assert
      await expect(producer.scheduleMessage(message, pastTime))
        .rejects.toThrow('scheduled time must be in the future');
    });
  });
});