// External imports with versions
import { PlaywrightTestConfig, devices } from '@playwright/test'; // ^1.39.0

// Internal imports
import { waitForPageLoad } from '../utils/test-helpers';

/**
 * Environment variables with defaults for different execution contexts
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CI = process.env.CI === 'true';
const DEBUG = process.env.DEBUG === 'true';
const TEST_ENV = process.env.TEST_ENV || 'local';

/**
 * Comprehensive Playwright configuration for WhatsApp Web Enhancement Application
 * Supports multiple browsers, devices, and execution environments
 */
const config: PlaywrightTestConfig = {
  // Test directory and file patterns
  testDir: '../specs',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // CI-specific settings
  forbidOnly: CI, // Fail if test.only is present in CI
  retries: {
    runMode: CI ? 3 : 2, // More retries in CI
    ci: 3,
  },
  workers: {
    default: CI ? 8 : 4, // Increased parallelization in CI
    ci: 8,
  },

  // Comprehensive reporting configuration
  reporter: [
    ['list'], // Console output
    [
      'html', // HTML report with screenshots and traces
      {
        outputFolder: '../../coverage/e2e/html',
        attachments: true,
        open: 'never',
      },
    ],
    [
      'junit', // JUnit XML for CI integration
      {
        outputFile: '../../coverage/e2e/junit.xml',
        attachments: true,
      },
    ],
    [
      'json', // JSON report for programmatic analysis
      {
        outputFile: '../../coverage/e2e/test-results.json',
      },
    ],
  ],

  // Global test configuration
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry', // Trace only on retry for efficiency
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
  },

  // Multi-browser and device testing configuration
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
          headless: true,
          chromiumSandbox: false,
        },
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: {
            // Enable fake media devices for testing
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        launchOptions: {
          args: ['--disable-gpu'],
        },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--disable-gpu'],
        },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12'],
        launchOptions: {
          args: ['--disable-gpu'],
        },
      },
    },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run start:test',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !CI,
  },
};

export default config;