// @version React ^18.2.0
// @version @mui/material ^5.14.0

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import { MessageComposer } from '../../components/messages/MessageComposer';
import { MessageList } from '../../components/messages/MessageList';
import { useMessages } from '../../hooks/useMessages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Message, MessageStatus } from '../../types/messages';

// Constants for tab indices
const TAB_COMPOSE = 0;
const TAB_HISTORY = 1;

// Constants for WebSocket configuration
const RECONNECT_ATTEMPTS = 5;
const WS_RECONNECT_INTERVAL = 5000;
const OFFLINE_QUEUE_KEY = 'message_queue';

/**
 * Main Messages page component with offline support and real-time updates
 */
const MessagesPage: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState(TAB_COMPOSE);
  const [filter, setFilter] = useState<MessageFilter>({
    startDate: null,
    endDate: null,
    status: [],
    type: [],
    searchText: '',
    templateId: null,
    recipientGroup: null
  });

  // Hooks for message management and WebSocket connection
  const {
    messages,
    loading,
    error,
    sendMessage,
    scheduleMessage,
    retryMessage,
    syncOfflineMessages
  } = useMessages();

  const {
    connectionStatus,
    reconnect
  } = useWebSocket();

  // Handle tab changes with accessibility announcements
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    event.preventDefault();
    setActiveTab(newValue);
    // Announce tab change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Switched to ${newValue === TAB_COMPOSE ? 'compose' : 'history'} tab`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  // Sync offline messages when connection is restored
  useEffect(() => {
    if (connectionStatus === 'connected') {
      syncOfflineMessages().catch(error => {
        console.error('Failed to sync offline messages:', error);
      });
    }
  }, [connectionStatus, syncOfflineMessages]);

  // Handle message composition success
  const handleMessageSuccess = useCallback((message: Message) => {
    // Announce success to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = 'Message sent successfully';
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  // Handle message composition error
  const handleMessageError = useCallback((error: Error) => {
    console.error('Message sending failed:', error);
    // Announce error to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.textContent = 'Failed to send message. Message will be queued for retry.';
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  // Render connection status alert
  const renderConnectionStatus = useMemo(() => {
    if (connectionStatus === 'disconnected') {
      return (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <button
              onClick={reconnect}
              className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-50 rounded-md hover:bg-yellow-100"
            >
              Retry Connection
            </button>
          }
        >
          You are currently offline. Messages will be queued and sent when connection is restored.
        </Alert>
      );
    }
    return null;
  }, [connectionStatus, reconnect]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {renderConnectionStatus}

      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Message management tabs"
          variant="fullWidth"
        >
          <Tab 
            label="Compose Message" 
            id="message-tab-0"
            aria-controls="message-tabpanel-0"
          />
          <Tab 
            label="Message History" 
            id="message-tab-1"
            aria-controls="message-tabpanel-1"
          />
        </Tabs>
      </Paper>

      {loading && (
        <div className="flex justify-center p-4">
          <CircularProgress />
        </div>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      <div
        role="tabpanel"
        id={`message-tabpanel-${activeTab}`}
        aria-labelledby={`message-tab-${activeTab}`}
      >
        {activeTab === TAB_COMPOSE ? (
          <MessageComposer
            onSuccess={handleMessageSuccess}
            onError={handleMessageError}
            className="mb-4"
          />
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <MessageList
                filter={filter}
                virtualScrolling={true}
                batchSize={50}
                className="h-[calc(100vh-200px)]"
              />
            </Grid>
          </Grid>
        )}
      </div>
    </Container>
  );
};

// Add error boundary and analytics decorators
const withErrorBoundary = (WrappedComponent: React.FC) => {
  return class extends React.Component {
    componentDidCatch(error: Error) {
      console.error('Messages page error:', error);
    }

    render() {
      return <WrappedComponent />;
    }
  };
};

const withAnalytics = (WrappedComponent: React.FC) => {
  return function WithAnalyticsComponent(props: any) {
    useEffect(() => {
      // Track page view
      if (typeof window !== 'undefined') {
        // Add your analytics tracking code here
      }
    }, []);

    return <WrappedComponent {...props} />;
  };
};

export default withAnalytics(withErrorBoundary(MessagesPage));