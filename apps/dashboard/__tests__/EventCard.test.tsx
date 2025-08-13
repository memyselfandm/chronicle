import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventCard } from '@/components/EventCard';

// Define Event interface for testing
interface Event {
  id: string;
  timestamp: string;
  type: 'prompt' | 'tool_use' | 'session';
  sessionId: string;
  data: {
    tool_name?: string;
    status?: 'success' | 'error' | 'pending';
    [key: string]: any;
  };
}

const mockEvent: Event = {
  id: 'event-123',
  timestamp: '2024-01-15T14:30:45.123Z',
  type: 'tool_use',
  sessionId: 'session-abc123def456',
  data: {
    tool_name: 'Read',
    status: 'success',
    parameters: { file_path: '/path/to/file.ts' },
    result: 'File content loaded successfully'
  }
};

const mockPromptEvent: Event = {
  id: 'event-456', 
  timestamp: '2024-01-15T14:32:15.456Z',
  type: 'prompt',
  sessionId: 'session-xyz789',
  data: {
    status: 'success',
    content: 'User submitted a prompt'
  }
};

const mockSessionEvent: Event = {
  id: 'event-789',
  timestamp: '2024-01-15T14:35:22.789Z', 
  type: 'session',
  sessionId: 'session-new456',
  data: {
    status: 'success',
    action: 'session_start'
  }
};

describe('EventCard Component', () => {
  beforeEach(() => {
    // Mock date to ensure consistent relative time testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T14:31:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders event card with correct information', () => {
    render(<EventCard event={mockEvent} />);
    
    // Check that the card renders
    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
    
    // Check event type badge with correct color (tool_use = green)
    const typeBadge = screen.getByText('tool_use');
    expect(typeBadge).toBeInTheDocument();
    expect(typeBadge.closest('div')).toHaveClass('bg-accent-green');
    
    // Check session ID is displayed and truncated
    expect(screen.getByText(/session-abc123/)).toBeInTheDocument();
    
    // Check tool name is displayed when available
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('displays correct badge colors for different event types', () => {
    const { rerender } = render(<EventCard event={mockEvent} />);
    
    // tool_use should be green
    let badge = screen.getByText('tool_use');
    expect(badge.closest('div')).toHaveClass('bg-accent-green');
    
    // prompt should be blue
    rerender(<EventCard event={mockPromptEvent} />);
    badge = screen.getByText('prompt');
    expect(badge.closest('div')).toHaveClass('bg-accent-blue');
    
    // session should be purple
    rerender(<EventCard event={mockSessionEvent} />);
    badge = screen.getByText('session');
    expect(badge.closest('div')).toHaveClass('bg-accent-purple');
  });

  it('formats timestamp correctly using date-fns', () => {
    render(<EventCard event={mockEvent} />);
    
    // Should show relative time (mocked to be ~14-15 seconds ago)
    expect(screen.getByText(/1[45]s ago/)).toBeInTheDocument();
  });

  it('shows absolute timestamp on hover', async () => {
    render(<EventCard event={mockEvent} />);
    
    const timeElement = screen.getByText(/1[45]s ago/);
    
    // Hover over the time element
    fireEvent.mouseEnter(timeElement);
    
    // Should show absolute time tooltip
    await waitFor(() => {
      expect(screen.getByText(/Jan 15, 2024 at \d{2}:30:45/)).toBeInTheDocument();
    });
  });

  it('truncates long session IDs correctly', () => {
    const longSessionEvent = {
      ...mockEvent,
      sessionId: 'session-verylongsessionidentifier1234567890'
    };
    
    render(<EventCard event={longSessionEvent} />);
    
    // Should show truncated session ID (first 16 chars + ...)
    expect(screen.getByText(/session-verylong\.\.\./)).toBeInTheDocument();
    expect(screen.queryByText('session-verylongsessionidentifier1234567890')).not.toBeInTheDocument();
  });

  it('handles click events correctly', () => {
    const handleClick = jest.fn();
    render(<EventCard event={mockEvent} onClick={handleClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockEvent);
  });

  it('applies hover effects and animations', () => {
    render(<EventCard event={mockEvent} />);
    
    const card = screen.getByRole('button');
    
    // Should have transition classes for hover effects
    expect(card).toHaveClass('transition-all');
    expect(card).toHaveClass('hover:shadow-md');
    expect(card).toHaveClass('hover:border-accent-blue/20');
  });

  it('does not display tool name when not available', () => {
    const eventWithoutTool = {
      ...mockPromptEvent,
      data: { status: 'success' }
    };
    
    render(<EventCard event={eventWithoutTool} />);
    
    expect(screen.queryByText(/Tool:/)).not.toBeInTheDocument();
  });

  it('handles events with different statuses', () => {
    const errorEvent = {
      ...mockEvent,
      data: { ...mockEvent.data, status: 'error' }
    };
    
    render(<EventCard event={errorEvent} />);
    
    // Error events should have visual indication (maybe in badge color or icon)
    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
  });

  it('supports custom className prop', () => {
    render(<EventCard event={mockEvent} className="custom-class" />);
    
    const card = screen.getByRole('button');
    expect(card).toHaveClass('custom-class');
  });

  it('handles events with missing or malformed data gracefully', () => {
    const malformedEvent = {
      ...mockEvent,
      data: null as any
    };
    
    // Should not crash when rendering
    expect(() => {
      render(<EventCard event={malformedEvent} />);
    }).not.toThrow();
  });

  it('displays event type labels in human-readable format', () => {
    const { rerender } = render(<EventCard event={mockEvent} />);
    
    // tool_use should be displayed as "tool_use" (keeping original for badge)
    expect(screen.getByText('tool_use')).toBeInTheDocument();
    
    // Test other event types maintain their format
    rerender(<EventCard event={mockPromptEvent} />);
    expect(screen.getByText('prompt')).toBeInTheDocument();
    
    rerender(<EventCard event={mockSessionEvent} />);
    expect(screen.getByText('session')).toBeInTheDocument();
  });
});