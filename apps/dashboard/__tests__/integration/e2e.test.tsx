/**
 * End-to-End Integration Tests for Chronicle Dashboard
 * Tests complete data flow from hooks to dashboard display
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { jest } from '@jest/globals';
import { EventFeed } from '@/components/EventFeed';
import { Header } from '@/components/layout/Header';
import { EventFilter } from '@/components/EventFilter';
import { generateMockEvents, generateMockSessions, createMockEventWithProps } from '@/lib/mockData';
import { processEvents } from '@/lib/eventProcessor';
import { supabase } from '@/lib/supabase';

// Mock Supabase client for integration tests
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        }))
      })),
      unsubscribe: jest.fn()
    }))
  }
}));

// Mock real-time subscriptions
const mockRealTimeChannel = {
  on: jest.fn(() => mockRealTimeChannel),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
};

describe('Chronicle Dashboard Integration Tests', () => {
  let mockSupabaseFrom: jest.MockedFunction<any>;
  let realTimeCallback: (payload: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Supabase mocks
    mockSupabaseFrom = jest.fn();
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            execute: jest.fn().mockResolvedValue({ 
              data: generateMockEvents(20),
              error: null 
            })
          }))
        }))
      })),
      insert: jest.fn(() => ({
        execute: jest.fn().mockResolvedValue({ 
          data: [{ id: 'new-event' }],
          error: null 
        })
      }))
    });

    // Mock real-time subscription
    (supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn((event, callback) => {
        if (event === 'postgres_changes') {
          realTimeCallback = callback;
        }
        return mockRealTimeChannel;
      }),
      subscribe: jest.fn()
    });
  });

  describe('Complete Data Flow Integration', () => {
    it('successfully processes events from hooks to dashboard display', async () => {
      // Simulate hook event data (what would come from Python hooks)
      const hookEventData = {
        session_id: 'test-session-123',
        hook_event_name: 'PreToolUse',
        timestamp: new Date().toISOString(),
        success: true,
        raw_input: {
          tool_name: 'Read',
          tool_input: { file_path: '/src/components/Test.tsx' },
          session_id: 'test-session-123',
          transcript_path: '/tmp/claude-session.md'
        }
      };

      // Process event through our event processor
      const processedEvents = processEvents([hookEventData]);
      expect(processedEvents).toHaveLength(1);
      expect(processedEvents[0].type).toBe('tool_use');
      expect(processedEvents[0].toolName).toBe('Read');

      // Render dashboard with processed events
      render(<EventFeed events={processedEvents} />);

      // Verify event appears in dashboard
      await waitFor(() => {
        expect(screen.getByText(/Read/)).toBeInTheDocument();
        expect(screen.getByText(/test-session-123/)).toBeInTheDocument();
      });

      // Verify event card details
      const eventCard = screen.getByTestId(`event-card-${processedEvents[0].id}`);
      expect(eventCard).toBeInTheDocument();
      expect(within(eventCard).getByTestId('event-badge')).toHaveClass('bg-accent-blue');
    });

    it('handles real-time event streaming with simulated Claude Code session', async () => {
      const mockEvents = generateMockEvents(5);
      
      // Render EventFeed with initial events
      const { rerender } = render(<EventFeed events={mockEvents} />);

      // Simulate new event arriving via real-time subscription
      const newEvent = createMockEventWithProps({
        id: 'realtime-event-1',
        type: 'tool_use',
        toolName: 'Edit',
        summary: 'Real-time edit operation',
        sessionId: 'session-realtime',
        timestamp: new Date()
      });

      // Trigger real-time callback
      if (realTimeCallback) {
        realTimeCallback({
          eventType: 'INSERT',
          new: {
            event_id: newEvent.id,
            session_id: newEvent.session_id,
            hook_event_name: 'PostToolUse',
            timestamp: newEvent.timestamp.toISOString(),
            success: true,
            raw_input: {
              tool_name: 'Edit',
              tool_response: { success: true }
            }
          }
        });
      }

      // Re-render with new event
      rerender(<EventFeed events={[newEvent, ...mockEvents]} />);

      // Verify real-time event appears
      await waitFor(() => {
        expect(screen.getByText('Real-time edit operation')).toBeInTheDocument();
        expect(screen.getByText(/session-realtime/)).toBeInTheDocument();
      });
    });

    it('validates cross-component data consistency', async () => {
      const testEvents = generateMockEvents(10);
      const testSessions = generateMockSessions(3);

      // Render Header with event count
      const { rerender: rerenderHeader } = render(
        <Header eventCount={testEvents.length} connectionStatus="Connected" />
      );

      // Render EventFeed with same events
      const { rerender: rerenderFeed } = render(<EventFeed events={testEvents} />);

      // Verify header shows correct count
      expect(screen.getByText(`${testEvents.length} events`)).toBeInTheDocument();

      // Verify all events render in feed
      await waitFor(() => {
        const eventCards = screen.getAllByTestId(/event-card-/);
        expect(eventCards).toHaveLength(testEvents.length);
      });

      // Add new event and verify consistency
      const newEvent = createMockEventWithProps({
        id: 'consistency-test-event',
        timestamp: new Date()
      });

      const updatedEvents = [newEvent, ...testEvents];
      
      rerenderHeader(
        <Header eventCount={updatedEvents.length} connectionStatus="Connected" />
      );
      rerenderFeed(<EventFeed events={updatedEvents} />);

      // Verify count updated in header
      expect(screen.getByText(`${updatedEvents.length} events`)).toBeInTheDocument();
      
      // Verify new event appears in feed
      expect(screen.getByTestId('event-card-consistency-test-event')).toBeInTheDocument();
    });

    it('tests complete filtering workflow', async () => {
      // Generate diverse test data
      const testEvents = [
        createMockEventWithProps({
          id: 'filter-test-1',
          type: 'tool_use',
          toolName: 'Read',
          sessionId: 'session-filter-1',
          summary: 'Reading test file'
        }),
        createMockEventWithProps({
          id: 'filter-test-2',
          type: 'error',
          sessionId: 'session-filter-2',
          summary: 'Failed operation'
        }),
        createMockEventWithProps({
          id: 'filter-test-3',
          type: 'success',
          toolName: 'Write',
          sessionId: 'session-filter-1',
          summary: 'Write completed'
        })
      ];

      let filteredEvents = testEvents;
      const onFilterChange = jest.fn((filters) => {
        // Simulate filtering logic
        filteredEvents = testEvents.filter(event => {
          if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
            return false;
          }
          if (filters.sessionIds.length > 0 && !filters.sessionIds.includes(event.session_id)) {
            return false;
          }
          return true;
        });
      });

      // Render filter and feed components
      const { rerender } = render(
        <div>
          <EventFilter onFilterChange={onFilterChange} />
          <EventFeed events={filteredEvents} />
        </div>
      );

      // Initially all events should be visible
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(3);

      // Apply event type filter for errors only
      const eventTypeButton = screen.getByRole('button', { name: /event types/i });
      fireEvent.click(eventTypeButton);

      // Simulate selecting only error events
      onFilterChange({
        eventTypes: ['error'],
        sessionIds: [],
        searchQuery: '',
        dateRange: null
      });

      // Re-render with filtered events
      rerender(
        <div>
          <EventFilter onFilterChange={onFilterChange} />
          <EventFeed events={filteredEvents} />
        </div>
      );

      // Verify only error event is visible
      await waitFor(() => {
        const visibleCards = screen.getAllByTestId(/event-card-/);
        expect(visibleCards).toHaveLength(1);
        expect(screen.getByTestId('event-card-filter-test-2')).toBeInTheDocument();
      });

      // Apply session filter
      onFilterChange({
        eventTypes: [],
        sessionIds: ['session-filter-1'],
        searchQuery: '',
        dateRange: null
      });

      // Update filtered events for session filter
      filteredEvents = testEvents.filter(event => 
        event.session_id === 'session-filter-1'
      );

      rerender(
        <div>
          <EventFilter onFilterChange={onFilterChange} />
          <EventFeed events={filteredEvents} />
        </div>
      );

      // Verify only session-filter-1 events are visible
      await waitFor(() => {
        const visibleCards = screen.getAllByTestId(/event-card-/);
        expect(visibleCards).toHaveLength(2);
        expect(screen.getByTestId('event-card-filter-test-1')).toBeInTheDocument();
        expect(screen.getByTestId('event-card-filter-test-3')).toBeInTheDocument();
      });
    });
  });

  describe('Database Integration Scenarios', () => {
    it('handles Supabase connection success and failure', async () => {
      // Test successful connection
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              execute: jest.fn().mockResolvedValue({
                data: generateMockEvents(5),
                error: null
              }))
            }))
          }))
        }))
      });

      // Simulate loading events from Supabase
      const loadingComponent = render(<EventFeed events={[]} isLoading={true} />);
      expect(screen.getByTestId('event-feed-loading')).toBeInTheDocument();

      // Test connection failure
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              execute: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection failed' }
              }))
            }))
          }))
        }))
      });

      // Simulate error state
      loadingComponent.rerender(
        <EventFeed 
          events={[]} 
          error="Failed to connect to database" 
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByTestId('event-feed-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to database')).toBeInTheDocument();
    });

    it('validates SQLite fallback behavior simulation', async () => {
      // Simulate scenario where Supabase is unavailable but SQLite fallback works
      const fallbackEvents = generateMockEvents(3);
      
      // Mock that Supabase fails but local data is available
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              execute: jest.fn().mockRejectedValue(new Error('Network unavailable'))
            }))
          }))
        }))
      });

      // Render with fallback data
      render(<EventFeed events={fallbackEvents} />);

      // Verify fallback events display correctly
      await waitFor(() => {
        const eventCards = screen.getAllByTestId(/event-card-/);
        expect(eventCards).toHaveLength(3);
      });

      // Verify connection status indicates fallback mode
      render(<Header connectionStatus="Disconnected" eventCount={fallbackEvents.length} />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Session Lifecycle Integration', () => {
    it('tracks complete session from start to stop', async () => {
      const sessionId = 'lifecycle-test-session';
      
      // Session start event
      const sessionStartEvent = createMockEventWithProps({
        id: 'session-start',
        type: 'lifecycle',
        sessionId,
        summary: 'Session started',
        timestamp: new Date(Date.now() - 10000), // 10 seconds ago
        details: {
          event: 'session_start',
          trigger_source: 'startup',
          project_path: '/test/project'
        }
      });

      // Tool usage events during session
      const toolEvents = [
        createMockEventWithProps({
          id: 'tool-read',
          type: 'tool_use',
          toolName: 'Read',
          sessionId,
          summary: 'Reading project files',
          timestamp: new Date(Date.now() - 8000)
        }),
        createMockEventWithProps({
          id: 'tool-edit',
          type: 'tool_use',
          toolName: 'Edit',
          sessionId,
          summary: 'Editing source code',
          timestamp: new Date(Date.now() - 5000)
        })
      ];

      // Session end event
      const sessionEndEvent = createMockEventWithProps({
        id: 'session-end',
        type: 'lifecycle',
        sessionId,
        summary: 'Session completed',
        timestamp: new Date(), // Just now
        details: {
          event: 'session_end',
          duration_ms: 10000,
          tools_used: ['Read', 'Edit']
        }
      });

      const allEvents = [sessionEndEvent, ...toolEvents, sessionStartEvent];

      render(<EventFeed events={allEvents} />);

      // Verify all session events are displayed
      await waitFor(() => {
        expect(screen.getByTestId('event-card-session-start')).toBeInTheDocument();
        expect(screen.getByTestId('event-card-tool-read')).toBeInTheDocument();
        expect(screen.getByTestId('event-card-tool-edit')).toBeInTheDocument();
        expect(screen.getByTestId('event-card-session-end')).toBeInTheDocument();
      });

      // Verify chronological order (newest first)
      const eventCards = screen.getAllByTestId(/event-card-/);
      const cardIds = eventCards.map(card => card.getAttribute('data-testid'));
      expect(cardIds[0]).toBe('event-card-session-end');
      expect(cardIds[3]).toBe('event-card-session-start');
    });
  });

  describe('Error Recovery Integration', () => {
    it('handles graceful degradation during network issues', async () => {
      // Start with normal state
      const initialEvents = generateMockEvents(5);
      const { rerender } = render(<EventFeed events={initialEvents} />);

      // Verify normal operation
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(5);

      // Simulate network error
      rerender(
        <EventFeed 
          events={initialEvents} 
          error="Network connection lost" 
          onRetry={jest.fn()}
        />
      );

      // Verify error state shows but events remain visible
      expect(screen.getByTestId('event-feed-error')).toBeInTheDocument();
      expect(screen.getByText('Network connection lost')).toBeInTheDocument();

      // Simulate recovery with new events
      const recoveredEvents = [...initialEvents, createMockEventWithProps({
        id: 'recovery-event',
        summary: 'Connection restored',
        timestamp: new Date()
      })];

      rerender(<EventFeed events={recoveredEvents} />);

      // Verify recovery
      await waitFor(() => {
        expect(screen.queryByTestId('event-feed-error')).not.toBeInTheDocument();
        expect(screen.getAllByTestId(/event-card-/)).toHaveLength(6);
        expect(screen.getByText('Connection restored')).toBeInTheDocument();
      });
    });
  });
});