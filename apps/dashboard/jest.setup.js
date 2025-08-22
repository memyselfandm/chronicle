import '@testing-library/jest-dom';

// Enhanced test setup with better mocking and performance measurement
import { mockIntersectionObserver, mockResizeObserver } from './src/test-utils/renderHelpers';

// Global mocks for browser APIs
global.ResizeObserver = mockResizeObserver();
global.IntersectionObserver = mockIntersectionObserver();

// Mock requestAnimationFrame for performance tests
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock performance.memory for memory leak detection
if (!('memory' in performance)) {
  Object.defineProperty(performance, 'memory', {
    value: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB baseline
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    },
    writable: true,
  });
}

// Suppress console warnings in tests (except errors)
const originalConsoleWarn = console.warn;
console.warn = (message, ...args) => {
  if (typeof message === 'string' && message.includes('act(')) {
    return; // Suppress act warnings that are handled by our test utilities
  }
  originalConsoleWarn(message, ...args);
};

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});