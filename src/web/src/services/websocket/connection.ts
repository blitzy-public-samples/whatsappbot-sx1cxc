// @version events ^3.3.0

import EventEmitter from 'events';
import { Message, MessageStatus } from '../../types/messages';
import { API_CONFIG } from '../../config/constants';

/**
 * WebSocket event type constants for type-safe event handling
 */
export const WS_EVENTS = {
  MESSAGE_NEW: 'message.new',
  MESSAGE_STATUS: 'message.status',
  CONNECTION_STATUS: 'connection.status',
  HEARTBEAT: 'connection.heartbeat',
  ERROR: 'connection.error'
} as const;

/**
 * Connection configuration constants
 */
const WS_RECONNECT_INTERVAL = 5000; // 5 seconds
const WS_MAX_RETRIES = 3;
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WS_CONNECTION_TIMEOUT = 10000; // 10 seconds

/**
 * Interface for WebSocket connection options
 */
interface ConnectionOptions {
  autoReconnect?: boolean;
  heartbeat?: boolean;
  debug?: boolean;
}

/**
 * Interface for WebSocket message event
 */
interface WebSocketMessage {
  type: keyof typeof WS_EVENTS;
  payload: unknown;
  timestamp: string;
}

/**
 * Constructs secure WebSocket URL from API configuration
 */
const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const baseUrl = API_CONFIG.BASE_URL.replace(/^http(s)?:/, protocol);
  return `${baseUrl}${API_CONFIG.WS_ENDPOINT}`;
};

/**
 * WebSocket connection manager class with automatic reconnection and event handling
 */
export class WebSocketConnection {
  private socket: WebSocket | null = null;
  private readonly eventEmitter: EventEmitter;
  private retryCount: number = 0;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly subscriptions: Map<string, Set<Function>>;
  private readonly token: string;
  private readonly options: Required<ConnectionOptions>;

  /**
   * Initialize WebSocket connection manager
   */
  constructor(token: string, options: ConnectionOptions = {}) {
    this.token = token;
    this.options = {
      autoReconnect: true,
      heartbeat: true,
      debug: false,
      ...options
    };
    this.eventEmitter = new EventEmitter();
    this.subscriptions = new Map();
    this.setupEventEmitter();
  }

  /**
   * Establish WebSocket connection with security and monitoring
   */
  public async connect(): Promise<void> {
    try {
      const url = getWebSocketUrl();
      this.socket = new WebSocket(url);
      
      // Set connection timeout
      const timeoutId = setTimeout(() => {
        if (this.socket?.readyState !== WebSocket.OPEN) {
          this.handleError(new Error('Connection timeout'));
        }
      }, WS_CONNECTION_TIMEOUT);

      // Setup event handlers
      this.socket.onopen = () => {
        clearTimeout(timeoutId);
        this.isConnected = true;
        this.retryCount = 0;
        this.emit(WS_EVENTS.CONNECTION_STATUS, { connected: true });
        
        // Start heartbeat if enabled
        if (this.options.heartbeat) {
          this.startHeartbeat();
        }

        // Send authentication
        this.sendMessage({
          type: 'auth',
          payload: { token: this.token }
        });
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          this.handleError(error as Error);
        }
      };

      this.socket.onclose = () => {
        this.handleClose();
      };

      this.socket.onerror = (error: Event) => {
        this.handleError(error);
      };

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Safely close WebSocket connection with cleanup
   */
  public disconnect(): void {
    this.clearTimers();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.emit(WS_EVENTS.CONNECTION_STATUS, { connected: false });
  }

  /**
   * Subscribe to WebSocket events
   */
  public subscribe<T>(event: keyof typeof WS_EVENTS, callback: (data: T) => void): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(event)?.delete(callback);
    };
  }

  /**
   * Send message through WebSocket connection
   */
  private sendMessage(message: Partial<WebSocketMessage>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    if (this.options.debug) {
      console.debug('WebSocket message received:', message);
    }

    switch (message.type) {
      case WS_EVENTS.MESSAGE_NEW:
        this.emit(WS_EVENTS.MESSAGE_NEW, message.payload as Message);
        break;
      case WS_EVENTS.MESSAGE_STATUS:
        this.emit(WS_EVENTS.MESSAGE_STATUS, message.payload as { id: string; status: MessageStatus });
        break;
      case WS_EVENTS.HEARTBEAT:
        this.handleHeartbeat();
        break;
      default:
        if (this.options.debug) {
          console.warn('Unknown message type:', message.type);
        }
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleClose(): void {
    this.isConnected = false;
    this.clearTimers();
    this.emit(WS_EVENTS.CONNECTION_STATUS, { connected: false });

    if (this.options.autoReconnect && this.retryCount < WS_MAX_RETRIES) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: Error | Event): void {
    this.emit(WS_EVENTS.ERROR, {
      message: error instanceof Error ? error.message : 'WebSocket error',
      timestamp: new Date().toISOString()
    });

    if (this.options.debug) {
      console.error('WebSocket error:', error);
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), WS_RECONNECT_INTERVAL);
    this.reconnectTimer = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, backoffTime);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({ type: WS_EVENTS.HEARTBEAT });
    }, WS_HEARTBEAT_INTERVAL);
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeat(): void {
    if (this.options.debug) {
      console.debug('Heartbeat received');
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Setup event emitter with type safety
   */
  private setupEventEmitter(): void {
    this.eventEmitter.setMaxListeners(50); // Increase max listeners for large applications
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: keyof typeof WS_EVENTS, data: unknown): void {
    this.subscriptions.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.handleError(error as Error);
      }
    });
  }
}