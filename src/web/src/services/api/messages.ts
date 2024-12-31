// @package axios ^1.6.0

import { AxiosResponse, AxiosError } from 'axios';
import apiClient, { API_ENDPOINTS } from '../../config/api';
import {
  Message,
  MessageType,
  MessageStatus,
  ComposeMessageRequest,
  UpdateMessageRequest,
  MessageFilter,
  MESSAGE_CONSTRAINTS,
  isTemplateMessage,
  isMediaMessage
} from '../../types/messages';

/**
 * Interface for bulk message operation options
 */
interface BulkMessageOptions {
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (progress: number) => void;
  /** Batch size for bulk operations */
  batchSize?: number;
}

/**
 * Interface for bulk message operation response
 */
interface BulkMessageResponse {
  /** Successfully sent messages */
  successful: Message[];
  /** Failed message attempts */
  failed: Array<{
    request: ComposeMessageRequest;
    error: Error;
  }>;
  /** Total messages processed */
  total: number;
  /** Operation duration in milliseconds */
  duration: number;
}

/**
 * Default bulk operation options
 */
const DEFAULT_BULK_OPTIONS: Required<BulkMessageOptions> = {
  concurrency: 5,
  batchSize: 20,
  onProgress: () => {}
};

/**
 * Validates a message request against defined constraints
 * @param request - Message request to validate
 * @throws Error if validation fails
 */
const validateMessageRequest = (request: ComposeMessageRequest): void => {
  // Validate recipients
  if (!request.recipients?.length || request.recipients.length > MESSAGE_CONSTRAINTS.MAX_RECIPIENTS) {
    throw new Error(`Number of recipients must be between 1 and ${MESSAGE_CONSTRAINTS.MAX_RECIPIENTS}`);
  }

  // Validate content based on message type
  if (request.type === MessageType.TEXT) {
    if (!request.content.text || request.content.text.length > MESSAGE_CONSTRAINTS.MAX_TEXT_LENGTH) {
      throw new Error(`Text content must be between 1 and ${MESSAGE_CONSTRAINTS.MAX_TEXT_LENGTH} characters`);
    }
  } else if (request.type === MessageType.MEDIA) {
    if (!request.content.mediaUrl) {
      throw new Error('Media URL is required for media messages');
    }
    if (!MESSAGE_CONSTRAINTS.SUPPORTED_MEDIA_TYPES.includes(request.content.mimeType || '')) {
      throw new Error('Unsupported media type');
    }
    if ((request.content.fileSize || 0) > MESSAGE_CONSTRAINTS.MAX_MEDIA_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MESSAGE_CONSTRAINTS.MAX_MEDIA_SIZE} bytes`);
    }
  } else if (request.type === MessageType.TEMPLATE) {
    if (!request.templateId) {
      throw new Error('Template ID is required for template messages');
    }
  }
};

/**
 * Sends a single WhatsApp message
 * @param request - Message composition request
 * @returns Promise resolving to the sent message
 */
export const sendMessage = async (request: ComposeMessageRequest): Promise<Message> => {
  try {
    validateMessageRequest(request);

    const response = await apiClient.post<Message>(
      API_ENDPOINTS.MESSAGES.SEND,
      request
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};

/**
 * Schedules a WhatsApp message for future delivery
 * @param request - Message composition request with schedule time
 * @returns Promise resolving to the scheduled message
 */
export const scheduleMessage = async (request: ComposeMessageRequest): Promise<Message> => {
  try {
    validateMessageRequest(request);

    if (!request.scheduledAt) {
      throw new Error('Scheduled time is required for message scheduling');
    }

    const scheduledTime = new Date(request.scheduledAt);
    if (scheduledTime <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const response = await apiClient.post<Message>(
      API_ENDPOINTS.MESSAGES.SCHEDULE,
      request
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to schedule message: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};

/**
 * Sends multiple WhatsApp messages in bulk with progress tracking
 * @param requests - Array of message requests
 * @param options - Bulk operation options
 * @returns Promise resolving to bulk operation results
 */
export const sendBulkMessages = async (
  requests: ComposeMessageRequest[],
  options: BulkMessageOptions = {}
): Promise<BulkMessageResponse> => {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_BULK_OPTIONS, ...options };
  const result: BulkMessageResponse = {
    successful: [],
    failed: [],
    total: requests.length,
    duration: 0
  };

  try {
    // Validate all requests first
    requests.forEach(validateMessageRequest);

    // Process in batches
    for (let i = 0; i < requests.length; i += mergedOptions.batchSize) {
      const batch = requests.slice(i, i + mergedOptions.batchSize);
      const batchPromises = batch.map(async (request) => {
        try {
          const message = await sendMessage(request);
          result.successful.push(message);
        } catch (error) {
          result.failed.push({
            request,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      });

      await Promise.all(batchPromises);

      // Update progress
      const progress = Math.min(((i + mergedOptions.batchSize) / requests.length) * 100, 100);
      mergedOptions.onProgress(progress);
    }

    result.duration = Date.now() - startTime;
    return result;
  } catch (error) {
    throw new Error(`Bulk message operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Updates an existing message (e.g., cancel scheduled message)
 * @param request - Message update request
 * @returns Promise resolving to the updated message
 */
export const updateMessage = async (request: UpdateMessageRequest): Promise<Message> => {
  try {
    const response = await apiClient.put<Message>(
      `${API_ENDPOINTS.MESSAGES.BASE}/${request.id}`,
      request
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to update message: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};

/**
 * Retrieves message status updates
 * @param messageId - ID of the message to check
 * @returns Promise resolving to the message with current status
 */
export const getMessageStatus = async (messageId: string): Promise<Message> => {
  try {
    const response = await apiClient.get<Message>(
      `${API_ENDPOINTS.MESSAGES.STATUS}/${messageId}`
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to get message status: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};