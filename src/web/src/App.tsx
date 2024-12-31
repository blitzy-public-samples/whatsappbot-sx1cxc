/**
 * @fileoverview Root application component that provides the core application structure,
 * theme provider, routing configuration, and global state management with enhanced
 * security monitoring and accessibility features.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material'; // ^5.14.0
import { Provider } from 'react-redux'; // ^8.1.0
import { ErrorBoundary, withSentryReporting } from '@sentry/react'; // ^7.0.0
import AppRouter from './routes';
import theme from './config/theme';
import { store } from './store';
import { useAuth } from './hooks/useAuth';
import { UI_CONFIG } from './config/constants';

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" aria-live="assertive">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Reload Application
    </button>
  </div>
);

/**
 * Skip to main content link for keyboard accessibility
 */
const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    style={{
      position: 'absolute',
      left: '-9999px',
      top: 'auto',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
    }}
    onFocus={(e) => {
      e.currentTarget.style.position = 'fixed';
      e.currentTarget.style.left = '10px';
      e.currentTarget.style.top = '10px';
      e.currentTarget.style.width = 'auto';
      e.currentTarget.style.height = 'auto';
    }}
    onBlur={(e) => {
      e.currentTarget.style.position = 'absolute';
      e.currentTarget.style.left = '-9999px';
    }}
  >
    Skip to main content
  </a>
);

/**
 * Enhanced App component with security monitoring, performance tracking,
 * and accessibility features
 */
const App: React.FC = () => {
  const { validateSession } = useAuth();

  /**
   * Effect for session validation and security monitoring
   */
  useEffect(() => {
    const validateCurrentSession = async () => {
      try {
        await validateSession();
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    };

    validateCurrentSession();

    // Set up security headers
    if (process.env.NODE_ENV === 'production') {
      // Content Security Policy
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: https:;
        connect-src 'self' ${process.env.VITE_API_URL};
      `;
      document.head.appendChild(meta);
    }
  }, [validateSession]);

  return (
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error) => {
        console.error('Application Error:', error);
        // Implement your error tracking here
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          {/* CSS Reset and base styles */}
          <CssBaseline />

          {/* Accessibility skip link */}
          <SkipLink />

          {/* Main application content */}
          <main
            id="main-content"
            role="main"
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Application routing */}
            <AppRouter />
          </main>

          {/* Inject global styles for accessibility */}
          <style>
            {`
              @media (prefers-reduced-motion: reduce) {
                * {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }

              :focus-visible {
                outline: 2px solid ${theme.palette.primary.main};
                outline-offset: 2px;
              }

              .visually-hidden {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
              }
            `}
          </style>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
};

// Export the enhanced App component with performance monitoring
export default withSentryReporting(App, {
  tracingOptions: {
    trackComponents: true,
    traceStateChanges: true,
    minimumLoadTimeMs: UI_CONFIG.LOADING_TIMEOUT,
  },
});