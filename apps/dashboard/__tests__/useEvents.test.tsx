import { renderHook, act, waitFor } from '@testing-library/react';
import { useEvents } from '../src/hooks/useEvents';
import { supabase, REALTIME_CONFIG } from '../src/lib/supabase';
import { EventType } from '../src/types/filters';
import { MONITORING_INTERVALS } from '../src/lib/constants';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
  REALTIME_CONFIG: {
    MAX_CACHED_EVENTS: 1000,
  },
}));

// Mock useSupabaseConnection
jest.mock('../src/hooks/useSupabaseConnection', () => ({
  useSupabaseConnection: jest.fn(() => ({
    status: {
      state: 'connected',
      lastUpdate: new Date(),
      lastEventReceived: null,
      subscriptions: 0,
      reconnectAttempts: 0,
      error: null,
      isHealthy: true,
    },
    registerChannel: jest.fn(),
    unregisterChannel: jest.fn(),
    recordEventReceived: jest.fn(),
    retry: jest.fn(),
    getConnectionQuality: 'excellent',
  })),
}));

// Mock constants
jest.mock('../src/lib/constants', () => ({
  MONITORING_INTERVALS: {
    HEALTH_CHECK_INTERVAL: 30000,
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('useEvents Hook', () => {
  let mockChannel: any;
  let mockFrom: any;
  let mockUseSupabaseConnection: any;

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
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      textSearch: jest.fn().mockReturnThis(),
    };

    mockSupabase.channel.mockReturnValue(mockChannel);
    mockSupabase.from.mockReturnValue(mockFrom);

    // Mock useSupabaseConnection
    const { useSupabaseConnection } = require('../src/hooks/useSupabaseConnection');
    mockUseSupabaseConnection = useSupabaseConnection;
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

  it('should set up real-time subscriptions for events and sessions', () => {
    mockFrom.range.mockResolvedValue({ data: [], error: null });

    renderHook(() => useEvents());

    // Should create both events and sessions channels
    expect(mockSupabase.channel).toHaveBeenCalledWith('events-realtime');
    expect(mockSupabase.channel).toHaveBeenCalledWith('sessions-realtime');
    
    // Should set up postgres_changes listeners for both
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chronicle_events' },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chronicle_sessions' },
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

  it('should cleanup subscriptions on unmount', () => {
    mockFrom.range.mockResolvedValue({ data: [], error: null });

    const { unmount } = renderHook(() => useEvents());

    unmount();

    // Should cleanup both event and session channels
    expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(2);
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

  describe('Advanced Filtering and Pagination', () => {
    it('should apply session ID filters', async () => {
      const sessionIds = ['session-1', 'session-2'];
      const filters = { sessionIds };
      
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      renderHook(() => useEvents({ filters }));

      await waitFor(() => {
        expect(mockFrom.in).toHaveBeenCalledWith('session_id', sessionIds);
      });
    });

    it('should apply event type filters', async () => {
      const eventTypes = ['user_prompt_submit', 'post_tool_use'] as EventType[];
      const filters = { eventTypes };
      
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      renderHook(() => useEvents({ filters }));

      await waitFor(() => {
        expect(mockFrom.in).toHaveBeenCalledWith('type', eventTypes);
      });
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filters = { dateRange: { start: startDate, end: endDate } };
      
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      renderHook(() => useEvents({ filters }));

      await waitFor(() => {
        expect(mockFrom.gte).toHaveBeenCalledWith('timestamp', startDate.toISOString());
        expect(mockFrom.lte).toHaveBeenCalledWith('timestamp', endDate.toISOString());
      });
    });

    it('should apply search query filters', async () => {
      const searchQuery = 'test search';
      const filters = { searchQuery };
      
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      renderHook(() => useEvents({ filters }));

      await waitFor(() => {
        expect(mockFrom.textSearch).toHaveBeenCalledWith('data', searchQuery);
      });
    });

    it('should handle loadMore pagination', async () => {
      const initialEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `event-${i}`,
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: new Date(`2024-01-${i + 1}T00:00:00Z`),
        metadata: { index: i },
        created_at: new Date(`2024-01-${i + 1}T00:00:00Z`),
      }));

      const moreEvents = Array.from({ length: 20 }, (_, i) => ({
        id: `event-${i + 50}`,
        session_id: 'session-1',
        event_type: 'post_tool_use',
        timestamp: new Date(`2024-02-${i + 1}T00:00:00Z`),
        metadata: { index: i + 50 },
        created_at: new Date(`2024-02-${i + 1}T00:00:00Z`),
      }));

      mockFrom.range
        .mockResolvedValueOnce({ data: initialEvents, error: null })
        .mockResolvedValueOnce({ data: moreEvents, error: null });

      const { result } = renderHook(() => useEvents({ limit: 50 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toHaveLength(50);
      expect(result.current.hasMore).toBe(true);

      // Load more
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.events).toHaveLength(70);
      });

      expect(mockFrom.range).toHaveBeenCalledWith(50, 99); // Second call with offset
    });

    it('should not load more when already loading', async () => {
      mockFrom.range.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useEvents());

      expect(result.current.loading).toBe(true);

      // Try to load more while loading
      act(() => {
        result.current.loadMore();
      });

      // Should only be called once (initial fetch)
      expect(mockFrom.range).toHaveBeenCalledTimes(1);
    });

    it('should not load more when no more data available', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `event-${i}`,
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: new Date(),
        metadata: {},
        created_at: new Date(),
      }));

      mockFrom.range.mockResolvedValue({ data: events, error: null });

      const { result } = renderHook(() => useEvents({ limit: 50 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false); // Less than limit returned

      // Try to load more
      act(() => {
        result.current.loadMore();
      });

      // Should only be called once (initial fetch)
      expect(mockFrom.range).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-time Subscription Management', () => {
    it('should not set up subscription when disabled', () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      renderHook(() => useEvents({ enableRealtime: false }));

      expect(mockSupabase.channel).not.toHaveBeenCalled();
    });

    it('should enforce maximum cached events limit', async () => {
      const initialEvents = [{
        id: 'initial-event',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: {},
        created_at: new Date('2024-01-01T00:00:00Z'),
      }];

      mockFrom.range.mockResolvedValue({ data: initialEvents, error: null });

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate adding many events via real-time
      const realtimeCallback = mockChannel.on.mock.calls[0][2];
      
      // Add events up to the limit
      for (let i = 0; i < REALTIME_CONFIG.MAX_CACHED_EVENTS; i++) {
        const newEvent = {
          id: `realtime-event-${i}`,
          session_id: 'session-1',
          event_type: 'post_tool_use',
          timestamp: new Date(`2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`),
          metadata: { index: i },
          created_at: new Date(),
        };

        act(() => {
          realtimeCallback({ new: newEvent });
        });
      }

      // Should be limited to MAX_CACHED_EVENTS
      expect(result.current.events).toHaveLength(REALTIME_CONFIG.MAX_CACHED_EVENTS);
    });

    it('should record event reception for connection monitoring', async () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const realtimeCallback = mockChannel.on.mock.calls[0][2];
      const recordEventReceived = mockUseSupabaseConnection().recordEventReceived;
      
      const newEvent = {
        id: 'test-event',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: new Date(),
        metadata: {},
        created_at: new Date(),
      };

      act(() => {
        realtimeCallback({ new: newEvent });
      });

      expect(recordEventReceived).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors during fetch', async () => {
      const networkError = new Error('Network request failed');
      mockFrom.range.mockRejectedValue(networkError);

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(networkError);
      expect(result.current.events).toEqual([]);
    });

    it('should handle partial fetch failures gracefully', async () => {
      // First fetch fails, second succeeds
      const mockError = new Error('Temporary failure');
      mockFrom.range
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);

      // Retry should work
      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should retry connection on error', async () => {
      const mockError = new Error('Connection lost');
      mockFrom.range.mockRejectedValue(mockError);

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const retryConnection = mockUseSupabaseConnection().retry;
      
      act(() => {
        result.current.retry();
      });

      expect(retryConnection).toHaveBeenCalled();
    });

    it('should clear event deduplication set on retry', async () => {
      const initialEvent = {
        id: 'duplicate-test',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: new Date(),
        metadata: {},
        created_at: new Date(),
      };

      mockFrom.range.mockResolvedValue({ data: [initialEvent], error: null });

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Retry should clear deduplication set
      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // Same event should be allowed after retry (deduplication cleared)
      const realtimeCallback = mockChannel.on.mock.calls[0][2];
      
      act(() => {
        realtimeCallback({ new: initialEvent });
      });

      // Should now have 2 instances (original + real-time)
      expect(result.current.events).toHaveLength(2);
    });
  });

  describe('Filter Stability and Performance', () => {
    it('should not refetch when filter object reference changes but values are same', async () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      const { result, rerender } = renderHook(
        ({ filters }) => useEvents({ filters }),
        { initialProps: { filters: { sessionIds: ['session-1'] } } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockFrom.range.mock.calls.length;

      // Rerender with new object but same values
      rerender({ filters: { sessionIds: ['session-1'] } });

      // Should not trigger new fetch
      expect(mockFrom.range.mock.calls.length).toBe(initialCallCount);
    });

    it('should refetch when filter values actually change', async () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      const { result, rerender } = renderHook(
        ({ filters }) => useEvents({ filters }),
        { initialProps: { filters: { sessionIds: ['session-1'] } } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockFrom.range.mock.calls.length;

      // Rerender with different values
      rerender({ filters: { sessionIds: ['session-2'] } });

      await waitFor(() => {
        expect(mockFrom.range.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Connection Status Integration', () => {
    it('should expose connection status from useSupabaseConnection', () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useEvents());

      expect(result.current.connectionStatus).toEqual({
        state: 'connected',
        lastUpdate: expect.any(Date),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true,
      });
    });

    it('should expose connection quality', () => {
      mockFrom.range.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useEvents());

      expect(result.current.connectionQuality).toBe('excellent');
    });
  });
});