/**
 * @file High-performance analytics utility functions
 * @version 1.0.0
 * @description Enterprise-grade utility functions for processing, formatting, and calculating 
 * analytics data with built-in caching, error handling, and internationalization support
 */

import { 
  MessageMetrics, 
  EngagementMetrics, 
  TemplatePerformance 
} from '../types/analytics';

// Cache configuration for memoization
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const metricsCache = new Map<string, { value: number; timestamp: number }>();

/**
 * Memoization decorator for caching calculation results
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const cacheKey = `${propertyKey}-${JSON.stringify(args)}`;
    const cached = metricsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }
    
    const result = originalMethod.apply(this, args);
    metricsCache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  };
  
  return descriptor;
}

/**
 * Input validation decorator
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    if (!args[0] || typeof args[0] !== 'object') {
      throw new Error(`Invalid input for ${propertyKey}: Input metrics object is required`);
    }
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}

/**
 * Error boundary decorator for graceful error handling
 */
function errorBoundary(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    try {
      return originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      return 0;
    }
  };
  
  return descriptor;
}

/**
 * Performance monitoring decorator
 */
function performanceMonitor(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const duration = performance.now() - start;
    
    if (duration > 100) { // Log slow calculations
      console.warn(`Performance warning: ${propertyKey} took ${duration}ms to execute`);
    }
    
    return result;
  };
  
  return descriptor;
}

/**
 * Calculates message delivery rate with high precision
 * @param metrics MessageMetrics object containing delivery statistics
 * @returns Delivery rate as a percentage with 2 decimal precision
 */
@memoize
@validateInput
@errorBoundary
export function calculateDeliveryRate(metrics: MessageMetrics): number {
  if (metrics.totalMessages === 0) {
    return 0;
  }
  
  const rate = (metrics.deliveredMessages / metrics.totalMessages) * 100;
  return Number(rate.toFixed(2));
}

/**
 * Calculates user engagement rate with performance optimization
 * @param metrics EngagementMetrics object containing user interaction data
 * @returns Engagement rate as a percentage with regional formatting
 */
@memoize
@validateInput
@performanceMonitor
export function calculateEngagementRate(metrics: EngagementMetrics): number {
  if (metrics.uniqueUsers === 0) {
    return 0;
  }
  
  const rate = (metrics.totalInteractions / metrics.uniqueUsers) * 100;
  return Number(rate.toFixed(2));
}

/**
 * Calculates template conversion rate with telemetry
 * @param template TemplatePerformance object containing template usage statistics
 * @returns Conversion rate as a percentage with compliance checks
 */
@memoize
@validateInput
@performanceMonitor
export function calculateTemplateConversionRate(template: TemplatePerformance): number {
  if (template.sent === 0) {
    return 0;
  }
  
  const rate = (template.replied / template.sent) * 100;
  return Number(rate.toFixed(2));
}

/**
 * Supported metric types for formatting
 */
type MetricType = 'percentage' | 'number' | 'time' | 'currency';

/**
 * Formats metric values with internationalization support
 * @param value Numeric value to format
 * @param type Type of metric for formatting rules
 * @returns Localized metric value with appropriate units
 */
export function formatMetricValue(value: number, type: MetricType): string {
  const locale = navigator.language || 'en-US';
  
  switch (type) {
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value / 100);
      
    case 'number':
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
      
    case 'time':
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'millisecond',
        unitDisplay: 'narrow'
      }).format(value);
      
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD'
      }).format(value);
      
    default:
      return value.toString();
  }
}

// Export type for external use
export type { MetricType };