// @version @testing-library/react-hooks ^8.0.1
// @version @testing-library/react ^14.0.0
// @version jest-websocket-mock ^2.4.0
// @version @reduxjs/toolkit ^1.9.0

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import WS from 'jest-websocket-mock';
import { useMessages } from '../../../../web/src/hooks/useMessages';
import messagesReducer, {
  updateMessageStatus,
  updateRealTimeConnection,
  updateMetrics
} from '../../../../web/src/store/slices/messagesSlice';
import { Message, MessageStatus, MessageType } from '../../../../web/src/types/messages';
import { API_CONFIG } from '../../../../web/src/config/constants';

// Mock WebSocket server
let mockWebSocketServer: WS;

// Test message data
const mockMessages: Message[] = [
  {
    id: '1',
    organizationId: 'org-1',
    recipientPhone: '+1234567890',
    type: MessageType.TEXT,
    content: {
      text: 'Test message 1',
      caption: null,
      mediaUrl: null,
      mediaType: null,
      mimeType: null,
      fileSize: null,
      thumbnailUrl: null
    },
    status: MessageStatus.QUEUED,
    template: null,
    scheduledAt: null,
    sentAt: null,
    deliveredAt: null,
    failureReason: null,
    retryCount: 0,
    lastRetryAt: null
  }
];

// Mock status updates
const mockStatusUpdates = [
  {
    messageId: '1',
    status: MessageStatus.SENT,
    timestamp: new Date().toISOString()
  }
];

// Test wrapper with Redux provider
const createWrapper = () => {
  const store = configureStore({
    reducer: {
      messages: messagesReducer
    }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useMessages hook', () => {
  beforeEach(() => {
    // Create WebSocket mock server
    mockWebSocketServer = new WS(`${API_CONFIG.BASE_URL}/ws`);
  });

  afterEach(() => {
    // Clean up WebSocket mock
    WS.clean();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should handle WebSocket connection lifecycle', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    // Initial state
    expect(result.current.connectionStatus).toBe('disconnected');

    // Simulate connection
    await mockWebSocketServer.connected;
    expect(result.current.connectionStatus).toBe('connected');

    // Simulate disconnection
    mockWebSocketServer.close();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should handle sending messages', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    const messageRequest = {
      recipients: ['+1234567890'],
      type: MessageType.TEXT,
      content: {
        text: 'Test message',
        caption: null,
        mediaUrl: null,
        mediaType: null,
        mimeType: null,
        fileSize: null,
        thumbnailUrl: null
      }
    };

    await act(async () => {
      await result.current.sendMessageWithRetry(messageRequest);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe(MessageStatus.QUEUED);
  });

  it('should handle real-time message status updates', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    // Add initial message
    await act(async () => {
      mockWebSocketServer.send(JSON.stringify({
        type: 'message.new',
        payload: mockMessages[0]
      }));
    });

    // Send status update
    await act(async () => {
      mockWebSocketServer.send(JSON.stringify({
        type: 'message.status',
        payload: mockStatusUpdates[0]
      }));
    });

    expect(result.current.messages[0].status).toBe(MessageStatus.SENT);
  });

  it('should handle bulk message sending', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    const bulkRequests = [
      {
        recipients: ['+1234567890'],
        type: MessageType.TEXT,
        content: { text: 'Bulk message 1' }
      },
      {
        recipients: ['+0987654321'],
        type: MessageType.TEXT,
        content: { text: 'Bulk message 2' }
      }
    ];

    await act(async () => {
      await result.current.handleMessageBatch(bulkRequests);
    });

    expect(result.current.messages).toHaveLength(2);
  });

  it('should handle connection errors and reconnection', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    // Simulate connection error
    mockWebSocketServer.error();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.connectionStatus).toBe('reconnecting');

    // Simulate successful reconnection
    await mockWebSocketServer.connected;

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('should handle message filtering', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    const filter = {
      status: [MessageStatus.SENT],
      startDate: new Date(),
      endDate: new Date(),
      recipientPhone: null,
      templateId: null
    };

    await act(async () => {
      result.current.updateFilter(filter);
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: MessageStatus.SENT })
      ])
    );
  });

  it('should handle offline queue', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: createWrapper()
    });

    // Simulate offline state
    mockWebSocketServer.close();

    const messageRequest = {
      recipients: ['+1234567890'],
      type: MessageType.TEXT,
      content: { text: 'Offline message' }
    };

    await act(async () => {
      await result.current.sendMessageWithRetry(messageRequest);
    });

    expect(result.current.offlineQueue).toHaveLength(1);

    // Simulate coming back online
    await mockWebSocketServer.connected;

    expect(result.current.offlineQueue).toHaveLength(0);
  });
});