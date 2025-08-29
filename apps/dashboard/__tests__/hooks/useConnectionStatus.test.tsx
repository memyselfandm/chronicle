/**
 * Comprehensive tests for useConnectionStatus hook
 * Tests connection state management, metrics tracking, and error handling
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useConnectionStatus, 
  useSimpleConnectionStatus, 
  useProductionConnectionStatus 
} from '../../src/hooks/useConnectionStatus';
import { ConnectionManager } from '../../src/lib/connection/ConnectionManager';

// Mock the ConnectionManager
jest.mock('../../src/lib/connection/ConnectionManager');

const MockConnectionManager = ConnectionManager as jest.MockedClass<typeof ConnectionManager>;

describe('useConnectionStatus Hook', () => {
  let mockManager: jest.Mocked<ConnectionManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock manager instance
    mockManager = {
      connect: jest.fn(),
      queueEvent: jest.fn(),
      subscribe: jest.fn(),
      reconnect: jest.fn(),
      clearQueue: jest.fn(),
      getConnectionStatus: jest.fn(),
      getHealthStatus: jest.fn(),
      destroy: jest.fn(),
      onConnectionStateChange: jest.fn(),
      getConnectionState: jest.fn(),
      getQueueMetrics: jest.fn()
    } as any;

    // Mock constructor to return our mock instance
    MockConnectionManager.mockImplementation(() => mockManager);

    // Default mock implementations
    mockManager.getConnectionStatus.mockReturnValue({
      state: 'disconnected',
      lastUpdate: null,
      lastEventReceived: null,
      subscriptions: 0,
      reconnectAttempts: 0,
      error: null,
      isHealthy: false,
      queuedEvents: 0
    });

    mockManager.getHealthStatus.mockReturnValue({
      isHealthy: true,
      connection: false,
      queue: true,
      eventProcessing: true,
      warnings: [],
      errors: []
    });

    mockManager.onConnectionStateChange.mockReturnValue(() => {});
    mockManager.subscribe.mockReturnValue(() => {});
    mockManager.connect.mockResolvedValue();
    mockManager.queueEvent.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Hook Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isDisconnected).toBe(true);
      expect(result.current.hasError).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should create connection manager with correct config', () => {
      const config = {
        url: 'ws://localhost:8510',
        reconnectAttempts: 10,
        reconnectDelay: 2000,
        heartbeatInterval: 60000,
        enableEventQueue: true,
        enablePersistence: false
      };

      renderHook(() => useConnectionStatus(config));

      expect(MockConnectionManager).toHaveBeenCalledWith(
        'ws://localhost:8510',
        expect.objectContaining({
          maxAttempts: 10,
          baseDelayMs: 2000,
          heartbeatInterval: 60000,
          enableEventQueue: true,
          enablePersistence: false
        })
      );
    });

    it('should subscribe to connection state changes', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      expect(mockManager.onConnectionStateChange).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('Connection State Management', () => {
    it('should update state when connection status changes', () => {
      let stateChangeCallback: any;
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      // Simulate connection state change
      act(() => {
        stateChangeCallback({
          state: 'connected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 2,
          reconnectAttempts: 0,
          error: null,
          isHealthy: true,
          queuedEvents: 0
        });
      });

      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isDisconnected).toBe(false);
      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('should handle connection errors', () => {
      let stateChangeCallback: any;
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      // Simulate connection error
      act(() => {
        stateChangeCallback({
          state: 'error',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 1,
          error: 'Connection failed',
          isHealthy: false,
          queuedEvents: 5
        });
      });

      expect(result.current.connectionState).toBe('error');
      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Connection failed');
      expect(result.current.reconnectAttempts).toBe(1);
      expect(result.current.queuedEvents).toBe(5);
    });

    it('should track uptime when connected', () => {
      let stateChangeCallback: any;
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      // Connect
      act(() => {
        stateChangeCallback({
          state: 'connected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 0,
          error: null,
          isHealthy: true,
          queuedEvents: 0
        });
      });

      expect(result.current.uptime).toBe(0);

      // Advance time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.uptime).toBe(5000);
    });

    it('should reset uptime on disconnect', () => {
      let stateChangeCallback: any;
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      // Connect and advance time
      act(() => {
        stateChangeCallback({
          state: 'connected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 0,
          error: null,
          isHealthy: true,
          queuedEvents: 0
        });
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.uptime).toBe(3000);

      // Disconnect
      act(() => {
        stateChangeCallback({
          state: 'disconnected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 0,
          error: null,
          isHealthy: false,
          queuedEvents: 0
        });
      });

      expect(result.current.uptime).toBe(0);
    });
  });

  describe('Auto-Connect Functionality', () => {
    it('should auto-connect when enabled', async () => {
      renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: true
        })
      );

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalled();
      });
    });

    it('should not auto-connect when disabled', () => {
      renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      expect(mockManager.connect).not.toHaveBeenCalled();
    });

    it('should handle auto-connect failure', async () => {
      mockManager.connect.mockRejectedValue(new Error('Connection failed'));
      
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: true
        })
      );

      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toBe('Auto-connect failed: Connection failed');
      });
    });
  });

  describe('Connection Actions', () => {
    it('should connect manually', async () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(mockManager.connect).toHaveBeenCalled();
    });

    it('should handle connect failure', async () => {
      mockManager.connect.mockRejectedValue(new Error('Connection failed'));
      
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      await expect(
        act(async () => {
          await result.current.connect();
        })
      ).rejects.toThrow('Connection failed');

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Connection failed');
    });

    it('should disconnect', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockManager.destroy).toHaveBeenCalled();
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should reconnect', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      act(() => {
        result.current.reconnect();
      });

      expect(mockManager.reconnect).toHaveBeenCalled();
    });

    it('should clear queue', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      act(() => {
        result.current.clearQueue();
      });

      expect(mockManager.clearQueue).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should queue events', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      const event = {
        id: 'test-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString()
      };

      act(() => {
        const success = result.current.queueEvent(event);
        expect(success).toBe(true);
      });

      expect(mockManager.queueEvent).toHaveBeenCalledWith(event);
    });

    it('should subscribe to events', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      const handler = jest.fn();

      act(() => {
        const unsubscribe = result.current.subscribe('test_event', handler);
        expect(typeof unsubscribe).toBe('function');
      });

      expect(mockManager.subscribe).toHaveBeenCalledWith('test_event', handler);
    });
  });

  describe('Callback Handling', () => {
    it('should call onConnectionChange callback', () => {
      const onConnectionChange = jest.fn();
      let stateChangeCallback: any;
      
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false,
          onConnectionChange
        })
      );

      const status = {
        state: 'connected' as const,
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true,
        queuedEvents: 0
      };

      act(() => {
        stateChangeCallback(status);
      });

      expect(onConnectionChange).toHaveBeenCalledWith(status);
    });

    it('should call onReconnectFailed callback', () => {
      const onReconnectFailed = jest.fn();
      let stateChangeCallback: any;
      
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false,
          reconnectAttempts: 3,
          onReconnectFailed
        })
      );

      act(() => {
        stateChangeCallback({
          state: 'disconnected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 3, // Max attempts reached
          error: 'Max attempts reached',
          isHealthy: false,
          queuedEvents: 0
        });
      });

      expect(onReconnectFailed).toHaveBeenCalled();
    });

    it('should call onQueueOverflow callback', () => {
      const onQueueOverflow = jest.fn();
      let stateChangeCallback: any;
      
      mockManager.onConnectionStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false,
          onQueueOverflow
        })
      );

      act(() => {
        stateChangeCallback({
          state: 'disconnected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 1,
          error: null,
          isHealthy: false,
          queuedEvents: 850 // Over threshold
        });
      });

      expect(onQueueOverflow).toHaveBeenCalledWith(850);
    });
  });

  describe('Health Status', () => {
    it('should provide health status', () => {
      mockManager.getHealthStatus.mockReturnValue({
        isHealthy: false,
        connection: false,
        queue: true,
        eventProcessing: false,
        warnings: ['Connection unstable'],
        errors: ['Processing error']
      });

      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      expect(result.current.isHealthy).toBe(false);
      expect(result.current.healthStatus.isHealthy).toBe(false);
      expect(result.current.healthStatus.connection).toBe(false);
      expect(result.current.healthStatus.queue).toBe(true);
      expect(result.current.healthStatus.eventProcessing).toBe(false);
      expect(result.current.healthStatus.warnings).toContain('Connection unstable');
      expect(result.current.healthStatus.errors).toContain('Processing error');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      unmount();

      expect(mockManager.destroy).toHaveBeenCalled();
    });

    it('should unsubscribe from state changes on unmount', () => {
      const unsubscribe = jest.fn();
      mockManager.onConnectionStateChange.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Convenience Hooks', () => {
    describe('useSimpleConnectionStatus', () => {
      it('should use simple configuration', () => {
        renderHook(() => useSimpleConnectionStatus('ws://localhost:8510'));

        expect(MockConnectionManager).toHaveBeenCalledWith(
          'ws://localhost:8510',
          expect.objectContaining({
            maxAttempts: 3,
            baseDelayMs: 1000,
            enableEventQueue: true,
            enablePersistence: false
          })
        );
      });
    });

    describe('useProductionConnectionStatus', () => {
      it('should use production configuration', () => {
        const callbacks = {
          onConnectionChange: jest.fn(),
          onReconnectFailed: jest.fn(),
          onQueueOverflow: jest.fn()
        };

        renderHook(() => useProductionConnectionStatus('ws://localhost:8510', callbacks));

        expect(MockConnectionManager).toHaveBeenCalledWith(
          'ws://localhost:8510',
          expect.objectContaining({
            maxAttempts: 10,
            baseDelayMs: 1000,
            heartbeatInterval: 30000,
            enableEventQueue: true,
            enablePersistence: true
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle manager creation failure', () => {
      MockConnectionManager.mockImplementation(() => {
        throw new Error('Manager creation failed');
      });

      expect(() => {
        renderHook(() => 
          useConnectionStatus({
            url: 'ws://localhost:8510',
            autoConnect: false
          })
        );
      }).toThrow('Manager creation failed');
    });

    it('should handle missing manager gracefully', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          url: 'ws://localhost:8510',
          autoConnect: false
        })
      );

      // Manually set manager to null
      (result.current as any).managerRef.current = null;

      // Operations should not throw
      expect(() => {
        result.current.queueEvent({ id: 'test' });
        result.current.subscribe('test', () => {});
      }).not.toThrow();
    });
  });
});