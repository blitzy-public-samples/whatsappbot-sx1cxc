import styled, { css } from 'styled-components'; // v5.3.10
import '../../../assets/styles/variables.css';

// Type definitions for component props
interface SelectContainerProps extends React.HTMLProps<HTMLDivElement> {
  size?: 'small' | 'medium' | 'large';
  variant?: 'outlined' | 'filled' | 'standard';
}

interface SelectInputProps extends React.HTMLProps<HTMLSelectElement> {
  error?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'outlined' | 'filled' | 'standard';
}

interface SelectLabelProps extends React.HTMLProps<HTMLLabelElement> {
  error?: boolean;
}

interface SelectErrorProps extends React.HTMLProps<HTMLSpanElement> {}

// Helper function to get size-specific styles
const getSizeStyles = (size?: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return css`
        padding: calc(var(--spacing-unit) * 0.75);
        font-size: var(--font-size-body2);
        height: calc(var(--spacing-unit) * 4);
      `;
    case 'large':
      return css`
        padding: calc(var(--spacing-unit) * 1.5);
        font-size: var(--font-size-body1);
        height: calc(var(--spacing-unit) * 6);
      `;
    default: // medium
      return css`
        padding: var(--spacing-unit);
        font-size: var(--font-size-body1);
        height: calc(var(--spacing-unit) * 5);
      `;
  }
};

// Helper function to get variant-specific styles
const getVariantStyles = (variant?: 'outlined' | 'filled' | 'standard') => {
  switch (variant) {
    case 'filled':
      return css`
        background-color: rgba(0, 0, 0, 0.06);
        border: 1px solid transparent;
        border-radius: var(--border-radius);
        
        &:hover {
          background-color: rgba(0, 0, 0, 0.09);
        }
        
        &:focus-within {
          background-color: rgba(0, 0, 0, 0.03);
        }
      `;
    case 'standard':
      return css`
        background-color: transparent;
        border: none;
        border-bottom: 1px solid rgba(0, 0, 0, 0.42);
        border-radius: 0;
        
        &:hover {
          border-bottom: 2px solid rgba(0, 0, 0, 0.87);
        }
      `;
    default: // outlined
      return css`
        background-color: transparent;
        border: 1px solid rgba(0, 0, 0, 0.23);
        border-radius: var(--border-radius);
        
        &:hover {
          border-color: rgba(0, 0, 0, 0.87);
        }
      `;
  }
};

export const SelectContainer = styled.div<SelectContainerProps>`
  position: relative;
  width: 100%;
  margin: var(--spacing-unit) 0;
  font-family: var(--font-family-primary);
  
  ${props => getVariantStyles(props.variant)}
  
  &:focus-within {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }
`;

export const SelectInput = styled.select<SelectInputProps>`
  width: 100%;
  appearance: none;
  background-color: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  outline: none;
  font-family: inherit;
  
  ${props => getSizeStyles(props.size)}
  
  &:disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;
    background-color: rgba(0, 0, 0, 0.04);
  }
  
  &:focus {
    outline: none;
  }
  
  /* Custom dropdown arrow */
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='rgba(0,0,0,0.54)' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--spacing-unit) center;
  padding-right: calc(var(--spacing-unit) * 4);
  
  ${props => props.error && css`
    color: var(--color-error);
    border-color: var(--color-error);
    
    &:focus {
      border-color: var(--color-error);
      box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.2);
    }
  `}
`;

export const SelectLabel = styled.label<SelectLabelProps>`
  display: block;
  margin-bottom: var(--spacing-xs);
  color: ${props => props.error ? 'var(--color-error)' : 'var(--color-text-secondary)'};
  font-size: var(--font-size-body2);
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-duration) var(--transition-timing);
  
  ${SelectContainer}:focus-within & {
    color: ${props => props.error ? 'var(--color-error)' : 'var(--color-primary)'};
  }
`;

export const SelectError = styled.span<SelectErrorProps>`
  display: block;
  margin-top: var(--spacing-xs);
  color: var(--color-error);
  font-size: var(--font-size-caption);
  min-height: calc(var(--spacing-unit) * 2);
`;