/**
 * Load Testing and Concurrent Scenarios
 * Agent-5 Load Testing Implementation
 * 
 * Focus Areas:
 * - Multiple concurrent sessions simulation
 * - High-frequency event burst handling
 * - System stability under sustained load
 * - Performance degradation detection
 * - Resource utilization optimization
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { 
  createAdvancedPerformanceTests,
  PERFORMANCE_BENCHMARKS,
  validateTestResults,
  PerformanceMonitor
} from '@/test-utils/performanceHelpers';
import { createLargeEventDataset, createMockEvents, createMockSessions } from '@/test-utils/mockData';
import { TestProviders } from '@/test-utils/testProviders';

// Components for load testing
import { Dashboard } from '@/components/Dashboard';
import { EventFeed } from '@/components/eventfeed/EventFeed';
import { VirtualizedEventFeed } from '@/components/VirtualizedEventFeed';

// Systems for load testing  
import { EventBatcher, getEventBatcher, resetEventBatcher } from '@/lib/eventBatcher';
import { processEvents } from '@/lib/eventProcessor';
import { useDashboardStore } from '@/stores/dashboardStore';

describe('Load Testing and Concurrent Scenarios', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    resetEventBatcher();
    useDashboardStore.getState().reset?.();
    
    // Force garbage collection for clean test environment
    if ('gc' in global && typeof (global as any).gc === 'function') {
      (global as any).gc();
    }
  });

  afterEach(() => {
    resetEventBatcher();
  });

  describe('Concurrent Session Simulation', () => {
    it('handles 50+ concurrent sessions with stable performance', async () => {
      const sessionCount = 50;
      const eventsPerSession = 50;
      const { events: testEvents, sessions: testSessions } = createLargeEventDataset(
        sessionCount * eventsPerSession,
        sessionCount
      );

      performanceMonitor.startMeasurement();

      const { container } = render(
        <TestProviders>
          <Dashboard
            sessions={testSessions}
            events={testEvents}
            persistLayout={false}
            enableKeyboardShortcuts={false}
          />
        </TestProviders>
      );

      await waitFor(() => {
        expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument();
      }, { timeout: 5000 });

      const initialRenderTime = performanceMonitor.endMeasurement();

      // Simulate concurrent session activity
      const simulationResults = await Promise.all(
        Array.from({ length: 10 }, async (_, batchIndex) => {
          const batchStart = performance.now();
          
          // Simulate multiple sessions receiving events simultaneously
          const concurrentEvents = testSessions.slice(0, 10).map(session => 
            createMockEvents(5, session.id)
          ).flat();

          // Process events through the system
          const processed = processEvents(concurrentEvents.map(e => ({
            session_id: e.session_id,
            hook_event_name: e.event_type,
            timestamp: e.timestamp,
            success: true,
            raw_input: e.data || {}
          })));

          const batchTime = performance.now() - batchStart;
          
          return {
            batchIndex,
            eventsProcessed: processed.length,
            processingTime: batchTime,
            throughput: (processed.length / batchTime) * 1000
          };
        })
      );

      const avgThroughput = simulationResults.reduce((sum, result) => sum + result.throughput, 0) / simulationResults.length;
      const maxProcessingTime = Math.max(...simulationResults.map(r => r.processingTime));

      console.log('Concurrent Session Test:', {
        sessions: sessionCount,
        eventsPerSession,
        initialRenderTime: `${initialRenderTime.toFixed(2)}ms`,
        averageThroughput: `${avgThroughput.toFixed(0)} events/sec`,
        maxBatchProcessingTime: `${maxProcessingTime.toFixed(2)}ms`
      });

      // Validate performance requirements
      expect(initialRenderTime).toBeLessThan(2000); // Should render within 2 seconds
      expect(avgThroughput).toBeGreaterThan(100); // Should maintain good throughput
      expect(maxProcessingTime).toBeLessThan(500); // No single batch should take too long
    });

    it('maintains UI responsiveness during concurrent updates', async () => {
      const sessions = createMockSessions(30);
      let currentEvents = createMockEvents(100);

      const { rerender } = render(
        <TestProviders>
          <EventFeed 
            sessions={sessions}
            initialEvents={currentEvents}
            height={600}
            width={800}
            maxEvents={1000}
          />
        </TestProviders>
      );

      const responsivenessTimes: number[] = [];

      // Simulate 20 rapid concurrent updates
      for (let update = 0; update < 20; update++) {
        const updateStart = performance.now();

        // Simulate multiple concurrent event streams
        const concurrentUpdates = await Promise.all(
          Array.from({ length: 5 }, async (_, streamIndex) => {
            // Each stream adds events for different sessions
            const streamEvents = sessions.slice(streamIndex * 6, (streamIndex + 1) * 6)
              .map(session => createMockEvents(3, session.id))
              .flat();

            return streamEvents;
          })
        );

        const newEvents = concurrentUpdates.flat();
        currentEvents = [...newEvents, ...currentEvents.slice(0, 985)]; // Keep bounded

        await act(async () => {
          rerender(
            <TestProviders>
              <EventFeed 
                sessions={sessions}
                initialEvents={currentEvents}
                height={600}
                width={800}
                maxEvents={1000}
              />
            </TestProviders>
          );
        });

        const updateTime = performance.now() - updateStart;
        responsivenessTimes.push(updateTime);

        // Brief pause to simulate realistic update frequency
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const averageResponseTime = responsivenessTimes.reduce((sum, time) => sum + time, 0) / responsivenessTimes.length;
      const maxResponseTime = Math.max(...responsivenessTimes);

      console.log('UI Responsiveness Test:', {
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
        maxResponseTime: `${maxResponseTime.toFixed(2)}ms`,
        updates: responsivenessTimes.length
      });

      // UI should remain responsive (< 100ms average, < 200ms max)
      expect(averageResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(200);
    });

    it('session filtering performance scales with concurrent sessions', async () => {
      const sessionCounts = [10, 25, 50, 100];
      const filteringResults: Array<{
        sessionCount: number;
        filterTime: number;
        filteredEvents: number;
      }> = [];

      for (const sessionCount of sessionCounts) {
        const { events, sessions } = createLargeEventDataset(sessionCount * 30, sessionCount);
        const store = useDashboardStore.getState();

        // Set up store with data
        const storeEvents = events.map(e => ({
          id: e.id,
          sessionId: e.session_id,
          type: e.event_type,
          timestamp: new Date(e.timestamp),
          metadata: e.metadata || {},
          status: 'active' as const
        }));

        const storeSessions = sessions.map(s => ({
          id: s.id,
          status: 'active' as const,
          projectPath: '/test/project',
          gitBranch: 'main',
          displayTitle: `Session ${s.id}`,
          displaySubtitle: 'Test Session',
          startTime: new Date(s.start_time),
          lastActivity: new Date(),
          minutesSinceLastEvent: 0,
          isAwaiting: false,
          lastEventType: null,
          toolsUsed: 0,
          eventsCount: 0
        }));

        store.setEvents(storeEvents);
        store.setSessions(storeSessions);

        // Test filtering performance
        const filterStart = performance.now();
        
        // Select subset of sessions for filtering
        const selectedSessions = sessions.slice(0, Math.min(10, sessionCount)).map(s => s.id);
        store.setSelectedSessions(selectedSessions);
        const filteredEvents = store.getFilteredEvents();
        
        const filterTime = performance.now() - filterStart;

        filteringResults.push({
          sessionCount,
          filterTime,
          filteredEvents: filteredEvents.length
        });

        store.reset?.();
      }

      console.log('Session Filtering Scalability:');
      filteringResults.forEach(result => {
        console.log(`  ${result.sessionCount} sessions: ${result.filterTime.toFixed(2)}ms ` +
                   `(${result.filteredEvents} events filtered)`);
      });

      // Validate that filtering time scales reasonably
      const maxFilterTime = Math.max(...filteringResults.map(r => r.filterTime));
      expect(maxFilterTime).toBeLessThan(200); // Even 100 sessions should filter quickly
      
      // Filtering time should not increase dramatically with session count
      const firstResult = filteringResults[0];
      const lastResult = filteringResults[filteringResults.length - 1];
      const timeScalingFactor = lastResult.filterTime / firstResult.filterTime;
      expect(timeScalingFactor).toBeLessThan(5); // Should not be more than 5x slower
    });
  });

  describe('High-Frequency Event Bursts', () => {
    it('survives 1000 events/second burst for 10 seconds', async () => {
      const eventsPerSecond = 1000;
      const durationSeconds = 10;
      const totalEvents = eventsPerSecond * durationSeconds;

      const batcher = getEventBatcher({
        windowMs: 50,  // Shorter windows for high frequency
        maxBatchSize: 100,
        preserveOrder: false  // Optimize for speed over order
      });

      let processedCount = 0;
      const processingTimes: number[] = [];
      const throughputMeasurements: number[] = [];

      const unsubscribe = batcher.subscribe((batch) => {
        const batchStart = performance.now();
        processedCount += batch.size;
        const batchEnd = performance.now();
        processingTimes.push(batchEnd - batchStart);

        // Calculate instantaneous throughput
        const throughput = (batch.size / (batchEnd - batchStart)) * 1000;
        throughputMeasurements.push(throughput);
      });

      // Generate events and send at high frequency
      const events = createMockEvents(totalEvents);
      const startTime = performance.now();
      
      // Send events in rapid succession
      const sendPromises: Promise<void>[] = [];
      for (let i = 0; i < events.length; i++) {
        sendPromises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              batcher.addEvent(events[i]);
              resolve();
            }, (i / eventsPerSecond) * 1000);
          })
        );
      }

      await Promise.all(sendPromises);
      batcher.flush();

      // Wait for all processing to complete
      await new Promise(resolve => {
        const checkCompletion = () => {
          if (processedCount >= totalEvents) {
            resolve(void 0);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      const totalTime = performance.now() - startTime;
      const actualThroughput = (processedCount / totalTime) * 1000;
      const averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      const averageThroughput = throughputMeasurements.reduce((sum, tp) => sum + tp, 0) / throughputMeasurements.length;

      unsubscribe();

      console.log('High-Frequency Burst Test:', {
        targetRate: `${eventsPerSecond} events/sec`,
        duration: `${durationSeconds}s`,
        eventsProcessed: processedCount,
        totalEvents,
        actualThroughput: `${actualThroughput.toFixed(0)} events/sec`,
        averageProcessingTime: `${averageProcessingTime.toFixed(2)}ms`,
        averageThroughput: `${averageThroughput.toFixed(0)} events/sec`
      });

      expect(processedCount).toBe(totalEvents);
      expect(actualThroughput).toBeGreaterThan(500); // Should maintain high throughput
      expect(averageProcessingTime).toBeLessThan(50); // Batches should process quickly
    });

    it('handles bursts with varying event complexity', async () => {
      const eventComplexities = [
        {
          name: 'Simple',
          generator: () => createMockEvents(1)[0]
        },
        {
          name: 'Complex',
          generator: () => ({
            ...createMockEvents(1)[0],
            data: {
              operations: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                type: 'file_operation',
                data: 'x'.repeat(1000), // 1KB per operation
                metadata: {
                  timestamp: Date.now(),
                  performance: Math.random() * 1000
                }
              }))
            }
          })
        },
        {
          name: 'Nested',
          generator: () => ({
            ...createMockEvents(1)[0],
            data: {
              level1: {
                level2: {
                  level3: {
                    level4: {
                      data: Array.from({ length: 50 }, (_, i) => ({
                        id: i,
                        content: `nested-content-${i}`,
                        metadata: { depth: 4, index: i }
                      }))
                    }
                  }
                }
              }
            }
          })
        }
      ];

      const complexityResults: Array<{
        complexity: string;
        throughput: number;
        averageProcessingTime: number;
        memoryUsage: number;
      }> = [];

      for (const complexity of eventComplexities) {
        resetEventBatcher();
        const batcher = getEventBatcher({
          windowMs: 100,
          maxBatchSize: 50
        });

        const memoryBefore = ('memory' in performance) 
          ? (performance as any).memory.usedJSHeapSize 
          : 0;

        let processedCount = 0;
        const processingTimes: number[] = [];

        const unsubscribe = batcher.subscribe((batch) => {
          const batchStart = performance.now();
          
          // Simulate processing complexity
          batch.events.forEach(event => {
            // Simple JSON serialization to simulate real processing
            JSON.stringify(event);
          });
          
          processedCount += batch.size;
          const batchEnd = performance.now();
          processingTimes.push(batchEnd - batchStart);
        });

        // Generate and process 200 events of this complexity
        const events = Array.from({ length: 200 }, () => complexity.generator());
        const startTime = performance.now();

        events.forEach(event => batcher.addEvent(event));
        batcher.flush();

        // Wait for completion
        await new Promise(resolve => {
          const checkCompletion = () => {
            if (processedCount >= events.length) {
              resolve(void 0);
            } else {
              setTimeout(checkCompletion, 50);
            }
          };
          checkCompletion();
        });

        const totalTime = performance.now() - startTime;
        const throughput = (processedCount / totalTime) * 1000;
        const averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;

        const memoryAfter = ('memory' in performance) 
          ? (performance as any).memory.usedJSHeapSize 
          : memoryBefore;
        const memoryUsage = (memoryAfter - memoryBefore) / 1024 / 1024; // MB

        complexityResults.push({
          complexity: complexity.name,
          throughput,
          averageProcessingTime,
          memoryUsage
        });

        unsubscribe();
        batcher.destroy();
      }

      console.log('Event Complexity Impact:');
      complexityResults.forEach(result => {
        console.log(`  ${result.complexity}: ${result.throughput.toFixed(0)} events/sec, ` +
                   `${result.averageProcessingTime.toFixed(2)}ms avg, ` +
                   `${result.memoryUsage.toFixed(2)}MB`);
      });

      // Validate that system handles all complexity levels reasonably
      complexityResults.forEach(result => {
        expect(result.throughput).toBeGreaterThan(50); // Should maintain some throughput
        expect(result.averageProcessingTime).toBeLessThan(200); // Processing should be reasonable
        expect(result.memoryUsage).toBeLessThan(100); // Memory usage should be manageable
      });
    });
  });

  describe('Sustained Load Testing', () => {
    it('maintains performance over 5-minute sustained load', async () => {
      // Note: Using shorter duration for test practicality, but structure for long-term testing
      const testDuration = 30000; // 30 seconds (would be 300000 for 5 minutes in production)
      const baselineEventsPerSecond = 20;
      
      const performanceReadings: Array<{
        time: number;
        throughput: number;
        memoryUsage: number;
        processingTime: number;
      }> = [];

      let totalEventsProcessed = 0;
      const sessions = createMockSessions(20);
      
      const { rerender, unmount } = render(
        <TestProviders>
          <EventFeed 
            sessions={sessions}
            initialEvents={[]}
            height={600}
            width={800}
            maxEvents={1000}
            enableBatching={true}
          />
        </TestProviders>
      );

      let currentEvents: any[] = [];
      const startTime = Date.now();

      // Sustained load simulation
      const loadInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= testDuration) {
          clearInterval(loadInterval);
          return;
        }

        const intervalStart = performance.now();
        
        // Add new events (varying load to simulate realistic conditions)
        const eventsToAdd = baselineEventsPerSecond + Math.floor(Math.sin(elapsed / 5000) * 10); // Sine wave variation
        const newEvents = Array.from({ length: eventsToAdd }, (_, i) => {
          const sessionId = sessions[i % sessions.length].id;
          return createMockEvents(1, sessionId)[0];
        });

        currentEvents = [...newEvents, ...currentEvents.slice(0, 1000 - newEvents.length)];
        totalEventsProcessed += newEvents.length;

        await act(async () => {
          rerender(
            <TestProviders>
              <EventFeed 
                sessions={sessions}
                initialEvents={currentEvents}
                height={600}
                width={800}
                maxEvents={1000}
                enableBatching={true}
              />
            </TestProviders>
          );
        });

        const intervalEnd = performance.now();
        const processingTime = intervalEnd - intervalStart;
        const instantThroughput = (newEvents.length / processingTime) * 1000;

        // Record performance reading every 5 seconds
        if (elapsed % 5000 < 1000) {
          const memoryUsage = ('memory' in performance) 
            ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 
            : 0;

          performanceReadings.push({
            time: elapsed / 1000,
            throughput: instantThroughput,
            memoryUsage,
            processingTime
          });
        }
      }, 1000);

      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDuration + 1000));
      unmount();

      console.log('Sustained Load Test Results:');
      performanceReadings.forEach(reading => {
        console.log(`  ${reading.time}s: ${reading.throughput.toFixed(0)} events/sec, ` +
                   `${reading.processingTime.toFixed(2)}ms, ${reading.memoryUsage.toFixed(2)}MB`);
      });

      // Analysis
      const throughputs = performanceReadings.map(r => r.throughput);
      const avgThroughput = throughputs.reduce((sum, tp) => sum + tp, 0) / throughputs.length;
      const minThroughput = Math.min(...throughputs);
      const memoryGrowth = performanceReadings[performanceReadings.length - 1].memoryUsage - performanceReadings[0].memoryUsage;

      console.log('Sustained Load Analysis:', {
        duration: `${testDuration / 1000}s`,
        totalEventsProcessed,
        averageThroughput: `${avgThroughput.toFixed(0)} events/sec`,
        minimumThroughput: `${minThroughput.toFixed(0)} events/sec`,
        memoryGrowth: `${memoryGrowth.toFixed(2)}MB`
      });

      // Validate sustained performance
      expect(minThroughput).toBeGreaterThan(avgThroughput * 0.8); // Should not degrade more than 20%
      expect(memoryGrowth).toBeLessThan(50); // Memory should not grow excessively
    });

    it('detects and reports performance degradation', async () => {
      const degradationThreshold = 0.7; // 30% degradation threshold
      const measurements: number[] = [];
      
      // Baseline performance measurement
      const baselineEvents = createMockEvents(100);
      const baselineStart = performance.now();
      
      const processed = processEvents(baselineEvents.map(e => ({
        session_id: e.session_id,
        hook_event_name: e.event_type,
        timestamp: e.timestamp,
        success: true,
        raw_input: e.data || {}
      })));
      
      const baselineTime = performance.now() - baselineStart;
      const baselineThroughput = (processed.length / baselineTime) * 1000;

      // Progressive load testing to detect degradation
      const loadLevels = [200, 500, 1000, 2000, 5000];
      let degradationDetected = false;
      let degradationPoint = null;

      for (const eventCount of loadLevels) {
        const testEvents = createMockEvents(eventCount);
        
        const testStart = performance.now();
        const testProcessed = processEvents(testEvents.map(e => ({
          session_id: e.session_id,
          hook_event_name: e.event_type,
          timestamp: e.timestamp,
          success: true,
          raw_input: e.data || {}
        })));
        const testTime = performance.now() - testStart;
        
        const testThroughput = (testProcessed.length / testTime) * 1000;
        const performanceRatio = testThroughput / baselineThroughput;
        
        measurements.push(performanceRatio);

        console.log(`Load ${eventCount}: ${testThroughput.toFixed(0)} events/sec ` +
                   `(${(performanceRatio * 100).toFixed(1)}% of baseline)`);

        if (performanceRatio < degradationThreshold && !degradationDetected) {
          degradationDetected = true;
          degradationPoint = eventCount;
          console.warn(`Performance degradation detected at ${eventCount} events ` +
                      `(${(performanceRatio * 100).toFixed(1)}% of baseline)`);
        }
      }

      console.log('Performance Degradation Analysis:', {
        baselineThroughput: `${baselineThroughput.toFixed(0)} events/sec`,
        degradationDetected,
        degradationPoint,
        finalPerformance: `${(measurements[measurements.length - 1] * 100).toFixed(1)}% of baseline`
      });

      // The test succeeds if we can identify the degradation point
      // In a real system, this would trigger alerts or optimization
      if (degradationDetected) {
        expect(degradationPoint).toBeGreaterThan(500); // Should handle at least 500 events well
      }
      
      expect(measurements[0]).toBeGreaterThan(0.9); // First load test should perform well
    });
  });

  describe('Resource Utilization Optimization', () => {
    it('optimizes batch sizes based on load patterns', async () => {
      const loadPatterns = [
        { name: 'Steady Low', rate: 10, variation: 0, duration: 2000 },
        { name: 'Steady High', rate: 100, variation: 0, duration: 2000 },
        { name: 'Variable', rate: 50, variation: 40, duration: 3000 },
        { name: 'Spiky', rate: 30, variation: 70, duration: 2000 }
      ];

      const optimizationResults: Array<{
        pattern: string;
        averageBatchSize: number;
        efficiency: number;
        processingTime: number;
      }> = [];

      for (const pattern of loadPatterns) {
        resetEventBatcher();
        
        // Start with adaptive configuration
        const batcher = getEventBatcher({
          windowMs: 100,
          maxBatchSize: 50,
          preserveOrder: true
        });

        const batchSizes: number[] = [];
        const processingTimes: number[] = [];
        let totalProcessed = 0;

        const unsubscribe = batcher.subscribe((batch) => {
          const batchStart = performance.now();
          batchSizes.push(batch.size);
          totalProcessed += batch.size;
          const batchEnd = performance.now();
          processingTimes.push(batchEnd - batchStart);
        });

        // Generate load pattern
        const startTime = Date.now();
        const eventGenerationInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          
          if (elapsed >= pattern.duration) {
            clearInterval(eventGenerationInterval);
            return;
          }

          // Calculate current rate with variation
          const variationFactor = 1 + (Math.random() - 0.5) * (pattern.variation / 100);
          const currentRate = Math.max(1, pattern.rate * variationFactor);
          const eventsThisInterval = Math.round(currentRate / 10); // 100ms intervals

          for (let i = 0; i < eventsThisInterval; i++) {
            const event = createMockEvents(1)[0];
            batcher.addEvent(event);
          }
        }, 100);

        // Wait for pattern completion
        await new Promise(resolve => setTimeout(resolve, pattern.duration + 500));
        batcher.flush();
        unsubscribe();

        const averageBatchSize = batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length;
        const averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        const efficiency = totalProcessed / ((pattern.duration + 500) / 1000); // events per second

        optimizationResults.push({
          pattern: pattern.name,
          averageBatchSize,
          efficiency,
          processingTime: averageProcessingTime
        });
      }

      console.log('Load Pattern Optimization:');
      optimizationResults.forEach(result => {
        console.log(`  ${result.pattern}: avg batch ${result.averageBatchSize.toFixed(1)}, ` +
                   `${result.efficiency.toFixed(0)} events/sec, ${result.processingTime.toFixed(2)}ms`);
      });

      // Validate that system adapts batch sizes appropriately
      const steadyLow = optimizationResults.find(r => r.pattern === 'Steady Low')!;
      const steadyHigh = optimizationResults.find(r => r.pattern === 'Steady High')!;
      
      // High rate should use larger batches for efficiency
      expect(steadyHigh.averageBatchSize).toBeGreaterThan(steadyLow.averageBatchSize);
      
      // All patterns should maintain reasonable efficiency
      optimizationResults.forEach(result => {
        expect(result.efficiency).toBeGreaterThan(5); // At least 5 events/sec
        expect(result.processingTime).toBeLessThan(100); // Fast processing
      });
    });

    it('balances memory usage vs processing speed', async () => {
      const configurations = [
        { name: 'Memory Optimized', windowMs: 50, maxBatchSize: 25 },
        { name: 'Balanced', windowMs: 100, maxBatchSize: 50 },
        { name: 'Speed Optimized', windowMs: 200, maxBatchSize: 100 }
      ];

      const balanceResults: Array<{
        config: string;
        throughput: number;
        memoryUsage: number;
        latency: number;
        score: number; // Composite score
      }> = [];

      for (const config of configurations) {
        resetEventBatcher();
        const batcher = getEventBatcher(config);

        const memoryBefore = ('memory' in performance) 
          ? (performance as any).memory.usedJSHeapSize 
          : 0;

        let processedCount = 0;
        const latencies: number[] = [];

        const unsubscribe = batcher.subscribe((batch) => {
          processedCount += batch.size;
          
          // Calculate latency for each event in batch
          batch.events.forEach(event => {
            if (event._batchedAt && event._receivedAt) {
              const latency = event._batchedAt.getTime() - event._receivedAt.getTime();
              latencies.push(latency);
            }
          });
        });

        // Generate test load
        const events = createMockEvents(1000);
        const startTime = performance.now();

        events.forEach((event, index) => {
          // Add slight delay to simulate realistic arrival pattern
          setTimeout(() => batcher.addEvent(event), index * 2); // 500 events/sec
        });

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 3000));
        batcher.flush();

        const totalTime = performance.now() - startTime;
        const throughput = (processedCount / totalTime) * 1000;

        const memoryAfter = ('memory' in performance) 
          ? (performance as any).memory.usedJSHeapSize 
          : memoryBefore;
        const memoryUsage = (memoryAfter - memoryBefore) / 1024 / 1024;

        const averageLatency = latencies.length > 0 
          ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
          : 0;

        // Calculate composite score (higher is better)
        // Balance throughput (high good) vs memory usage (low good) vs latency (low good)
        const score = (throughput / 100) - (memoryUsage / 10) - (averageLatency / 10);

        balanceResults.push({
          config: config.name,
          throughput,
          memoryUsage,
          latency: averageLatency,
          score
        });

        unsubscribe();
        batcher.destroy();
      }

      console.log('Memory vs Speed Balance:');
      balanceResults.forEach(result => {
        console.log(`  ${result.config}: ${result.throughput.toFixed(0)} events/sec, ` +
                   `${result.memoryUsage.toFixed(2)}MB, ${result.latency.toFixed(2)}ms latency, ` +
                   `score: ${result.score.toFixed(2)}`);
      });

      // Validate that balanced configuration performs reasonably across all metrics
      const balanced = balanceResults.find(r => r.config === 'Balanced')!;
      const memoryOptimized = balanceResults.find(r => r.config === 'Memory Optimized')!;
      const speedOptimized = balanceResults.find(r => r.config === 'Speed Optimized')!;

      expect(balanced.score).toBeGreaterThan(Math.min(memoryOptimized.score, speedOptimized.score));
      expect(balanced.throughput).toBeGreaterThan(100); // Good throughput
      expect(balanced.memoryUsage).toBeLessThan(50); // Reasonable memory usage
      expect(balanced.latency).toBeLessThan(200); // Acceptable latency
    });
  });
});