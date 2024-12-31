import styled, { css } from 'styled-components';
import theme from '../../config/theme';

// Types for component props
interface CardContainerProps {
  elevation?: number;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  isDarkMode?: boolean;
  isRTL?: boolean;
  disabled?: boolean;
}

interface CardComponentProps {
  variant?: 'default' | 'outlined';
  noPadding?: boolean;
}

/**
 * Generates Material Design compliant box-shadow value based on elevation level
 * @param elevation - Number between 0 and 24
 * @param isDarkMode - Boolean indicating dark mode state
 * @returns CSS box-shadow value
 */
const getElevationShadow = (elevation: number = 1, isDarkMode: boolean = false): string => {
  const validElevation = Math.min(Math.max(elevation, 0), 24);
  
  // Base opacity values
  const ambientOpacity = isDarkMode ? 0.2 : 0.12;
  const directOpacity = isDarkMode ? 0.14 : 0.08;
  const penumbraOpacity = isDarkMode ? 0.12 : 0.06;

  // Calculate shadow values based on elevation
  const ambientY = Math.round(elevation * 1.5);
  const directY = Math.round(elevation * 2);
  const penumbraY = Math.round(elevation * 2.5);

  return `
    0px ${ambientY}px ${ambientY * 2}px rgba(0, 0, 0, ${ambientOpacity}),
    0px ${directY}px ${directY}px rgba(0, 0, 0, ${directOpacity}),
    0px ${penumbraY}px ${penumbraY * 1.5}px rgba(0, 0, 0, ${penumbraOpacity})
  `;
};

/**
 * Returns padding and layout values based on card size variant
 * @param size - Card size variant
 * @param isRTL - Right-to-left mode flag
 * @returns CSS padding and layout values
 */
const getSizeStyles = (size: 'small' | 'medium' | 'large' = 'medium', isRTL: boolean = false) => {
  const sizeMap = {
    small: theme.spacing(2),
    medium: theme.spacing(3),
    large: theme.spacing(4),
  };

  const padding = sizeMap[size];
  
  return css`
    padding: ${padding}px;
    ${isRTL ? 'margin-left' : 'margin-right'}: ${theme.spacing(2)}px;
  `;
};

// Main card container component
export const CardContainer = styled.div<CardContainerProps>`
  background-color: ${theme.palette.background.paper};
  border-radius: ${theme.shape.borderRadius}px;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  transition: box-shadow ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut};
  will-change: transform;
  
  ${({ elevation = 1, isDarkMode = false }) => css`
    box-shadow: ${getElevationShadow(elevation, isDarkMode)};
  `}
  
  ${({ size, isRTL }) => getSizeStyles(size, isRTL)}
  
  ${({ onClick, disabled }) => onClick && !disabled && css`
    cursor: pointer;
    
    &:hover {
      box-shadow: ${getElevationShadow(2, false)};
      transform: translateY(-1px);
    }
    
    &:active {
      box-shadow: ${getElevationShadow(1, false)};
      transform: translateY(0);
    }
  `}
  
  ${({ disabled }) => disabled && css`
    opacity: 0.6;
    pointer-events: none;
  `}
  
  @media (max-width: ${theme.breakpoints.values.sm}px) {
    margin: ${theme.spacing(1)}px 0;
  }
`;

// Card header component
export const CardHeader = styled.div<CardComponentProps>`
  display: flex;
  align-items: center;
  padding: ${({ noPadding }) => noPadding ? 0 : `${theme.spacing(2)}px ${theme.spacing(3)}px`};
  border-bottom: ${({ variant }) => 
    variant === 'outlined' ? `1px solid ${theme.palette.divider}` : 'none'};
`;

// Card content component
export const CardContent = styled.div<CardComponentProps>`
  padding: ${({ noPadding }) => noPadding ? 0 : `${theme.spacing(3)}px`};
  
  &:last-child {
    padding-bottom: ${({ noPadding }) => noPadding ? 0 : `${theme.spacing(3)}px`};
  }
`;

// Card footer component
export const CardFooter = styled.div<CardComponentProps>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${({ noPadding }) => noPadding ? 0 : `${theme.spacing(2)}px ${theme.spacing(3)}px`};
  border-top: ${({ variant }) => 
    variant === 'outlined' ? `1px solid ${theme.palette.divider}` : 'none'};
  
  & > * + * {
    margin-left: ${theme.spacing(1)}px;
  }
`;

export default CardContainer;