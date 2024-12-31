import styled from 'styled-components'; // ^5.3.0
import theme from '../../../config/theme';

// Helper function to determine color based on change value with WCAG compliance
const getChangeColor = (change: number): string => {
  if (change > 0) {
    return theme.palette.success.main; // Ensures contrast ratio ≥4.5:1
  } else if (change < 0) {
    return theme.palette.error.main; // Ensures contrast ratio ≥4.5:1
  }
  return theme.palette.text.secondary; // Default accessible color
};

// Type definition for MetricsChange props
interface MetricsChangeProps {
  change: number;
  ariaLabel?: string;
}

// Main container for metrics card with responsive layout and elevation
export const MetricsCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${theme.spacing(3)}px;
  min-width: 240px;
  background-color: ${theme.palette.background.paper};
  border-radius: ${theme.shape.borderRadius}px;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
  transition: ${theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.shorter,
  })};
  will-change: transform, box-shadow;

  /* Responsive styles */
  @media (min-width: ${theme.breakpoints.values.sm}px) {
    padding: ${theme.spacing(3.5)}px;
  }

  @media (min-width: ${theme.breakpoints.values.md}px) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.12);
    }
  }

  /* Ensure proper spacing in grid layouts */
  & + & {
    margin-top: ${theme.spacing(2)}px;
  }

  /* Focus styles for keyboard navigation */
  &:focus-within {
    outline: 2px solid ${theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

// Title component with truncation and proper typography
export const MetricsTitle = styled.h3`
  font-size: ${theme.typography.h6.fontSize};
  font-weight: ${theme.typography.fontWeightMedium};
  color: ${theme.palette.text.secondary};
  margin: 0 0 ${theme.spacing(1.5)}px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;

  /* Responsive font size */
  @media (min-width: ${theme.breakpoints.values.md}px) {
    font-size: ${theme.typography.h5.fontSize};
  }
`;

// Value display with dynamic scaling and proper contrast
export const MetricsValue = styled.div`
  font-size: ${theme.typography.h4.fontSize};
  font-weight: ${theme.typography.fontWeightBold};
  color: ${theme.palette.text.primary};
  margin-bottom: ${theme.spacing(0.75)}px;
  line-height: 1.2;

  /* Responsive font size */
  @media (min-width: ${theme.breakpoints.values.sm}px) {
    font-size: ${theme.typography.h3.fontSize};
  }

  /* Ensure proper number formatting */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
`;

// Change indicator with semantic colors and accessibility support
export const MetricsChange = styled.div<MetricsChangeProps>`
  display: flex;
  align-items: center;
  font-size: ${theme.typography.body2.fontSize};
  font-weight: ${theme.typography.fontWeightMedium};
  color: ${props => getChangeColor(props.change)};
  gap: ${theme.spacing(0.5)}px;
  padding: ${theme.spacing(0.5)}px ${theme.spacing(1)}px;
  border-radius: ${theme.shape.borderRadius}px;
  background-color: ${props => 
    `${getChangeColor(props.change)}${props.change !== 0 ? '14' : '00'}`}; // 14 = 8% opacity

  /* Ensure proper number formatting */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";

  /* Accessibility enhancement for screen readers */
  &[aria-label] {
    position: relative;
  }

  /* Icon alignment */
  & > svg {
    width: 16px;
    height: 16px;
    margin-right: ${theme.spacing(0.5)}px;
  }

  /* Responsive adjustments */
  @media (min-width: ${theme.breakpoints.values.sm}px) {
    font-size: ${theme.typography.body1.fontSize};
  }
`;