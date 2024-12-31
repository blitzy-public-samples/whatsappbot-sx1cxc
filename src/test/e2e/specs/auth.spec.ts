// External imports with versions
import { test, expect } from '@playwright/test'; // ^1.39.0

// Internal imports
import {
  setupTestContext,
  cleanupTestContext,
  waitForApiResponse,
  expectToastMessage,
  TestContext,
  ToastType
} from '../utils/test-helpers';

// Test timeout constant
const TEST_TIMEOUT = 30000;

// Test data constants
const TEST_CREDENTIALS = {
  validUser: {
    email: 'test.user@example.com',
    password: 'ValidP@ssw0rd123'
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'WrongPassword'
  }
};

const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_templates', 'view_analytics'],
  manager: ['manage_templates', 'view_analytics'],
  agent: ['use_templates', 'view_own_analytics'],
  viewer: ['view_own_analytics']
};

let context: TestContext;

test.beforeEach(async () => {
  context = await setupTestContext();
  
  // Clear existing auth state
  await context.page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Initialize test users with different roles
  const { dataGenerator } = context;
  context.testUsers = {
    admin: await dataGenerator.generateUser({ role: 'admin' }),
    manager: await dataGenerator.generateUser({ role: 'manager' }),
    agent: await dataGenerator.generateUser({ role: 'agent' }),
    viewer: await dataGenerator.generateUser({ role: 'viewer' })
  };
});

test.afterEach(async () => {
  await cleanupTestContext(context);
});

test.describe('Authentication Flow', () => {
  test('should successfully login with valid credentials', async () => {
    const { page } = context;

    // Navigate to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.validUser.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.validUser.password);

    // Submit form and wait for response
    const responsePromise = waitForApiResponse(page, '/api/v1/auth/login');
    await page.click('[data-testid="login-button"]');
    const response = await responsePromise;

    // Verify successful login
    expect(response.status).toBe('success');
    expect(response.data.token).toBeTruthy();

    // Verify JWT token storage
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);

    // Verify security headers
    const headers = await page.evaluate(() => {
      const token = localStorage.getItem('auth_token');
      return {
        authorization: `Bearer ${token}`,
        'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      };
    });
    expect(headers.authorization).toBeTruthy();
    expect(headers['x-csrf-token']).toBeTruthy();

    // Verify redirect to dashboard
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Verify success toast
    await expectToastMessage(page, 'Successfully logged in', ToastType.SUCCESS);
  });

  test('should handle invalid login attempts', async () => {
    const { page } = context;

    await page.goto('/login');

    // Test with invalid credentials
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.invalidUser.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.invalidUser.password);

    await page.click('[data-testid="login-button"]');

    // Verify error message
    await expectToastMessage(page, 'Invalid email or password', ToastType.ERROR);

    // Verify we stay on login page
    expect(page.url()).toContain('/login');

    // Verify no token is stored
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeNull();
  });

  test('should handle token expiration and refresh', async () => {
    const { page, authHelpers } = context;

    // Login and get initial token
    await authHelpers.loginUser(TEST_CREDENTIALS.validUser);
    const initialToken = await page.evaluate(() => localStorage.getItem('auth_token'));

    // Simulate token expiration
    await page.evaluate(() => {
      const expiredToken = 'expired.token.signature';
      localStorage.setItem('auth_token', expiredToken);
    });

    // Attempt to access protected route
    const responsePromise = waitForApiResponse(page, '/api/v1/auth/refresh');
    await page.goto('/dashboard');
    const response = await responsePromise;

    // Verify token refresh
    expect(response.status).toBe('success');
    const newToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(initialToken);

    // Verify continued access
    expect(page.url()).toContain('/dashboard');
  });
});

test.describe('Authorization Controls', () => {
  test('should enforce role-based access restrictions', async () => {
    const { page, authHelpers } = context;

    // Test access for different roles
    for (const [role, user] of Object.entries(context.testUsers)) {
      // Login as user
      await authHelpers.loginUser(user);

      // Test access to different routes
      for (const [permission, routes] of Object.entries(ROLE_PERMISSIONS)) {
        for (const route of routes) {
          await page.goto(`/${route}`);
          
          if (ROLE_PERMISSIONS[role].includes(permission)) {
            // Should have access
            expect(page.url()).toContain(route);
            expect(await page.locator('[data-testid="access-denied"]').count()).toBe(0);
          } else {
            // Should be denied
            await expectToastMessage(page, 'Access denied', ToastType.ERROR);
            expect(await page.locator('[data-testid="access-denied"]').isVisible()).toBe(true);
          }
        }
      }

      // Logout for next user
      await authHelpers.logout();
    }
  });

  test('should handle dynamic permission updates', async () => {
    const { page, authHelpers } = context;
    const testUser = context.testUsers.agent;

    // Login as agent
    await authHelpers.loginUser(testUser);

    // Verify initial permissions
    const initialPermissions = await authHelpers.getUserPermissions();
    expect(initialPermissions).toEqual(ROLE_PERMISSIONS.agent);

    // Update user permissions
    await authHelpers.updateUserPermissions(testUser.id, [...ROLE_PERMISSIONS.agent, 'new_permission']);

    // Verify permission update is reflected
    const updatedPermissions = await authHelpers.getUserPermissions();
    expect(updatedPermissions).toContain('new_permission');

    // Verify access with new permission
    await page.goto('/new-feature');
    expect(page.url()).toContain('/new-feature');
  });
});

test.describe('Session Management', () => {
  test('should handle concurrent sessions correctly', async () => {
    const { page, authHelpers } = context;
    const secondContext = await context.browser.newContext();
    const secondPage = await secondContext.newPage();

    // Login on first browser
    await authHelpers.loginUser(TEST_CREDENTIALS.validUser);
    const firstToken = await page.evaluate(() => localStorage.getItem('auth_token'));

    // Login on second browser
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email-input"]', TEST_CREDENTIALS.validUser.email);
    await secondPage.fill('[data-testid="password-input"]', TEST_CREDENTIALS.validUser.password);
    await secondPage.click('[data-testid="login-button"]');

    // Verify second login invalidates first session
    await page.reload();
    const newFirstToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(newFirstToken).not.toBe(firstToken);
    await expectToastMessage(page, 'Session expired', ToastType.WARNING);

    // Cleanup
    await secondContext.close();
  });

  test('should handle session timeout correctly', async () => {
    const { page, authHelpers } = context;

    // Login
    await authHelpers.loginUser(TEST_CREDENTIALS.validUser);

    // Simulate session timeout
    await page.evaluate(() => {
      const event = new Event('sessionTimeout');
      window.dispatchEvent(event);
    });

    // Verify timeout handling
    await expectToastMessage(page, 'Session expired', ToastType.WARNING);
    expect(page.url()).toContain('/login');

    // Verify cleanup
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeNull();
  });
});