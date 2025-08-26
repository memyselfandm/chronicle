import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { act } from '@testing-library/react';

// Enhanced render function with SWR provider and better async handling
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  swrConfig?: Record<string, any>;
  initialState?: Record<string, any>;
}

const AllTheProviders = ({ 
  children, 
  swrConfig = {},
  initialState = {} 
}: { 
  children: React.ReactNode;
  swrConfig?: Record<string, any>;
  initialState?: Record<string, any>;
}) => {
  const defaultSWRConfig = {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
    provider: () => new Map(),
    ...swrConfig,
  };

  return (
    <SWRConfig value={defaultSWRConfig}>
      {children}
    </SWRConfig>
  );
};

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const { swrConfig, initialState, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders swrConfig={swrConfig} initialState={initialState}>
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Async test helpers
export const waitForAsync = async (callback: () => void | Promise<void>) => {
  await act(async () => {
    await callback();
  });
};

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Component testing helpers
export const getByTestId = (container: HTMLElement, testId: string) => {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Unable to find an element by: [data-testid="${testId}"]`);
  }
  return element;
};

export const queryByTestId = (container: HTMLElement, testId: string) => {
  return container.querySelector(`[data-testid="${testId}"]`);
};

// Performance measurement helpers
export const measureRenderTime = async (renderFn: () => Promise<RenderResult> | RenderResult) => {
  const start = performance.now();
  const result = await renderFn();
  const end = performance.now();
  return {
    result,
    renderTime: end - start,
  };
};

// Accessibility testing helpers
export const checkAccessibility = (container: HTMLElement) => {
  // Check for common accessibility issues
  const issues: string[] = [];
  
  // Check for missing alt text on images
  const images = container.querySelectorAll('img:not([alt])');
  if (images.length > 0) {
    issues.push(`Found ${images.length} images without alt text`);
  }
  
  // Check for buttons without accessible names
  const buttons = container.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
  buttons.forEach(button => {
    if (!button.textContent?.trim()) {
      issues.push('Found button without accessible name');
    }
  });
  
  // Check for form inputs without labels
  const inputs = container.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    if (id) {
      const label = container.querySelector(`label[for="${id}"]`);
      if (!label) {
        issues.push(`Found input with id="${id}" without associated label`);
      }
    } else {
      issues.push('Found input without label or aria-label');
    }
  });
  
  return issues;
};

// Mock intersection observer for virtualized components
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
  
  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
  
  return mockIntersectionObserver;
};

// Mock ResizeObserver for responsive components
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: mockResizeObserver,
  });
  
  return mockResizeObserver;
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { renderWithProviders as render };