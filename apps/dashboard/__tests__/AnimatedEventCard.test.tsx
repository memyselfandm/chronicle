import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AnimatedEventCard } from '@/components/AnimatedEventCard';
import type { Event } from '@/components/AnimatedEventCard';

// Mock event data
const mockEvent: Event = {
  id: 'event-123',
  timestamp: '2024-01-15T14:30:45.123Z',
  type: 'tool_use',
  session_id: 'session-abc123def456',
  data: {
    tool_name: 'Read',
    status: 'success',
  }
};

const mockPromptEvent: Event = {
  id: 'event-456',
  timestamp: '2024-01-15T14:32:15.456Z',
  type: 'prompt',
  session_id: 'session-xyz789',
  data: {
    status: 'success',
  }
};

describe('AnimatedEventCard Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T14:31:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders event card with correct information', () => {
    render(<AnimatedEventCard event={mockEvent} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    expect(card).toBeInTheDocument();
    
    // Check event type badge
    expect(screen.getByText('tool use')).toBeInTheDocument();
    
    // Check session ID is displayed and truncated
    expect(screen.getByText(/session-abc123/)).toBeInTheDocument();
    
    // Check tool name is displayed
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('displays correct event type icons', () => {
    const { rerender } = render(<AnimatedEventCard event={mockEvent} />);
    
    // tool_use should show wrench icon
    expect(screen.getByLabelText('tool_use event')).toHaveTextContent('🔧');
    
    // prompt should show speech bubble icon
    rerender(<AnimatedEventCard event={mockPromptEvent} />);
    expect(screen.getByLabelText('prompt event')).toHaveTextContent('💬');
  });

  it('applies correct badge colors for different event types', () => {
    const { rerender } = render(<AnimatedEventCard event={mockEvent} />);
    
    // tool_use should be green (success)
    let badge = screen.getByText('tool use');
    expect(badge.closest('div')).toHaveClass('bg-accent-green');
    
    // prompt should be blue (info)
    rerender(<AnimatedEventCard event={mockPromptEvent} />);
    badge = screen.getByText('prompt');
    expect(badge.closest('div')).toHaveClass('bg-accent-blue');
  });

  it('formats timestamp correctly', () => {
    render(<AnimatedEventCard event={mockEvent} />);
    
    // Should show relative time
    expect(screen.getByText(/1[45]s ago/)).toBeInTheDocument();
  });

  it('shows absolute timestamp on hover', async () => {
    render(<AnimatedEventCard event={mockEvent} />);
    
    const timeElement = screen.getByText(/1[45]s ago/);
    
    // Hover over the time element
    fireEvent.mouseEnter(timeElement);
    
    // Should show absolute time tooltip
    await waitFor(() => {
      expect(screen.getByText(/Jan 15, 2024 at \d{2}:30:45/)).toBeInTheDocument();
    });
    
    // Mouse leave should hide tooltip
    fireEvent.mouseLeave(timeElement);
    
    await waitFor(() => {
      expect(screen.queryByText(/Jan 15, 2024 at \d{2}:30:45/)).not.toBeInTheDocument();
    });
  });

  it('truncates long session IDs correctly', () => {
    const longSessionEvent = {
      ...mockEvent,
      session_id: 'session-verylongsessionidentifier1234567890'
    };
    
    render(<AnimatedEventCard event={longSessionEvent} />);
    
    // Should show truncated session ID (first 16 chars + ...)
    expect(screen.getByText(/session-verylong\.\.\./)).toBeInTheDocument();
  });

  it('handles click events correctly', () => {
    const handleClick = jest.fn();
    render(<AnimatedEventCard event={mockEvent} onClick={handleClick} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockEvent);
  });

  it('shows NEW indicator when isNew prop is true', () => {
    render(<AnimatedEventCard event={mockEvent} isNew={true} />);
    
    const newIndicator = screen.getByTestId('new-indicator');
    expect(newIndicator).toBeInTheDocument();
    expect(newIndicator).toHaveTextContent('NEW');
    expect(newIndicator).toHaveClass('animate-pulse');
  });

  it('hides NEW indicator after timeout', async () => {
    render(<AnimatedEventCard event={mockEvent} isNew={true} />);
    
    // NEW indicator should be visible initially
    expect(screen.getByTestId('new-indicator')).toBeInTheDocument();
    
    // Fast-forward time by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    // NEW indicator should be hidden
    await waitFor(() => {
      expect(screen.queryByTestId('new-indicator')).not.toBeInTheDocument();
    });
  });

  it('applies animation classes when animateIn is true', () => {
    render(<AnimatedEventCard event={mockEvent} animateIn={true} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should initially have opacity-0 and transform classes
    expect(card).toHaveClass('opacity-0');
    expect(card).toHaveClass('transform');
    expect(card).toHaveClass('translate-y-4');
    expect(card).toHaveClass('scale-95');
  });

  it('animates in after short delay when animateIn is true', async () => {
    render(<AnimatedEventCard event={mockEvent} animateIn={true} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Initially should have animation classes
    expect(card).toHaveClass('opacity-0');
    
    // Fast-forward time by 50ms
    act(() => {
      jest.advanceTimersByTime(50);
    });
    
    // Should animate to visible state
    await waitFor(() => {
      expect(card).toHaveClass('opacity-100');
      expect(card).toHaveClass('translate-y-0');
      expect(card).toHaveClass('scale-100');
    });
  });

  it('does not apply animation classes when animateIn is false', () => {
    render(<AnimatedEventCard event={mockEvent} animateIn={false} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should immediately have visible classes
    expect(card).toHaveClass('opacity-100');
    expect(card).not.toHaveClass('opacity-0');
  });

  it('applies new event highlight styles when isNew is true', () => {
    render(<AnimatedEventCard event={mockEvent} isNew={true} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should have highlight classes
    expect(card).toHaveClass('animate-pulse');
    expect(card).toHaveClass('shadow-lg');
    expect(card).toHaveClass('shadow-accent-blue/30');
    expect(card).toHaveClass('border-accent-blue/50');
  });

  it('removes highlight styles after timeout', async () => {
    render(<AnimatedEventCard event={mockEvent} isNew={true} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should initially have highlight classes
    expect(card).toHaveClass('animate-pulse');
    
    // Fast-forward time by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    // Should remove highlight classes
    await waitFor(() => {
      expect(card).not.toHaveClass('animate-pulse');
      expect(card).not.toHaveClass('shadow-lg');
    });
  });

  it('applies hover effects', () => {
    render(<AnimatedEventCard event={mockEvent} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should have hover classes
    expect(card).toHaveClass('hover:shadow-md');
    expect(card).toHaveClass('hover:border-accent-blue/20');
    expect(card).toHaveClass('hover:scale-[1.02]');
  });

  it('applies focus styles for accessibility', () => {
    render(<AnimatedEventCard event={mockEvent} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    
    // Should have focus classes
    expect(card).toHaveClass('focus:outline-none');
    expect(card).toHaveClass('focus:ring-2');
    expect(card).toHaveClass('focus:ring-accent-blue');
    expect(card).toHaveClass('focus:ring-offset-2');
  });

  it('supports custom className prop', () => {
    render(<AnimatedEventCard event={mockEvent} className="custom-class" />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    expect(card).toHaveClass('custom-class');
  });

  it('handles events without tool_name gracefully', () => {
    const eventWithoutTool = {
      ...mockEvent,
      data: { status: 'success' }
    };
    
    render(<AnimatedEventCard event={eventWithoutTool} />);
    
    // Should not display tool name section
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
  });

  it('handles events with null data gracefully', () => {
    const eventWithNullData = {
      ...mockEvent,
      data: null
    };
    
    expect(() => {
      render(<AnimatedEventCard event={eventWithNullData} />);
    }).not.toThrow();
  });

  it('handles different event types correctly', () => {
    const errorEvent: Event = {
      id: 'event-error',
      timestamp: '2024-01-15T14:30:45.123Z',
      type: 'error',
      session_id: 'session-123',
      data: { status: 'error' }
    };

    const sessionEvent: Event = {
      id: 'event-session',
      timestamp: '2024-01-15T14:30:45.123Z',
      type: 'session',
      session_id: 'session-123',
      data: { status: 'success' }
    };

    const { rerender } = render(<AnimatedEventCard event={errorEvent} />);
    
    // Error event should have red badge
    let badge = screen.getByText('error');
    expect(badge.closest('div')).toHaveClass('bg-accent-red');
    
    // Session event should have purple badge
    rerender(<AnimatedEventCard event={sessionEvent} />);
    badge = screen.getByText('session');
    expect(badge.closest('div')).toHaveClass('bg-accent-purple');
  });

  it('applies correct transition styles', () => {
    const { rerender } = render(<AnimatedEventCard event={mockEvent} animateIn={false} />);
    
    const card = screen.getByTestId(`animated-event-card-${mockEvent.id}`);
    expect(card.style.transition).toBe('all 0.3s ease-out');
    
    // With animateIn, should have different transition
    rerender(<AnimatedEventCard event={mockEvent} animateIn={true} />);
    expect(card.style.transition).toContain('opacity 0.5s ease-out');
    expect(card.style.transition).toContain('transform 0.5s ease-out');
  });
});