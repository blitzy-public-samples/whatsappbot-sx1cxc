/**
 * @fileoverview Storage utility module for managing browser storage operations with type safety,
 * encryption for sensitive data, and comprehensive error handling.
 * @version 1.0.0
 * @license MIT
 */

import { AUTH_CONFIG } from '../config/constants';
import CryptoJS from 'crypto-js'; // @version ^4.1.1

/**
 * Interface for storage service configuration options
 */
interface StorageOptions {
  encryptionKey?: string;
  quotaLimit?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Interface for storage operation result
 */
interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Custom error types for storage operations
 */
class StorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Constants for storage operations
 */
const STORAGE_CONSTANTS = {
  TEST_KEY: '__storage_test__',
  DEFAULT_QUOTA: 5 * 1024 * 1024, // 5MB
  DEFAULT_RETRIES: 3,
  DEFAULT_RETRY_DELAY: 1000,
  ENCRYPTION_PREFIX: 'encrypted:',
} as const;

/**
 * Checks if browser storage is available and functioning
 * @param type - Storage type to check
 * @returns Promise resolving to boolean indicating storage availability
 */
export async function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): Promise<boolean> {
  try {
    const storage = window[type];
    const testKey = STORAGE_CONSTANTS.TEST_KEY;
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Service class for managing browser storage operations with type safety and encryption
 */
export class StorageService {
  private storage: Storage;
  private encryptionKey: string;
  private maxRetries: number;
  private quotaLimit: number;
  private retryDelay: number;

  /**
   * Creates an instance of StorageService
   * @param storageType - Type of storage to use
   * @param options - Configuration options
   */
  constructor(
    storageType: 'local' | 'session' = 'local',
    options: StorageOptions = {}
  ) {
    this.storage = storageType === 'local' ? window.localStorage : window.sessionStorage;
    this.encryptionKey = options.encryptionKey || AUTH_CONFIG.ENCRYPTION_KEY;
    this.maxRetries = options.maxRetries || STORAGE_CONSTANTS.DEFAULT_RETRIES;
    this.quotaLimit = options.quotaLimit || STORAGE_CONSTANTS.DEFAULT_QUOTA;
    this.retryDelay = options.retryDelay || STORAGE_CONSTANTS.DEFAULT_RETRY_DELAY;

    if (!this.storage) {
      throw new StorageError('Storage is not available', 'STORAGE_UNAVAILABLE');
    }
  }

  /**
   * Encrypts data using AES encryption
   * @param data - Data to encrypt
   * @returns Encrypted string
   */
  private encrypt(data: string): string {
    if (!this.encryptionKey) {
      throw new StorageError('Encryption key is not configured', 'ENCRYPTION_KEY_MISSING');
    }
    return STORAGE_CONSTANTS.ENCRYPTION_PREFIX + CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  /**
   * Decrypts encrypted data
   * @param encryptedData - Data to decrypt
   * @returns Decrypted string
   */
  private decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new StorageError('Encryption key is not configured', 'ENCRYPTION_KEY_MISSING');
    }
    if (!encryptedData.startsWith(STORAGE_CONSTANTS.ENCRYPTION_PREFIX)) {
      return encryptedData;
    }
    const encryptedString = encryptedData.slice(STORAGE_CONSTANTS.ENCRYPTION_PREFIX.length);
    return CryptoJS.AES.decrypt(encryptedString, this.encryptionKey).toString(CryptoJS.enc.Utf8);
  }

  /**
   * Stores a value in storage with optional encryption
   * @param key - Storage key
   * @param value - Value to store
   * @param encrypt - Whether to encrypt the value
   * @returns Promise resolving to storage operation result
   */
  async setItem<T>(key: string, value: T, encrypt = false): Promise<StorageResult<void>> {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const serializedValue = JSON.stringify(value);
        const storedValue = encrypt ? this.encrypt(serializedValue) : serializedValue;
        
        if (this.getSize() + storedValue.length > this.quotaLimit) {
          throw new StorageError('Storage quota exceeded', 'QUOTA_EXCEEDED');
        }

        this.storage.setItem(key, storedValue);
        return { success: true };
      } catch (error) {
        retries++;
        if (retries === this.maxRetries) {
          return {
            success: false,
            error: new StorageError(
              `Failed to set item after ${this.maxRetries} attempts`,
              'SET_ITEM_FAILED'
            )
          };
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    return { success: false, error: new StorageError('Unexpected error', 'UNKNOWN_ERROR') };
  }

  /**
   * Retrieves a value from storage with automatic decryption if needed
   * @param key - Storage key
   * @returns Promise resolving to storage operation result
   */
  async getItem<T>(key: string): Promise<StorageResult<T | null>> {
    try {
      const value = this.storage.getItem(key);
      
      if (value === null) {
        return { success: true, data: null };
      }

      const decryptedValue = value.startsWith(STORAGE_CONSTANTS.ENCRYPTION_PREFIX)
        ? this.decrypt(value)
        : value;

      return { success: true, data: JSON.parse(decryptedValue) as T };
    } catch (error) {
      return {
        success: false,
        error: new StorageError('Failed to get item', 'GET_ITEM_FAILED')
      };
    }
  }

  /**
   * Removes an item from storage
   * @param key - Storage key
   * @returns Promise resolving to storage operation result
   */
  async removeItem(key: string): Promise<StorageResult<void>> {
    try {
      this.storage.removeItem(key);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: new StorageError('Failed to remove item', 'REMOVE_ITEM_FAILED')
      };
    }
  }

  /**
   * Clears all items from storage
   * @returns Promise resolving to storage operation result
   */
  async clear(): Promise<StorageResult<void>> {
    try {
      this.storage.clear();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: new StorageError('Failed to clear storage', 'CLEAR_STORAGE_FAILED')
      };
    }
  }

  /**
   * Checks if an item exists in storage
   * @param key - Storage key
   * @returns Promise resolving to boolean indicating item existence
   */
  async hasItem(key: string): Promise<boolean> {
    return this.storage.getItem(key) !== null;
  }

  /**
   * Gets the current size of storage in bytes
   * @returns Current storage size in bytes
   */
  getSize(): number {
    let size = 0;
    for (const key in this.storage) {
      if (this.storage.hasOwnProperty(key)) {
        size += (key.length + this.storage.getItem(key)?.length || 0) * 2;
      }
    }
    return size;
  }
}

// Export default instance for common usage
export default new StorageService('local', {
  encryptionKey: AUTH_CONFIG.ENCRYPTION_KEY,
});