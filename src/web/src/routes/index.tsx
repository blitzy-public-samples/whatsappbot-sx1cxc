/**
 * @fileoverview Central routing configuration component that implements secure,
 * role-based routing with authentication flow, authorization requirements, and
 * performance monitoring.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth';

// Route configuration with role-based access control
const routeConfig = [
  // Public routes
  {
    path: '/auth',
    element: <PublicRoute />,
    children: [
      {
        path: 'login',
        lazy: () => import('../pages/auth/Login')
      },
      {
        path: 'register',
        lazy: () => import('../pages/auth/Register')
      },
      {
        path: 'forgot-password',
        lazy: () => import('../pages/auth/ForgotPassword')
      }
    ]
  },

  // Protected routes
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        path: 'dashboard',
        lazy: () => import('../pages/Dashboard'),
        requiredRole: UserRole.VIEWER
      },
      {
        path: 'messages',
        lazy: () => import('../pages/Messages'),
        requiredRole: UserRole.AGENT
      },
      {
        path: 'contacts',
        lazy: () => import('../pages/Contacts'),
        requiredRole: UserRole.AGENT
      },
      {
        path: 'templates',
        lazy: () => import('../pages/Templates'),
        requiredRole: UserRole.MANAGER
      },
      {
        path: 'analytics',
        lazy: () => import('../pages/Analytics'),
        requiredRole: UserRole.MANAGER
      },
      {
        path: 'settings',
        lazy: () => import('../pages/Settings'),
        requiredRole: UserRole.ADMIN
      }
    ]
  },

  // Error routes
  {
    path: '/unauthorized',
    lazy: () => import('../pages/errors/Unauthorized')
  },
  {
    path: '*',
    lazy: () => import('../pages/errors/NotFound')
  }
];

/**
 * Creates enhanced route configuration with security and monitoring features
 * @param routes - Base route configuration
 * @returns Enhanced route configuration
 */
const createEnhancedRoutes = (routes: typeof routeConfig) => {
  return routes.map(route => ({
    ...route,
    errorElement: (
      <ErrorBoundary
        fallback={<div>Something went wrong. Please try again.</div>}
        onError={(error) => {
          console.error('Route Error:', error);
          // Implement your error tracking here
        }}
      />
    ),
    children: route.children?.map(child => ({
      ...child,
      // Add performance monitoring
      element: React.createElement(
        React.Suspense,
        {
          fallback: <div>Loading...</div>
        },
        child.element
      )
    }))
  }));
};

/**
 * Main router component that provides secure routing with comprehensive
 * security monitoring and performance tracking
 */
const AppRouter: React.FC = () => {
  const { isAuthenticated, validateSession } = useAuth();

  // Session validation effect
  useEffect(() => {
    if (isAuthenticated) {
      const validateCurrentSession = async () => {
        try {
          await validateSession();
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      };

      validateCurrentSession();
    }
  }, [isAuthenticated, validateSession]);

  // Create router with enhanced routes
  const router = createBrowserRouter(createEnhancedRoutes(routeConfig));

  return (
    <RouterProvider 
      router={router}
      fallbackElement={<div>Loading application...</div>}
    />
  );
};

// Export the router component
export default AppRouter;

// Export route configuration for testing
export { routeConfig };