// Version: TypeScript 5.0+
import { v4 as uuidv4 } from 'uuid'; // v9.x
import { jest } from '@jest/globals'; // v29.x

// Import message types from the Go service for type consistency
interface Message {
  id: string;
  organizationId: string;
  recipientPhone: string;
  content: MessageContent;
  template?: Template;
  status: MessageStatus;
  retryCount: number;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Message content type matching Go service
interface MessageContent {
  text?: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaName?: string;
  mediaHash?: string;
  previewUrl?: string;
  richText: boolean;
  formatting?: MessageFormatting;
}

interface MessageFormatting {
  bold?: TextRange[];
  italic?: TextRange[];
  strikethrough?: TextRange[];
  links?: LinkRange[];
}

interface TextRange {
  start: number;
  length: number;
}

interface LinkRange extends TextRange {
  url: string;
}

interface Template {
  name: string;
  language: string;
  category: string;
  components: TemplateComponent[];
  status: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateComponent {
  type: string;
  parameters: Parameter[];
  subType?: string;
  index: number;
  required: boolean;
}

interface Parameter {
  type: string;
  value: string;
  format?: string;
  example?: string;
  validation?: ParameterValidation;
}

interface ParameterValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  allowList?: string[];
}

type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'scheduled' | 'cancelled';

interface MessageHistory {
  timestamp: Date;
  status: MessageStatus;
  error?: string;
}

interface MessageMetrics {
  processingTime: number;
  retryCount: number;
  deliveryAttempts: number;
}

interface ServiceMetrics {
  totalMessages: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageProcessingTime: number;
}

interface MockServiceConfiguration {
  simulateNetworkDelay?: boolean;
  networkDelayMs?: number;
  failureRate?: number;
  validateTemplates?: boolean;
  enforceRateLimit?: boolean;
  rateLimit?: number;
  batchSize?: number;
}

// Global mock stores
const mockMessageStore = new Map<string, {
  message: Message;
  history: MessageHistory[];
  metrics: MessageMetrics;
}>();

const mockScheduledMessages = new Map<string, {
  message: Message;
  scheduledTime: Date;
  retryCount: number;
}>();

const mockTemplateStore = new Map<string, {
  template: Template;
  version: number;
}>();

const mockMetricsStore = new Map<string, ServiceMetrics>();

export class MockMessageService {
  private config: MockServiceConfiguration;
  private messageStore: typeof mockMessageStore;
  private scheduledMessages: typeof mockScheduledMessages;
  private templateStore: typeof mockTemplateStore;
  private metricsStore: typeof mockMetricsStore;

  constructor(config: MockServiceConfiguration = {}) {
    this.config = {
      simulateNetworkDelay: true,
      networkDelayMs: 100,
      failureRate: 0.05,
      validateTemplates: true,
      enforceRateLimit: true,
      rateLimit: 100,
      batchSize: 50,
      ...config
    };

    this.messageStore = mockMessageStore;
    this.scheduledMessages = mockScheduledMessages;
    this.templateStore = mockTemplateStore;
    this.metricsStore = mockMetricsStore;
  }

  async sendMessage(message: Message): Promise<{ success: boolean; messageId: string; error?: string }> {
    const startTime = Date.now();

    try {
      // Simulate network delay if configured
      if (this.config.simulateNetworkDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.networkDelayMs));
      }

      // Validate message
      this.validateMessage(message);

      // Simulate random failures based on configured rate
      if (Math.random() < this.config.failureRate) {
        throw new Error('Simulated message delivery failure');
      }

      const messageId = message.id || uuidv4();
      const now = new Date();

      const messageData = {
        ...message,
        id: messageId,
        status: 'sent' as MessageStatus,
        sentAt: now,
        updatedAt: now
      };

      // Store message with history and metrics
      this.messageStore.set(messageId, {
        message: messageData,
        history: [
          { timestamp: now, status: 'sent' }
        ],
        metrics: {
          processingTime: Date.now() - startTime,
          retryCount: 0,
          deliveryAttempts: 1
        }
      });

      // Update service metrics
      this.updateMetrics(messageId, true, Date.now() - startTime);

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, messageId: message.id, error: errorMessage };
    }
  }

  async sendBatchMessages(messages: Message[], options: { 
    failFast?: boolean;
    maxRetries?: number;
  } = {}): Promise<{
    success: boolean;
    results: Array<{ messageId: string; success: boolean; error?: string }>;
    metrics: { 
      totalProcessed: number;
      successful: number;
      failed: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    const results: Array<{ messageId: string; success: boolean; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process messages in configured batch size
    for (let i = 0; i < messages.length; i += this.config.batchSize) {
      const batch = messages.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(async (message) => {
        try {
          const result = await this.sendMessage(message);
          if (result.success) successful++;
          else failed++;
          return result;
        } catch (error) {
          failed++;
          return {
            success: false,
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (options.failFast && failed > 0) {
        break;
      }
    }

    const metrics = {
      totalProcessed: results.length,
      successful,
      failed,
      processingTime: Date.now() - startTime
    };

    return {
      success: failed === 0,
      results,
      metrics
    };
  }

  private validateMessage(message: Message): void {
    if (!message.organizationId) {
      throw new Error('Organization ID is required');
    }

    if (!message.recipientPhone?.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Invalid phone number format');
    }

    if (!message.content?.text && !message.template) {
      throw new Error('Either message content or template is required');
    }

    if (message.template && this.config.validateTemplates) {
      this.validateTemplate(message.template);
    }
  }

  private validateTemplate(template: Template): void {
    if (!template.name || !template.language || !template.components) {
      throw new Error('Invalid template format');
    }

    template.components.forEach(component => {
      if (component.required && (!component.parameters || component.parameters.length === 0)) {
        throw new Error(`Required parameters missing in template component at index ${component.index}`);
      }
    });
  }

  private updateMetrics(messageId: string, success: boolean, processingTime: number): void {
    const metrics = this.metricsStore.get('global') || {
      totalMessages: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageProcessingTime: 0
    };

    metrics.totalMessages++;
    if (success) {
      metrics.successfulDeliveries++;
    } else {
      metrics.failedDeliveries++;
    }

    metrics.averageProcessingTime = (
      (metrics.averageProcessingTime * (metrics.totalMessages - 1) + processingTime) / 
      metrics.totalMessages
    );

    this.metricsStore.set('global', metrics);
  }

  // Additional testing utility methods
  getMessageHistory(messageId: string): MessageHistory[] | undefined {
    return this.messageStore.get(messageId)?.history;
  }

  getMessageMetrics(messageId: string): MessageMetrics | undefined {
    return this.messageStore.get(messageId)?.metrics;
  }

  getServiceMetrics(): ServiceMetrics {
    return this.metricsStore.get('global') || {
      totalMessages: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageProcessingTime: 0
    };
  }
}

export const createMockMessageService = (config?: MockServiceConfiguration): MockMessageService => {
  return new MockMessageService(config);
};

export const resetMockMessageService = async (preserveConfig = false): Promise<void> => {
  mockMessageStore.clear();
  mockScheduledMessages.clear();
  mockTemplateStore.clear();
  mockMetricsStore.clear();
  
  if (!preserveConfig) {
    jest.clearAllMocks();
  }
};