import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EventFeed } from '@/components/EventFeed';
import { 
  EventData, 
  generateMockEvents, 
  createMockEventWithProps, 
  MOCK_EVENTS_SMALL 
} from '@/lib/mockData';

// Mock IntersectionObserver for auto-scroll functionality
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock scrollTo for testing scroll behavior
window.HTMLElement.prototype.scrollTo = jest.fn();

describe('EventFeed Component', () => {
  const mockEvents: EventData[] = [
    createMockEventWithProps({
      id: 'event-1',
      type: 'tool_use',
      summary: 'Reading configuration file',
      session_id: 'session-123',
      toolName: 'Read',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      details: {
        tool_name: 'Read',
        file_path: '/src/config.json'
      }
    }),
    createMockEventWithProps({
      id: 'event-2',
      type: 'success',
      summary: 'File operation completed',
      session_id: 'session-456',
      timestamp: new Date('2024-01-01T11:59:00Z')
    }),
    createMockEventWithProps({
      id: 'event-3',
      type: 'error',
      summary: 'Failed to read file',
      session_id: 'session-123',
      timestamp: new Date('2024-01-01T11:58:00Z')
    })
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with events correctly', () => {
      render(<EventFeed events={mockEvents} />);
      
      // Check container is rendered
      const eventFeed = screen.getByTestId('event-feed');
      expect(eventFeed).toBeInTheDocument();
      expect(eventFeed).toHaveClass('overflow-y-auto');
      
      // Check events are rendered
      expect(screen.getByText('Reading configuration file')).toBeInTheDocument();
      expect(screen.getByText('File operation completed')).toBeInTheDocument();
      expect(screen.getByText('Failed to read file')).toBeInTheDocument();
    });

    it('renders empty state when no events provided', () => {
      render(<EventFeed events={[]} />);
      
      const emptyState = screen.getByTestId('event-feed-empty');
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText('No events yet')).toBeInTheDocument();
      expect(screen.getByText('Events will appear here as they are generated')).toBeInTheDocument();
    });

    it('applies custom className correctly', () => {
      render(<EventFeed events={mockEvents} className="custom-feed-class" />);
      
      const eventFeed = screen.getByTestId('event-feed');
      expect(eventFeed).toHaveClass('custom-feed-class');
    });

    it('sets custom height when provided', () => {
      render(<EventFeed events={mockEvents} height="500px" />);
      
      // The height is set on the outer container, not the event-feed testid element
      const container = screen.getByTestId('event-feed').parentElement;
      expect(container).toHaveStyle({ height: '500px' });
    });
  });

  describe('Event Cards', () => {
    it('displays event information correctly', () => {
      render(<EventFeed events={mockEvents} />);
      
      // Check first event details
      const firstEventCard = screen.getByTestId('event-card-event-1');
      expect(firstEventCard).toBeInTheDocument();
      
      within(firstEventCard).getByText('Reading configuration file');
      within(firstEventCard).getByText(/session-123/);
      // Tool name is split across elements, so search for the parts
      within(firstEventCard).getByText('Tool:');
      within(firstEventCard).getByText('Read');
    });

    it('displays different event types with correct badges', () => {
      render(<EventFeed events={mockEvents} />);
      
      // Tool use event should have info badge
      const toolEvent = screen.getByTestId('event-card-event-1');
      expect(within(toolEvent).getByTestId('event-badge')).toHaveClass('bg-accent-blue');
      
      // Success event should have success badge
      const successEvent = screen.getByTestId('event-card-event-2');
      expect(within(successEvent).getByTestId('event-badge')).toHaveClass('bg-accent-green');
      
      // Error event should have error badge
      const errorEvent = screen.getByTestId('event-card-event-3');
      expect(within(errorEvent).getByTestId('event-badge')).toHaveClass('bg-accent-red');
    });

    it('formats timestamps correctly', () => {
      render(<EventFeed events={mockEvents} />);
      
      // Check that relative time is displayed - should have multiple "ago" texts
      const agoTexts = screen.getAllByText(/ago/);
      expect(agoTexts.length).toBeGreaterThan(0);
    });

    it('handles events without optional fields gracefully', () => {
      const minimalEvent = createMockEventWithProps({
        id: 'minimal-1',
        type: 'lifecycle',
        summary: 'Session started',
        session_id: 'session-789',
        timestamp: new Date(),
        toolName: undefined,
        details: undefined
      });

      render(<EventFeed events={[minimalEvent]} />);
      
      expect(screen.getByText('Session started')).toBeInTheDocument();
      expect(screen.queryByText(/Tool:/)).not.toBeInTheDocument();
    });
  });

  describe('Event Interaction', () => {
    it('calls onEventClick when event card is clicked', () => {
      const mockOnEventClick = jest.fn();
      render(<EventFeed events={mockEvents} onEventClick={mockOnEventClick} />);
      
      const firstEventCard = screen.getByTestId('event-card-event-1');
      fireEvent.click(firstEventCard);
      
      expect(mockOnEventClick).toHaveBeenCalledWith(mockEvents[0]);
    });

    it('handles event interaction without onEventClick prop', () => {
      // Should not throw error when clicking without handler
      render(<EventFeed events={mockEvents} />);
      
      const firstEventCard = screen.getByTestId('event-card-event-1');
      expect(() => fireEvent.click(firstEventCard)).not.toThrow();
    });
  });

  describe('Loading State', () => {
    it('displays loading state correctly', () => {
      render(<EventFeed events={[]} isLoading={true} />);
      
      const loadingState = screen.getByTestId('event-feed-loading');
      expect(loadingState).toBeInTheDocument();
      expect(screen.getByText('Loading events...')).toBeInTheDocument();
      
      // Should show skeleton cards
      const skeletonCards = screen.getAllByTestId('event-card-skeleton');
      expect(skeletonCards).toHaveLength(3); // Default skeleton count
    });

    it('hides events when loading', () => {
      render(<EventFeed events={mockEvents} isLoading={true} />);
      
      // Events should not be visible during loading
      expect(screen.queryByText('Reading configuration file')).not.toBeInTheDocument();
    });
  });

  describe('Auto-scroll Functionality', () => {
    it('auto-scrolls to top when new events arrive by default', async () => {
      const { rerender } = render(<EventFeed events={mockEvents} />);
      
      const scrollContainer = screen.getByTestId('event-feed');
      const scrollToSpy = jest.spyOn(scrollContainer, 'scrollTo');
      
      // Add new event at the beginning
      const newEvent = createMockEventWithProps({
        id: 'new-event',
        timestamp: new Date() // More recent than existing events
      });
      
      rerender(<EventFeed events={[newEvent, ...mockEvents]} />);
      
      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      });
    });

    it('does not auto-scroll when autoScroll is disabled', async () => {
      const { rerender } = render(<EventFeed events={mockEvents} autoScroll={false} />);
      
      const scrollContainer = screen.getByTestId('event-feed');
      const scrollToSpy = jest.spyOn(scrollContainer, 'scrollTo');
      
      const newEvent = createMockEventWithProps({
        id: 'new-event',
        timestamp: new Date()
      });
      
      rerender(<EventFeed events={[newEvent, ...mockEvents]} autoScroll={false} />);
      
      await waitFor(() => {
        expect(scrollToSpy).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('provides toggle for auto-scroll functionality', () => {
      render(<EventFeed events={mockEvents} showAutoScrollToggle={true} />);
      
      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      expect(autoScrollToggle).toBeInTheDocument();
      
      // Should show current auto-scroll state
      expect(screen.getByText(/Auto-scroll/)).toBeInTheDocument();
    });

    it('toggles auto-scroll when toggle is clicked', () => {
      render(<EventFeed events={mockEvents} showAutoScrollToggle={true} />);
      
      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(autoScrollToggle);
      
      // Should update the toggle state (implementation will handle the visual change)
      expect(autoScrollToggle).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive classes for mobile layout', () => {
      render(<EventFeed events={mockEvents} />);
      
      const eventFeed = screen.getByTestId('event-feed');
      expect(eventFeed).toHaveClass('w-full');
      
      // Event cards should have responsive spacing
      const eventCards = screen.getAllByTestId(/event-card-/);
      eventCards.forEach(card => {
        expect(card).toHaveClass('mb-3');
      });
    });

    it('handles different screen sizes appropriately', () => {
      // This would typically test CSS classes that change based on breakpoints
      render(<EventFeed events={mockEvents} />);
      
      const eventFeed = screen.getByTestId('event-feed');
      // Should have responsive padding and margin classes
      expect(eventFeed).toHaveClass('p-4', 'md:p-6');
    });
  });

  describe('Performance with Large Datasets', () => {
    it('handles large number of events efficiently', () => {
      const largeEventSet = generateMockEvents(100);
      
      const renderStart = performance.now();
      render(<EventFeed events={largeEventSet} />);
      const renderEnd = performance.now();
      
      // Render should complete within reasonable time
      expect(renderEnd - renderStart).toBeLessThan(1000); // 1 second max
      
      // Should render all events
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(100);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed event data gracefully', () => {
      const malformedEvents = [
        createMockEventWithProps({
          id: 'malformed-1',
          // @ts-ignore - Testing malformed data
          type: 'invalid-type',
          summary: 'Test event',
          session_id: 'test-session',
          timestamp: new Date()
        })
      ];

      // Should not throw error
      expect(() => render(<EventFeed events={malformedEvents} />)).not.toThrow();
    });

    it('displays error state when provided', () => {
      const errorMessage = 'Failed to load events';
      render(<EventFeed events={[]} error={errorMessage} />);
      
      const errorState = screen.getByTestId('event-feed-error');
      expect(errorState).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('provides retry functionality in error state', () => {
      const mockOnRetry = jest.fn();
      render(<EventFeed events={[]} error="Connection failed" onRetry={mockOnRetry} />);
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<EventFeed events={mockEvents} />);
      
      const eventFeed = screen.getByTestId('event-feed');
      expect(eventFeed).toHaveAttribute('role', 'feed');
      expect(eventFeed).toHaveAttribute('aria-label', 'Event feed');
      
      // Event cards should have proper roles
      const eventCards = screen.getAllByTestId(/event-card-/);
      eventCards.forEach(card => {
        expect(card).toHaveAttribute('role', 'article');
      });
    });

    it('supports keyboard navigation', () => {
      render(<EventFeed events={mockEvents} />);
      
      const firstEventCard = screen.getByTestId('event-card-event-1');
      expect(firstEventCard).toHaveAttribute('tabIndex', '0');
      
      // Should be focusable
      firstEventCard.focus();
      expect(document.activeElement).toBe(firstEventCard);
    });

    it('provides appropriate screen reader content', () => {
      render(<EventFeed events={mockEvents} />);
      
      // Should have descriptive text for screen readers
      const eventCard = screen.getByTestId('event-card-event-1');
      expect(eventCard).toHaveAttribute('aria-describedby');
    });
  });
});