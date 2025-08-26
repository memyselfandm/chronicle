const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jsdom',
  
  // Coverage configuration
  collectCoverage: false, // Set to true in CI or with --coverage flag
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
    '!src/lib/mockData.ts',
    '!src/types/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/public/',
    '/tmp/',
  ],
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
    'json',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    // Component-specific thresholds (90% as required)
    'src/components/**/*.{ts,tsx}': {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    // Hooks require higher coverage
    'src/hooks/**/*.{ts,tsx}': {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    // Core lib modules are critical
    'src/lib/**/*.{ts,tsx}': {
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);