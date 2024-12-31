// @ts-jest version: 29.1.1
// @jest/types version: 29.6.3

import type { Config } from '@jest/types';

/**
 * Base Jest configuration that defines comprehensive testing settings
 * including coverage reporting, TypeScript support, and module resolution.
 * This configuration serves as the foundation for all test suites.
 */
const jestConfig: Config.InitialOptions = {
  // Specify Node.js as the test environment
  testEnvironment: 'node',

  // Define test root directories for unit and integration tests
  roots: [
    '<rootDir>/src/test/unit',
    '<rootDir>/src/test/integration'
  ],

  // Global test setup file
  setupFilesAfterEnv: [
    '<rootDir>/src/test/setup.ts'
  ],

  // Set global test timeout to 60 seconds
  testTimeout: 60000,

  // Enable verbose test output
  verbose: true,

  // Test file patterns to match
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Module path aliases for clean imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '^@backend/(.*)$': '<rootDir>/src/backend/$1',
    '^@web/(.*)$': '<rootDir>/src/web/$1'
  },

  // TypeScript transformation configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Configure test reporters including JUnit for CI integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],

  // Enable coverage collection
  collectCoverage: true,
  coverageDirectory: 'coverage',

  // Configure multiple coverage report formats
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover'
  ],

  // Set coverage thresholds to ensure high test coverage
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Paths to exclude from coverage reporting
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test/e2e/',
    '/test/fixtures/'
  ],

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};

export default jestConfig;