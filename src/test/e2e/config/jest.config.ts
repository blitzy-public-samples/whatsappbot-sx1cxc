// @jest/types version: 29.6.3
// jest-playwright-preset version: 3.0.1

import type { Config } from '@jest/types';
import baseConfig from '../../jest.config';

/**
 * Jest configuration specifically for End-to-End (E2E) tests.
 * Extends the base configuration with E2E-specific settings and Playwright integration.
 * Implements comprehensive coverage tracking and enhanced reporting for E2E scenarios.
 */
const config: Config.InitialOptions = {
  // Extend selected properties from base config
  ...{
    moduleNameMapper: baseConfig.moduleNameMapper,
    transform: baseConfig.transform
  },

  // Use Playwright preset for browser automation
  preset: 'jest-playwright-preset',

  // Specify Node.js test environment
  testEnvironment: 'node',

  // Define E2E test root directory
  roots: ['<rootDir>/src/test/e2e/specs'],

  // E2E-specific setup file
  setupFilesAfterEnv: ['<rootDir>/src/test/e2e/setup.ts'],

  // Extended timeout for E2E tests (2 minutes)
  testTimeout: 120000,

  // Enable verbose output for detailed test execution information
  verbose: true,

  // Test file patterns to match
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],

  // Configure path aliases for E2E tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '^@e2e/(.*)$': '<rootDir>/src/test/e2e/$1',
    '^@fixtures/(.*)$': '<rootDir>/src/test/e2e/fixtures/$1'
  },

  // Configure test reporters for comprehensive reporting
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        outputPath: 'coverage/e2e/html/index.html',
        pageTitle: 'E2E Test Report',
        includeFailureMsg: true,
        includeConsoleLog: true,
        useCSSFile: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: 'coverage/e2e',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}-e2e',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Enable coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage/e2e',

  // Configure multiple coverage report formats
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'html'
  ],

  // Set E2E-specific coverage thresholds (70%)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Paths to exclude from coverage reporting
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/fixtures/',
    'setup.ts'
  ],

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: true
    }
  }
};

export default config;