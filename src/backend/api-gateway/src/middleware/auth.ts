// @ts-check

// External imports
import { Request, Response, NextFunction } from 'express'; // v4.18.x
import rateLimit from 'express-rate-limit'; // v7.1.x
import helmet from 'helmet'; // v7.1.x

// Internal imports
import { AuthService } from '../services/auth';
import { 
  UserRole, 
  AuthenticatedRequest, 
  ServiceError, 
  UserPayload,
  RoleHierarchy 
} from '../types';
import { config } from '../config';

// Constants
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer ';

const AUTH_ERRORS = {
  MISSING_TOKEN: 'No authorization token provided',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Unauthorized access',
  TOKEN_BLACKLISTED: 'Token has been revoked',
  RATE_LIMIT_EXCEEDED: 'Too many authentication attempts',
  INVALID_ROLE: 'Insufficient permissions for this operation'
} as const;

const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later'
};

// Initialize AuthService
const authService = new AuthService();

/**
 * Role hierarchy definition for permission inheritance
 */
const roleHierarchy: Record<UserRole, UserRole[]> = {
  [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER],
  [UserRole.MANAGER]: [UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER],
  [UserRole.AGENT]: [UserRole.AGENT, UserRole.VIEWER],
  [UserRole.VIEWER]: [UserRole.VIEWER]
};

/**
 * Apply security headers using helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

/**
 * Rate limiting middleware for authentication attempts
 */
export const authRateLimit = rateLimit({
  ...RATE_LIMIT_CONFIG,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * Authentication middleware with comprehensive security checks
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.header(TOKEN_HEADER);
    if (!authHeader?.startsWith(TOKEN_PREFIX)) {
      throw new ServiceError(1001, AUTH_ERRORS.MISSING_TOKEN);
    }

    const token = authHeader.slice(TOKEN_PREFIX.length);

    // Validate token and check blacklist
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new ServiceError(1002, AUTH_ERRORS.TOKEN_BLACKLISTED);
    }

    // Verify and decode token
    const decodedToken = await authService.validateToken(token);

    // Enrich request with user context
    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.user = decodedToken;

    // Add permission checker to request
    authenticatedReq.hasPermission = (permission: string): boolean => {
      return decodedToken.permissions?.includes(permission) ?? false;
    };

    // Audit logging
    const { id, email, role, orgId } = decodedToken;
    console.info('Authentication successful', {
      userId: id,
      email,
      role,
      orgId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      path: req.path
    });

    next();
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(401).json({
        success: false,
        error: error.toJSON(),
        metadata: {
          timestamp: Date.now(),
          path: req.path
        }
      });
    } else {
      const serviceError = new ServiceError(
        1003,
        AUTH_ERRORS.INVALID_TOKEN,
        {
          field: 'token',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
      res.status(401).json({
        success: false,
        error: serviceError.toJSON(),
        metadata: {
          timestamp: Date.now(),
          path: req.path
        }
      });
    }
  }
};

/**
 * Role-based authorization middleware factory
 * @param {UserRole[]} allowedRoles - Array of roles allowed to access the resource
 * @returns {Function} Express middleware for role authorization
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      
      if (!authenticatedReq.user) {
        throw new ServiceError(1004, AUTH_ERRORS.UNAUTHORIZED);
      }

      const userRole = authenticatedReq.user.role;
      
      // Check if user's role has sufficient permissions
      const hasPermission = allowedRoles.some(role => 
        roleHierarchy[userRole].includes(role)
      );

      if (!hasPermission) {
        throw new ServiceError(1005, AUTH_ERRORS.INVALID_ROLE);
      }

      // Audit logging for authorization
      console.info('Authorization successful', {
        userId: authenticatedReq.user.id,
        role: userRole,
        allowedRoles,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      next();
    } catch (error) {
      const statusCode = error instanceof ServiceError ? 403 : 500;
      const serviceError = error instanceof ServiceError ? error : new ServiceError(
        1006,
        AUTH_ERRORS.UNAUTHORIZED,
        {
          field: 'authorization',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );

      res.status(statusCode).json({
        success: false,
        error: serviceError.toJSON(),
        metadata: {
          timestamp: Date.now(),
          path: req.path
        }
      });
    }
  };
};

export default {
  authenticate,
  authorize,
  securityHeaders,
  authRateLimit
};
```

This implementation provides a comprehensive authentication and authorization middleware with the following key features:

1. JWT Token Validation:
- Extracts and validates Bearer tokens
- Checks token blacklist
- Validates token signature and expiration
- Enriches requests with user context

2. Role-Based Access Control:
- Implements role hierarchy for permission inheritance
- Provides flexible authorization middleware
- Supports granular permission checks

3. Security Measures:
- Implements rate limiting for authentication attempts
- Applies security headers using helmet
- Provides comprehensive error handling
- Includes audit logging

4. Additional Features:
- Type safety with TypeScript
- Comprehensive error handling with custom ServiceError class
- Detailed audit logging for security events
- Request enrichment with user context and permission checking

The code follows enterprise-grade practices with:
- Comprehensive error handling and logging
- Security best practices implementation
- Clean and maintainable code structure
- Detailed comments and documentation
- Type safety and validation

Usage examples:

```typescript
// Protect route with authentication
app.get('/api/protected', authenticate, (req, res) => {
  // Route handler
});

// Protect route with authentication and role-based authorization
app.post('/api/admin', 
  authenticate, 
  authorize([UserRole.ADMIN]), 
  (req, res) => {
    // Admin-only route handler
  }
);

// Apply security headers globally
app.use(securityHeaders);

// Apply rate limiting to authentication endpoints
app.use('/api/auth', authRateLimit);