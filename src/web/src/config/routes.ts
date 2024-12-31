/**
 * @fileoverview Enhanced route configuration with security, performance, and accessibility features
 * for the WhatsApp Web Enhancement Application.
 * @version 1.0.0
 * @license MIT
 */

import { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import PrivateRoute from '../routes/PrivateRoute';
import PublicRoute from '../routes/PublicRoute';
import { UserRole } from '../types/auth';

// Route path constants
export const LOGIN_ROUTE = '/login';
export const DASHBOARD_ROUTE = '/dashboard';
export const CONTACTS_ROUTE = '/contacts';
export const MESSAGES_ROUTE = '/messages';
export const TEMPLATES_ROUTE = '/templates';
export const ANALYTICS_ROUTE = '/analytics';
export const SETTINGS_ROUTE = '/settings';
export const NOT_FOUND_ROUTE = '*';

// Enhanced route object with security and performance features
interface EnhancedRouteObject extends RouteObject {
  roles?: UserRole[];
  securityHeaders?: Record<string, string>;
  performance?: {
    preload?: boolean;
    prefetch?: boolean;
    cacheControl?: string;
  };
  analytics?: {
    trackPageView?: boolean;
    trackEvents?: boolean;
  };
}

// Lazy-loaded components with performance optimization
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Contacts = lazy(() => import('../pages/Contacts'));
const Messages = lazy(() => import('../pages/Messages'));
const Templates = lazy(() => import('../pages/Templates'));
const Analytics = lazy(() => import('../pages/Analytics'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

/**
 * Generates enhanced route configuration with security and performance features
 */
const generateRouteConfig = (
  path: string,
  Component: React.FC,
  options: Partial<EnhancedRouteObject> = {}
): EnhancedRouteObject => ({
  path,
  element: (
    <Suspense fallback={<div role="progressbar">Loading...</div>}>
      <Component />
    </Suspense>
  ),
  ...options,
  securityHeaders: {
    'Content-Security-Policy': "default-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...options.securityHeaders,
  },
  performance: {
    preload: true,
    prefetch: false,
    cacheControl: 'private, max-age=3600',
    ...options.performance,
  },
  analytics: {
    trackPageView: true,
    trackEvents: true,
    ...options.analytics,
  },
});

// Application route configuration with role-based access control
export const routes: EnhancedRouteObject[] = [
  // Public routes
  {
    path: '/',
    element: <PublicRoute />,
    children: [
      generateRouteConfig(LOGIN_ROUTE, Login, {
        performance: {
          preload: true,
          prefetch: true,
          cacheControl: 'no-store',
        },
      }),
    ],
  },

  // Protected routes
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      generateRouteConfig(DASHBOARD_ROUTE, Dashboard, {
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER],
      }),
      generateRouteConfig(MESSAGES_ROUTE, Messages, {
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
      }),
      generateRouteConfig(CONTACTS_ROUTE, Contacts, {
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
      }),
      generateRouteConfig(TEMPLATES_ROUTE, Templates, {
        roles: [UserRole.ADMIN, UserRole.MANAGER],
      }),
      generateRouteConfig(ANALYTICS_ROUTE, Analytics, {
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        performance: {
          cacheControl: 'private, max-age=300',
        },
      }),
      generateRouteConfig(SETTINGS_ROUTE, Settings, {
        roles: [UserRole.ADMIN],
        securityHeaders: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      }),
    ],
  },

  // Not found route
  generateRouteConfig(NOT_FOUND_ROUTE, NotFound, {
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER],
  }),
];

/**
 * Validates user access to routes based on roles and permissions
 */
export const validateRouteAccess = (
  role: UserRole,
  requiredRoles?: UserRole[]
): boolean => {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.includes(role);
};

export default routes;