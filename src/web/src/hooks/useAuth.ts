/**
 * @fileoverview Enhanced React hook for secure authentication state management
 * Implements comprehensive security monitoring, MFA support, and session validation
 * @version 1.0.0
 * @license MIT
 */

// @package react-redux ^8.1.3
// @package react ^18.2.0

import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useRef } from 'react';
import {
  loginAsync,
  logoutAsync,
  getCurrentUserAsync,
  refreshTokenAsync,
  validateSessionAsync,
  selectAuth,
  addSecurityEvent,
  updateSessionExpiry,
  setMfaRequired
} from '../../store/slices/authSlice';
import { LoginCredentials, User, AuthState, MFAChallenge } from '../../types/auth';
import { AUTH_CONFIG } from '../../config/constants';

// Constants for session monitoring
const SESSION_MONITOR_INTERVAL = 60000; // 1 minute
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes

/**
 * Enhanced hook for secure authentication state management
 * Implements comprehensive security features including MFA, session monitoring,
 * and security event tracking
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector(selectAuth);
  const sessionCheckInterval = useRef<number>();
  const lastActivityRef = useRef<number>(Date.now());

  /**
   * Handles secure login process with MFA support
   * @param credentials User login credentials
   * @returns Promise resolving to login result
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Initial login attempt
      const result = await dispatch(loginAsync(credentials)).unwrap();

      if (result.mfaRequired) {
        dispatch(setMfaRequired(true));
        dispatch(addSecurityEvent({
          type: 'MFA_REQUIRED',
          timestamp: new Date().toISOString(),
          details: { email: credentials.email }
        }));
        return { mfaRequired: true };
      }

      // Start session monitoring on successful login
      startSessionMonitoring();
      
      dispatch(addSecurityEvent({
        type: 'LOGIN_SUCCESS',
        timestamp: new Date().toISOString(),
        details: { email: credentials.email }
      }));

      return result;
    } catch (error) {
      dispatch(addSecurityEvent({
        type: 'LOGIN_FAILURE',
        timestamp: new Date().toISOString(),
        details: { error, email: credentials.email }
      }));
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles MFA verification process
   * @param challenge MFA challenge response
   * @returns Promise resolving to verification result
   */
  const verifyMFA = useCallback(async (challenge: MFAChallenge) => {
    try {
      const result = await dispatch(validateSessionAsync(challenge)).unwrap();
      
      if (result.success) {
        dispatch(setMfaRequired(false));
        startSessionMonitoring();
        
        dispatch(addSecurityEvent({
          type: 'MFA_SUCCESS',
          timestamp: new Date().toISOString(),
          details: { userId: authState.user?.id }
        }));
      }

      return result;
    } catch (error) {
      dispatch(addSecurityEvent({
        type: 'MFA_FAILURE',
        timestamp: new Date().toISOString(),
        details: { error, userId: authState.user?.id }
      }));
      throw error;
    }
  }, [dispatch, authState.user]);

  /**
   * Handles secure logout with session cleanup
   */
  const logout = useCallback(async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      stopSessionMonitoring();
      
      dispatch(addSecurityEvent({
        type: 'LOGOUT',
        timestamp: new Date().toISOString(),
        details: { userId: authState.user?.id }
      }));
    } catch (error) {
      dispatch(addSecurityEvent({
        type: 'LOGOUT_FAILURE',
        timestamp: new Date().toISOString(),
        details: { error, userId: authState.user?.id }
      }));
      throw error;
    }
  }, [dispatch, authState.user]);

  /**
   * Starts session monitoring and token refresh mechanism
   */
  const startSessionMonitoring = useCallback(() => {
    // Clear any existing intervals
    stopSessionMonitoring();

    // Set up session monitoring
    sessionCheckInterval.current = window.setInterval(() => {
      const currentTime = Date.now();
      
      // Check for session timeout
      if (currentTime - lastActivityRef.current > AUTH_CONFIG.SESSION_TIMEOUT) {
        dispatch(addSecurityEvent({
          type: 'SESSION_TIMEOUT',
          timestamp: new Date().toISOString(),
          details: { userId: authState.user?.id }
        }));
        logout();
        return;
      }

      // Check token expiration and refresh if needed
      if (authState.sessionExpiry && 
          authState.sessionExpiry - currentTime < TOKEN_REFRESH_THRESHOLD) {
        dispatch(refreshTokenAsync());
      }

      // Validate session status
      dispatch(validateSessionAsync());
    }, SESSION_MONITOR_INTERVAL);
  }, [dispatch, authState.user, authState.sessionExpiry, logout]);

  /**
   * Stops session monitoring
   */
  const stopSessionMonitoring = useCallback(() => {
    if (sessionCheckInterval.current) {
      clearInterval(sessionCheckInterval.current);
      sessionCheckInterval.current = undefined;
    }
  }, []);

  /**
   * Updates last activity timestamp
   */
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    dispatch(updateSessionExpiry(Date.now() + AUTH_CONFIG.SESSION_TIMEOUT));
  }, [dispatch]);

  /**
   * Effect for initializing session monitoring
   */
  useEffect(() => {
    if (authState.isAuthenticated) {
      startSessionMonitoring();
    }

    return () => {
      stopSessionMonitoring();
    };
  }, [authState.isAuthenticated, startSessionMonitoring, stopSessionMonitoring]);

  /**
   * Effect for handling user activity
   */
  useEffect(() => {
    const handleActivity = () => {
      if (authState.isAuthenticated) {
        updateLastActivity();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, [authState.isAuthenticated, updateLastActivity]);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.loading,
    error: authState.error,
    mfaRequired: authState.mfaRequired,
    sessionExpiry: authState.sessionExpiry,
    login,
    logout,
    verifyMFA,
    updateLastActivity
  };
};

export default useAuth;