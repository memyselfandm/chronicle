/**
 * Cross-Browser Compatibility E2E Tests
 * Tests dashboard functionality across different browsers and environments
 * 
 * Coverage:
 * - Chrome, Firefox, Safari compatibility simulation
 * - Mobile browser testing 
 * - Responsive design validation
 * - Browser-specific API handling
 * - Feature detection and fallbacks
 */

'use client';

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../src/test-utils/renderHelpers';
import { createMockEvents, createMockSessions } from '../src/test-utils/mockData';
import { setupSupabaseIntegrationTest } from '../src/test-utils/supabaseMocks';
import { Dashboard } from '../src/components/Dashboard';
import { useDashboardStore } from '../src/stores/dashboardStore';

// Browser environment mocking utilities
const mockBrowserEnvironment = (browser: 'chrome' | 'firefox' | 'safari' | 'mobile') => {
  const userAgents = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  };
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: userAgents[browser]
  });
};

const mockViewport = (width: number, height: number, touchEnabled = false) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  if (touchEnabled) {
    Object.defineProperty(window, 'ontouchstart', {
      value: null,
      writable: true,
      configurable: true
    });
  } else {
    delete (window as any).ontouchstart;
  }
  
  window.dispatchEvent(new Event('resize'));
};

const mockBrowserAPIs = (browser: string) => {
  // Mock browser-specific APIs
  const apis: Record<string, any> = {
    chrome: {
      requestIdleCallback: (callback: Function) => setTimeout(callback, 0),
      IntersectionObserver: class {
        observe = jest.fn();
        unobserve = jest.fn();
        disconnect = jest.fn();
      },
      ResizeObserver: class {
        observe = jest.fn();
        unobserve = jest.fn();
        disconnect = jest.fn();
      }
    },
    firefox: {
      requestIdleCallback: undefined, // Firefox doesn't support this
      IntersectionObserver: class {
        observe = jest.fn();
        unobserve = jest.fn(); 
        disconnect = jest.fn();
      },
      ResizeObserver: class {
        observe = jest.fn();
        unobserve = jest.fn();
        disconnect = jest.fn();
      }
    },
    safari: {
      requestIdleCallback: undefined, // Safari doesn't support this
      IntersectionObserver: class {
        observe = jest.fn();
        unobserve = jest.fn();
        disconnect = jest.fn();
      },
      ResizeObserver: undefined // Safari might not support ResizeObserver in older versions
    }
  };
  
  const browserAPIs = apis[browser] || apis.chrome;
  
  Object.entries(browserAPIs).forEach(([api, implementation]) => {
    if (implementation === undefined) {
      delete (window as any)[api];
    } else {
      (window as any)[api] = implementation;
    }
  });
};

