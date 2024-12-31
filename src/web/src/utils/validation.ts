// External dependencies
// yup: ^1.2.0 - Schema-based validation library for type-safe validation
import * as yup from 'yup';
// libphonenumber-js: ^1.10.0 - International phone number validation
import { isValidPhoneNumber } from 'libphonenumber-js';
// sanitize-html: ^2.11.0 - HTML sanitization for user inputs
import sanitizeHtml from 'sanitize-html';

// Global validation constants
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const MAX_SCHEDULE_DAYS = 30;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MAX_MESSAGE_LENGTH = 4096;
const MAX_TEMPLATE_LENGTH = 2048;
const MAX_ATTACHMENTS = 10;
const ALLOWED_FILE_TYPES = ['.jpg', '.png', '.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE = 16777216; // 16MB in bytes

// Contact validation schema
export const contactValidationSchema = yup.object().shape({
  phoneNumber: yup
    .string()
    .required('Phone number is required')
    .matches(PHONE_REGEX, 'Invalid phone number format')
    .test('phone', 'Invalid phone number', (value) => {
      if (!value) return false;
      return isValidPhoneNumber(value);
    }),
  firstName: yup
    .string()
    .required('First name is required')
    .min(MIN_NAME_LENGTH, `First name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `First name must not exceed ${MAX_NAME_LENGTH} characters`)
    .transform((value) => sanitizeHtml(value)),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(MIN_NAME_LENGTH, `Last name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Last name must not exceed ${MAX_NAME_LENGTH} characters`)
    .transform((value) => sanitizeHtml(value)),
  email: yup
    .string()
    .required('Email is required')
    .matches(EMAIL_REGEX, 'Invalid email format')
    .transform((value) => value.toLowerCase()),
  groups: yup
    .array()
    .of(yup.string())
    .nullable(),
  tags: yup
    .array()
    .of(yup.string())
    .nullable()
});

// Message validation schema
export const messageValidationSchema = yup.object().shape({
  templateId: yup
    .string()
    .nullable()
    .when('messageBody', {
      is: (messageBody: string) => !messageBody,
      then: yup.string().required('Either template or message body is required')
    }),
  recipients: yup
    .array()
    .of(yup.string().matches(PHONE_REGEX, 'Invalid recipient phone number'))
    .min(1, 'At least one recipient is required')
    .required('Recipients are required'),
  messageBody: yup
    .string()
    .nullable()
    .when('templateId', {
      is: (templateId: string) => !templateId,
      then: yup
        .string()
        .required('Either template or message body is required')
        .max(MAX_MESSAGE_LENGTH, `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`)
        .transform((value) => sanitizeHtml(value))
    }),
  scheduledTime: yup
    .date()
    .nullable()
    .min(new Date(), 'Scheduled time must be in the future')
    .max(
      new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000),
      `Cannot schedule more than ${MAX_SCHEDULE_DAYS} days in advance`
    ),
  attachments: yup
    .array()
    .of(
      yup.object().shape({
        name: yup.string().required('File name is required'),
        type: yup
          .string()
          .oneOf(ALLOWED_FILE_TYPES, 'Invalid file type')
          .required('File type is required'),
        size: yup
          .number()
          .max(MAX_FILE_SIZE, 'File size exceeds maximum allowed')
          .required('File size is required')
      })
    )
    .max(MAX_ATTACHMENTS, `Maximum ${MAX_ATTACHMENTS} attachments allowed`),
  variables: yup.object().nullable()
});

// Template validation schema
export const templateValidationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Template name is required')
    .min(MIN_NAME_LENGTH, `Template name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Template name must not exceed ${MAX_NAME_LENGTH} characters`)
    .transform((value) => sanitizeHtml(value)),
  content: yup
    .string()
    .required('Template content is required')
    .max(MAX_TEMPLATE_LENGTH, `Template must not exceed ${MAX_TEMPLATE_LENGTH} characters`)
    .transform((value) => sanitizeHtml(value)),
  variables: yup
    .array()
    .of(
      yup.object().shape({
        name: yup.string().required('Variable name is required'),
        type: yup.string().required('Variable type is required'),
        required: yup.boolean().default(false)
      })
    ),
  category: yup
    .string()
    .required('Template category is required'),
  isActive: yup
    .boolean()
    .default(true)
});

/**
 * Validates international phone numbers with country code support
 * @param phoneNumber - Phone number to validate
 * @param countryCode - Optional country code for specific validation
 * @returns boolean indicating if phone number is valid
 */
export const validatePhoneNumber = (
  phoneNumber: string,
  countryCode?: string
): boolean => {
  try {
    const sanitizedNumber = phoneNumber.trim().replace(/\s+/g, '');
    if (!PHONE_REGEX.test(sanitizedNumber)) {
      return false;
    }
    return isValidPhoneNumber(sanitizedNumber, countryCode);
  } catch {
    return false;
  }
};

/**
 * Validates email addresses with comprehensive format checking
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      return false;
    }
    const [, domain] = sanitizedEmail.split('@');
    // Additional domain validation could be added here
    return domain.length > 0;
  } catch {
    return false;
  }
};

/**
 * Validates message scheduling time with timezone support
 * @param scheduledTime - Scheduled time for message delivery
 * @param timezone - Target timezone for delivery
 * @returns boolean indicating if scheduled time is valid
 */
export const validateScheduledTime = (
  scheduledTime: Date,
  timezone: string
): boolean => {
  try {
    const currentTime = new Date();
    const maxScheduleTime = new Date(
      currentTime.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000
    );

    if (scheduledTime <= currentTime) {
      return false;
    }

    if (scheduledTime > maxScheduleTime) {
      return false;
    }

    // Additional timezone-specific validation could be added here
    return true;
  } catch {
    return false;
  }
};