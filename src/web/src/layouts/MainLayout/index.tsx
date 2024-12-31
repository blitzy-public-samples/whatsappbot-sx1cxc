/**
 * @fileoverview Main layout component that provides the core application structure
 * with responsive behavior, authentication protection, and consistent layout across
 * protected routes. Implements Material Design principles and accessibility standards.
 * @version 1.0.0
 * @license MIT
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { BREAKPOINTS } from '../../config/constants';

/**
 * Props interface for MainLayout component
 */
interface MainLayoutProps {
  /** Child components to render in the main content area */
  children: React.ReactNode;
  /** Optional CSS class name */
  className?: string;
  /** Optional flag to control sidebar visibility */
  showSidebar?: boolean;
}

/**
 * MainLayout component that provides authenticated layout structure with responsive behavior
 * and consistent styling across protected routes.
 */
const MainLayout: React.FC<MainLayoutProps> = memo(({
  children,
  className,
  showSidebar = true
}) => {
  // Authentication state management
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Responsive layout management
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width:${BREAKPOINTS.MD}px)`);
  
  // Local state for layout management
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [layoutMetrics, setLayoutMetrics] = useState({
    contentHeight: window.innerHeight,
    lastResize: Date.now()
  });

  /**
   * Handles sidebar toggle with state management
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  /**
   * Effect for handling responsive layout changes
   */
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  /**
   * Effect for handling window resize events with debouncing
   */
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setLayoutMetrics({
          contentHeight: window.innerHeight,
          lastResize: Date.now()
        });
      }, 250); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <AppShell
        className={className}
        role="progressbar"
        aria-label="Loading application"
      >
        {/* Loading state handled by AppShell */}
      </AppShell>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/auth/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return (
    <AppShell
      className={className}
      role="main"
      aria-label="Main application layout"
      data-testid="main-layout"
    >
      <Header
        onMenuClick={handleSidebarToggle}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      {showSidebar && (
        <Sidebar />
      )}

      <main
        role="main"
        aria-label="Main content"
        style={{
          minHeight: layoutMetrics.contentHeight,
          paddingLeft: isSidebarOpen && !isMobile ? '280px' : '0', // Match SIDEBAR_WIDTH from styles
          transition: 'padding-left 0.3s ease-in-out'
        }}
      >
        {children}
      </main>
    </AppShell>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;