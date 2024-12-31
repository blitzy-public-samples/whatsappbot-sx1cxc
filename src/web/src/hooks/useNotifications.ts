// @version react ^18.2.0
// @version lodash ^4.17.x

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { useWebSocket } from './useWebSocket';
import { WS_EVENTS } from '../services/websocket/connection';
import { useAnalytics } from './useAnalytics';

// Constants for notification configuration
const NOTIFICATION_AUTO_CLOSE_DELAY = 5000;
const NOTIFICATION_ICON_PATH = '/assets/images/logo.svg';
const NOTIFICATION_QUEUE_SIZE = 100;
const NOTIFICATION_DEBOUNCE_DELAY = 250;
const NOTIFICATION_PRIORITY_LEVELS = ['high', 'medium', 'low'] as const;

// Types for notification management
type NotificationPriority = typeof NOTIFICATION_PRIORITY_LEVELS[number];

interface NotificationOptions {
  debounceDelay?: number;
  maxQueueSize?: number;
  priorityLevels?: NotificationPriority[];
  groupingSimilar?: boolean;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  priority: NotificationPriority;
  timestamp: number;
  autoClose?: boolean;
  groupId?: string;
  count?: number;
  ariaLabel?: string;
}

/**
 * Custom hook for managing system notifications and real-time alerts
 * with WebSocket integration, security features, and accessibility support
 */
export const useNotifications = (options: NotificationOptions = {}) => {
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [error, setError] = useState<Error | null>(null);

  // References
  const notificationQueue = useRef<Notification[]>([]);
  const notificationCount = useRef<number>(0);

  // Analytics tracking
  const { trackEvent } = useAnalytics('last_24h');

  // WebSocket integration
  const { isConnected, connectionError, reconnect } = useWebSocket();

  // Options with defaults
  const {
    debounceDelay = NOTIFICATION_DEBOUNCE_DELAY,
    maxQueueSize = NOTIFICATION_QUEUE_SIZE,
    priorityLevels = NOTIFICATION_PRIORITY_LEVELS,
    groupingSimilar = true
  } = options;

  /**
   * Request notification permissions
   */
  const requestPermission = useCallback(async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      setError(error as Error);
      return false;
    }
  }, []);

  /**
   * Create and show a notification with security checks
   */
  const showNotification = useCallback(
    debounce(
      async (
        message: string,
        {
          type = 'info',
          priority = 'medium',
          autoClose = true,
          groupId,
          ariaLabel
        }: Partial<Notification> = {}
      ) => {
        try {
          // Validate inputs
          if (!message || typeof message !== 'string') {
            throw new Error('Invalid notification message');
          }
          if (!priorityLevels.includes(priority)) {
            throw new Error('Invalid notification priority');
          }

          const notification: Notification = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: message.trim(),
            type,
            priority,
            timestamp: Date.now(),
            autoClose,
            groupId,
            ariaLabel: ariaLabel || message,
            count: 1
          };

          // Group similar notifications if enabled
          if (groupingSimilar && groupId) {
            const existingNotification = notifications.find(n => n.groupId === groupId);
            if (existingNotification) {
              notification.count = (existingNotification.count || 1) + 1;
              setNotifications(prev =>
                prev.map(n => (n.groupId === groupId ? notification : n))
              );
              return;
            }
          }

          // Manage notification queue
          if (notificationQueue.current.length >= maxQueueSize) {
            notificationQueue.current.shift();
          }
          notificationQueue.current.push(notification);

          // Update notifications state
          setNotifications(prev => [...prev, notification]);
          notificationCount.current++;

          // Show system notification if permitted
          if (permission === 'granted') {
            new Notification(message, {
              icon: NOTIFICATION_ICON_PATH,
              tag: groupId,
              renotify: true
            });
          }

          // Track notification event
          trackEvent('notification_shown', {
            type,
            priority,
            grouped: !!groupId
          });

          // Auto-close notification if enabled
          if (autoClose) {
            setTimeout(() => {
              clearNotification(notification.id);
            }, NOTIFICATION_AUTO_CLOSE_DELAY);
          }
        } catch (error) {
          setError(error as Error);
        }
      },
      debounceDelay,
      { maxWait: debounceDelay * 2 }
    ),
    [notifications, permission, priorityLevels, groupingSimilar, maxQueueSize, trackEvent]
  );

  /**
   * Clear a specific notification
   */
  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    notificationQueue.current = notificationQueue.current.filter(n => n.id !== id);
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    notificationQueue.current = [];
    notificationCount.current = 0;
  }, []);

  /**
   * Handle WebSocket message events
   */
  useEffect(() => {
    if (!isConnected) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = JSON.parse(event.data);
      switch (type) {
        case WS_EVENTS.MESSAGE_NEW:
          showNotification(`New message: ${payload.content}`, {
            type: 'info',
            priority: 'medium',
            groupId: 'new_message'
          });
          break;
        case WS_EVENTS.MESSAGE_STATUS:
          showNotification(`Message ${payload.status}: ${payload.messageId}`, {
            type: 'info',
            priority: 'low',
            groupId: 'message_status'
          });
          break;
        case WS_EVENTS.ERROR_EVENT:
          showNotification(payload.message, {
            type: 'error',
            priority: 'high',
            autoClose: false
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isConnected, showNotification]);

  /**
   * Handle WebSocket connection errors
   */
  useEffect(() => {
    if (connectionError) {
      showNotification('Connection lost. Attempting to reconnect...', {
        type: 'warning',
        priority: 'high',
        autoClose: false
      });
    }
  }, [connectionError, showNotification]);

  // Clean up notifications on unmount
  useEffect(() => {
    return () => {
      clearNotifications();
    };
  }, [clearNotifications]);

  return {
    showNotification,
    notificationsEnabled: permission === 'granted',
    requestPermission,
    clearNotifications,
    notificationCount: notificationCount.current,
    notificationQueue: notificationQueue.current,
    error
  };
};
```

This implementation provides a comprehensive notification system with the following features:

1. Real-time notifications through WebSocket integration
2. Notification grouping and prioritization
3. Accessibility support with ARIA labels
4. Performance optimization with debouncing
5. Security features with input validation
6. Queue management with size limits
7. Analytics tracking integration
8. Auto-close functionality
9. Error handling and connection monitoring
10. Cleanup on unmount

The hook can be used in components like this:

```typescript
const {
  showNotification,
  notificationsEnabled,
  requestPermission,
  clearNotifications
} = useNotifications({
  debounceDelay: 300,
  maxQueueSize: 50,
  groupingSimilar: true
});

// Show a notification
showNotification('Operation completed successfully', {
  type: 'success',
  priority: 'medium',
  autoClose: true,
  ariaLabel: 'Operation success message'
});