// @mui/material version ^5.14.0
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { theme } from '../../../config/theme';

// Helper function to create responsive spacing values
const createResponsiveSpacing = (
  baseSpacing: number,
  breakpointMultipliers: { [key: string]: number }
) => {
  const base = theme.spacing(baseSpacing);
  const queries = Object.entries(breakpointMultipliers).map(([breakpoint, multiplier]) => {
    return `
      ${theme.breakpoints.up(breakpoint)} {
        padding: ${theme.spacing(baseSpacing * multiplier)};
      }
    `;
  });
  return queries.join('');
};

// Global spacing and styling constants
const containerPadding = createResponsiveSpacing(3, { xs: 1, sm: 2, md: 3 });
const sectionMargin = createResponsiveSpacing(2, { xs: 1, sm: 1.5, md: 2 });
const borderRadius = theme.shape.borderRadius;

// Main container for the message composer
export const ComposerContainer = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: theme.spacing(3),
  borderRadius: borderRadius * 2,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    borderRadius: borderRadius,
  },
}));

// Template selection section
export const TemplateSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiFormControl-root': {
    width: '100%',
  },
  [theme.breakpoints.up('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

// Recipients management section
export const RecipientsSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: borderRadius,
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  '& .recipient-list': {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  [theme.breakpoints.up('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

// Message body section
export const MessageSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .editor-container': {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: borderRadius,
    minHeight: '200px',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  [theme.breakpoints.up('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

// Attachments section
export const AttachmentsSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .upload-button': {
    marginRight: theme.spacing(2),
  },
  '& .file-list': {
    marginTop: theme.spacing(2),
  },
  [theme.breakpoints.up('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

// Schedule section
export const ScheduleSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '& .schedule-options': {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  },
  '& .datetime-inputs': {
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    flexDirection: 'column',
    [theme.breakpoints.up('sm')]: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  },
}));

// Action buttons container
export const ActionButtons = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
  marginTop: theme.spacing(4),
  '& .MuiButton-root': {
    minWidth: '120px',
  },
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    '& .MuiButton-root': {
      width: '100%',
    },
  },
}));