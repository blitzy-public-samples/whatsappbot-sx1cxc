import React, { useCallback, useMemo, useState, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaQuery, Collapse } from '@mui/material';
import {
  DashboardIcon,
  ContactsIcon,
  MessageIcon,
  TemplateIcon,
  AnalyticsIcon,
  SettingsIcon,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { SidebarContainer, NavList, NavItem, GroupSection, BottomNav } from './styles';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../types/auth';
import { BREAKPOINTS } from '../../../config/constants';

// Route paths constant for centralized management
const ROUTE_PATHS = {
  DASHBOARD: '/dashboard',
  CONTACTS: '/contacts',
  MESSAGES: '/messages',
  TEMPLATES: '/templates',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings'
} as const;

// Interface for navigation items
interface NavigationItem {
  route: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  ariaLabel: string;
}

/**
 * Custom hook to manage navigation items based on user roles
 * @param user - Current user object
 * @returns Filtered list of navigation items
 */
const useNavigationItems = (user: any) => {
  return useMemo(() => {
    const baseItems: NavigationItem[] = [
      {
        route: ROUTE_PATHS.DASHBOARD,
        label: 'Dashboard',
        icon: <DashboardIcon />,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.VIEWER],
        ariaLabel: 'Navigate to Dashboard'
      },
      {
        route: ROUTE_PATHS.MESSAGES,
        label: 'Messages',
        icon: <MessageIcon />,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
        ariaLabel: 'Navigate to Messages'
      },
      {
        route: ROUTE_PATHS.CONTACTS,
        label: 'Contacts',
        icon: <ContactsIcon />,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
        ariaLabel: 'Navigate to Contacts'
      },
      {
        route: ROUTE_PATHS.TEMPLATES,
        label: 'Templates',
        icon: <TemplateIcon />,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        ariaLabel: 'Navigate to Templates'
      },
      {
        route: ROUTE_PATHS.ANALYTICS,
        label: 'Analytics',
        icon: <AnalyticsIcon />,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        ariaLabel: 'Navigate to Analytics'
      },
      {
        route: ROUTE_PATHS.SETTINGS,
        label: 'Settings',
        icon: <SettingsIcon />,
        roles: [UserRole.ADMIN],
        ariaLabel: 'Navigate to Settings'
      }
    ];

    // Filter items based on user role
    return baseItems.filter(item => 
      user?.role && item.roles.includes(user.role)
    );
  }, [user?.role]);
};

/**
 * Sidebar component that implements the application's main navigation
 * with responsive behavior and role-based access control
 */
const Sidebar: React.FC = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Responsive layout detection
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width: ${BREAKPOINTS.MD}px)`);

  // Get filtered navigation items based on user role
  const navigationItems = useNavigationItems(user);

  /**
   * Handles navigation item click with analytics tracking
   */
  const handleNavigation = useCallback((route: string, event: React.MouseEvent) => {
    event.preventDefault();
    
    // Close mobile menu if applicable
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }

    // Navigate to the selected route
    navigate(route);
  }, [navigate, isMobile]);

  /**
   * Toggles group expansion state
   */
  const toggleGroups = useCallback(() => {
    setGroupsExpanded(prev => !prev);
  }, []);

  // Early return if not authenticated
  if (!isAuthenticated) return null;

  return (
    <SidebarContainer
      role="navigation"
      aria-label="Main navigation"
      data-expanded={isMobileMenuOpen}
      data-testid="sidebar"
    >
      <NavList>
        {navigationItems.map((item) => (
          <NavItem
            key={item.route}
            onClick={(e) => handleNavigation(item.route, e)}
            aria-selected={location.pathname === item.route}
            aria-label={item.ariaLabel}
            role="menuitem"
            tabIndex={0}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavItem>
        ))}
      </NavList>

      {/* Groups section - Only visible for roles with contact management */}
      {user?.role && [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT].includes(user.role) && (
        <GroupSection>
          <h3>
            Groups
            <button
              onClick={toggleGroups}
              aria-expanded={groupsExpanded}
              aria-label={groupsExpanded ? 'Collapse groups' : 'Expand groups'}
            >
              {groupsExpanded ? <ExpandLess /> : <ExpandMore />}
            </button>
          </h3>
          <Collapse in={groupsExpanded}>
            <NavList>
              <NavItem
                onClick={(e) => handleNavigation('/groups/marketing', e)}
                aria-selected={location.pathname === '/groups/marketing'}
                role="menuitem"
                tabIndex={0}
              >
                Marketing
              </NavItem>
              <NavItem
                onClick={(e) => handleNavigation('/groups/support', e)}
                aria-selected={location.pathname === '/groups/support'}
                role="menuitem"
                tabIndex={0}
              >
                Support
              </NavItem>
              <NavItem
                onClick={(e) => handleNavigation('/groups/sales', e)}
                aria-selected={location.pathname === '/groups/sales'}
                role="menuitem"
                tabIndex={0}
              >
                Sales
              </NavItem>
            </NavList>
          </Collapse>
        </GroupSection>
      )}

      {/* Mobile navigation toggle */}
      {isMobile && (
        <BottomNav>
          <button
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            Menu
          </button>
        </BottomNav>
      )}
    </SidebarContainer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;