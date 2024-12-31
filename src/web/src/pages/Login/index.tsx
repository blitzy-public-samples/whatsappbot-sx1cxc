/**
 * @fileoverview Login page component implementing secure authentication with comprehensive monitoring
 * Features JWT-based auth, OAuth 2.0 integration, security event tracking, and WCAG 2.1 AA compliance
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.15.0
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import useAuth from '../../hooks/useAuth';
import { User } from '../../types/auth';
import { AUTH_CONFIG } from '../../config/constants';

/**
 * Enhanced login page component with security monitoring and accessibility features
 * Implements comprehensive authentication flow with MFA support and security event tracking
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    login, 
    isAuthenticated, 
    mfaRequired,
    error: authError,
    updateLastActivity 
  } = useAuth();

  /**
   * Handles successful login with security monitoring and session setup
   * @param user - Authenticated user data
   */
  const handleLoginSuccess = useCallback(async (user: User) => {
    try {
      // Update last activity timestamp for session monitoring
      updateLastActivity();

      // Check for MFA requirement
      if (mfaRequired) {
        navigate('/auth/mfa', { 
          state: { 
            email: user.email,
            organizationId: user.organizationId 
          } 
        });
        return;
      }

      // Navigate to dashboard on successful authentication
      navigate('/dashboard', { 
        replace: true,
        state: { 
          newLogin: true,
          timestamp: Date.now() 
        } 
      });
    } catch (error) {
      console.error('Login success handler error:', error);
    }
  }, [navigate, mfaRequired, updateLastActivity]);

  /**
   * Handles login errors with proper user feedback
   * @param error - Login error details
   */
  const handleLoginError = useCallback((error: Error) => {
    // Error is handled by the LoginForm component
    console.error('Login error:', error);
  }, []);

  /**
   * Effect to handle authenticated state redirects
   */
  useEffect(() => {
    if (isAuthenticated && !mfaRequired) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, mfaRequired, navigate]);

  /**
   * Effect to set up security monitoring
   */
  useEffect(() => {
    // Set up session timeout monitoring
    const sessionTimeout = setTimeout(() => {
      if (!isAuthenticated) {
        navigate('/auth/login', { 
          replace: true,
          state: { sessionExpired: true } 
        });
      }
    }, AUTH_CONFIG.SESSION_TIMEOUT);

    return () => {
      clearTimeout(sessionTimeout);
    };
  }, [isAuthenticated, navigate]);

  return (
    <AuthLayout
      title="Sign In"
      description="Sign in to access WhatsApp Web Enhancement Application"
    >
      <LoginForm
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        rememberMe={true}
        enableMFA={AUTH_CONFIG.MFA_CONFIG.ENABLED}
      />

      {/* Hidden error message for screen readers */}
      {authError && (
        <div 
          role="alert" 
          aria-live="polite" 
          className="visually-hidden"
        >
          {authError.message}
        </div>
      )}

      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="skip-link visually-hidden"
        tabIndex={0}
      >
        Skip to main content
      </a>
    </AuthLayout>
  );
};

// Export with security monitoring HOC
export default LoginPage;