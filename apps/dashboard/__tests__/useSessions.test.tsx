import { renderHook, waitFor, act } from '@testing-library/react';
import { useSessions } from '../src/hooks/useSessions';
import { supabase } from '../src/lib/supabase';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock logger
jest.mock('../src/lib/utils', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('useSessions Hook', () => {
  let mockFrom: any;
  let mockRpc: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock behavior
    mockFrom = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Add a default resolved value for the final call in the chain
    mockFrom.order.mockResolvedValue({ data: [], error: null });

    mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });

    mockSupabase.from.mockReturnValue(mockFrom);
    mockSupabase.rpc.mockReturnValue(mockRpc);
  });

  it('should initialize with empty state', async () => {
    const { result } = renderHook(() => useSessions());

    expect(result.current.sessions).toEqual([]);
    expect(result.current.activeSessions).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch sessions and calculate summaries', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        project_path: '/project/one',
        git_branch: 'main',
        start_time: new Date('2024-01-01T00:00:00Z'),
        end_time: null,
        status: 'active',
        event_count: 0,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'session-2',
        project_path: '/project/two',
        git_branch: 'feature/test',
        start_time: new Date('2024-01-01T01:00:00Z'),
        end_time: new Date('2024-01-01T02:00:00Z'),
        status: 'completed',
        event_count: 0,
        created_at: new Date('2024-01-01T01:00:00Z'),
        updated_at: new Date('2024-01-01T02:00:00Z'),
      },
    ];

    const mockSummaries = [
      {
        session_id: 'session-1',
        total_events: 5,
        tool_usage_count: 3,
        error_count: 0,
        avg_response_time: 150,
      },
      {
        session_id: 'session-2',
        total_events: 8,
        tool_usage_count: 5,
        error_count: 1,
        avg_response_time: 200,
      },
    ];

    mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
    mockRpc.mockResolvedValue({ data: mockSummaries, error: null });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.activeSessions).toHaveLength(1);
    expect(result.current.activeSessions[0].id).toBe('session-1');
    expect(result.current.sessionSummaries.get('session-1')).toEqual(mockSummaries[0]);
  });

  it('should handle fetch errors gracefully', async () => {
    const mockError = new Error('Failed to fetch sessions');
    mockFrom.order.mockResolvedValue({ data: null, error: mockError });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should calculate session duration correctly', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        project_path: '/project',
        git_branch: 'main',
        start_time: new Date('2024-01-01T00:00:00Z'),
        end_time: new Date('2024-01-01T01:00:00Z'), // 1 hour duration
        status: 'completed',
        event_count: 0,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T01:00:00Z'),
      },
    ];

    mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const duration = result.current.getSessionDuration(mockSessions[0]);
    expect(duration).toBe(3600000); // 1 hour in milliseconds
  });

  it('should provide retry functionality', async () => {
    const mockError = new Error('Network error');
    mockFrom.order
      .mockResolvedValueOnce({ data: null, error: mockError })
      .mockResolvedValueOnce({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);

    // Retry
    await result.current.retry();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it('should filter active vs completed sessions correctly', async () => {
    const mockSessions = [
      {
        id: 'active-1',
        project_path: '/project',
        git_branch: 'main',
        start_time: new Date(),
        end_time: null,
        status: 'active',
        event_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'active-2',
        project_path: '/project',
        git_branch: 'develop',
        start_time: new Date(),
        end_time: null,
        status: 'active',
        event_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'completed-1',
        project_path: '/project',
        git_branch: 'main',
        start_time: new Date(),
        end_time: new Date(),
        status: 'completed',
        event_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(3);
    expect(result.current.activeSessions).toHaveLength(2);
    expect(result.current.activeSessions.every(s => s.status === 'active')).toBe(true);
  });

  describe('Session Summary Data Aggregation', () => {
    it('should use RPC function when available', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2024-01-01T00:00:00Z', end_time: null },
        { id: 'session-2', start_time: '2024-01-01T01:00:00Z', end_time: null },
      ];

      const mockSummaries = [
        {
          session_id: 'session-1',
          total_events: 10,
          tool_usage_count: 5,
          error_count: 1,
          avg_response_time: 150,
        },
        {
          session_id: 'session-2',
          total_events: 20,
          tool_usage_count: 8,
          error_count: 0,
          avg_response_time: 200,
        },
      ];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: mockSummaries, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_session_summaries', {
        session_ids: ['session-1', 'session-2'],
      });

      expect(result.current.sessionSummaries.get('session-1')).toEqual(mockSummaries[0]);
      expect(result.current.sessionSummaries.get('session-2')).toEqual(mockSummaries[1]);
    });

    it('should fallback to manual aggregation when RPC fails', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2024-01-01T00:00:00Z', end_time: null },
      ];

      const mockEvents = [
        {
          event_type: 'user_prompt_submit',
          metadata: {},
          timestamp: '2024-01-01T00:00:00Z',
          duration_ms: null,
        },
        {
          event_type: 'pre_tool_use',
          metadata: {},
          timestamp: '2024-01-01T00:01:00Z',
          duration_ms: null,
        },
        {
          event_type: 'post_tool_use',
          metadata: {},
          timestamp: '2024-01-01T00:02:00Z',
          duration_ms: 150,
        },
        {
          event_type: 'error',
          metadata: { error: 'Test error' },
          timestamp: '2024-01-01T00:03:00Z',
          duration_ms: null,
        },
      ];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC not available') });
      
      // Second call to from for events
      mockFrom.eq.mockResolvedValue({ data: mockEvents, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const summary = result.current.sessionSummaries.get('session-1');
      expect(summary).toEqual({
        session_id: 'session-1',
        total_events: 4,
        tool_usage_count: 2, // pre_tool_use + post_tool_use
        error_count: 1, // error event
        avg_response_time: 150, // Only post_tool_use has duration
      });
    });

    it('should calculate average response time correctly', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2024-01-01T00:00:00Z', end_time: null },
      ];

      const mockEvents = [
        {
          event_type: 'post_tool_use',
          metadata: { duration_ms: 100 },
          timestamp: '2024-01-01T00:00:00Z',
          duration_ms: null,
        },
        {
          event_type: 'post_tool_use',
          metadata: {},
          timestamp: '2024-01-01T00:01:00Z',
          duration_ms: 200,
        },
        {
          event_type: 'post_tool_use',
          metadata: {},
          timestamp: '2024-01-01T00:02:00Z',
          duration_ms: 300,
        },
      ];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC not available') });
      mockFrom.eq.mockResolvedValue({ data: mockEvents, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const summary = result.current.sessionSummaries.get('session-1');
      expect(summary?.avg_response_time).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should handle sessions with no tool events', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2024-01-01T00:00:00Z', end_time: null },
      ];

      const mockEvents = [
        {
          event_type: 'user_prompt_submit',
          metadata: {},
          timestamp: '2024-01-01T00:00:00Z',
          duration_ms: null,
        },
        {
          event_type: 'session_start',
          metadata: {},
          timestamp: '2024-01-01T00:00:00Z',
          duration_ms: null,
        },
      ];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC not available') });
      mockFrom.eq.mockResolvedValue({ data: mockEvents, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const summary = result.current.sessionSummaries.get('session-1');
      expect(summary).toEqual({
        session_id: 'session-1',
        total_events: 2,
        tool_usage_count: 0,
        error_count: 0,
        avg_response_time: null, // No tool events
      });
    });
  });

  describe('Session Activity Detection', () => {
    beforeEach(() => {
      mockFrom.order.mockResolvedValue({ data: [], error: null });
      mockRpc.mockResolvedValue({ data: [], error: null });
    });

    it('should check session activity via events', async () => {
      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock no stop events (session is active)
      mockFrom.limit.mockResolvedValue({ data: [], error: null });

      const isActive = await act(async () => {
        return result.current.isSessionActive('test-session');
      });

      expect(isActive).toBe(true);
      expect(mockFrom.eq).toHaveBeenCalledWith('session_id', 'test-session');
      expect(mockFrom.in).toHaveBeenCalledWith('event_type', ['stop', 'subagent_stop']);
    });

    it('should detect inactive sessions via stop events', async () => {
      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock stop event exists (session is inactive)
      mockFrom.limit.mockResolvedValue({ 
        data: [{ event_type: 'stop' }], 
        error: null 
      });

      const isActive = await act(async () => {
        return result.current.isSessionActive('test-session');
      });

      expect(isActive).toBe(false);
    });

    it('should handle errors in session activity check', async () => {
      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock error in stop events query
      mockFrom.limit.mockResolvedValue({ 
        data: null, 
        error: new Error('Query failed') 
      });

      const isActive = await act(async () => {
        return result.current.isSessionActive('test-session');
      });

      expect(isActive).toBe(false); // Defaults to false on error
    });
  });

  describe('Session Metrics Calculations', () => {
    it('should calculate session duration for active sessions using current time', async () => {
      const activeSession = {
        id: 'session-1',
        start_time: new Date(Date.now() - 60000), // 1 minute ago
        end_time: null,
      };

      const { result } = renderHook(() => useSessions());

      const duration = result.current.getSessionDuration(activeSession as any);

      expect(duration).toBeGreaterThan(50000); // At least 50 seconds
      expect(duration).toBeLessThan(70000); // Less than 70 seconds
    });

    it('should return null for sessions without start time', async () => {
      const { result } = renderHook(() => useSessions());

      const invalidSession = { id: 'invalid', start_time: null, end_time: null } as any;
      const duration = result.current.getSessionDuration(invalidSession);

      expect(duration).toBeNull();
    });

    it('should calculate session success rate correctly', async () => {
      const mockSessions = [{ id: 'session-1', start_time: '2024-01-01T00:00:00Z' }];
      const mockSummaries = [{
        session_id: 'session-1',
        total_events: 20,
        tool_usage_count: 10,
        error_count: 2,
        avg_response_time: 150,
      }];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: mockSummaries, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const successRate = result.current.getSessionSuccessRate('session-1');
      expect(successRate).toBe(90); // (20 - 2) / 20 * 100 = 90%
    });

    it('should return null for sessions without summary data', async () => {
      const { result } = renderHook(() => useSessions());

      const successRate = result.current.getSessionSuccessRate('non-existent-session');
      expect(successRate).toBeNull();
    });

    it('should return null for sessions with zero events', async () => {
      const mockSessions = [{ id: 'session-1', start_time: '2024-01-01T00:00:00Z' }];
      const mockSummaries = [{
        session_id: 'session-1',
        total_events: 0,
        tool_usage_count: 0,
        error_count: 0,
        avg_response_time: null,
      }];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockResolvedValue({ data: mockSummaries, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const successRate = result.current.getSessionSuccessRate('session-1');
      expect(successRate).toBeNull();
    });
  });

  // Note: Session End Time Updates section removed - end times are now handled 
  // automatically by database triggers when stop events with session_termination=true are inserted

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty session lists', async () => {
      mockFrom.order.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sessions).toEqual([]);
      expect(result.current.activeSessions).toEqual([]);
      expect(result.current.sessionSummaries.size).toBe(0);
    });

    it('should handle null session data', async () => {
      mockFrom.order.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sessions).toEqual([]);
    });

    it('should handle RPC function errors gracefully', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2024-01-01T00:00:00Z' },
      ];

      mockFrom.order.mockResolvedValue({ data: mockSessions, error: null });
      mockRpc.mockRejectedValue(new Error('RPC function failed'));

      // Fallback should work
      mockFrom.eq.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useSessions());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sessions).toEqual(mockSessions);
      // Should fallback to manual aggregation
      expect(mockFrom.eq).toHaveBeenCalled();
    });

    it('should handle sessions with malformed date strings', async () => {
      const sessionWithInvalidDate = {
        id: 'session-1',
        start_time: 'invalid-date',
        end_time: '2024-01-01T01:00:00Z',
      };

      const { result } = renderHook(() => useSessions());

      const duration = result.current.getSessionDuration(sessionWithInvalidDate as any);

      expect(duration).toBeNull(); // Should handle gracefully
    });
  });
});