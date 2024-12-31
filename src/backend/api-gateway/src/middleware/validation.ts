// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.x
import { Schema, ValidationError, ValidationOptions } from 'joi'; // v17.9.x
import { sanitize, IOptions as SanitizeOptions } from 'sanitize-html'; // v2.11.x

// Internal dependencies
import { ServiceError } from '../types';
import { config } from '../config';

// Constants for validation error codes
const VALIDATION_ERROR_CODES = {
  SCHEMA_VALIDATION: 4000,
  SANITIZATION_ERROR: 4001,
  TYPE_ERROR: 4002,
  LENGTH_ERROR: 4003
} as const;

// Constants for validation limits
const VALIDATION_LIMITS = {
  MAX_STRING_LENGTH: 1000,
  MAX_ARRAY_LENGTH: 100,
  MAX_OBJECT_DEPTH: 5
} as const;

// Default sanitization options with strict security settings
const SANITIZE_OPTIONS: SanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
  parseStyleAttributes: false
};

// Schema validation cache for performance optimization
const schemaCache = new Map<string, Schema>();

/**
 * Enhanced schema validation middleware factory with caching and performance optimizations.
 * @param {Schema} schema - Joi schema for validation
 * @param {ValidationOptions} options - Optional validation options
 * @returns {Function} Express middleware for schema validation
 */
export function validateSchema(schema: Schema, options: ValidationOptions = {}) {
  // Cache compiled schema for reuse
  const cacheKey = schema.describe().type;
  if (!schemaCache.has(cacheKey)) {
    schemaCache.set(cacheKey, schema);
  }

  const cachedSchema = schemaCache.get(cacheKey)!;
  const validationOptions: ValidationOptions = {
    abortEarly: false,
    stripUnknown: true,
    ...options,
    ...config.validation
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract request data for validation
      const dataToValidate = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      // Validate against cached schema
      const validatedData = await cachedSchema.validateAsync(
        dataToValidate,
        validationOptions
      );

      // Apply recursive sanitization
      const sanitizedData = await sanitizeInput(validatedData, SANITIZE_OPTIONS);

      // Attach sanitized data back to request
      req.body = sanitizedData.body;
      req.query = sanitizedData.query;
      req.params = sanitizedData.params;

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        const serviceError = handleValidationError(error, {
          path: req.path,
          method: req.method
        });
        next(serviceError);
      } else {
        next(new ServiceError(
          VALIDATION_ERROR_CODES.TYPE_ERROR,
          'Unexpected validation error',
          {
            field: 'unknown',
            reason: error instanceof Error ? error.message : 'Unknown error',
            value: null,
            context: { path: req.path }
          }
        ));
      }
    }
  };
}

/**
 * Enhanced input sanitization with recursive handling and type-specific strategies.
 * @param {any} input - Input data to sanitize
 * @param {SanitizeOptions} options - Sanitization options
 * @returns {any} Sanitized data
 */
export function sanitizeInput(input: any, options: SanitizeOptions): any {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return input;
  }

  // Handle arrays with length validation
  if (Array.isArray(input)) {
    if (input.length > VALIDATION_LIMITS.MAX_ARRAY_LENGTH) {
      throw new ServiceError(
        VALIDATION_ERROR_CODES.LENGTH_ERROR,
        'Array exceeds maximum length',
        {
          field: 'array',
          reason: 'length_exceeded',
          value: input.length,
          context: { max: VALIDATION_LIMITS.MAX_ARRAY_LENGTH }
        }
      );
    }
    return input.map(item => sanitizeInput(item, options));
  }

  // Handle objects recursively with depth checking
  if (typeof input === 'object') {
    const sanitizedObj: Record<string, any> = {};
    let depth = 0;

    const processObject = (obj: Record<string, any>, currentDepth: number) => {
      if (currentDepth > VALIDATION_LIMITS.MAX_OBJECT_DEPTH) {
        throw new ServiceError(
          VALIDATION_ERROR_CODES.LENGTH_ERROR,
          'Object nesting exceeds maximum depth',
          {
            field: 'object',
            reason: 'depth_exceeded',
            value: currentDepth,
            context: { max: VALIDATION_LIMITS.MAX_OBJECT_DEPTH }
          }
        );
      }

      Object.entries(obj).forEach(([key, value]) => {
        sanitizedObj[key] = sanitizeInput(value, options);
      });
    };

    processObject(input, depth);
    return sanitizedObj;
  }

  // Handle strings with HTML sanitization and length validation
  if (typeof input === 'string') {
    if (input.length > VALIDATION_LIMITS.MAX_STRING_LENGTH) {
      throw new ServiceError(
        VALIDATION_ERROR_CODES.LENGTH_ERROR,
        'String exceeds maximum length',
        {
          field: 'string',
          reason: 'length_exceeded',
          value: input.length,
          context: { max: VALIDATION_LIMITS.MAX_STRING_LENGTH }
        }
      );
    }
    return sanitize(input, options);
  }

  // Return primitives as is
  return input;
}

/**
 * Enhanced validation error handler with detailed mapping and context preservation.
 * @param {ValidationError} error - Joi validation error
 * @param {object} context - Additional context information
 * @returns {ServiceError} Formatted service error
 */
function handleValidationError(error: ValidationError, context: Record<string, any>): ServiceError {
  const details = error.details[0];
  const errorContext = {
    field: details.path.join('.'),
    reason: details.type,
    value: details.context?.value,
    context: {
      ...context,
      key: details.context?.key,
      label: details.context?.label
    }
  };

  return new ServiceError(
    VALIDATION_ERROR_CODES.SCHEMA_VALIDATION,
    details.message,
    errorContext
  );
}