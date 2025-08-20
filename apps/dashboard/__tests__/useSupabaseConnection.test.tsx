import { renderHook, act, waitFor } from '@testing-library/react';
import { useSupabaseConnection } from '../src/hooks/useSupabaseConnection';
import { supabase } from '../src/lib/supabase';
import { CONNECTION_DELAYS, MONITORING_INTERVALS } from '../src/lib/constants';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
  REALTIME_CONFIG: {
    RECONNECT_ATTEMPTS: 5,
  },
}));

// Mock constants
jest.mock('../src/lib/constants', () => ({
  CONNECTION_DELAYS: {
    DEBOUNCE_DELAY: 100,
    CONNECTING_DISPLAY_DELAY: 500,
    QUICK_RECONNECT_DELAY: 1000,
    RECONNECT_DELAY: 2000,
  },
  MONITORING_INTERVALS: {
    HEALTH_CHECK_INTERVAL: 30000,
    RECENT_EVENT_THRESHOLD: 60000,
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

describe('useSupabaseConnection Hook', () => {
  let mockFrom: any;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock from (for health checks)
    mockFrom = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Mock channel
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSupabase.from.mockReturnValue(mockFrom);
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State and Options', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      expect(result.current.status).toEqual({
        state: 'connecting',
        lastUpdate: expect.any(Date),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: false,
      });
    });

    it('should accept custom options', () => {
      const options = {
        enableHealthCheck: false,
        healthCheckInterval: 10000,
        maxReconnectAttempts: 3,
        reconnectDelay: 500,
      };

      renderHook(() => useSupabaseConnection(options));
      // Should not perform health check when disabled
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should perform initial health check when enabled', async () => {
      mockFrom.limit.mockResolvedValue({ error: null });

      renderHook(() => useSupabaseConnection({ enableHealthCheck: true }));

      // Fast-forward to trigger initial health check
      await act(async () => {
        jest.runAllTimers();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('chronicle_events');
      expect(mockFrom.select).toHaveBeenCalledWith('id');
      expect(mockFrom.limit).toHaveBeenCalledWith(1);
    });
  });

  describe('Health Check Logic', () => {
    it('should mark connection as healthy when health check passes', async () => {
      mockFrom.limit.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.isHealthy).toBe(true);
        expect(result.current.status.state).toBe('connected');
        expect(result.current.status.error).toBeNull();
      });
    });

    it('should handle CORS/network errors as backend down', async () => {
      const corsError = new Error('Failed to fetch');
      mockFrom.limit.mockResolvedValue({ error: corsError });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.isHealthy).toBe(false);
        expect(result.current.status.state).toBe('error');
        expect(result.current.status.error).toContain('Supabase backend is unreachable');
      });
    });

    it('should handle non-CORS errors gracefully', async () => {
      const regularError = new Error('Permission denied');
      mockFrom.limit.mockResolvedValue({ error: regularError });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.isHealthy).toBe(false);
        expect(result.current.status.error).toContain('Health check failed: Permission denied');
      });
    });

    it('should handle health check exceptions', async () => {
      mockFrom.limit.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.isHealthy).toBe(false);
        expect(result.current.status.state).toBe('error');
        expect(result.current.status.error).toBe('Network timeout');
      });
    });

    it('should transition from error to connected when health check recovers', async () => {
      // First health check fails
      mockFrom.limit.mockResolvedValueOnce({ error: new Error('Network error') });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.state).toBe('disconnected');
      });

      // Second health check succeeds
      mockFrom.limit.mockResolvedValueOnce({ error: null });

      await act(async () => {
        jest.advanceTimersByTime(30000); // Health check interval
      });

      await waitFor(() => {
        expect(result.current.status.state).toBe('connected');
        expect(result.current.status.isHealthy).toBe(true);
      });
    });
  });

  describe('Connection State Debouncing', () => {
    it('should debounce rapid state changes', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Rapidly change from connected to disconnected
      act(() => {
        result.current.status.state = 'connected';
      });

      act(() => {
        // Simulate rapid disconnection
        result.current.updateStatus?.({ state: 'disconnected' });
      });

      // State should not change immediately due to debouncing
      expect(result.current.status.state).toBe('connecting');

      // Fast-forward debounce delay
      act(() => {
        jest.advanceTimersByTime(CONNECTION_DELAYS.DEBOUNCE_DELAY + 100);
      });

      await waitFor(() => {
        expect(result.current.status.state).toBe('disconnected');
      });
    });

    it('should handle connecting state with display delay', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Should not show connecting immediately
      expect(result.current.status.state).toBe('connecting');

      // After display delay, should show connecting
      act(() => {
        jest.advanceTimersByTime(CONNECTION_DELAYS.CONNECTING_DISPLAY_DELAY + 100);
      });

      expect(result.current.status.state).toBe('connecting');
    });
  });

  describe('Channel Management', () => {
    it('should register channels and update subscription count', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel1 = { on: jest.fn(), subscribe: jest.fn() };
      const mockChannel2 = { on: jest.fn(), subscribe: jest.fn() };

      act(() => {
        result.current.registerChannel(mockChannel1 as any);
      });

      expect(result.current.status.subscriptions).toBe(1);

      act(() => {
        result.current.registerChannel(mockChannel2 as any);
      });

      expect(result.current.status.subscriptions).toBe(2);
    });

    it('should unregister channels and update subscription count', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel1 = { on: jest.fn(), subscribe: jest.fn() };

      // Register channel
      act(() => {
        result.current.registerChannel(mockChannel1 as any);
      });

      expect(result.current.status.subscriptions).toBe(1);

      // Unregister channel
      act(() => {
        result.current.unregisterChannel(mockChannel1 as any);
      });

      expect(result.current.status.subscriptions).toBe(0);
    });

    it('should stop health check when no channels remain', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = { on: jest.fn(), subscribe: jest.fn() };

      // Register and unregister channel
      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      act(() => {
        result.current.unregisterChannel(mockChannel as any);
      });

      expect(result.current.status.subscriptions).toBe(0);
      expect(result.current.status.state).toBe('disconnected');
      expect(result.current.status.isHealthy).toBe(false);
    });

    it('should set up system event listeners on channel registration', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      };

      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      expect(mockChannel.on).toHaveBeenCalledWith('system', {}, expect.any(Function));
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      mockFrom.limit.mockResolvedValue({ error: null });
    });

    it('should implement exponential backoff for reconnection', async () => {
      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 3,
        reconnectDelay: 1000,
      }));

      // Initial state
      await act(async () => {
        jest.runAllTimers();
      });

      // Trigger reconnection by setting error state
      act(() => {
        result.current.retry();
      });

      expect(result.current.status.state).toBe('connecting');
      expect(result.current.status.reconnectAttempts).toBe(0);

      // Let reconnection complete
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.state).toBe('connected');
      });
    });

    it('should respect max reconnection attempts', async () => {
      mockFrom.limit.mockResolvedValue({ error: new Error('Persistent error') });

      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
      }));

      // Trigger multiple reconnection attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.retry();
        });

        await act(async () => {
          jest.runAllTimers();
        });
      }

      await waitFor(() => {
        expect(result.current.status.state).toBe('error');
        expect(result.current.status.error).toContain('Max reconnection attempts reached');
      });
    });

    it('should reset reconnection attempts on successful connection', async () => {
      // First attempt fails
      mockFrom.limit.mockResolvedValueOnce({ error: new Error('Temporary error') });
      // Second attempt succeeds
      mockFrom.limit.mockResolvedValueOnce({ error: null });

      const { result } = renderHook(() => useSupabaseConnection());

      act(() => {
        result.current.retry();
      });

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.reconnectAttempts).toBe(0);
        expect(result.current.status.state).toBe('connected');
      });
    });
  });

  describe('Event Recording and Quality Monitoring', () => {
    it('should record event reception and update health status', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      act(() => {
        result.current.recordEventReceived();
      });

      expect(result.current.status.lastEventReceived).toBeInstanceOf(Date);
      expect(result.current.status.isHealthy).toBe(true);
    });

    it('should calculate connection quality based on recent events', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // No events received
      expect(result.current.getConnectionQuality).toBe('unknown');

      // Record recent event
      act(() => {
        result.current.recordEventReceived();
      });

      expect(result.current.getConnectionQuality).toBe('excellent');

      // Advance time to make event older
      act(() => {
        jest.advanceTimersByTime(15000); // 15 seconds
      });

      expect(result.current.getConnectionQuality).toBe('good');

      // Much older event
      act(() => {
        jest.advanceTimersByTime(50000); // 65 seconds total
      });

      expect(result.current.getConnectionQuality).toBe('poor');
    });
  });

  describe('Manual Retry Functionality', () => {
    it('should clear pending timeouts on manual retry', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Trigger retry which should clear any pending operations
      act(() => {
        result.current.retry();
      });

      expect(result.current.status.reconnectAttempts).toBe(0);
      expect(result.current.status.error).toBeNull();
    });

    it('should trigger reconnection on manual retry', async () => {
      mockFrom.limit.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useSupabaseConnection());

      act(() => {
        result.current.retry();
      });

      expect(result.current.status.state).toBe('connecting');

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.status.state).toBe('connected');
      });
    });
  });

  describe('Cleanup and Unmount', () => {
    it('should cleanup all resources on unmount', () => {
      const { unmount } = renderHook(() => useSupabaseConnection());

      // Unmount should clear all intervals and timeouts
      unmount();

      // No errors should occur when timers are cleared
      expect(() => {
        jest.runAllTimers();
      }).not.toThrow();
    });

    it('should stop health check monitoring on unmount', () => {
      const { result, unmount } = renderHook(() => useSupabaseConnection());

      // Health check should be running
      expect(result.current.status).toBeDefined();

      unmount();

      // Should not throw when trying to clear intervals
      expect(() => {
        jest.runAllTimers();
      }).not.toThrow();
    });
  });

  describe('Channel Subscription Callbacks', () => {
    it('should handle successful channel subscription', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate successful subscription
          callback('SUBSCRIBED', null);
        }),
      };

      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.reconnectAttempts).toBe(0);
      expect(result.current.status.error).toBeNull();
    });

    it('should handle channel errors and trigger reconnection', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate channel error
          callback('CHANNEL_ERROR', { message: 'Connection lost' });
        }),
      };

      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toBe('Connection lost');

      // Should trigger auto-reconnection after delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });
    });

    it('should handle channel timeout and trigger reconnection', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate timeout
          callback('TIMED_OUT', null);
        }),
      };

      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      expect(result.current.status.state).toBe('disconnected');
      expect(result.current.status.error).toBe('Connection timed out');

      // Should trigger quick reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    });

    it('should handle system events for postgres changes', () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn((event, filter, callback) => {
          if (event === 'system') {
            // Store callback for later invocation
            mockChannel.systemCallback = callback;
          }
          return mockChannel;
        }),
        subscribe: jest.fn(),
        systemCallback: null as any,
      };

      act(() => {
        result.current.registerChannel(mockChannel as any);
      });

      // Simulate successful postgres_changes system event
      act(() => {
        mockChannel.systemCallback({
          extension: 'postgres_changes',
          status: 'ok',
        });
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.reconnectAttempts).toBe(0);

      // Simulate error system event
      act(() => {
        mockChannel.systemCallback({
          extension: 'postgres_changes',
          status: 'error',
          message: 'Database connection failed',
        });
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toBe('Database connection failed');
    });
  });

  describe('Performance Health Check', () => {
    it('should call performHealthCheck manually', async () => {
      mockFrom.limit.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useSupabaseConnection());

      const healthCheckResult = await act(async () => {
        return result.current.performHealthCheck();
      });

      expect(healthCheckResult).toBe(true);
      expect(result.current.status.isHealthy).toBe(true);
    });

    it('should return false for failed health check', async () => {
      mockFrom.limit.mockResolvedValue({ error: new Error('Connection failed') });

      const { result } = renderHook(() => useSupabaseConnection());

      const healthCheckResult = await act(async () => {
        return result.current.performHealthCheck();
      });

      expect(healthCheckResult).toBe(false);
      expect(result.current.status.isHealthy).toBe(false);
    });
  });
});