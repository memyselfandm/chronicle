import React from 'react';
import { SWRConfig } from 'swr';
import { createMockSWRConfig } from './supabaseMocks';

// Test providers for consistent testing environment
interface TestProvidersProps {
  children: React.ReactNode;
  swrConfig?: Record<string, any>;
  mockData?: {
    events?: any[];
    sessions?: any[];
  };
}

export const TestProviders: React.FC<TestProvidersProps> = ({
  children,
  swrConfig,
  mockData = {},
}) => {
  const defaultSWRConfig = createMockSWRConfig(
    mockData.events || [],
    null
  );

  const finalSWRConfig = {
    ...defaultSWRConfig,
    ...swrConfig,
  };

  return (
    <SWRConfig value={finalSWRConfig}>
      {children}
    </SWRConfig>
  );
};

// Theme provider for testing styled components
export const ThemeTestProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Mock theme context if needed
  return <>{children}</>;
};

// Combined providers for comprehensive testing
export const AllTestProviders: React.FC<TestProvidersProps> = (props) => {
  return (
    <ThemeTestProvider>
      <TestProviders {...props} />
    </ThemeTestProvider>
  );
};