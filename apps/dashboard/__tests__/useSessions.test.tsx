import { renderHook, waitFor } from '@testing-library/react';
import { useSessions } from '../src/hooks/useSessions';
import { supabase } from '../src/lib/supabase';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
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
});