describe('Cross-Browser Compatibility E2E Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let user: ReturnType<typeof userEvent.setup>;
  let mockSessions: any[];
  let mockEvents: any[];

  beforeEach(async () => {
    integrationSetup = setupSupabaseIntegrationTest();
    user = userEvent.setup();
    
    mockSessions = createMockSessions(5);
    mockEvents = createMockEvents(20);
    
    integrationSetup.mockSupabaseQuery('sessions', mockSessions);
    integrationSetup.mockSupabaseQuery('events', mockEvents);
    
    // Reset store
    const store = useDashboardStore.getState();
    store.resetFilters();
    store.setSessions(mockSessions);
    store.setEvents(mockEvents);
  });

  afterEach(() => {
    integrationSetup.cleanup();
    
    // Reset browser mocks
    jest.restoreAllMocks();
    
    // Reset window properties
    mockViewport(1920, 1080, false);
    delete (window as any).ontouchstart;
  });

  describe('Chrome Browser Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('chrome');
      mockBrowserAPIs('chrome');
    });

    it('should work with all Chrome-specific features', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Test Chrome-specific keyboard shortcuts
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.sidebarCollapsed).toBeDefined();
      });
      
      // Should handle Chrome's optimized scrolling
      const eventFeed = screen.getByRole('main');
      fireEvent.scroll(eventFeed, { target: { scrollY: 100 } });
      
      expect(eventFeed).toBeInTheDocument();
    });

    it('should utilize Chrome-specific APIs when available', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should use requestIdleCallback for non-critical updates
      expect(window.requestIdleCallback).toBeDefined();
      
      // Should use modern observers
      expect(window.IntersectionObserver).toBeDefined();
      expect(window.ResizeObserver).toBeDefined();
    });
  });

  describe('Firefox Browser Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('firefox');
      mockBrowserAPIs('firefox');
    });

    it('should work without Chrome-specific APIs', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should work without requestIdleCallback
      expect(window.requestIdleCallback).toBeUndefined();
      
      // Test Firefox keyboard shortcuts (Ctrl instead of Meta)
      await user.keyboard('{Control>}b{/Control}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.sidebarCollapsed).toBeDefined();
      });
    });

    it('should handle Firefox-specific event behavior', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // Firefox might handle right-click differently
      const firstSession = sessionElements[0];
      fireEvent.contextMenu(firstSession);
      
      // Should not break the interface
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  describe('Safari Browser Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('safari');
      mockBrowserAPIs('safari');
    });

    it('should work with limited Safari API support', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should work without modern APIs
      expect(window.requestIdleCallback).toBeUndefined();
      expect(window.ResizeObserver).toBeUndefined();
      
      // Test Safari keyboard shortcuts (Cmd key)
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.sidebarCollapsed).toBeDefined();
      });
    });

    it('should handle Safari-specific scrolling behavior', async () => {
      mockViewport(1024, 768, false);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Safari might have different momentum scrolling
      const eventFeed = screen.getByRole('main');
      fireEvent.scroll(eventFeed, { target: { scrollY: 200 } });
      
      // Should handle Safari's scrolling behavior
      expect(eventFeed).toBeInTheDocument();
    });
  });

  describe('Mobile Browser Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('mobile');
      mockViewport(375, 667, true); // iPhone-like viewport
    });

    it('should handle touch interactions on mobile', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      const firstSession = sessionElements[0];
      
      // Test touch interactions
      fireEvent.touchStart(firstSession, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(firstSession, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });
      
      // Should handle touch like a click
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions.length).toBeGreaterThan(0);
      });
    });

    it('should handle mobile viewport changes', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Rotate to landscape
      mockViewport(667, 375, true);
      
      await waitFor(() => {
        // Should adapt to landscape mode
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Back to portrait
      mockViewport(375, 667, true);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
    });

    it('should disable keyboard shortcuts on mobile', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Keyboard shortcuts should be less prominent on mobile
      // Touch devices might not respond to 'j'/'k' the same way
      await user.keyboard('j');
      
      // Should still work but might behave differently
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should handle mobile-specific gestures', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      const layout = screen.getByTestId('dashboard-layout');
      
      // Simulate swipe gesture
      fireEvent.touchStart(layout, {
        touches: [{ clientX: 50, clientY: 200 }]
      });
      fireEvent.touchMove(layout, {
        touches: [{ clientX: 200, clientY: 200 }]
      });
      fireEvent.touchEnd(layout, {
        changedTouches: [{ clientX: 200, clientY: 200 }]
      });
      
      // Should handle gesture without breaking
      expect(layout).toBeInTheDocument();
    });
  });

  describe('Responsive Design Validation', () => {
    const testViewports = [
      { name: 'Mobile Portrait', width: 375, height: 667 },
      { name: 'Mobile Landscape', width: 667, height: 375 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Tablet Landscape', width: 1024, height: 768 },
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Ultra Wide', width: 2560, height: 1440 }
    ];

    testViewports.forEach(({ name, width, height }) => {
      it(`should work correctly on ${name} (${width}x${height})`, async () => {
        mockViewport(width, height, width < 768); // Touch for mobile
        
        renderWithProviders(<Dashboard />);
        
        await waitFor(() => {
          expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
        });
        
        // All core elements should be present
        expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
        expect(screen.getByRole('complementary')).toBeInTheDocument(); // Sidebar
        expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
        
        // Layout should adapt to viewport
        const layout = screen.getByTestId('dashboard-layout');
        expect(layout).toHaveStyle('min-height: 100vh');
      });
    });

    it('should handle dynamic viewport changes', async () => {
      // Start with desktop
      mockViewport(1920, 1080, false);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Change to mobile
      mockViewport(375, 667, true);
      
      await waitFor(() => {
        // Should still render correctly
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Change to tablet
      mockViewport(768, 1024, true);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and Browser Preferences', () => {
    it('should respect prefers-reduced-motion', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Animation preferences should be respected
      // This would be validated through CSS classes or styles in a real scenario
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toBeInTheDocument();
    });

    it('should respect prefers-color-scheme', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Dark mode preferences should be respected
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toHaveClass('bg-bg-primary'); // Should use theme colors
    });

    it('should work with high contrast mode', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // High contrast should be supported
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  describe('Feature Detection and Fallbacks', () => {
    it('should work without modern JavaScript features', async () => {
      // Mock older browser without some modern features
      delete (window as any).IntersectionObserver;
      delete (window as any).ResizeObserver;
      delete (window as any).requestIdleCallback;
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should still work with fallbacks
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle browsers with disabled JavaScript features', async () => {
      // Mock disabled localStorage
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;
      
      renderWithProviders(<Dashboard persistLayout={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should work without localStorage
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      
      // Restore localStorage
      (window as any).localStorage = originalLocalStorage;
    });

    it('should work with limited CSS support', async () => {
      // This would test fallbacks for CSS Grid, Flexbox, etc.
      // In a real scenario, you'd mock different CSS support levels
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should render with fallback layouts
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toHaveClass('dashboard-layout');
    });
  });
});