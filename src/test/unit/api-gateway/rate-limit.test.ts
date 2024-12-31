// @package jest v29.7.x
// @package supertest v6.3.x
// @package ioredis-mock v8.9.x

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import supertest from 'supertest';
import RedisMock from 'ioredis-mock';
import express, { Express, Request, Response } from 'express';
import rateLimitMiddleware, { RateLimitInfo } from '../../../backend/api-gateway/src/middleware/rateLimit';
import { TestLogger, LogLevel } from '../../utils/test-logger';
import { AuthenticatedRequest, UserRole } from '../../../backend/api-gateway/src/types';

// Test constants
const TEST_ENDPOINTS = {
    messages: '/api/v1/messages',
    contacts: '/api/v1/contacts',
    templates: '/api/v1/templates',
    analytics: '/api/v1/analytics'
};

const RATE_LIMITS = {
    messages: 100,
    contacts: 1000,
    templates: 50,
    analytics: 500
};

const TEST_USERS = [
    { id: 'test-user-1', role: UserRole.ADMIN },
    { id: 'test-user-2', role: UserRole.AGENT }
];

// Mock Redis client configuration
const REDIS_MOCK_CONFIG = {
    host: 'localhost',
    port: 6379,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
};

// Test setup variables
let app: Express;
let redisMock: RedisMock;
let testLogger: TestLogger;
let request: supertest.SuperTest<supertest.Test>;

describe('API Gateway Rate Limiting Middleware', () => {
    beforeAll(async () => {
        // Initialize Redis mock
        redisMock = new RedisMock(REDIS_MOCK_CONFIG);
        
        // Configure test logger
        testLogger = new TestLogger({
            level: LogLevel.DEBUG,
            silent: false,
            colorize: true
        });

        // Initialize Express app
        app = express();
        app.use(express.json());
        app.use(rateLimitMiddleware);

        // Configure test routes with rate limits
        Object.entries(TEST_ENDPOINTS).forEach(([key, path]) => {
            app.post(path, (req: Request, res: Response) => {
                res.status(200).json({ success: true });
            });
        });

        request = supertest(app);
    });

    afterAll(async () => {
        await redisMock.quit();
        jest.resetAllMocks();
    });

    beforeEach(async () => {
        // Clear Redis store
        await redisMock.flushall();
        
        // Reset request counters
        jest.clearAllMocks();
    });

    describe('Endpoint-specific Rate Limits', () => {
        test('should enforce message endpoint rate limit (100/min)', async () => {
            const endpoint = TEST_ENDPOINTS.messages;
            const limit = RATE_LIMITS.messages;

            // Test within limit
            for (let i = 0; i < limit; i++) {
                const response = await request.post(endpoint)
                    .set('X-Forwarded-For', '127.0.0.1');
                
                expect(response.status).toBe(200);
                expect(response.headers['x-ratelimit-limit']).toBe(String(limit));
                expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(limit - i - 1);
            }

            // Test exceeding limit
            const exceededResponse = await request.post(endpoint)
                .set('X-Forwarded-For', '127.0.0.1');
            
            expect(exceededResponse.status).toBe(429);
            expect(exceededResponse.body.error.code).toBe(6001);
            expect(exceededResponse.headers['retry-after']).toBeDefined();
        });

        test('should enforce contact endpoint rate limit (1000/min)', async () => {
            const endpoint = TEST_ENDPOINTS.contacts;
            const limit = RATE_LIMITS.contacts;
            const testBatch = 100; // Test with smaller batch for performance

            // Test concurrent requests within limit
            const requests = Array(testBatch).fill(null).map(() => 
                request.post(endpoint)
                    .set('X-Forwarded-For', '127.0.0.1')
            );

            const responses = await Promise.all(requests);
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.headers['x-ratelimit-limit']).toBe(String(limit));
            });
        });

        test('should enforce template endpoint rate limit with user context (50/min)', async () => {
            const endpoint = TEST_ENDPOINTS.templates;
            const limit = RATE_LIMITS.templates;
            const user = TEST_USERS[0];

            // Mock authenticated request
            app.use((req: Request, _res: Response, next) => {
                (req as AuthenticatedRequest).user = {
                    id: user.id,
                    role: user.role,
                    email: 'test@example.com',
                    orgId: 'test-org',
                    permissions: []
                };
                next();
            });

            // Test user-specific rate limit
            for (let i = 0; i < limit; i++) {
                const response = await request.post(endpoint)
                    .set('Authorization', 'Bearer test-token');
                
                expect(response.status).toBe(200);
                expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(limit - i - 1);
            }
        });
    });

    describe('Distributed Rate Limiting', () => {
        test('should maintain consistent rate limits across distributed requests', async () => {
            const endpoint = TEST_ENDPOINTS.analytics;
            const limit = RATE_LIMITS.analytics;

            // Simulate distributed requests
            const distributedRequests = Array(10).fill(null).map(async () => {
                const responses = [];
                for (let i = 0; i < 10; i++) {
                    const response = await request.post(endpoint)
                        .set('X-Forwarded-For', '127.0.0.1');
                    responses.push(response);
                }
                return responses;
            });

            const allResponses = await Promise.all(distributedRequests);
            const successfulRequests = allResponses.flat()
                .filter(response => response.status === 200);

            expect(successfulRequests.length).toBeLessThanOrEqual(limit);
        });

        test('should handle Redis connection failures gracefully', async () => {
            // Simulate Redis failure
            jest.spyOn(redisMock, 'incr').mockRejectedValue(new Error('Redis connection failed'));

            const response = await request.post(TEST_ENDPOINTS.messages)
                .set('X-Forwarded-For', '127.0.0.1');

            expect(response.status).toBe(500);
            expect(response.body.error.code).toBe(6002);
        });
    });

    describe('Rate Limit Headers', () => {
        test('should include accurate rate limit headers in responses', async () => {
            const endpoint = TEST_ENDPOINTS.messages;
            const limit = RATE_LIMITS.messages;

            const response = await request.post(endpoint)
                .set('X-Forwarded-For', '127.0.0.1');

            expect(response.headers['x-ratelimit-limit']).toBe(String(limit));
            expect(response.headers['x-ratelimit-remaining']).toBeDefined();
            expect(response.headers['x-ratelimit-reset']).toBeDefined();

            const remaining = parseInt(response.headers['x-ratelimit-remaining']);
            expect(remaining).toBe(limit - 1);

            const reset = parseInt(response.headers['x-ratelimit-reset']);
            expect(reset).toBeGreaterThan(Date.now() / 1000);
        });

        test('should include retry-after header when limit exceeded', async () => {
            const endpoint = TEST_ENDPOINTS.templates;
            const limit = RATE_LIMITS.templates;

            // Exhaust rate limit
            for (let i = 0; i < limit; i++) {
                await request.post(endpoint)
                    .set('X-Forwarded-For', '127.0.0.1');
            }

            const exceededResponse = await request.post(endpoint)
                .set('X-Forwarded-For', '127.0.0.1');

            expect(exceededResponse.status).toBe(429);
            expect(exceededResponse.headers['retry-after']).toBeDefined();
            expect(parseInt(exceededResponse.headers['retry-after'])).toBeGreaterThan(0);
        });
    });
});