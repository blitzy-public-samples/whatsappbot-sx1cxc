// @package @reduxjs/toolkit ^1.9.7
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User, LoginCredentials, LoginResponse } from '../../types/auth';
import { authService } from '../../services/api/auth';
import { StorageService } from '../../utils/storage';
import { AUTH_CONFIG } from '../../config/constants';

// Initialize secure storage service
const storageService = new StorageService('local', {
  encryptionKey: AUTH_CONFIG.ENCRYPTION_KEY,
});

// Security event interface
interface SecurityEvent {
  type: string;
  timestamp: string;
  details: Record<string, any>;
}

// Initial state with enhanced security features
const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  lastActivity: Date.now(),
  mfaRequired: false,
  securityEvents: [],
  sessionExpiry: null,
};

// Enhanced async thunk for login with MFA support
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      
      // Store tokens securely
      await storageService.setItem(AUTH_CONFIG.TOKEN_KEY, response.token, true);
      await storageService.setItem(AUTH_CONFIG.REFRESH_TOKEN_KEY, response.refreshToken, true);
      
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
      });
    }
  }
);

// Enhanced async thunk for secure logout
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      await storageService.removeItem(AUTH_CONFIG.TOKEN_KEY);
      await storageService.removeItem(AUTH_CONFIG.REFRESH_TOKEN_KEY);
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
      });
    }
  }
);

// Enhanced async thunk for current user with session validation
export const getCurrentUserAsync = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      dispatch(updateLastActivity());
      return user;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'USER_FETCH_ERROR',
        message: error.message || 'Failed to fetch user data',
      });
    }
  }
);

// Enhanced auth slice with security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    setMfaRequired: (state, action: PayloadAction<boolean>) => {
      state.mfaRequired = action.payload;
    },
    addSecurityEvent: (state, action: PayloadAction<SecurityEvent>) => {
      state.securityEvents = [
        action.payload,
        ...state.securityEvents.slice(0, 99), // Keep last 100 events
      ];
    },
    clearSecurityEvents: (state) => {
      state.securityEvents = [];
    },
    updateSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiry = action.payload;
    },
    resetAuthState: (state) => {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(loginAsync.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.lastActivity = Date.now();
      state.sessionExpiry = Date.now() + AUTH_CONFIG.SESSION_TIMEOUT;
    });
    builder.addCase(loginAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as any;
      state.isAuthenticated = false;
    });

    // Logout handling
    builder.addCase(logoutAsync.fulfilled, (state) => {
      Object.assign(state, initialState);
    });

    // Current user handling
    builder.addCase(getCurrentUserAsync.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getCurrentUserAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload;
      state.lastActivity = Date.now();
    });
    builder.addCase(getCurrentUserAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as any;
    });
  },
});

// Export actions
export const {
  updateLastActivity,
  setMfaRequired,
  addSecurityEvent,
  clearSecurityEvents,
  updateSessionExpiry,
  resetAuthState,
} = authSlice.actions;

// Enhanced selectors with memoization potential
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectLastActivity = (state: { auth: AuthState }) => state.auth.lastActivity;
export const selectMfaRequired = (state: { auth: AuthState }) => state.auth.mfaRequired;
export const selectSecurityEvents = (state: { auth: AuthState }) => state.auth.securityEvents;
export const selectSessionExpiry = (state: { auth: AuthState }) => state.auth.sessionExpiry;

// Export reducer
export default authSlice.reducer;