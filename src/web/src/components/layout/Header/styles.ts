// @mui/material version ^5.14.0
import { styled } from '@mui/material/styles';
import { AppBar, Toolbar } from '@mui/material';
import { theme } from '../../../config/theme';

// Global constants for header dimensions and z-index
const HEADER_HEIGHT = '64px';
const MOBILE_HEADER_HEIGHT = '56px';
const HEADER_Z_INDEX = theme.zIndex.appBar;

/**
 * HeaderContainer - Styled AppBar component implementing Material Design principles
 * with enhanced elevation and responsive behavior.
 * Provides consistent header styling across different screen sizes.
 */
export const HeaderContainer = styled(AppBar)(({ theme }) => ({
  position: 'fixed',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  zIndex: HEADER_Z_INDEX,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),

  // Responsive height adjustments
  height: HEADER_HEIGHT,
  [theme.breakpoints.down('sm')]: {
    height: MOBILE_HEADER_HEIGHT,
  },

  // Enhanced accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

/**
 * HeaderToolbar - Styled Toolbar component with optimized spacing
 * and responsive height adjustments for different screen sizes.
 */
export const HeaderToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 3),
  minHeight: HEADER_HEIGHT,
  width: '100%',

  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 2),
    minHeight: MOBILE_HEADER_HEIGHT,
  },

  // Ensure proper spacing between elements
  '& > *:not(:last-child)': {
    marginRight: theme.spacing(2),
  },
}));

/**
 * LogoContainer - Styled div component for the logo section
 * with flex properties and responsive spacing adjustments.
 */
export const LogoContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  cursor: 'pointer',
  padding: theme.spacing(1.5, 0),

  // Responsive width adjustments
  [theme.breakpoints.up('md')]: {
    minWidth: '200px',
  },
  [theme.breakpoints.down('sm')]: {
    minWidth: '150px',
  },

  // Logo image container
  '& img': {
    height: '100%',
    width: 'auto',
    objectFit: 'contain',
  },

  // Hover effect
  '&:hover': {
    opacity: 0.9,
    transition: theme.transitions.create('opacity', {
      duration: theme.transitions.duration.shorter,
    }),
  },

  // Focus state for accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
    borderRadius: theme.shape.borderRadius,
  },
}));

/**
 * NavigationContainer - Styled div component for the main navigation section
 * with responsive display and spacing management.
 */
export const NavigationContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-end',
  gap: theme.spacing(2),

  // Responsive adjustments
  [theme.breakpoints.down('md')]: {
    gap: theme.spacing(1),
  },

  // Hide certain elements on mobile
  [theme.breakpoints.down('sm')]: {
    '& .hide-on-mobile': {
      display: 'none',
    },
  },
}));

/**
 * UserMenuContainer - Styled div component for the user menu section
 * with proper spacing and alignment.
 */
export const UserMenuContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginLeft: theme.spacing(2),
  height: '100%',

  // Responsive spacing
  [theme.breakpoints.down('sm')]: {
    marginLeft: theme.spacing(1),
  },

  // Enhanced touch target for mobile
  '& > *': {
    padding: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(0.5),
    },
  },
}));