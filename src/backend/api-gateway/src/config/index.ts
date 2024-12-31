// @package dotenv v16.3.x
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

// Interfaces
interface ServerConfig {
    port: number;
    env: string;
    apiVersion: string;
    cors: {
        origin: string[];
        methods: string[];
        allowedHeaders: string[];
        exposedHeaders: string[];
        credentials: boolean;
        maxAge: number;
    };
    ssl: {
        enabled: boolean;
        key?: string;
        cert?: string;
        ca?: string[];
    };
    logging: {
        level: string;
        format: string;
        directory: string;
    };
}

interface AuthConfig {
    jwtSecret: string;
    jwtExpiry: string;
    jwtRefreshExpiry: string;
    requireHttps: boolean;
    passwordPolicy: {
        minLength: number;
        requireNumbers: boolean;
        requireSpecialChars: boolean;
        requireUppercase: boolean;
        maxAttempts: number;
    };
    mfaSettings: {
        enabled: boolean;
        issuer: string;
        algorithm: string;
    };
    sessionConfig: {
        name: string;
        secret: string;
        rolling: boolean;
        resave: boolean;
        saveUninitialized: boolean;
        cookie: {
            secure: boolean;
            httpOnly: boolean;
            maxAge: number;
            sameSite: boolean | 'lax' | 'strict' | 'none';
        };
    };
}

interface ServiceEndpoints {
    messageService: {
        url: string;
        timeout: number;
        version: string;
    };
    contactService: {
        url: string;
        timeout: number;
        version: string;
    };
    templateService: {
        url: string;
        timeout: number;
        version: string;
    };
    analyticsService: {
        url: string;
        timeout: number;
        version: string;
    };
    healthCheck: {
        interval: number;
        timeout: number;
        threshold: number;
    };
    retryPolicy: {
        attempts: number;
        delay: number;
        backoff: number;
    };
}

interface RateLimitConfig {
    messages: {
        windowMs: number;
        max: number;
    };
    contacts: {
        windowMs: number;
        max: number;
    };
    templates: {
        windowMs: number;
        max: number;
    };
    analytics: {
        windowMs: number;
        max: number;
    };
    burstLimit: {
        enabled: boolean;
        maxBurst: number;
    };
    throttling: {
        enabled: boolean;
        delayAfter: number;
        delayMs: number;
    };
}

interface RedisConfig {
    host: string;
    port: number;
    password: string;
    db: number;
    cluster: {
        enabled: boolean;
        nodes?: string[];
    };
    sentinel: {
        enabled: boolean;
        masterName?: string;
        nodes?: string[];
    };
    retryStrategy: {
        attempts: number;
        delay: number;
    };
    options: {
        enableReadyCheck: boolean;
        maxRetriesPerRequest: number;
        enableOfflineQueue: boolean;
    };
}

interface LoggingConfig {
    level: string;
    format: string;
    directory: string;
    maxSize: string;
    maxFiles: number;
    compress: boolean;
}

// Constants
const DEFAULT_PORT = 3000;
const DEFAULT_API_VERSION = 'v1';
const DEFAULT_JWT_EXPIRY = '1h';
const DEFAULT_REFRESH_EXPIRY = '7d';
const MAX_RATE_LIMIT_WINDOW = 3600;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'REDIS_URL', 'SERVICE_ENDPOINTS'];

// Global environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || DEFAULT_PORT.toString(), 10);
const JWT_SECRET = process.env.JWT_SECRET;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const REDIS_URL = process.env.REDIS_URL;
const SERVICE_ENDPOINTS = process.env.SERVICE_ENDPOINTS;

// Configuration validation function
function validateConfig(config: any): boolean {
    // Check required environment variables
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }

    // Validate JWT configuration
    if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long');
    }

    // Validate service endpoints
    const services = ['messageService', 'contactService', 'templateService', 'analyticsService'];
    for (const service of services) {
        if (!config.services[service].url) {
            throw new Error(`Missing URL for ${service}`);
        }
        const url = new URL(config.services[service].url);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error(`Invalid protocol for ${service}`);
        }
    }

    // Validate rate limits
    const rateLimitEndpoints = ['messages', 'contacts', 'templates', 'analytics'];
    for (const endpoint of rateLimitEndpoints) {
        if (config.rateLimits[endpoint].windowMs > MAX_RATE_LIMIT_WINDOW * 1000) {
            throw new Error(`Rate limit window for ${endpoint} exceeds maximum allowed value`);
        }
    }

    // Validate Redis configuration
    if (config.redis.cluster.enabled && config.redis.sentinel.enabled) {
        throw new Error('Cannot enable both Redis cluster and sentinel modes');
    }

    return true;
}

