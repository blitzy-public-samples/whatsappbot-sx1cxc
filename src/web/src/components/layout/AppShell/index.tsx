/**
 * @fileoverview Core application shell component that provides the main layout structure
 * with enhanced security monitoring, accessibility features, and responsive design.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material';
import { Container, MainContent, ContentWrapper } from './styles';
import Header from '../Header';
import Sidebar from '../Sidebar';
import { useAuth } from '../../../hooks/useAuth';

/**
 * Interface for AppShell component props
 */
interface AppShellProps {
  /** Child components to render in the main content area */
  children: React.ReactNode;
  /** Optional CSS class name */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * Interface for layout metrics tracking
 */
interface LayoutMetrics {
  contentHeight: number;
  sidebarVisible: boolean;
  lastResize: number;
  performanceMarks: {
    firstRender: number;
    contentReady: number;
  };
}

/**
 * AppShell component that implements the core application layout structure
 * with enhanced security monitoring and responsive design.
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  className,
  role = 'main',
  'aria-label': ariaLabel = 'Main application content'
}) => {
  // Theme and responsive breakpoint hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Authentication and security hooks
  const { user, sessionStatus, securityEvents } = useAuth();

  // Local state for layout management
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [layoutMetrics, setLayoutMetrics] = useState<LayoutMetrics>({
    contentHeight: 0,
    sidebarVisible: !isMobile,
    lastResize: Date.now(),
    performanceMarks: {
      firstRender: performance.now(),
      contentReady: 0
    }
  });

  /**
   * Handles sidebar visibility toggling with performance tracking
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => {
      // Track layout change metrics
      setLayoutMetrics(current => ({
        ...current,
        sidebarVisible: !prev,
        lastResize: Date.now()
      }));
      return !prev;
    });
  }, []);

  /**
   * Effect for handling responsive layout changes
   */
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
    
    // Update layout metrics
    setLayoutMetrics(current => ({
      ...current,
      sidebarVisible: !isMobile,
      lastResize: Date.now()
    }));
  }, [isMobile]);

  /**
   * Effect for monitoring security events and layout performance
   */
  useEffect(() => {
    // Mark content ready for performance tracking
    setLayoutMetrics(current => ({
      ...current,
      performanceMarks: {
        ...current.performanceMarks,
        contentReady: performance.now()
      }
    }));

    // Monitor security events
    const handleSecurityEvent = () => {
      // Implement security event handling logic
      console.warn('Security event detected:', securityEvents);
    };

    window.addEventListener('securityEvent', handleSecurityEvent);
    return () => {
      window.removeEventListener('securityEvent', handleSecurityEvent);
    };
  }, [securityEvents]);

  /**
   * Effect for handling resize events with debouncing
   */
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setLayoutMetrics(current => ({
          ...current,
          contentHeight: window.innerHeight,
          lastResize: Date.now()
        }));
      }, 250); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <Container
      className={className}
      data-testid="app-shell"
      data-sidebar-open={isSidebarOpen}
    >
      <Header 
        onMenuClick={handleSidebarToggle}
        isMobile={isMobile}
        isTablet={isTablet}
      />
      
      <Sidebar />

      <MainContent
        role={role}
        aria-label={ariaLabel}
        data-testid="main-content"
      >
        <ContentWrapper>
          {children}
        </ContentWrapper>
      </MainContent>
    </Container>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(AppShell);