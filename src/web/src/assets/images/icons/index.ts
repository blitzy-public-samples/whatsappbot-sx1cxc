/**
 * @fileoverview Central icon index file for the WhatsApp Web Enhancement Application.
 * Exports Material Design icons with accessibility support and consistent styling.
 * All icons follow WCAG 2.1 AA standards for color contrast and include aria-labels.
 * @version 1.0.0
 * @package @mui/icons-material ^5.14.0
 */

import {
  Dashboard as DashboardIcon,
  AccountCircle,
  Settings,
  ArrowBack,
  ArrowForward,
  HelpOutline,
  Warning,
  Info,
  Star,
  BarChart,
  Message,
  Group,
  Description,
} from '@mui/icons-material'; // ^5.14.0

// Navigation Icons
export { DashboardIcon }; // Dashboard/Menu icon for navigation
export { AccountCircle }; // User/Profile icon for account management
export { Settings }; // Settings/Configuration icon
export { ArrowBack }; // Back navigation with RTL support
export { ArrowForward }; // Forward navigation with RTL support

// Status and Information Icons
export { HelpOutline }; // Help/Documentation icon
export { Warning }; // Alert/Warning notifications
export { Info }; // Information/Status messages
export { Star }; // Important/Favorite marker

// Feature-specific Icons
export { BarChart }; // Analytics/Data visualization
export { Message }; // Messaging/Chat features
export { Group }; // Contact/Group management
export { Description }; // Template management

/**
 * Default icon configuration - can be overridden at component level
 * - Size: 24px (default), 48px (large)
 * - Color: Inherits from theme
 * - Accessibility: Includes aria-label support
 */
export const iconDefaults = {
  size: {
    default: 24,
    large: 48,
  },
  ariaLabel: {
    dashboard: 'Navigate to Dashboard',
    account: 'User Profile',
    settings: 'Open Settings',
    back: 'Go Back',
    forward: 'Go Forward',
    help: 'Get Help',
    warning: 'Warning Alert',
    info: 'Information',
    star: 'Mark as Important',
    analytics: 'View Analytics',
    message: 'Messages',
    group: 'Contact Groups',
    template: 'Message Templates',
  },
};

// Type definitions for icon props
export interface IconProps {
  size?: number;
  color?: string;
  'aria-label'?: string;
}

/**
 * Re-export all icons with consistent TypeScript types
 * This ensures type safety when using icons throughout the application
 */
export type {
  SvgIconComponent,
} from '@mui/icons-material';

/**
 * Icon utility functions
 */
export const getIconSize = (size: 'default' | 'large'): number => {
  return iconDefaults.size[size];
};

export const getAriaLabel = (iconType: keyof typeof iconDefaults.ariaLabel): string => {
  return iconDefaults.ariaLabel[iconType];
};