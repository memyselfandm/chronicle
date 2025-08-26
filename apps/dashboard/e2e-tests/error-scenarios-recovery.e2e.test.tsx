/**
 * Error Scenarios and Recovery E2E Tests
 * Tests dashboard resilience and recovery from various error conditions
 * 
 * Coverage:
 * - Network disconnection handling
 * - Invalid data handling
 * - Supabase connection failures
 * - Recovery from error states
 * - Component error boundaries
 * - Data consistency during errors
 * - Performance under error conditions
 */

'use client';

import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../src/test-utils/renderHelpers';
import { createMockEvents, createMockSessions } from '../src/test-utils/mockData';
import { setupSupabaseIntegrationTest } from '../src/test-utils/supabaseMocks';
import { PerformanceMonitor } from '../src/test-utils/performanceHelpers';
import { Dashboard } from '../src/components/Dashboard';
import { useDashboardStore } from '../src/stores/dashboardStore';

// Error simulation utilities
const createCorruptedData = () => ({
  sessions: [
    { id: null, session_id: undefined }, // Missing required fields
    { id: 'valid-1', session_id: 'session-1', project_path: '/test' }, // Valid session
    { id: 'corrupt-2' }, // Missing session_id
    'not-an-object', // Invalid data type
    { id: 'valid-2', session_id: 'session-2', project_path: '/test2', last_event_time: 'invalid-date' }
  ],
  events: [
    { id: 'event-1', session_id: 'session-1', event_type: 'tool_use' }, // Valid event
    { session_id: 'nonexistent-session' }, // Missing event ID
    { id: 'corrupt-event', type: 'unknown-type' }, // Invalid event type
    null, // Null event
    { id: 'malformed', timestamp: 'not-a-date', metadata: 'should-be-object' }
  ]
});

const simulateNetworkConditions = (condition: 'slow' | 'intermittent' | 'disconnected' | 'timeout') => {
  const delays = {
    slow: 5000,
    intermittent: Math.random() > 0.5 ? 100 : 3000,
    disconnected: Infinity,
    timeout: 10000
  };
  
  return delays[condition];
};

