/**
 * @fileoverview Enhanced PrivateRoute component implementing secure route protection
 * with role-based access control, session validation, and security monitoring.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, memo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import MainLayout from '../layouts/MainLayout';
import { CircularProgress, Box } from '@mui/material';
import { UserRole } from '../types/auth';

/**
 * Security level enum for route protection
 */
enum SecurityLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Interface for PrivateRoute component props
 */
interface PrivateRouteProps {
  /** Required role for accessing the route */
  requiredRole?: UserRole;
  /** Security level for the route */
  securityLevel?: SecurityLevel;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Enhanced PrivateRoute component that implements secure route protection with
 * role-based access control, session validation, and security monitoring.
 */
const PrivateRoute: React.FC<PrivateRouteProps> = memo(({
  requiredRole,
  securityLevel = SecurityLevel.MEDIUM,
  sessionTimeout = 3600000, // 1 hour default
  className
}) => {
  const {
    isAuthenticated,
    loading,
    user,
    validateSession,
    checkRole,
    updateLastActivity
  } = useAuth();

  /**
   * Effect for session validation and security monitoring
   */
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;

    const monitorSession = async () => {
      try {
        // Validate current session
        const isValid = await validateSession();
        
        if (!isValid) {
          // Handle invalid session
          console.warn('Invalid session detected');
          return;
        }

        // Update last activity timestamp
        updateLastActivity();
      } catch (error) {
        console.error('Session validation error:', error);
      }
    };

    // Initial session check
    monitorSession();

    // Set up periodic session validation
    sessionCheckInterval = setInterval(monitorSession, Math.min(sessionTimeout / 4, 900000));

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [validateSession, updateLastActivity, sessionTimeout]);

  /**
   * Effect for role-based access control monitoring
   */
  useEffect(() => {
    if (requiredRole && user) {
      const hasAccess = checkRole(user.role, requiredRole);
      if (!hasAccess) {
        console.warn('Unauthorized access attempt:', {
          requiredRole,
          userRole: user.role,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [requiredRole, user, checkRole]);

  // Show loading state
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        role="progressbar"
        aria-label="Verifying authentication"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: window.location.pathname }}
      />
    );
  }

  // Check role-based access
  if (requiredRole && !checkRole(user.role, requiredRole)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ requiredRole }}
      />
    );
  }

  // Render protected route content
  return (
    <MainLayout className={className}>
      <Outlet />
    </MainLayout>
  );
});

// Display name for debugging
PrivateRoute.displayName = 'PrivateRoute';

export default PrivateRoute;