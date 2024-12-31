// External imports with versions
import { describe, beforeEach, test, expect } from '@jest/globals'; // ^29.0.0

// Internal imports
import { MetricsCalculator } from '../../../backend/analytics-service/src/services/calculator';
import { MessageMetric, EngagementMetric, SystemMetric } from '../../../backend/analytics-service/src/models/metrics';
import { TestDataGenerator } from '../../utils/test-data-generator';

// Test constants
const TEST_THRESHOLDS = {
  delivery_rate: 0.99, // 99% delivery rate requirement
  response_time: 2000, // 2 seconds max response time
  min_concurrent_users: 1000, // 1000+ concurrent users support
  engagement_rate: 0.80 // 80% target engagement rate
};

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator;
  let testDataGenerator: TestDataGenerator;
  let defaultConfig: any;

  beforeEach(() => {
    // Initialize test data generator
    testDataGenerator = new TestDataGenerator();

    // Setup default configuration
    defaultConfig = {
      thresholds: {
        delivery_thresholds: [99.0, 97.0, 95.0],
        engagement_thresholds: [80.0, 60.0, 40.0],
        response_time_threshold: 2.0,
        cpu_threshold: 80.0,
        memory_threshold: 80.0,
        concurrent_users_threshold: 1000
      }
    };

    // Initialize calculator with test configuration
    calculator = new MetricsCalculator(defaultConfig, []);
  });

  describe('calculate_delivery_statistics', () => {
    test('should calculate accurate delivery rates meeting SLA requirements', () => {
      // Generate test message metrics with high delivery rate
      const messageMetrics = testDataGenerator.generateMessageMetrics({
        total_messages: 1000,
        delivered_percentage: 99.5
      });

      const result = calculator.calculate_delivery_statistics(messageMetrics, new Date());

      expect(result.current_statistics.average_delivery_rate).toBeGreaterThanOrEqual(TEST_THRESHOLDS.delivery_rate);
      expect(result.current_statistics.sla_compliance).toBe(1.0);
      expect(result.statistical_analysis.basic_stats.std).toBeLessThan(1.0);
    });

    test('should identify delivery rate threshold breaches', () => {
      // Generate test message metrics with below-threshold delivery rate
      const messageMetrics = testDataGenerator.generateMessageMetrics({
        total_messages: 1000,
        delivered_percentage: 98.0
      });

      const result = calculator.calculate_delivery_statistics(messageMetrics, new Date());

      expect(result.threshold_analysis.threshold_breaches[0]).toBeGreaterThan(0);
      expect(result.current_statistics.sla_compliance).toBeLessThan(1.0);
    });

    test('should handle edge cases and invalid metrics', () => {
      const invalidMetrics: MessageMetric[] = [];
      
      expect(() => {
        calculator.calculate_delivery_statistics(invalidMetrics, new Date());
      }).toThrow('No valid metrics provided for analysis');
    });
  });

  describe('calculate_engagement_statistics', () => {
    test('should calculate accurate engagement rates with user segmentation', () => {
      // Generate test engagement metrics with high interaction rates
      const engagementMetrics = testDataGenerator.generateEngagementMetrics({
        total_interactions: 5000,
        unique_users: 1000
      });

      const result = calculator.calculate_engagement_statistics(engagementMetrics, {});

      expect(result.engagement_metrics.average_rate).toBeGreaterThanOrEqual(TEST_THRESHOLDS.engagement_rate);
      expect(result.user_segments).toBeDefined();
      expect(result.predictions).toBeDefined();
    });

    test('should analyze interaction patterns and trends', () => {
      // Generate test engagement metrics with varied interaction types
      const engagementMetrics = testDataGenerator.generateEngagementMetrics({
        interaction_types: {
          'click': 1000,
          'reply': 500,
          'forward': 200
        }
      });

      const result = calculator.calculate_engagement_statistics(engagementMetrics, {});

      expect(result.interaction_analysis).toBeDefined();
      expect(result.interaction_analysis.patterns).toHaveLength(3);
      expect(result.engagement_metrics.peak_engagement).toBeGreaterThan(0);
    });

    test('should handle seasonal variations in engagement', () => {
      // Generate engagement metrics with time-based patterns
      const engagementMetrics = testDataGenerator.generateEngagementMetrics({
        time_based_patterns: true,
        period_days: 30
      });

      const result = calculator.calculate_engagement_statistics(engagementMetrics, {
        analyze_seasonality: true
      });

      expect(result.predictions.seasonal_factors).toBeDefined();
      expect(result.predictions.trend).toBeDefined();
    });
  });

  describe('calculate_performance_statistics', () => {
    test('should validate response time SLA compliance', () => {
      // Generate performance metrics with response times
      const performanceMetrics = testDataGenerator.generatePerformanceMetrics({
        response_times: Array.from({ length: 1000 }, () => Math.random() * 1.5) // All under 2s
      });

      const result = calculator.calculate_performance_statistics(performanceMetrics);

      expect(result.response_time_analysis.average).toBeLessThan(TEST_THRESHOLDS.response_time / 1000);
      expect(result.response_time_analysis.sla_compliance).toBeGreaterThanOrEqual(0.99);
    });

    test('should verify concurrent user support', () => {
      // Generate performance metrics with high concurrent user load
      const performanceMetrics = testDataGenerator.generatePerformanceMetrics({
        concurrent_users: Array.from({ length: 24 }, () => 1200) // Hourly samples above threshold
      });

      const result = calculator.calculate_performance_statistics(performanceMetrics);

      expect(result.resource_utilization.concurrent_users.average)
        .toBeGreaterThanOrEqual(TEST_THRESHOLDS.min_concurrent_users);
      expect(result.health_indicators.load_status).toBe('healthy');
    });

    test('should analyze system resource utilization', () => {
      // Generate performance metrics with varied resource usage
      const performanceMetrics = testDataGenerator.generatePerformanceMetrics({
        cpu_usage: Array.from({ length: 100 }, () => Math.random() * 70), // Below 80% threshold
        memory_usage: Array.from({ length: 100 }, () => Math.random() * 70) // Below 80% threshold
      });

      const result = calculator.calculate_performance_statistics(performanceMetrics, true);

      expect(result.resource_utilization.cpu.average).toBeLessThan(80);
      expect(result.resource_utilization.memory.average).toBeLessThan(80);
      expect(result.predictions.resource_trends).toBeDefined();
    });
  });

  describe('validate_thresholds', () => {
    test('should validate threshold configuration', () => {
      const validConfig = {
        delivery: 99.0,
        engagement: 80.0,
        performance: {
          response_time: 2.0,
          cpu_usage: 80.0
        }
      };

      const result = calculator.validate_thresholds(validConfig, true);
      expect(result).toBe(true);
    });

    test('should reject invalid threshold values', () => {
      const invalidConfig = {
        delivery: 101.0, // Invalid percentage
        engagement: -5.0 // Invalid negative value
      };

      const result = calculator.validate_thresholds(invalidConfig, true);
      expect(result).toBe(false);
    });
  });
});