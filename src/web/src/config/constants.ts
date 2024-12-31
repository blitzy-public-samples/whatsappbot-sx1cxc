/**
 * @fileoverview Core application constants and configuration values for the WhatsApp Web Enhancement Application.
 * This file provides centralized, type-safe configuration for API, authentication, UI, and authorization settings.
 * @version 1.0.0
 * @license MIT
 */

import { Breakpoint } from '../types/common';
import { UserRole } from '../types/auth';

/**
 * API configuration interface defining all API-related settings
 */
interface ApiConfig {
  BASE_URL: string;
  API_VERSION: string;
  TIMEOUT: number;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY: number;
  RATE_LIMIT: {
    MAX_REQUESTS: number;
    TIME_WINDOW: number;
  };
}

/**
 * Authentication configuration interface for security settings
 */
interface AuthConfig {
  TOKEN_KEY: string;
  REFRESH_TOKEN_KEY: string;
  ENCRYPTION_KEY: string;
  SESSION_TIMEOUT: number;
  INACTIVITY_TIMEOUT: number;
  MFA_CONFIG: {
    ENABLED: boolean;
    TIMEOUT: number;
  };
}

/**
 * UI configuration interface for consistent user interface behavior
 */
interface UiConfig {
  ANIMATION_DURATION: number;
  TOAST_DURATION: number;
  DEBOUNCE_DELAY: number;
  LOADING_TIMEOUT: number;
  ERROR_DISPLAY_DURATION: number;
  ACCESSIBILITY_TIMING: {
    SCREEN_READER_DELAY: number;
    FOCUS_VISIBLE_DELAY: number;
  };
}

/**
 * API configuration constants
 * Includes endpoints, timeouts, and rate limiting settings
 */
export const API_CONFIG: ApiConfig = {
  BASE_URL: process.env.VITE_API_URL || 'http://localhost:3000',
  API_VERSION: 'v1',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMIT: {
    MAX_REQUESTS: 100,
    TIME_WINDOW: 60000, // 1 minute
  },
} as const;

/**
 * Authentication configuration constants
 * Includes token management, session timeouts, and MFA settings
 */
export const AUTH_CONFIG: AuthConfig = {
  TOKEN_KEY: 'whatsapp_web_token',
  REFRESH_TOKEN_KEY: 'whatsapp_web_refresh_token',
  ENCRYPTION_KEY: process.env.VITE_ENCRYPTION_KEY as string,
  SESSION_TIMEOUT: 3600000, // 1 hour
  INACTIVITY_TIMEOUT: 900000, // 15 minutes
  MFA_CONFIG: {
    ENABLED: true,
    TIMEOUT: 300000, // 5 minutes
  },
} as const;

/**
 * UI configuration constants
 * Includes timing settings for animations, notifications, and accessibility
 */
export const UI_CONFIG: UiConfig = {
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 300,
  LOADING_TIMEOUT: 5000,
  ERROR_DISPLAY_DURATION: 5000,
  ACCESSIBILITY_TIMING: {
    SCREEN_READER_DELAY: 100,
    FOCUS_VISIBLE_DELAY: 200,
  },
} as const;

/**
 * Breakpoint configuration for responsive design
 * Matches Material Design breakpoints
 */
export const BREAKPOINTS: Record<Breakpoint, number> = {
  [Breakpoint.XS]: 0,
  [Breakpoint.SM]: 600,
  [Breakpoint.MD]: 960,
  [Breakpoint.LG]: 1280,
  [Breakpoint.XL]: 1920,
} as const;

/**
 * Permission matrix defining allowed actions for each user role
 * Maps to the authorization matrix in security specifications
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'CONFIGURE'],
  [UserRole.MANAGER]: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
  [UserRole.AGENT]: ['CREATE', 'READ', 'UPDATE'],
  [UserRole.VIEWER]: ['READ'],
} as const;

/**
 * HTTP status codes used throughout the application
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Local storage keys for persistent data
 */
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'whatsapp_web_user_prefs',
  THEME: 'whatsapp_web_theme',
  LANGUAGE: 'whatsapp_web_lang',
} as const;

/**
 * Default values for configurable settings
 */
export const DEFAULTS = {
  THEME: 'light',
  LANGUAGE: 'en',
  ITEMS_PER_PAGE: 25,
  MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB
  MAX_RETRY_COUNT: 3,
} as const;

/**
 * Regular expressions for validation
 */
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+[1-9]\d{1,14}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
} as const;

/**
 * Error message keys for i18n
 */
export const ERROR_KEYS = {
  NETWORK_ERROR: 'errors.network',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  VALIDATION_ERROR: 'errors.validation',
  RATE_LIMIT_EXCEEDED: 'errors.rateLimitExceeded',
} as const;