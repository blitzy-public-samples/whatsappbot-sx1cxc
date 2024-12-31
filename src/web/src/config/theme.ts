// @mui/material version ^5.14.0
import { createTheme, Theme, ThemeOptions } from '@mui/material';

/**
 * Creates and configures the application theme following Material Design principles
 * with custom enhancements for WhatsApp Web Enhancement Application.
 * Implements comprehensive styling tokens, responsive design utilities,
 * and accessibility-compliant color schemes.
 */
const createCustomTheme = (): Theme => {
  // Base theme configuration
  const themeOptions: ThemeOptions = {
    // Color palette configuration with WCAG 2.1 AA compliant contrast ratios
    palette: {
      primary: {
        main: '#1976D2',
        light: '#42A5F5',
        dark: '#1565C0',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#424242',
        light: '#616161',
        dark: '#212121',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#D32F2F',
        light: '#EF5350',
        dark: '#C62828',
      },
      warning: {
        main: '#FFA000',
        light: '#FFB333',
        dark: '#CC8000',
      },
      success: {
        main: '#388E3C',
        light: '#4CAF50',
        dark: '#2E7D32',
      },
      info: {
        main: '#0288D1',
        light: '#03A9F4',
        dark: '#01579B',
      },
      background: {
        default: '#FFFFFF',
        paper: '#FAFAFA',
        elevated: '#F5F5F5',
      },
      text: {
        primary: 'rgba(0, 0, 0, 0.87)',
        secondary: 'rgba(0, 0, 0, 0.60)',
        disabled: 'rgba(0, 0, 0, 0.38)',
        hint: 'rgba(0, 0, 0, 0.38)',
      },
      action: {
        active: 'rgba(0, 0, 0, 0.54)',
        hover: 'rgba(0, 0, 0, 0.04)',
        selected: 'rgba(0, 0, 0, 0.08)',
        disabled: 'rgba(0, 0, 0, 0.26)',
        disabledBackground: 'rgba(0, 0, 0, 0.12)',
      },
    },

    // Typography system with Roboto font family and responsive scaling
    typography: {
      fontFamily: 'Roboto, sans-serif',
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: {
        fontSize: '2.5rem',
        fontWeight: 500,
        lineHeight: 1.167,
        letterSpacing: '-0.01562em',
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.00833em',
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 500,
        lineHeight: 1.167,
        letterSpacing: '0em',
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
        lineHeight: 1.235,
        letterSpacing: '0.00735em',
      },
      body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0.00938em',
      },
      body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: '0.01071em',
      },
      button: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.75,
        letterSpacing: '0.02857em',
        textTransform: 'uppercase',
      },
    },

    // 8px-based spacing system
    spacing: 8,

    // Breakpoints for mobile-first responsive design
    breakpoints: {
      values: {
        xs: 0,    // Mobile devices
        sm: 600,  // Tablets
        md: 960,  // Small laptops
        lg: 1280, // Desktops
        xl: 1920, // Large screens
      },
    },

    // Shape configurations for consistent component styling
    shape: {
      borderRadius: 4,
      borderRadiusSecondary: 8,
      borderRadiusLarge: 12,
    },

    // Animation and transition configurations
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },

    // Component-specific style overrides
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
            fontSize: '0.75rem',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
    },
  };

  // Create and return the theme object
  return createTheme(themeOptions);
};

// Export the configured theme
const theme = createCustomTheme();
export default theme;

// Type exports for theme customization
export type AppTheme = typeof theme;
export type AppPalette = typeof theme.palette;
export type AppTypography = typeof theme.typography;
export type AppBreakpoints = typeof theme.breakpoints;
export type AppTransitions = typeof theme.transitions;