// @ts-check

// External imports
import { sign, verify, JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken'; // v9.0.x
import { hash, compare, genSalt } from 'bcryptjs'; // v2.4.x
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'; // native

// Internal imports
import { UserRole, UserPayload, ServiceError, TokenValidationError } from '../types';
import { config } from '../config';

/**
 * Enumeration of token validation error messages
 */
const TOKEN_ERRORS = {
  INVALID_TOKEN: 'Invalid token format or structure',
  EXPIRED_TOKEN: 'Token has expired',
  INVALID_SIGNATURE: 'Invalid token signature',
  MISSING_PAYLOAD: 'Token payload is missing required fields',
  INVALID_ROLE: 'Invalid or insufficient role permissions',
  BLACKLISTED_TOKEN: 'Token has been revoked',
  INVALID_ISSUER: 'Invalid token issuer',
  INVALID_AUDIENCE: 'Invalid token audience'
} as const;

/**
 * Default salt rounds for password hashing
 */
const SALT_ROUNDS = 12;

/**
 * Default token signing options
 */
const TOKEN_OPTIONS: SignOptions = {
  algorithm: 'HS256',
  expiresIn: config.auth.jwtExpiry,
  issuer: 'whatsapp-web-enhancement',
  audience: 'api-gateway'
};

/**
 * Enhanced authentication service with comprehensive security features
 */
export class AuthService {
  private readonly jwtSecret: Buffer;
  private readonly jwtExpiry: string;
  private readonly blacklistedTokens: Set<string>;
  private readonly encryptionKey: Buffer;

  /**
   * Initializes the AuthService with enhanced security configurations
   * @throws {Error} If required configurations are missing or invalid
   */
  constructor() {
    // Validate and load JWT secret
    if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
      throw new Error('Invalid JWT secret configuration');
    }
    this.jwtSecret = Buffer.from(config.auth.jwtSecret, 'utf-8');
    
    // Set JWT expiry
    this.jwtExpiry = config.auth.jwtExpiry;
    
    // Initialize token blacklist
    this.blacklistedTokens = new Set<string>();
    
    // Generate encryption key for sensitive data
    this.encryptionKey = randomBytes(32);
    
    // Setup token cleanup interval (every hour)
    setInterval(() => this.cleanupBlacklistedTokens(), 3600000);
  }

  /**
   * Generates a secure JWT token with enhanced payload validation
   * @param {UserPayload} payload - User information for token payload
   * @param {SignOptions} [options] - Optional token signing options
   * @returns {Promise<string>} Generated JWT token
   * @throws {ServiceError} If payload validation fails
   */
  public async generateToken(
    payload: UserPayload,
    options?: SignOptions
  ): Promise<string> {
    try {
      // Validate payload completeness
      this.validatePayload(payload);

      // Merge default options with provided options
      const signOptions: SignOptions = {
        ...TOKEN_OPTIONS,
        ...options
      };

      // Generate token with additional security claims
      const token = sign(
        {
          ...payload,
          iat: Math.floor(Date.now() / 1000),
          jti: randomBytes(16).toString('hex')
        },
        this.jwtSecret,
        signOptions
      );

      return token;
    } catch (error) {
      throw new ServiceError(
        1001,
        'Token generation failed',
        {
          field: 'token',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
    }
  }

  /**
   * Validates JWT token with comprehensive security checks
   * @param {string} token - JWT token to validate
   * @param {VerifyOptions} [options] - Optional token verification options
   * @returns {Promise<UserPayload>} Validated and decoded user payload
   * @throws {ServiceError} If token validation fails
   */
  public async validateToken(
    token: string,
    options?: VerifyOptions
  ): Promise<UserPayload> {
    try {
      // Check token blacklist
      if (this.blacklistedTokens.has(token)) {
        throw new TokenValidationError(TOKEN_ERRORS.BLACKLISTED_TOKEN);
      }

      // Verify token with default and custom options
      const decoded = verify(token, this.jwtSecret, {
        ...TOKEN_OPTIONS,
        ...options
      }) as UserPayload;

      // Validate payload structure
      this.validatePayload(decoded);

      return decoded;
    } catch (error) {
      if (error instanceof TokenValidationError) {
        throw new ServiceError(1002, error.message);
      }
      throw new ServiceError(
        1003,
        'Token validation failed',
        {
          field: 'token',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
    }
  }

  /**
   * Securely hashes passwords with salt
   * @param {string} password - Password to hash
   * @returns {Promise<string>} Securely hashed password
   * @throws {ServiceError} If password hashing fails
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      // Validate password against policy
      this.validatePassword(password);

      // Generate salt and hash password
      const salt = await genSalt(SALT_ROUNDS);
      return await hash(password, salt);
    } catch (error) {
      throw new ServiceError(
        1004,
        'Password hashing failed',
        {
          field: 'password',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
    }
  }

  /**
   * Securely verifies password against hash
   * @param {string} password - Password to verify
   * @param {string} hash - Hash to verify against
   * @returns {Promise<boolean>} Password verification result
   * @throws {ServiceError} If password verification fails
   */
  public async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    try {
      return await compare(password, hash);
    } catch (error) {
      throw new ServiceError(
        1005,
        'Password verification failed',
        {
          field: 'password',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
    }
  }

  /**
   * Adds token to blacklist for revocation
   * @param {string} token - Token to revoke
   * @returns {Promise<void>}
   * @throws {ServiceError} If token revocation fails
   */
  public async revokeToken(token: string): Promise<void> {
    try {
      // Verify token is valid before blacklisting
      const decoded = await this.validateToken(token);
      
      // Add to blacklist
      this.blacklistedTokens.add(token);
      
      // Store expiration time for cleanup
      const exp = decoded.exp || 0;
      setTimeout(() => {
        this.blacklistedTokens.delete(token);
      }, (exp * 1000) - Date.now());
    } catch (error) {
      throw new ServiceError(
        1006,
        'Token revocation failed',
        {
          field: 'token',
          reason: error instanceof Error ? error.message : 'Unknown error',
          value: undefined,
          context: { timestamp: new Date().toISOString() }
        }
      );
    }
  }

  /**
   * Validates user payload completeness
   * @private
   * @param {UserPayload} payload - Payload to validate
   * @throws {TokenValidationError} If payload is invalid
   */
  private validatePayload(payload: UserPayload): void {
    if (!payload.id || !payload.email || !payload.role || !payload.orgId) {
      throw new TokenValidationError(TOKEN_ERRORS.MISSING_PAYLOAD);
    }
    
    if (!Object.values(UserRole).includes(payload.role)) {
      throw new TokenValidationError(TOKEN_ERRORS.INVALID_ROLE);
    }
  }

  /**
   * Validates password against security policy
   * @private
   * @param {string} password - Password to validate
   * @throws {Error} If password doesn't meet security requirements
   */
  private validatePassword(password: string): void {
    const { passwordPolicy } = config.auth;
    
    if (password.length < passwordPolicy.minLength) {
      throw new Error(`Password must be at least ${passwordPolicy.minLength} characters long`);
    }
    
    if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
    
    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
  }

  /**
   * Cleans up expired tokens from blacklist
   * @private
   */
  private cleanupBlacklistedTokens(): void {
    for (const token of this.blacklistedTokens) {
      try {
        verify(token, this.jwtSecret);
      } catch (error) {
        // Remove expired tokens
        this.blacklistedTokens.delete(token);
      }
    }
  }
}