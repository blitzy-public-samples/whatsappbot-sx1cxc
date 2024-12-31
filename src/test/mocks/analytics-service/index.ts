// Version: 1.0.0
// Mock implementation of the analytics service for testing purposes

import { MessageMetric, EngagementMetric, SystemMetric } from '../../backend/analytics-service/src/models/metrics';
import { jest } from 'jest'; // v29.6.3
import { MockInstance } from 'jest-mock'; // v29.6.3

interface MockConfig {
  errorRate?: number;
  latencyMs?: number;
  cacheEnabled?: boolean;
  slaCompliance?: boolean;
}

interface MetricOptions {
  timeGranularity?: 'hour' | 'day' | 'week' | 'month';
  includeHistory?: boolean;
  detailedBreakdown?: boolean;
}

/**
 * Creates SLA-compliant mock delivery metrics with realistic patterns
 */
export const createMockDeliveryMetrics = (
  organization_id: string,
  time_period: string,
  options?: MetricOptions
): MessageMetric => {
  const totalMessages = Math.floor(Math.random() * 10000) + 1000;
  // Ensure >99% delivery rate for SLA compliance
  const deliveredMessages = Math.floor(totalMessages * (0.992 + Math.random() * 0.008));
  const failedMessages = totalMessages - deliveredMessages;

  return {
    metric_id: crypto.randomUUID(),
    organization_id,
    timestamp: new Date(),
    total_messages: totalMessages,
    delivered_messages: deliveredMessages,
    failed_messages: failedMessages,
    delivery_rate: (deliveredMessages / totalMessages) * 100,
    delivery_status_breakdown: {
      delivered: deliveredMessages,
      failed: failedMessages,
      pending: Math.floor(Math.random() * 50)
    },
    queue_status: {
      queue_length: Math.floor(Math.random() * 100),
      processing_rate: 95 + Math.random() * 5
    },
    message_types: {
      text: Math.floor(totalMessages * 0.7),
      media: Math.floor(totalMessages * 0.2),
      template: Math.floor(totalMessages * 0.1)
    },
    metadata: {
      time_period,
      generated_at: new Date().toISOString()
    }
  } as MessageMetric;
};

/**
 * Creates realistic mock user engagement metrics with temporal patterns
 */
export const createMockEngagementMetrics = (
  organization_id: string,
  time_period: string,
  options?: MetricOptions
): EngagementMetric => {
  const uniqueUsers = Math.floor(Math.random() * 1000) + 100;
  const totalInteractions = uniqueUsers * (Math.floor(Math.random() * 10) + 5);

  return {
    metric_id: crypto.randomUUID(),
    organization_id,
    timestamp: new Date(),
    total_interactions: totalInteractions,
    unique_users: uniqueUsers,
    interaction_types: {
      click: Math.floor(totalInteractions * 0.4),
      view: Math.floor(totalInteractions * 0.3),
      reply: Math.floor(totalInteractions * 0.2),
      share: Math.floor(totalInteractions * 0.1)
    },
    session_durations: {
      average: 180 + Math.random() * 120,
      median: 150 + Math.random() * 100,
      p95: 300 + Math.random() * 200
    },
    interaction_weights: {
      click: 1.0,
      view: 0.5,
      reply: 2.0,
      share: 3.0
    },
    engagement_rate: (totalInteractions / uniqueUsers) * 100,
    metadata: {
      time_period,
      generated_at: new Date().toISOString()
    }
  } as EngagementMetric;
};

/**
 * Creates performance-focused mock system metrics adhering to SLAs
 */
export const createMockSystemMetrics = (
  organization_id: string,
  time_period: string,
  options?: MetricOptions
): SystemMetric => {
  // Ensure response time is under 2s SLA
  const responseTime = 0.5 + Math.random() * 1.4;
  
  return {
    metric_id: crypto.randomUUID(),
    organization_id,
    timestamp: new Date(),
    response_time: responseTime,
    cpu_usage: 30 + Math.random() * 40,
    memory_usage: 40 + Math.random() * 30,
    concurrent_users: Math.floor(Math.random() * 900) + 100,
    error_counts: {
      '4xx': Math.floor(Math.random() * 10),
      '5xx': Math.floor(Math.random() * 5)
    },
    resource_thresholds: {
      max_response_time: 2.0,
      max_cpu_usage: 80.0,
      max_memory_usage: 80.0,
      max_errors: 100
    },
    performance_history: {
      response_times: Array.from({ length: 24 }, () => 0.5 + Math.random() * 1.4),
      cpu_usage: Array.from({ length: 24 }, () => 30 + Math.random() * 40),
      memory_usage: Array.from({ length: 24 }, () => 40 + Math.random() * 30),
      timestamps: Array.from({ length: 24 }, (_, i) => 
        new Date(Date.now() - (23 - i) * 3600000).toISOString()
      )
    },
    metadata: {
      time_period,
      generated_at: new Date().toISOString()
    }
  } as SystemMetric;
};

