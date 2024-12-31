// External imports with versions
import { test, expect } from '@playwright/test'; // ^1.39.0
import { AxeBuilder } from 'axe-playwright'; // ^1.2.3

// Internal imports
import { messages, generateTestMessage } from '../fixtures/messages.json';
import { 
  setupTestContext, 
  cleanupTestContext,
  waitForApiResponse,
  expectToastMessage,
  TestContext,
  TestMetrics
} from '../utils/test-helpers';

// Constants for test configuration
const TEST_TIMEOUT = 120000;
const BASE_URL = 'http://localhost:3000';
const BULK_MESSAGE_THRESHOLD = 1000;
const PERFORMANCE_METRICS = {
  responseTime: 2000,
  bulkProcessingTime: 5000
};

let context: TestContext;
let metrics: TestMetrics;

test.beforeAll(async () => {
  // Initialize test context with enhanced logging and metrics
  context = await setupTestContext();
  metrics = {
    messageComposition: [],
    bulkOperations: [],
    templateRendering: [],
    accessibilityViolations: []
  };

  // Navigate to messages page
  await context.page.goto(`${BASE_URL}/messages`);

  // Ensure user is authenticated
  await context.page.waitForSelector('[data-testid="message-composer"]');
});

test.afterAll(async () => {
  // Generate performance report
  context.logger.info('Test Performance Metrics', {
    testName: 'MessageTests',
    testPhase: 'Completion',
    timestamp: new Date(),
    correlationId: 'message-tests',
    metadata: { metrics }
  });

  await cleanupTestContext(context);
});

test.describe('Message Composition', () => {
  test('should compose and send a text message with accessibility validation', async () => {
    // Run accessibility scan on message composer
    const accessibilityScan = await new AxeBuilder({ page: context.page })
      .include('[data-testid="message-composer"]')
      .analyze();

    metrics.accessibilityViolations.push(...accessibilityScan.violations);
    expect(accessibilityScan.violations).toHaveLength(0);

    // Compose message
    await context.page.fill('[data-testid="message-content"]', 'Test message content');
    await context.page.fill('[data-testid="recipient-input"]', '+1234567890');

    // Verify ARIA attributes
    await expect(context.page.locator('[data-testid="message-content"]'))
      .toHaveAttribute('aria-label', 'Message content');
    await expect(context.page.locator('[data-testid="recipient-input"]'))
      .toHaveAttribute('aria-label', 'Recipient phone number');

    // Send message
    const startTime = Date.now();
    await context.page.click('[data-testid="send-button"]');

    // Wait for API response
    const response = await waitForApiResponse(context.page, '/api/v1/messages', {
      timeout: PERFORMANCE_METRICS.responseTime
    });

    metrics.messageComposition.push({
      operation: 'send',
      duration: Date.now() - startTime
    });

    // Verify success notification
    await expectToastMessage(context.page, 'Message sent successfully', 'success');
    expect(response.status).toBe('sent');
  });

  test('should handle template-based message composition', async () => {
    // Select template
    await context.page.click('[data-testid="template-selector"]');
    await context.page.click('[data-testid="template-option-welcome"]');

    // Verify template variables are accessible
    const variables = await context.page.locator('[data-testid="template-variables"] input');
    await expect(variables).toHaveCount(2);
    await expect(variables.first()).toHaveAttribute('aria-required', 'true');

    // Fill template variables
    await context.page.fill('[data-testid="var-first_name"]', 'John');
    await context.page.fill('[data-testid="var-company_name"]', 'Test Company');

    // Preview message
    await context.page.click('[data-testid="preview-button"]');
    await expect(context.page.locator('[data-testid="preview-content"]'))
      .toContainText('Hello John');

    // Send templated message
    const startTime = Date.now();
    await context.page.click('[data-testid="send-button"]');

    const response = await waitForApiResponse(context.page, '/api/v1/messages');
    
    metrics.templateRendering.push({
      operation: 'render_and_send',
      duration: Date.now() - startTime
    });

    expect(response.status).toBe('sent');
  });
});

test.describe('Bulk Message Operations', () => {
  test('should handle large recipient sets efficiently', async () => {
    // Generate test data
    const recipients = Array.from({ length: BULK_MESSAGE_THRESHOLD }, () => ({
      phone: context.dataGenerator.generatePhoneNumber(),
      name: context.dataGenerator.generateName()
    }));

    // Upload recipients
    await context.page.setInputFiles('[data-testid="recipient-upload"]', {
      name: 'recipients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(recipients.map(r => `${r.phone},${r.name}`).join('\n'))
    });

    // Verify recipient count
    await expect(context.page.locator('[data-testid="recipient-count"]'))
      .toHaveText(`${BULK_MESSAGE_THRESHOLD} recipients`);

    // Compose bulk message
    await context.page.fill('[data-testid="message-content"]', 'Bulk test message');

    // Send bulk messages
    const startTime = Date.now();
    await context.page.click('[data-testid="send-bulk-button"]');

    // Monitor progress
    const progressBar = context.page.locator('[data-testid="send-progress"]');
    await expect(progressBar).toBeVisible();
    
    // Wait for completion
    const response = await waitForApiResponse(context.page, '/api/v1/messages/bulk/status', {
      timeout: PERFORMANCE_METRICS.bulkProcessingTime,
      validateResponse: (res) => res.status === 'completed'
    });

    metrics.bulkOperations.push({
      operation: 'bulk_send',
      recipientCount: BULK_MESSAGE_THRESHOLD,
      duration: Date.now() - startTime
    });

    // Verify results
    expect(response.results.successful).toBe(BULK_MESSAGE_THRESHOLD);
    expect(response.results.failed).toBe(0);
  });

  test('should handle message scheduling with timezone support', async () => {
    // Enable scheduling
    await context.page.click('[data-testid="schedule-toggle"]');
    
    // Set schedule time (24 hours from now)
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() + 1);
    
    await context.page.fill('[data-testid="schedule-date"]', 
      scheduleDate.toISOString().split('T')[0]);
    await context.page.fill('[data-testid="schedule-time"]', 
      scheduleDate.toTimeString().split(' ')[0]);

    // Select timezone
    await context.page.selectOption('[data-testid="timezone-select"]', 'UTC');

    // Schedule message
    const startTime = Date.now();
    await context.page.click('[data-testid="schedule-button"]');

    const response = await waitForApiResponse(context.page, '/api/v1/messages');

    metrics.messageComposition.push({
      operation: 'schedule',
      duration: Date.now() - startTime
    });

    expect(response.status).toBe('scheduled');
    expect(response.scheduledFor).toBe(scheduleDate.toISOString());
  });
});