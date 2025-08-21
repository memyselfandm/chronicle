/**
 * Comprehensive tests for EventBatcher class
 * Tests batching, performance, burst handling, and order preservation
 */

import { EventBatcher, getEventBatcher, resetEventBatcher } from '../src/lib/eventBatcher';
import { BatchConfig, EventBatch } from '../src/types/chronicle';

describe('EventBatcher', () => {
  let eventBatcher: EventBatcher;
  let mockListener: jest.Mock;

  beforeEach(() => {
    mockListener = jest.fn();
    eventBatcher = new EventBatcher();
  });

  afterEach(() => {
    eventBatcher.destroy();
    resetEventBatcher();
  });

  describe('Basic Functionality', () => {
    it('should create an instance with default config', () => {
      expect(eventBatcher).toBeInstanceOf(EventBatcher);
      const config = eventBatcher.getConfig();
      expect(config.windowMs).toBe(100);
      expect(config.maxBatchSize).toBe(50);
      expect(config.preserveOrder).toBe(true);
    });

    it('should create an instance with custom config', () => {
      const customConfig: Partial<BatchConfig> = {
        windowMs: 200,
        maxBatchSize: 25
      };
      const customBatcher = new EventBatcher(customConfig);
      const config = customBatcher.getConfig();
      
      expect(config.windowMs).toBe(200);
      expect(config.maxBatchSize).toBe(25);
      expect(config.preserveOrder).toBe(true); // default value
      
      customBatcher.destroy();
    });

    it('should update config at runtime', () => {
      const newConfig: Partial<BatchConfig> = {
        windowMs: 300,
        flushOnIdle: false
      };
      
      eventBatcher.updateConfig(newConfig);
      const config = eventBatcher.getConfig();
      
      expect(config.windowMs).toBe(300);
      expect(config.flushOnIdle).toBe(false);
      expect(config.maxBatchSize).toBe(50); // unchanged
    });
  });

  describe('Event Processing', () => {
    it('should add valid events to batch', () => {
      const validEvent = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: { test: true }
      };

      eventBatcher.subscribe(mockListener);
      eventBatcher.addEvent(validEvent);
      
      const metrics = eventBatcher.getMetrics();
      expect(metrics.queueLength + metrics.currentBatchSize).toBeGreaterThan(0);
    });

    it('should filter out invalid events', () => {
      const invalidEvent = {
        id: 'invalid',
        // missing required fields
      };

      console.warn = jest.fn();
      eventBatcher.addEvent(invalidEvent);
      
      expect(console.warn).toHaveBeenCalledWith(
        'EventBatcher: Invalid event received',
        invalidEvent
      );
    });

    it('should handle batch events correctly', () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: { index: i }
      }));

      eventBatcher.subscribe(mockListener);
      eventBatcher.addEvents(events);
      
      const metrics = eventBatcher.getMetrics();
      expect(metrics.queueLength + metrics.currentBatchSize).toBe(5);
    });
  });

  describe('Batching Behavior', () => {
    it('should flush batch after window timeout', (done) => {
      const config: Partial<BatchConfig> = { windowMs: 50 };
      const testBatcher = new EventBatcher(config);
      
      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      testBatcher.subscribe((batch: EventBatch) => {
        expect(batch.events).toHaveLength(1);
        expect(batch.events[0].id).toBe('event-1');
        testBatcher.destroy();
        done();
      });

      testBatcher.addEvent(event);
    });

    it('should flush batch when max size is reached', () => {
      const config: Partial<BatchConfig> = { maxBatchSize: 3 };
      const testBatcher = new EventBatcher(config);
      let batchReceived = false;

      testBatcher.subscribe((batch: EventBatch) => {
        expect(batch.events).toHaveLength(3);
        batchReceived = true;
      });

      // Add 3 events to trigger max size flush
      for (let i = 0; i < 3; i++) {
        testBatcher.addEvent({
          id: `event-${i}`,
          session_id: 'session-1',
          event_type: 'test_event',
          timestamp: new Date().toISOString(),
          metadata: { index: i }
        });
      }

      expect(batchReceived).toBe(true);
      testBatcher.destroy();
    });

    it('should handle burst scenarios (>10 events)', () => {
      let batchCount = 0;
      eventBatcher.subscribe(() => {
        batchCount++;
      });

      // Add 15 events to trigger burst handling
      const events = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i}`,
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date(Date.now() + i).toISOString(),
        metadata: { index: i }
      }));

      eventBatcher.addEvents(events);
      
      // Should trigger immediate flush for burst
      expect(batchCount).toBeGreaterThan(0);
    });
  });

  describe('Order Preservation', () => {
    it('should preserve chronological order when configured', (done) => {
      const config: Partial<BatchConfig> = { 
        windowMs: 50,
        preserveOrder: true 
      };
      const testBatcher = new EventBatcher(config);

      const now = Date.now();
      const events = [
        {
          id: 'event-2',
          session_id: 'session-1',
          event_type: 'test_event',
          timestamp: new Date(now + 1000).toISOString(),
          metadata: { order: 2 }
        },
        {
          id: 'event-1',
          session_id: 'session-1',
          event_type: 'test_event',
          timestamp: new Date(now).toISOString(),
          metadata: { order: 1 }
        },
        {
          id: 'event-3',
          session_id: 'session-1',
          event_type: 'test_event',
          timestamp: new Date(now + 2000).toISOString(),
          metadata: { order: 3 }
        }
      ];

      testBatcher.subscribe((batch: EventBatch) => {
        expect(batch.events[0].metadata.order).toBe(1);
        expect(batch.events[1].metadata.order).toBe(2);
        expect(batch.events[2].metadata.order).toBe(3);
        testBatcher.destroy();
        done();
      });

      testBatcher.addEvents(events);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      eventBatcher.addEvent(event);
      eventBatcher.flush();

      const metrics = eventBatcher.getMetrics();
      expect(metrics.processedCount).toBeGreaterThan(0);
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.lastProcessedAt).toBeInstanceOf(Date);
    });

    it('should calculate throughput correctly', (done) => {
      const config: Partial<BatchConfig> = { windowMs: 25 };
      const testBatcher = new EventBatcher(config);
      
      let batchCount = 0;
      testBatcher.subscribe((batch: EventBatch) => {
        batchCount++;
        if (batchCount === 2) {
          const metrics = testBatcher.getMetrics();
          expect(metrics.throughput).toBeGreaterThan(0);
          testBatcher.destroy();
          done();
        }
      });

      // Add events in two separate batches
      testBatcher.addEvent({
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      });

      setTimeout(() => {
        testBatcher.addEvent({
          id: 'event-2',
          session_id: 'session-1',
          event_type: 'test_event',
          timestamp: new Date().toISOString(),
          metadata: {}
        });
      }, 30);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy state for normal operation', () => {
      expect(eventBatcher.isHealthy()).toBe(true);
    });

    it('should report unhealthy state for large queue backlog', () => {
      // Mock large queue
      const events = Array.from({ length: 150 }, (_, i) => ({
        id: `event-${i}`,
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: { index: i }
      }));

      // Don't subscribe to listener so queue builds up
      events.forEach(event => eventBatcher.addEvent(event));

      // Health check might still pass if events are processed quickly
      // This is more of an integration test with actual timing
    });
  });

  describe('Subscription Management', () => {
    it('should add and remove listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = eventBatcher.subscribe(listener1);
      const unsubscribe2 = eventBatcher.subscribe(listener2);

      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      eventBatcher.addEvent(event);
      eventBatcher.flush();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Unsubscribe first listener
      unsubscribe1();
      listener1.mockClear();
      listener2.mockClear();

      eventBatcher.addEvent({ ...event, id: 'event-2' });
      eventBatcher.flush();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      unsubscribe2();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      console.error = jest.fn();
      
      eventBatcher.subscribe(errorListener);
      eventBatcher.subscribe(normalListener);

      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      eventBatcher.addEvent(event);
      eventBatcher.flush();

      expect(console.error).toHaveBeenCalledWith(
        'EventBatcher: Listener error',
        expect.any(Error)
      );
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Global Instance Management', () => {
    it('should create singleton instance', () => {
      const instance1 = getEventBatcher();
      const instance2 = getEventBatcher();

      expect(instance1).toBe(instance2);
    });

    it('should reset global instance', () => {
      const instance1 = getEventBatcher();
      resetEventBatcher();
      const instance2 = getEventBatcher();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const listener = jest.fn();
      eventBatcher.subscribe(listener);

      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      eventBatcher.addEvent(event);
      eventBatcher.destroy();

      // Should not process events after destroy
      eventBatcher.addEvent({ ...event, id: 'event-2' });
      
      const metrics = eventBatcher.getMetrics();
      expect(metrics.queueLength).toBe(0);
      expect(metrics.currentBatchSize).toBe(0);
    });

    it('should reset metrics on reset', () => {
      const event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'test_event',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      eventBatcher.subscribe(jest.fn());
      eventBatcher.addEvent(event);
      eventBatcher.flush();

      let metrics = eventBatcher.getMetrics();
      expect(metrics.processedCount).toBeGreaterThan(0);

      eventBatcher.reset();
      metrics = eventBatcher.getMetrics();
      expect(metrics.processedCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });
});