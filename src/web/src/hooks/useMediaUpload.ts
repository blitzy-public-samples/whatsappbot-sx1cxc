// @package react ^18.2.0
// @package axios ^1.6.0

import { useState, useCallback, useRef } from 'react';
import { AxiosProgressEvent, CancelTokenSource } from 'axios';
import apiClient, { API_ENDPOINTS } from '../../config/api';
import { handleApiError } from '../../utils/errorHandling';

// File type validation constants
const ALLOWED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  AUDIO: ['audio/mp3', 'audio/wav', 'audio/ogg']
};

// File size limits in bytes
const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 16 * 1024 * 1024, // 16MB
  AUDIO: 16 * 1024 * 1024 // 16MB
};

/**
 * Interface for file validation result
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Interface for upload hook return type
 */
interface UseMediaUploadReturn {
  uploadFile: (file: File) => Promise<string>;
  cancelUpload: () => void;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

/**
 * Custom hook for handling media file uploads with progress tracking and validation
 * @returns Object containing upload functions and state
 */
export function useMediaUpload(): UseMediaUploadReturn {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const cancelTokenRef = useRef<CancelTokenSource | null>(null);

  /**
   * Validates file type, size, and format
   * @param file File to validate
   * @returns Validation result with error message if invalid
   */
  const validateFile = async (file: File): Promise<ValidationResult> => {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    // Check file type
    const fileType = Object.entries(ALLOWED_FILE_TYPES).find(([_, types]) =>
      types.includes(file.type)
    );

    if (!fileType) {
      return {
        isValid: false,
        error: 'Unsupported file type. Please upload a valid image, document, or audio file.'
      };
    }

    // Check file size
    const [category] = fileType;
    if (file.size > MAX_FILE_SIZES[category as keyof typeof MAX_FILE_SIZES]) {
      return {
        isValid: false,
        error: `File size exceeds the maximum limit of ${MAX_FILE_SIZES[category as keyof typeof MAX_FILE_SIZES] / (1024 * 1024)}MB`
      };
    }

    // Additional format-specific validation
    if (category === 'IMAGE') {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ isValid: true });
        img.onerror = () => resolve({
          isValid: false,
          error: 'Invalid image format or corrupted file'
        });
        img.src = URL.createObjectURL(file);
      });
    }

    return { isValid: true };
  };

  /**
   * Handles file upload with progress tracking and cancellation support
   * @param file File to upload
   * @returns Promise resolving to uploaded file URL
   */
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      setError(null);
      setProgress(0);
      setIsUploading(true);

      // Validate file before upload
      const validation = await validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type);
      formData.append('name', file.name);

      // Create cancel token
      cancelTokenRef.current = apiClient.CancelToken.source();

      // Configure upload request
      const response = await apiClient.post(
        `${API_ENDPOINTS.MESSAGES.BASE}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          cancelToken: cancelTokenRef.current.token,
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setProgress(percentCompleted);
          }
        }
      );

      return response.data.url;
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsUploading(false);
      cancelTokenRef.current = null;
    }
  }, []);

  /**
   * Cancels ongoing upload if any
   */
  const cancelUpload = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Upload cancelled by user');
      cancelTokenRef.current = null;
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  return {
    uploadFile,
    cancelUpload,
    isUploading,
    progress,
    error
  };
}

export default useMediaUpload;
```

This implementation provides a comprehensive solution for handling media file uploads in the WhatsApp Web Enhancement Application. Here are the key features:

1. **Type Safety**: Fully typed with TypeScript for better development experience and error prevention.

2. **File Validation**:
   - Validates file types against allowed MIME types
   - Enforces size limits based on file category
   - Additional format-specific validation for images

3. **Progress Tracking**:
   - Real-time upload progress monitoring
   - Progress percentage calculation and state management

4. **Error Handling**:
   - Comprehensive error handling with API error integration
   - User-friendly error messages
   - Error state management

5. **Upload Cancellation**:
   - Support for cancelling ongoing uploads
   - Cleanup of resources after cancellation

6. **State Management**:
   - Upload status tracking
   - Progress percentage
   - Error state
   - Loading state

The hook follows React best practices and integrates with the application's API client and error handling utilities. It's designed to be reusable across different components that need file upload functionality.

Usage example:
```typescript
const { uploadFile, cancelUpload, isUploading, progress, error } = useMediaUpload();

// In your component
const handleFileUpload = async (file: File) => {
  try {
    const fileUrl = await uploadFile(file);
    console.log('File uploaded successfully:', fileUrl);
  } catch (err) {
    console.error('Upload failed:', err);
  }
};