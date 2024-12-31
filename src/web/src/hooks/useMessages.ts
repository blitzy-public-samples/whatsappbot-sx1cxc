// @version React ^18.2.0
// @version react-redux ^8.1.0
// @version lodash ^4.17.21

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce, throttle } from 'lodash';
import { 
  Message, 
  MessageRequest, 
  MessageFilter, 
  MessageStatus, 
  MessageError, 
  RetryConfig 
} from '../../types/messages';
import { 
  sendBulkMessages, 
  retryFailedMessage 
} from '../../services/api/messages';
import { 
  setupWebSocketHandlers, 
  cleanupWebSocketHandlers, 
  handleWebSocketError, 
  reconnectWebSocket, 
  handleOfflineQueue 
} from '../../services/websocket/handlers';
import { 
  selectAllMessages, 
  selectMessageLoadingState, 
  selectMessagesMetrics,
  sendNewMessage,
  scheduleNewMessage,
  updateMessageStatus,
  addToRetryQueue,
  removeFromRetryQueue,
  updateMetrics,
  setFilter
} from '../../store/slices/messagesSlice';
import { UI_CONFIG, API_CONFIG } from '../../config/constants';

/**
 * Custom hook for managing WhatsApp message operations with comprehensive error handling
 * and performance optimizations.
 */
export const useMessages = (
  initialFilter?: MessageFilter,
  retryConfig: RetryConfig = { maxAttempts: 3, delayMs: 5000 }
) => {
  const dispatch = useDispatch();
  const messages = useSelector(selectAllMessages);
  const { loading, error } = useSelector(selectMessageLoadingState);
  const metrics = useSelector(selectMessagesMetrics);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [offlineQueue, setOfflineQueue] = useState<MessageRequest[]>([]);

  // Memoized message operations with error handling
  const sendMessageWithRetry = useCallback(async (request: MessageRequest) => {
    try {
      const result = await dispatch(sendNewMessage(request)).unwrap();
      return result;
    } catch (error) {
      const retryableError = error as MessageError;
      if (retryableError.retryable && retryConfig.maxAttempts > 0) {
        dispatch(addToRetryQueue(request.id));
        return retryMessage(request, retryConfig);
      }
      throw error;
    }
  }, [dispatch, retryConfig]);

  // Optimized batch message handling with progress tracking
  const handleMessageBatch = useCallback(async (requests: MessageRequest[]) => {
    const batchSize = 50; // Optimal batch size based on performance testing
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, Math.min(i + batchSize, requests.length));
      try {
        const batchResults = await sendBulkMessages(batch, {
          onProgress: (progress) => {
            dispatch(updateMetrics({ batchProgress: progress }));
          }
        });
        results.push(...batchResults.successful);
      } catch (error) {
        console.error('Batch processing error:', error);
        // Add failed requests to retry queue
        batch.forEach(request => dispatch(addToRetryQueue(request.id)));
      }
    }
    
    return results;
  }, [dispatch]);

  // Debounced filter updates to prevent excessive re-renders
  const updateFilter = useCallback(
    debounce((newFilter: MessageFilter) => {
      dispatch(setFilter(newFilter));
    }, UI_CONFIG.DEBOUNCE_DELAY),
    [dispatch]
  );

  // Throttled WebSocket reconnection logic
  const handleReconnection = useCallback(
    throttle(() => {
      setConnectionStatus('reconnecting');
      reconnectWebSocket(wsRef.current, {
        onSuccess: () => setConnectionStatus('connected'),
        onError: (error) => {
          handleWebSocketError(error);
          setConnectionStatus('disconnected');
        }
      });
    }, API_CONFIG.RETRY_DELAY),
    []
  );

  // Setup WebSocket connection and handlers
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        const handlers = {
          onMessage: (message: Message) => {
            dispatch(updateMessageStatus(message));
          },
          onStatusChange: (status: { connected: boolean }) => {
            setConnectionStatus(status.connected ? 'connected' : 'disconnected');
          },
          onError: handleWebSocketError
        };

        wsRef.current = await setupWebSocketHandlers(handlers);
      } catch (error) {
        console.error('WebSocket setup error:', error);
        handleReconnection();
      }
    };

    setupWebSocket();

    return () => {
      cleanupWebSocketHandlers();
      wsRef.current?.close();
    };
  }, [dispatch, handleReconnection]);

  // Handle offline queue when connection is restored
  useEffect(() => {
    if (connectionStatus === 'connected' && offlineQueue.length > 0) {
      handleOfflineQueue(offlineQueue, {
        onComplete: () => setOfflineQueue([]),
        onError: (error) => console.error('Offline queue processing error:', error)
      });
    }
  }, [connectionStatus, offlineQueue]);

  // Retry failed messages
  const retryMessage = useCallback(async (
    request: MessageRequest, 
    config: RetryConfig
  ) => {
    try {
      const result = await retryFailedMessage(request, config);
      dispatch(removeFromRetryQueue(request.id));
      return result;
    } catch (error) {
      console.error('Message retry failed:', error);
      throw error;
    }
  }, [dispatch]);

  return {
    messages,
    loading,
    error,
    metrics,
    connectionStatus,
    sendMessageWithRetry,
    handleMessageBatch,
    updateFilter,
    retryMessage,
    offlineQueue
  };
};

export type UseMessagesReturn = ReturnType<typeof useMessages>;