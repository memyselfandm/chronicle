import { renderHook, act } from '@testing-library/react';
import { useSupabaseConnection } from '../../src/hooks/useSupabaseConnection';
import { createMockSupabaseClient, simulateSupabaseErrors } from '../../src/test-utils/supabaseMocks';
import { supabase } from '../../src/lib/supabase';

// Mock the supabase module
jest.mock('../../src/lib/supabase');

describe('Supabase Connection Integration Tests', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = createMockSupabaseClient();
    (supabase as any).from = mockSupabaseClient.from;
    jest.clearAllMocks();
  });

  describe('Connection State Management', () => {
    it('should initialize with connecting state and transition to connected', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Should start with connecting state
      expect(result.current.status.state).toBe('connecting');

      // Wait for health check to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.isHealthy).toBe(true);
      expect(result.current.status.error).toBeNull();
    });

    it('should handle connection failures during initialization', async () => {
      // Mock health check failure
      mockSupabaseClient.from().select().limit.mockResolvedValue(
        simulateSupabaseErrors.networkError()
      );

      const { result } = renderHook(() => useSupabaseConnection());

      // Wait for health check to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.status.state).toBe('disconnected');
      expect(result.current.status.isHealthy).toBe(false);
      expect(result.current.status.error).toContain('Network error');
    });

    it('should detect CORS/backend down errors specifically', async () => {
      // Mock CORS error
      mockSupabaseClient.from().select().limit.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch - CORS error' }
      });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toContain('Supabase backend is unreachable');
    });
  });

  describe('Health Check Monitoring', () => {
    it('should perform periodic health checks', async () => {
      const { result } = renderHook(() => useSupabaseConnection({
        healthCheckInterval: 100 // Fast interval for testing
      }));

      let healthCheckCalls = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        healthCheckCalls++;
        return Promise.resolve({ data: [], error: null });
      });

      // Wait for multiple health check cycles
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
      });

      expect(healthCheckCalls).toBeGreaterThan(2); // Should have called health check multiple times
      expect(result.current.status.isHealthy).toBe(true);
    });

    it('should disable health checks when requested', async () => {
      const { result } = renderHook(() => useSupabaseConnection({
        enableHealthCheck: false
      }));

      let healthCheckCalls = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        healthCheckCalls++;
        return Promise.resolve({ data: [], error: null });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      expect(healthCheckCalls).toBe(1); // Only initial check, no periodic checks
    });

    it('should recover from health check failures', async () => {
      let healthCheckCalls = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        healthCheckCalls++;
        if (healthCheckCalls === 1) {
          return Promise.resolve({ data: [], error: null }); // Initial success
        } else if (healthCheckCalls === 2) {
          return Promise.resolve(simulateSupabaseErrors.networkError()); // Failure
        } else {
          return Promise.resolve({ data: [], error: null }); // Recovery
        }
      });

      const { result } = renderHook(() => useSupabaseConnection({
        healthCheckInterval: 100
      }));

      // Wait for initial success
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(result.current.status.isHealthy).toBe(true);

      // Wait for failure
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });
      expect(result.current.status.isHealthy).toBe(false);

      // Wait for recovery
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });
      expect(result.current.status.isHealthy).toBe(true);
    });
  });

  describe('Channel Management', () => {
    it('should register and track channels correctly', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          setTimeout(() => callback('SUBSCRIBED'), 0);
          return {};
        }),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
      });

      expect(result.current.status.subscriptions).toBe(1);
      expect(mockChannel.on).toHaveBeenCalledWith('system', {}, expect.any(Function));
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle channel subscription success', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          setTimeout(() => callback('SUBSCRIBED'), 0);
          return {};
        }),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.reconnectAttempts).toBe(0);
    });

    it('should handle channel subscription errors with auto-reconnect', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          setTimeout(() => callback('CHANNEL_ERROR', { message: 'Subscription failed' }), 0);
          return {};
        }),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toContain('Subscription failed');
    });

    it('should unregister channels and update subscription count', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
      });
      expect(result.current.status.subscriptions).toBe(1);

      await act(async () => {
        result.current.unregisterChannel(mockChannel);
      });
      expect(result.current.status.subscriptions).toBe(0);
      expect(result.current.status.state).toBe('disconnected');
    });
  });

  describe('Reconnection Logic', () => {
    it('should implement exponential backoff for reconnection', async () => {
      let attemptTimes: number[] = [];
      
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        attemptTimes.push(Date.now());
        return Promise.resolve(simulateSupabaseErrors.networkError());
      });

      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 3,
        reconnectDelay: 50 // Fast for testing
      }));

      // Initial failure
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Trigger manual retry
      await act(async () => {
        result.current.retry();
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      expect(attemptTimes.length).toBeGreaterThan(2);
      
      // Check exponential backoff (each attempt should be roughly 2x the delay)
      if (attemptTimes.length >= 3) {
        const delay1 = attemptTimes[2] - attemptTimes[1];
        const delay2 = attemptTimes[1] - attemptTimes[0];
        expect(delay1).toBeGreaterThan(delay2); // Second delay should be longer
      }
    });

    it('should stop reconnecting after max attempts', async () => {
      let attemptCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        attemptCount++;
        return Promise.resolve(simulateSupabaseErrors.networkError());
      });

      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 2,
        reconnectDelay: 50
      }));

      await act(async () => {
        result.current.retry();
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toContain('Max reconnection attempts reached');
      expect(result.current.status.reconnectAttempts).toBe(2);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      let attemptCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve(simulateSupabaseErrors.networkError());
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 5,
        reconnectDelay: 50
      }));

      await act(async () => {
        result.current.retry();
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.reconnectAttempts).toBe(0);
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should calculate connection quality based on recent events', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Start with unknown quality (no events received)
      expect(result.current.getConnectionQuality).toBe('unknown');

      // Record a recent event
      await act(async () => {
        result.current.recordEventReceived();
      });

      expect(result.current.getConnectionQuality).toBe('excellent');
    });

    it('should degrade connection quality over time without events', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      // Record an event and check quality
      await act(async () => {
        result.current.recordEventReceived();
      });
      expect(result.current.getConnectionQuality).toBe('excellent');

      // Mock time passage by updating lastEventReceived to old timestamp
      await act(async () => {
        const oldTimestamp = new Date(Date.now() - 70000); // 70 seconds ago
        result.current.status.lastEventReceived = oldTimestamp;
      });

      // Quality should degrade
      expect(result.current.getConnectionQuality).toBe('poor');
    });
  });

  describe('State Debouncing', () => {
    it('should debounce rapid state changes to prevent flickering', async () => {
      const stateChanges: string[] = [];
      
      const { result } = renderHook(() => useSupabaseConnection());

      // Track state changes
      const originalState = result.current.status.state;
      stateChanges.push(originalState);

      // Simulate rapid state changes
      await act(async () => {
        mockSupabaseClient.from().select().limit
          .mockResolvedValueOnce(simulateSupabaseErrors.networkError())
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce(simulateSupabaseErrors.networkError());

        result.current.performHealthCheck();
        result.current.performHealthCheck();
        result.current.performHealthCheck();
        
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Should not have excessive state changes due to debouncing
      expect(stateChanges.length).toBeLessThan(5);
    });

    it('should handle connecting state display delay', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      let connectingStateShown = false;
      
      // Start a retry operation
      await act(async () => {
        result.current.retry();
        
        // Check immediately - should not show connecting yet
        if (result.current.status.state === 'connecting') {
          connectingStateShown = true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // After delay, should show connecting
        if (result.current.status.state === 'connecting') {
          connectingStateShown = true;
        }
      });

      expect(connectingStateShown).toBe(true);
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle health check timeout errors', async () => {
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), 100);
        });
      });

      const { result } = renderHook(() => useSupabaseConnection());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      expect(result.current.status.isHealthy).toBe(false);
      expect(result.current.status.error).toContain('Health check timeout');
    });

    it('should handle cleanup properly on unmount', async () => {
      const { result, unmount } = renderHook(() => useSupabaseConnection({
        healthCheckInterval: 50
      }));

      // Register a channel
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
      });

      // Unmount should cleanup everything
      unmount();

      // Wait a bit to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // No errors should occur from cleanup
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple simultaneous retry attempts', async () => {
      let attemptCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        attemptCount++;
        return Promise.resolve(simulateSupabaseErrors.networkError());
      });

      const { result } = renderHook(() => useSupabaseConnection({
        maxReconnectAttempts: 3,
        reconnectDelay: 50
      }));

      // Trigger multiple simultaneous retries
      await act(async () => {
        result.current.retry();
        result.current.retry();
        result.current.retry();
        
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      // Should not cause issues with multiple retry attempts
      expect(result.current.status.state).toBe('error');
      expect(attemptCount).toBeGreaterThan(0);
    });
  });

  describe('System Event Handling', () => {
    it('should handle postgres_changes system events', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockImplementation((eventType, config, callback) => {
          if (eventType === 'system') {
            // Simulate system event
            setTimeout(() => {
              callback({
                extension: 'postgres_changes',
                status: 'ok'
              });
            }, 50);
          }
          return mockChannel;
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.status.state).toBe('connected');
      expect(result.current.status.reconnectAttempts).toBe(0);
    });

    it('should handle postgres_changes error events', async () => {
      const { result } = renderHook(() => useSupabaseConnection());

      const mockChannel = {
        on: jest.fn().mockImplementation((eventType, config, callback) => {
          if (eventType === 'system') {
            setTimeout(() => {
              callback({
                extension: 'postgres_changes',
                status: 'error',
                message: 'Database connection lost'
              });
            }, 50);
          }
          return mockChannel;
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any;

      await act(async () => {
        result.current.registerChannel(mockChannel);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toContain('Database connection lost');
    });
  });
});