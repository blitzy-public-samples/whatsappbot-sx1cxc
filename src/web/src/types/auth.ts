/**
 * @fileoverview Type definitions for authentication, user session management, and authorization
 * in the WhatsApp Web Enhancement Application frontend.
 * @version 1.0.0
 * @license MIT
 */

/**
 * Enumeration of available user roles with corresponding permission levels.
 * Maps to the authorization matrix defined in the security specifications.
 */
export enum UserRole {
  ADMIN = 'ADMIN',     // Full system access
  MANAGER = 'MANAGER', // Department-level access with some restrictions
  AGENT = 'AGENT',     // Operational access with limited permissions
  VIEWER = 'VIEWER'    // Read-only access to authorized resources
}

/**
 * Interface defining user preferences for customizable application settings.
 * @internal
 */
interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  timezone: string;
  dashboardLayout: Record<string, unknown>;
}

/**
 * Comprehensive interface defining user profile data structure with audit fields.
 * Contains all necessary user information for authentication and display purposes.
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  
  /** User's email address used for authentication */
  email: string;
  
  /** User's first name */
  firstName: string;
  
  /** User's last name */
  lastName: string;
  
  /** User's assigned role determining access permissions */
  role: UserRole;
  
  /** Organization identifier for multi-tenant support */
  organizationId: string;
  
  /** User-specific application preferences */
  preferences: UserPreferences;
  
  /** Timestamp of user's last successful login */
  lastLoginAt: string;
  
  /** Account creation timestamp */
  createdAt: string;
  
  /** Last profile update timestamp */
  updatedAt: string;
}

/**
 * Interface for login request payload with multi-tenant support.
 * Used when submitting login credentials to the authentication endpoint.
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  
  /** User's password (never stored, only transmitted) */
  password: string;
  
  /** Organization identifier for multi-tenant authentication */
  organizationId: string;
}

/**
 * Interface for login response data including JWT and refresh tokens.
 * Contains all necessary data for maintaining an authenticated session.
 */
export interface LoginResponse {
  /** Authenticated user's profile information */
  user: User;
  
  /** JWT access token for API authentication */
  token: string;
  
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  
  /** Token expiration time in seconds */
  expiresIn: number;
}

/**
 * Interface for authentication state in Redux store with activity tracking.
 * Maintains current authentication status and related information.
 */
export interface AuthState {
  /** Currently authenticated user or null if not authenticated */
  user: User | null;
  
  /** Current JWT access token or null if not authenticated */
  token: string | null;
  
  /** Current refresh token or null if not authenticated */
  refreshToken: string | null;
  
  /** Flag indicating whether user is currently authenticated */
  isAuthenticated: boolean;
  
  /** Flag indicating authentication operation in progress */
  loading: boolean;
  
  /** Current authentication error or null if none */
  error: AuthError | null;
  
  /** Timestamp of last user activity for session management */
  lastActivity: string;
}

/**
 * Interface for structured authentication error information.
 * Provides detailed error information for handling authentication failures.
 */
export interface AuthError {
  /** Error code for identifying specific error types */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Timestamp when the error occurred */
  timestamp: string;
}