import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, checkAccessibility } from '../../../src/test-utils/renderHelpers';
import { 
  createMockEvents, 
  createLargeEventDataset,
  createHighFrequencyEventStream 
} from '../../../src/test-utils/mockData';
import { PerformanceMonitor, PERFORMANCE_BENCHMARKS } from '../../../src/test-utils/performanceHelpers';
import { EventTableV2 } from '../../../src/components/eventfeed/EventTableV2';

describe('EventTableV2 Component', () => {
  const mockEvents = createMockEvents(20, 'session_test');
  
  const defaultProps = {
    events: mockEvents,
    loading: false,
    error: null,
    onEventSelect: jest.fn(),
    onLoadMore: jest.fn(),
    hasMore: true,
    selectedEventId: null,
    autoScroll: true,
    onAutoScrollToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render event table with all events', () => {
      renderWithProviders(<EventTableV2 {...defaultProps} />);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('Session')).toBeInTheDocument();
      
      // Should render all event rows
      const eventRows = screen.getAllByTestId(/^event-row-/);
      expect(eventRows).toHaveLength(20);
    });

    it('should show loading state', () => {
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          loading={true}
          events={[]}
        />
      );
      
      expect(screen.getByTestId('table-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('skeleton-row')).toHaveLength(10); // Default skeleton rows
    });

    it('should display empty state when no events', () => {
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          events={[]}
          loading={false}
        />
      );
      
      expect(screen.getByText('No events found')).toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should show error state', () => {
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          error="Failed to load events"
          events={[]}
        />
      );
      
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });

  describe('Event Selection', () => {
    it('should highlight selected event', () => {
      const selectedEvent = mockEvents[5];
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          selectedEventId={selectedEvent.id}
        />
      );
      
      const selectedRow = screen.getByTestId(`event-row-${selectedEvent.id}`);
      expect(selectedRow).toHaveClass('selected');
    });

    it('should call onEventSelect when event is clicked', async () => {
      const user = userEvent.setup();
      const mockOnEventSelect = jest.fn();
      
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          onEventSelect={mockOnEventSelect}
        />
      );
      
      const firstEventRow = screen.getByTestId(`event-row-${mockEvents[0].id}`);
      await user.click(firstEventRow);
      
      expect(mockOnEventSelect).toHaveBeenCalledWith(mockEvents[0].id);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnEventSelect = jest.fn();
      
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          onEventSelect={mockOnEventSelect}
        />
      );
      
      const firstEventRow = screen.getByTestId(`event-row-${mockEvents[0].id}`);
      firstEventRow.focus();
      
      await user.keyboard('{Enter}');
      expect(mockOnEventSelect).toHaveBeenCalledWith(mockEvents[0].id);
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(mockOnEventSelect).toHaveBeenCalledWith(mockEvents[1].id);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const { events } = createLargeEventDataset(1000, 30);
      const performanceMonitor = new PerformanceMonitor();
      
      performanceMonitor.startMeasurement();
      renderWithProviders(
        <EventTableV2 
          {...defaultProps} 
          events={events}
        />
      );
      const renderTime = performanceMonitor.endMeasurement();
      
      const benchmark = PERFORMANCE_BENCHMARKS.sessionLoad;
      const validation = performanceMonitor.validateBenchmark(benchmark, renderTime);
      
      expect(validation.passed).toBe(true);
      expect(renderTime).toBeLessThan(300); // 300ms for large dataset
    });

    it('should handle high-frequency updates efficiently', async () => {
      const { rerender } = renderWithProviders(<EventTableV2 {...defaultProps} />);
      const performanceMonitor = new PerformanceMonitor();
      
      performanceMonitor.startMeasurement();
      
      // Simulate rapid event updates
      for (let i = 0; i < 20; i++) {
        const newEvents = [...mockEvents, ...createMockEvents(5, `session_${i}`)];
        rerender(
          <EventTableV2 
            {...defaultProps} 
            events={newEvents}
          />
        );
      }
      
      const updateTime = performanceMonitor.endMeasurement();
      expect(updateTime).toBeLessThan(200); // Should handle rapid updates
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', () => {
      const { container } = renderWithProviders(<EventTableV2 {...defaultProps} />);
      const issues = checkAccessibility(container);
      expect(issues).toHaveLength(0);
    });

    it('should have proper table structure', () => {
      renderWithProviders(<EventTableV2 {...defaultProps} />);
      
      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Events table');
      
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(4); // Type, Timestamp, Session, Actions
      
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1); // Header + data rows
    });
  });
});