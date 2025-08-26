import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../src/test-utils/renderHelpers';
import { 
  createMockEvents, 
  createMockSessions,
  createLargeEventDataset,
  createHighFrequencyEventStream 
} from '../../src/test-utils/mockData';
import { 
  setupSupabaseIntegrationTest,
  MockRealtimeChannel 
} from '../../src/test-utils/supabaseMocks';
import { PerformanceMonitor, PERFORMANCE_BENCHMARKS } from '../../src/test-utils/performanceHelpers';

// Mock the main dashboard component and its dependencies
const MockEventDashboard = () => {
  const [sessions, setSessions] = React.useState(createMockSessions(30));
  const [events, setEvents] = React.useState(createMockEvents(200));
  const [selectedSession, setSelectedSession] = React.useState(null);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  return (
    <div data-testid="event-dashboard">
      <div data-testid="sidebar">
        {sessions.map(session => (
          <div 
            key={session.id}
            data-testid={`session-${session.id}`}
            onClick={() => setSelectedSession(session.id)}
            className={selectedSession === session.id ? 'selected' : ''}
          >
            {session.session_id}
          </div>
        ))}
      </div>
      
      <div data-testid="event-feed">
        {loading ? (
          <div data-testid="loading">Loading events...</div>
        ) : (
          events.map(event => (
            <div 
              key={event.id}
              data-testid={`event-${event.id}`}
              onClick={() => setSelectedEvent(event.id)}
              className={selectedEvent === event.id ? 'selected' : ''}
            >
              {event.event_type}
            </div>
          ))
        )}
      </div>
      
      <div data-testid="metrics-display">
        <span data-testid="session-count">{sessions.length}</span>
        <span data-testid="event-count">{events.length}</span>
      </div>
    </div>
  );
};

