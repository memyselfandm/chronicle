import { renderHook, act, waitFor } from '@testing-library/react';
import { useEvents } from '../src/hooks/useEvents';
import { supabase } from '../src/lib/supabase';
import { EventType } from '../src/types/filters';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('useEvents Hook', () => {
  let mockChannel: any;
  let mockFrom: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock channel
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue('SUBSCRIBED'),
      unsubscribe: jest.fn(),
    };

    // Mock from
    mockFrom = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    };

    mockSupabase.channel.mockReturnValue(mockChannel);
    mockSupabase.from.mockReturnValue(mockFrom);
  });

  it('should initialize with empty state', () => {
    mockFrom.range.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useEvents());

    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch initial events on mount', async () => {
    const mockEvents = [
      {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'user_prompt_submit',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: { message: 'test' },
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    mockFrom.range.mockResolvedValue({ data: mockEvents, error: null });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors gracefully', async () => {
    const mockError = new Error('Failed to fetch events');
    mockFrom.range.mockResolvedValue({ data: null, error: mockError });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should set up real-time subscription', () => {
    mockFrom.range.mockResolvedValue({ data: [], error: null });

    renderHook(() => useEvents());

    expect(mockSupabase.channel).toHaveBeenCalledWith('events-realtime');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chronicle_events' },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('should add new events from real-time subscription', async () => {
    const initialEvents = [
      {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'user_prompt_submit',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: { message: 'initial' },
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    mockFrom.range.mockResolvedValue({ data: initialEvents, error: null });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate real-time event
    const newEvent = {
      id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      event_type: 'post_tool_use',
      tool_name: 'read_file',
      duration_ms: 150,
      timestamp: new Date('2024-01-01T01:00:00Z'),
      metadata: { status: 'success' },
      created_at: new Date('2024-01-01T01:00:00Z'),
    };

    const realtimeCallback = mockChannel.on.mock.calls[0][2];
    
    act(() => {
      realtimeCallback({ new: newEvent });
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0]).toEqual(newEvent); // Newest first
    expect(result.current.events[1]).toEqual(initialEvents[0]);
  });

  it('should prevent duplicate events', async () => {
    const initialEvents = [
      {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'user_prompt_submit',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: { message: 'test' },
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    mockFrom.range.mockResolvedValue({ data: initialEvents, error: null });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Try to add the same event via real-time
    const realtimeCallback = mockChannel.on.mock.calls[0][2];
    
    act(() => {
      realtimeCallback({ new: initialEvents[0] });
    });

    expect(result.current.events).toHaveLength(1); // No duplicates
  });

  it('should cleanup subscription on unmount', () => {
    mockFrom.range.mockResolvedValue({ data: [], error: null });

    const { unmount } = renderHook(() => useEvents());

    unmount();

    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it('should provide retry functionality', async () => {
    const mockError = new Error('Network error');
    mockFrom.range
      .mockResolvedValueOnce({ data: null, error: mockError })
      .mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);

    // Retry
    act(() => {
      result.current.retry();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.events).toEqual([]);
  });

  it('should sort events by timestamp (newest first)', async () => {
    const mockEvents = [
      {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'user_prompt_submit',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: { message: 'older' },
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'post_tool_use',
        tool_name: 'Edit',
        duration_ms: 200,
        timestamp: new Date('2024-01-01T02:00:00Z'),
        metadata: { message: 'newer' },
        created_at: new Date('2024-01-01T02:00:00Z'),
      },
    ];

    mockFrom.range.mockResolvedValue({ data: mockEvents, error: null });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events[0].event_type).toBe('post_tool_use'); // Newer event first
    expect(result.current.events[1].event_type).toBe('user_prompt_submit'); // Older event second
  });
});