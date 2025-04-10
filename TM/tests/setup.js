/**
 * Jest setup file
 * Runs before each test file
 */

// Silence console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DEBUG = '0';

// Mock process.exit
process.exit = jest.fn();

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
