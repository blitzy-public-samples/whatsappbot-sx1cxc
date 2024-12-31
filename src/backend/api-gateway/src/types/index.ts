// @ts-check
import { Request } from 'express'; // v4.18.x
import { JwtPayload } from 'jsonwebtoken'; // v9.0.x

/**
 * Enumeration of user roles for role-based access control.
 * @enum {string}
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER'
}

/**
 * Extended JWT payload containing user-specific information.
 * @interface
 */
export interface UserPayload extends JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  orgId: string;
  permissions: string[];
}

/**
 * Interface for detailed error information.
 * @interface
 */
export interface ErrorDetails {
  field: string;
  reason: string;
  value: any;
  context: Record<string, unknown>;
}

/**
 * Interface for response metadata.
 * @interface
 */
export interface ResponseMetadata {
  timestamp: number;
  requestId: string;
  version: string;
}

/**
 * Enhanced request interface with authentication information.
 * @interface
 * @extends {Request}
 */
export interface AuthenticatedRequest extends Request {
  user: UserPayload;
  hasPermission: (permission: string) => boolean;
}

/**
 * Generic API response format with type safety.
 * @interface
 * @template T - Type of the response data
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ServiceError | null;
  metadata: ResponseMetadata;
}

/**
 * Enhanced error class for service-level errors.
 * @class
 */
export class ServiceError extends Error {
  public readonly code: number;
  public readonly details: ErrorDetails | null;
  public readonly timestamp: Date;

  /**
   * Creates a new ServiceError instance.
   * @param {number} code - Error code from predefined ranges
   * @param {string} message - Error message
   * @param {ErrorDetails} [details] - Optional detailed error information
   * @throws {Error} If error code is not within valid ranges
   */
  constructor(code: number, message: string, details?: ErrorDetails) {
    super(message);
    
    // Validate error code ranges
    if (!this.isValidErrorCode(code)) {
      throw new Error('Invalid error code range');
    }

    this.code = code;
    this.details = details || null;
    this.timestamp = new Date();
    this.name = 'ServiceError';

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ServiceError.prototype);
  }

  /**
   * Validates if the error code is within defined ranges.
   * @private
   * @param {number} code - Error code to validate
   * @returns {boolean} Whether the code is valid
   */
  private isValidErrorCode(code: number): boolean {
    const validRanges = [
      [1000, 1999], // Authentication errors
      [2000, 2999], // Message processing errors
      [3000, 3999], // Contact management errors
      [4000, 4999], // Template operation errors
      [5000, 5999], // Media handling errors
      [6000, 6999], // Integration errors
      [9000, 9999]  // System errors
    ];

    return validRanges.some(([min, max]) => code >= min && code <= max);
  }

  /**
   * Creates a JSON representation of the error.
   * @returns {Record<string, unknown>}
   */
  public toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString()
    };
  }
}

/**
 * Type guard to check if a value is a ServiceError.
 * @param {unknown} value - Value to check
 * @returns {value is ServiceError}
 */
export function isServiceError(value: unknown): value is ServiceError {
  return value instanceof ServiceError;
}

/**
 * Type guard to check if a value is a valid UserRole.
 * @param {unknown} value - Value to check
 * @returns {value is UserRole}
 */
export function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

/**
 * Creates a standardized API response.
 * @template T
 * @param {T} data - Response data
 * @param {ResponseMetadata} metadata - Response metadata
 * @returns {ApiResponse<T>}
 */
export function createApiResponse<T>(
  data: T,
  metadata: ResponseMetadata
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    metadata
  };
}

/**
 * Creates an error API response.
 * @param {ServiceError} error - Service error instance
 * @param {ResponseMetadata} metadata - Response metadata
 * @returns {ApiResponse<null>}
 */
export function createErrorResponse(
  error: ServiceError,
  metadata: ResponseMetadata
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error,
    metadata
  };
}