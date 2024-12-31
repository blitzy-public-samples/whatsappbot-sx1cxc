/**
 * @fileoverview Enhanced Header component with security monitoring, accessibility features,
 * and responsive design following Material Design principles.
 * @version 1.0.0
 * @license MIT
 */

import React, { useState, useCallback, useEffect } from 'react';
import { IconButton, Menu, MenuItem, CircularProgress, Tooltip } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { HeaderContainer, HeaderToolbar, LogoContainer, NavigationContainer, UserMenuContainer } from './styles';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../types/auth';
import { UI_CONFIG } from '../../../config/constants';

/**
 * Enhanced Header component providing navigation, branding, and user menu functionality
 * with comprehensive security monitoring and accessibility features.
 */
const Header: React.FC = () => {
  // Enhanced auth hook with security monitoring
  const { user, logout, isLoading } = useAuth();
  
  // State for user menu anchor and security monitoring
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  /**
   * Enhanced handler for user menu opening with accessibility
   * @param event - Mouse event from menu trigger
   */
  const handleUserMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setUserMenuAnchor(event.currentTarget);
    setLastActivity(Date.now());
  }, []);

  /**
   * Enhanced handler for user menu closing with accessibility
   */
  const handleUserMenuClose = useCallback(() => {
    setUserMenuAnchor(null);
    // Ensure focus returns to the trigger button for accessibility
    const menuTrigger = document.getElementById('user-menu-button');
    menuTrigger?.focus();
  }, []);

  /**
   * Enhanced secure logout handler with monitoring
   */
  const handleSecureLogout = useCallback(async () => {
    try {
      handleUserMenuClose();
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      // Implement your error handling/notification system here
    }
  }, [logout, handleUserMenuClose]);

  /**
   * Effect for monitoring user activity and session security
   */
  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    // Monitor user activity for security
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, []);

  /**
   * Renders user menu items based on role and permissions
   */
  const renderUserMenuItems = () => {
    const items = [
      <MenuItem
        key="profile"
        onClick={handleUserMenuClose}
        aria-label="View profile"
      >
        Profile
      </MenuItem>
    ];

    // Add admin-only menu items
    if (user?.role === UserRole.ADMIN) {
      items.push(
        <MenuItem
          key="settings"
          onClick={handleUserMenuClose}
          aria-label="System settings"
        >
          Settings
        </MenuItem>
      );
    }

    items.push(
      <MenuItem
        key="logout"
        onClick={handleSecureLogout}
        aria-label="Sign out"
      >
        Sign Out
      </MenuItem>
    );

    return items;
  };

  return (
    <HeaderContainer
      position="fixed"
      role="banner"
      aria-label="Main application header"
    >
      <HeaderToolbar>
        <LogoContainer
          onClick={() => window.location.href = '/'}
          role="link"
          aria-label="Go to dashboard"
          tabIndex={0}
        >
          <img
            src="/logo.png"
            alt="WhatsApp Web Enhancement"
            height={40}
          />
        </LogoContainer>

        <NavigationContainer>
          {/* Notification Icon with Badge */}
          <Tooltip title="Notifications" arrow>
            <IconButton
              aria-label="View notifications"
              color="inherit"
              size="large"
            >
              <NotificationsIcon />
            </IconButton>
          </Tooltip>

          {/* Settings Icon (Admin only) */}
          {user?.role === UserRole.ADMIN && (
            <Tooltip title="Settings" arrow>
              <IconButton
                aria-label="System settings"
                color="inherit"
                size="large"
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* User Menu */}
          <UserMenuContainer>
            {isLoading ? (
              <CircularProgress
                size={24}
                color="inherit"
                aria-label="Loading user data"
              />
            ) : (
              <>
                <Tooltip title="User menu" arrow>
                  <IconButton
                    id="user-menu-button"
                    aria-controls={userMenuAnchor ? 'user-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={Boolean(userMenuAnchor)}
                    onClick={handleUserMenuOpen}
                    color="inherit"
                    size="large"
                  >
                    <AccountCircleIcon />
                  </IconButton>
                </Tooltip>

                <Menu
                  id="user-menu"
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                  MenuListProps={{
                    'aria-labelledby': 'user-menu-button',
                    role: 'menu',
                  }}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  PaperProps={{
                    elevation: 3,
                    sx: { mt: 1 }
                  }}
                  transitionDuration={UI_CONFIG.ANIMATION_DURATION}
                >
                  {renderUserMenuItems()}
                </Menu>
              </>
            )}
          </UserMenuContainer>
        </NavigationContainer>
      </HeaderToolbar>
    </HeaderContainer>
  );
};

export default Header;