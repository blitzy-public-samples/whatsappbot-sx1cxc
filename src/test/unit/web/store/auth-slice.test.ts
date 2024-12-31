// @package jest ^29.7.0
// @package @reduxjs/toolkit ^1.9.7
// @package @testing-library/react ^14.0.0

import { configureStore } from '@reduxjs/toolkit';
import { authService } from '../../../../web/src/services/api/auth';
import { 
  reducer as authReducer,
  actions as authActions,
  loginAsync,
  logoutAsync,
  getCurrentUserAsync
} from '../../../../web/src/store/slices/authSlice';
import { UserRole } from '../../../../web/src/types/auth';
import { AUTH_CONFIG } from '../../../../web/src/config/constants';

// Mock auth service
jest.mock('../../../../web/src/services/api/auth');

describe('authSlice', () => {
  // Test store setup
  const createTestStore = () => {
    return configureStore({
      reducer: { auth: authReducer }
    });
  };

  // Mock data
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.ADMIN,
    organizationId: 'test-org',
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: true,
      timezone: 'UTC',
      dashboardLayout: {}
    },
    lastLoginAt: '2023-10-20T10:00:00Z',
    createdAt: '2023-10-01T00:00:00Z',
    updatedAt: '2023-10-20T10:00:00Z'
  };

  const mockLoginResponse = {
    user: mockUser,
    token: 'test-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600
  };

  const mockMfaChallenge = {
    challengeId: 'test-challenge',
    type: 'TOTP',
    expiresAt: '2023-10-20T10:05:00Z'
  };

  const mockSecurityEvent = {
    type: 'LOGIN_ATTEMPT',
    timestamp: new Date().toISOString(),
    details: {
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have the correct initial state', () => {
      const store = createTestStore();
      const state = store.getState().auth;

      expect(state).toEqual({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        lastActivity: expect.any(Number),
        mfaRequired: false,
        securityEvents: [],
        sessionExpiry: null
      });
    });
  });

  describe('authentication flow', () => {
    it('should handle successful login with MFA disabled', async () => {
      const store = createTestStore();
      (authService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

      await store.dispatch(loginAsync({
        email: 'test@example.com',
        password: 'Test123!',
        organizationId: 'test-org'
      }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe(mockLoginResponse.token);
      expect(state.refreshToken).toBe(mockLoginResponse.refreshToken);
      expect(state.lastActivity).toBeDefined();
      expect(state.sessionExpiry).toBeDefined();
    });

    it('should handle login failure', async () => {
      const store = createTestStore();
      const mockError = {
        code: 'AUTH_ERROR',
        message: 'Invalid credentials'
      };

      (authService.login as jest.Mock).mockRejectedValueOnce(mockError);

      await store.dispatch(loginAsync({
        email: 'test@example.com',
        password: 'wrong',
        organizationId: 'test-org'
      }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toEqual(mockError);
      expect(state.user).toBeNull();
    });

    it('should handle successful logout', async () => {
      const store = createTestStore();
      
      // First login
      store.dispatch(authActions.loginSuccess(mockLoginResponse));
      
      // Then logout
      await store.dispatch(logoutAsync());

      const state = store.getState().auth;
      expect(state).toEqual(expect.objectContaining({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null
      }));
    });
  });

  describe('MFA flow', () => {
    it('should handle MFA challenge initiation', () => {
      const store = createTestStore();
      
      store.dispatch(authActions.setMfaRequired(true));
      const state = store.getState().auth;
      
      expect(state.mfaRequired).toBe(true);
    });

    it('should handle successful MFA verification', async () => {
      const store = createTestStore();
      
      // Setup initial state with MFA required
      store.dispatch(authActions.setMfaRequired(true));
      
      // Mock MFA verification
      (authService.verifyMfa as jest.Mock).mockResolvedValueOnce(mockLoginResponse);
      
      await store.dispatch(authActions.verifyMfaSuccess(mockLoginResponse));
      
      const state = store.getState().auth;
      expect(state.mfaRequired).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
    });
  });

  describe('security features', () => {
    it('should track security events', () => {
      const store = createTestStore();
      
      store.dispatch(authActions.addSecurityEvent(mockSecurityEvent));
      
      const state = store.getState().auth;
      expect(state.securityEvents).toHaveLength(1);
      expect(state.securityEvents[0]).toEqual(mockSecurityEvent);
    });

    it('should maintain last activity timestamp', () => {
      const store = createTestStore();
      const beforeUpdate = store.getState().auth.lastActivity;
      
      store.dispatch(authActions.updateLastActivity());
      
      const afterUpdate = store.getState().auth.lastActivity;
      expect(afterUpdate).toBeGreaterThan(beforeUpdate);
    });

    it('should handle session expiry updates', () => {
      const store = createTestStore();
      const expiryTime = Date.now() + AUTH_CONFIG.SESSION_TIMEOUT;
      
      store.dispatch(authActions.updateSessionExpiry(expiryTime));
      
      const state = store.getState().auth;
      expect(state.sessionExpiry).toBe(expiryTime);
    });

    it('should clear security events', () => {
      const store = createTestStore();
      
      // Add some security events
      store.dispatch(authActions.addSecurityEvent(mockSecurityEvent));
      store.dispatch(authActions.addSecurityEvent({...mockSecurityEvent, type: 'LOGOUT'}));
      
      // Clear events
      store.dispatch(authActions.clearSecurityEvents());
      
      const state = store.getState().auth;
      expect(state.securityEvents).toHaveLength(0);
    });
  });

  describe('session management', () => {
    it('should handle session timeout', async () => {
      const store = createTestStore();
      
      // Set up authenticated session
      store.dispatch(authActions.loginSuccess(mockLoginResponse));
      
      // Simulate session timeout
      const expiredSession = Date.now() - 1000;
      store.dispatch(authActions.updateSessionExpiry(expiredSession));
      
      // Attempt to get current user
      await store.dispatch(getCurrentUserAsync());
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeDefined();
    });

    it('should refresh session on activity', () => {
      const store = createTestStore();
      const initialExpiry = store.getState().auth.sessionExpiry;
      
      // Simulate user activity
      store.dispatch(authActions.updateLastActivity());
      
      const state = store.getState().auth;
      expect(state.lastActivity).toBeGreaterThan(initialExpiry || 0);
    });
  });
});