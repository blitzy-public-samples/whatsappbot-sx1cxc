/**
 * @fileoverview PublicRoute component for implementing secure route-level access control
 * for public routes in the WhatsApp Web Enhancement Application.
 * @version 1.0.0
 * @license MIT
 */

import React from 'react';
import { Navigate } from 'react-router-dom'; // ^6.16.0
import useAuth from '../../hooks/useAuth';
import AuthLayout from '../../layouts/AuthLayout';

/**
 * PublicRoute component that manages access control for public routes,
 * implementing secure routing logic and consistent layout application.
 * Redirects authenticated users to dashboard while providing AuthLayout
 * wrapper for unauthenticated users.
 *
 * @component
 * @version 1.0.0
 */
const PublicRoute: React.FC<React.PropsWithChildren> = React.memo(({ children }) => {
  // Get authentication status from auth hook
  const { isAuthenticated } = useAuth();

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return (
      <Navigate 
        to="/dashboard" 
        replace 
        aria-label="Redirecting to dashboard"
      />
    );
  }

  // Render public route content wrapped in AuthLayout for unauthenticated users
  return (
    <AuthLayout
      title="Welcome"
      description="Access the WhatsApp Web Enhancement Application"
    >
      {children}
    </AuthLayout>
  );
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

export default PublicRoute;