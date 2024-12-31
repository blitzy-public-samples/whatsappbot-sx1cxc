// @emotion/styled version: 11.11.x
import styled from '@emotion/styled';
// @emotion/react version: 11.11.x
import { keyframes, css } from '@emotion/react';

// Types for alert variants
export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

// Animation keyframes for alert entrance and exit
export const slideIn = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

// Helper function to get background color with proper opacity for WCAG compliance
const getAlertBackgroundColor = (variant: AlertVariant, theme: any) => {
  const baseColors = {
    success: theme.palette.success.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    info: theme.palette.info.main,
  };

  // Apply 0.12 opacity for light backgrounds while maintaining WCAG contrast
  return `${baseColors[variant]}1F`; // Using hex opacity for better browser support
};

// Helper function to get text color ensuring WCAG contrast ratio
const getAlertTextColor = (variant: AlertVariant, theme: any) => {
  const baseColors = {
    success: theme.palette.success.dark,
    error: theme.palette.error.dark,
    warning: theme.palette.warning.dark,
    info: theme.palette.info.dark,
  };

  return baseColors[variant]; // Dark variants ensure WCAG AA compliance
};

// Main alert container with proper accessibility and animations
export const AlertContainer = styled.div<{
  variant: AlertVariant;
  isClosing: boolean;
}>`
  display: flex;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  background-color: ${({ variant, theme }) => getAlertBackgroundColor(variant, theme)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  box-shadow: ${({ theme }) => theme.shadows[1]};
  animation: ${({ isClosing }) =>
    isClosing
      ? css`
          ${slideOut} 0.3s ease-in-out forwards
        `
      : css`
          ${slideIn} 0.3s ease-in-out
        `};
  
  /* Ensure proper focus visibility for keyboard navigation */
  &:focus-visible {
    outline: 2px solid ${({ variant, theme }) => getAlertTextColor(variant, theme)};
    outline-offset: 2px;
  }

  /* Responsive adjustments following 8px grid */
  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(1.5)};
    margin-bottom: ${({ theme }) => theme.spacing(1.5)};
  }
`;

// Content layout component with proper spacing
export const AlertContent = styled.div<{ variant: AlertVariant }>`
  display: flex;
  align-items: center;
  width: 100%;
  gap: ${({ theme }) => theme.spacing(2)};

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    gap: ${({ theme }) => theme.spacing(1.5)};
  }
`;

// Icon component with variant-based colors
export const AlertIcon = styled.span<{ variant: AlertVariant }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ variant, theme }) => getAlertTextColor(variant, theme)};
  flex-shrink: 0;
  width: 24px;
  height: 24px;

  /* Ensure icon is properly visible for screen readers */
  svg {
    width: 100%;
    height: 100%;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    width: 20px;
    height: 20px;
  }
`;

// Message text component with proper typography
export const AlertMessage = styled.div<{ variant: AlertVariant }>`
  color: ${({ variant, theme }) => getAlertTextColor(variant, theme)};
  font-family: ${({ theme }) => theme.typography.body1.fontFamily};
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  line-height: ${({ theme }) => theme.typography.body1.lineHeight};
  flex-grow: 1;
  margin: 0;

  /* Ensure proper text contrast for WCAG compliance */
  font-weight: 500;

  /* Responsive typography */
  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
    line-height: ${({ theme }) => theme.typography.body2.lineHeight};
  }
`;