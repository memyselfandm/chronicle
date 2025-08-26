/**
 * Comprehensive tests for ConnectionManager class
 * Tests WebSocket connections, reconnection logic, and health monitoring
 */

import { ConnectionManager, getConnectionManager, resetConnectionManager } from '../src/lib/connectionManager';
import { EventBatcher } from '../src/lib/eventBatcher';
import { ReconnectConfig } from '../src/types/chronicle';

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Simulate sending data
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  }

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code: number = 1006, reason: string = 'Connection lost') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockEventBatcher: EventBatcher;
  const testUrl = 'ws://localhost:8080/test';

  beforeEach(() => {
    mockEventBatcher = new EventBatcher();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (connectionManager) {
      connectionManager.destroy();
    }
    resetConnectionManager();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create connection manager with default config', () => {
      connectionManager = new ConnectionManager(testUrl);
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
      
      const state = connectionManager.getState();
      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempt).toBe(0);
    });

    it('should create connection manager with custom config', () => {
      const customConfig: Partial<ReconnectConfig> = {
        maxAttempts: 5,
        baseDelayMs: 2000
      };
      
      connectionManager = new ConnectionManager(testUrl, customConfig, mockEventBatcher);
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
    });

    it('should initialize WebSocket connection', async () => {
      connectionManager = new ConnectionManager(testUrl);
      
      // Advance timers to simulate connection
      jest.advanceTimersByTime(50);
      
      const state = connectionManager.getState();
      expect(state.isConnected).toBe(true);
      expect(state.lastConnectTime).toBeInstanceOf(Date);
    });
  });

  describe('Connection Events', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl, {}, mockEventBatcher);
    });

    it('should handle connection open', async () => {
      jest.advanceTimersByTime(50);
      
      const state = connectionManager.getState();
      expect(state.isConnected).toBe(true);
      expect(state.reconnectAttempt).toBe(0);
      expect(state.connectionQuality).toBe('good');
    });

    it('should handle incoming messages', async () => {
      jest.advanceTimersByTime(50);
      
      const mockHandler = jest.fn();
      connectionManager.subscribe('test_event', mockHandler);
      
      // Simulate receiving a message
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateMessage({
        type: 'test_event',
        data: { test: true }
      });
      
      expect(mockHandler).toHaveBeenCalledWith({
        type: 'test_event',
        data: { test: true }
      });
    });

    it('should handle heartbeat responses', async () => {
      jest.advanceTimersByTime(50);
      
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      
      // Simulate heartbeat response
      mockWebSocket.simulateMessage({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString()
      });
      
      const state = connectionManager.getState();
      expect(state.metrics.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should handle connection errors', async () => {
      jest.advanceTimersByTime(50);
      
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateError();
      
      const state = connectionManager.getState();
      expect(state.connectionQuality).toBe('poor');
    });

    it('should handle connection close and attempt reconnection', async () => {
      jest.advanceTimersByTime(50);
      
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateClose(1006); // Abnormal closure
      
      let state = connectionManager.getState();
      expect(state.isConnected).toBe(false);
      
      // Should schedule reconnection
      jest.advanceTimersByTime(1000);
      
      state = connectionManager.getState();
      expect(state.reconnectAttempt).toBe(1);
    });
  });

  describe('Reconnection Logic', () => {
    it('should implement exponential backoff', async () => {
      const config: Partial<ReconnectConfig> = {
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxAttempts: 3
      };
      
      connectionManager = new ConnectionManager(testUrl, config);
      jest.advanceTimersByTime(50);
      
      // Simulate multiple connection failures
      for (let attempt = 0; attempt < 3; attempt++) {
        const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
        mockWebSocket.simulateClose(1006);
        
        const expectedDelay = Math.min(
          config.baseDelayMs! * Math.pow(config.backoffFactor!, attempt),
          30000 // maxDelayMs default
        );
        
        jest.advanceTimersByTime(expectedDelay + 100); // Add buffer for jitter
        
        const state = connectionManager.getState();
        expect(state.reconnectAttempt).toBe(attempt + 1);
      }
    });

    it('should stop reconnecting after max attempts', async () => {
      const config: Partial<ReconnectConfig> = {
        maxAttempts: 2,
        baseDelayMs: 100
      };
      
      connectionManager = new ConnectionManager(testUrl, config);
      console.error = jest.fn();
      
      jest.advanceTimersByTime(50);
      
      // Trigger multiple failures
      for (let i = 0; i < 3; i++) {
        const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
        mockWebSocket.simulateClose(1006);
        jest.advanceTimersByTime(1000);
      }
      
      expect(console.error).toHaveBeenCalledWith(
        'ConnectionManager: Max reconnect attempts reached'
      );
    });

    it('should reestablish subscriptions after reconnection', async () => {
      connectionManager = new ConnectionManager(testUrl);
      jest.advanceTimersByTime(50);
      
      // Create some subscription health entries
      const state = connectionManager.getState();
      state.subscriptions.set('sub-1', {
        id: 'sub-1',
        type: 'session_events' as any,
        isActive: false,
        lastEventTime: null,
        errorCount: 5,
        latency: 100,
        missedHeartbeats: 2
      });
      
      // Simulate reconnection
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateClose(1006);
      jest.advanceTimersByTime(1100); // Wait for reconnection
      
      // Check that subscriptions were reset
      const newState = connectionManager.getState();
      const subscription = newState.subscriptions.get('sub-1');
      expect(subscription?.isActive).toBe(true);
      expect(subscription?.errorCount).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl);
      jest.advanceTimersByTime(50);
    });

    it('should perform health checks', () => {
      const health = connectionManager.getHealthStatus();
      
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('warnings');
      expect(health).toHaveProperty('errors');
    });

    it('should detect unhealthy subscriptions', () => {
      const state = connectionManager.getState();
      
      // Add unhealthy subscription
      state.subscriptions.set('unhealthy-sub', {
        id: 'unhealthy-sub',
        type: 'session_events' as any,
        isActive: true,
        lastEventTime: new Date(),
        errorCount: 10, // High error count
        latency: 100,
        missedHeartbeats: 5 // High missed heartbeats
      });
      
      const health = connectionManager.getHealthStatus();
      expect(health.isHealthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });

    it('should monitor heartbeat timing', async () => {
      // Mock old heartbeat
      (connectionManager as any).lastHeartbeatReceived = new Date(Date.now() - 70000); // 70 seconds ago
      
      const health = connectionManager.getHealthStatus();
      expect(health.warnings).toContain('No heartbeat received in over 1 minute');
    });

    it('should calculate connection quality based on latency', async () => {
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      
      // Simulate slow heartbeat response (high latency)
      (connectionManager as any).lastHeartbeatSent = new Date(Date.now() - 500);
      mockWebSocket.simulateMessage({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString()
      });
      
      const state = connectionManager.getState();
      expect(['poor', 'good']).toContain(state.connectionQuality);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl, {}, mockEventBatcher);
      jest.advanceTimersByTime(50);
    });

    it('should send messages when connected', () => {
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.send = jest.fn();
      
      const message = { type: 'test', data: 'hello' };
      const success = connectionManager.send(message);
      
      expect(success).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should queue messages when disconnected', () => {
      // Force disconnect
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateClose(1000);
      
      const message = { type: 'test', data: 'hello' };
      const success = connectionManager.send(message);
      
      expect(success).toBe(false);
      
      const state = connectionManager.getState();
      expect(state.pendingEvents).toContain(message);
    });

    it('should process queued events on reconnection', async () => {
      // Queue a message while disconnected
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateClose(1000);
      
      const message = { type: 'test', data: 'hello' };
      connectionManager.send(message);
      
      // Reconnect
      jest.advanceTimersByTime(1100);
      
      // Event should be processed through event batcher
      const batcherMetrics = mockEventBatcher.getMetrics();
      expect(batcherMetrics.queueLength + batcherMetrics.currentBatchSize).toBeGreaterThan(0);
    });
  });

  describe('Subscription Management', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager(testUrl);
      jest.advanceTimersByTime(50);
    });

    it('should subscribe to events', () => {
      const handler = jest.fn();
      const unsubscribe = connectionManager.subscribe('test_event', handler);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Simulate event
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateMessage({
        type: 'test_event',
        data: 'test'
      });
      
      expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe from events', () => {
      const handler = jest.fn();
      const unsubscribe = connectionManager.subscribe('test_event', handler);
      
      unsubscribe();
      
      // Simulate event after unsubscribe
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateMessage({
        type: 'test_event',
        data: 'test'
      });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle wildcard subscriptions', () => {
      const handler = jest.fn();
      connectionManager.subscribe('*', handler);
      
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.simulateMessage({
        type: 'any_event',
        data: 'test'
      });
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Global Instance Management', () => {
    it('should create singleton instance', () => {
      const instance1 = getConnectionManager(testUrl);
      const instance2 = getConnectionManager();
      
      expect(instance1).toBe(instance2);
    });

    it('should require URL for initial creation', () => {
      expect(() => getConnectionManager()).toThrow(
        'ConnectionManager: URL required for initial creation'
      );
    });

    it('should reset global instance', () => {
      const instance1 = getConnectionManager(testUrl);
      resetConnectionManager();
      const instance2 = getConnectionManager(testUrl);
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      connectionManager = new ConnectionManager(testUrl);
      jest.advanceTimersByTime(50);
      
      const mockWebSocket = (connectionManager as any).websocket as MockWebSocket;
      mockWebSocket.close = jest.fn();
      
      connectionManager.destroy();
      
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Connection manager destroyed');
    });

    it('should not attempt operations after destroy', () => {
      connectionManager = new ConnectionManager(testUrl);
      jest.advanceTimersByTime(50);
      
      connectionManager.destroy();
      
      // Should not throw or cause issues
      const success = connectionManager.send({ type: 'test' });
      expect(success).toBe(false);
      
      const health = connectionManager.getHealthStatus();
      expect(health.checks.connection).toBe(false);
    });
  });
});