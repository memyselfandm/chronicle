/**
 * Critical User Flows E2E Tests for Chronicle Dashboard
 * Tests complete user journeys with real Dashboard component and keyboard navigation
 * 
 * Flow Coverage:
 * - Dashboard load and initial render 
 * - Session selection and filtering
 * - Real-time event updates
 * - Sidebar collapse/expand
 * - Filter preset application
 * - Keyboard navigation (j/k for events, 1-5 for filters, Cmd+B for sidebar)
 * - Cross-browser compatibility
 * - Error scenarios and recovery
 */

'use client';

import React from 'react';
import { screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../src/test-utils/renderHelpers';
import { createMockEvents, createMockSessions } from '../src/test-utils/mockData';
import { setupSupabaseIntegrationTest } from '../src/test-utils/supabaseMocks';
import { PerformanceMonitor, PERFORMANCE_BENCHMARKS } from '../src/test-utils/performanceHelpers';
import { Dashboard } from '../src/components/Dashboard';
import { useDashboardStore } from '../src/stores/dashboardStore';
import { useKeyboardNavigation } from '../src/hooks/useKeyboardNavigation';

// Mock data for E2E tests
const createE2ETestSessions = (count: number = 5) => {
  const sessions = createMockSessions(count);
  return sessions.map((session, index) => ({
    ...session,
    id: `e2e-session-${index + 1}`,
    session_id: `e2e-session-${index + 1}`,
    displayTitle: `Test Session ${index + 1}`,
    displaySubtitle: `chr-25-${index + 1}`,
    project_path: `/test/project/chr-25-${index + 1}`,
    git_branch: `feature/test-${index + 1}`,
    status: index === 0 ? 'active' : index === 1 ? 'awaiting' : 'idle',
    is_awaiting: index === 1,
    last_event_type: index === 0 ? 'tool_use' : index === 1 ? 'notification' : 'success'
  }));
};

const createE2ETestEvents = (count: number = 20) => {
  const events = createMockEvents(count);
  const sessions = createE2ETestSessions(5);
  
  return events.map((event, index) => ({
    ...event,
    id: `e2e-event-${index + 1}`,
    session_id: sessions[index % sessions.length].id,
    type: ['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'error'][index % 5],
    tool_name: ['Read', 'Edit', 'Bash', 'WebSearch', 'Write'][index % 5],
    timestamp: new Date(Date.now() - (count - index) * 60000), // Spread over last hour
    metadata: {
      ...event.metadata,
      tool_name: ['Read', 'Edit', 'Bash', 'WebSearch', 'Write'][index % 5],
      duration_ms: Math.floor(Math.random() * 5000) + 100,
      success: index % 7 !== 0 // Occasional failures for testing
    }
  }));
};

describe('Critical User Flows - E2E Dashboard Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;
  let user: ReturnType<typeof userEvent.setup>;
  let mockSessions: any[];
  let mockEvents: any[];

  beforeEach(async () => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
    user = userEvent.setup();
    
    // Create consistent test data
    mockSessions = createE2ETestSessions(5);
    mockEvents = createE2ETestEvents(20);
    
    // Setup store with test data
    const store = useDashboardStore.getState();
    store.setSessions(mockSessions);
    store.setEvents(mockEvents);
    
    // Mock successful data loading
    integrationSetup.mockSupabaseQuery('sessions', mockSessions);
    integrationSetup.mockSupabaseQuery('events', mockEvents);
  });

  afterEach(() => {
    integrationSetup.cleanup();
    // Reset store
    const store = useDashboardStore.getState();
    store.resetFilters();
    store.setSessions([]);
    store.setEvents([]);
  });

  describe('Dashboard Load and Initial Render', () => {
    it('should load dashboard with initial data within performance budget', async () => {
      performanceMonitor.startMeasurement();
      
      renderWithProviders(
        <Dashboard 
          enableKeyboardShortcuts={true}
          persistLayout={true}
        />
      );
      
      const loadTime = performanceMonitor.endMeasurement();
      
      // Verify dashboard structure
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      
      // Wait for sidebar to render
      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument(); // Sidebar
      });
      
      // Wait for header to render
      await waitFor(() => {
        expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      });
      
      // Wait for main content area
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      // Verify performance - should load within 150ms for E2E
      const benchmark = PERFORMANCE_BENCHMARKS.initialRender;
      const validation = performanceMonitor.validateBenchmark(benchmark, loadTime);
      expect(validation.passed).toBe(true);
      expect(loadTime).toBeLessThan(150);
    });

    it('should display correct initial session and event counts', async () => {
      renderWithProviders(<Dashboard />);
      
      // Wait for data to populate
      await waitFor(() => {
        // Check for sessions in sidebar (at least some should be visible)
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
      
      // Verify header displays event count
      await waitFor(() => {
        const eventCountElement = screen.getByTestId('event-count');
        const count = parseInt(eventCountElement.textContent || '0');
        expect(count).toBeGreaterThan(0);
      });
    });

    it('should handle responsive layout correctly', () => {
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
      window.dispatchEvent(new Event('resize'));

      renderWithProviders(<Dashboard />);
      
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toBeInTheDocument();
      
      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1080,
      });
      window.dispatchEvent(new Event('resize'));

      expect(layout).toBeInTheDocument();
    });
  });

  describe('Session Selection and Filtering', () => {
    it('should select session and filter events correctly', async () => {
      renderWithProviders(<Dashboard />);
      
      // Wait for sessions to load
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // Get the first session
      const firstSession = screen.getByTestId('session-item-e2e-session-1');
      
      // Click to select the session
      await user.click(firstSession);
      
      // Wait for session selection to take effect
      await waitFor(() => {
        // Session should show as selected (exact styling may vary)
        expect(firstSession).toHaveClass('selected');
      });
      
      // Verify events are filtered to show only this session
      await waitFor(() => {
        const store = useDashboardStore.getState();
        const filteredEvents = store.getFilteredEvents();
        const sessionEvents = filteredEvents.filter(e => e.sessionId === 'e2e-session-1');
        expect(sessionEvents.length).toBeGreaterThan(0);
      });
    });

    it('should handle multi-session selection', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(1);
      });
      
      // Select first session with Cmd+click (for multi-select)
      const firstSession = screen.getByTestId('session-item-e2e-session-1');
      const secondSession = screen.getByTestId('session-item-e2e-session-2');
      
      await user.click(firstSession);
      await user.keyboard('{Meta>}');
      await user.click(secondSession);
      await user.keyboard('{/Meta}');
      
      // Verify both sessions are selected
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions).toContain('e2e-session-1');
        expect(store.filters.selectedSessions).toContain('e2e-session-2');
      });
    });

    it('should clear session selection correctly', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // Select a session first
      const firstSession = screen.getByTestId('session-item-e2e-session-1');
      await user.click(firstSession);
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions.length).toBeGreaterThan(0);
      });
      
      // Clear selection with Escape key
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions.length).toBe(0);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate events with j/k keys', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      // Wait for events to load
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(1);
      });
      
      // Press 'j' to navigate to next event
      await user.keyboard('j');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.selectedEvent).toBeTruthy();
      });
      
      // Press 'k' to navigate to previous event
      await user.keyboard('k');
      
      // The selection should change
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.selectedEvent).toBeTruthy();
      });
    });

    it('should apply quick filters with number keys', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // Press '2' for active sessions filter
      await user.keyboard('2');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        const activeSessions = store.sessions.filter(s => s.status === 'active');
        expect(store.filters.selectedSessions).toEqual(activeSessions.map(s => s.id));
      });
      
      // Press '3' for awaiting sessions filter
      await user.keyboard('3');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        const awaitingSessions = store.sessions.filter(s => s.isAwaiting === true);
        expect(store.filters.selectedSessions).toEqual(awaitingSessions.map(s => s.id));
      });
      
      // Press '1' to show all events
      await user.keyboard('1');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions.length).toBe(0);
      });
    });

    it('should toggle sidebar with Cmd+B', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
      });
      
      // Get initial sidebar state
      const store = useDashboardStore.getState();
      const initialCollapsed = store.ui.sidebarCollapsed;
      
      // Toggle sidebar with Cmd+B
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const newStore = useDashboardStore.getState();
        expect(newStore.ui.sidebarCollapsed).toBe(!initialCollapsed);
      });
      
      // Toggle back
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const finalStore = useDashboardStore.getState();
        expect(finalStore.ui.sidebarCollapsed).toBe(initialCollapsed);
      });
    });
  });

  describe('Sidebar Collapse/Expand', () => {
    it('should persist sidebar state in localStorage', async () => {
      renderWithProviders(<Dashboard persistLayout={true} />);
      
      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
      });
      
      // Toggle sidebar
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        const saved = localStorage.getItem('chronicle-sidebar-collapsed');
        expect(saved).toBe(JSON.stringify(store.ui.sidebarCollapsed));
      });
    });

    it('should handle manual sidebar toggle via button', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
      });
      
      // Find and click sidebar toggle button
      const toggleButton = screen.getByTestId('sidebar-toggle');
      const store = useDashboardStore.getState();
      const initialState = store.ui.sidebarCollapsed;
      
      await user.click(toggleButton);
      
      await waitFor(() => {
        const newStore = useDashboardStore.getState();
        expect(newStore.ui.sidebarCollapsed).toBe(!initialState);
      });
    });
  });

  describe('Real-time Event Updates', () => {
    it('should handle real-time event insertion smoothly', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(0);
      });
      
      const initialCount = screen.getAllByTestId(/event-row-/).length;
      
      // Simulate real-time event via store
      act(() => {
        const store = useDashboardStore.getState();
        const newEvent = {
          id: 'realtime-test-event',
          sessionId: 'e2e-session-1',
          type: 'tool_use' as const,
          timestamp: new Date(),
          metadata: { tool_name: 'Edit', success: true },
          tool_name: 'Edit',
          status: 'active' as const
        };
        store.setEvents([newEvent, ...store.events]);
      });
      
      // Verify new event appears
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBe(initialCount + 1);
        expect(screen.getByTestId('event-row-realtime-test-event')).toBeInTheDocument();
      });
    });

    it('should maintain performance during high-frequency updates', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(0);
      });
      
      performanceMonitor.startMeasurement();
      
      // Simulate burst of events
      act(() => {
        const store = useDashboardStore.getState();
        const burstEvents = Array.from({ length: 10 }, (_, i) => ({
          id: `burst-event-${i}`,
          sessionId: 'e2e-session-1',
          type: 'notification' as const,
          timestamp: new Date(Date.now() + i * 100),
          metadata: { message: `Burst event ${i}` },
          status: 'active' as const
        }));
        store.setEvents([...burstEvents, ...store.events.slice(0, 990)]); // Maintain FIFO limit
      });
      
      const updateTime = performanceMonitor.endMeasurement();
      
      // Should handle burst updates efficiently
      expect(updateTime).toBeLessThan(100);
      
      await waitFor(() => {
        expect(screen.getByTestId('event-row-burst-event-0')).toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network disconnection gracefully', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Simulate network error
      integrationSetup.mockSupabaseError('Network connection lost');
      
      // Wait for error state to show
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Dashboard should still be functional with cached data
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      
      // Simulate recovery
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      integrationSetup.clearError();
      
      // Error should clear when connection is restored
      await waitFor(() => {
        expect(screen.queryByText(/data loading error/i)).not.toBeInTheDocument();
      });
    });

    it('should recover from invalid data scenarios', async () => {
      const invalidEvents = [
        { id: 'invalid-1' }, // Missing required fields
        { id: 'invalid-2', sessionId: null, type: 'unknown' },
        ...mockEvents.slice(0, 3) // Some valid events
      ];
      
      integrationSetup.mockSupabaseQuery('events', invalidEvents);
      
      renderWithProviders(<Dashboard />);
      
      // Should render without crashing
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Valid events should still appear
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(0); // At least the valid ones
      });
    });

    it('should handle component unmounting cleanly', async () => {
      const { unmount } = renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Cross-browser Compatibility', () => {
    beforeEach(() => {
      // Reset any browser-specific mocks
      delete (window as any).ontouchstart;
    });

    it('should handle touch interactions on mobile devices', async () => {
      // Mock touch support
      Object.defineProperty(window, 'ontouchstart', {
        value: null,
        writable: true,
        configurable: true
      });
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      const firstSession = screen.getByTestId('session-item-e2e-session-1');
      
      // Simulate touch interaction
      fireEvent.touchStart(firstSession);
      fireEvent.touchEnd(firstSession);
      
      // Should handle touch events like clicks
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions).toContain('e2e-session-1');
      });
    });

    it('should work with keyboard-only navigation', async () => {
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(0);
      });
      
      // Tab navigation through interface
      await user.tab();
      await user.tab();
      
      // Use arrow keys for navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      // Should work with keyboard-only interaction
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should respect prefers-reduced-motion', async () => {
      // Mock reduced motion preference
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
      
      // Should render without animations when motion is reduced
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).not.toHaveStyle('transition: transform 0.3s ease');
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain responsiveness with large datasets', async () => {
      // Create large dataset
      const largeSessions = createE2ETestSessions(50);
      const largeEvents = createE2ETestEvents(1000);
      
      integrationSetup.mockSupabaseQuery('sessions', largeSessions);
      integrationSetup.mockSupabaseQuery('events', largeEvents);
      
      performanceMonitor.startMeasurement();
      
      renderWithProviders(<Dashboard />);
      
      // Should render even with large datasets
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      const renderTime = performanceMonitor.endMeasurement();
      
      // Should render within acceptable time even with large data
      expect(renderTime).toBeLessThan(500);
      
      // Virtual scrolling should handle large event lists
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        // Should only render visible events, not all 1000
        expect(eventElements.length).toBeLessThan(100);
      });
    });

    it('should maintain memory efficiency over time', async () => {
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Simulate long-running session with continuous events
      const addEventsPeriodically = () => {
        const store = useDashboardStore.getState();
        if (store.events.length < 1000) {
          const newEvent = {
            id: `memory-test-${Date.now()}`,
            sessionId: 'e2e-session-1',
            type: 'notification' as const,
            timestamp: new Date(),
            metadata: { test: 'memory-efficiency' },
            status: 'active' as const
          };
          store.setEvents([newEvent, ...store.events]);
        }
      };
      
      // Add events over time
      for (let i = 0; i < 10; i++) {
        act(() => addEventsPeriodically());
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Store should maintain FIFO limit
      const finalStore = useDashboardStore.getState();
      expect(finalStore.events.length).toBeLessThanOrEqual(1000);
    });
  });
});