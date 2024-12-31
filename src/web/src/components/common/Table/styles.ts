import styled, { css } from 'styled-components';
import '../../../assets/styles/variables.css';

// Interfaces for component props
interface TableContainerProps extends React.HTMLProps<HTMLDivElement> {
  maxHeight?: string;
  isLoading?: boolean;
}

interface TableCellProps {
  align?: 'left' | 'center' | 'right';
  padding?: 'normal' | 'compact';
  isRTL?: boolean;
}

interface TableRowProps {
  isSelected?: boolean;
  isClickable?: boolean;
  isDisabled?: boolean;
}

// Helper function for responsive styles
const getResponsiveStyles = () => css`
  @media (max-width: var(--breakpoint-sm)) {
    padding: var(--spacing-xs);
    font-size: var(--font-size-body2);
  }

  @media (min-width: var(--breakpoint-sm)) and (max-width: var(--breakpoint-md)) {
    padding: var(--spacing-sm);
  }

  @media (min-width: var(--breakpoint-md)) {
    padding: var(--spacing-md);
  }
`;

// Styled Components
export const TableContainer = styled.div<TableContainerProps>`
  width: 100%;
  overflow-x: auto;
  background-color: var(--color-background);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-1);
  position: relative;
  max-height: ${props => props.maxHeight || 'none'};
  opacity: ${props => props.isLoading ? 0.7 : 1};
  transition: opacity var(--transition-duration) var(--transition-timing);

  /* Scrollbar styling for webkit browsers */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-background-paper);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-secondary-light);
    border-radius: 4px;
  }

  /* Ensure proper focus outline for keyboard navigation */
  &:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  
  /* Ensure proper text contrast for accessibility */
  color: var(--color-text-primary);
  font-family: var(--font-family-primary);
  font-size: var(--font-size-body1);
`;

export const TableHeader = styled.thead`
  position: sticky;
  top: 0;
  z-index: 2;
  background-color: var(--color-background);
  box-shadow: var(--elevation-1);
`;

export const TableHeaderCell = styled.th<TableCellProps>`
  text-align: ${props => props.align || 'left'};
  padding: ${props => props.padding === 'compact' ? 'var(--spacing-sm)' : 'var(--spacing-md)'};
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  white-space: nowrap;
  direction: ${props => props.isRTL ? 'rtl' : 'ltr'};
  
  /* Sort indicator styles */
  &[aria-sort] {
    cursor: pointer;
    user-select: none;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
    
    &:after {
      content: '';
      display: inline-block;
      width: 0;
      height: 0;
      margin-left: var(--spacing-xs);
      vertical-align: middle;
    }
  }
`;

export const TableBody = styled.tbody`
  /* Virtual scroll optimization */
  will-change: transform;
  contain: content;
`;

export const TableRow = styled.tr<TableRowProps>`
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background-color: ${props => props.isSelected ? 'var(--color-primary-light)' : 'transparent'};
  cursor: ${props => props.isClickable ? 'pointer' : 'default'};
  opacity: ${props => props.isDisabled ? 0.5 : 1};
  pointer-events: ${props => props.isDisabled ? 'none' : 'auto'};
  
  &:hover {
    background-color: ${props => !props.isSelected && !props.isDisabled && 'rgba(0, 0, 0, 0.04)'};
  }

  /* Focus styles for keyboard navigation */
  &:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    border-bottom: 2px solid currentColor;
  }
`;

export const TableCell = styled.td<TableCellProps>`
  text-align: ${props => props.align || 'left'};
  padding: ${props => props.padding === 'compact' ? 'var(--spacing-sm)' : 'var(--spacing-md)'};
  vertical-align: middle;
  direction: ${props => props.isRTL ? 'rtl' : 'ltr'};
  
  /* Responsive styles */
  ${getResponsiveStyles}
  
  /* Truncate long content with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  /* Ensure proper color contrast for accessibility */
  @media (prefers-contrast: high) {
    border: 1px solid currentColor;
  }
`;