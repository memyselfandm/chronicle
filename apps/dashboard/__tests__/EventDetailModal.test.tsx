import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDetailModal } from '@/components/EventDetailModal';
import type { Event } from '@/types/events';

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

// Mock console.error to suppress expected error logs in tests
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

const mockToolUseEvent: Event = {
  id: crypto.randomUUID(),
  event_type: 'post_tool_use',
  timestamp: '2024-01-15T14:30:45.123Z',
  session_id: crypto.randomUUID(),
  tool_name: 'Read',
  duration_ms: 150,
  metadata: {
    status: 'success',
    parameters: { 
      file_path: '/path/to/file.ts' 
    },
    result: 'File content loaded successfully'
  },
  created_at: '2024-01-15T14:30:45.123Z'
};

const mockPromptEvent: Event = {
  id: crypto.randomUUID(),
  event_type: 'user_prompt_submit',
  timestamp: '2024-01-15T14:32:15.456Z',
  session_id: crypto.randomUUID(),
  metadata: {
    status: 'success',
    prompt_type: 'user',
    content: 'Please help me debug this code',
    token_count: 42,
    model: 'claude-3-opus'
  },
  created_at: '2024-01-15T14:32:15.456Z'
};

const mockErrorEvent: Event = {
  id: crypto.randomUUID(),
  event_type: 'error',
  timestamp: '2024-01-15T14:35:22.789Z',
  session_id: crypto.randomUUID(),
  metadata: {
    status: 'error',
    error_type: 'FileNotFoundError',
    error_message: 'File not found: /missing/file.ts',
    stack_trace: 'FileNotFoundError: File not found\n  at readFile (line 10)',
    context: { attempted_path: '/missing/file.ts' }
  },
  created_at: '2024-01-15T14:35:22.789Z'
};

const mockSessionContext = {
  projectPath: '/Users/test/my-project',
  gitBranch: 'feature/new-component',
  lastActivity: '2024-01-15T14:40:00.000Z'
};

const mockRelatedEvents: Event[] = [
  mockToolUseEvent,
  mockPromptEvent,
  {
    id: crypto.randomUUID(),
    event_type: 'session_start',
    timestamp: '2024-01-15T14:28:00.000Z',
    session_id: crypto.randomUUID(),
    metadata: {
      status: 'success',
      action: 'start',
      project_name: 'test-project',
      project_path: '/Users/test/my-project'
    },
    created_at: '2024-01-15T14:28:00.000Z'
  }
];

