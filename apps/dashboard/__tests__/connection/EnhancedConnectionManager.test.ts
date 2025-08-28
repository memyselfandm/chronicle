/**
 * Comprehensive tests for Enhanced ConnectionManager
 * Tests the enhanced connection manager that wraps the base implementation
 */

import { ConnectionManager, createConnectionManager, resetEnhancedConnectionManager } from '../../src/lib/connection/ConnectionManager';
import { EventQueue } from '../../src/lib/connection/EventQueue';
import { getConnectionManager, resetConnectionManager } from '../../src/lib/connectionManager';

// Mock the base connection manager
jest.mock('../../src/lib/connectionManager', () => ({
  getConnectionManager: jest.fn(),
  resetConnectionManager: jest.fn()
}));

// Mock EventQueue
jest.mock('../../src/lib/connection/EventQueue');

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {}
  
  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }));
    }
  }
}

// Mock base connection manager
const mockBaseManager = {
  getConnectionStatus: jest.fn(),
  send: jest.fn(),
  subscribe: jest.fn(),
  reconnect: jest.fn(),
  destroy: jest.fn(),
  getHealthStatus: jest.fn()
};

describe('Enhanced ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  const testUrl = 'ws://localhost:8510/test';

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock getConnectionManager to return our mock
    (getConnectionManager as jest.Mock).mockReturnValue(mockBaseManager);
    
    // Default mock implementations
    mockBaseManager.getConnectionStatus.mockReturnValue({
      state: 'disconnected',
      lastUpdate: null,
      lastEventReceived: null,
      subscriptions: 0,
      reconnectAttempts: 0,
      error: null,
      isHealthy: false
    });

    mockBaseManager.getHealthStatus.mockReturnValue({
      isHealthy: true,
      checks: {
        connection: true,
        subscriptions: true,
        eventProcessing: true,
        performance: true
      },
      warnings: [],
      errors: []
    });

    mockBaseManager.send.mockReturnValue(true);
    mockBaseManager.subscribe.mockReturnValue(() => {});
  });

  afterEach(() => {
    if (connectionManager) {
      connectionManager.destroy();
    }
    resetEnhancedConnectionManager();
    resetConnectionManager();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create enhanced connection manager with default config', () => {
      connectionManager = new ConnectionManager(testUrl);
      
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
      expect(getConnectionManager).toHaveBeenCalledWith(testUrl, expect.objectContaining({
        maxAttempts: 5,
        baseDelayMs: 1000
      }));
    });

    it('should create enhanced connection manager with custom config', () => {
      const customConfig = {
        maxAttempts: 10,
        baseDelayMs: 2000,
        enableEventQueue: false,
        enablePersistence: false
      };

      connectionManager = new ConnectionManager(testUrl, customConfig);
      
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
      expect(getConnectionManager).toHaveBeenCalledWith(testUrl, expect.objectContaining({
        maxAttempts: 10,
        baseDelayMs: 2000
      }));
    });

    it('should initialize event queue with proper config', () => {
      connectionManager = new ConnectionManager(testUrl, {
        queueMaxSize: 500,
        enablePersistence: true
      });

      expect(EventQueue).toHaveBeenCalledWith({
        maxQueueSize: 500,
        persistToStorage: true,
        storageKey: 'chronicle-connection-queue'
      });
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should handle successful connection', async () => {
      // Mock connected state
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      await connectionManager.connect();

      expect(connectionManager.getConnectionState()).toBe('connected');
    });

    it('should handle connection failure with retry', async () => {
      // Mock connection failure
      mockBaseManager.getConnectionStatus
        .mockReturnValueOnce({
          state: 'connecting',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 1,
          error: null,
          isHealthy: false
        })
        .mockReturnValueOnce({
          state: 'disconnected',
          lastUpdate: new Date(),
          lastEventReceived: null,
          subscriptions: 0,
          reconnectAttempts: 1,
          error: 'Connection failed',
          isHealthy: false
        });

      await expect(connectionManager.connect()).rejects.toThrow();
      
      // Should attempt reconnection
      jest.advanceTimersByTime(1000);
      
      expect(connectionManager.getConnectionState()).toBe('connecting');
    });

    it('should stop reconnecting after max attempts', async () => {
      connectionManager = new ConnectionManager(testUrl, { maxAttempts: 2 });
      
      // Mock persistent failure
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'disconnected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 2,
        error: 'Max attempts reached',
        isHealthy: false
      });

      // Trigger multiple failures
      for (let i = 0; i < 3; i++) {
        try {
          await connectionManager.connect();
        } catch (error) {
          // Expected to fail
        }
        jest.advanceTimersByTime(2000);
      }

      expect(connectionManager.getConnectionState()).toBe('disconnected');
    });

    it('should force reconnection when requested', () => {
      connectionManager.reconnect();
      
      expect(mockBaseManager.reconnect).toHaveBeenCalled();
    });
  });

  describe('Event Queuing', () => {
    let mockEventQueue: any;

    beforeEach(() => {
      mockEventQueue = {
        enqueue: jest.fn(),
        flush: jest.fn(),
        clear: jest.fn(),
        getMetrics: jest.fn(),
        getHealthStatus: jest.fn(),
        subscribe: jest.fn(),
        markEventsFailed: jest.fn(),
        destroy: jest.fn()
      };

      (EventQueue as jest.Mock).mockImplementation(() => mockEventQueue);
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should send events immediately when connected', () => {
      // Mock connected state
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      const event = {
        id: 'test-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString()
      };

      const success = connectionManager.queueEvent(event);

      expect(success).toBe(true);
      expect(mockBaseManager.send).toHaveBeenCalledWith(event);
      expect(mockEventQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should queue events when disconnected', () => {
      // Mock disconnected state
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'disconnected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: false
      });

      mockEventQueue.enqueue.mockReturnValue(true);

      const event = {
        id: 'test-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString()
      };

      const success = connectionManager.queueEvent(event);

      expect(success).toBe(true);
      expect(mockEventQueue.enqueue).toHaveBeenCalledWith(event, 'normal');
      expect(mockBaseManager.send).not.toHaveBeenCalled();
    });

    it('should flush event queue when connection is restored', async () => {
      const queuedEvents = [
        {
          id: 'queued-1',
          event: { id: 'test-1', event_type: 'test' },
          priority: 'normal',
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      mockEventQueue.flush.mockReturnValue(queuedEvents);
      mockBaseManager.send.mockReturnValue(true);

      // Simulate connection restoration
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      await connectionManager.connect();

      expect(mockEventQueue.flush).toHaveBeenCalled();
      expect(mockBaseManager.send).toHaveBeenCalledWith(queuedEvents[0].event);
    });

    it('should re-queue failed events during flush', async () => {
      const queuedEvents = [
        {
          id: 'queued-1',
          event: { id: 'test-1', event_type: 'test' },
          priority: 'normal',
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      mockEventQueue.flush.mockReturnValue(queuedEvents);
      mockBaseManager.send.mockReturnValue(false); // Simulate send failure

      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      await connectionManager.connect();

      expect(mockEventQueue.enqueue).toHaveBeenCalledWith(
        queuedEvents[0].event, 
        queuedEvents[0].priority
      );
      expect(mockEventQueue.markEventsFailed).toHaveBeenCalledWith([queuedEvents[0].id]);
    });

    it('should handle queue retry events', () => {
      const retryEvents = [
        {
          id: 'retry-1',
          event: { id: 'test-1', event_type: 'test' },
          priority: 'normal',
          timestamp: new Date(),
          retryCount: 1,
          maxRetries: 3
        }
      ];

      mockEventQueue.subscribe.mockImplementation((callback) => {
        // Simulate retry callback
        setTimeout(() => {
          callback(retryEvents, { type: 'retry' });
        }, 100);
        return () => {};
      });

      // Mock connected state for retry processing
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date(),
        lastEventReceived: null,
        subscriptions: 0,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      mockBaseManager.send.mockReturnValue(true);

      // Trigger retry
      jest.advanceTimersByTime(200);

      expect(mockBaseManager.send).toHaveBeenCalledWith(retryEvents[0].event);
    });

    it('should clear event queue when requested', () => {
      connectionManager.clearQueue();
      
      expect(mockEventQueue.clear).toHaveBeenCalled();
    });

    it('should get queue metrics', () => {
      const mockMetrics = {
        totalEnqueued: 10,
        totalDequeued: 8,
        currentSize: 2,
        failedEvents: 1,
        retriedEvents: 2,
        lastFlushTime: new Date(),
        memoryUsage: 1024
      };

      mockEventQueue.getMetrics.mockReturnValue(mockMetrics);

      const metrics = connectionManager.getQueueMetrics();
      
      expect(metrics).toEqual(mockMetrics);
      expect(mockEventQueue.getMetrics).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    let mockEventQueue: any;

    beforeEach(() => {
      mockEventQueue = {
        getHealthStatus: jest.fn(),
        getMetrics: jest.fn(),
        enqueue: jest.fn(),
        flush: jest.fn(),
        clear: jest.fn(),
        subscribe: jest.fn(),
        destroy: jest.fn()
      };

      (EventQueue as jest.Mock).mockImplementation(() => mockEventQueue);
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should report overall health status', () => {
      mockBaseManager.getHealthStatus.mockReturnValue({
        isHealthy: true,
        checks: {
          connection: true,
          subscriptions: true,
          eventProcessing: true,
          performance: true
        },
        warnings: [],
        errors: []
      });

      mockEventQueue.getHealthStatus.mockReturnValue({
        isHealthy: true,
        warnings: [],
        memoryPressure: 0.3
      });

      const health = connectionManager.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.connection).toBe(true);
      expect(health.queue).toBe(true);
      expect(health.eventProcessing).toBe(true);
      expect(health.warnings).toHaveLength(0);
      expect(health.errors).toHaveLength(0);
    });

    it('should report unhealthy when queue has issues', () => {
      mockBaseManager.getHealthStatus.mockReturnValue({
        isHealthy: true,
        checks: {
          connection: true,
          subscriptions: true,
          eventProcessing: true,
          performance: true
        },
        warnings: [],
        errors: []
      });

      mockEventQueue.getHealthStatus.mockReturnValue({
        isHealthy: false,
        warnings: ['Queue is near capacity', 'High memory usage'],
        memoryPressure: 0.9
      });

      const health = connectionManager.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.queue).toBe(false);
      expect(health.warnings).toContain('Queue is near capacity');
      expect(health.warnings).toContain('High memory usage');
    });

    it('should report unhealthy when event batcher has issues', () => {
      mockBaseManager.getHealthStatus.mockReturnValue({
        isHealthy: false,
        checks: {
          connection: true,
          subscriptions: true,
          eventProcessing: false, // Event processing issue
          performance: true
        },
        warnings: [],
        errors: []
      });

      mockEventQueue.getHealthStatus.mockReturnValue({
        isHealthy: true,
        warnings: [],
        memoryPressure: 0.3
      });

      const health = connectionManager.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.eventProcessing).toBe(false);
      expect(health.warnings).toContain('Event batcher is experiencing issues');
    });
  });

  describe('Connection Status', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should provide comprehensive connection status', () => {
      mockBaseManager.getConnectionStatus.mockReturnValue({
        state: 'connected',
        lastUpdate: new Date('2023-01-01T12:00:00Z'),
        lastEventReceived: new Date('2023-01-01T12:01:00Z'),
        subscriptions: 5,
        reconnectAttempts: 0,
        error: null,
        isHealthy: true
      });

      const mockQueue = {
        getMetrics: () => ({
          currentSize: 3,
          totalEnqueued: 10,
          totalDequeued: 7
        }),
        getHealthStatus: () => ({
          isHealthy: true,
          warnings: []
        }),
        subscribe: () => () => {},
        flush: () => [],
        clear: () => {},
        enqueue: () => true,
        destroy: () => {}
      };

      (connectionManager as any).eventQueue = mockQueue;

      const status = connectionManager.getConnectionStatus();

      expect(status.state).toBe('connected');
      expect(status.lastUpdate).toEqual(new Date('2023-01-01T12:00:00Z'));
      expect(status.lastEventReceived).toEqual(new Date('2023-01-01T12:01:00Z'));
      expect(status.subscriptions).toBe(5);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.error).toBeNull();
      expect(status.isHealthy).toBe(true);
      expect(status.queuedEvents).toBe(3);
    });

    it('should track connection state changes', () => {
      const mockStateHandler = jest.fn();
      const unsubscribe = connectionManager.onConnectionStateChange(mockStateHandler);

      // Simulate state change from base manager
      const mockSubscribe = mockBaseManager.subscribe.mock.calls.find(
        call => call[0] === 'state_change'
      );
      
      if (mockSubscribe) {
        const stateChangeHandler = mockSubscribe[1];
        stateChangeHandler({
          state: 'connected',
          lastUpdate: new Date(),
          reconnectAttempts: 0,
          error: null
        });
      }

      expect(mockStateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'connected',
          reconnectAttempts: 0
        })
      );

      unsubscribe();
    });
  });

  describe('Event Subscriptions', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should delegate subscriptions to base manager', () => {
      const mockHandler = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      mockBaseManager.subscribe.mockReturnValue(mockUnsubscribe);
      
      const unsubscribe = connectionManager.subscribe('test_event', mockHandler);
      
      expect(mockBaseManager.subscribe).toHaveBeenCalledWith('test_event', mockHandler);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('Resource Cleanup', () => {
    let mockEventQueue: any;

    beforeEach(() => {
      mockEventQueue = {
        destroy: jest.fn(),
        getHealthStatus: jest.fn(),
        getMetrics: jest.fn(),
        enqueue: jest.fn(),
        flush: jest.fn(),
        clear: jest.fn(),
        subscribe: jest.fn()
      };

      (EventQueue as jest.Mock).mockImplementation(() => mockEventQueue);
      connectionManager = new ConnectionManager(testUrl);
    });

    it('should cleanup resources on destroy', () => {
      connectionManager.destroy();

      expect(mockBaseManager.destroy).toHaveBeenCalled();
      expect(mockEventQueue.destroy).toHaveBeenCalled();
    });

    it('should not perform operations after destroy', async () => {
      connectionManager.destroy();

      // Operations after destroy should be ignored
      const success = connectionManager.queueEvent({
        id: 'test',
        session_id: 'session',
        event_type: 'test',
        timestamp: new Date().toISOString()
      });

      expect(success).toBe(false);
    });
  });

  describe('Global Instance Management', () => {
    it('should create singleton instance', () => {
      const instance1 = createConnectionManager(testUrl);
      const instance2 = createConnectionManager(testUrl);

      expect(instance1).toBe(instance2);
    });

    it('should reset global instance', () => {
      const instance1 = createConnectionManager(testUrl);
      resetEnhancedConnectionManager();
      const instance2 = createConnectionManager(testUrl);

      expect(instance1).not.toBe(instance2);
    });
  });
});