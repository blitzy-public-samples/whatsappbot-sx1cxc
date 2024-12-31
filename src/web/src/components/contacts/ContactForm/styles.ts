// @version styled-components: ^5.3.0
import styled, { css } from 'styled-components';

// Global constants for consistent styling
const FORM_MAX_WIDTH = '600px';
const FORM_PADDING = 'var(--spacing-md)';
const SECTION_MARGIN = 'var(--spacing-lg)';
const MOBILE_BREAKPOINT = '768px';
const TABLET_BREAKPOINT = '1279px';

// Elevation levels following Material Design principles
const ELEVATION_LEVELS = {
  low: '0 1px 3px rgba(0,0,0,0.12)',
  medium: '0 2px 4px rgba(0,0,0,0.16)',
  high: '0 4px 8px rgba(0,0,0,0.20)'
};

// Helper function to get elevation shadow
const getElevation = (level: 'low' | 'medium' | 'high' = 'low') => {
  return ELEVATION_LEVELS[level];
};

// Helper function for responsive width calculation
const getResponsiveWidth = (props: { theme: any }) => {
  const { theme } = props;
  if (theme.breakpoints?.desktop) {
    return FORM_MAX_WIDTH;
  } else if (theme.breakpoints?.tablet) {
    return '90%';
  }
  return '100%';
};

// Base styles for form elements
const baseFormStyles = css`
  font-family: 'Roboto', sans-serif;
  color: ${({ theme }) => theme.colors?.text || '#424242'};
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;
`;

// Main form container with responsive layout
export const FormContainer = styled.div`
  ${baseFormStyles}
  width: ${getResponsiveWidth};
  max-width: ${FORM_MAX_WIDTH};
  margin: 0 auto;
  padding: ${FORM_PADDING};
  background-color: ${({ theme }) => theme.colors?.surface || '#ffffff'};
  border-radius: 4px;
  box-shadow: ${getElevation('medium')};

  @media (max-width: ${TABLET_BREAKPOINT}px) {
    width: 90%;
    padding: calc(${FORM_PADDING} * 0.875);
  }

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    width: 100%;
    padding: calc(${FORM_PADDING} * 0.75);
    border-radius: 0;
  }

  /* Accessibility enhancements */
  &:focus-within {
    box-shadow: ${getElevation('high')};
    outline: 2px solid ${({ theme }) => theme.colors?.primary || '#1976D2'};
    outline-offset: 2px;
  }
`;

// Section container for grouping form fields
export const FormSection = styled.div`
  ${baseFormStyles}
  margin-bottom: ${SECTION_MARGIN};
  padding: calc(${FORM_PADDING} * 0.5);

  /* Visual hierarchy for nested sections */
  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors?.divider || '#e0e0e0'};
    padding-top: ${SECTION_MARGIN};
  }

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    margin-bottom: calc(${SECTION_MARGIN} * 0.75);
    padding: calc(${FORM_PADDING} * 0.375);
  }

  /* High contrast mode support */
  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`;

// Container for form action buttons
export const FormActions = styled.div`
  ${baseFormStyles}
  display: flex;
  justify-content: flex-end;
  gap: ${FORM_PADDING};
  margin-top: ${SECTION_MARGIN};
  padding-top: ${FORM_PADDING};
  border-top: 1px solid ${({ theme }) => theme.colors?.divider || '#e0e0e0'};

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    flex-direction: column;
    gap: calc(${FORM_PADDING} * 0.5);
    
    /* Full width buttons on mobile */
    & > * {
      width: 100%;
    }
  }

  /* RTL support */
  [dir='rtl'] & {
    justify-content: flex-start;
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;