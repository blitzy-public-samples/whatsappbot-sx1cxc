import styled, { css } from 'styled-components';
// styled-components version: ^5.3.0

// Constants for styling
const TRANSITION_DURATION = 'var(--transition-duration, 200ms)';
const BORDER_RADIUS = 'var(--border-radius, 4px)';
const INPUT_HEIGHT = '48px';
const LABEL_FONT_SIZE = 'var(--font-size-body2, 14px)';
const INPUT_FONT_SIZE = 'var(--font-size-body1, 16px)';
const ERROR_FONT_SIZE = 'var(--font-size-caption, 12px)';
const LABEL_TRANSITION = 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)';
const COLOR_TRANSITION = 'border-color 200ms ease-in-out, background-color 200ms ease-in-out';
const HOVER_ELEVATION = '0 2px 4px rgba(0, 0, 0, 0.1)';
const FOCUS_RING_COLOR = 'var(--color-primary-light)';
const ERROR_COLOR = 'var(--color-error)';
const DISABLED_BACKGROUND = 'var(--color-disabled-background)';

// Helper function to determine border color based on input state
const getInputBorderColor = ({
  error,
  focused,
  disabled,
  readonly,
  hover,
}: {
  error?: boolean;
  focused?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  hover?: boolean;
}) => {
  if (error) return ERROR_COLOR;
  if (disabled) return 'var(--color-disabled-border)';
  if (readonly) return 'var(--color-readonly-border)';
  if (focused) return 'var(--color-primary)';
  if (hover) return 'var(--color-border-hover)';
  return 'var(--color-border)';
};

// Container component for the input field
export const InputContainer = styled.div<{ fullWidth?: boolean }>`
  position: relative;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : '320px')};
  margin-bottom: 24px;
  
  /* Ensure proper stacking context for floating elements */
  z-index: 0;
  
  /* High contrast mode support */
  @media screen and (-ms-high-contrast: active) {
    border: 1px solid currentColor;
  }
`;

// Main input component
export const StyledInput = styled.input<{
  error?: boolean;
  focused?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  hasValue?: boolean;
}>`
  width: 100%;
  height: ${INPUT_HEIGHT};
  padding: 16px 12px 0;
  font-size: ${INPUT_FONT_SIZE};
  font-family: var(--font-family-body);
  color: var(--color-text-primary);
  background-color: var(--color-background);
  border: 1px solid ${props => getInputBorderColor(props)};
  border-radius: ${BORDER_RADIUS};
  transition: ${COLOR_TRANSITION};
  outline: none;
  
  /* Disabled state */
  ${props =>
    props.disabled &&
    css`
      background-color: ${DISABLED_BACKGROUND};
      color: var(--color-text-disabled);
      cursor: not-allowed;
      pointer-events: none;
    `}
  
  /* Readonly state */
  ${props =>
    props.readonly &&
    css`
      background-color: var(--color-readonly-background);
      cursor: default;
    `}
  
  /* Focus state */
  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px ${FOCUS_RING_COLOR};
  }
  
  /* Hover state */
  &:hover:not(:disabled):not([readonly]) {
    border-color: var(--color-border-hover);
    box-shadow: ${HOVER_ELEVATION};
  }
  
  /* Error state */
  ${props =>
    props.error &&
    css`
      border-color: ${ERROR_COLOR};
      &:focus {
        box-shadow: 0 0 0 3px var(--color-error-light);
      }
    `}
  
  /* Placeholder handling */
  &::placeholder {
    color: transparent;
  }
  
  /* Screen reader only label support */
  &[aria-label] {
    &::before {
      content: attr(aria-label);
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
  }
`;

// Floating label component
export const InputLabel = styled.label<{
  error?: boolean;
  focused?: boolean;
  hasValue?: boolean;
  disabled?: boolean;
}>`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: ${props =>
    props.hasValue || props.focused
      ? 'translateY(-130%) scale(0.85)'
      : 'translateY(-50%)'};
  transform-origin: left top;
  transition: ${LABEL_TRANSITION};
  font-size: ${LABEL_FONT_SIZE};
  color: ${props =>
    props.error
      ? ERROR_COLOR
      : props.disabled
      ? 'var(--color-text-disabled)'
      : props.focused
      ? 'var(--color-primary)'
      : 'var(--color-text-secondary)'};
  pointer-events: none;
  
  /* Required indicator */
  &[data-required='true']::after {
    content: '*';
    margin-left: 4px;
    color: ${ERROR_COLOR};
  }
`;

// Error message component
export const ErrorMessage = styled.span`
  display: block;
  margin-top: 4px;
  font-size: ${ERROR_FONT_SIZE};
  color: ${ERROR_COLOR};
  font-family: var(--font-family-body);
  min-height: 20px;
  
  /* Fade in animation */
  opacity: 0;
  transform: translateY(-10px);
  animation: errorFadeIn 200ms ease-out forwards;
  
  @keyframes errorFadeIn {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Screen reader emphasis */
  &[role="alert"] {
    font-weight: 500;
  }
`;

export default {
  InputContainer,
  StyledInput,
  InputLabel,
  ErrorMessage,
};