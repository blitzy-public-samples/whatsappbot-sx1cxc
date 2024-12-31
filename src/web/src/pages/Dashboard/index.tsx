/**
 * @fileoverview Main dashboard page component that serves as the primary landing page
 * after authentication, displaying key metrics, recent activity, and quick actions.
 * @version 1.0.0
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Grid, 
  Paper, 
  Typography, 
  Button, 
  Skeleton 
} from '@mui/material';
import { 
  Add as AddIcon, 
  Message as MessageIcon, 
  Group as GroupIcon 
} from '@mui/icons-material';

import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';
import { Dashboard as AnalyticsDashboard } from '../../components/analytics/Dashboard';

// Interface for quick action items with role-based visibility
interface QuickAction {
  icon: React.ReactNode;
  label: string;
  path: string;
  allowedRoles: UserRole[];
  ariaLabel: string;
}

/**
 * Main dashboard page component with enhanced error handling and accessibility
 */
const Dashboard: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  // Define quick actions with role-based access control
  const quickActions: QuickAction[] = [
    {
      icon: <MessageIcon />,
      label: 'New Message',
      path: '/messages/new',
      allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
      ariaLabel: 'Create new message'
    },
    {
      icon: <GroupIcon />,
      label: 'Manage Contacts',
      path: '/contacts',
      allowedRoles: [UserRole.ADMIN, UserRole.MANAGER],
      ariaLabel: 'Manage contacts'
    },
    {
      icon: <AddIcon />,
      label: 'Create Template',
      path: '/templates/new',
      allowedRoles: [UserRole.ADMIN, UserRole.MANAGER],
      ariaLabel: 'Create new template'
    }
  ];

  // Filter quick actions based on user role
  const filteredQuickActions = quickActions.filter(
    action => user?.role && action.allowedRoles.includes(user.role)
  );

  // Handle quick action click with navigation
  const handleQuickActionClick = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <AppShell>
      <Grid container spacing={3}>
        {/* Quick Actions Section */}
        <Grid item xs={12}>
          <Typography variant="h5" component="h1" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            {filteredQuickActions.map((action) => (
              <Grid item xs={12} sm={6} md={4} key={action.path}>
                {isLoading ? (
                  <Skeleton variant="rectangular" height={100} />
                ) : (
                  <Paper
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                    onClick={() => handleQuickActionClick(action.path)}
                    role="button"
                    tabIndex={0}
                    aria-label={action.ariaLabel}
                  >
                    {action.icon}
                    <Typography
                      variant="subtitle1"
                      component="span"
                      sx={{ mt: 1 }}
                    >
                      {action.label}
                    </Typography>
                  </Paper>
                )}
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Analytics Dashboard Section */}
        <Grid item xs={12}>
          <Typography variant="h5" component="h2" gutterBottom>
            Analytics Overview
          </Typography>
          {isLoading ? (
            <Skeleton variant="rectangular" height={400} />
          ) : (
            <AnalyticsDashboard />
          )}
        </Grid>
      </Grid>
    </AppShell>
  );
});

// Display name for debugging
Dashboard.displayName = 'Dashboard';

export default Dashboard;