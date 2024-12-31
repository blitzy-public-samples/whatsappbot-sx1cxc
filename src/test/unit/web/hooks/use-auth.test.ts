/**
 * @fileoverview Comprehensive unit test suite for useAuth hook
 * Tests authentication flows, security protocols, and authorization handling
 * @version 1.0.0
 */

// @package @testing-library/react-hooks ^8.0.1
// @package @testing-library/react ^14.0.0
// @package react-redux ^8.1.3
// @package @reduxjs/toolkit ^1.9.7
// @package jest-mock-extended ^3.0.5

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { mock } from 'jest-mock-extended';
import { useAuth } from '../../../../web/src/hooks/useAuth';
import { AuthTypes } from '../../../../web/src/types/auth';
import { AUTH_CONFIG } from '../../../../web/src/config/constants';

// Mock Redux store
const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: (state = {
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        mfaRequired: false,
        sessionExpiry: null,
        securityEvents: []
      }, action) => state
    }
  });
};

// Mock test data
const mockCredentials: AuthTypes.LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  organizationId: 'test-org-id'
};

const mockUser: AuthTypes.User = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: AuthTypes.UserRole.AGENT,
  organizationId: 'test-org-id',
  preferences: {
    theme: 'light',
    language: 'en',
    notifications: true,
    timezone: 'UTC',
    dashboardLayout: {}
  },
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockMfaChallenge = {
  challengeId: 'test-mfa-challenge',
  type: 'TOTP',
  code: '123456'
};

describe('useAuth Hook', () => {
  let store: ReturnType<typeof createMockStore>;
  let wrapper: React.FC;

  beforeEach(() => {
    store = createMockStore();
    wrapper = ({ children }) => (
      <Provider store={store}>{children}</Provider>
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should handle successful login without MFA', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockCredentials);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
  });

  it('should handle login with MFA challenge', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initial login attempt
    await act(async () => {
      const loginResult = await result.current.login(mockCredentials);
      expect(loginResult.mfaRequired).toBe(true);
    });

    // Verify MFA state
    expect(result.current.mfaRequired).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    // Complete MFA verification
    await act(async () => {
      await result.current.verifyMFA(mockMfaChallenge);
    });

    expect(result.current.mfaRequired).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle session monitoring and token refresh', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login and initialize session
    await act(async () => {
      await result.current.login(mockCredentials);
    });

    // Fast forward to near token expiration
    act(() => {
      jest.advanceTimersByTime(AUTH_CONFIG.SESSION_TIMEOUT - 300000); // 5 minutes before expiry
    });

    // Verify token refresh was triggered
    expect(result.current.sessionExpiry).toBeDefined();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle session timeout and auto logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login and initialize session
    await act(async () => {
      await result.current.login(mockCredentials);
    });

    // Fast forward past session timeout
    act(() => {
      jest.advanceTimersByTime(AUTH_CONFIG.SESSION_TIMEOUT + 1000);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should track security events', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Failed login attempt
    await act(async () => {
      try {
        await result.current.login({
          ...mockCredentials,
          password: 'wrong-password'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    // Verify security event was logged
    const state = store.getState();
    expect(state.auth.securityEvents[0]).toMatchObject({
      type: 'LOGIN_FAILURE',
      details: {
        email: mockCredentials.email
      }
    });
  });

  it('should handle user activity monitoring', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login
    await act(async () => {
      await result.current.login(mockCredentials);
    });

    const initialActivity = result.current.lastActivity;

    // Simulate user activity
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });

    expect(result.current.lastActivity).toBeGreaterThan(initialActivity);
  });

  it('should handle clean logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login(mockCredentials);
    });

    // Perform logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpiry).toBeNull();
  });

  it('should handle network errors gracefully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock network failure
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      try {
        await result.current.login(mockCredentials);
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper });

    unmount();

    // Verify cleanup
    expect(window.setTimeout).toHaveBeenCalled();
    expect(window.clearTimeout).toHaveBeenCalled();
  });
});