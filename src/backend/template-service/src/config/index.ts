/**
 * @fileoverview Configuration module for the template service with enhanced security,
 * monitoring, and performance features. Provides comprehensive environment management
 * and validation for production deployments.
 * @version 1.0.0
 */

// External imports
import { z } from 'zod'; // v3.22.0
import * as dotenv from 'dotenv'; // v16.3.1

// Internal imports
import { Template, TemplateVariable, VariableType } from '../types';

// Load environment variables with enhanced error handling
const envResult = dotenv.config();
if (envResult.error) {
    throw new Error(`Environment configuration error: ${envResult.error.message}`);
}

// Global environment constants
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_TEST = process.env.NODE_ENV === 'test';
export const CONFIG_VERSION = process.env.CONFIG_VERSION || '1.0';

/**
 * Comprehensive Zod schema for configuration validation with security rules
 */
export const ConfigSchema = {
    server: z.object({
        port: z.number().int().min(1024).max(65535),
        host: z.string().min(1),
        nodeEnv: z.enum(['development', 'staging', 'production']),
        logLevel: z.enum(['debug', 'info', 'warn', 'error']),
        corsOrigins: z.array(z.string().url()),
        rateLimits: z.record(z.number().positive()),
        timeouts: z.record(z.number().positive())
    }),

    database: z.object({
        host: z.string().min(1),
        port: z.number().int().min(1024).max(65535),
        name: z.string().min(1),
        user: z.string().min(1),
        password: z.string().min(8),
        sslMode: z.string(),
        poolSize: z.number().int().positive(),
        maxOverflow: z.number().int().nonnegative(),
        connectionTimeout: z.number().positive(),
        idleTimeout: z.number().positive(),
        maxLifetime: z.number().positive()
    }),

    redis: z.object({
        host: z.string().min(1),
        port: z.number().int().min(1024).max(65535),
        password: z.string().min(8),
        db: z.number().int().nonnegative(),
        ttl: z.number().positive(),
        queueName: z.string().min(1),
        maxRetries: z.number().int().positive(),
        retryDelay: z.number().positive(),
        cluster: z.boolean(),
        sentinels: z.array(z.object({
            host: z.string().min(1),
            port: z.number().int().min(1024).max(65535)
        }))
    }),

    template: z.object({
        maxSize: z.number().int().positive(),
        maxVariables: z.number().int().positive(),
        allowedTypes: z.array(z.nativeEnum(VariableType)),
        cacheEnabled: z.boolean(),
        cacheTTL: z.number().positive(),
        validationRules: z.record(z.unknown()),
        sanitizationRules: z.record(z.unknown()),
        versionControl: z.boolean()
    }),

    security: z.object({
        encryption: z.object({
            algorithm: z.string().min(1),
            keySize: z.number().int().positive(),
            ivSize: z.number().int().positive()
        }),
        audit: z.object({
            enabled: z.boolean(),
            retention: z.number().positive()
        }),
        rateLimit: z.object({
            enabled: z.boolean(),
            window: z.number().positive(),
            max: z.number().positive()
        })
    })
};

/**
 * Validates the loaded environment configuration using Zod schema
 * with enhanced error handling and logging
 */
function validateConfig(): z.infer<typeof ConfigSchema> {
    try {
        const rawConfig = {
            server: {
                port: parseInt(process.env.SERVER_PORT || '3000', 10),
                host: process.env.SERVER_HOST || '0.0.0.0',
                nodeEnv: NODE_ENV,
                logLevel: process.env.LOG_LEVEL || 'info',
                corsOrigins: JSON.parse(process.env.CORS_ORIGINS || '[]'),
                rateLimits: JSON.parse(process.env.RATE_LIMITS || '{}'),
                timeouts: JSON.parse(process.env.TIMEOUTS || '{}')
            },
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432', 10),
                name: process.env.DB_NAME || 'template_service',
                user: process.env.DB_USER || '',
                password: process.env.DB_PASSWORD || '',
                sslMode: process.env.DB_SSL_MODE || 'require',
                poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
                maxOverflow: parseInt(process.env.DB_MAX_OVERFLOW || '5', 10),
                connectionTimeout: parseInt(process.env.DB_CONN_TIMEOUT || '30000', 10),
                idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
                maxLifetime: parseInt(process.env.DB_MAX_LIFETIME || '3600000', 10)
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || '',
                db: parseInt(process.env.REDIS_DB || '0', 10),
                ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
                queueName: process.env.REDIS_QUEUE_NAME || 'template-service',
                maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
                cluster: process.env.REDIS_CLUSTER === 'true',
                sentinels: JSON.parse(process.env.REDIS_SENTINELS || '[]')
            },
            template: {
                maxSize: parseInt(process.env.TEMPLATE_MAX_SIZE || '65536', 10),
                maxVariables: parseInt(process.env.TEMPLATE_MAX_VARS || '50', 10),
                allowedTypes: Object.values(VariableType),
                cacheEnabled: process.env.TEMPLATE_CACHE_ENABLED === 'true',
                cacheTTL: parseInt(process.env.TEMPLATE_CACHE_TTL || '3600', 10),
                validationRules: JSON.parse(process.env.TEMPLATE_VALIDATION_RULES || '{}'),
                sanitizationRules: JSON.parse(process.env.TEMPLATE_SANITIZATION_RULES || '{}'),
                versionControl: process.env.TEMPLATE_VERSION_CONTROL === 'true'
            },
            security: {
                encryption: {
                    algorithm: process.env.SECURITY_ENCRYPTION_ALGO || 'aes-256-gcm',
                    keySize: parseInt(process.env.SECURITY_KEY_SIZE || '32', 10),
                    ivSize: parseInt(process.env.SECURITY_IV_SIZE || '16', 10)
                },
                audit: {
                    enabled: process.env.SECURITY_AUDIT_ENABLED === 'true',
                    retention: parseInt(process.env.SECURITY_AUDIT_RETENTION || '90', 10)
                },
                rateLimit: {
                    enabled: process.env.SECURITY_RATE_LIMIT_ENABLED === 'true',
                    window: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW || '60000', 10),
                    max: parseInt(process.env.SECURITY_RATE_LIMIT_MAX || '100', 10)
                }
            }
        };

        // Validate configuration against schema
        const validatedConfig = Object.entries(ConfigSchema).reduce((acc, [key, schema]) => ({
            ...acc,
            [key]: schema.parse(rawConfig[key as keyof typeof rawConfig])
        }), {}) as z.infer<typeof ConfigSchema>;

        return validatedConfig;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const formattedError = error.errors.map(err => 
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');
            throw new Error(`Configuration validation failed:\n${formattedError}`);
        }
        throw error;
    }
}

/**
 * Retrieves secure database configuration with connection pooling and encryption
 */
function getDatabaseConfig() {
    const dbConfig = config.database;
    return {
        ...dbConfig,
        ssl: dbConfig.sslMode === 'require' ? {
            rejectUnauthorized: IS_PRODUCTION
        } : false,
        pool: {
            min: 2,
            max: dbConfig.poolSize,
            maxOverflow: dbConfig.maxOverflow,
            acquireTimeoutMillis: dbConfig.connectionTimeout,
            idleTimeoutMillis: dbConfig.idleTimeout,
            maxLifetimeMillis: dbConfig.maxLifetime
        }
    };
}

// Export validated configuration
export const config = validateConfig();

// Export database configuration
export const dbConfig = getDatabaseConfig();

// Type exports for configuration consumers
export type Config = z.infer<typeof ConfigSchema>;
export type DatabaseConfig = ReturnType<typeof getDatabaseConfig>;