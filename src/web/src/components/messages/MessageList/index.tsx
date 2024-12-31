// @version React ^18.2.0
// @version @tanstack/react-virtual ^3.0.0
// @version date-fns ^2.30.0
// @version react-error-boundary ^4.0.11

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, formatDistance } from 'date-fns';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Message,
  MessageStatus,
  MessageType,
  MessageFilter
} from '../../../types/messages';
import { useMessages } from '../../../hooks/useMessages';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { UI_CONFIG } from '../../../config/constants';

interface MessageListProps {
  filter?: MessageFilter;
  onMessageSelect?: (message: Message) => void;
  className?: string;
  virtualScrolling?: boolean;
  batchSize?: number;
}

const MessageList: React.FC<MessageListProps> = React.memo(({
  filter = {},
  onMessageSelect,
  className = '',
  virtualScrolling = true,
  batchSize = 50
}) => {
  // State and hooks
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { 
    messages, 
    loading, 
    error, 
    updateMessageStatus 
  } = useMessages(filter);
  
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // WebSocket setup for real-time updates
  const { isConnected, connectionState } = useWebSocket(
    localStorage.getItem('auth_token') || '',
    {
      onMessage: (message) => {
        updateMessageStatus(message);
      },
      onStatusUpdate: (messageId, status) => {
        updateMessageStatus({ id: messageId, status });
      }
    }
  );

  // Virtual scrolling configuration
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5
  });

  // Memoized sorted and filtered messages
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [messages]);

  // Message selection handler
  const handleMessageSelect = useCallback((message: Message) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(message.id)) {
        newSet.delete(message.id);
      } else {
        newSet.add(message.id);
      }
      return newSet;
    });
    onMessageSelect?.(message);
  }, [onMessageSelect]);

  // Status indicator component
  const StatusIndicator: React.FC<{ status: MessageStatus }> = React.memo(({ status }) => {
    const getStatusColor = () => {
      switch (status) {
        case MessageStatus.DELIVERED: return 'bg-green-500';
        case MessageStatus.FAILED: return 'bg-red-500';
        case MessageStatus.SENDING: return 'bg-yellow-500';
        default: return 'bg-gray-500';
      }
    };

    return (
      <span 
        className={`inline-block w-3 h-3 rounded-full ${getStatusColor()}`}
        aria-label={`Message status: ${status.toLowerCase()}`}
      />
    );
  });

  // Error fallback component
  const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
    <div className="p-4 text-red-500" role="alert">
      <h3 className="font-bold">Error loading messages</h3>
      <p>{error.message}</p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded"
      >
        Retry
      </button>
    </div>
  );

  // Message row component
  const MessageRow: React.FC<{ message: Message; isSelected: boolean }> = React.memo(
    ({ message, isSelected }) => (
      <div 
        className={`
          flex items-center p-4 border-b hover:bg-gray-50 transition-colors
          ${isSelected ? 'bg-blue-50' : ''}
        `}
        onClick={() => handleMessageSelect(message)}
        role="row"
        aria-selected={isSelected}
        tabIndex={0}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <StatusIndicator status={message.status} />
            <span className="ml-2 font-medium truncate">
              {message.recipientPhone}
            </span>
          </div>
          <p className="text-sm text-gray-600 truncate">
            {message.content.text}
          </p>
        </div>
        <div className="ml-4 text-right">
          <div className="text-sm text-gray-500">
            {format(new Date(message.createdAt), 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-gray-400">
            {formatDistance(new Date(message.createdAt), new Date(), { addSuffix: true })}
          </div>
        </div>
      </div>
    )
  );

  // Loading skeleton component
  const LoadingSkeleton: React.FC = () => (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center p-4 border-b">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="ml-4">
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );

  // Connection status indicator
  const ConnectionStatus: React.FC = () => (
    <div 
      className={`
        fixed bottom-4 right-4 px-3 py-1 rounded-full text-sm
        ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
      `}
      role="status"
      aria-live="polite"
    >
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className={`relative h-full ${className}`}>
        <div
          ref={parentRef}
          className="h-full overflow-auto"
          role="grid"
          aria-busy={loading}
          aria-live="polite"
        >
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const message = sortedMessages[virtualRow.index];
                return (
                  <div
                    key={message.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <MessageRow 
                      message={message}
                      isSelected={selectedIds.has(message.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ConnectionStatus />
      </div>
    </ErrorBoundary>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;