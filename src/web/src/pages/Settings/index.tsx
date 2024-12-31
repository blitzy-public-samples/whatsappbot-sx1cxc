/**
 * @fileoverview Settings page component providing comprehensive user configuration options
 * with Material Design principles, secure account management, and accessibility standards.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Switch,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControlLabel,
  Divider,
  Alert,
  Grid,
  useTheme
} from '@mui/material';
import MainLayout from '../../layouts/MainLayout';
import Card from '../../components/common/Card';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { UserRole } from '../../types/auth';

// Interfaces for settings state management
interface NotificationSettings {
  emailNotifications: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
  notificationFrequency: 'immediate' | 'hourly' | 'daily';
  quietHours: {
    start: string;
    end: string;
  };
}

interface ThemeSettings {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  colorScheme: 'default' | 'high-contrast';
  reducedMotion: boolean;
  fontFamily: 'default' | 'readable';
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  loginNotifications: boolean;
  trustedDevices: string[];
}

/**
 * Settings page component implementing user configuration options
 * with comprehensive security and accessibility features
 */
const Settings: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, updateUserPreferences } = useAuth();
  const { showSuccess, showError } = useNotifications();

  // Settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    desktopNotifications: true,
    soundEnabled: true,
    notificationFrequency: 'immediate',
    quietHours: { start: '22:00', end: '07:00' }
  });

  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    darkMode: false,
    fontSize: 'medium',
    colorScheme: 'default',
    reducedMotion: false,
    fontFamily: 'default'
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    loginNotifications: true,
    trustedDevices: []
  });

  // Load user preferences on mount
  useEffect(() => {
    if (user?.preferences) {
      const { notifications, theme, security } = user.preferences;
      if (notifications) setNotificationSettings(notifications);
      if (theme) setThemeSettings(theme);
      if (security) setSecuritySettings(security);
    }
  }, [user]);

  /**
   * Handles settings changes with validation and persistence
   */
  const handleSettingChange = useCallback(async (
    section: 'notifications' | 'theme' | 'security',
    key: string,
    value: any
  ) => {
    try {
      let updatedSettings;
      switch (section) {
        case 'notifications':
          updatedSettings = { ...notificationSettings, [key]: value };
          setNotificationSettings(updatedSettings);
          break;
        case 'theme':
          updatedSettings = { ...themeSettings, [key]: value };
          setThemeSettings(updatedSettings);
          break;
        case 'security':
          updatedSettings = { ...securitySettings, [key]: value };
          setSecuritySettings(updatedSettings);
          break;
      }

      // Persist changes
      await updateUserPreferences({
        [section]: updatedSettings
      });

      showSuccess('Settings updated successfully');
    } catch (error) {
      showError('Failed to update settings');
      console.error('Settings update error:', error);
    }
  }, [notificationSettings, themeSettings, securitySettings, updateUserPreferences, showSuccess, showError]);

  return (
    <MainLayout>
      <Box
        component="section"
        role="main"
        aria-label="Settings page"
        sx={{ padding: theme.spacing(3) }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>

        {/* Notifications Section */}
        <Card
          header={<Typography variant="h6">Notification Preferences</Typography>}
          sx={{ marginBottom: theme.spacing(3) }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                    aria-label="Toggle email notifications"
                  />
                }
                label="Email Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.desktopNotifications}
                    onChange={(e) => handleSettingChange('notifications', 'desktopNotifications', e.target.checked)}
                    aria-label="Toggle desktop notifications"
                  />
                }
                label="Desktop Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <Select
                value={notificationSettings.notificationFrequency}
                onChange={(e) => handleSettingChange('notifications', 'notificationFrequency', e.target.value)}
                fullWidth
                aria-label="Notification frequency"
              >
                <MenuItem value="immediate">Immediate</MenuItem>
                <MenuItem value="hourly">Hourly Digest</MenuItem>
                <MenuItem value="daily">Daily Digest</MenuItem>
              </Select>
            </Grid>
          </Grid>
        </Card>

        {/* Theme Section */}
        <Card
          header={<Typography variant="h6">Display Settings</Typography>}
          sx={{ marginBottom: theme.spacing(3) }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={themeSettings.darkMode}
                    onChange={(e) => handleSettingChange('theme', 'darkMode', e.target.checked)}
                    aria-label="Toggle dark mode"
                  />
                }
                label="Dark Mode"
              />
            </Grid>
            <Grid item xs={12}>
              <Select
                value={themeSettings.fontSize}
                onChange={(e) => handleSettingChange('theme', 'fontSize', e.target.value)}
                fullWidth
                aria-label="Font size"
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={themeSettings.reducedMotion}
                    onChange={(e) => handleSettingChange('theme', 'reducedMotion', e.target.checked)}
                    aria-label="Toggle reduced motion"
                  />
                }
                label="Reduced Motion"
              />
            </Grid>
          </Grid>
        </Card>

        {/* Security Section - Admin Only */}
        {user?.role === UserRole.ADMIN && (
          <Card
            header={<Typography variant="h6">Security Settings</Typography>}
            sx={{ marginBottom: theme.spacing(3) }}
          >
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.twoFactorEnabled}
                      onChange={(e) => handleSettingChange('security', 'twoFactorEnabled', e.target.checked)}
                      aria-label="Toggle two-factor authentication"
                    />
                  }
                  label="Two-Factor Authentication"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  type="number"
                  label="Session Timeout (minutes)"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                  fullWidth
                  inputProps={{
                    min: 5,
                    max: 120,
                    'aria-label': 'Session timeout in minutes'
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.loginNotifications}
                      onChange={(e) => handleSettingChange('security', 'loginNotifications', e.target.checked)}
                      aria-label="Toggle login notifications"
                    />
                  }
                  label="Login Notifications"
                />
              </Grid>
            </Grid>
          </Card>
        )}
      </Box>
    </MainLayout>
  );
};

export default Settings;