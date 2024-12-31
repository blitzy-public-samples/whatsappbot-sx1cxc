// WhatsApp Client Unit Tests
// Dependencies:
// jest: ^29.7.0
// nock: ^13.3.8
// jest-mock-extended: ^3.0.4

import nock from 'nock';
import { mock, mockReset } from 'jest-mock-extended';
import { WhatsAppClient } from '../../../backend/message-service/pkg/whatsapp/client';
import { Message, MessageStatus, APIResponse, WebhookEvent } from '../../../backend/message-service/pkg/whatsapp/types';

describe('WhatsAppClient', () => {
  // Test configuration
  const TEST_API_KEY = 'test-api-key';
  const TEST_API_ENDPOINT = 'https://api.whatsapp.test';
  const TEST_WEBHOOK_SECRET = 'test-webhook-secret';

  // Mock client instance
  let client: WhatsAppClient;

  // Mock message data
  const createMockMessage = (data: Partial<Message> = {}): Message => ({
    id: data.id || 'test-msg-123',
    to: data.to || '+1234567890',
    type: data.type || 'text',
    content: data.content || {
      text: 'Test message',
      mediaType: undefined,
      mediaURL: undefined,
    },
    status: data.status || MessageStatus.PENDING,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    retryCount: data.retryCount || 0,
    metadata: data.metadata || {},
  });

  beforeAll(() => {
    // Disable real HTTP requests
    nock.disableNetConnect();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    mockReset();
    nock.cleanAll();

    // Initialize client with test configuration
    client = new WhatsAppClient(TEST_API_KEY, TEST_API_ENDPOINT, {
      webhookSecret: TEST_WEBHOOK_SECRET,
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
    });
  });

  afterEach(() => {
    // Verify all nock mocks were used
    expect(nock.isDone()).toBeTruthy();
  });

  describe('SendMessage', () => {
    it('should successfully send a text message', async () => {
      const message = createMockMessage();
      const expectedResponse: APIResponse = {
        messageId: message.id,
        status: 'sent',
        timestamp: new Date(),
        version: '1.0',
      };

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .reply(200, expectedResponse);

      const response = await client.SendMessage(message);
      expect(response).toEqual(expectedResponse);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const message = createMockMessage();
      const rateLimitResponse = {
        error: {
          code: 429,
          message: 'Rate limit exceeded',
          recoverable: true,
          retryAfter: 2,
        },
      };

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .reply(429, rateLimitResponse)
        .post('/messages')
        .reply(200, { messageId: message.id, status: 'sent' });

      const response = await client.SendMessage(message);
      expect(response.messageId).toBe(message.id);
    });

    it('should handle media message uploads', async () => {
      const mediaMessage = createMockMessage({
        type: 'image',
        content: {
          mediaType: 'image',
          mediaURL: 'https://example.com/test.jpg',
          caption: 'Test image',
        },
      });

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .reply(200, { messageId: mediaMessage.id, status: 'sent' });

      const response = await client.SendMessage(mediaMessage);
      expect(response.status).toBe('sent');
    });

    it('should validate template messages', async () => {
      const templateMessage = createMockMessage({
        type: 'template',
        template: {
          name: 'welcome_message',
          language: 'en',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', value: 'John' },
              ],
            },
          ],
        },
      });

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .reply(200, { messageId: templateMessage.id, status: 'sent' });

      const response = await client.SendMessage(templateMessage);
      expect(response.status).toBe('sent');
    });

    it('should handle non-recoverable errors', async () => {
      const message = createMockMessage();
      const errorResponse = {
        error: {
          code: 400,
          message: 'Invalid phone number',
          recoverable: false,
        },
      };

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .reply(400, errorResponse);

      await expect(client.SendMessage(message)).rejects.toThrow('Invalid phone number');
    });
  });

  describe('GetMessageStatus', () => {
    it('should retrieve message status successfully', async () => {
      const messageId = 'test-msg-123';
      const expectedStatus = {
        status: MessageStatus.DELIVERED,
        deliveredAt: new Date(),
      };

      nock(TEST_API_ENDPOINT)
        .get(`/messages/${messageId}`)
        .reply(200, expectedStatus);

      const status = await client.GetMessageStatus(messageId);
      expect(status).toBe(MessageStatus.DELIVERED);
    });

    it('should handle invalid message IDs', async () => {
      await expect(client.GetMessageStatus('')).rejects.toThrow('message ID is required');
    });
  });

  describe('HandleWebhook', () => {
    it('should validate webhook signatures correctly', () => {
      const mockWebhookEvent: WebhookEvent = {
        type: 'message.status',
        messageId: 'test-msg-123',
        status: MessageStatus.DELIVERED,
        timestamp: new Date(),
        version: '1.0',
        signature: 'valid-signature',
      };

      const mockRequest = {
        body: JSON.stringify(mockWebhookEvent),
        headers: {
          'x-whatsapp-signature': 'valid-signature',
        },
      };

      const result = client.ValidateWebhookSignature(
        mockRequest.body,
        mockRequest.headers['x-whatsapp-signature']
      );
      expect(result).toBeTruthy();
    });

    it('should process webhook events', async () => {
      const mockWebhookEvent: WebhookEvent = {
        type: 'message.status',
        messageId: 'test-msg-123',
        status: MessageStatus.DELIVERED,
        timestamp: new Date(),
        version: '1.0',
        signature: 'valid-signature',
      };

      const mockRequest = {
        body: mockWebhookEvent,
        headers: {
          'x-whatsapp-signature': 'valid-signature',
        },
      };

      const event = await client.HandleWebhook(mockRequest);
      expect(event.type).toBe('message.status');
      expect(event.messageId).toBe('test-msg-123');
    });

    it('should reject invalid webhook signatures', async () => {
      const mockRequest = {
        body: '{"type":"message.status"}',
        headers: {
          'x-whatsapp-signature': 'invalid-signature',
        },
      };

      await expect(client.HandleWebhook(mockRequest)).rejects.toThrow('invalid webhook signature');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent message sending', async () => {
      const messages = Array(5).fill(null).map(() => createMockMessage());
      
      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .times(5)
        .reply(200, { status: 'sent' });

      const results = await Promise.all(messages.map(msg => client.SendMessage(msg)));
      expect(results).toHaveLength(5);
      results.forEach(result => expect(result.status).toBe('sent'));
    });

    it('should respect timeout settings', async () => {
      const message = createMockMessage();

      nock(TEST_API_ENDPOINT)
        .post('/messages')
        .delay(6000) // Longer than client timeout
        .reply(200);

      await expect(client.SendMessage(message)).rejects.toThrow('timeout');
    });
  });
});