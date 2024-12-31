// External imports - v29.x
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express'; // v4.18.x
import { MockRequest, MockResponse } from 'jest-mock-express'; // v0.2.x

// Internal imports
import { authenticate, authorize } from '../../../backend/api-gateway/src/middleware/auth';
import { AuthService } from '../../../backend/api-gateway/src/services/auth';
import { 
  UserRole, 
  UserPayload, 
  ServiceError, 
  AuthenticatedRequest 
} from '../../../backend/api-gateway/src/types';

// Constants for testing
const MOCK_USER_PAYLOAD: UserPayload = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: UserRole.ADMIN,
  orgId: 'test-org-id',
  permissions: ['READ', 'WRITE', 'ADMIN'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  iss: 'whatsapp-web-enhancement',
  aud: 'api-gateway'
};

const MOCK_TOKENS = {
  VALID: 'valid.jwt.token',
  EXPIRED: 'expired.jwt.token',
  BLACKLISTED: 'blacklisted.jwt.token',
  INVALID_SIGNATURE: 'invalid.signature.token',
  MALFORMED: 'malformed.token'
};

const SECURITY_HEADERS = {
  'X-Request-ID': 'test-request-id',
  'X-Real-IP': '127.0.0.1',
  'User-Agent': 'jest-test'
};

// Mock AuthService
jest.mock('../../../backend/api-gateway/src/services/auth');

// Helper Functions
const setupMockRequest = (options: {
  token?: string;
  user?: UserPayload;
  headers?: Record<string, string>;
  rateLimit?: { remaining: number; reset: number };
} = {}): Request => {
  const req = new MockRequest() as Request;
  
  if (options.token) {
    req.headers.authorization = `Bearer ${options.token}`;
  }
  
  if (options.user) {
    (req as AuthenticatedRequest).user = options.user;
  }
  
  if (options.headers) {
    req.headers = { ...req.headers, ...options.headers };
  }
  
  if (options.rateLimit) {
    req.rateLimit = options.rateLimit;
  }
  
  return req;
};

const setupMockResponse = (): Response => {
  const res = new MockResponse() as Response;
  jest.spyOn(res, 'status');
  jest.spyOn(res, 'json');
  return res;
};

describe('Authentication Middleware', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockNext = jest.fn();
    
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should successfully authenticate with valid token', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.VALID,
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      
      mockAuthService.validateToken.mockResolvedValueOnce(MOCK_USER_PAYLOAD);
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(false);

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(MOCK_TOKENS.VALID);
      expect(mockNext).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user).toEqual(MOCK_USER_PAYLOAD);
      expect((req as AuthenticatedRequest).hasPermission).toBeDefined();
    });

    it('should reject request when no token provided', async () => {
      // Arrange
      const req = setupMockRequest({ headers: SECURITY_HEADERS });
      const res = setupMockResponse();

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 1001,
          message: 'No authorization token provided'
        })
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.BLACKLISTED,
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(true);

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 1002,
          message: 'Token has been revoked'
        })
      }));
    });

    it('should handle expired tokens correctly', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.EXPIRED,
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      
      mockAuthService.validateToken.mockRejectedValueOnce(
        new ServiceError(1003, 'Token has expired')
      );

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 1003,
          message: 'Token has expired'
        })
      }));
    });

    it('should validate security headers', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.VALID,
        headers: {
          ...SECURITY_HEADERS,
          'X-XSS-Protection': '1; mode=block'
        }
      });
      const res = setupMockResponse();
      
      mockAuthService.validateToken.mockResolvedValueOnce(MOCK_USER_PAYLOAD);
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(false);

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('authorize middleware', () => {
    it('should allow access with correct role', async () => {
      // Arrange
      const req = setupMockRequest({ 
        user: MOCK_USER_PAYLOAD,
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      const authorizeMiddleware = authorize([UserRole.ADMIN]);

      // Act
      authorizeMiddleware(req, res, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access with inherited role permissions', async () => {
      // Arrange
      const req = setupMockRequest({ 
        user: { ...MOCK_USER_PAYLOAD, role: UserRole.ADMIN },
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      const authorizeMiddleware = authorize([UserRole.MANAGER]);

      // Act
      authorizeMiddleware(req, res, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access with insufficient role', async () => {
      // Arrange
      const req = setupMockRequest({ 
        user: { ...MOCK_USER_PAYLOAD, role: UserRole.VIEWER },
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      const authorizeMiddleware = authorize([UserRole.ADMIN]);

      // Act
      authorizeMiddleware(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 1005,
          message: 'Insufficient permissions for this operation'
        })
      }));
    });

    it('should handle missing user context', async () => {
      // Arrange
      const req = setupMockRequest({ headers: SECURITY_HEADERS });
      const res = setupMockResponse();
      const authorizeMiddleware = authorize([UserRole.ADMIN]);

      // Act
      authorizeMiddleware(req, res, mockNext);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 1004,
          message: 'Unauthorized access'
        })
      }));
    });
  });

  describe('permission checking', () => {
    it('should correctly validate specific permissions', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.VALID,
        headers: SECURITY_HEADERS
      });
      const res = setupMockResponse();
      
      mockAuthService.validateToken.mockResolvedValueOnce(MOCK_USER_PAYLOAD);
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(false);

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect((req as AuthenticatedRequest).hasPermission('READ')).toBe(true);
      expect((req as AuthenticatedRequest).hasPermission('INVALID')).toBe(false);
    });
  });

  describe('security headers', () => {
    it('should validate required security headers', async () => {
      // Arrange
      const req = setupMockRequest({ 
        token: MOCK_TOKENS.VALID,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Security-Policy': "default-src 'self'"
        }
      });
      const res = setupMockResponse();
      
      mockAuthService.validateToken.mockResolvedValueOnce(MOCK_USER_PAYLOAD);
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(false);

      // Act
      await authenticate(req, res, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(req.headers['content-security-policy']).toBe("default-src 'self'");
    });
  });
});