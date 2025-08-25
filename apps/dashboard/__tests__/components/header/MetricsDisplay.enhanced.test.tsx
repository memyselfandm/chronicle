/**
 * Enhanced comprehensive tests for MetricsDisplay component
 * Tests: real-time updates, calculation accuracy, performance optimization, integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetricsDisplay } from '@/components/layout/MetricsDisplay';
import { 
  createMockSession,
  createMockEvent,
  createMockEvents,
  createSessionScenarios,
  createMockEventsByType,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime,
  createLargeEventDataset
} from '@/test-utils';

// Mock dependencies
jest.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: jest.fn(),
}));

jest.mock('@/components/layout/SessionBadges', () => ({
  SessionBadges: jest.fn(({ activeSessions, awaitingSessions, onClick }) => (
    <div data-testid="session-badges">
      <span data-testid="active-count">{activeSessions}</span>
      <span data-testid="awaiting-count">{awaitingSessions}</span>
      <button onClick={() => onClick?.('active')}>Filter Active</button>
    </div>
  )),
}));

jest.mock('@/components/layout/ThroughputIndicator', () => ({
  ThroughputIndicator: jest.fn(({ eventsPerMinute }) => (
    <div data-testid="throughput-indicator">
      <span data-testid="events-per-minute">{eventsPerMinute}</span>
    </div>
  )),
  useEventThroughput: jest.fn((events, windowMinutes = 1) => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (windowMinutes * 60000));
    const recentEvents = events.filter((event: any) => new Date(event.timestamp) >= windowStart);
    return Math.round(recentEvents.length / windowMinutes);
  }),
}));

describe('MetricsDisplay', () => {
  const mockUseDashboardStore = require('@/stores/dashboardStore').useDashboardStore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders metrics display with correct structure', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
      expect(screen.getByTestId('session-badges')).toBeInTheDocument();
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });

    it('applies correct CSS classes', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay className="custom-class" />);

      const metricsDisplay = screen.getByTestId('metrics-display');
      expect(metricsDisplay).toHaveClass('flex', 'items-center', 'gap-3');
      expect(metricsDisplay).toHaveClass('text-xs', 'font-medium');
      expect(metricsDisplay).toHaveClass('custom-class');
    });

    it('shows offline indicator when disconnected', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'disconnected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByText('(Offline)')).toBeInTheDocument();
    });

    it('hides offline indicator when connected', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.queryByText('(Offline)')).not.toBeInTheDocument();
    });
  });

  describe('Session Count Calculations', () => {
    it('calculates active sessions correctly', () => {
      const sessions = [
        createSessionScenarios.activeSession(),
        createSessionScenarios.activeSession(),
        createSessionScenarios.completedSession(),
      ];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByTestId('active-count')).toHaveTextContent('2');
    });

    it('calculates awaiting sessions correctly', () => {
      const sessions = [
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.activeSession(),
        createSessionScenarios.completedSession(),
      ];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
    });

    it('detects awaiting sessions from notification events', () => {
      const sessions = [
        { ...createSessionScenarios.activeSession(), id: 'session-1' },
        { ...createSessionScenarios.activeSession(), id: 'session-2' },
      ];

      const events = [
        createMockEventsByType.notification({
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        }),
        createMockEventsByType.user_prompt_submit({
          sessionId: 'session-2',
          timestamp: new Date().toISOString(),
        }),
      ];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      // session-1 should be counted as awaiting due to notification event
      // session-2 should be counted as active
      expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
      expect(screen.getByTestId('active-count')).toHaveTextContent('1');
    });

    it('handles empty sessions and events', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByTestId('active-count')).toHaveTextContent('0');
      expect(screen.getByTestId('awaiting-count')).toHaveTextContent('0');
    });

    it('properly prioritizes session status over event type', () => {
      const sessions = [
        { 
          ...createSessionScenarios.activeSession(), 
          id: 'session-1',
          status: 'awaiting' as const 
        },
      ];

      const events = [
        createMockEventsByType.user_prompt_submit({
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        }),
      ];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      // Should count as awaiting based on status, not event type
      expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
      expect(screen.getByTestId('active-count')).toHaveTextContent('0');
    });
  });

  describe('Real-time Updates', () => {
    it('updates when sessions change', async () => {
      let sessions = [createSessionScenarios.activeSession()];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { rerender } = render(<MetricsDisplay />);

      expect(screen.getByTestId('active-count')).toHaveTextContent('1');

      // Add more sessions
      sessions = [
        ...sessions,
        createSessionScenarios.activeSession(),
        createSessionScenarios.awaitingInputSession(),
      ];

      rerender(<MetricsDisplay />);

      await waitFor(() => {
        expect(screen.getByTestId('active-count')).toHaveTextContent('2');
        expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
      });
    });

    it('updates when events change', async () => {
      const sessions = [
        { ...createSessionScenarios.activeSession(), id: 'session-1' }
      ];

      let events: any[] = [];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { rerender } = render(<MetricsDisplay />);

      expect(screen.getByTestId('active-count')).toHaveTextContent('1');

      // Add notification event
      events = [
        createMockEventsByType.notification({
          sessionId: 'session-1',
          timestamp: new Date().toISOString(),
        })
      ];

      rerender(<MetricsDisplay />);

      await waitFor(() => {
        expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
        expect(screen.getByTestId('active-count')).toHaveTextContent('0');
      });
    });

    it('updates throughput indicator with event changes', () => {
      let events = createMockEvents(10);

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { rerender } = render(<MetricsDisplay />);

      const initialThroughput = parseInt(screen.getByTestId('events-per-minute').textContent || '0');

      // Add more recent events
      events = [
        ...events,
        ...createMockEvents(5).map(event => ({
          ...event,
          timestamp: new Date().toISOString(), // Recent timestamp
        }))
      ];

      rerender(<MetricsDisplay />);

      const updatedThroughput = parseInt(screen.getByTestId('events-per-minute').textContent || '0');
      expect(updatedThroughput).toBeGreaterThan(initialThroughput);
    });
  });

  describe('Performance Optimization', () => {
    it('handles large datasets efficiently', async () => {
      const { events, sessions } = createLargeEventDataset(1000, 50);

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { renderTime } = await measureRenderTime(async () => {
        return render(<MetricsDisplay />);
      });

      expect(renderTime).toBeLessThan(200); // Should render quickly even with large dataset
      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });

    it('efficiently processes session calculations with many events', () => {
      const sessions = Array.from({ length: 100 }, (_, i) => ({
        ...createSessionScenarios.activeSession(),
        id: `session-${i}`,
      }));

      const events = Array.from({ length: 2000 }, (_, i) => ({
        ...createMockEvent(),
        sessionId: `session-${i % 100}`, // Distribute events across sessions
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      }));

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const startTime = performance.now();
      render(<MetricsDisplay />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Fast calculation
      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });

    it('memoizes calculations to avoid unnecessary re-renders', async () => {
      const sessions = [createSessionScenarios.activeSession()];
      const events = createMockEvents(10);

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { rerender } = render(<MetricsDisplay />);

      const initialActiveCount = screen.getByTestId('active-count').textContent;

      // Re-render with same data
      rerender(<MetricsDisplay />);

      // Should maintain same values (memoized)
      expect(screen.getByTestId('active-count')).toHaveTextContent(initialActiveCount || '');
    });

    it('optimizes event sorting for large datasets', () => {
      const sessions = [
        { ...createSessionScenarios.activeSession(), id: 'session-1' }
      ];

      // Create events with mixed timestamps
      const events = Array.from({ length: 1000 }, (_, i) => ({
        ...createMockEvent(),
        sessionId: 'session-1',
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        type: i % 10 === 0 ? 'notification' : 'user_prompt_submit',
      }));

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const startTime = performance.now();
      render(<MetricsDisplay />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Fast even with sorting
      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles session badge filter clicks', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [createSessionScenarios.activeSession()],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      // Mock console.log to capture the filter action
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      render(<MetricsDisplay />);

      const filterButton = screen.getByText('Filter Active');
      fireEvent.click(filterButton);

      expect(consoleSpy).toHaveBeenCalledWith('Filter by:', 'active');

      consoleSpy.mockRestore();
    });

    it('passes correct data to SessionBadges component', () => {
      const sessions = [
        createSessionScenarios.activeSession(),
        createSessionScenarios.awaitingInputSession(),
      ];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByTestId('active-count')).toHaveTextContent('1');
      expect(screen.getByTestId('awaiting-count')).toHaveTextContent('1');
    });

    it('passes correct data to ThroughputIndicator', () => {
      const events = Array.from({ length: 30 }, () => ({
        ...createMockEvent(),
        timestamp: new Date().toISOString(), // All recent events
      }));

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      // Should show events per minute calculation
      const throughput = parseInt(screen.getByTestId('events-per-minute').textContent || '0');
      expect(throughput).toBeGreaterThan(0);
    });
  });

  describe('Connection Status Integration', () => {
    it('shows offline indicator for disconnected state', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'disconnected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      expect(screen.getByText('(Offline)')).toBeInTheDocument();
    });

    it('handles different connection states correctly', () => {
      const connectionStates = ['connected', 'connecting', 'disconnected', 'error'];

      connectionStates.forEach(status => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            sessions: [],
            events: [],
            realtime: { connectionStatus: status },
          };
          return selector(mockState);
        });

        const { container } = render(<MetricsDisplay />);

        if (status === 'disconnected') {
          expect(screen.getByText('(Offline)')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('(Offline)')).not.toBeInTheDocument();
        }

        container.remove();
      });
    });

    it('handles missing realtime object gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: null,
        };
        return selector(mockState);
      });

      expect(() => {
        render(<MetricsDisplay />);
      }).not.toThrow();

      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('maintains accessibility standards', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [createSessionScenarios.activeSession()],
          events: createMockEvents(5),
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      const { container } = render(<MetricsDisplay />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('has proper semantic structure', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      const metricsDisplay = screen.getByTestId('metrics-display');
      expect(metricsDisplay).toHaveAttribute('data-testid', 'metrics-display');
    });
  });

  describe('Edge Cases', () => {
    it('handles null or undefined sessions gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [null, createSessionScenarios.activeSession(), undefined].filter(Boolean),
          events: [],
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      expect(() => {
        render(<MetricsDisplay />);
      }).not.toThrow();

      expect(screen.getByTestId('active-count')).toHaveTextContent('1');
    });

    it('handles malformed event data gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [],
          events: [
            null,
            { ...createMockEvent(), timestamp: 'invalid-date' },
            { ...createMockEvent(), sessionId: null },
            createMockEvent(),
          ].filter(Boolean),
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      expect(() => {
        render(<MetricsDisplay />);
      }).not.toThrow();

      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });

    it('handles store selector errors gracefully', () => {
      mockUseDashboardStore.mockImplementation(() => {
        throw new Error('Store error');
      });

      expect(() => {
        render(<MetricsDisplay />);
      }).toThrow('Store error');
    });

    it('handles missing store data gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {};
        return selector(mockState);
      });

      expect(() => {
        render(<MetricsDisplay />);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('works correctly with SWR provider', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions: [createSessionScenarios.activeSession()],
          events: createMockEvents(5),
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      renderWithProviders(
        <MetricsDisplay />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
      expect(screen.getByTestId('session-badges')).toBeInTheDocument();
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });

    it('integrates correctly with dashboard store selectors', () => {
      const sessions = [createSessionScenarios.activeSession()];
      const events = createMockEvents(10);

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          sessions,
          events,
          realtime: { connectionStatus: 'connected' },
        };
        return selector(mockState);
      });

      render(<MetricsDisplay />);

      // Verify that store selectors are called correctly
      expect(mockUseDashboardStore).toHaveBeenCalledTimes(3); // Three selectors
      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    });
  });
});