/**
 * High-Frequency Event Processing Performance Tests
 * Agent-5 Specialized Performance Testing
 * 
 * Focus Areas:
 * - Burst event handling (200+ events/sec)
 * - Event batching performance under load
 * - Real-time update latency validation
 * - Memory efficiency during high-throughput scenarios
 */

import { 
  testEventBatching,
  createAdvancedPerformanceTests,
  PERFORMANCE_BENCHMARKS,
  validateTestResults
} from '@/test-utils/performanceHelpers';
import { createMockEvents } from '@/test-utils/mockData';
import { EventBatcher, getEventBatcher, resetEventBatcher } from '@/lib/eventBatcher';
import { processEvents } from '@/lib/eventProcessor';

describe('High-Frequency Event Processing Performance', () => {
  let eventBatcher: EventBatcher;

  beforeEach(() => {
    resetEventBatcher();
    eventBatcher = getEventBatcher({
      windowMs: 100,
      maxBatchSize: 50,
      preserveOrder: true
    });
  });

  afterEach(() => {
    resetEventBatcher();
  });

  describe('Burst Event Handling', () => {
    it('processes 500 events in <2 seconds with stable latency', async () => {
      const events = createMockEvents(500);
      const processedBatches: any[] = [];
      const batchLatencies: number[] = [];

      // Subscribe to batches and measure latency
      const unsubscribe = eventBatcher.subscribe((batch) => {
        const latency = batch.batchedAt.getTime() - batch.windowStart.getTime();
        batchLatencies.push(latency);
        processedBatches.push(batch);
      });

      const startTime = performance.now();

      // Send events in rapid succession (simulate burst)
      events.forEach((event, index) => {
        setTimeout(() => eventBatcher.addEvent(event), index * 4); // 250 events/sec
      });

      // Wait for all events to be processed
      await new Promise(resolve => {
        const checkCompletion = () => {
          const metrics = eventBatcher.getMetrics();
          if (metrics.processedCount >= events.length) {
            resolve(void 0);
          } else {
            setTimeout(checkCompletion, 50);
          }
        };
        checkCompletion();
      });

      eventBatcher.flush();
      const totalTime = performance.now() - startTime;
      unsubscribe();

      const averageLatency = batchLatencies.reduce((sum, lat) => sum + lat, 0) / batchLatencies.length;
      const maxLatency = Math.max(...batchLatencies);
      const throughput = (events.length / totalTime) * 1000; // events/sec

      console.log('Burst Event Processing:', {
        totalTime: `${totalTime.toFixed(2)}ms`,
        throughput: `${throughput.toFixed(0)} events/sec`,
        averageLatency: `${averageLatency.toFixed(2)}ms`,
        maxLatency: `${maxLatency.toFixed(2)}ms`,
        batchesProcessed: processedBatches.length
      });

      // Validate against benchmarks
      expect(totalTime).toBeLessThan(2000); // Should process 500 events in <2s
      expect(throughput).toBeGreaterThan(PERFORMANCE_BENCHMARKS.highFrequencyEvents.target);
      expect(averageLatency).toBeLessThan(PERFORMANCE_BENCHMARKS.eventProcessing.target);
      expect(maxLatency).toBeLessThan(200); // No single batch should take >200ms
    });

    it('maintains order preservation during high-frequency bursts', async () => {
      const eventCount = 200;
      const events = Array.from({ length: eventCount }, (_, i) => ({
        id: `ordered-event-${i}`,
        session_id: 'session-order-test',
        event_type: 'user_prompt_submit',
        timestamp: new Date(Date.now() + i * 100).toISOString(), // Sequential timestamps
        sequence: i, // For validation
        data: { message: `Event ${i}` }
      }));

      const processedEvents: any[] = [];

      const unsubscribe = eventBatcher.subscribe((batch) => {
        processedEvents.push(...batch.events);
      });

      // Send events rapidly but with intentional timestamp order
      const sendPromises = events.map((event, index) => 
        new Promise<void>(resolve => {
          setTimeout(() => {
            eventBatcher.addEvent(event);
            resolve();
          }, Math.random() * 50); // Random delays up to 50ms
        })
      );

      await Promise.all(sendPromises);
      eventBatcher.flush();
      unsubscribe();

      // Validate order preservation
      const sortedProcessedEvents = [...processedEvents].sort((a, b) => a.sequence - b.sequence);
      
      console.log(`Order Preservation Test: ${processedEvents.length} events processed`);
      
      expect(processedEvents.length).toBe(eventCount);
      
      // Check if events are in correct chronological order
      let orderViolations = 0;
      for (let i = 1; i < processedEvents.length; i++) {
        if (new Date(processedEvents[i].timestamp) < new Date(processedEvents[i-1].timestamp)) {
          orderViolations++;
        }
      }

      console.log(`Order violations: ${orderViolations} out of ${processedEvents.length} events`);
      expect(orderViolations).toBe(0); // Should maintain perfect order
    });

    it('handles memory pressure gracefully during sustained load', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping memory pressure test');
        return;
      }

      const memory = (performance as any).memory;
      const initialMemory = memory.usedJSHeapSize;
      const memorySnapshots: number[] = [];

      // Configure batcher for memory efficiency
      eventBatcher.updateConfig({
        windowMs: 50, // Shorter windows for faster flushing
        maxBatchSize: 25 // Smaller batches
      });

      // Generate sustained load for 10 seconds
      const duration = 10000; // 10 seconds
      const eventsPerSecond = 100;
      const totalEvents = (duration / 1000) * eventsPerSecond;
      
      let eventsSent = 0;
      let eventsProcessed = 0;

      const unsubscribe = eventBatcher.subscribe((batch) => {
        eventsProcessed += batch.size;
      });

      const startTime = Date.now();
      
      // Send events continuously
      const sendInterval = setInterval(() => {
        if (Date.now() - startTime >= duration) {
          clearInterval(sendInterval);
          return;
        }

        const event = createMockEvents(1, `session-${eventsSent % 10}`)[0];
        eventBatcher.addEvent(event);
        eventsSent++;

        // Take memory snapshot every 100 events
        if (eventsSent % 100 === 0) {
          const currentMemory = memory.usedJSHeapSize;
          memorySnapshots.push(currentMemory);
        }
      }, 1000 / eventsPerSecond); // Interval for desired events/sec

      // Wait for test duration plus processing time
      await new Promise(resolve => setTimeout(resolve, duration + 1000));
      
      eventBatcher.flush();
      unsubscribe();

      const finalMemory = memory.usedJSHeapSize;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      const maxMemoryMB = Math.max(...memorySnapshots) / 1024 / 1024;

      console.log('Sustained Load Memory Test:', {
        duration: `${duration/1000}s`,
        eventsSent,
        eventsProcessed,
        memoryGrowth: `${memoryGrowthMB.toFixed(2)}MB`,
        maxMemoryUsage: `${maxMemoryMB.toFixed(2)}MB`,
        finalThroughput: `${(eventsProcessed / (duration/1000)).toFixed(0)} events/sec`
      });

      expect(eventsSent).toBe(totalEvents);
      expect(eventsProcessed).toBe(eventsSent);
      expect(memoryGrowthMB).toBeLessThan(100); // Should not grow excessively
    });
  });

  describe('Event Batching Performance', () => {
    it('100ms window batching meets <100ms target latency', async () => {
      const batchFunction = async (events: any[]) => {
        // Simulate realistic batch processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5)); // 0-5ms processing
        return events.map(e => ({ ...e, processed: true }));
      };

      const batchingResults = await testEventBatching(batchFunction, 1000, 100);

      console.log('Batching Performance:', {
        totalTime: `${batchingResults.totalTime.toFixed(2)}ms`,
        averageBatchTime: `${batchingResults.averageBatchTime.toFixed(2)}ms`,
        eventsPerSecond: `${batchingResults.eventsPerSecond.toFixed(0)}`
      });

      const benchmark = PERFORMANCE_BENCHMARKS.eventProcessing;
      const validation = validateTestResults.performanceWithinThreshold(
        batchingResults.averageBatchTime,
        benchmark.target,
        benchmark.tolerance
      );

      expect(validation.passed).toBe(true);
      expect(batchingResults.eventsPerSecond).toBeGreaterThan(500); // Should be very fast
    });

    it('adaptive batch sizing optimizes for different load patterns', async () => {
      const loadPatterns = [
        { name: 'Low Load', eventsPerSec: 10, duration: 2000 },
        { name: 'Medium Load', eventsPerSec: 50, duration: 2000 },
        { name: 'High Load', eventsPerSec: 200, duration: 2000 },
        { name: 'Burst Load', eventsPerSec: 500, duration: 1000 }
      ];

      const results: any[] = [];

      for (const pattern of loadPatterns) {
        resetEventBatcher();
        const batcher = getEventBatcher({
          windowMs: 100,
          maxBatchSize: Math.min(50, Math.max(10, pattern.eventsPerSec / 4)) // Adaptive batch size
        });

        let processed = 0;
        const batchSizes: number[] = [];
        const processingTimes: number[] = [];

        const unsubscribe = batcher.subscribe((batch) => {
          const processingStart = performance.now();
          processed += batch.size;
          batchSizes.push(batch.size);
          
          // Simulate processing
          setTimeout(() => {
            const processingEnd = performance.now();
            processingTimes.push(processingEnd - processingStart);
          }, 1);
        });

        // Generate load pattern
        const events = createMockEvents(Math.floor(pattern.eventsPerSec * pattern.duration / 1000));
        const interval = 1000 / pattern.eventsPerSec;

        const startTime = performance.now();
        
        for (let i = 0; i < events.length; i++) {
          setTimeout(() => batcher.addEvent(events[i]), i * interval);
        }

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, pattern.duration + 500));
        batcher.flush();
        unsubscribe();

        const totalTime = performance.now() - startTime;
        const averageBatchSize = batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length;
        const averageProcessingTime = processingTimes.length > 0 
          ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
          : 0;

        results.push({
          pattern: pattern.name,
          targetThroughput: pattern.eventsPerSec,
          actualThroughput: (processed / totalTime) * 1000,
          averageBatchSize,
          averageProcessingTime,
          batchesCreated: batchSizes.length
        });
      }

      console.log('Adaptive Batch Sizing Results:');
      results.forEach(result => {
        console.log(`  ${result.pattern}: ${result.actualThroughput.toFixed(0)} events/sec, ` +
                   `avg batch: ${result.averageBatchSize.toFixed(1)}, ` +
                   `avg processing: ${result.averageProcessingTime.toFixed(2)}ms`);
      });

      // Validate that each load pattern was handled efficiently
      results.forEach(result => {
        expect(result.actualThroughput).toBeGreaterThan(result.targetThroughput * 0.8); // 80% efficiency minimum
        expect(result.averageProcessingTime).toBeLessThan(100); // <100ms processing time
      });
    });
  });

  describe('Real-time Update Latency', () => {
    it('end-to-end latency from event creation to UI update <100ms', async () => {
      const latencyMeasurements: number[] = [];
      const events = createMockEvents(100);

      // Simulate the full pipeline: event creation -> batching -> processing -> UI update
      const measureEndToEndLatency = async (event: any) => {
        const eventCreated = performance.now();
        
        return new Promise<number>((resolve) => {
          const unsubscribe = eventBatcher.subscribe((batch) => {
            if (batch.events.some(e => e.id === event.id)) {
              const uiUpdateSimulated = performance.now();
              
              // Simulate UI update time (React rendering)
              setTimeout(() => {
                const latency = performance.now() - eventCreated;
                resolve(latency);
                unsubscribe();
              }, Math.random() * 10); // 0-10ms UI update simulation
            }
          });

          eventBatcher.addEvent(event);
        });
      };

      // Measure latency for each event
      for (const event of events.slice(0, 20)) { // Test subset for reasonable test duration
        const latency = await measureEndToEndLatency(event);
        latencyMeasurements.push(latency);
        
        // Small delay between events to simulate realistic timing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const averageLatency = latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / latencyMeasurements.length;
      const maxLatency = Math.max(...latencyMeasurements);
      const p95Latency = latencyMeasurements.sort((a, b) => a - b)[Math.floor(latencyMeasurements.length * 0.95)];

      console.log('End-to-End Latency:', {
        average: `${averageLatency.toFixed(2)}ms`,
        max: `${maxLatency.toFixed(2)}ms`,
        p95: `${p95Latency.toFixed(2)}ms`,
        samples: latencyMeasurements.length
      });

      const benchmark = PERFORMANCE_BENCHMARKS.eventProcessing;
      const validation = validateTestResults.performanceWithinThreshold(
        averageLatency,
        benchmark.target,
        benchmark.tolerance
      );

      expect(validation.passed).toBe(true);
      expect(maxLatency).toBeLessThan(200); // Even worst case should be reasonable
      expect(p95Latency).toBeLessThan(150); // 95th percentile should be good
    });

    it('latency remains stable under varying network conditions', async () => {
      // Simulate varying network latencies
      const networkConditions = [
        { name: 'Fast', delay: 0 },
        { name: 'Normal', delay: 10 },
        { name: 'Slow', delay: 50 },
        { name: 'Poor', delay: 150 }
      ];

      const results: any[] = [];

      for (const condition of networkConditions) {
        const latencies: number[] = [];
        const events = createMockEvents(20);

        for (const event of events) {
          const startTime = performance.now();
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, condition.delay));
          
          // Process event through batcher
          eventBatcher.addEvent(event);
          eventBatcher.flush();
          
          const endTime = performance.now();
          latencies.push(endTime - startTime);
        }

        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        
        results.push({
          condition: condition.name,
          networkDelay: condition.delay,
          averageLatency: avgLatency,
          processingSpeeds: latencies
        });
      }

      console.log('Network Condition Impact:');
      results.forEach(result => {
        console.log(`  ${result.condition} (${result.networkDelay}ms): ${result.averageLatency.toFixed(2)}ms avg`);
      });

      // Validate that processing overhead is reasonable regardless of network conditions
      results.forEach(result => {
        const processingOverhead = result.averageLatency - result.networkDelay;
        expect(processingOverhead).toBeLessThan(50); // Processing should add <50ms regardless of network
      });
    });
  });

  describe('Stress Testing', () => {
    it('survives 10,000 events in rapid succession', async () => {
      const eventCount = 10000;
      const events = createMockEvents(eventCount);
      
      let processedCount = 0;
      const batchSizes: number[] = [];
      const errors: any[] = [];

      const unsubscribe = eventBatcher.subscribe((batch) => {
        try {
          processedCount += batch.size;
          batchSizes.push(batch.size);
        } catch (error) {
          errors.push(error);
        }
      });

      const startTime = performance.now();

      // Send all events as rapidly as possible
      events.forEach(event => eventBatcher.addEvent(event));
      eventBatcher.flush();

      // Wait for processing to complete
      await new Promise(resolve => {
        const checkCompletion = () => {
          if (processedCount >= eventCount || errors.length > 0) {
            resolve(void 0);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      const totalTime = performance.now() - startTime;
      const throughput = (processedCount / totalTime) * 1000;
      unsubscribe();

      console.log('Stress Test Results:', {
        eventsProcessed: processedCount,
        totalTime: `${totalTime.toFixed(2)}ms`,
        throughput: `${throughput.toFixed(0)} events/sec`,
        batchesCreated: batchSizes.length,
        averageBatchSize: batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length,
        errors: errors.length
      });

      expect(errors.length).toBe(0);
      expect(processedCount).toBe(eventCount);
      expect(throughput).toBeGreaterThan(1000); // Should process >1000 events/sec
    });

    it('recovers gracefully from processing errors', async () => {
      let processedCount = 0;
      let errorCount = 0;

      // Inject some failing events
      const events = Array.from({ length: 100 }, (_, i) => {
        if (i % 10 === 0) {
          // Every 10th event will cause processing error
          return { ...createMockEvents(1)[0], shouldFail: true };
        }
        return createMockEvents(1)[0];
      });

      const unsubscribe = eventBatcher.subscribe((batch) => {
        batch.events.forEach(event => {
          try {
            if ((event as any).shouldFail) {
              throw new Error('Simulated processing error');
            }
            processedCount++;
          } catch (error) {
            errorCount++;
            console.warn('Event processing error (expected):', error);
          }
        });
      });

      events.forEach(event => eventBatcher.addEvent(event));
      eventBatcher.flush();

      await new Promise(resolve => setTimeout(resolve, 500)); // Allow processing
      unsubscribe();

      console.log('Error Recovery Test:', {
        totalEvents: events.length,
        processedSuccessfully: processedCount,
        errorsEncountered: errorCount,
        successRate: `${(processedCount / events.length * 100).toFixed(1)}%`
      });

      expect(processedCount).toBe(90); // 90 successful events
      expect(errorCount).toBe(10); // 10 failed events
      expect(eventBatcher.isHealthy()).toBe(true); // System should remain healthy
    });
  });
});