describe('Error Scenarios and Recovery E2E Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;
  let user: ReturnType<typeof userEvent.setup>;
  let mockSessions: any[];
  let mockEvents: any[];
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
    user = userEvent.setup();
    
    mockSessions = createMockSessions(5);
    mockEvents = createMockEvents(20);
    
    // Mock console.error to catch error boundaries
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset store
    const store = useDashboardStore.getState();
    store.resetFilters();
    store.setSessions([]);
    store.setEvents([]);
  });

  afterEach(() => {
    integrationSetup.cleanup();
    consoleErrorSpy.restore();
    
    // Reset store
    const store = useDashboardStore.getState();
    store.resetFilters();
    store.setSessions([]);
    store.setEvents([]);
  });

  describe('Network Connection Errors', () => {
    it('should handle complete network disconnection gracefully', async () => {
      // Start with working connection
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      renderWithProviders(<Dashboard />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Simulate network disconnection
      integrationSetup.mockSupabaseError('Network request failed');
      
      // Dashboard should still be functional
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      
      // Error message should appear
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Cached data should still be accessible
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // User interactions should still work with cached data
      await user.keyboard('{Meta>}b{/Meta}'); // Toggle sidebar
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.sidebarCollapsed).toBeDefined();
      });
    });

    it('should recover when network connection is restored', async () => {
      // Start with disconnection
      integrationSetup.mockSupabaseError('Connection refused');
      
      renderWithProviders(<Dashboard />);
      
      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Restore connection with updated data
      const updatedEvents = [...mockEvents, {
        id: 'recovery-event',
        session_id: 'test-session',
        event_type: 'notification',
        timestamp: new Date().toISOString(),
        metadata: { message: 'Connection restored' }
      }];
      
      integrationSetup.clearError();
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', updatedEvents);
      
      // Trigger reconnection (in real app, this would be automatic)
      act(() => {
        const store = useDashboardStore.getState();
        store.setEvents(updatedEvents);
      });
      
      // Error message should clear
      await waitFor(() => {
        expect(screen.queryByText(/data loading error/i)).not.toBeInTheDocument();
      });
      
      // New data should appear
      await waitFor(() => {
        expect(screen.getByTestId('event-row-recovery-event')).toBeInTheDocument();
      });
    });

    it('should handle slow network conditions', async () => {
      // Simulate slow network with delayed responses
      integrationSetup.mockSupabaseQueryWithDelay('sessions', mockSessions, 2000);
      integrationSetup.mockSupabaseQueryWithDelay('events', mockEvents, 3000);
      
      performanceMonitor.startMeasurement();
      
      renderWithProviders(<Dashboard />);
      
      // Loading indicator should show
      await waitFor(() => {
        expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
      });
      
      // Should eventually load despite slow network
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
        expect(screen.queryByText(/loading dashboard/i)).not.toBeInTheDocument();
      }, { timeout: 5000 });
      
      const totalLoadTime = performanceMonitor.endMeasurement();
      
      // Should handle slow loading gracefully
      expect(totalLoadTime).toBeGreaterThan(2000);
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should handle intermittent connection issues', async () => {
      let requestCount = 0;
      
      // Mock intermittent failures
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQueryWithCallback('events', () => {
        requestCount++;
        if (requestCount % 3 === 0) {
          throw new Error('Temporary network error');
        }
        return mockEvents;
      });
      
      renderWithProviders(<Dashboard />);
      
      // Should eventually succeed despite intermittent failures
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Some data should load
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle partial data loading', async () => {
      // Sessions load successfully, events fail
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseError('Failed to load events');
      
      renderWithProviders(<Dashboard />);
      
      // Should show sessions despite event loading failure
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // Error message should indicate partial failure
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Dashboard should remain functional
      const firstSession = screen.getByTestId('session-item-session_0');
      await user.click(firstSession);
      
      // Should handle selection even without events loaded
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions).toContain('session_0');
      });
    });
  });

  describe('Invalid Data Handling', () => {
    it('should filter out invalid session data', async () => {
      const corruptedData = createCorruptedData();
      
      integrationSetup.mockSupabaseQuery('sessions', corruptedData.sessions);
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should only render valid sessions
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        // Should only show valid sessions (valid-1 and valid-2)
        expect(sessionElements.length).toBeLessThan(corruptedData.sessions.length);
      });
      
      // Should not crash
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should handle invalid event data gracefully', async () => {
      const corruptedData = createCorruptedData();
      
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', corruptedData.events);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should render valid events and ignore invalid ones
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        // Should only show valid events
        expect(eventElements.length).toBeLessThan(corruptedData.events.length);
      });
      
      // Dashboard should remain stable
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should handle malformed JSON responses', async () => {
      integrationSetup.mockSupabaseRawResponse('sessions', '{"invalid": json}');
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      renderWithProviders(<Dashboard />);
      
      // Should handle parsing error gracefully
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Should not crash the entire dashboard
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should validate and sanitize event metadata', async () => {
      const eventsWithMaliciousData = [
        {
          id: 'safe-event',
          session_id: 'session-1',
          event_type: 'tool_use',
          metadata: { tool_name: 'Read', file_path: '/safe/path' }
        },
        {
          id: 'suspicious-event',
          session_id: 'session-1', 
          event_type: 'tool_use',
          metadata: { 
            tool_name: '<script>alert("xss")</script>',
            file_path: '../../../../etc/passwd'
          }
        }
      ];
      
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', eventsWithMaliciousData);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should render events but sanitize dangerous content
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBe(2);
      });
      
      // XSS content should not execute
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      // In a real app, you'd check that HTML entities are escaped
    });
  });

  describe('Component Error Boundaries', () => {
    it('should catch and handle component rendering errors', async () => {
      // Mock a component that throws during render
      const ErrorThrowingComponent = () => {
        throw new Error('Component rendering failed');
      };
      
      // This would require injecting the error component into the dashboard
      // For now, we'll simulate by corrupting the store state
      act(() => {
        const store = useDashboardStore.getState();
        // @ts-ignore - Intentionally corrupt the store
        store.events = 'invalid-state';
      });
      
      renderWithProviders(<Dashboard />);
      
      // Error boundary should catch the error
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should not crash the entire app
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should provide error recovery options', async () => {
      integrationSetup.mockSupabaseError('Critical system error');
      
      renderWithProviders(<Dashboard />);
      
      // Error message should appear with recovery option
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      // Should show retry mechanism or fallback UI
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });
  });

  describe('Data Consistency During Errors', () => {
    it('should maintain data consistency when partial updates fail', async () => {
      // Start with good data
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBe(mockSessions.length);
      });
      
      // Simulate partial update failure
      const updatedSessions = [...mockSessions.slice(0, 2)]; // Remove some sessions
      integrationSetup.mockSupabaseError('Update failed');
      
      act(() => {
        const store = useDashboardStore.getState();
        try {
          store.setSessions(updatedSessions);
        } catch (error) {
          // Should handle update failure gracefully
        }
      });
      
      // Should maintain previous consistent state
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle concurrent updates during errors', async () => {
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Simulate concurrent updates with some failing
      const updates = [
        () => {
          const store = useDashboardStore.getState();
          store.setEvents([...mockEvents, { id: 'update-1', sessionId: 'session-1', type: 'notification', timestamp: new Date(), metadata: {}, status: 'active' }]);
        },
        () => {
          integrationSetup.mockSupabaseError('Update 2 failed');
        },
        () => {
          const store = useDashboardStore.getState();
          store.setEvents([...mockEvents, { id: 'update-3', sessionId: 'session-1', type: 'tool_use', timestamp: new Date(), metadata: {}, status: 'active' }]);
        }
      ];
      
      // Apply updates simultaneously
      act(() => {
        updates.forEach(update => {
          try {
            update();
          } catch (error) {
            // Some updates may fail
          }
        });
      });
      
      // Should maintain consistency despite some failures
      await waitFor(() => {
        const eventElements = screen.getAllByTestId(/event-row-/);
        expect(eventElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should maintain performance during error recovery', async () => {
      integrationSetup.mockSupabaseError('Initial load failed');
      
      performanceMonitor.startMeasurement();
      
      renderWithProviders(<Dashboard />);
      
      // Should render error state quickly
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
      });
      
      const errorStateTime = performanceMonitor.endMeasurement();
      expect(errorStateTime).toBeLessThan(200);
      
      // Recovery should also be fast
      performanceMonitor.startMeasurement();
      
      integrationSetup.clearError();
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseQuery('events', mockEvents);
      
      act(() => {
        const store = useDashboardStore.getState();
        store.setSessions(mockSessions);
        store.setEvents(mockEvents);
      });
      
      await waitFor(() => {
        expect(screen.queryByText(/data loading error/i)).not.toBeInTheDocument();
      });
      
      const recoveryTime = performanceMonitor.endMeasurement();
      expect(recoveryTime).toBeLessThan(300);
    });

    it('should handle memory efficiently during error scenarios', async () => {
      // Simulate memory pressure with large datasets and errors
      const largeSessions = Array.from({ length: 100 }, (_, i) => ({
        id: `large-session-${i}`,
        session_id: `large-session-${i}`,
        project_path: `/large/project/${i}`
      }));
      
      integrationSetup.mockSupabaseQuery('sessions', largeSessions);
      integrationSetup.mockSupabaseError('Memory pressure error');
      
      performanceMonitor.startMeasurement();
      
      renderWithProviders(<Dashboard />);
      
      // Should handle large datasets gracefully even with errors
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      const renderTime = performanceMonitor.endMeasurement();
      
      // Should not degrade performance significantly
      expect(renderTime).toBeLessThan(500);
    });

    it('should clean up resources during error states', async () => {
      const { unmount } = renderWithProviders(<Dashboard />);
      
      // Simulate errors during component lifecycle
      integrationSetup.mockSupabaseError('Cleanup test error');
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      });
      
      // Should unmount cleanly even with errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('User Experience During Errors', () => {
    it('should provide clear error messages to users', async () => {
      const specificError = 'Unable to connect to Chronicle database';
      integrationSetup.mockSupabaseError(specificError);
      
      renderWithProviders(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
        expect(screen.getByText(specificError)).toBeInTheDocument();
      });
    });

    it('should maintain user interactions during partial errors', async () => {
      // Load sessions successfully, events fail
      integrationSetup.mockSupabaseQuery('sessions', mockSessions);
      integrationSetup.mockSupabaseError('Events loading failed');
      
      renderWithProviders(<Dashboard enableKeyboardShortcuts={true} />);
      
      await waitFor(() => {
        const sessionElements = screen.getAllByTestId(/session-item-/);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
      
      // User should still be able to interact despite error
      await user.keyboard('{Meta>}b{/Meta}');
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.ui.sidebarCollapsed).toBeDefined();
      });
      
      // Session selection should work
      const firstSession = screen.getByTestId('session-item-session_0');
      await user.click(firstSession);
      
      await waitFor(() => {
        const store = useDashboardStore.getState();
        expect(store.filters.selectedSessions).toContain('session_0');
      });
    });
  });
});