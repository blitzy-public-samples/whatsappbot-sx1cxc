/**
 * @file Analytics type definitions for the WhatsApp Web Enhancement Application
 * @description Defines TypeScript interfaces and types for analytics data structures
 * used throughout the frontend application, including metrics, reports, and dashboard data
 */

/**
 * Time range options available for filtering analytics data
 */
export type TimeRangeFilter = 'last_24h' | 'last_7d' | 'last_30d' | 'custom';

/**
 * Message delivery status types
 */
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending';

/**
 * Types of user interactions with messages
 */
export type InteractionType = 'read' | 'reply' | 'click' | 'reaction' | 'forward';

/**
 * System error code types
 */
export type ErrorCode = 
  | 'rate_limit_exceeded'
  | 'connection_error'
  | 'authentication_error'
  | 'validation_error'
  | 'internal_error';

/**
 * Base interface for all metric types with common fields
 */
export interface BaseMetric {
  /** Unique identifier for the metric record */
  id: string;
  
  /** Organization ID associated with the metrics */
  organizationId: string;
  
  /** Timestamp when the metric was recorded */
  timestamp: Date;
  
  /** Timezone in which the metric was recorded */
  timezone: string;
  
  /** Additional metadata for the metric */
  metadata: Record<string, unknown>;
}

/**
 * Interface for message delivery metrics and statistics
 */
export interface MessageMetrics extends BaseMetric {
  /** Total number of messages sent */
  totalMessages: number;
  
  /** Number of successfully delivered messages */
  deliveredMessages: number;
  
  /** Number of failed message deliveries */
  failedMessages: number;
  
  /** Message delivery success rate (percentage) */
  deliveryRate: number;
  
  /** Breakdown of messages by delivery status */
  deliveryStatusBreakdown: Record<MessageStatus, number>;
  
  /** Average time taken for message delivery (in milliseconds) */
  averageDeliveryTime: number;
}

/**
 * Interface for user engagement metrics and analytics
 */
export interface EngagementMetrics extends BaseMetric {
  /** Total number of user interactions */
  totalInteractions: number;
  
  /** Number of unique users who interacted */
  uniqueUsers: number;
  
  /** User engagement rate (percentage) */
  engagementRate: number;
  
  /** Breakdown of interactions by type */
  interactionTypes: Record<InteractionType, number>;
  
  /** Time of highest user engagement */
  peakEngagementTime: Date;
}

/**
 * Interface for system performance metrics
 */
export interface SystemMetrics extends BaseMetric {
  /** Average system response time (in milliseconds) */
  responseTime: number;
  
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Memory usage percentage */
  memoryUsage: number;
  
  /** Number of concurrent users */
  concurrentUsers: number;
  
  /** Count of errors by error code */
  errorCounts: Record<ErrorCode, number>;
  
  /** System uptime (in seconds) */
  uptime: number;
}

/**
 * Interface for template usage and performance metrics
 */
export interface TemplatePerformance extends BaseMetric {
  /** Unique identifier for the template */
  templateId: string;
  
  /** Human-readable template name */
  templateName: string;
  
  /** Number of times the template was sent */
  sent: number;
  
  /** Number of times the template was opened */
  opened: number;
  
  /** Number of replies received */
  replied: number;
  
  /** Template conversion rate (percentage) */
  conversionRate: number;
  
  /** Average time taken for users to respond (in milliseconds) */
  averageResponseTime: number;
}

/**
 * Interface for the complete analytics dashboard data
 */
export interface AnalyticsDashboard {
  /** Message delivery metrics and statistics */
  messageMetrics: MessageMetrics;
  
  /** User engagement metrics and analytics */
  engagementMetrics: EngagementMetrics;
  
  /** System performance metrics */
  systemMetrics: SystemMetrics;
  
  /** Performance metrics for message templates */
  templatePerformance: TemplatePerformance[];
  
  /** Selected time range for the dashboard data */
  timeRange: TimeRangeFilter;
}