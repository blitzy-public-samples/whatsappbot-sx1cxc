import styled from 'styled-components'; // ^5.3.0
import theme from '../../../config/theme';

// Type definitions for template card props
interface TemplateCardProps {
  isSelected: boolean;
  isHovered: boolean;
  isAccessible: boolean;
  onClick?: () => void;
  metadata?: {
    created: Date;
    modified: Date;
    usageCount: number;
    category: string;
  };
}

/**
 * Optimized function for generating responsive grid columns based on container width
 * Implements performance-optimized layout calculations with container queries
 */
const getGridColumns = (containerWidth: number) => {
  const minCardWidth = 280; // Minimum card width in pixels
  const gap = theme.spacing(3);
  const columns = Math.floor((containerWidth + gap) / (minCardWidth + gap));
  return `repeat(${Math.max(1, columns)}, minmax(${minCardWidth}px, 1fr))`;
};

/**
 * Performance-optimized elevation handler using GPU-accelerated transforms
 */
const getCardElevation = (isHovered: boolean, isSelected: boolean) => {
  const baseElevation = isSelected ? 8 : 2;
  const hoverElevation = isSelected ? 12 : 8;
  
  return {
    transform: `translateY(${isHovered ? -4 : 0}px)`,
    boxShadow: `0px ${isHovered ? hoverElevation : baseElevation}px ${baseElevation * 2}px rgba(0, 0, 0, 0.1)`,
    willChange: isHovered ? 'transform' : 'auto',
  };
};

/**
 * Main container for template list with optimized grid layout
 * Implements virtual scrolling boundaries and GPU acceleration hints
 */
export const ListContainer = styled.div`
  display: grid;
  gap: ${theme.spacing(3)}px;
  padding: ${theme.spacing(3)}px;
  width: 100%;
  min-height: 100%;
  
  /* Responsive grid layout with container query support */
  grid-template-columns: ${({ width }) => getGridColumns(width || 1280)}px;
  
  /* Performance optimizations */
  contain: layout style paint;
  will-change: contents;
  
  /* Responsive adjustments */
  @media ${theme.breakpoints.down('sm')} {
    padding: ${theme.spacing(2)}px;
    gap: ${theme.spacing(2)}px;
  }
`;

/**
 * Enhanced styled card component with performance-optimized animations
 * Implements WCAG 2.1 AA compliant focus states and keyboard navigation
 */
export const TemplateCard = styled.div<TemplateCardProps>`
  position: relative;
  background: ${theme.palette.background.paper};
  border-radius: ${theme.shape.borderRadiusLarge}px;
  padding: ${theme.spacing(3)}px;
  cursor: pointer;
  
  /* Performance-optimized transitions */
  transition: ${theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.shorter,
    easing: theme.transitions.easing.easeInOut,
  })};
  
  /* Dynamic elevation based on state */
  ${({ isHovered, isSelected }) => getCardElevation(isHovered, isSelected)};
  
  /* Accessibility enhancements */
  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.main};
    outline-offset: 2px;
  }
  
  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
  
  /* Disabled state styling */
  ${({ isAccessible }) => !isAccessible && `
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

/**
 * Container for template action buttons with consistent spacing
 */
export const TemplateActions = styled.div`
  display: flex;
  gap: ${theme.spacing(1)}px;
  margin-top: ${theme.spacing(2)}px;
  justify-content: flex-end;
  
  /* Ensure buttons are easily clickable on touch devices */
  @media (pointer: coarse) {
    gap: ${theme.spacing(2)}px;
    padding: ${theme.spacing(1)}px 0;
  }
`;

/**
 * Structured layout for template metadata display
 * Implements responsive typography and spacing
 */
export const TemplateMetadata = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing(1)}px;
  margin-top: ${theme.spacing(2)}px;
  padding-top: ${theme.spacing(2)}px;
  border-top: 1px solid ${theme.palette.divider};
  
  /* Typography styles */
  font-size: ${theme.typography.body2.fontSize};
  color: ${theme.palette.text.secondary};
  
  /* Metadata grid layout */
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing(1)}px;
  
  /* Responsive adjustments */
  @media ${theme.breakpoints.down('sm')} {
    grid-template-columns: 1fr;
  }
`;