/**
 * Comprehensive mock implementation of the analytics service with advanced testing capabilities
 */
@jest.mock('../../backend/analytics-service')
export class MockAnalyticsService {
  private _deliveryMetricsMock: jest.Mock;
  private _engagementMetricsMock: jest.Mock;
  private _systemMetricsMock: jest.Mock;
  private _metricsCache: Map<string, any>;
  private _errorSimulation: MockConfig;

  constructor(config: MockConfig = {}) {
    this._deliveryMetricsMock = jest.fn();
    this._engagementMetricsMock = jest.fn();
    this._systemMetricsMock = jest.fn();
    this._metricsCache = new Map();
    this._errorSimulation = {
      errorRate: config.errorRate || 0,
      latencyMs: config.latencyMs || 0,
      cacheEnabled: config.cacheEnabled ?? true,
      slaCompliance: config.slaCompliance ?? true
    };
  }

  /**
   * Mock implementation of delivery metrics endpoint with error simulation
   */
  async getDeliveryMetrics(
    organization_id: string,
    time_period: string,
    options?: MetricOptions
  ): Promise<MessageMetric> {
    const cacheKey = `delivery_${organization_id}_${time_period}`;

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this._errorSimulation.latencyMs));

    // Error simulation
    if (Math.random() < this._errorSimulation.errorRate) {
      throw new Error('Simulated delivery metrics error');
    }

    // Check cache
    if (this._errorSimulation.cacheEnabled && this._metricsCache.has(cacheKey)) {
      return this._metricsCache.get(cacheKey);
    }

    const metrics = createMockDeliveryMetrics(organization_id, time_period, options);
    
    if (this._errorSimulation.cacheEnabled) {
      this._metricsCache.set(cacheKey, metrics);
    }

    this._deliveryMetricsMock(organization_id, time_period, options);
    return metrics;
  }

  /**
   * Mock implementation of engagement metrics with user patterns
   */
  async getEngagementMetrics(
    organization_id: string,
    time_period: string,
    options?: MetricOptions
  ): Promise<EngagementMetric> {
    const cacheKey = `engagement_${organization_id}_${time_period}`;

    await new Promise(resolve => setTimeout(resolve, this._errorSimulation.latencyMs));

    if (Math.random() < this._errorSimulation.errorRate) {
      throw new Error('Simulated engagement metrics error');
    }

    if (this._errorSimulation.cacheEnabled && this._metricsCache.has(cacheKey)) {
      return this._metricsCache.get(cacheKey);
    }

    const metrics = createMockEngagementMetrics(organization_id, time_period, options);

    if (this._errorSimulation.cacheEnabled) {
      this._metricsCache.set(cacheKey, metrics);
    }

    this._engagementMetricsMock(organization_id, time_period, options);
    return metrics;
  }

  /**
   * Mock implementation of system metrics with performance focus
   */
  async getSystemMetrics(
    organization_id: string,
    time_period: string,
    options?: MetricOptions
  ): Promise<SystemMetric> {
    const cacheKey = `system_${organization_id}_${time_period}`;

    await new Promise(resolve => setTimeout(resolve, this._errorSimulation.latencyMs));

    if (Math.random() < this._errorSimulation.errorRate) {
      throw new Error('Simulated system metrics error');
    }

    if (this._errorSimulation.cacheEnabled && this._metricsCache.has(cacheKey)) {
      return this._metricsCache.get(cacheKey);
    }

    const metrics = createMockSystemMetrics(organization_id, time_period, options);

    if (this._errorSimulation.cacheEnabled) {
      this._metricsCache.set(cacheKey, metrics);
    }

    this._systemMetricsMock(organization_id, time_period, options);
    return metrics;
  }

  /**
   * Comprehensive reset of all mock implementations and caches
   */
  resetMocks(options: { clearCache?: boolean } = {}): void {
    this._deliveryMetricsMock.mockClear();
    this._engagementMetricsMock.mockClear();
    this._systemMetricsMock.mockClear();
    
    if (options.clearCache) {
      this._metricsCache.clear();
    }
  }
}