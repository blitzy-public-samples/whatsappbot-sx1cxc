import React, { useCallback, KeyboardEvent } from 'react';
import {
  CardContainer,
  CardHeader,
  CardContent,
  CardFooter
} from './styles';

/**
 * Interface for Card component props with comprehensive accessibility and styling options
 */
interface CardProps {
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Material Design elevation level (1-5) */
  elevation?: number;
  /** Card padding size variant */
  size?: 'small' | 'medium' | 'large';
  /** Optional header content with proper heading structure */
  header?: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Optional click handler for interactive cards */
  onClick?: () => void;
  /** Optional CSS class name for additional styling */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
  /** Optional variant for card styling */
  variant?: 'default' | 'outlined';
  /** Flag to disable the card */
  disabled?: boolean;
  /** Flag for right-to-left support */
  isRTL?: boolean;
  /** Flag for dark mode support */
  isDarkMode?: boolean;
  /** Flag to remove padding */
  noPadding?: boolean;
}

/**
 * A flexible Material Design card component with enhanced features including
 * accessibility support, dark mode, RTL, and interactive states.
 *
 * @version 1.0.0
 * @component
 */
const Card: React.FC<CardProps> = React.memo(({
  children,
  elevation = 1,
  size = 'medium',
  header,
  footer,
  onClick,
  className,
  role = 'article',
  tabIndex,
  variant = 'default',
  disabled = false,
  isRTL = false,
  isDarkMode = false,
  noPadding = false
}) => {
  /**
   * Handles keyboard interactions for accessibility
   */
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  }, [onClick]);

  /**
   * Determines if the card is interactive
   */
  const isInteractive = Boolean(onClick) && !disabled;

  /**
   * Computes ARIA attributes based on card properties
   */
  const getAriaAttributes = () => {
    const ariaAttributes: { [key: string]: string | boolean } = {
      role: role,
      'aria-disabled': disabled
    };

    if (isInteractive) {
      ariaAttributes['aria-role'] = 'button';
    }

    return ariaAttributes;
  };

  return (
    <CardContainer
      className={className}
      elevation={elevation}
      size={size}
      onClick={!disabled ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
      isDarkMode={isDarkMode}
      isRTL={isRTL}
      disabled={disabled}
      {...getAriaAttributes()}
    >
      {header && (
        <CardHeader variant={variant} noPadding={noPadding}>
          {header}
        </CardHeader>
      )}
      
      <CardContent variant={variant} noPadding={noPadding}>
        {children}
      </CardContent>

      {footer && (
        <CardFooter variant={variant} noPadding={noPadding}>
          {footer}
        </CardFooter>
      )}
    </CardContainer>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;

// Type export for component props
export type { CardProps };