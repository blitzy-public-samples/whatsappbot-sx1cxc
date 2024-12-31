// @package axios ^1.6.0
// @package crypto-js ^4.1.1

import { AxiosResponse } from 'axios';
import apiClient, { API_ENDPOINTS } from '../../config/api';
import { LoginCredentials, LoginResponse, User, AuthError } from '../../types/auth';
import { StorageService } from '../../utils/storage';
import { AUTH_CONFIG } from '../../config/constants';

// Initialize secure storage service with encryption
const storageService = new StorageService('local', {
  encryptionKey: AUTH_CONFIG.ENCRYPTION_KEY,
});

/**
 * Security event types for monitoring and auditing
 */
enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  MFA_CHALLENGE = 'MFA_CHALLENGE',
  MFA_SUCCESS = 'MFA_SUCCESS',
  MFA_FAILURE = 'MFA_FAILURE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

/**
 * Interface for device information collection
 */
interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution: string;
}

/**
 * Enhanced authentication service with security monitoring and MFA support
 */
class AuthService {
  private readonly TOKEN_KEY = AUTH_CONFIG.TOKEN_KEY;
  private readonly REFRESH_TOKEN_KEY = AUTH_CONFIG.REFRESH_TOKEN_KEY;
  private sessionCheckInterval: number | null = null;
  private tokenRefreshTimeout: number | null = null;

  /**
   * Collects device information for security monitoring
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  /**
   * Logs security events for monitoring and auditing
   */
  private async logSecurityEvent(
    eventType: SecurityEventType,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.SECURITY_LOG, {
        eventType,
        timestamp: new Date().toISOString(),
        deviceInfo: this.getDeviceInfo(),
        ...details
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Initiates session monitoring for security
   */
  private startSessionMonitoring(): void {
    // Check session status every minute
    this.sessionCheckInterval = window.setInterval(() => {
      this.checkSessionStatus();
    }, 60000);

    // Setup token refresh before expiration
    const token = this.getToken();
    if (token) {
      const expiresIn = this.getTokenExpirationTime(token);
      const refreshTime = expiresIn - 300000; // 5 minutes before expiration
      this.tokenRefreshTimeout = window.setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  /**
   * Stops session monitoring
   */
  private stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }
  }

  /**
   * Checks current session status
   */
  private async checkSessionStatus(): Promise<void> {
    try {
      const token = await this.getToken();
      if (!token) {
        this.handleSessionExpired();
        return;
      }

      const response = await apiClient.get(API_ENDPOINTS.AUTH.SESSION_CHECK);
      if (!response.data.valid) {
        this.handleSessionExpired();
      }
    } catch (error) {
      this.handleSessionExpired();
    }
  }

  /**
   * Handles expired sessions
   */
  private async handleSessionExpired(): Promise<void> {
    await this.logSecurityEvent(SecurityEventType.SESSION_EXPIRED, {});
    this.logout();
    window.dispatchEvent(new CustomEvent('sessionExpired'));
  }

  /**
   * Decodes and validates JWT token
   */
  private getTokenExpirationTime(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      return 0;
    }
  }

  /**
   * Enhanced login with MFA support and security monitoring
   */
  public async login(
    credentials: LoginCredentials,
    mfaToken?: string
  ): Promise<LoginResponse> {
    try {
      const deviceInfo = this.getDeviceInfo();
      const response: AxiosResponse<LoginResponse> = await apiClient.post(
        API_ENDPOINTS.AUTH.LOGIN,
        {
          ...credentials,
          mfaToken,
          deviceInfo
        }
      );

      const { token, refreshToken, user } = response.data;

      // Securely store tokens
      await storageService.setItem(this.TOKEN_KEY, token, true);
      await storageService.setItem(this.REFRESH_TOKEN_KEY, refreshToken, true);

      // Start security monitoring
      this.startSessionMonitoring();

      await this.logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: user.id,
        email: user.email
      });

      return response.data;
    } catch (error: any) {
      await this.logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        email: credentials.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Secure logout with session cleanup
   */
  public async logout(): Promise<void> {
    try {
      const token = await this.getToken();
      if (token) {
        await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clean up session
      this.stopSessionMonitoring();
      await storageService.removeItem(this.TOKEN_KEY);
      await storageService.removeItem(this.REFRESH_TOKEN_KEY);
      await this.logSecurityEvent(SecurityEventType.LOGOUT, {});
    }
  }

  /**
   * Enhanced token refresh with security monitoring
   */
  public async refreshToken(): Promise<string> {
    try {
      const refreshToken = await storageService.getItem<string>(this.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH, {
        refreshToken
      });

      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      await storageService.setItem(this.TOKEN_KEY, newToken, true);
      await storageService.setItem(this.REFRESH_TOKEN_KEY, newRefreshToken, true);

      await this.logSecurityEvent(SecurityEventType.TOKEN_REFRESH, {});

      return newToken;
    } catch (error) {
      this.handleSessionExpired();
      throw error;
    }
  }

  /**
   * Retrieves current user with session validation
   */
  public async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.AUTH.PROFILE);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves current token from secure storage
   */
  public async getToken(): Promise<string | null> {
    const result = await storageService.getItem<string>(this.TOKEN_KEY);
    return result.data;
  }

  /**
   * Initiates MFA challenge
   */
  public async initiateMFA(email: string): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.MFA_INIT, { email });
      await this.logSecurityEvent(SecurityEventType.MFA_CHALLENGE, { email });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates MFA token
   */
  public async validateMFA(token: string): Promise<boolean> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.AUTH.MFA_VALIDATE, { token });
      await this.logSecurityEvent(SecurityEventType.MFA_SUCCESS, {});
      return response.data.valid;
    } catch (error) {
      await this.logSecurityEvent(SecurityEventType.MFA_FAILURE, {});
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();