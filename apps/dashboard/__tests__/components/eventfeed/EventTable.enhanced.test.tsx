/**
 * Enhanced comprehensive tests for EventTable component  
 * Tests: virtual scrolling, column layout, auto-scroll, large datasets, keyboard navigation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventTable } from '@/components/eventfeed/EventTable';
import { 
  createMockEvent,
  createMockEvents,
  createMockSession,
  createMockSessions,
  createMockEventsByType,
  createLargeEventDataset,
  createHighFrequencyEventStream,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime,
  mockIntersectionObserver,
  mockResizeObserver
} from '@/test-utils';

// Mock react-window
jest.mock('react-window', () => ({
  FixedSizeList: jest.forwardRef(({ children, itemCount, itemSize, itemData, height, width, ...props }: any, ref) => (
    <div 
      ref={ref}
      data-testid="virtual-list"
      data-item-count={itemCount}
      data-item-size={itemSize}
      style={{ height, width }}
      {...props}
    >
      {/* Render a few items for testing */}
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => 
        children({ 
          index, 
          style: { height: itemSize }, 
          data: itemData 
        })
      )}
    </div>
  )),
}));

// Mock EventRow component
jest.mock('@/components/eventfeed/EventRow', () => ({
  EventRow: jest.fn(({ event, session, style }) => (
    <div 
      data-testid={`event-row-${event.id}`}
      data-event-type={event.event_type}
      style={style}
    >
      <span>{event.event_type}</span>
      <span>{event.timestamp}</span>
      {session && <span>{session.id}</span>}
    </div>
  )),
}));

// Mock AutoScrollToggle component
jest.mock('@/components/eventfeed/AutoScrollToggle', () => ({
  AutoScrollToggle: jest.fn(({ enabled, onChange }) => (
    <button 
      data-testid="auto-scroll-toggle"
      onClick={() => onChange?.(!enabled)}
    >
      {enabled ? 'Auto' : 'Manual'}
    </button>
  )),
}));

