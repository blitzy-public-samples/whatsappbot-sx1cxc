// @version React ^18.2.0
import { CSSProperties } from 'react';

/**
 * Enum representing different loading states for components and operations
 */
export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * Enum for standardized component size variants
 */
export enum Size {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE'
}

/**
 * Enum for component visual and semantic variants
 */
export enum Variant {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * Enum for responsive design breakpoints
 */
export enum Breakpoint {
  XS = 'XS',
  SM = 'SM',
  MD = 'MD',
  LG = 'LG',
  XL = 'XL'
}

/**
 * Constant values for breakpoints in pixels
 */
export const BREAKPOINT_VALUES = {
  XS: 0,
  SM: 600,
  MD: 960,
  LG: 1280,
  XL: 1920
} as const;

/**
 * Base interface for common component properties
 */
export interface BaseComponentProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional inline styles */
  style?: CSSProperties;
  /** Optional unique identifier */
  id?: string;
  /** Optional test identifier for testing */
  testId?: string;
  /** Optional aria label for accessibility */
  ariaLabel?: string;
}

/**
 * Interface for components with loading states and error handling
 */
export interface LoadableComponentProps {
  /** Current loading state of the component */
  loadingState: LoadingState;
  /** Error message if any */
  error: string | null;
  /** Callback function to retry failed operations */
  onRetry: () => void;
}

/**
 * Enum for consistent date formatting options
 */
export enum DateFormat {
  SHORT = 'SHORT',
  MEDIUM = 'MEDIUM',
  LONG = 'LONG',
  ISO = 'ISO'
}

/**
 * Type guard utility to check if a value is null or undefined
 * @param value - Value to check
 * @returns True if value is null or undefined, false otherwise
 */
export const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

/**
 * Type for responsive values based on breakpoints
 */
export type ResponsiveValue<T> = {
  [key in Breakpoint]?: T;
};

/**
 * Type for component event handlers with generic event type
 */
export type EventHandler<E = Event> = (event: E) => void;

/**
 * Type for async component event handlers with generic event type
 */
export type AsyncEventHandler<E = Event> = (event: E) => Promise<void>;

/**
 * Type for component children with optional loading state
 */
export type LoadableChildren = {
  children: React.ReactNode;
  loadingState?: LoadingState;
};

/**
 * Type for component ref objects
 */
export type ComponentRef<T = HTMLElement> = React.RefObject<T>;

/**
 * Type for component style maps
 */
export type StyleMap = Record<string, CSSProperties>;

/**
 * Type for component class name maps
 */
export type ClassNameMap = Record<string, string>;

/**
 * Type for component validation states
 */
export type ValidationState = 'valid' | 'invalid' | 'warning' | undefined;

/**
 * Type for component orientation
 */
export type Orientation = 'horizontal' | 'vertical';

/**
 * Type for component alignment
 */
export type Alignment = 'start' | 'center' | 'end' | 'stretch';

/**
 * Type for component justification
 */
export type Justification = 'start' | 'center' | 'end' | 'space-between' | 'space-around';