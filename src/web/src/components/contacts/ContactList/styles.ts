import styled, { css } from 'styled-components';
import { TableContainer } from '../../common/Table/styles';
import '../../../assets/styles/variables.css';

// Interfaces for styled components props
interface ResponsiveContainerProps {
  className?: string;
  style?: React.CSSProperties;
}

interface SearchContainerProps extends ResponsiveContainerProps {
  isExpanded?: boolean;
}

interface ActionBarProps extends ResponsiveContainerProps {
  hasSelection?: boolean;
}

// Helper function for generating responsive styles
const getResponsiveStyles = () => css`
  @media (max-width: var(--breakpoint-sm)) {
    padding: var(--spacing-md);
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  @media (min-width: var(--breakpoint-sm)) and (max-width: var(--breakpoint-md)) {
    padding: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  @media (min-width: var(--breakpoint-md)) {
    padding: var(--spacing-xl);
    gap: var(--spacing-lg);
  }
`;

// Main container for the contact list component
export const ContactListContainer = styled.div<ResponsiveContainerProps>`
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  min-height: 100%;
  width: 100%;
  ${getResponsiveStyles}

  /* Ensure proper focus management for accessibility */
  &:focus-within {
    outline: none;
    box-shadow: var(--elevation-1);
  }
`;

// Container for search and filter controls
export const SearchContainer = styled.div<SearchContainerProps>`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  
  @media (max-width: var(--breakpoint-sm)) {
    flex-direction: column;
    align-items: stretch;
    
    ${props => props.isExpanded && css`
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--color-background);
      padding: var(--spacing-md);
      z-index: 10;
      box-shadow: var(--elevation-2);
    `}
  }

  @media (min-width: var(--breakpoint-sm)) {
    flex-wrap: wrap;
  }
`;

// Container for bulk actions and controls
export const ActionBar = styled.div<ActionBarProps>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  
  @media (max-width: var(--breakpoint-sm)) {
    flex-direction: column;
    gap: var(--spacing-sm);
    
    ${props => props.hasSelection && css`
      position: sticky;
      bottom: 0;
      background: var(--color-background);
      padding: var(--spacing-md);
      box-shadow: var(--elevation-2);
      z-index: 5;
    `}
  }

  /* Animate appearance when selection changes */
  transition: all var(--transition-duration) var(--transition-timing);
  opacity: ${props => props.hasSelection ? 1 : 0.8};
`;

// Extended table container with contact-specific styling
export const ContactTableContainer = styled(TableContainer)`
  flex: 1;
  margin: var(--spacing-md) 0;
  
  @media (max-width: var(--breakpoint-sm)) {
    margin: var(--spacing-sm) 0;
    border-radius: 0; /* Full width on mobile */
    
    /* Handle horizontal scroll with visual indicator */
    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 24px;
      background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1));
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--transition-duration) var(--transition-timing);
    }
    
    &:hover::after {
      opacity: 1;
    }
  }

  /* Optimize for print layout */
  @media print {
    box-shadow: none;
    border: 1px solid var(--color-text-primary);
  }
`;

// Container for pagination controls
export const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  
  @media (max-width: var(--breakpoint-sm)) {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: stretch;
    
    /* Sticky pagination on mobile for better UX */
    position: sticky;
    bottom: 0;
    background: var(--color-background);
    padding: var(--spacing-md);
    box-shadow: var(--elevation-1);
    z-index: 4;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    border-top: 2px solid currentColor;
  }

  /* Print layout optimization */
  @media print {
    display: none;
  }
`;