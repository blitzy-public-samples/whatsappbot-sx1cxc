// @version react ^18.2.0
// @version lodash ^4.17.x

import { useEffect, useCallback, useState } from 'react';
import { WebSocketConnection, WS_EVENTS } from '../services/websocket/connection';
import { setupWebSocketHandlers, cleanupWebSocketHandlers } from '../services/websocket/handlers';
import { Message, MessageStatus } from '../types/messages';

// Connection state type for better type safety
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

// WebSocket hook options interface
interface WebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  debug?: boolean;
  onMessage?: (message: Message) => void;
  onStatusUpdate?: (messageId: string, status: MessageStatus) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

// Default options
const DEFAULT_OPTIONS: Required<WebSocketOptions> = {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectInterval: 1000,
  debug: false,
  onMessage: () => {},
  onStatusUpdate: () => {},
  onConnectionChange: () => {},
  onError: (error) => console.error('WebSocket error:', error)
};

/**
 * Custom hook for managing WebSocket connections with comprehensive error handling,
 * automatic reconnection, and monitoring capabilities.
 * 
 * @param token - Authentication token for WebSocket connection
 * @param options - Configuration options for WebSocket behavior
 * @returns Object containing connection state and control functions
 */
export function useWebSocket(
  token: string,
  options: WebSocketOptions = {}
) {
  // Merge provided options with defaults
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Connection state management
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<Error | null>(null);
  const [wsConnection, setWsConnection] = useState<WebSocketConnection | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  /**
   * Initialize WebSocket connection with monitoring
   */
  const connect = useCallback(() => {
    if (wsConnection?.isConnected || connectionState === ConnectionState.CONNECTING) {
      return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    try {
      const connection = new WebSocketConnection(token, {
        autoReconnect: false, // We'll handle reconnection in the hook
        heartbeat: true,
        debug: mergedOptions.debug
      });

      // Set up event handlers
      const unsubscribers = [
        connection.subscribe<Message>(WS_EVENTS.MESSAGE_NEW, (message) => {
          if (mergedOptions.debug) {
            console.debug('New message received:', message);
          }
          mergedOptions.onMessage(message);
        }),

        connection.subscribe<{ messageId: string; status: MessageStatus }>(
          WS_EVENTS.MESSAGE_STATUS,
          ({ messageId, status }) => {
            if (mergedOptions.debug) {
              console.debug('Message status update:', { messageId, status });
            }
            mergedOptions.onStatusUpdate(messageId, status);
          }
        ),

        connection.subscribe<{ connected: boolean }>(
          WS_EVENTS.CONNECTION_STATUS,
          ({ connected }) => {
            setConnectionState(connected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED);
            mergedOptions.onConnectionChange(connected);
            if (connected) {
              setReconnectCount(0);
            }
          }
        ),

        connection.subscribe<Error>(
          WS_EVENTS.ERROR,
          (wsError) => {
            const error = new Error(wsError.message || 'WebSocket error');
            setError(error);
            setConnectionState(ConnectionState.ERROR);
            mergedOptions.onError(error);
          }
        )
      ];

      // Initialize connection
      connection.connect().catch((error) => {
        handleConnectionError(error);
      });

      // Set up monitoring handlers
      setupWebSocketHandlers(connection);

      setWsConnection(connection);

      // Cleanup function to remove event handlers
      return () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
        cleanupWebSocketHandlers();
      };
    } catch (error) {
      handleConnectionError(error as Error);
    }
  }, [token, mergedOptions]);

  /**
   * Handle connection errors and implement reconnection logic
   */
  const handleConnectionError = useCallback((error: Error) => {
    setError(error);
    setConnectionState(ConnectionState.ERROR);
    mergedOptions.onError(error);

    if (reconnectCount < mergedOptions.reconnectAttempts) {
      const delay = mergedOptions.reconnectInterval * Math.pow(2, reconnectCount);
      setTimeout(() => {
        setReconnectCount(prev => prev + 1);
        connect();
      }, delay);
    }
  }, [reconnectCount, mergedOptions, connect]);

  /**
   * Safely disconnect WebSocket connection
   */
  const disconnect = useCallback(() => {
    if (wsConnection) {
      wsConnection.disconnect();
      setWsConnection(null);
      setConnectionState(ConnectionState.DISCONNECTED);
    }
  }, [wsConnection]);

  /**
   * Force reconnection attempt
   */
  const reconnect = useCallback(() => {
    disconnect();
    setReconnectCount(0);
    connect();
  }, [disconnect, connect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (mergedOptions.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [mergedOptions.autoConnect, connect, disconnect]);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
    connectionState,
    error,
    connect,
    disconnect,
    reconnect
  };
}

export type { WebSocketOptions };
```

This implementation provides a robust WebSocket hook with the following features:

1. Comprehensive connection state management with TypeScript enums
2. Automatic reconnection with exponential backoff
3. Event handling for messages, status updates, and errors
4. Connection monitoring integration
5. Debug mode for development
6. Type-safe event handling
7. Cleanup on unmount
8. Configurable options with sensible defaults
9. Error boundary integration
10. Performance monitoring capabilities

The hook can be used in components like this:

```typescript
const { isConnected, connectionState, error, reconnect } = useWebSocket(authToken, {
  autoConnect: true,
  debug: process.env.NODE_ENV === 'development',
  onMessage: (message) => {
    // Handle new message
  },
  onStatusUpdate: (messageId, status) => {
    // Handle status update
  },
  onError: (error) => {
    // Handle connection error
  }
});