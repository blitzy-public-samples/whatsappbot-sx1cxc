// @version @reduxjs/toolkit ^1.9.x
// @version @jest/globals ^29.x
// @version @testing-library/react ^14.x

import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  messagesSlice,
  fetchMessages,
  sendNewMessage,
  scheduleNewMessage,
  sendBulkMessageRequests,
  updateMessageStatus,
  setSelectedMessage,
  setFilter,
  updateRealTimeConnection,
  selectAllMessages,
  selectMessageById,
  selectFailedMessages,
  selectMessagesMetrics
} from '../../../../web/src/store/slices/messagesSlice';
import { messageService } from '../../../../web/src/services/api/messages';
import { Message, MessageStatus, MessageType } from '../../../../web/src/types/messages';

// Mock the message service
jest.mock('../../../../web/src/services/api/messages');

// Test store setup helper
const createTestStore = () => {
  return configureStore({
    reducer: {
      messages: messagesSlice.reducer
    }
  });
};

// Test data factory
const createTestMessage = (overrides?: Partial<Message>): Message => ({
  id: '123',
  organizationId: 'org123',
  recipientPhone: '+1234567890',
  type: MessageType.TEXT,
  content: {
    text: 'Test message',
    caption: null,
    mediaUrl: null,
    mediaType: null,
    mimeType: null,
    fileSize: null,
    thumbnailUrl: null
  },
  status: MessageStatus.QUEUED,
  scheduledAt: null,
  sentAt: null,
  deliveredAt: null,
  failureReason: null,
  retryCount: 0,
  lastRetryAt: null,
  ...overrides
});

describe('messagesSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('sendNewMessage thunk', () => {
    it('should handle successful message sending', async () => {
      const message = createTestMessage();
      const request = {
        recipients: [message.recipientPhone],
        type: message.type,
        content: message.content
      };

      (messageService.sendMessage as jest.Mock).mockResolvedValueOnce(message);

      const result = await store.dispatch(sendNewMessage(request));
      
      expect(result.type).toBe(sendNewMessage.fulfilled.type);
      expect(result.payload).toEqual(message);
      
      const state = store.getState().messages;
      expect(selectMessageById(state, message.id)).toEqual(message);
      expect(state.metrics.totalSent).toBe(1);
    });

    it('should handle message sending failure', async () => {
      const errorMessage = 'Failed to send message';
      (messageService.sendMessage as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      const request = {
        recipients: ['+1234567890'],
        type: MessageType.TEXT,
        content: { text: 'Test' }
      };

      const result = await store.dispatch(sendNewMessage(request));
      
      expect(result.type).toBe(sendNewMessage.rejected.type);
      expect(result.payload).toBe(errorMessage);
      
      const state = store.getState().messages;
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('fetchMessages thunk', () => {
    it('should handle successful message fetching', async () => {
      const messages = [
        createTestMessage({ id: '1' }),
        createTestMessage({ id: '2' })
      ];

      (messageService.getMessages as jest.Mock).mockResolvedValueOnce(messages);

      const result = await store.dispatch(fetchMessages(null));
      
      expect(result.type).toBe(fetchMessages.fulfilled.type);
      expect(result.payload).toEqual(messages);
      
      const state = store.getState().messages;
      expect(selectAllMessages(state)).toEqual(messages);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should handle message fetching with filters', async () => {
      const filter = { status: [MessageStatus.DELIVERED] };
      const messages = [createTestMessage({ status: MessageStatus.DELIVERED })];

      (messageService.getMessages as jest.Mock).mockResolvedValueOnce(messages);

      await store.dispatch(fetchMessages(filter));
      
      expect(messageService.getMessages).toHaveBeenCalledWith(filter);
      
      const state = store.getState().messages;
      expect(selectAllMessages(state)).toEqual(messages);
    });
  });

  describe('updateMessageStatus thunk', () => {
    it('should handle successful status update', async () => {
      const message = createTestMessage();
      const updatedMessage = { ...message, status: MessageStatus.DELIVERED };

      (messageService.updateMessage as jest.Mock).mockResolvedValueOnce(updatedMessage);

      const result = await store.dispatch(updateMessageStatus({
        messageId: message.id,
        status: MessageStatus.DELIVERED
      }));
      
      expect(result.type).toBe(updateMessageStatus.fulfilled.type);
      expect(result.payload).toEqual(updatedMessage);
      
      const state = store.getState().messages;
      expect(selectMessageById(state, message.id)?.status).toBe(MessageStatus.DELIVERED);
      expect(state.metrics.totalDelivered).toBe(1);
    });
  });

  describe('sendBulkMessageRequests thunk', () => {
    it('should handle successful bulk message sending', async () => {
      const messages = [
        createTestMessage({ id: '1' }),
        createTestMessage({ id: '2' })
      ];

      const requests = messages.map(msg => ({
        recipients: [msg.recipientPhone],
        type: msg.type,
        content: msg.content
      }));

      (messageService.sendBulkMessages as jest.Mock).mockResolvedValueOnce({
        successful: messages,
        failed: [],
        total: messages.length
      });

      const result = await store.dispatch(sendBulkMessageRequests(requests));
      
      expect(result.type).toBe(sendBulkMessageRequests.fulfilled.type);
      expect(result.payload.successful).toEqual(messages);
      
      const state = store.getState().messages;
      expect(selectAllMessages(state)).toHaveLength(messages.length);
      expect(state.metrics.totalSent).toBe(messages.length);
    });
  });

  describe('reducer actions', () => {
    it('should handle setSelectedMessage', () => {
      const messageId = '123';
      store.dispatch(setSelectedMessage(messageId));
      
      expect(store.getState().messages.selectedMessageId).toBe(messageId);
    });

    it('should handle setFilter', () => {
      const filter = { status: [MessageStatus.QUEUED] };
      store.dispatch(setFilter(filter));
      
      expect(store.getState().messages.filter).toEqual(filter);
    });

    it('should handle updateRealTimeConnection', () => {
      store.dispatch(updateRealTimeConnection(true));
      
      expect(store.getState().messages.realTimeConnection).toBe(true);
    });
  });

  describe('selectors', () => {
    it('should select failed messages', () => {
      const messages = [
        createTestMessage({ id: '1', status: MessageStatus.FAILED }),
        createTestMessage({ id: '2', status: MessageStatus.DELIVERED })
      ];

      store = createTestStore();
      messages.forEach(msg => store.dispatch(messagesSlice.actions.addOne(msg)));

      const failedMessages = selectFailedMessages(store.getState());
      expect(failedMessages).toHaveLength(1);
      expect(failedMessages[0].status).toBe(MessageStatus.FAILED);
    });

    it('should select messages metrics', () => {
      const state = store.getState();
      const metrics = selectMessagesMetrics(state);
      
      expect(metrics).toEqual({
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0
      });
    });
  });
});