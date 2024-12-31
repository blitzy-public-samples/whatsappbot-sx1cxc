import styled, { css, keyframes } from 'styled-components'; // styled-components v5.3.10

// Size variants for the loader
const sizeVariants = {
  small: '24px',
  medium: '40px',
  large: '56px'
} as const;

// Spinner rotation animation
const spinAnimation = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Helper function to generate size-specific styles
const getSizeStyles = (size: keyof typeof sizeVariants | string) => css`
  width: ${sizeVariants[size as keyof typeof sizeVariants] || sizeVariants.medium};
  height: ${sizeVariants[size as keyof typeof sizeVariants] || sizeVariants.medium};
`;

// Container component for the loader with optional fullscreen overlay
export const LoaderContainer = styled.div<{
  fullscreen?: boolean;
  ariaLabel?: string;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: ${props => props.fullscreen ? 'fixed' : 'relative'};
  top: ${props => props.fullscreen ? '0' : 'auto'};
  left: ${props => props.fullscreen ? '0' : 'auto'};
  right: ${props => props.fullscreen ? '0' : 'auto'};
  bottom: ${props => props.fullscreen ? '0' : 'auto'};
  background: ${props => props.fullscreen ? props.theme.colors.background || 'rgba(255, 255, 255, 0.9)' : 'transparent'};
  z-index: ${props => props.fullscreen ? 9999 : 1};
  transition: background 0.3s ease;
  
  /* Accessibility attributes */
  role: progressbar;
  aria-busy: true;
  aria-label: ${props => props.ariaLabel || 'Loading...'};
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Wrapper component handling size variants
export const SpinnerWrapper = styled.div<{
  size?: keyof typeof sizeVariants | string;
}>`
  ${props => getSizeStyles(props.size || 'medium')};
  position: relative;
  display: inline-block;
  
  /* Performance optimizations */
  will-change: transform;
  transition: all 0.2s ease;
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Core spinner component with animation
export const Spinner = styled.div<{
  color?: string;
  duration?: number;
}>`
  border: 2px solid transparent;
  border-top-color: ${props => props.color || props.theme.colors.primary || '#1976D2'};
  border-radius: 50%;
  width: 100%;
  height: 100%;
  
  /* Optimized animation */
  animation: ${spinAnimation} ${props => props.duration || 0.8}s linear infinite;
  will-change: transform;
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1.5s;
  }
`;