// @version lodash ^4.17.x
// @version @reduxjs/toolkit ^1.9.x

import { throttle } from 'lodash';
import { store } from '@reduxjs/toolkit';
import { WebSocketConnection, WS_EVENTS } from './connection';
import { Message, MessageStatus } from '../../types/messages';
import { 
  updateMessageStatus, 
  addToRetryQueue, 
  updateMetrics, 
  updateRealTimeConnection 
} from '../../store/slices/messagesSlice';

// Performance monitoring constants
const PERFORMANCE_THRESHOLDS = {
  MESSAGE_PROCESSING: 100, // ms
  STATUS_UPDATE: 50, // ms
  BATCH_SIZE: 10,
  THROTTLE_WAIT: 100, // ms
};

// Message validation constants
const MESSAGE_VALIDATION = {
  MIN_ID_LENGTH: 10,
  MAX_RETRIES: 3,
  STATUS_TRANSITION_MAP: new Map<MessageStatus, MessageStatus[]>([
    [MessageStatus.QUEUED, [MessageStatus.SENDING, MessageStatus.FAILED]],
    [MessageStatus.SENDING, [MessageStatus.SENT, MessageStatus.FAILED]],
    [MessageStatus.SENT, [MessageStatus.DELIVERED, MessageStatus.FAILED]],
    [MessageStatus.DELIVERED, [MessageStatus.READ]],
  ]),
};

/**
 * Validates incoming message data structure and content
 * @param message - Message object to validate
 * @returns boolean indicating if message is valid
 */
const validateMessageData = (message: Message): boolean => {
  try {
    if (!message?.id || typeof message.id !== 'string' || 
        message.id.length < MESSAGE_VALIDATION.MIN_ID_LENGTH) {
      return false;
    }

    if (!message.status || !Object.values(MessageStatus).includes(message.status)) {
      return false;
    }

    if (!message.timestamp || isNaN(new Date(message.timestamp).getTime())) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Message validation error:', error);
    return false;
  }
};

/**
 * Validates message status transition
 * @param currentStatus - Current message status
 * @param newStatus - New message status
 * @returns boolean indicating if transition is valid
 */
const isValidStatusTransition = (currentStatus: MessageStatus, newStatus: MessageStatus): boolean => {
  const allowedTransitions = MESSAGE_VALIDATION.STATUS_TRANSITION_MAP.get(currentStatus);
  return allowedTransitions?.includes(newStatus) ?? false;
};

/**
 * Handles new message events with performance tracking
 * @param message - New message received via WebSocket
 */
const handleNewMessage = throttle(async (message: Message) => {
  const startTime = performance.now();
  
  try {
    if (!validateMessageData(message)) {
      throw new Error('Invalid message data received');
    }

    // Update Redux store with new message
    store.dispatch(updateMetrics({
      totalReceived: store.getState().messages.metrics.totalReceived + 1
    }));

    const processingTime = performance.now() - startTime;
    if (processingTime > PERFORMANCE_THRESHOLDS.MESSAGE_PROCESSING) {
      console.warn(`Message processing exceeded threshold: ${processingTime}ms`);
    }

  } catch (error) {
    console.error('Error handling new message:', error);
    if (message?.id) {
      store.dispatch(addToRetryQueue(message.id));
    }
  }
}, PERFORMANCE_THRESHOLDS.THROTTLE_WAIT);

/**
 * Handles message status updates with batching
 */
const handleMessageStatus = throttle(async ({ 
  messageId, 
  status, 
  timestamp 
}: { 
  messageId: string; 
  status: MessageStatus; 
  timestamp: number; 
}) => {
  const startTime = performance.now();

  try {
    const currentMessage = store.getState().messages.entities[messageId];
    
    if (!currentMessage) {
      throw new Error(`Message not found: ${messageId}`);
    }

    if (!isValidStatusTransition(currentMessage.status, status)) {
      throw new Error(`Invalid status transition from ${currentMessage.status} to ${status}`);
    }

    // Update message status in Redux store
    await store.dispatch(updateMessageStatus({ messageId, status })).unwrap();

    // Update metrics based on status
    if (status === MessageStatus.DELIVERED) {
      store.dispatch(updateMetrics({
        totalDelivered: store.getState().messages.metrics.totalDelivered + 1
      }));
    } else if (status === MessageStatus.FAILED) {
      store.dispatch(updateMetrics({
        totalFailed: store.getState().messages.metrics.totalFailed + 1
      }));
    }

    const processingTime = performance.now() - startTime;
    if (processingTime > PERFORMANCE_THRESHOLDS.STATUS_UPDATE) {
      console.warn(`Status update processing exceeded threshold: ${processingTime}ms`);
    }

  } catch (error) {
    console.error('Error handling status update:', error);
    if (messageId) {
      store.dispatch(addToRetryQueue(messageId));
    }
  }
}, PERFORMANCE_THRESHOLDS.THROTTLE_WAIT);

/**
 * Handles WebSocket connection status changes
 */
const handleConnectionStatus = (connected: boolean) => {
  store.dispatch(updateRealTimeConnection(connected));
};

/**
 * Handles WebSocket errors with retry logic
 */
const handleWebSocketError = (error: Error) => {
  console.error('WebSocket error:', error);
  // Implement retry logic if needed
};

/**
 * Sets up all WebSocket event handlers
 * @param connection - WebSocket connection instance
 */
export const setupWebSocketHandlers = (connection: WebSocketConnection): void => {
  // Subscribe to WebSocket events
  const unsubscribers = [
    connection.subscribe<Message>(WS_EVENTS.MESSAGE_NEW, handleNewMessage),
    connection.subscribe<{ messageId: string; status: MessageStatus; timestamp: number }>(
      WS_EVENTS.MESSAGE_STATUS, 
      handleMessageStatus
    ),
    connection.subscribe<{ connected: boolean }>(
      WS_EVENTS.CONNECTION_STATUS, 
      ({ connected }) => handleConnectionStatus(connected)
    ),
    connection.subscribe<Error>(WS_EVENTS.ERROR, handleWebSocketError)
  ];

  // Store unsubscribe functions for cleanup
  (window as any).__wsUnsubscribers = unsubscribers;
};

/**
 * Cleans up WebSocket event handlers
 */
export const cleanupWebSocketHandlers = (): void => {
  const unsubscribers = (window as any).__wsUnsubscribers || [];
  unsubscribers.forEach((unsubscribe: () => void) => unsubscribe());
  delete (window as any).__wsUnsubscribers;
};

export { handleWebSocketError };