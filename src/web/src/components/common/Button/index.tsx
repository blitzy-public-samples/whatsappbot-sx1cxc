// @version React ^18.2.0
import React, { useCallback } from 'react';
import { StyledButton } from './styles';
import { Size, Variant, BaseComponentProps } from '../../../types/common';

/**
 * Interface extending BaseComponentProps for Button-specific properties
 */
interface ButtonProps extends BaseComponentProps {
  /** Visual style variant of the button */
  variant?: Variant;
  /** Size variant affecting padding and font size */
  size?: Size;
  /** Button content including text or icons */
  children: React.ReactNode;
  /** Click event handler with type safety */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Disabled state of the button */
  disabled?: boolean;
  /** Controls button width behavior */
  fullWidth?: boolean;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Accessibility label for screen readers */
  ariaLabel?: string;
}

/**
 * A comprehensive, accessible button component following Material Design principles.
 * Implements WCAG 2.1 AA standards and provides consistent styling across the application.
 *
 * @param props - Button component properties
 * @returns A styled, accessible button element
 */
export const Button = React.memo<ButtonProps>(({
  variant = Variant.PRIMARY,
  size = Size.MEDIUM,
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className,
  style,
  id,
  testId,
  ariaLabel,
}) => {
  /**
   * Memoized click handler to prevent unnecessary rerenders
   */
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && onClick) {
      onClick(event);
    }
  }, [disabled, onClick]);

  /**
   * Keyboard interaction handler for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && onClick) {
        onClick(event as unknown as React.MouseEvent<HTMLButtonElement>);
      }
    }
  }, [disabled, onClick]);

  return (
    <StyledButton
      variant={variant}
      size={size}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      fullWidth={fullWidth}
      type={type}
      className={className}
      style={style}
      id={id}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </StyledButton>
  );
});

/**
 * Display name for debugging purposes
 */
Button.displayName = 'Button';

/**
 * Default export for convenient importing
 */
export default Button;