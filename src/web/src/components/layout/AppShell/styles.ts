// @mui/material version ^5.14.0
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { Theme } from '@mui/material';
import theme, { breakpoints, spacing } from '../../../config/theme';

// Global constants for layout measurements
export const SIDEBAR_WIDTH = '240px';
export const SIDEBAR_WIDTH_COLLAPSED = '64px';
export const CONTENT_MAX_WIDTH = '1200px';
export const HEADER_HEIGHT = '64px';

/**
 * Creates responsive styles for the root container based on theme breakpoints
 * with performance optimizations
 */
const createResponsiveContainer = (theme: Theme) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
  // Performance optimization for transitions
  willChange: 'padding-left',
  transition: theme.transitions.create(['padding-left'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  // Responsive padding adjustments
  [theme.breakpoints.up('xs')]: {
    paddingLeft: 0,
  },
  [theme.breakpoints.up('sm')]: {
    paddingLeft: SIDEBAR_WIDTH_COLLAPSED,
  },
  [theme.breakpoints.up('md')]: {
    paddingLeft: SIDEBAR_WIDTH,
  },
  // Ensure proper stacking context
  zIndex: 1,
  // Proper overflow handling
  overflowX: 'hidden',
});

/**
 * Creates responsive styles for the main content area with proper spacing
 * and transitions
 */
const createResponsiveMainContent = (theme: Theme) => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  paddingTop: HEADER_HEIGHT,
  // Responsive padding
  padding: theme.spacing(3),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(5),
  },
  // Smooth transitions for layout changes
  transition: theme.transitions.create(['padding'], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.standard,
  }),
  // Content overflow handling
  overflowX: 'auto',
  overflowY: 'auto',
  // Ensure proper height calculations
  minHeight: `calc(100vh - ${HEADER_HEIGHT})`,
});

/**
 * Root container component for the application shell with responsive behavior
 * and smooth transitions
 */
export const Container = styled(Box)(({ theme }) => ({
  ...createResponsiveContainer(theme),
}));

/**
 * Main content area container with responsive padding and content flow management
 */
export const MainContent = styled(Box)(({ theme }) => ({
  ...createResponsiveMainContent(theme),
}));

/**
 * Inner wrapper for content with max-width constraints and proper content alignment
 */
export const ContentWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  margin: '0 auto',
  // Responsive padding for content
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
  // Proper box sizing
  boxSizing: 'border-box',
  // Ensure proper content flow
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  // Performance optimization
  willChange: 'padding',
  transition: theme.transitions.create(['padding'], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.standard,
  }),
}));