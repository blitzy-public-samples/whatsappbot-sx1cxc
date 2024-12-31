/**
 * @fileoverview Root Redux store configuration with enhanced middleware stack,
 * real-time communication, and monitoring capabilities for the WhatsApp Web Enhancement Application.
 * @version 1.0.0
 */

import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit';
import thunk from 'redux-thunk'; // v2.4.2
import circuitBreaker from 'redux-circuit-breaker'; // v1.0.0
import reduxLogger from 'redux-logger'; // v3.0.6

// Import reducers
import analyticsReducer from './slices/analyticsSlice';
import authReducer from './slices/authSlice';
import contactsReducer from './slices/contactsSlice';
import messagesReducer from './slices/messagesSlice';
import templatesReducer from './slices/templatesSlice';

// Import middleware
import { createEnhancedApiMiddleware } from './middleware/api';
import { createWebSocketMiddleware } from './middleware/websocket';

// Constants for store configuration
const REDUX_DEVTOOLS_CONFIG = {
  maxAge: 50,
  trace: true,
  traceLimit: 25,
  actionsBlacklist: ['@websocket/heartbeat']
};

// Configure root reducer with strict type checking
const rootReducer = combineReducers({
  analytics: analyticsReducer,
  auth: authReducer,
  contacts: contactsReducer,
  messages: messagesReducer,
  templates: templatesReducer
});

// Configure middleware stack with monitoring and error handling
const configureAppStore = () => {
  // Initialize enhanced middleware
  const apiMiddleware = createEnhancedApiMiddleware();
  const websocketMiddleware = createWebSocketMiddleware();

  // Base middleware array
  const middleware: Middleware[] = [
    thunk,
    apiMiddleware,
    websocketMiddleware,
    circuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000
    })
  ];

  // Add development middleware
  if (process.env.NODE_ENV === 'development') {
    middleware.push(reduxLogger);
  }

  // Configure store with enhanced capabilities
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable values in specific action types
          ignoredActions: ['@websocket/connect', '@websocket/disconnect'],
          // Ignore non-serializable paths
          ignoredPaths: ['websocket.connection']
        },
        thunk: {
          extraArgument: {
            api: apiMiddleware,
            websocket: websocketMiddleware
          }
        }
      }).concat(middleware),
    devTools: process.env.NODE_ENV !== 'production' 
      ? REDUX_DEVTOOLS_CONFIG 
      : false
  });

  // Enable hot module replacement for reducers
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./slices', () => {
      store.replaceReducer(rootReducer);
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Export store types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store instance and types
export default store;

// Type guard for checking if state is initialized
export const isStateInitialized = (state: RootState): boolean => {
  return state.auth.isAuthenticated !== null;
};

// Selector for getting global loading state
export const selectGlobalLoadingState = (state: RootState): boolean => {
  return Object.values(state).some(slice => 
    typeof slice === 'object' && 
    slice !== null && 
    'loading' in slice && 
    slice.loading === true
  );
};

// Selector for getting global error state
export const selectGlobalErrorState = (state: RootState): string | null => {
  const errors = Object.values(state)
    .filter(slice => 
      typeof slice === 'object' && 
      slice !== null && 
      'error' in slice && 
      slice.error !== null
    )
    .map(slice => slice.error);
  
  return errors.length > 0 ? errors[0] : null;
};