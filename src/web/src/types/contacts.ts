import { ApiResponse, PaginatedResponse, PaginationParams } from './api';
import { LoadingState, BaseComponentProps } from './common';

/**
 * Interface representing a contact in the system
 */
export interface Contact {
  /** Unique identifier for the contact */
  id: string;
  
  /** Contact's phone number in E.164 format */
  phoneNumber: string;
  
  /** Contact's first name */
  firstName: string;
  
  /** Contact's last name */
  lastName: string;
  
  /** Contact's email address */
  email: string;
  
  /** Additional metadata for the contact */
  metadata: Record<string, unknown>;
  
  /** Array of tags associated with the contact */
  tags: string[];
  
  /** Indicates if the contact is active */
  isActive: boolean;
  
  /** Contact creation timestamp */
  createdAt: string;
  
  /** Last update timestamp */
  updatedAt: string;
  
  /** Last contacted timestamp */
  lastContactedAt: string;
  
  /** Organization ID the contact belongs to */
  organizationId: string;
  
  /** Array of group IDs the contact belongs to */
  groupIds: string[];
  
  /** Contact's preferred language */
  preferredLanguage: string;
  
  /** Contact's timezone */
  timezone: string;
  
  /** Custom fields for the contact */
  customFields: Record<string, unknown>;
  
  /** Contact's messaging consent status */
  consentStatus: boolean;
  
  /** ID of the last message sent to/received from this contact */
  lastMessageId: string;
}

/**
 * Interface representing a contact group
 */
export interface ContactGroup {
  /** Unique identifier for the group */
  id: string;
  
  /** Group name */
  name: string;
  
  /** Group description */
  description: string;
  
  /** Number of contacts in the group */
  contactCount: number;
  
  /** Group creation timestamp */
  createdAt: string;
  
  /** Last update timestamp */
  updatedAt: string;
  
  /** Organization ID the group belongs to */
  organizationId: string;
  
  /** Additional metadata for the group */
  metadata: Record<string, unknown>;
  
  /** Indicates if the group is archived */
  isArchived: boolean;
  
  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Type for paginated contact list responses
 */
export type ContactListResponse = PaginatedResponse<Contact>;

/**
 * Type for paginated contact group list responses
 */
export type ContactGroupListResponse = PaginatedResponse<ContactGroup>;

/**
 * Interface for contact form data used in create/update operations
 */
export interface ContactFormData {
  /** Contact's phone number */
  phoneNumber: string;
  
  /** Contact's first name */
  firstName: string;
  
  /** Contact's last name */
  lastName: string;
  
  /** Contact's email address */
  email: string;
  
  /** Array of tags to assign to the contact */
  tags: string[];
  
  /** Array of group IDs to assign the contact to */
  groupIds: string[];
}

/**
 * Interface for contact list component props
 */
export interface ContactListProps extends BaseComponentProps {
  /** Array of contacts to display */
  contacts: Contact[];
  
  /** Callback function when a contact is selected */
  onSelect: (contact: Contact) => void;
  
  /** Callback function when a contact is deleted */
  onDelete: (id: string) => void;
  
  /** Current loading state of the contact list */
  loadingState: LoadingState;
}

/**
 * Interface for contact import options
 */
export interface ContactImportOptions {
  /** File format for import */
  format: 'csv' | 'xlsx' | 'json';
  
  /** Whether to skip existing contacts */
  skipExisting: boolean;
  
  /** Field mappings for import */
  fieldMappings: Record<string, string>;
  
  /** Default values for unmapped fields */
  defaultValues: Partial<Contact>;
}

/**
 * Interface for contact export options
 */
export interface ContactExportOptions {
  /** File format for export */
  format: 'csv' | 'xlsx' | 'json';
  
  /** Fields to include in export */
  fields: (keyof Contact)[];
  
  /** Whether to include group information */
  includeGroups: boolean;
  
  /** Whether to include message history */
  includeMessageHistory: boolean;
}

/**
 * Interface for contact search parameters
 */
export interface ContactSearchParams extends PaginationParams {
  /** Search query string */
  query: string;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Filter by groups */
  groupIds?: string[];
  
  /** Filter by activity date range */
  activityRange?: {
    start: string;
    end: string;
  };
  
  /** Filter by consent status */
  consentStatus?: boolean;
}

/**
 * Type for contact batch operation response
 */
export type ContactBatchResponse = ApiResponse<{
  /** Number of successful operations */
  successful: number;
  
  /** Number of failed operations */
  failed: number;
  
  /** Array of failed contact IDs */
  failedIds: string[];
  
  /** Error details for failed operations */
  errors: Record<string, string>;
}>;