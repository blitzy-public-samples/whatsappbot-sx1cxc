// @version React ^18.2.0
import { BaseEntity, AsyncState } from './common';
import { Template } from './templates';

/**
 * Enum for supported message types in the WhatsApp Web Enhancement application
 */
export enum MessageType {
  TEXT = 'TEXT',
  TEMPLATE = 'TEMPLATE',
  MEDIA = 'MEDIA'
}

/**
 * Enum for message delivery and processing status
 */
export enum MessageStatus {
  DRAFT = 'DRAFT',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Interface defining the structure of message content including media support
 */
export interface MessageContent {
  /** Main text content of the message */
  text: string;
  /** Optional caption for media messages */
  caption: string | null;
  /** URL of the media file if present */
  mediaUrl: string | null;
  /** Type of media (image, video, document, audio) */
  mediaType: string | null;
  /** MIME type of the media file */
  mimeType: string | null;
  /** Size of the media file in bytes */
  fileSize: number | null;
  /** URL of the media thumbnail if available */
  thumbnailUrl: string | null;
}

/**
 * Core message interface extending BaseEntity with comprehensive tracking capabilities
 */
export interface Message extends BaseEntity {
  /** Organization ID for multi-tenant support */
  organizationId: string;
  /** Recipient's phone number in E.164 format */
  recipientPhone: string;
  /** Type of the message */
  type: MessageType;
  /** Content of the message */
  content: MessageContent;
  /** Associated template for template-based messages */
  template: Template | null;
  /** Current status of the message */
  status: MessageStatus;
  /** Scheduled delivery timestamp */
  scheduledAt: Timestamp | null;
  /** Actual sending timestamp */
  sentAt: Timestamp | null;
  /** Delivery confirmation timestamp */
  deliveredAt: Timestamp | null;
  /** Reason for failure if message failed */
  failureReason: string | null;
  /** Number of retry attempts */
  retryCount: number;
  /** Timestamp of last retry attempt */
  lastRetryAt: Timestamp | null;
}

/**
 * Interface for message filtering and search capabilities
 */
export interface MessageFilter {
  /** Filter by message status */
  status: MessageStatus[];
  /** Filter by message type */
  type: MessageType[];
  /** Start date for date range filter */
  startDate: Timestamp | null;
  /** End date for date range filter */
  endDate: Timestamp | null;
  /** Filter by recipient phone number */
  recipientPhone: string | null;
  /** Filter by template ID */
  templateId: string | null;
}

/**
 * Interface for message composition request
 */
export interface ComposeMessageRequest {
  /** Recipient phone number(s) */
  recipients: string[];
  /** Message type */
  type: MessageType;
  /** Message content */
  content: MessageContent;
  /** Template ID if using template */
  templateId?: string;
  /** Template variables if using template */
  templateVariables?: Record<string, unknown>;
  /** Scheduled delivery time */
  scheduledAt?: Timestamp;
}

/**
 * Interface for message update request
 */
export interface UpdateMessageRequest {
  /** Message ID to update */
  id: string;
  /** Updated content */
  content?: MessageContent;
  /** Updated schedule time */
  scheduledAt?: Timestamp;
  /** Updated status */
  status?: MessageStatus;
}

/**
 * Type for message operation state management
 */
export type MessageOperationState = AsyncState<Message>;

/**
 * Type for message list state management
 */
export type MessageListState = AsyncState<Message[]>;

/**
 * Constants for message constraints
 */
export const MESSAGE_CONSTRAINTS = {
  MAX_TEXT_LENGTH: 4096,
  MAX_CAPTION_LENGTH: 1024,
  MAX_MEDIA_SIZE: 16 * 1024 * 1024, // 16MB
  SUPPORTED_MEDIA_TYPES: ['image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg', 'application/pdf'],
  MAX_RECIPIENTS: 100,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5 * 60 * 1000 // 5 minutes
} as const;

/**
 * Type guard to check if a message is template-based
 */
export const isTemplateMessage = (message: Message): boolean => {
  return message.type === MessageType.TEMPLATE && message.template !== null;
};

/**
 * Type guard to check if a message contains media
 */
export const isMediaMessage = (message: Message): boolean => {
  return message.type === MessageType.MEDIA && message.content.mediaUrl !== null;
};

/**
 * Type guard to check if a message is in a final state
 */
export const isMessageInFinalState = (message: Message): boolean => {
  return [
    MessageStatus.DELIVERED,
    MessageStatus.READ,
    MessageStatus.FAILED,
    MessageStatus.CANCELLED
  ].includes(message.status);
};