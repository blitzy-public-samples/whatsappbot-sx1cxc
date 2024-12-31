// External imports with versions
import Redis from 'ioredis'; // ^5.3.0
import { afterEach, beforeEach, jest } from '@jest/globals'; // ^29.0.0

// Internal imports
import { TestDataGenerator } from '../../utils/test-data-generator';

/**
 * Enhanced configuration interface for test queue connection and monitoring
 */
interface QueueConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  monitoringEnabled: boolean;
}

/**
 * Queue metrics interface for monitoring and performance tracking
 */
interface QueueMetrics {
  queueLength: number;
  processingRate: number;
  errorRate: number;
  averageLatency: number;
  timestamp: Date;
}

/**
 * Queue operation options interface
 */
interface EnqueueOptions {
  priority?: 'high' | 'normal' | 'low';
  delay?: number;
  retries?: number;
  timeout?: number;
}

/**
 * Constants for queue configuration and operation
 */
const QUEUE_NAMES = {
  HIGH_PRIORITY: 'test:messages:high',
  NORMAL_PRIORITY: 'test:messages:normal',
  LOW_PRIORITY: 'test:messages:low',
  SCHEDULED: 'test:messages:scheduled',
  DEAD_LETTER: 'test:messages:dead-letter'
} as const;

const DEFAULT_CONFIG: Partial<QueueConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 5000,
  monitoringEnabled: true
};

/**
 * Advanced test queue manager with enhanced monitoring, performance optimization,
 * and test isolation capabilities.
 */
export class TestQueue {
  private redisClient: Redis;
  private dataGenerator: TestDataGenerator;
  private metrics: Map<string, QueueMetrics>;
  private monitoringInterval?: NodeJS.Timeout;

  /**
   * Initialize the test queue manager with enhanced configuration
   */
  constructor(private config: QueueConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = new Map();
    
    // Initialize Redis client with optimized configuration
    this.redisClient = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetries,
      retryStrategy: (times: number) => {
        if (times > this.config.maxRetries) return null;
        return Math.min(times * this.config.retryDelay, 3000);
      },
      connectTimeout: this.config.connectionTimeout,
      enableReadyCheck: true,
      enableOfflineQueue: false
    });

    this.dataGenerator = new TestDataGenerator();

    // Set up test lifecycle hooks
    beforeEach(async () => {
      await this.connect();
    });

    afterEach(async () => {
      await this.cleanup();
    });
  }

  /**
   * Establish connection to test Redis instance with monitoring
   */
  public async connect(): Promise<void> {
    try {
      await this.redisClient.ping();
      
      if (this.config.monitoringEnabled) {
        this.startMonitoring();
      }
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${error.message}`);
    }
  }

  /**
   * Gracefully disconnect and cleanup resources
   */
  public async disconnect(): Promise<void> {
    this.stopMonitoring();
    await this.redisClient.quit();
  }

  /**
   * Enqueue a batch of test messages with transaction support
   */
  public async enqueueBatch(
    messages: any[],
    queueName: string = QUEUE_NAMES.NORMAL_PRIORITY,
    options: EnqueueOptions = {}
  ): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    const now = Date.now();

    try {
      for (const message of messages) {
        const messageData = JSON.stringify({
          ...message,
          enqueuedAt: now,
          priority: options.priority || 'normal',
          retryCount: 0
        });

        if (options.delay) {
          pipeline.zadd(QUEUE_NAMES.SCHEDULED, now + options.delay, messageData);
        } else {
          pipeline.lpush(queueName, messageData);
        }
      }

      await pipeline.exec();
      await this.updateMetrics(queueName);
    } catch (error) {
      throw new Error(`Failed to enqueue batch: ${error.message}`);
    }
  }

  /**
   * Monitor queue metrics and performance
   */
  public async monitorQueue(queueName: string): Promise<QueueMetrics> {
    try {
      const queueLength = await this.redisClient.llen(queueName);
      const metrics = this.metrics.get(queueName) || this.initializeMetrics();

      const currentMetrics: QueueMetrics = {
        queueLength,
        processingRate: await this.calculateProcessingRate(queueName),
        errorRate: await this.calculateErrorRate(queueName),
        averageLatency: await this.calculateAverageLatency(queueName),
        timestamp: new Date()
      };

      this.metrics.set(queueName, currentMetrics);
      return currentMetrics;
    } catch (error) {
      throw new Error(`Failed to monitor queue: ${error.message}`);
    }
  }

  /**
   * Comprehensive cleanup of test queues and resources
   */
  public async cleanup(): Promise<void> {
    const pipeline = this.redisClient.pipeline();

    try {
      // Clean up all test queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        pipeline.del(queueName);
      }

      // Clean up metrics and monitoring
      this.stopMonitoring();
      this.metrics.clear();

      await pipeline.exec();
    } catch (error) {
      throw new Error(`Failed to cleanup test queues: ${error.message}`);
    }
  }

  /**
   * Generate test messages using TestDataGenerator
   */
  public async generateTestMessages(count: number): Promise<any[]> {
    return await this.dataGenerator.generateBulk('message', count);
  }

  /**
   * Private helper methods
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      for (const queueName of Object.values(QUEUE_NAMES)) {
        await this.monitorQueue(queueName);
      }
    }, 1000);
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  private initializeMetrics(): QueueMetrics {
    return {
      queueLength: 0,
      processingRate: 0,
      errorRate: 0,
      averageLatency: 0,
      timestamp: new Date()
    };
  }

  private async calculateProcessingRate(queueName: string): Promise<number> {
    const previousMetrics = this.metrics.get(queueName);
    if (!previousMetrics) return 0;

    const currentLength = await this.redisClient.llen(queueName);
    const timeDiff = Date.now() - previousMetrics.timestamp.getTime();
    const processedCount = Math.max(0, previousMetrics.queueLength - currentLength);

    return timeDiff > 0 ? (processedCount / timeDiff) * 1000 : 0;
  }

  private async calculateErrorRate(queueName: string): Promise<number> {
    const deadLetterCount = await this.redisClient.llen(QUEUE_NAMES.DEAD_LETTER);
    const totalProcessed = await this.redisClient.get(`${queueName}:processed`) || '0';
    
    return totalProcessed === '0' ? 0 : (deadLetterCount / parseInt(totalProcessed, 10));
  }

  private async calculateAverageLatency(queueName: string): Promise<number> {
    const latencies = await this.redisClient.lrange(`${queueName}:latencies`, 0, -1);
    if (!latencies.length) return 0;

    const sum = latencies.reduce((acc, latency) => acc + parseInt(latency, 10), 0);
    return sum / latencies.length;
  }
}