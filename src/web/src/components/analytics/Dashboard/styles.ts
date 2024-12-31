// @mui/material/styles version ^5.14.0
import { styled } from '@mui/material/styles';
// @mui/material version ^5.14.0
import { Box, Paper } from '@mui/material';

/**
 * Main container for the analytics dashboard
 * Implements responsive width constraints and consistent padding
 * Adapts padding for mobile viewports
 */
export const DashboardContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  width: '100%',
  maxWidth: theme.breakpoints.values.xl,
  margin: '0 auto',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2)
  }
}));

/**
 * Container for time range filter controls
 * Provides flexible layout with responsive wrapping
 * Maintains consistent spacing between filter elements
 */
export const FilterContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'stretch'
  }
}));

/**
 * Grid container for metrics cards
 * Implements auto-fit responsive layout with minimum card width
 * Maintains consistent gap spacing between cards
 */
export const MetricsContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: theme.spacing(3),
  marginBottom: theme.spacing(4),
  width: '100%',
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2)
  }
}));

/**
 * Enhanced container for chart components
 * Provides consistent elevation and responsive padding
 * Implements Material Design surface styling
 */
export const ChartContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  width: '100%',
  transition: theme.transitions.create(['box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[2]
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2)
  }
}));

/**
 * Container for table components within the dashboard
 * Provides horizontal scrolling for responsive table display
 */
export const TableContainer = styled(Box)(({ theme }) => ({
  overflowX: 'auto',
  width: '100%',
  marginBottom: theme.spacing(3),
  '& table': {
    minWidth: 650
  }
}));

/**
 * Container for dashboard header section
 * Implements flexible layout for title and actions
 */
export const HeaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start'
  }
}));

/**
 * Container for individual metric card content
 * Provides consistent internal spacing and layout
 */
export const MetricCardContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  height: '100%',
  '& .metric-value': {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.primary.main
  },
  '& .metric-label': {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize
  }
}));