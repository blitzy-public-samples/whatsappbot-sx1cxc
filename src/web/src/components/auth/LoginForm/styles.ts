// @emotion/styled version ^11.11.0
import styled from '@emotion/styled';
import theme from '../../../config/theme';

// Constants for form dimensions and spacing
const FORM_MAX_WIDTH = '400px';
const FORM_MIN_WIDTH = '280px';
const FORM_VERTICAL_SPACING = '24px';
const FORM_HORIZONTAL_SPACING = '16px';
const FOCUS_OUTLINE_WIDTH = '2px';
const FOCUS_OUTLINE_OFFSET = '2px';

/**
 * Calculates responsive spacing values based on viewport size
 * @param baseSpacing - Base spacing value in pixels
 * @returns CSS spacing value with responsive breakpoints
 */
const getResponsiveSpacing = (baseSpacing: number) => `
  ${theme.spacing(baseSpacing * 0.75)}px;
  
  ${theme.breakpoints.up('sm')} {
    ${theme.spacing(baseSpacing)}px;
  }
  
  ${theme.breakpoints.up('md')} {
    ${theme.spacing(baseSpacing * 1.25)}px;
  }
`;

/**
 * Returns appropriate elevation shadow based on component state
 * @param state - Component state ('default' | 'hover' | 'focus')
 * @returns CSS box-shadow value
 */
const getElevation = (state: 'default' | 'hover' | 'focus') => {
  switch (state) {
    case 'hover':
      return theme.shadows[4];
    case 'focus':
      return theme.shadows[8];
    default:
      return theme.shadows[2];
  }
};

/**
 * Container component for the login form
 * Implements responsive layout and proper spacing
 */
export const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: ${FORM_MIN_WIDTH};
  max-width: ${FORM_MAX_WIDTH};
  width: 100%;
  margin: ${getResponsiveSpacing(4)} auto;
  padding: ${getResponsiveSpacing(3)};
  background-color: ${theme.palette.background.paper};
  border-radius: ${theme.shape.borderRadius}px;
  box-shadow: ${getElevation('default')};
  transition: box-shadow ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut};

  &:hover {
    box-shadow: ${getElevation('hover')};
  }

  ${theme.breakpoints.down('sm')} {
    margin: ${theme.spacing(2)}px;
  }
`;

/**
 * Form title component with proper typography and accessibility
 */
export const FormTitle = styled.h1`
  ${theme.typography.h4};
  color: ${theme.palette.text.primary};
  margin-bottom: ${FORM_VERTICAL_SPACING};
  text-align: center;
  width: 100%;

  ${theme.breakpoints.down('sm')} {
    ${theme.typography.h5};
  }
`;

/**
 * Styled form field wrapper with focus and error states
 */
export const FormField = styled.div<{ error?: boolean }>`
  width: 100%;
  margin-bottom: ${FORM_VERTICAL_SPACING};
  position: relative;

  & input, & select, & textarea {
    width: 100%;
    padding: ${FORM_HORIZONTAL_SPACING};
    border: 1px solid ${({ error }) => 
      error ? theme.palette.error.main : theme.palette.action.disabled};
    border-radius: ${theme.shape.borderRadius}px;
    transition: all ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeInOut};
    
    &:focus {
      outline: ${FOCUS_OUTLINE_WIDTH} solid ${theme.palette.primary.main};
      outline-offset: ${FOCUS_OUTLINE_OFFSET};
      border-color: ${theme.palette.primary.main};
    }

    &:disabled {
      background-color: ${theme.palette.action.disabledBackground};
      color: ${theme.palette.text.disabled};
    }
  }
`;

/**
 * Submit button component with loading and disabled states
 */
export const SubmitButton = styled.button<{ loading?: boolean }>`
  ${theme.typography.button};
  width: 100%;
  padding: ${theme.spacing(1.5)}px ${theme.spacing(3)}px;
  background-color: ${theme.palette.primary.main};
  color: ${theme.palette.primary.contrastText};
  border: none;
  border-radius: ${theme.shape.borderRadius}px;
  cursor: pointer;
  transition: all ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut};
  position: relative;
  
  &:hover:not(:disabled) {
    background-color: ${theme.palette.primary.dark};
  }

  &:focus {
    outline: ${FOCUS_OUTLINE_WIDTH} solid ${theme.palette.primary.main};
    outline-offset: ${FOCUS_OUTLINE_OFFSET};
  }

  &:disabled {
    background-color: ${theme.palette.action.disabledBackground};
    color: ${theme.palette.text.disabled};
    cursor: not-allowed;
  }

  ${({ loading }) => loading && `
    color: transparent;
    pointer-events: none;
    
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      border: 2px solid ${theme.palette.primary.contrastText};
      border-top-color: transparent;
      border-radius: 50%;
      animation: button-loading-spinner 0.8s linear infinite;
    }
  `}

  @keyframes button-loading-spinner {
    from {
      transform: rotate(0turn);
    }
    to {
      transform: rotate(1turn);
    }
  }
`;

/**
 * Error message component with screen reader support
 */
export const ErrorMessage = styled.div`
  ${theme.typography.caption};
  color: ${theme.palette.error.main};
  margin-top: ${theme.spacing(0.5)}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing(0.5)}px;

  &::before {
    content: '⚠️';
    font-size: 1em;
  }

  /* Hide error icon but keep it accessible for screen readers */
  @media speech {
    &::before {
      display: none;
    }
  }
`;