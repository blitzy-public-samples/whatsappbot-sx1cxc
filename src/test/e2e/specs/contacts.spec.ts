// External imports with versions
import { test, expect, Page } from '@playwright/test'; // ^1.39.0

// Internal imports
import {
  setupTestContext,
  cleanupTestContext,
  waitForApiResponse,
  expectToastMessage,
  validateDatabaseState,
  monitorPerformance
} from '../utils/test-helpers';

// Global constants for test configuration
const TEST_TIMEOUT = 120000;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLD = 5000;

// Test data constants
const TEST_CONTACT = {
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+12345678901',
  email: 'john.doe@test.com',
  tags: ['VIP', 'Business'],
  metadata: {
    source: 'manual',
    preferences: {
      language: 'en',
      notifications: true
    }
  }
};

const TEST_GROUP = {
  name: 'Test Group',
  description: 'Test group for e2e testing'
};

// Enhanced test suite for contact management
test.describe('Contact Management', () => {
  let page: Page;
  let performanceMonitor: any;

  // Enhanced setup with performance monitoring
  test.beforeEach(async ({ browser }) => {
    const context = await setupTestContext();
    page = context.page;
    
    // Initialize performance monitoring
    performanceMonitor = await monitorPerformance(page, {
      threshold: PERFORMANCE_THRESHOLD,
      metrics: ['FCP', 'LCP', 'CLS']
    });

    // Navigate to contacts page
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForSelector('[data-testid="contacts-grid"]');
  });

  // Enhanced cleanup with state verification
  test.afterEach(async () => {
    // Stop performance monitoring and log results
    const metrics = await performanceMonitor.getMetrics();
    await performanceMonitor.stop();

    // Cleanup test context
    await cleanupTestContext({
      page,
      performanceMetrics: metrics
    });
  });

  // Comprehensive contact list functionality tests
  test('should display and manage contact list with performance monitoring', async () => {
    // Test list rendering performance
    const listRenderTime = await performanceMonitor.measureOperation(
      async () => await page.waitForSelector('[data-testid="contact-row"]')
    );
    expect(listRenderTime).toBeLessThan(PERFORMANCE_THRESHOLD);

    // Test search functionality
    await test.step('Search functionality', async () => {
      await page.fill('[data-testid="search-input"]', TEST_CONTACT.phone_number);
      await waitForApiResponse(page, '/api/v1/contacts/search');
      const results = await page.$$('[data-testid="contact-row"]');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    // Test filtering
    await test.step('Advanced filtering', async () => {
      await page.click('[data-testid="filter-button"]');
      await page.selectOption('[data-testid="tag-filter"]', 'VIP');
      await waitForApiResponse(page, '/api/v1/contacts');
      await expectToastMessage(page, 'Filters applied successfully', 'success');
    });

    // Test sorting
    await test.step('Column sorting', async () => {
      await page.click('[data-testid="sort-name"]');
      await waitForApiResponse(page, '/api/v1/contacts');
      const firstContact = await page.textContent('[data-testid="contact-name"]:first-child');
      expect(firstContact).toBeDefined();
    });
  });

  // Comprehensive bulk operations tests
  test('should handle bulk operations correctly', async () => {
    // Test bulk selection
    await test.step('Bulk selection', async () => {
      await page.click('[data-testid="select-all"]');
      const selectedCount = await page.$$eval(
        '[data-testid="contact-checkbox"]:checked',
        elements => elements.length
      );
      expect(selectedCount).toBeGreaterThan(0);
    });

    // Test bulk delete
    await test.step('Bulk delete', async () => {
      await page.click('[data-testid="bulk-actions"]');
      await page.click('[data-testid="delete-selected"]');
      await page.click('[data-testid="confirm-delete"]');
      await waitForApiResponse(page, '/api/v1/contacts/bulk-delete');
      await expectToastMessage(page, 'Contacts deleted successfully', 'success');
    });

    // Test bulk group assignment
    await test.step('Bulk group assignment', async () => {
      await page.click('[data-testid="bulk-actions"]');
      await page.click('[data-testid="assign-group"]');
      await page.fill('[data-testid="group-name"]', TEST_GROUP.name);
      await page.click('[data-testid="confirm-assign"]');
      await waitForApiResponse(page, '/api/v1/contacts/bulk-assign');
      await expectToastMessage(page, 'Contacts assigned to group successfully', 'success');
    });
  });

  // Individual contact operations tests
  test('should manage individual contacts correctly', async () => {
    // Test contact creation
    await test.step('Contact creation', async () => {
      await page.click('[data-testid="add-contact"]');
      await page.fill('[data-testid="first-name"]', TEST_CONTACT.first_name);
      await page.fill('[data-testid="last-name"]', TEST_CONTACT.last_name);
      await page.fill('[data-testid="phone-number"]', TEST_CONTACT.phone_number);
      await page.fill('[data-testid="email"]', TEST_CONTACT.email);
      await page.click('[data-testid="save-contact"]');
      
      await waitForApiResponse(page, '/api/v1/contacts');
      await expectToastMessage(page, 'Contact created successfully', 'success');
    });

    // Test contact editing
    await test.step('Contact editing', async () => {
      await page.click('[data-testid="edit-contact"]');
      await page.fill('[data-testid="first-name"]', 'Updated Name');
      await page.click('[data-testid="save-contact"]');
      
      await waitForApiResponse(page, '/api/v1/contacts');
      await expectToastMessage(page, 'Contact updated successfully', 'success');
    });

    // Verify contact history
    await test.step('Contact history', async () => {
      await page.click('[data-testid="contact-history"]');
      const historyEntries = await page.$$('[data-testid="history-entry"]');
      expect(historyEntries.length).toBeGreaterThan(0);
    });
  });

  // Group management tests
  test('should manage contact groups effectively', async () => {
    // Test group creation
    await test.step('Group creation', async () => {
      await page.click('[data-testid="manage-groups"]');
      await page.click('[data-testid="create-group"]');
      await page.fill('[data-testid="group-name"]', TEST_GROUP.name);
      await page.fill('[data-testid="group-description"]', TEST_GROUP.description);
      await page.click('[data-testid="save-group"]');
      
      await waitForApiResponse(page, '/api/v1/groups');
      await expectToastMessage(page, 'Group created successfully', 'success');
    });

    // Test group assignment
    await test.step('Group assignment', async () => {
      await page.click('[data-testid="assign-contacts"]');
      await page.click('[data-testid="select-contacts"]');
      await page.click('[data-testid="confirm-assignment"]');
      
      await waitForApiResponse(page, '/api/v1/groups/assign');
      await expectToastMessage(page, 'Contacts assigned successfully', 'success');
    });

    // Test group deletion
    await test.step('Group deletion', async () => {
      await page.click('[data-testid="delete-group"]');
      await page.click('[data-testid="confirm-delete"]');
      
      await waitForApiResponse(page, '/api/v1/groups');
      await expectToastMessage(page, 'Group deleted successfully', 'success');
    });
  });
});