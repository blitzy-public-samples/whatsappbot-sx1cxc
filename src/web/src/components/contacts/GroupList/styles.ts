import { styled } from '@mui/material/styles'; // v5.14.0
import { Paper, Box } from '@mui/material'; // v5.14.0

/**
 * Container component for the group list with responsive grid layout.
 * Implements auto-fill grid system optimized for different screen sizes.
 * Supports RTL layouts and maintains consistent spacing across breakpoints.
 */
export const GroupListContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  width: '100%',
  boxSizing: 'border-box',
  direction: 'inherit', // Preserves RTL support
  
  // Tablet and mobile optimization
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: theme.spacing(1.5),
  },
  
  // Mobile-specific adjustments
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
  },

  // Ensure smooth scrolling and GPU acceleration
  WebkitOverflowScrolling: 'touch',
  transform: 'translateZ(0)',
}));

/**
 * Interactive group item component with Material Design elevation
 * and GPU-accelerated animations. Implements accessible focus states
 * and touch-optimized interaction areas.
 */
export const GroupItem = styled(Paper)(({ theme }) => ({
  cursor: 'pointer',
  position: 'relative',
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  
  // GPU-accelerated transitions for smooth animations
  transition: theme.transitions.create(
    ['box-shadow', 'transform', 'border-color'],
    {
      duration: theme.transitions.duration.shorter,
      easing: theme.transitions.easing.easeInOut,
    }
  ),
  
  // Performance optimizations
  willChange: 'transform, box-shadow',
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
  
  // Interactive states
  '&:hover': {
    boxShadow: theme.shadows[3],
    transform: 'translateY(-2px) translateZ(0)',
  },
  
  '&:active': {
    transform: 'translateY(0) translateZ(0)',
    boxShadow: theme.shadows[2],
  },
  
  // Accessibility - focus states
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  // Selected state
  '&.selected': {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    borderStyle: 'solid',
    boxShadow: theme.shadows[2],
  },
  
  // Disabled state
  '&.disabled': {
    cursor: 'not-allowed',
    opacity: 0.7,
    boxShadow: 'none',
    '&:hover': {
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Touch device optimizations
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: theme.shadows[1],
    },
  },
  
  // Responsive adjustments
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(1.5),
  },
  
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    '&:hover': {
      transform: 'none', // Disable hover animation on mobile
    },
  },
  
  // High contrast mode support
  '@media (forced-colors: active)': {
    borderWidth: 1,
    borderStyle: 'solid',
    '&:focus-visible': {
      outline: '3px solid ButtonText',
    },
  },
}));