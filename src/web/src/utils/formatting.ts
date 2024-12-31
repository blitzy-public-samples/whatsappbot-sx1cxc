// @version date-fns ^2.30.0
// @version libphonenumber-js ^1.10.45

import { format as dateFnsFormat, isValid, parseISO } from 'date-fns';
import { parsePhoneNumber, CountryCode, PhoneNumber } from 'libphonenumber-js';
import { DateFormat } from '../types/common';

/**
 * Supported locales for date formatting
 */
const SUPPORTED_LOCALES = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Date format patterns mapping
 */
const DATE_FORMAT_PATTERNS: Record<DateFormat, string> = {
  [DateFormat.SHORT]: 'MM/dd/yyyy',
  [DateFormat.MEDIUM]: 'MMM dd, yyyy',
  [DateFormat.LONG]: 'MMMM dd, yyyy, HH:mm:ss',
  [DateFormat.ISO]: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
};

/**
 * Error messages for formatting functions
 */
const ERROR_MESSAGES = {
  INVALID_DATE: 'Invalid date provided',
  INVALID_LOCALE: 'Unsupported locale',
  INVALID_PHONE: 'Invalid phone number',
  INVALID_COUNTRY: 'Invalid country code'
} as const;

/**
 * Type guard to check if a locale is supported
 * @param locale - Locale string to check
 */
const isSupportedLocale = (locale: string): locale is SupportedLocale => {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
};

/**
 * Memoization decorator for expensive formatting operations
 */
function memoize<T extends (...args: any[]) => any>(
  target: T,
  context: ClassMethodDecoratorContext
) {
  const cache = new Map<string, ReturnType<T>>();
  
  return function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = target.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Input validation decorator
 */
function validateInput(
  target: any,
  context: ClassMethodDecoratorContext
) {
  return function (...args: any[]) {
    if (args.some(arg => arg === undefined || arg === null)) {
      throw new Error('Required parameters cannot be null or undefined');
    }
    return target.apply(this, args);
  };
}

/**
 * Formats a date according to the specified format with locale support
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param formatType - Desired format type from DateFormat enum
 * @param locale - Locale for formatting (defaults to en-US)
 * @returns Formatted date string with ARIA attributes
 * @throws Error if date is invalid or locale is not supported
 */
@memoize
@validateInput
export function formatDate(
  date: Date | string | number,
  formatType: DateFormat = DateFormat.MEDIUM,
  locale: string = 'en-US'
): string {
  // Validate locale
  if (!isSupportedLocale(locale)) {
    throw new Error(ERROR_MESSAGES.INVALID_LOCALE);
  }

  // Convert input to Date object
  const dateObj = date instanceof Date 
    ? date 
    : typeof date === 'string' 
      ? parseISO(date)
      : new Date(date);

  // Validate date
  if (!isValid(dateObj)) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }

  // Get format pattern
  const pattern = DATE_FORMAT_PATTERNS[formatType];

  // Format date with locale support
  const formattedDate = dateFnsFormat(dateObj, pattern, { locale });

  // Add ARIA attributes for accessibility
  return `<time datetime="${dateObj.toISOString()}" aria-label="${formattedDate}">${formattedDate}</time>`;
}

/**
 * Interface for phone number formatting options
 */
interface PhoneNumberFormatOptions {
  international?: boolean;
  formatExtension?: boolean;
  spaces?: 'narrow' | 'wide';
}

/**
 * Formats a phone number according to international standards
 * @param phoneNumber - Phone number string to format
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param options - Formatting options
 * @returns Formatted phone number string
 * @throws Error if phone number or country code is invalid
 */
@validateInput
export function formatPhoneNumber(
  phoneNumber: string,
  countryCode: string,
  options: PhoneNumberFormatOptions = {}
): string {
  const {
    international = true,
    formatExtension = true,
    spaces = 'narrow'
  } = options;

  try {
    // Parse phone number
    const parsedNumber = parsePhoneNumber(phoneNumber, countryCode as CountryCode);

    if (!parsedNumber?.isValid()) {
      throw new Error(ERROR_MESSAGES.INVALID_PHONE);
    }

    // Format with specified options
    const formattedNumber = international
      ? parsedNumber.formatInternational()
      : parsedNumber.formatNational();

    // Handle extension formatting
    const extension = formatExtension && parsedNumber.ext
      ? ` ext. ${parsedNumber.ext}`
      : '';

    // Apply spacing
    const spacedNumber = spaces === 'wide'
      ? formattedNumber.replace(/(\d{2})/g, '$1 ').trim()
      : formattedNumber;

    // Add ARIA label for accessibility
    return `<span aria-label="Phone number: ${spacedNumber}${extension}">${spacedNumber}${extension}</span>`;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(ERROR_MESSAGES.INVALID_PHONE);
  }
}

/**
 * Formats a number for display with locale support
 * @param value - Number to format
 * @param locale - Locale for formatting
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 */
@memoize
export function formatNumber(
  value: number,
  locale: string = 'en-US',
  options: Intl.NumberFormatOptions = {}
): string {
  if (!isSupportedLocale(locale)) {
    throw new Error(ERROR_MESSAGES.INVALID_LOCALE);
  }

  const formatter = new Intl.NumberFormat(locale, options);
  const formattedValue = formatter.format(value);

  return `<span aria-label="Number: ${formattedValue}">${formattedValue}</span>`;
}

/**
 * Formats a percentage for display with locale support
 * @param value - Percentage value (0-100)
 * @param locale - Locale for formatting
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
@memoize
export function formatPercentage(
  value: number,
  locale: string = 'en-US',
  decimals: number = 1
): string {
  return formatNumber(value, locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formats currency values with locale support
 * @param value - Currency amount
 * @param currency - ISO 4217 currency code
 * @param locale - Locale for formatting
 * @returns Formatted currency string
 */
@memoize
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return formatNumber(value, locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  });
}