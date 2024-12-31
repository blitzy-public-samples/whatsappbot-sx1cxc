import styled, { css } from 'styled-components';
import { theme } from '../../../config/theme';

// Constants for consistent measurements and animations
const SIDEBAR_WIDTH = '280px';
const MOBILE_HEIGHT = '60px';
const TRANSITION_DURATION = theme.transitions.duration.standard;
const TRANSITION_TIMING = theme.transitions.easing.easeInOut;

// Helper function to determine responsive width with performance optimization
const getResponsiveWidth = () => css`
  width: ${SIDEBAR_WIDTH};
  will-change: transform;
  
  @media (max-width: ${theme.breakpoints.values.md}px) {
    transform: translateX(-100%);
    transition: transform ${TRANSITION_DURATION}ms ${TRANSITION_TIMING};
    
    &[data-expanded='true'] {
      transform: translateX(0);
    }
  }

  @media (max-width: ${theme.breakpoints.values.sm}px) {
    width: 100%;
    height: ${MOBILE_HEIGHT};
    transform: translateY(100%);
    bottom: 0;
    top: auto;

    &[data-expanded='true'] {
      transform: translateY(0);
    }
  }
`;

// Main sidebar container with enhanced accessibility and responsive behavior
export const SidebarContainer = styled.aside`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  background-color: ${theme.palette.background.paper};
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  overflow-y: auto;
  padding: ${theme.spacing(3)}px;
  
  /* Enhanced scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: ${theme.palette.action.active} transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: ${theme.palette.action.active};
    border-radius: 3px;
  }

  /* Apply responsive width and transitions */
  ${getResponsiveWidth()}

  /* Accessibility enhancements */
  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.main};
    outline-offset: -2px;
  }

  /* Ensure proper color contrast for WCAG compliance */
  color: ${theme.palette.text.primary};
`;

// Navigation list with semantic markup and spacing
export const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${theme.spacing(2)}px 0;

  /* Proper spacing between sections */
  & + & {
    margin-top: ${theme.spacing(4)}px;
    padding-top: ${theme.spacing(4)}px;
    border-top: 1px solid ${theme.palette.divider};
  }
`;

// Navigation item with enhanced interaction states
export const NavItem = styled.li`
  margin: ${theme.spacing(0.5)}px 0;
  padding: ${theme.spacing(1)}px ${theme.spacing(2)}px;
  border-radius: ${theme.shape.borderRadius}px;
  cursor: pointer;
  transition: background-color ${theme.transitions.duration.shortest}ms ${theme.transitions.easing.easeInOut};

  /* Interactive states with proper contrast */
  &:hover {
    background-color: ${theme.palette.action.hover};
  }

  &[aria-selected='true'] {
    background-color: ${theme.palette.action.selected};
    color: ${theme.palette.primary.main};
    font-weight: ${theme.typography.fontWeightMedium};
  }

  /* Focus state for keyboard navigation */
  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.main};
    outline-offset: -2px;
  }

  /* Disabled state styling */
  &[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Icon alignment and spacing */
  display: flex;
  align-items: center;
  gap: ${theme.spacing(2)}px;

  /* Ensure proper text wrapping */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Group section container with semantic separation
export const GroupSection = styled.div`
  margin-top: ${theme.spacing(4)}px;

  /* Group header styling */
  h3 {
    font-size: ${theme.typography.body2.fontSize};
    color: ${theme.palette.text.secondary};
    margin: ${theme.spacing(1)}px ${theme.spacing(2)}px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* Nested navigation items */
  ${NavList} {
    margin-top: ${theme.spacing(1)}px;
    
    ${NavItem} {
      padding-left: ${theme.spacing(3)}px;
    }
  }
`;