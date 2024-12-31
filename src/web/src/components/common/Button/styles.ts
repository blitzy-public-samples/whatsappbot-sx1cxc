// @version styled-components ^6.0.7
import styled, { css } from 'styled-components';
import { Size, Variant } from '../../../types/common';

/**
 * Interface defining all available props for the StyledButton component
 */
interface StyledButtonProps {
  variant: Variant;
  size: Size;
  fullWidth?: boolean;
  disabled?: boolean;
}

/**
 * Generates variant-specific styles with WCAG 2.1 AA compliant color combinations
 * Includes high contrast mode support and RTL-aware styles
 */
const getVariantStyles = (variant: Variant) => {
  const variantMap = {
    [Variant.PRIMARY]: {
      base: css`
        background-color: var(--color-primary);
        color: var(--color-primary-contrast);
        border: none;

        @media (forced-colors: active) {
          border: 2px solid ButtonText;
        }
      `,
      hover: css`
        background-color: var(--color-primary-dark);
      `,
      active: css`
        background-color: var(--color-primary-darker);
      `
    },
    [Variant.SECONDARY]: {
      base: css`
        background-color: transparent;
        color: var(--color-primary);
        border: 2px solid var(--color-primary);

        @media (forced-colors: active) {
          border: 2px solid ButtonText;
          color: ButtonText;
        }
      `,
      hover: css`
        background-color: var(--color-primary-light);
      `,
      active: css`
        background-color: var(--color-primary-lighter);
      `
    },
    [Variant.SUCCESS]: {
      base: css`
        background-color: var(--color-success);
        color: var(--color-success-contrast);
        border: none;

        @media (forced-colors: active) {
          border: 2px solid ButtonText;
        }
      `,
      hover: css`
        background-color: var(--color-success-dark);
      `,
      active: css`
        background-color: var(--color-success-darker);
      `
    },
    [Variant.WARNING]: {
      base: css`
        background-color: var(--color-warning);
        color: var(--color-warning-contrast);
        border: none;

        @media (forced-colors: active) {
          border: 2px solid ButtonText;
        }
      `,
      hover: css`
        background-color: var(--color-warning-dark);
      `,
      active: css`
        background-color: var(--color-warning-darker);
      `
    },
    [Variant.ERROR]: {
      base: css`
        background-color: var(--color-error);
        color: var(--color-error-contrast);
        border: none;

        @media (forced-colors: active) {
          border: 2px solid ButtonText;
        }
      `,
      hover: css`
        background-color: var(--color-error-dark);
      `,
      active: css`
        background-color: var(--color-error-darker);
      `
    }
  };

  return css`
    ${variantMap[variant].base}

    &:hover:not(:disabled) {
      ${variantMap[variant].hover}
    }

    &:active:not(:disabled) {
      ${variantMap[variant].active}
    }
  `;
};

/**
 * Generates size-specific styles following Material Design's 8px grid system
 * Ensures proper touch target sizes for accessibility
 */
const getSizeStyles = (size: Size) => {
  const sizeMap = {
    [Size.SMALL]: css`
      padding: 6px 16px;
      font-size: 0.875rem;
      min-width: 64px;
      height: 32px;

      @media (pointer: coarse) {
        min-height: var(--touch-target-size);
      }
    `,
    [Size.MEDIUM]: css`
      padding: 8px 24px;
      font-size: 1rem;
      min-width: 96px;
      height: 40px;

      @media (pointer: coarse) {
        min-height: var(--touch-target-size);
      }
    `,
    [Size.LARGE]: css`
      padding: 12px 32px;
      font-size: 1.125rem;
      min-width: 128px;
      height: 48px;

      @media (pointer: coarse) {
        min-height: var(--touch-target-size);
      }
    `
  };

  return sizeMap[size];
};

/**
 * StyledButton component with comprehensive styling meeting WCAG 2.1 AA standards
 * Includes RTL support, high contrast mode compatibility, and proper focus management
 */
export const StyledButton = styled.button<StyledButtonProps>`
  /* Base styles */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  font-family: var(--font-family);
  font-weight: 500;
  letter-spacing: 0.02857em;
  line-height: 1.75;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  vertical-align: middle;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;

  /* Transition for all interactive states */
  transition: background-color var(--transition-duration) var(--transition-timing),
              box-shadow var(--transition-duration) var(--transition-timing),
              border-color var(--transition-duration) var(--transition-timing),
              color var(--transition-duration) var(--transition-timing);

  /* Apply variant-specific styles */
  ${({ variant }) => getVariantStyles(variant)}

  /* Apply size-specific styles */
  ${({ size }) => getSizeStyles(size)}

  /* Full width modifier */
  ${({ fullWidth }) =>
    fullWidth &&
    css`
      width: 100%;
    `}

  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;

    @media (forced-colors: active) {
      color: GrayText;
      border-color: GrayText;
    }
  }

  /* Focus visible styles with keyboard navigation */
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    
    @media (forced-colors: active) {
      outline: 2px solid ButtonText;
      outline-offset: 2px;
    }
  }

  /* Remove focus styles for mouse/touch interaction */
  &:focus:not(:focus-visible) {
    outline: none;
    box-shadow: none;
  }

  /* RTL support */
  [dir="rtl"] & {
    margin-left: 0;
    margin-right: auto;
  }

  /* Icon spacing */
  & > svg {
    margin-right: ${({ size }) => (size === Size.SMALL ? '4px' : '8px')};
    font-size: ${({ size }) =>
      size === Size.SMALL ? '16px' : size === Size.MEDIUM ? '20px' : '24px'};

    [dir="rtl"] & {
      margin-right: 0;
      margin-left: ${({ size }) => (size === Size.SMALL ? '4px' : '8px')};
    }
  }

  /* High contrast mode adjustments */
  @media (forced-colors: active) {
    &:focus {
      outline: 2px solid ButtonText;
      outline-offset: 2px;
    }
  }
`;