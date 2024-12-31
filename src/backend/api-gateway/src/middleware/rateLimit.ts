// @package express v4.18.x
// @package ioredis v5.3.x
// @package express-rate-limit v7.1.x
// @package rate-limit-redis v4.0.x

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { rateLimits, redis as redisConfig } from './config';
import { AuthenticatedRequest } from '../types';

// Constants for rate limiting
const RATE_LIMIT_HEADER_PREFIX = 'X-RateLimit';
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const BURST_MULTIPLIER = 1.5;

// Error codes for rate limiting
const ERROR_CODES = {
    RATE_LIMIT_EXCEEDED: 6001,
    REDIS_ERROR: 6002,
    INVALID_CONFIGURATION: 6003
} as const;

// Interface for enhanced rate limit options
interface RateLimitOptions {
    windowMs: number;
    max: number;
    burstLimit?: number;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: Request) => string;
    handler?: (req: Request, res: Response) => void;
}

// Interface for rate limit information
interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
}

// Initialize Redis client for rate limiting
const redisClient = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    retryStrategy: (times) => {
        if (times <= redisConfig.retryStrategy.attempts) {
            return redisConfig.retryStrategy.delay;
        }
        return null;
    },
    enableReadyCheck: redisConfig.options.enableReadyCheck,
    maxRetriesPerRequest: redisConfig.options.maxRetriesPerRequest
});

/**
 * Creates a configured rate limiter instance for specific endpoints
 * @param endpoint - The endpoint to configure rate limiting for
 * @param options - Custom rate limit options
 */
const createRateLimiter = (endpoint: string, options?: Partial<RateLimitOptions>) => {
    const config = rateLimits[endpoint] || {
        windowMs: DEFAULT_WINDOW_MS,
        max: DEFAULT_MAX_REQUESTS
    };

    const store = new RedisStore({
        prefix: `ratelimit:${endpoint}:`,
        // Explicitly type the sendCommand parameter as any due to type mismatch
        sendCommand: (...args: any[]) => redisClient.call(...args),
        resetExpiryOnChange: true
    });

    const limiterOptions: RateLimitOptions = {
        windowMs: config.windowMs,
        max: config.max,
        burstLimit: rateLimits.burstLimit.enabled ? 
            Math.floor(config.max * BURST_MULTIPLIER) : undefined,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
        keyGenerator: (req: Request): string => {
            const user = (req as AuthenticatedRequest).user;
            return user ? `${endpoint}:${user.id}` : `${endpoint}:${req.ip}`;
        },
        handler: (req: Request, res: Response) => {
            const retryAfter = Math.ceil(config.windowMs / 1000);
            res.status(429).json({
                success: false,
                error: {
                    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
                    message: 'Rate limit exceeded',
                    details: {
                        retryAfter,
                        endpoint
                    }
                }
            });
        },
        ...options
    };

    return rateLimit({
        ...limiterOptions,
        store
    });
};

/**
 * Main rate limiting middleware with enhanced features
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
const rateLimitMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Extract endpoint from request path
        const endpoint = req.path.split('/')[2]; // Assumes format /api/v1/{endpoint}/...
        
        if (!rateLimits[endpoint]) {
            return next();
        }

        const limiter = createRateLimiter(endpoint);
        
        // Apply rate limiting
        await new Promise<void>((resolve, reject) => {
            limiter(req, res, (err?: Error) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Add rate limit headers
        const info: RateLimitInfo = res.locals.rateLimit;
        if (info) {
            res.setHeader(`${RATE_LIMIT_HEADER_PREFIX}-Limit`, info.limit);
            res.setHeader(`${RATE_LIMIT_HEADER_PREFIX}-Remaining`, info.remaining);
            res.setHeader(`${RATE_LIMIT_HEADER_PREFIX}-Reset`, info.reset);
            
            if (info.retryAfter) {
                res.setHeader('Retry-After', info.retryAfter);
            }
        }

        // Log rate limit event for monitoring
        const user = (req as AuthenticatedRequest).user;
        const logData = {
            timestamp: new Date().toISOString(),
            endpoint,
            userId: user?.id || 'anonymous',
            ip: req.ip,
            remaining: info?.remaining,
            limit: info?.limit
        };
        
        // Asynchronously log to Redis for monitoring
        redisClient.xadd(
            'ratelimit:logs',
            '*',
            'data',
            JSON.stringify(logData)
        ).catch(console.error);

        next();
    } catch (error) {
        console.error('Rate limit error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: ERROR_CODES.REDIS_ERROR,
                message: 'Rate limiting system error',
                details: {
                    context: 'rate_limit_middleware'
                }
            }
        });
    }
};

export default rateLimitMiddleware;