// Configuration loader function
function loadConfig() {
    const config = {
        server: {
            port: PORT,
            env: NODE_ENV,
            apiVersion: DEFAULT_API_VERSION,
            cors: {
                origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: ['Content-Type', 'Authorization'],
                exposedHeaders: ['X-Total-Count'],
                credentials: true,
                maxAge: 86400,
            },
            ssl: {
                enabled: NODE_ENV === 'production',
                key: process.env.SSL_KEY,
                cert: process.env.SSL_CERT,
                ca: process.env.SSL_CA?.split(','),
            },
            logging: {
                level: LOG_LEVEL,
                format: 'json',
                directory: 'logs',
            },
        } as ServerConfig,

        auth: {
            jwtSecret: JWT_SECRET!,
            jwtExpiry: process.env.JWT_EXPIRY || DEFAULT_JWT_EXPIRY,
            jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || DEFAULT_REFRESH_EXPIRY,
            requireHttps: NODE_ENV === 'production',
            passwordPolicy: {
                minLength: 8,
                requireNumbers: true,
                requireSpecialChars: true,
                requireUppercase: true,
                maxAttempts: 5,
            },
            mfaSettings: {
                enabled: NODE_ENV === 'production',
                issuer: 'WhatsApp Web Enhancement',
                algorithm: 'sha1',
            },
            sessionConfig: {
                name: 'sid',
                secret: JWT_SECRET!,
                rolling: true,
                resave: false,
                saveUninitialized: false,
                cookie: {
                    secure: NODE_ENV === 'production',
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    sameSite: 'lax',
                },
            },
        } as AuthConfig,

        services: {
            messageService: {
                url: process.env.MESSAGE_SERVICE_URL || 'http://message-service:3001',
                timeout: DEFAULT_TIMEOUT,
                version: 'v1',
            },
            contactService: {
                url: process.env.CONTACT_SERVICE_URL || 'http://contact-service:3002',
                timeout: DEFAULT_TIMEOUT,
                version: 'v1',
            },
            templateService: {
                url: process.env.TEMPLATE_SERVICE_URL || 'http://template-service:3003',
                timeout: DEFAULT_TIMEOUT,
                version: 'v1',
            },
            analyticsService: {
                url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004',
                timeout: DEFAULT_TIMEOUT,
                version: 'v1',
            },
            healthCheck: {
                interval: 30000,
                timeout: 5000,
                threshold: 3,
            },
            retryPolicy: {
                attempts: DEFAULT_RETRY_ATTEMPTS,
                delay: 1000,
                backoff: 2,
            },
        } as ServiceEndpoints,

        rateLimits: {
            messages: {
                windowMs: 60000,
                max: 100,
            },
            contacts: {
                windowMs: 60000,
                max: 1000,
            },
            templates: {
                windowMs: 60000,
                max: 50,
            },
            analytics: {
                windowMs: 60000,
                max: 500,
            },
            burstLimit: {
                enabled: true,
                maxBurst: 50,
            },
            throttling: {
                enabled: true,
                delayAfter: 100,
                delayMs: 100,
            },
        } as RateLimitConfig,

        redis: {
            host: new URL(REDIS_URL!).hostname,
            port: parseInt(new URL(REDIS_URL!).port, 10) || 6379,
            password: new URL(REDIS_URL!).password,
            db: 0,
            cluster: {
                enabled: false,
            },
            sentinel: {
                enabled: false,
            },
            retryStrategy: {
                attempts: 10,
                delay: 3000,
            },
            options: {
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                enableOfflineQueue: true,
            },
        } as RedisConfig,

        logging: {
            level: LOG_LEVEL,
            format: 'json',
            directory: 'logs',
            maxSize: '10m',
            maxFiles: 5,
            compress: true,
        } as LoggingConfig,
    };

    // Validate the configuration
    validateConfig(config);

    // Return immutable configuration object
    return Object.freeze(config);
}

// Export the configuration
export const config = loadConfig();

// Export interfaces for type checking
export type {
    ServerConfig,
    AuthConfig,
    ServiceEndpoints,
    RateLimitConfig,
    RedisConfig,
    LoggingConfig,
};