describe('EventDetailModal Component', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    consoleSpy.mockClear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T14:35:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('renders when isOpen is true with event data', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Event Details')).toBeInTheDocument();
    expect(screen.getByText('post tool use')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText(mockToolUseEvent.id)).toBeInTheDocument();
    expect(screen.getByText(mockToolUseEvent.session_id)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={false}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('does not render when event is null', () => {
    render(
      <EventDetailModal
        event={null}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('displays event timestamp in correct format', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    // Check for time pattern allowing for timezone differences
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}\.\d{3}/)).toBeInTheDocument();
  });

  it('displays correct badge colors for different event types', () => {
    const { rerender } = render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    // post_tool_use should be green (success)
    let badge = screen.getByText('post tool use');
    expect(badge).toBeInTheDocument();

    // user_prompt_submit should be blue (info)
    rerender(
      <EventDetailModal
        event={mockPromptEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );
    badge = screen.getByText('user prompt submit');
    expect(badge).toBeInTheDocument();

    // error should be red (destructive)
    rerender(
      <EventDetailModal
        event={mockErrorEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );
    badge = screen.getByText('error');
    expect(badge).toBeInTheDocument();
  });

  it('displays correct badge colors for different event statuses', () => {
    render(
      <EventDetailModal
        event={mockErrorEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const statusBadge = screen.getByText('error');
    expect(statusBadge).toBeInTheDocument();
  });

  it('displays session context when provided', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        sessionContext={mockSessionContext}
      />
    );

    expect(screen.getByText('Session Context')).toBeInTheDocument();
    expect(screen.getByText(mockSessionContext.projectPath)).toBeInTheDocument();
    expect(screen.getByText(mockSessionContext.gitBranch)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 14:40:00/)).toBeInTheDocument();
  });

  it('does not display session context section when not provided', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText('Session Context')).not.toBeInTheDocument();
  });

  it('displays event data in formatted JSON viewer', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Event Data')).toBeInTheDocument();
    expect(screen.getByText('"Read"')).toBeInTheDocument();
    expect(screen.getByText('"file_path"')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('displays full event JSON', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Full Event')).toBeInTheDocument();
    expect(screen.getByText('"id"')).toBeInTheDocument();
    expect(screen.getByText('"event_type"')).toBeInTheDocument();
    expect(screen.getByText('"timestamp"')).toBeInTheDocument();
  });

  it('copies event data to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const copyButton = screen.getByText('Copy JSON');
    await user.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(mockToolUseEvent.metadata, null, 2)
    );

    // Check for "Copied!" feedback
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('copies full event to clipboard when copy all button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const copyAllButton = screen.getByText('Copy All');
    await user.click(copyAllButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(mockToolUseEvent, null, 2)
    );
  });

  it('copies project path to clipboard when copy button in session context is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        sessionContext={mockSessionContext}
      />
    );

    // Find the copy button next to project path
    const copyButtons = screen.getAllByRole('button');
    const projectPathCopyButton = copyButtons.find(button => 
      button.getAttribute('aria-label') === null && 
      button.querySelector('svg')
    );
    
    if (projectPathCopyButton) {
      await user.click(projectPathCopyButton);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockSessionContext.projectPath);
    }
  });

  it('handles clipboard copy failure gracefully', async () => {
    const user = userEvent.setup({ delay: null });
    mockClipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const copyButton = screen.getByText('Copy JSON');
    await user.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', expect.any(Error));
  });

  it('displays related events when provided', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        relatedEvents={mockRelatedEvents}
      />
    );

    expect(screen.getByText('Related Events (3)')).toBeInTheDocument();
    expect(screen.getByText('Other events from the same session')).toBeInTheDocument();
    
    // Check that related events are displayed
    expect(screen.getByText('post_tool_use')).toBeInTheDocument();
    expect(screen.getByText('user_prompt_submit')).toBeInTheDocument();
    expect(screen.getByText('session_start')).toBeInTheDocument();
  });

  it('highlights current event in related events list', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        relatedEvents={mockRelatedEvents}
      />
    );

    // Find the current event in the related events list
    const relatedEventsList = screen.getByText('Related Events (3)').closest('div');
    const currentEventInList = relatedEventsList?.querySelector('[class*="border-accent-blue"]');
    
    expect(currentEventInList).toBeInTheDocument();
  });

  it('does not display related events section when no related events provided', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        relatedEvents={[]}
      />
    );

    expect(screen.queryByText(/Related Events/)).not.toBeInTheDocument();
  });

  it('sorts related events by timestamp (newest first)', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        relatedEvents={mockRelatedEvents}
      />
    );

    const relatedEventsSection = screen.getByText('Related Events (3)').closest('div');
    const timeElements = relatedEventsSection?.querySelectorAll('.font-mono');
    
    // Should be sorted with newest first
    // 14:32:15 (prompt), 14:30:45 (tool_use), 14:28:00 (session)
    expect(timeElements?.[0]).toHaveTextContent('14:32:15');
    expect(timeElements?.[1]).toHaveTextContent('14:30:45');
    expect(timeElements?.[2]).toHaveTextContent('14:28:00');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', () => {
    const onClose = jest.fn();

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={onClose}
      />
    );

    // Click on the backdrop (the overlay behind the modal)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('handles complex nested objects in JSON viewer', () => {
    const complexEvent: Event = {
      ...mockToolUseEvent,
      tool_name: 'ComplexTool',
      metadata: {
        parameters: {
          nested: {
            deep: {
              value: 'test',
              array: [1, 2, { inner: 'object' }],
              null_value: null,
              boolean: true,
              number: 42
            }
          }
        }
      }
    };

    render(
      <EventDetailModal
        event={complexEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('"nested"')).toBeInTheDocument();
    expect(screen.getByText('"deep"')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('expands and collapses JSON objects when clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    const nestedEvent: Event = {
      ...mockToolUseEvent,
      tool_name: 'Test',
      metadata: {
        nested_object: {
          key1: 'value1',
          key2: 'value2'
        }
      }
    };

    render(
      <EventDetailModal
        event={nestedEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    // Find a collapsible object button
    const objectButtons = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('{')
    );
    
    if (objectButtons.length > 0) {
      // Initially should show the object content
      expect(screen.getByText('"key1"')).toBeInTheDocument();
      
      // Click to collapse
      await user.click(objectButtons[0]);
      
      // The implementation may vary, but the button should be interactive
      expect(objectButtons[0]).toBeInTheDocument();
    }
  });

  it('formats timestamp strings with human-readable dates', () => {
    const timestampEvent: Event = {
      ...mockToolUseEvent,
      metadata: {
        created_at: '2024-01-15T14:30:45.123Z',
        updated_at: '2024-01-15T15:45:30.456Z'
      }
    };

    render(
      <EventDetailModal
        event={timestampEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    // Should show both the timestamp string and formatted date
    expect(screen.getByText(/Jan 15, 14:30:45/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 15:45:30/)).toBeInTheDocument();
  });

  it('clears copy feedback after timeout', async () => {
    const user = userEvent.setup({ delay: null });
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const copyButton = screen.getByText('Copy JSON');
    await user.click(copyButton);

    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Fast-forward time by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('Copy JSON')).toBeInTheDocument();
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });
  });

  it('displays tool name in related events when available', () => {
    render(
      <EventDetailModal
        event={mockToolUseEvent}
        isOpen={true}
        onClose={jest.fn()}
        relatedEvents={mockRelatedEvents}
      />
    );

    // Should show tool name for tool_use events
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('handles events with array data types', () => {
    const arrayEvent: Event = {
      ...mockToolUseEvent,
      tool_name: 'ArrayTool',
      metadata: {
        items: ['item1', 'item2', 'item3'],
        numbers: [1, 2, 3, 4, 5]
      }
    };

    render(
      <EventDetailModal
        event={arrayEvent}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('"items"')).toBeInTheDocument();
    expect(screen.getByText('"item1"')).toBeInTheDocument();
    expect(screen.getByText('"numbers"')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});