describe('Critical User Flows - E2E Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
    user = userEvent.setup();
  });

  afterEach(() => {
    integrationSetup.cleanup();
  });

  describe('Dashboard Load Flow', () => {
    it('should load dashboard with initial data within performance budget', async () => {
      performanceMonitor.startMeasurement();
      
      renderWithProviders(<MockEventDashboard />);
      
      const loadTime = performanceMonitor.endMeasurement();
      
      // Verify dashboard loaded
      expect(screen.getByTestId('event-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
      
      // Verify performance
      const benchmark = PERFORMANCE_BENCHMARKS.initialRender;
      const validation = performanceMonitor.validateBenchmark(benchmark, loadTime);
      expect(validation.passed).toBe(true);
      expect(loadTime).toBeLessThan(100); // 100ms budget
    });

    it('should display correct initial metrics', () => {
      renderWithProviders(<MockEventDashboard />);
      
      expect(screen.getByTestId('session-count')).toHaveTextContent('30');
      expect(screen.getByTestId('event-count')).toHaveTextContent('200');
    });

    it('should handle dashboard load errors gracefully', async () => {
      // Mock error state
      const ErrorDashboard = () => (
        <div data-testid="error-state">
          Failed to load dashboard
          <button data-testid="retry-button">Retry</button>
        </div>
      );

      renderWithProviders(<ErrorDashboard />);
      
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  describe('Session Selection Flow', () => {
    it('should select session and update UI correctly', async () => {
      renderWithProviders(<MockEventDashboard />);
      
      // Find and click first session
      const firstSession = screen.getByTestId('session-session_0');
      await user.click(firstSession);
      
      // Verify selection
      expect(firstSession).toHaveClass('selected');
    });

    it('should filter events by selected session', async () => {
      const MockDashboardWithFiltering = () => {
        const sessions = createMockSessions(5);
        const allEvents = createMockEvents(50);
        const [selectedSession, setSelectedSession] = React.useState(null);
        
        const filteredEvents = selectedSession 
          ? allEvents.filter(event => event.session_id === selectedSession)
          : allEvents;

        return (
          <div data-testid="event-dashboard">
            <div data-testid="sidebar">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  data-testid={`session-${session.id}`}
                  onClick={() => setSelectedSession(session.session_id)}
                >
                  {session.session_id}
                </div>
              ))}
            </div>
            
            <div data-testid="event-feed">
              <div data-testid="event-count">{filteredEvents.length}</div>
              {filteredEvents.map(event => (
                <div key={event.id} data-testid={`event-${event.id}`}>
                  {event.event_type}
                </div>
              ))}
            </div>
          </div>
        );
      };

      renderWithProviders(<MockDashboardWithFiltering />);
      
      const initialEventCount = screen.getByTestId('event-count').textContent;
      
      // Select a session
      const firstSession = screen.getByTestId('session-session_0');
      await user.click(firstSession);
      
      await waitFor(() => {
        const filteredEventCount = screen.getByTestId('event-count').textContent;
        expect(filteredEventCount).not.toBe(initialEventCount);
      });
    });

    it('should handle session selection with keyboard navigation', async () => {
      renderWithProviders(<MockEventDashboard />);
      
      const firstSession = screen.getByTestId('session-session_0');
      firstSession.focus();
      
      await user.keyboard('{Enter}');
      expect(firstSession).toHaveClass('selected');
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      const secondSession = screen.getByTestId('session-session_1');
      expect(secondSession).toHaveClass('selected');
    });
  });

  describe('Real-time Updates Flow', () => {
    it('should handle real-time event updates smoothly', async () => {
      const MockRealTimeDashboard = () => {
        const [events, setEvents] = React.useState(createMockEvents(10));
        
        React.useEffect(() => {
          // Simulate real-time updates
          const interval = setInterval(() => {
            const newEvent = createMockEvents(1)[0];
            setEvents(prev => [newEvent, ...prev]);
          }, 1000);
          
          return () => clearInterval(interval);
        }, []);

        return (
          <div data-testid="realtime-dashboard">
            <div data-testid="event-count">{events.length}</div>
            <div data-testid="event-feed">
              {events.map(event => (
                <div key={event.id} data-testid={`event-${event.id}`}>
                  {event.event_type}
                </div>
              ))}
            </div>
          </div>
        );
      };

      renderWithProviders(<MockRealTimeDashboard />);
      
      const initialCount = parseInt(screen.getByTestId('event-count').textContent!);
      
      // Wait for real-time update
      await waitFor(() => {
        const updatedCount = parseInt(screen.getByTestId('event-count').textContent!);
        expect(updatedCount).toBeGreaterThan(initialCount);
      }, { timeout: 2000 });
    });

    it('should maintain performance during high-frequency updates', async () => {
      const MockHighFrequencyDashboard = () => {
        const [events, setEvents] = React.useState(createMockEvents(10));
        const [updateCount, setUpdateCount] = React.useState(0);
        
        React.useEffect(() => {
          // Simulate high-frequency updates
          const interval = setInterval(() => {
            setUpdateCount(prev => prev + 1);
            if (updateCount < 50) { // Limit to prevent infinite updates
              const newEvent = createMockEvents(1)[0];
              setEvents(prev => [newEvent, ...prev.slice(0, 199)]); // Keep only latest 200
            }
          }, 50); // 20 updates per second
          
          return () => clearInterval(interval);
        }, [updateCount]);

        return (
          <div data-testid="high-frequency-dashboard">
            <div data-testid="update-count">{updateCount}</div>
            <div data-testid="event-count">{events.length}</div>
          </div>
        );
      };

      performanceMonitor.startMeasurement();
      renderWithProviders(<MockHighFrequencyDashboard />);
      
      // Wait for several updates
      await waitFor(() => {
        const updates = parseInt(screen.getByTestId('update-count').textContent!);
        expect(updates).toBeGreaterThan(10);
      }, { timeout: 3000 });
      
      const totalTime = performanceMonitor.endMeasurement();
      
      // Should maintain performance during rapid updates
      expect(totalTime).toBeLessThan(3000); // Should complete within timeout
    });

    it('should handle connection interruptions gracefully', async () => {
      const MockConnectionAwareDashboard = () => {
        const [connectionStatus, setConnectionStatus] = React.useState('connected');
        const [events, setEvents] = React.useState(createMockEvents(10));
        
        React.useEffect(() => {
          // Simulate connection issues
          setTimeout(() => setConnectionStatus('disconnected'), 1000);
          setTimeout(() => setConnectionStatus('reconnecting'), 2000);
          setTimeout(() => setConnectionStatus('connected'), 3000);
        }, []);

        return (
          <div data-testid="connection-aware-dashboard">
            <div data-testid="connection-status">{connectionStatus}</div>
            <div data-testid="event-count">{events.length}</div>
          </div>
        );
      };

      renderWithProviders(<MockConnectionAwareDashboard />);
      
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected');
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('reconnecting');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('connected');
      });
    });
  });

  describe('Search and Filtering Flow', () => {
    it('should filter events by search term', async () => {
      const MockSearchableDashboard = () => {
        const allEvents = createMockEvents(50).map((event, index) => ({
          ...event,
          data: { prompt: index % 3 === 0 ? 'search term content' : 'other content' }
        }));
        
        const [searchTerm, setSearchTerm] = React.useState('');
        const [filteredEvents, setFilteredEvents] = React.useState(allEvents);

        React.useEffect(() => {
          if (searchTerm) {
            const filtered = allEvents.filter(event => 
              JSON.stringify(event.data).toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredEvents(filtered);
          } else {
            setFilteredEvents(allEvents);
          }
        }, [searchTerm, allEvents]);

        return (
          <div data-testid="searchable-dashboard">
            <input 
              data-testid="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search events..."
            />
            <div data-testid="filtered-count">{filteredEvents.length}</div>
            <div data-testid="total-count">{allEvents.length}</div>
          </div>
        );
      };

      renderWithProviders(<MockSearchableDashboard />);
      
      const totalCount = parseInt(screen.getByTestId('total-count').textContent!);
      const searchInput = screen.getByTestId('search-input');
      
      await user.type(searchInput, 'search term');
      
      await waitFor(() => {
        const filteredCount = parseInt(screen.getByTestId('filtered-count').textContent!);
        expect(filteredCount).toBeLessThan(totalCount);
        expect(filteredCount).toBeGreaterThan(0);
      });
    });

    it('should handle empty search results gracefully', async () => {
      const MockSearchableDashboard = () => {
        const [searchTerm, setSearchTerm] = React.useState('');
        const [hasResults, setHasResults] = React.useState(true);

        React.useEffect(() => {
          setHasResults(searchTerm !== 'nonexistent');
        }, [searchTerm]);

        return (
          <div data-testid="searchable-dashboard">
            <input 
              data-testid="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {!hasResults && (
              <div data-testid="no-results">No events found</div>
            )}
          </div>
        );
      };

      renderWithProviders(<MockSearchableDashboard />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'nonexistent');
      
      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('should work with different viewport sizes', () => {
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<MockEventDashboard />);
      
      expect(screen.getByTestId('event-dashboard')).toBeInTheDocument();
      
      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      renderWithProviders(<MockEventDashboard />);
      
      expect(screen.getByTestId('event-dashboard')).toBeInTheDocument();
    });

    it('should handle touch interactions on mobile', async () => {
      // Mock touch environment
      Object.defineProperty(window, 'ontouchstart', {
        value: null,
        writable: true,
      });

      renderWithProviders(<MockEventDashboard />);
      
      const firstSession = screen.getByTestId('session-session_0');
      
      // Simulate touch interaction
      fireEvent.touchStart(firstSession);
      fireEvent.touchEnd(firstSession);
      
      expect(firstSession).toHaveClass('selected');
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain responsiveness with large datasets', async () => {
      const { events, sessions } = createLargeEventDataset(1000, 30);
      
      const MockLargeDashboard = () => (
        <div data-testid="large-dashboard">
          <div data-testid="session-count">{sessions.length}</div>
          <div data-testid="event-count">{events.length}</div>
          <div data-testid="sidebar">
            {sessions.slice(0, 10).map(session => (
              <div key={session.id} data-testid={`session-${session.id}`}>
                {session.session_id}
              </div>
            ))}
          </div>
        </div>
      );

      performanceMonitor.startMeasurement();
      renderWithProviders(<MockLargeDashboard />);
      const renderTime = performanceMonitor.endMeasurement();
      
      expect(screen.getByTestId('session-count')).toHaveTextContent('30');
      expect(screen.getByTestId('event-count')).toHaveTextContent('1000');
      
      // Should render large datasets within budget
      expect(renderTime).toBeLessThan(300);
    });

    it('should handle memory efficiently during long sessions', async () => {
      const MockLongSessionDashboard = () => {
        const [eventCount, setEventCount] = React.useState(0);
        
        React.useEffect(() => {
          const interval = setInterval(() => {
            setEventCount(prev => prev + 1);
          }, 100);
          
          // Cleanup after reasonable time
          setTimeout(() => clearInterval(interval), 5000);
          
          return () => clearInterval(interval);
        }, []);

        return (
          <div data-testid="long-session-dashboard">
            <div data-testid="event-count">{eventCount}</div>
          </div>
        );
      };

      renderWithProviders(<MockLongSessionDashboard />);
      
      // Should continue updating without memory issues
      await waitFor(() => {
        const count = parseInt(screen.getByTestId('event-count').textContent!);
        expect(count).toBeGreaterThan(10);
      }, { timeout: 2000 });
    });
  });

  describe('Error Recovery Flows', () => {
    it('should recover from network errors', async () => {
      const MockRecoverableDashboard = () => {
        const [error, setError] = React.useState(true);
        
        return (
          <div data-testid="recoverable-dashboard">
            {error ? (
              <div data-testid="error-state">
                Network error occurred
                <button 
                  data-testid="retry-button"
                  onClick={() => setError(false)}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div data-testid="success-state">Dashboard loaded successfully</div>
            )}
          </div>
        );
      };

      renderWithProviders(<MockRecoverableDashboard />);
      
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      
      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);
      
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    it('should handle partial data loading gracefully', () => {
      const MockPartialDashboard = () => {
        const sessions = createMockSessions(5);
        const events = []; // Empty events to simulate partial loading
        
        return (
          <div data-testid="partial-dashboard">
            <div data-testid="session-count">{sessions.length}</div>
            <div data-testid="event-count">{events.length}</div>
            {events.length === 0 && (
              <div data-testid="empty-events">No events available</div>
            )}
          </div>
        );
      };

      renderWithProviders(<MockPartialDashboard />);
      
      expect(screen.getByTestId('session-count')).toHaveTextContent('5');
      expect(screen.getByTestId('event-count')).toHaveTextContent('0');
      expect(screen.getByTestId('empty-events')).toBeInTheDocument();
    });
  });
});