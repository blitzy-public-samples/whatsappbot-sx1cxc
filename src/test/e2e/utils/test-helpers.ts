// External imports with versions
import { expect, Page } from '@playwright/test'; // ^1.39.0

// Internal imports
import { TestDataGenerator } from '../../utils/test-data-generator';
import { TestLogger, LogLevel, LogContext } from '../../utils/test-logger';
import { TestDatabaseCleaner } from '../../utils/test-db-cleaner';

/**
 * Default timeout values for various operations (in milliseconds)
 */
export const DEFAULT_TIMEOUT = 30000;
export const TOAST_TIMEOUT = 5000;
export const API_RESPONSE_TIMEOUT = 10000;

/**
 * Default test configuration
 */
export const DEFAULT_CONFIG: TestConfig = {
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:4000',
  authToken: ''
};

/**
 * Toast notification types for UI assertions
 */
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Options for API response waiting
 */
export interface WaitOptions {
  timeout?: number;
  checkInterval?: number;
  validateResponse?: (response: any) => boolean;
}

/**
 * Core test context interface with enhanced type safety
 */
export interface TestContext {
  page: Page;
  dataGenerator: TestDataGenerator;
  logger: TestLogger;
  dbCleaner: TestDatabaseCleaner;
}

/**
 * Test configuration interface with validation
 */
export interface TestConfig {
  baseUrl: string;
  apiUrl: string;
  authToken: string;
}

/**
 * Sets up test context with enhanced error handling and validation
 * @param config - Test configuration
 * @returns Initialized test context
 */
export async function setupTestContext(
  config: TestConfig = DEFAULT_CONFIG
): Promise<TestContext> {
  const context: Partial<TestContext> = {};
  const logger = new TestLogger({
    level: LogLevel.INFO,
    outputFile: 'test-logs/e2e.log'
  });

  const logContext: LogContext = {
    testName: 'TestSetup',
    testPhase: 'Initialization',
    timestamp: new Date(),
    correlationId: Date.now().toString(),
    metadata: {}
  };

  try {
    // Initialize test data generator
    context.dataGenerator = new TestDataGenerator();
    logger.info('Test data generator initialized', logContext);

    // Initialize database cleaner
    context.dbCleaner = new TestDatabaseCleaner(global.knex, {
      batchSize: 1000,
      retryAttempts: 3
    });
    logger.info('Database cleaner initialized', logContext);

    // Set up logger
    context.logger = logger;

    // Configure page with custom settings
    const page = global.page;
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${config.authToken}`
    });

    // Configure request interception
    await page.route('**/*', async (route) => {
      const request = route.request();
      logger.debug(`Intercepted request: ${request.url()}`, {
        ...logContext,
        metadata: { url: request.url(), method: request.method() }
      });
      await route.continue();
    });

    context.page = page;
    logger.info('Page configuration completed', logContext);

    return context as TestContext;
  } catch (error) {
    logger.error('Failed to setup test context', error as Error, logContext);
    throw error;
  }
}

/**
 * Cleans up test context with transaction support and verification
 * @param context - Test context to clean up
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  const { logger, dbCleaner, page } = context;
  const logContext: LogContext = {
    testName: 'TestCleanup',
    testPhase: 'Cleanup',
    timestamp: new Date(),
    correlationId: Date.now().toString(),
    metadata: {}
  };

  try {
    // Clean database state
    await dbCleaner.cleanDatabase();
    logger.info('Database cleaned successfully', logContext);

    // Clear browser state
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
    await page.evaluate(() => document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    }));
    logger.info('Browser state cleared', logContext);

  } catch (error) {
    logger.error('Failed to cleanup test context', error as Error, logContext);
    throw error;
  }
}

/**
 * Waits for API response with enhanced retry and validation
 * @param page - Playwright page instance
 * @param urlPattern - URL pattern to match
 * @param options - Wait options
 * @returns API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: WaitOptions = {}
): Promise<any> {
  const {
    timeout = API_RESPONSE_TIMEOUT,
    checkInterval = 100,
    validateResponse
  } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let responseReceived = false;

    page.on('response', async (response) => {
      if (response.url().match(urlPattern)) {
        try {
          const data = await response.json();
          if (!validateResponse || validateResponse(data)) {
            responseReceived = true;
            resolve(data);
          }
        } catch (error) {
          reject(error);
        }
      }
    });

    const checkTimeout = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkTimeout);
        if (!responseReceived) {
          reject(new Error(`API response timeout: ${urlPattern}`));
        }
      }
    }, checkInterval);
  });
}

/**
 * Expects toast notification with accessibility checks
 * @param page - Playwright page instance
 * @param message - Expected toast message
 * @param type - Toast type
 */
export async function expectToastMessage(
  page: Page,
  message: string,
  type: ToastType
): Promise<void> {
  // Wait for toast to appear
  const toastLocator = page.locator(`[role="alert"][data-type="${type}"]`);
  await expect(toastLocator).toBeVisible({ timeout: TOAST_TIMEOUT });
  
  // Verify message content
  await expect(toastLocator).toContainText(message);
  
  // Verify accessibility attributes
  await expect(toastLocator).toHaveAttribute('role', 'alert');
  await expect(toastLocator).toHaveAttribute('aria-live', 'polite');
  
  // Verify toast disappears
  await expect(toastLocator).toBeHidden({ timeout: TOAST_TIMEOUT });
}