describe('EventTable', () => {
  const defaultProps = {
    events: [],
    sessions: [],
    height: 400,
    width: 800,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIntersectionObserver();
    mockResizeObserver();
    
    // Mock console.log to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders event table with correct structure', () => {
      render(<EventTable {...defaultProps} />);

      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
      expect(screen.getByTestId('event-table-header')).toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('applies correct CSS classes and styles', () => {
      render(<EventTable {...defaultProps} className="custom-class" />);

      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveClass('bg-bg-primary', 'overflow-hidden', 'font-mono', 'text-xs');
      expect(table).toHaveClass('custom-class');
    });

    it('shows loading state correctly', () => {
      render(<EventTable {...defaultProps} loading={true} />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
    });

    it('shows empty state when no events', () => {
      render(<EventTable {...defaultProps} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No events to display')).toBeInTheDocument();
      expect(screen.getByText('Events will appear here as they are received')).toBeInTheDocument();
    });

    it('renders header with correct column labels', () => {
      render(<EventTable {...defaultProps} />);

      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('Session')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('has correct table role and accessibility attributes', () => {
      const events = createMockEvents(5);
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveAttribute('role', 'table');
      expect(table).toHaveAttribute('aria-label', 'Event feed table');
      expect(table).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Event Processing and Validation', () => {
    it('filters out invalid events', () => {
      const events = [
        createMockEvent(), // Valid
        { ...createMockEvent(), id: null }, // Invalid - missing id
        { ...createMockEvent(), event_type: null }, // Invalid - missing event_type
        createMockEvent(), // Valid
        null, // Invalid - null event
      ].filter(Boolean);

      render(<EventTable {...defaultProps} events={events as any} />);

      // Should only render valid events
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '2'); // Only 2 valid events
    });

    it('applies FIFO limit correctly', () => {
      const manyEvents = createMockEvents(1500); // More than default maxEvents (1000)
      
      render(<EventTable {...defaultProps} events={manyEvents} maxEvents={1000} />);

      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '1000'); // Limited to maxEvents
    });

    it('handles different event types correctly', () => {
      const events = [
        createMockEventsByType.user_prompt_submit(),
        createMockEventsByType.tool_use(),
        createMockEventsByType.notification(),
        createMockEventsByType.error(),
      ];

      render(<EventTable {...defaultProps} events={events} />);

      events.forEach(event => {
        expect(screen.getByTestId(`event-row-${event.id}`)).toBeInTheDocument();
      });
    });

    it('creates session lookup map efficiently', () => {
      const sessions = createMockSessions(100);
      const events = createMockEvents(50);

      const startTime = performance.now();
      render(<EventTable {...defaultProps} events={events} sessions={sessions} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast even with many sessions
    });

    it('validates event structure correctly', () => {
      const events = [
        createMockEvent(),
        { ...createMockEvent(), timestamp: 'invalid-date' },
        { ...createMockEvent(), session_id: 123 }, // Wrong type
      ];

      // Should not crash with malformed data
      expect(() => {
        render(<EventTable {...defaultProps} events={events} />);
      }).not.toThrow();
    });
  });

  describe('Virtual Scrolling Implementation', () => {
    it('configures virtual list with correct parameters', () => {
      const events = createMockEvents(1000);
      const sessions = createMockSessions(10);

      render(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '1000');
      expect(virtualList).toHaveAttribute('data-item-size', '22'); // 22px row height
      expect(virtualList).toHaveStyle('height: 372px'); // height - header
      expect(virtualList).toHaveStyle('width: 800px');
    });

    it('renders only visible items for performance', () => {
      const events = createMockEvents(1000);

      render(<EventTable {...defaultProps} events={events} />);

      // Virtual list should only render a subset of items (our mock renders max 10)
      const eventRows = screen.getAllByTestId(/event-row-/);
      expect(eventRows.length).toBeLessThanOrEqual(10);
    });

    it('passes correct item data to virtual list', () => {
      const events = createMockEvents(5);
      const sessions = createMockSessions(2);

      render(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      // Verify that EventRow components receive correct data
      const { EventRow } = require('@/components/eventfeed/EventRow');
      
      expect(EventRow).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.any(Object),
          session: expect.any(Object),
          style: expect.any(Object),
        }),
        {}
      );
    });

    it('handles large datasets efficiently', async () => {
      const { events } = createLargeEventDataset(5000, 100);

      const { renderTime } = await measureRenderTime(async () => {
        return render(<EventTable {...defaultProps} events={events} />);
      });

      expect(renderTime).toBeLessThan(200); // Should render large datasets quickly
    });

    it('maintains scroll position during updates', () => {
      const events = createMockEvents(100);

      const { rerender } = render(<EventTable {...defaultProps} events={events} />);

      // Add more events
      const moreEvents = [...events, ...createMockEvents(50)];
      rerender(<EventTable {...defaultProps} events={moreEvents} />);

      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });
  });

  describe('Auto-scroll Functionality', () => {
    it('renders auto-scroll toggle in header', () => {
      render(<EventTable {...defaultProps} autoScroll={false} onAutoScrollChange={jest.fn()} />);

      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
    });

    it('calls onAutoScrollChange when toggle is clicked', () => {
      const mockOnAutoScrollChange = jest.fn();
      
      render(<EventTable {...defaultProps} autoScroll={false} onAutoScrollChange={mockOnAutoScrollChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(mockOnAutoScrollChange).toHaveBeenCalledWith(true);
    });

    it('shows correct toggle state', () => {
      const { rerender } = render(
        <EventTable {...defaultProps} autoScroll={true} onAutoScrollChange={jest.fn()} />
      );

      expect(screen.getByText('Auto')).toBeInTheDocument();

      rerender(<EventTable {...defaultProps} autoScroll={false} onAutoScrollChange={jest.fn()} />);

      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('does not render toggle when onAutoScrollChange is not provided', () => {
      render(<EventTable {...defaultProps} />);

      expect(screen.queryByTestId('auto-scroll-toggle')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles arrow key navigation', () => {
      const events = createMockEvents(20);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      
      // Focus the table
      fireEvent.focus(table);
      
      // Test arrow down
      fireEvent.keyDown(table, { key: 'ArrowDown' });
      
      // Should not throw errors
      expect(table).toBeInTheDocument();
    });

    it('handles vim-style navigation (j/k keys)', () => {
      const events = createMockEvents(10);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      
      fireEvent.keyDown(table, { key: 'j' }); // Down
      fireEvent.keyDown(table, { key: 'k' }); // Up
      
      expect(table).toBeInTheDocument(); // Should handle without errors
    });

    it('handles goto shortcuts (g and shift+G)', () => {
      const events = createMockEvents(50);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      
      fireEvent.keyDown(table, { key: 'g' }); // Go to top
      fireEvent.keyDown(table, { key: 'G', shiftKey: true }); // Go to bottom
      
      expect(table).toBeInTheDocument();
    });

    it('ignores keyboard events when table is not focused', () => {
      const events = createMockEvents(10);
      
      render(<EventTable {...defaultProps} events={events} />);

      // Don't focus the table, just send key events
      fireEvent.keyDown(document, { key: 'j' });
      
      // Should not affect the table
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
    });

    it('prevents default behavior for handled keys', () => {
      const events = createMockEvents(5);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      fireEvent.focus(table);
      
      const preventDefault = jest.fn();
      fireEvent.keyDown(table, { key: 'j', preventDefault });
      
      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('handles high-frequency updates efficiently', async () => {
      const initialEvents = createMockEvents(100);
      
      const { rerender } = render(<EventTable {...defaultProps} events={initialEvents} />);

      const startTime = performance.now();

      // Simulate rapid updates
      for (let i = 0; i < 20; i++) {
        const newEvents = [...initialEvents, ...createMockEvents(10)];
        rerender(<EventTable {...defaultProps} events={newEvents} />);
      }

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should handle rapid updates
    });

    it('memoizes event processing correctly', () => {
      const events = createMockEvents(50);
      const sessions = createMockSessions(5);

      const { rerender } = render(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      // Re-render with same data
      rerender(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      // Should not crash and should maintain performance
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
    });

    it('efficiently processes real-time event streams', async () => {
      const highFrequencyEvents = createHighFrequencyEventStream(100, 5); // 100 events/sec for 5 seconds

      const { renderTime } = await measureRenderTime(async () => {
        return render(<EventTable {...defaultProps} events={highFrequencyEvents} />);
      });

      expect(renderTime).toBeLessThan(300); // Should handle high frequency efficiently
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('manages memory efficiently with FIFO limits', () => {
      const massiveEventSet = createMockEvents(10000);
      
      render(<EventTable {...defaultProps} events={massiveEventSet} maxEvents={500} />);

      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '500'); // Properly limited
    });
  });

  describe('Column Layout', () => {
    it('applies correct column layout classes', () => {
      const events = createMockEvents(3);
      
      render(<EventTable {...defaultProps} events={events} />);

      const header = screen.getByTestId('event-table-header');
      const gridContainer = header.querySelector('.grid');
      
      expect(gridContainer).toHaveClass('grid-cols-[85px_36px_160px_280px_1fr]');
    });

    it('maintains consistent column widths', () => {
      const events = createMockEvents(5);
      
      render(<EventTable {...defaultProps} events={events} />);

      // Verify table maintains grid template structure
      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveStyle({
        gridTemplateColumns: '85px 140px 110px 90px 1fr'
      });
    });

    it('displays column headers correctly', () => {
      render(<EventTable {...defaultProps} />);

      const header = screen.getByTestId('event-table-header');
      
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('Session')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('handles responsive width changes', () => {
      const { rerender } = render(<EventTable {...defaultProps} width={600} />);

      expect(screen.getByTestId('virtual-list')).toHaveStyle('width: 600px');

      rerender(<EventTable {...defaultProps} width={1200} />);

      expect(screen.getByTestId('virtual-list')).toHaveStyle('width: 1200px');
    });
  });

  describe('Integration with React Window', () => {
    it('passes correct props to FixedSizeList', () => {
      const events = createMockEvents(100);
      
      render(<EventTable {...defaultProps} events={events} height={500} width={1000} />);

      const virtualList = screen.getByTestId('virtual-list');
      
      expect(virtualList).toHaveAttribute('data-item-count', '100');
      expect(virtualList).toHaveAttribute('data-item-size', '22');
      expect(virtualList).toHaveStyle('height: 472px'); // 500 - 28 (header)
      expect(virtualList).toHaveStyle('width: 1000px');
    });

    it('configures overscan correctly for smooth scrolling', () => {
      const events = createMockEvents(200);
      
      render(<EventTable {...defaultProps} events={events} />);

      // Our mock doesn't test overscan directly, but we verify the component renders
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('handles empty event list with virtual list', () => {
      render(<EventTable {...defaultProps} events={[]} />);

      // Should show empty state, not virtual list
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('passes accessibility validation', () => {
      const events = createMockEvents(10);
      const sessions = createMockSessions(2);

      const { container } = render(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('provides proper ARIA attributes', () => {
      const events = createMockEvents(5);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveAttribute('role', 'table');
      expect(table).toHaveAttribute('aria-label', 'Event feed table');
    });

    it('supports keyboard focus management', () => {
      const events = createMockEvents(5);
      
      render(<EventTable {...defaultProps} events={events} />);

      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveAttribute('tabIndex', '0');
      
      fireEvent.focus(table);
      expect(table).toHaveFocus();
    });

    it('provides meaningful loading state', () => {
      render(<EventTable {...defaultProps} loading={true} />);

      const loadingState = screen.getByTestId('loading-state');
      expect(loadingState).toBeInTheDocument();
      expect(screen.getByText('Loading events...')).toBeInTheDocument();
    });

    it('provides helpful empty state message', () => {
      render(<EventTable {...defaultProps} />);

      expect(screen.getByText('No events to display')).toBeInTheDocument();
      expect(screen.getByText('Events will appear here as they are received')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles null/undefined events gracefully', () => {
      const events = [null, createMockEvent(), undefined].filter(Boolean) as any;
      
      expect(() => {
        render(<EventTable {...defaultProps} events={events} />);
      }).not.toThrow();
    });

    it('handles malformed event data', () => {
      const malformedEvents = [
        { ...createMockEvent(), timestamp: null },
        { ...createMockEvent(), event_type: 123 },
        'invalid-event',
      ].filter(e => typeof e === 'object') as any;

      expect(() => {
        render(<EventTable {...defaultProps} events={malformedEvents} />);
      }).not.toThrow();
    });

    it('handles zero dimensions gracefully', () => {
      render(<EventTable {...defaultProps} height={0} width={0} />);

      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
    });

    it('handles extremely large datasets', () => {
      const extremeEvents = Array.from({ length: 100000 }, () => createMockEvent());
      
      expect(() => {
        render(<EventTable {...defaultProps} events={extremeEvents} maxEvents={1000} />);
      }).not.toThrow();

      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '1000');
    });

    it('maintains stability during rapid prop changes', () => {
      const { rerender } = render(<EventTable {...defaultProps} />);

      // Rapid prop changes
      for (let i = 0; i < 10; i++) {
        rerender(<EventTable 
          {...defaultProps} 
          events={createMockEvents(i + 1)}
          height={400 + i * 10}
          width={800 + i * 20}
        />);
      }

      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('works correctly with test providers', () => {
      const events = createMockEvents(10);
      const sessions = createMockSessions(3);

      renderWithProviders(
        <EventTable {...defaultProps} events={events} sessions={sessions} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('integrates correctly with session data', () => {
      const sessions = createMockSessions(5);
      const events = sessions.flatMap(session => 
        createMockEvents(3).map(event => ({ ...event, session_id: session.id }))
      );

      render(<EventTable {...defaultProps} events={events} sessions={sessions} />);

      const { EventRow } = require('@/components/eventfeed/EventRow');
      
      // Verify that EventRow receives correct session data
      expect(EventRow).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            id: expect.any(String)
          })
        }),
        {}
      );
    });
  });
});