/**
 * @fileoverview Entry point for the WhatsApp Web Enhancement Application.
 * Initializes the React application with Redux store, theme provider, and root component rendering.
 * Implements robust error handling, performance monitoring, and proper cleanup mechanisms.
 * @version 1.0.0
 * @license MIT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from './App';
import { store } from './store';
import { UI_CONFIG } from './config/constants';

// Performance marker for initialization timing
const performanceMarker = 'app_init';
performance.mark(performanceMarker);

/**
 * Validates browser environment and compatibility
 * @throws Error if environment is not supported
 */
const validateEnvironment = (): void => {
  if (!window.localStorage || !window.sessionStorage) {
    throw new Error('Browser storage is not available');
  }

  if (!window.WebSocket) {
    throw new Error('WebSocket support is required');
  }

  if (!window.crypto) {
    throw new Error('Cryptographic API support is required');
  }
};

/**
 * Initializes and renders the React application with all required providers,
 * error boundaries, and performance monitoring
 */
const renderApp = (): void => {
  try {
    validateEnvironment();

    // Get root element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // Create React root with concurrent features
    const root = ReactDOM.createRoot(rootElement);

    // Enable strict mode for development checks
    const appElement = (
      <React.StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </React.StrictMode>
    );

    // Render application
    root.render(appElement);

    // Record performance metrics
    performance.measure(
      'app_initialization',
      performanceMarker
    );

    // Register cleanup handlers
    window.addEventListener('unload', cleanup);

  } catch (error) {
    console.error('Application initialization failed:', error);
    // Display user-friendly error message
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: sans-serif;
        text-align: center;
        padding: 20px;
      ">
        <h1>Application Error</h1>
        <p>We apologize, but the application failed to initialize. Please try:</p>
        <ul style="list-style: none; padding: 0;">
          <li>Refreshing the page</li>
          <li>Using a modern browser</li>
          <li>Clearing your browser cache</li>
        </ul>
      </div>
    `;
  }
};

/**
 * Handles proper cleanup of application resources
 */
const cleanup = (): void => {
  // Clear performance markers
  performance.clearMarks(performanceMarker);
  performance.clearMeasures('app_initialization');

  // Clean up store subscriptions
  const state = store.getState();
  if (state.messages?.realTimeConnection) {
    store.dispatch({ type: '@websocket/disconnect' });
  }

  // Remove event listeners
  window.removeEventListener('unload', cleanup);
};

// Initialize application with error boundary
if (process.env.NODE_ENV === 'development') {
  // Enable React Developer Tools
  const DevTools = require('@redux-devtools/core').DevTools;
  renderApp();
} else {
  // Production initialization with error tracking
  try {
    renderApp();
  } catch (error) {
    console.error('Critical application error:', error);
    // Here you would typically send error to monitoring service
  }
}

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}

// Export store instance for external access
export { store };