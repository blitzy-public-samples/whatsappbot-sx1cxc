// External dependencies
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.x
import { Request, Response } from 'express'; // v4.18.x
import { Schema } from 'joi'; // v17.9.x

// Internal dependencies
import { validateSchema } from '../../../backend/api-gateway/src/middleware/validation';
import { ServiceError } from '../../../backend/api-gateway/src/types';

// Constants for testing
const VALIDATION_ERROR_CODE = 4000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_DEPTH = 5;
const MAX_STRING_LENGTH = 1000;

/**
 * Creates a mock Express request object with configurable body and headers
 */
function createMockRequest(body: any = {}, headers: any = {}): Partial<Request> {
  return {
    body,
    headers,
    query: {},
    params: {},
    path: '/test',
    method: 'POST'
  };
}

/**
 * Creates a mock Express response object with spy methods
 */
function createMockResponse(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headers: {}
  };
}

describe('validateSchema Middleware', () => {
  let mockNext: jest.Mock;
  let mockSchema: Schema;

  beforeEach(() => {
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Basic Schema Validation', () => {
    it('should validate valid request body', async () => {
      // Arrange
      const validBody = {
        name: 'Test User',
        email: 'test@example.com',
        age: 25
      };
      const req = createMockRequest(validBody);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid request body with proper error', async () => {
      // Arrange
      const invalidBody = {
        name: '',
        email: 'invalid-email',
        age: -1
      };
      const req = createMockRequest(invalidBody);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext.mock.calls[0][0]).toBeInstanceOf(ServiceError);
      expect(mockNext.mock.calls[0][0].code).toBe(VALIDATION_ERROR_CODE);
    });
  });

  describe('Schema Caching', () => {
    it('should cache and reuse schema validation', async () => {
      // Arrange
      const validBody = { name: 'Test User' };
      const req = createMockRequest(validBody);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML content from strings', async () => {
      // Arrange
      const unsafeBody = {
        name: '<script>alert("xss")</script>Test User',
        description: '<p>Hello</p>'
      };
      const req = createMockRequest(unsafeBody);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(req.body.name).toBe('Test User');
      expect(req.body.description).toBe('Hello');
    });

    it('should handle nested object sanitization', async () => {
      // Arrange
      const nestedBody = {
        user: {
          name: '<b>Test</b>',
          profile: {
            bio: '<script>alert("nested")</script>Bio'
          }
        }
      };
      const req = createMockRequest(nestedBody);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(req.body.user.name).toBe('Test');
      expect(req.body.user.profile.bio).toBe('Bio');
    });
  });

  describe('Size and Depth Limits', () => {
    it('should enforce array length limits', async () => {
      // Arrange
      const longArray = Array(MAX_ARRAY_LENGTH + 1).fill('item');
      const req = createMockRequest({ items: longArray });
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ServiceError));
      expect(mockNext.mock.calls[0][0].code).toBe(4003);
    });

    it('should enforce object depth limits', async () => {
      // Arrange
      let deepObject: any = { value: 'test' };
      for (let i = 0; i < MAX_OBJECT_DEPTH + 1; i++) {
        deepObject = { nested: deepObject };
      }
      const req = createMockRequest(deepObject);
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ServiceError));
      expect(mockNext.mock.calls[0][0].code).toBe(4003);
    });

    it('should enforce string length limits', async () => {
      // Arrange
      const longString = 'a'.repeat(MAX_STRING_LENGTH + 1);
      const req = createMockRequest({ text: longString });
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ServiceError));
      expect(mockNext.mock.calls[0][0].code).toBe(4003);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected validation errors gracefully', async () => {
      // Arrange
      const req = createMockRequest({});
      const res = createMockResponse();
      mockSchema.validateAsync = jest.fn().mockRejectedValue(new Error('Unexpected error'));
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(ServiceError));
      expect(mockNext.mock.calls[0][0].code).toBe(4002);
    });

    it('should preserve error context in validation errors', async () => {
      // Arrange
      const req = createMockRequest({ field: 'invalid' });
      const res = createMockResponse();
      const middleware = validateSchema(mockSchema);

      // Act
      await middleware(req as Request, res as Response, mockNext);

      // Assert
      const error = mockNext.mock.calls[0][0] as ServiceError;
      expect(error.details).toHaveProperty('field');
      expect(error.details).toHaveProperty('reason');
      expect(error.details).toHaveProperty('context');
    });
  });
});