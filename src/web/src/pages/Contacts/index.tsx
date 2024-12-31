import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Button, Modal, CircularProgress } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import ContactList from '../../components/contacts/ContactList';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Contact } from '../../types/contacts';
import { LoadingState } from '../../types/common';

/**
 * ContactsPage Component
 * Main contacts management interface with real-time updates and optimized performance
 */
const ContactsPage: React.FC = React.memo(() => {
  // State management
  const [errorState, setErrorState] = useState<{
    message: string;
    retryCount: number;
  }>({ message: '', retryCount: 0 });

  // WebSocket connection for real-time updates
  const { 
    isConnected, 
    connectionState, 
    error: wsError 
  } = useWebSocket(localStorage.getItem('whatsapp_web_token') || '', {
    autoConnect: true,
    reconnectAttempts: 5,
    debug: process.env.NODE_ENV === 'development',
    onMessage: handleRealTimeUpdate,
    onError: handleWebSocketError
  });

  // Analytics tracking
  const { trackEvent } = useAnalytics();

  /**
   * Handles real-time contact updates from WebSocket
   */
  function handleRealTimeUpdate(message: any) {
    try {
      if (message.type === 'CONTACT_UPDATE') {
        trackEvent('contact_update_received', {
          type: message.payload.type,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      handleError(error as Error);
    }
  }

  /**
   * Handles WebSocket connection errors
   */
  function handleWebSocketError(error: Error) {
    handleError(error);
  }

  /**
   * Comprehensive error handler with retry mechanism
   */
  const handleError = useCallback((error: Error) => {
    setErrorState(prev => ({
      message: error.message,
      retryCount: prev.retryCount + 1
    }));

    // Track error in analytics
    trackEvent('contact_page_error', {
      error: error.message,
      retryCount: errorState.retryCount,
      timestamp: new Date().toISOString()
    });
  }, [errorState.retryCount, trackEvent]);

  /**
   * Handles contact selection
   */
  const handleContactSelect = useCallback((contact: Contact | null) => {
    trackEvent('contact_selected', {
      contactId: contact?.id,
      timestamp: new Date().toISOString()
    });
  }, [trackEvent]);

  /**
   * Handles contact deletion
   */
  const handleContactDelete = useCallback((id: string) => {
    trackEvent('contact_deleted', {
      contactId: id,
      timestamp: new Date().toISOString()
    });
  }, [trackEvent]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div role="alert">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <Button 
        variant="contained" 
        onClick={resetErrorBoundary}
        sx={{ mt: 2 }}
      >
        Try again
      </Button>
    </div>
  ), []);

  // Performance optimization for large contact lists
  const contactListMemo = useMemo(() => (
    <ContactList
      onSelect={handleContactSelect}
      onDelete={handleContactDelete}
      testId="contacts-page-list"
    />
  ), [handleContactSelect, handleContactDelete]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => setErrorState({ message: '', retryCount: 0 })}
    >
      <Grid
        container
        spacing={3}
        sx={{
          p: 3,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Connection status indicator */}
        {!isConnected && (
          <Grid item xs={12}>
            <div role="alert" aria-live="polite">
              Connecting to real-time updates...
              <CircularProgress size={20} sx={{ ml: 2 }} />
            </div>
          </Grid>
        )}

        {/* Main contact list */}
        <Grid item xs={12}>
          {contactListMemo}
        </Grid>

        {/* Error display */}
        {errorState.message && (
          <Modal
            open={!!errorState.message}
            onClose={() => setErrorState({ message: '', retryCount: 0 })}
            aria-labelledby="error-modal-title"
          >
            <div>
              <h2 id="error-modal-title">Error</h2>
              <p>{errorState.message}</p>
              <Button 
                onClick={() => setErrorState({ message: '', retryCount: 0 })}
                variant="contained"
              >
                Dismiss
              </Button>
            </div>
          </Modal>
        )}
      </Grid>
    </ErrorBoundary>
  );
});

ContactsPage.displayName = 'ContactsPage';

export default ContactsPage;