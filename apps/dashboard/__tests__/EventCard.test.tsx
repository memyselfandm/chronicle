import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventCard } from '@/components/EventCard';

// Define Event interface for testing
interface Event {
  id: string;
  timestamp: string;
  event_type: 'session_start' | 'pre_tool_use' | 'post_tool_use' | 'user_prompt_submit' | 'stop' | 'subagent_stop' | 'pre_compact' | 'notification' | 'error';
  session_id: string;
  tool_name?: string;
  duration_ms?: number;
  metadata: {
    status?: 'success' | 'error' | 'pending';
    [key: string]: any;
  };
  created_at: string;
}

const mockEvent: Event = {
  id: crypto.randomUUID(),
  timestamp: '2024-01-15T14:30:45.123Z',
  event_type: 'post_tool_use',
  session_id: crypto.randomUUID(),
  tool_name: 'Read',
  duration_ms: 250,
  metadata: {
    status: 'success',
    parameters: { file_path: '/path/to/file.ts' },
    result: 'File content loaded successfully'
  },
  created_at: '2024-01-15T14:30:45.123Z'
};

const mockPromptEvent: Event = {
  id: crypto.randomUUID(), 
  timestamp: '2024-01-15T14:32:15.456Z',
  event_type: 'user_prompt_submit',
  session_id: crypto.randomUUID(),
  metadata: {
    status: 'success',
    content: 'User submitted a prompt'
  },
  created_at: '2024-01-15T14:32:15.456Z'
};

const mockSessionEvent: Event = {
  id: crypto.randomUUID(),
  timestamp: '2024-01-15T14:35:22.789Z', 
  event_type: 'session_start',
  session_id: crypto.randomUUID(),
  metadata: {
    status: 'success',
    action: 'session_start'
  },
  created_at: '2024-01-15T14:35:22.789Z'
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
    
    // Check event type badge with correct color (post_tool_use = green)
    const typeBadge = screen.getByText('post tool use');
    expect(typeBadge).toBeInTheDocument();
    expect(typeBadge.closest('div')).toHaveClass('bg-accent-green');
    
    // Check session ID is displayed and truncated
    expect(screen.getByText(new RegExp(mockEvent.session_id.substring(0, 8)))).toBeInTheDocument();
    
    // Check tool name is displayed when available
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('displays correct badge colors for different event types', () => {
    const { rerender } = render(<EventCard event={mockEvent} />);
    
    // post_tool_use should be green
    let badge = screen.getByText('post tool use');
    expect(badge.closest('div')).toHaveClass('bg-accent-green');
    
    // user_prompt_submit should be blue
    rerender(<EventCard event={mockPromptEvent} />);
    badge = screen.getByText('user prompt submit');
    expect(badge.closest('div')).toHaveClass('bg-accent-blue');
    
    // session_start should be purple
    rerender(<EventCard event={mockSessionEvent} />);
    badge = screen.getByText('session start');
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
      session_id: 'session-verylongsessionidentifier1234567890'
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
      tool_name: undefined,
      metadata: { status: 'success' }
    };
    
    render(<EventCard event={eventWithoutTool} />);
    
    expect(screen.queryByText(/Tool:/)).not.toBeInTheDocument();
  });

  it('handles events with different statuses', () => {
    const errorEvent = {
      ...mockEvent,
      metadata: { ...mockEvent.metadata, status: 'error' }
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

  it('handles events with missing or malformed metadata gracefully', () => {
    const malformedEvent = {
      ...mockEvent,
      metadata: null as any
    };
    
    // Should not crash when rendering
    expect(() => {
      render(<EventCard event={malformedEvent} />);
    }).not.toThrow();
  });

  it('displays event type labels in human-readable format', () => {
    const { rerender } = render(<EventCard event={mockEvent} />);
    
    // post_tool_use should be displayed as "post tool use"
    expect(screen.getByText('post tool use')).toBeInTheDocument();
    
    // Test other event types maintain their format
    rerender(<EventCard event={mockPromptEvent} />);
    expect(screen.getByText('user prompt submit')).toBeInTheDocument();
    
    rerender(<EventCard event={mockSessionEvent} />);
    expect(screen.getByText('session start')).toBeInTheDocument();
  });
});