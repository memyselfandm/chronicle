/**
 * Comprehensive tests for EventQueue class
 * Tests event queuing, persistence, retry logic, and health monitoring
 */

import { EventQueue, getEventQueue, resetEventQueue } from '../../src/lib/connection/EventQueue';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {};
  })
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('EventQueue', () => {
  let eventQueue: EventQueue;

  beforeEach(() => {
    jest.useFakeTimers();
    eventQueue = new EventQueue({
      maxQueueSize: 100,
      persistToStorage: false, // Disable persistence for most tests
      retryDelayMs: 1000,
      maxRetryAttempts: 3
    });
    mockLocalStorage.clear();
  });

  afterEach(() => {
    if (eventQueue) {
      eventQueue.destroy();
    }
    resetEventQueue();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Basic Queue Operations', () => {
    it('should enqueue events successfully', () => {
      const event = {
        id: 'test-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        data: { test: true }
      };

      const success = eventQueue.enqueue(event);
      expect(success).toBe(true);

      const metrics = eventQueue.getMetrics();
      expect(metrics.totalEnqueued).toBe(1);
      expect(metrics.currentSize).toBe(1);
    });

    it('should prevent duplicate events', () => {
      const event = {
        id: 'test-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString()
      };

      // First enqueue should succeed
      expect(eventQueue.enqueue(event)).toBe(true);
      
      // Second enqueue with same content should be rejected
      expect(eventQueue.enqueue(event)).toBe(false);

      const metrics = eventQueue.getMetrics();
      expect(metrics.totalEnqueued).toBe(1);
      expect(metrics.currentSize).toBe(1);
    });

    it('should dequeue events in priority order', () => {
      // Add events with different priorities
      const events = [
        { id: 'low-1', event_type: 'low', timestamp: new Date().toISOString(), priority: 'low' },
        { id: 'high-1', event_type: 'high', timestamp: new Date().toISOString(), priority: 'high' },
        { id: 'normal-1', event_type: 'normal', timestamp: new Date().toISOString(), priority: 'normal' }
      ];

      events.forEach((event, index) => {
        eventQueue.enqueue(event, event.priority as any);
      });

      const dequeuedEvents = eventQueue.dequeue(3);
      
      // Should get high priority first, then normal, then low
      expect(dequeuedEvents[0].priority).toBe('high');
      expect(dequeuedEvents[1].priority).toBe('normal');
      expect(dequeuedEvents[2].priority).toBe('low');
    });

    it('should flush all events from queue', () => {
      // Add multiple events
      for (let i = 0; i < 5; i++) {
        eventQueue.enqueue({
          id: `event-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      const flushedEvents = eventQueue.flush();
      
      expect(flushedEvents).toHaveLength(5);
      expect(eventQueue.isEmpty()).toBe(true);
      
      const metrics = eventQueue.getMetrics();
      expect(metrics.currentSize).toBe(0);
      expect(metrics.lastFlushTime).toBeInstanceOf(Date);
    });

    it('should peek at events without removing them', () => {
      // Add events
      for (let i = 0; i < 5; i++) {
        eventQueue.enqueue({
          id: `event-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      const peekedEvents = eventQueue.peek(3);
      
      expect(peekedEvents).toHaveLength(3);
      expect(eventQueue.getMetrics().currentSize).toBe(5); // Should not have removed events
    });
  });

  describe('Queue Size Management', () => {
    it('should evict oldest events when at capacity', () => {
      // Fill queue to capacity
      for (let i = 0; i < 100; i++) {
        eventQueue.enqueue({
          id: `event-${i}`,
          event_type: 'test',
          timestamp: new Date(Date.now() + i).toISOString()
        });
      }

      expect(eventQueue.getMetrics().currentSize).toBe(100);

      // Add one more event - should trigger eviction
      eventQueue.enqueue({
        id: 'newest-event',
        event_type: 'test',
        timestamp: new Date(Date.now() + 1000).toISOString()
      });

      // Should still be at capacity, with oldest events evicted
      expect(eventQueue.getMetrics().currentSize).toBeLessThanOrEqual(100);
      expect(eventQueue.isFull()).toBe(true);
    });

    it('should report when queue is full or empty', () => {
      expect(eventQueue.isEmpty()).toBe(true);
      expect(eventQueue.isFull()).toBe(false);

      // Fill to capacity
      for (let i = 0; i < 100; i++) {
        eventQueue.enqueue({
          id: `event-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      expect(eventQueue.isEmpty()).toBe(false);
      expect(eventQueue.isFull()).toBe(true);
    });
  });

  describe('Priority Handling', () => {
    it('should handle different priority levels', () => {
      const highPriority = eventQueue.enqueue({ id: 'high', event_type: 'urgent' }, 'high');
      const normalPriority = eventQueue.enqueue({ id: 'normal', event_type: 'normal' }, 'normal');
      const lowPriority = eventQueue.enqueue({ id: 'low', event_type: 'background' }, 'low');

      expect(highPriority).toBe(true);
      expect(normalPriority).toBe(true);
      expect(lowPriority).toBe(true);

      const highEvents = eventQueue.getEventsByPriority('high');
      const normalEvents = eventQueue.getEventsByPriority('normal');
      const lowEvents = eventQueue.getEventsByPriority('low');

      expect(highEvents).toHaveLength(1);
      expect(normalEvents).toHaveLength(1);
      expect(lowEvents).toHaveLength(1);
    });

    it('should sort by timestamp within same priority', () => {
      const now = Date.now();
      
      // Add events with same priority but different timestamps
      eventQueue.enqueue({ 
        id: 'second', 
        event_type: 'test',
        timestamp: new Date(now + 1000).toISOString()
      }, 'normal');
      
      eventQueue.enqueue({ 
        id: 'first', 
        event_type: 'test',
        timestamp: new Date(now).toISOString()
      }, 'normal');

      const dequeued = eventQueue.dequeue(2);
      
      // Should get oldest timestamp first
      expect(dequeued[0].event.id).toBe('first');
      expect(dequeued[1].event.id).toBe('second');
    });
  });

  describe('Retry Logic', () => {
    it('should mark events as failed and increment retry count', () => {
      const event = {
        id: 'retry-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      };

      eventQueue.enqueue(event);
      const queuedEvents = eventQueue.peek(1);
      const eventId = queuedEvents[0].id;

      // Mark event as failed
      eventQueue.markEventsFailed([eventId]);

      // Event should still be in queue with retry count incremented
      const retriedEvents = eventQueue.peek(1);
      expect(retriedEvents[0].retryCount).toBe(1);
    });

    it('should remove events after max retry attempts', () => {
      const event = {
        id: 'max-retry-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      };

      eventQueue.enqueue(event);
      const queuedEvents = eventQueue.peek(1);
      const eventId = queuedEvents[0].id;

      // Exceed max retry attempts
      for (let i = 0; i < 4; i++) {
        eventQueue.markEventsFailed([eventId]);
      }

      // Event should be removed from queue
      expect(eventQueue.isEmpty()).toBe(true);
      
      const metrics = eventQueue.getMetrics();
      expect(metrics.failedEvents).toBe(1);
    });

    it('should process retry events after delay', () => {
      const mockListener = jest.fn();
      eventQueue.subscribe(mockListener);

      const event = {
        id: 'retry-delay-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      };

      eventQueue.enqueue(event);
      const queuedEvents = eventQueue.peek(1);
      eventQueue.markEventsFailed([queuedEvents[0].id]);

      // Trigger retry processing
      eventQueue.retryFailedEvents();
      
      // Advance time past retry delay
      jest.advanceTimersByTime(2000);

      // Should have called listener for retry events
      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    beforeEach(() => {
      eventQueue.destroy();
      eventQueue = new EventQueue({
        persistToStorage: true,
        storageKey: 'test-queue'
      });
    });

    it('should persist events to localStorage', () => {
      const event = {
        id: 'persist-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      };

      eventQueue.enqueue(event);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-queue',
        expect.stringContaining('persist-test')
      );
    });

    it('should load events from localStorage on initialization', () => {
      // Manually set localStorage data
      const queueData = {
        events: [
          ['event-id-1', {
            id: 'event-id-1',
            event: { id: 'loaded-event', event_type: 'test' },
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3,
            priority: 'normal'
          }]
        ],
        timestamp: new Date().toISOString()
      };
      
      mockLocalStorage.store['test-queue'] = JSON.stringify(queueData);

      // Create new queue instance - should load from storage
      const newQueue = new EventQueue({
        persistToStorage: true,
        storageKey: 'test-queue'
      });

      expect(newQueue.getMetrics().currentSize).toBe(1);
      
      newQueue.destroy();
    });

    it('should clear storage when queue is destroyed', () => {
      eventQueue.enqueue({
        id: 'cleanup-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      });

      eventQueue.destroy();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-queue');
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status for normal operation', () => {
      // Add a few events
      for (let i = 0; i < 10; i++) {
        eventQueue.enqueue({
          id: `health-test-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      const health = eventQueue.getHealthStatus();
      
      expect(health.isHealthy).toBe(true);
      expect(health.warnings).toHaveLength(0);
      expect(health.memoryPressure).toBeLessThan(0.5);
    });

    it('should report warnings when queue is near capacity', () => {
      // Fill queue to 90% capacity
      for (let i = 0; i < 90; i++) {
        eventQueue.enqueue({
          id: `capacity-test-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      const health = eventQueue.getHealthStatus();
      
      expect(health.isHealthy).toBe(false);
      expect(health.warnings).toContain('Queue is near capacity');
    });

    it('should track memory usage', () => {
      const event = {
        id: 'memory-test',
        event_type: 'test',
        timestamp: new Date().toISOString(),
        data: { largeData: 'x'.repeat(1000) }
      };

      eventQueue.enqueue(event);

      const metrics = eventQueue.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify subscribers when events are added', () => {
      const mockListener = jest.fn();
      const unsubscribe = eventQueue.subscribe(mockListener);

      const event = {
        id: 'subscription-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      };

      eventQueue.enqueue(event);

      expect(mockListener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            event: expect.objectContaining({ id: 'subscription-test' })
          })
        ])
      );

      // Cleanup
      unsubscribe();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      console.error = jest.fn();
      
      eventQueue.subscribe(errorListener);
      
      // Should not throw
      eventQueue.enqueue({
        id: 'error-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('should support unsubscribing from events', () => {
      const mockListener = jest.fn();
      const unsubscribe = eventQueue.subscribe(mockListener);

      // Unsubscribe
      unsubscribe();

      // Add event after unsubscribing
      eventQueue.enqueue({
        id: 'unsubscribe-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      });

      expect(mockListener).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', () => {
      const newConfig = {
        maxQueueSize: 200,
        retryDelayMs: 2000
      };

      eventQueue.updateConfig(newConfig);

      const config = (eventQueue as any).config;
      expect(config.maxQueueSize).toBe(200);
      expect(config.retryDelayMs).toBe(2000);
    });

    it('should adjust queue size when configuration changes', () => {
      // Fill queue to current capacity
      for (let i = 0; i < 100; i++) {
        eventQueue.enqueue({
          id: `config-test-${i}`,
          event_type: 'test',
          timestamp: new Date().toISOString()
        });
      }

      // Reduce max queue size
      eventQueue.updateConfig({ maxQueueSize: 50 });

      // Queue should be automatically adjusted
      expect(eventQueue.getMetrics().currentSize).toBeLessThanOrEqual(50);
    });
  });

  describe('Global Instance Management', () => {
    it('should create and manage global instance', () => {
      const instance1 = getEventQueue();
      const instance2 = getEventQueue();

      expect(instance1).toBe(instance2);
    });

    it('should reset global instance', () => {
      const instance1 = getEventQueue();
      resetEventQueue();
      const instance2 = getEventQueue();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid events gracefully', () => {
      const invalidEvent = null;
      
      // Should not throw
      const success = eventQueue.enqueue(invalidEvent as any);
      expect(success).toBe(false);
      expect(eventQueue.getMetrics().currentSize).toBe(0);
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      console.warn = jest.fn();

      eventQueue = new EventQueue({
        persistToStorage: true,
        storageKey: 'error-test'
      });

      eventQueue.enqueue({
        id: 'storage-error-test',
        event_type: 'test',
        timestamp: new Date().toISOString()
      });

      expect(console.warn).toHaveBeenCalledWith(
        'EventQueue: Failed to persist to storage',
        expect.any(Error)
      );
    });

    it('should handle memory pressure gracefully', () => {
      // Mock heavy memory usage
      jest.spyOn(eventQueue as any, 'calculateMemoryUsage').mockReturnValue(1000000000); // 1GB

      const health = eventQueue.getHealthStatus();
      
      expect(health.isHealthy).toBe(false);
      expect(health.memoryPressure).toBeGreaterThan(0.8);
    });
  });
});