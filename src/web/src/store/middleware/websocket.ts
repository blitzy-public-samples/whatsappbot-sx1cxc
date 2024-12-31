// @version @reduxjs/toolkit ^1.9.x
// @version lodash ^4.17.x

import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { WebSocketConnection, WS_EVENTS } from '../../services/websocket/connection';
import { setupWebSocketHandlers, cleanupWebSocketHandlers } from '../../services/websocket/handlers';
import { Message, MessageStatus } from '../../types/messages';
import { API_CONFIG } from '../../config/constants';

// WebSocket action types
export const WEBSOCKET_ACTIONS = {
  CONNECT: '@websocket/connect',
  DISCONNECT: '@websocket/disconnect',
  SEND_MESSAGE: '@websocket/sendMessage',
  RECONNECT: '@websocket/reconnect',
  CONNECTION_ERROR: '@websocket/connectionError',
  UPDATE_METRICS: '@websocket/updateMetrics'
} as const;

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  MESSAGE_PROCESSING: 100, // 100ms
  METRIC_UPDATE_INTERVAL: 5000, // 5 seconds
};

// Security configuration
const SECURITY_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 3,
  MESSAGE_RATE_LIMIT: 100, // messages per minute
  MAX_MESSAGE_SIZE: 16 * 1024 * 1024, // 16MB
  ALLOWED_MESSAGE_TYPES: ['text', 'media', 'template'],
};

/**
 * Creates a Redux middleware for managing WebSocket connections with enhanced
 * security, monitoring, and error handling capabilities.
 */
export const createWebSocketMiddleware = (): Middleware => {
  let wsConnection: WebSocketConnection | null = null;
  let messageQueue: Message[] = [];
  let rateLimitCounter = 0;
  let lastRateLimitReset = Date.now();

  // Rate limiting check
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (now - lastRateLimitReset >= 60000) {
      rateLimitCounter = 0;
      lastRateLimitReset = now;
    }
    return rateLimitCounter < SECURITY_CONFIG.MESSAGE_RATE_LIMIT;
  };

  // Message validation
  const validateMessage = (message: any): boolean => {
    if (!message || typeof message !== 'object') return false;
    if (!SECURITY_CONFIG.ALLOWED_MESSAGE_TYPES.includes(message.type)) return false;
    if (JSON.stringify(message).length > SECURITY_CONFIG.MAX_MESSAGE_SIZE) return false;
    return true;
  };

  // Performance monitoring
  const monitorPerformance = (operation: string, startTime: number) => {
    const duration = Date.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.MESSAGE_PROCESSING) {
      console.warn(`WebSocket operation ${operation} exceeded threshold: ${duration}ms`);
    }
    return duration;
  };

  return store => {
    let metricsInterval: NodeJS.Timeout;

    const handleWebSocketAction = async (action: AnyAction) => {
      const startTime = Date.now();

      try {
        switch (action.type) {
          case WEBSOCKET_ACTIONS.CONNECT:
            if (!wsConnection) {
              wsConnection = new WebSocketConnection(action.payload.token, {
                autoReconnect: true,
                heartbeat: true,
                debug: process.env.NODE_ENV === 'development'
              });

              await wsConnection.connect();
              setupWebSocketHandlers(wsConnection);

              // Start metrics collection
              metricsInterval = setInterval(() => {
                if (wsConnection) {
                  const metrics = wsConnection.getConnectionMetrics();
                  store.dispatch({
                    type: WEBSOCKET_ACTIONS.UPDATE_METRICS,
                    payload: metrics
                  });
                }
              }, PERFORMANCE_THRESHOLDS.METRIC_UPDATE_INTERVAL);
            }
            break;

          case WEBSOCKET_ACTIONS.DISCONNECT:
            if (wsConnection) {
              clearInterval(metricsInterval);
              cleanupWebSocketHandlers();
              wsConnection.disconnect();
              wsConnection = null;
            }
            break;

          case WEBSOCKET_ACTIONS.SEND_MESSAGE:
            if (wsConnection && validateMessage(action.payload)) {
              if (!checkRateLimit()) {
                throw new Error('Message rate limit exceeded');
              }
              rateLimitCounter++;
              messageQueue.push(action.payload);
              await processMessageQueue();
            }
            break;

          case WEBSOCKET_ACTIONS.RECONNECT:
            if (wsConnection) {
              await wsConnection.connect();
            }
            break;
        }

        monitorPerformance(action.type, startTime);
      } catch (error) {
        store.dispatch({
          type: WEBSOCKET_ACTIONS.CONNECTION_ERROR,
          payload: error instanceof Error ? error.message : 'Unknown WebSocket error'
        });
      }
    };

    const processMessageQueue = async () => {
      while (messageQueue.length > 0 && wsConnection) {
        const message = messageQueue.shift();
        if (message) {
          const startTime = Date.now();
          try {
            await wsConnection.send(message);
            monitorPerformance('message_processing', startTime);
          } catch (error) {
            messageQueue.unshift(message);
            throw error;
          }
        }
      }
    };

    return next => action => {
      if (Object.values(WEBSOCKET_ACTIONS).includes(action.type as any)) {
        handleWebSocketAction(action);
      }
      return next(action);
    };
  };
};

export default createWebSocketMiddleware;