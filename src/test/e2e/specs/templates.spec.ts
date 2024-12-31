// External imports with versions
import { test, expect } from '@playwright/test'; // ^1.39.0

// Internal imports
import { setupTestContext, cleanupTestContext, waitForApiResponse, expectToastMessage } from '../utils/test-helpers';
import { templates } from '../fixtures/templates.json';

// Constants for test configuration
const TEST_TIMEOUT = 60000;
const RETRY_OPTIONS = {
  maxRetries: 3,
  backoff: 'exponential'
};

// Test suite for template management
test.describe('Template Management', () => {
  // Setup test context before each test
  test.beforeEach(async ({ page }) => {
    await setupTestContext({
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      apiUrl: process.env.API_URL || 'http://localhost:4000',
      authToken: process.env.AUTH_TOKEN || ''
    });

    // Navigate to templates page
    await page.goto('/templates');
    await page.waitForSelector('[data-testid="templates-list"]');
  });

  // Cleanup after each test
  test.afterEach(async ({ page }) => {
    await cleanupTestContext({
      page,
      dataCleanup: true,
      stateReset: true
    });
  });

  // Test template creation
  test('should create a new template with variables', async ({ page }) => {
    const testTemplate = templates[0];

    // Click create template button
    await page.click('[data-testid="create-template-btn"]');
    await page.waitForSelector('[data-testid="template-form"]');

    // Fill template details
    await page.fill('[data-testid="template-name"]', testTemplate.name);
    await page.fill('[data-testid="template-content"]', testTemplate.content);
    
    // Add variables
    for (const variable of testTemplate.variables) {
      await page.click('[data-testid="add-variable-btn"]');
      await page.fill('[data-testid="variable-name"]', variable.name);
      await page.selectOption('[data-testid="variable-type"]', variable.type);
      await page.fill('[data-testid="variable-default"]', variable.defaultValue || '');
      
      if (variable.validation) {
        await page.fill('[data-testid="variable-validation"]', 
          JSON.stringify(variable.validation));
      }
    }

    // Save template
    await page.click('[data-testid="save-template-btn"]');

    // Wait for API response
    const response = await waitForApiResponse(page, '/api/v1/templates', {
      timeout: 10000,
      validateResponse: (res) => res.success === true
    });

    // Verify success message
    await expectToastMessage(page, 'Template created successfully', 'success');

    // Verify template appears in list
    await expect(page.locator(`[data-testid="template-${response.data.id}"]`))
      .toBeVisible();
  });

  // Test template editing
  test('should edit existing template with version control', async ({ page }) => {
    const testTemplate = templates[1];

    // Select existing template
    await page.click(`[data-testid="template-${testTemplate.id}"]`);
    await page.waitForSelector('[data-testid="template-form"]');

    // Verify current version
    await expect(page.locator('[data-testid="template-version"]'))
      .toHaveText(String(testTemplate.version));

    // Modify template
    const updatedName = `${testTemplate.name} Updated`;
    await page.fill('[data-testid="template-name"]', updatedName);

    // Update variables
    const newVariable = {
      name: 'newField',
      type: 'text',
      required: true,
      defaultValue: ''
    };

    await page.click('[data-testid="add-variable-btn"]');
    await page.fill('[data-testid="variable-name"]', newVariable.name);
    await page.selectOption('[data-testid="variable-type"]', newVariable.type);

    // Save changes
    await page.click('[data-testid="save-template-btn"]');

    // Verify success message
    await expectToastMessage(page, 'Template updated successfully', 'success');

    // Verify version increment
    await expect(page.locator('[data-testid="template-version"]'))
      .toHaveText(String(testTemplate.version + 1));
  });

  // Test template validation
  test('should validate template fields and variables', async ({ page }) => {
    await page.click('[data-testid="create-template-btn"]');

    // Try to save without required fields
    await page.click('[data-testid="save-template-btn"]');
    await expect(page.locator('[data-testid="name-error"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="content-error"]'))
      .toBeVisible();

    // Test variable validation
    await page.click('[data-testid="add-variable-btn"]');
    await page.selectOption('[data-testid="variable-type"]', 'number');
    await page.fill('[data-testid="variable-validation"]', 
      JSON.stringify({ min: 100, max: 50 })); // Invalid range

    await page.click('[data-testid="save-template-btn"]');
    await expect(page.locator('[data-testid="variable-validation-error"]'))
      .toBeVisible();
  });

  // Test template deletion
  test('should delete template with confirmation', async ({ page }) => {
    const testTemplate = templates[2];

    // Select template to delete
    await page.click(`[data-testid="template-${testTemplate.id}"]`);
    await page.click('[data-testid="delete-template-btn"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete-btn"]');

    // Verify success message
    await expectToastMessage(page, 'Template deleted successfully', 'success');

    // Verify template removed from list
    await expect(page.locator(`[data-testid="template-${testTemplate.id}"]`))
      .not.toBeVisible();
  });

  // Test template preview
  test('should preview template with sample data', async ({ page }) => {
    const testTemplate = templates[3];

    // Select template
    await page.click(`[data-testid="template-${testTemplate.id}"]`);
    await page.click('[data-testid="preview-template-btn"]');

    // Fill sample data
    for (const variable of testTemplate.variables) {
      const sampleValue = variable.defaultValue || 'Sample Value';
      await page.fill(
        `[data-testid="preview-variable-${variable.name}"]`,
        String(sampleValue)
      );
    }

    // Generate preview
    await page.click('[data-testid="generate-preview-btn"]');

    // Verify preview content
    await expect(page.locator('[data-testid="preview-content"]'))
      .toBeVisible();
  });

  // Test template search and filtering
  test('should search and filter templates', async ({ page }) => {
    // Search by name
    await page.fill('[data-testid="template-search"]', 'Welcome');
    await expect(page.locator('[data-testid="templates-list"]'))
      .toContainText('Welcome Message');

    // Filter by category
    await page.selectOption('[data-testid="category-filter"]', 'marketing');
    await expect(page.locator('[data-testid="templates-list"]'))
      .toContainText('Special Offer');

    // Clear filters
    await page.click('[data-testid="clear-filters-btn"]');
    await expect(page.locator('[data-testid="templates-list"] > *'))
      .toHaveCount(templates.length);
  });
});