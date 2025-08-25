/**
 * Memory Optimization and Leak Detection Tests
 * Agent-5 Memory-Focused Performance Testing
 * 
 * Focus Areas:
 * - Memory leak detection during component lifecycles
 * - Memory usage patterns during extended operations
 * - Garbage collection efficiency validation
 * - Memory pressure handling and optimization
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { 
  detectMemoryLeaks,
  createAdvancedPerformanceTests,
  validateTestResults
} from '@/test-utils/performanceHelpers';
import { createLargeEventDataset, createMockEvents, createMockSessions } from '@/test-utils/mockData';
import { TestProviders } from '@/test-utils/testProviders';

// Components for memory testing
import { Dashboard } from '@/components/Dashboard';
import { EventFeed } from '@/components/eventfeed/EventFeed';
import { VirtualizedEventFeed } from '@/components/VirtualizedEventFeed';
import { EventTable } from '@/components/eventfeed/EventTable';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';

// Systems for memory testing
import { EventBatcher, getEventBatcher, resetEventBatcher } from '@/lib/eventBatcher';
import { useDashboardStore } from '@/stores/dashboardStore';

// Mock heavy dependencies for focused memory testing
jest.mock('@/hooks/useSupabaseConnection');
jest.mock('@/hooks/useEvents');
jest.mock('@/hooks/useSessions');

describe('Memory Optimization and Leak Detection', () => {
  // Helper to get current memory usage (if available)
  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  };

  // Helper to force garbage collection (if available)
  const forceGC = (): Promise<void> => {
    return new Promise(resolve => {
      if ('gc' in global && typeof (global as any).gc === 'function') {
        (global as any).gc();
      }
      setTimeout(resolve, 100); // Allow GC to complete
    });
  };

  beforeEach(async () => {
    resetEventBatcher();
    useDashboardStore.getState().reset?.();
    await forceGC();
  });

  afterEach(async () => {
    resetEventBatcher();
    await forceGC();
  });

  describe('Component Memory Leak Detection', () => {
    it('Dashboard component shows no memory leaks over 50 mount/unmount cycles', async () => {
      const { events, sessions } = createLargeEventDataset(100, 15);

      const leakResults = await createAdvancedPerformanceTests.mountUnmountCycle(
        (props: any) => (
          <TestProviders>
            <Dashboard {...props} />
          </TestProviders>
        ),
        { 
          sessions,
          events,
          persistLayout: false,
          enableKeyboardShortcuts: false
        },
        50 // 50 mount/unmount cycles
      );

      console.log('Dashboard Memory Leak Test:', {
        cycles: 50,
        averageMountTime: `${leakResults.averageMountTime.toFixed(2)}ms`,
        averageUnmountTime: `${leakResults.averageUnmountTime.toFixed(2)}ms`,
        finalMemoryUsage: `${leakResults.finalMemoryUsage.toFixed(2)}MB`,
        memoryLeak: leakResults.memoryLeak
      });

      expect(leakResults.memoryLeak).toBe(false);
      expect(leakResults.finalMemoryUsage).toBeLessThan(100); // Should not exceed 100MB
    });

    it('EventFeed memory usage stabilizes during extended operation', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping memory test');
        return;
      }

      const initialMemory = getMemoryUsage();
      const memorySnapshots: number[] = [];
      
      let events = createMockEvents(50);
      const sessions = createMockSessions(5);

      const { rerender, unmount } = render(
        <TestProviders>
          <EventFeed 
            sessions={sessions}
            initialEvents={events}
            height={600}
            width={800}
            maxEvents={200}
          />
        </TestProviders>
      );

      // Simulate 200 cycles of event updates with memory monitoring
      for (let cycle = 0; cycle < 200; cycle++) {
        // Add new events and remove old ones to maintain constant data size
        const newEvents = createMockEvents(5);
        events = [...newEvents, ...events.slice(0, 95)]; // Keep exactly 100 events

        await act(async () => {
          rerender(
            <TestProviders>
              <EventFeed 
                sessions={sessions}
                initialEvents={events}
                height={600}
                width={800}
                maxEvents={200}
              />
            </TestProviders>
          );
        });

        // Take memory snapshot every 20 cycles
        if (cycle % 20 === 0) {
          await forceGC();
          const currentMemory = getMemoryUsage();
          memorySnapshots.push(currentMemory - initialMemory);
        }

        // Small delay to simulate realistic update frequency
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      unmount();
      await forceGC();

      const finalMemoryIncrease = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowthMB = finalMemoryIncrease / 1024 / 1024;
      const maxMemoryIncreaseMB = Math.max(...memorySnapshots) / 1024 / 1024;

      console.log('EventFeed Memory Stability:', {
        cycles: 200,
        finalMemoryIncrease: `${memoryGrowthMB.toFixed(2)}MB`,
        maxMemoryIncrease: `${maxMemoryIncreaseMB.toFixed(2)}MB`,
        memorySnapshots: memorySnapshots.length
      });

      expect(memoryGrowthMB).toBeLessThan(50); // Should not grow significantly
      expect(maxMemoryIncreaseMB).toBeLessThan(75); // Peak usage should be reasonable
    });

    it('VirtualizedEventFeed maintains constant memory footprint regardless of dataset size', async () => {
      const dataSizes = [100, 500, 1000, 5000, 10000];
      const memoryResults: Array<{ size: number; memory: number; renderTime: number }> = [];

      for (const dataSize of dataSizes) {
        await forceGC();
        const memoryBefore = getMemoryUsage();
        
        const events = createMockEvents(dataSize);
        const renderStart = performance.now();

        const { unmount } = render(
          <TestProviders>
            <VirtualizedEventFeed
              events={events}
              height={600}
              itemHeight={80}
              enablePerformanceMonitoring={true}
            />
          </TestProviders>
        );

        const renderTime = performance.now() - renderStart;
        
        // Allow component to fully initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        await forceGC();
        
        const memoryAfter = getMemoryUsage();
        const memoryUsed = (memoryAfter - memoryBefore) / 1024 / 1024; // MB

        unmount();
        
        memoryResults.push({
          size: dataSize,
          memory: memoryUsed,
          renderTime
        });

        await forceGC();
      }

      console.log('VirtualizedEventFeed Memory Scaling:');
      memoryResults.forEach(result => {
        console.log(`  ${result.size.toLocaleString()} events: ${result.memory.toFixed(2)}MB, ${result.renderTime.toFixed(2)}ms`);
      });

      // Validate that memory usage doesn't scale linearly with data size (virtualization benefit)
      const memoryIncrease = memoryResults[memoryResults.length - 1].memory - memoryResults[0].memory;
      const dataIncrease = memoryResults[memoryResults.length - 1].size / memoryResults[0].size;
      
      console.log(`Memory scaling factor: ${(memoryIncrease / dataIncrease * 100).toFixed(1)}% (should be much less than 100%)`);
      
      // Memory should scale much less than linearly due to virtualization
      expect(memoryIncrease / dataIncrease).toBeLessThan(0.5); // Should be <50% scaling
      expect(memoryResults.every(result => result.renderTime < 500)).toBe(true); // All render times reasonable
    });

    it('EventBatcher cleans up resources properly', async () => {
      const memoryTest = async () => {
        const batcher = getEventBatcher({
          windowMs: 50,
          maxBatchSize: 100
        });

        // Generate and process large number of events
        const events = createMockEvents(2000);
        const processedBatches: any[] = [];

        const unsubscribe = batcher.subscribe((batch) => {
          processedBatches.push(batch);
        });

        // Process events in chunks
        for (let i = 0; i < events.length; i += 100) {
          const chunk = events.slice(i, i + 100);
          chunk.forEach(event => batcher.addEvent(event));
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        }

        batcher.flush();
        unsubscribe();

        // Verify processing completed
        const totalProcessed = processedBatches.reduce((sum, batch) => sum + batch.size, 0);
        expect(totalProcessed).toBe(events.length);

        // Clean up batcher resources
        batcher.destroy();
      };

      const leakDetection = await detectMemoryLeaks(memoryTest, 10);

      console.log('EventBatcher Memory Cleanup:', {
        initialMemory: `${leakDetection.initialMemory.toFixed(2)}MB`,
        finalMemory: `${leakDetection.finalMemory.toFixed(2)}MB`,
        maxMemory: `${leakDetection.maxMemory.toFixed(2)}MB`,
        leaked: leakDetection.leaked
      });

      expect(leakDetection.leaked).toBe(false);
      expect(leakDetection.maxMemory - leakDetection.initialMemory).toBeLessThan(100); // Reasonable peak usage
    });
  });

  describe('Memory Usage Patterns', () => {
    it('Store state management handles large datasets efficiently', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping store memory test');
        return;
      }

      const memoryBefore = getMemoryUsage();
      const store = useDashboardStore.getState();

      // Generate large datasets
      const { events: largeEventSet, sessions: largeSessionSet } = createLargeEventDataset(2000, 50);

      // Convert to store format and set
      const storeEvents = largeEventSet.map(e => ({
        id: e.id,
        sessionId: e.session_id,
        type: e.event_type,
        timestamp: new Date(e.timestamp),
        metadata: e.metadata || {},
        status: 'active' as const
      }));

      const storeSessions = largeSessionSet.map(s => ({
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

      const setStart = performance.now();
      store.setEvents(storeEvents);
      store.setSessions(storeSessions);
      const setTime = performance.now() - setStart;

      await forceGC();
      const memoryAfter = getMemoryUsage();
      const memoryUsedMB = (memoryAfter - memoryBefore) / 1024 / 1024;

      // Test filtering performance
      const filterStart = performance.now();
      store.setSelectedSessions([storeSessions[0].id, storeSessions[1].id]);
      const filteredEvents = store.getFilteredEvents();
      const filterTime = performance.now() - filterStart;

      console.log('Store Memory Management:', {
        eventsStored: storeEvents.length,
        sessionsStored: storeSessions.length,
        memoryUsed: `${memoryUsedMB.toFixed(2)}MB`,
        setTime: `${setTime.toFixed(2)}ms`,
        filterTime: `${filterTime.toFixed(2)}ms`,
        filteredEvents: filteredEvents.length
      });

      expect(memoryUsedMB).toBeLessThan(200); // Should be reasonable for large dataset
      expect(setTime).toBeLessThan(1000); // Setting large datasets should be fast
      expect(filterTime).toBeLessThan(100); // Filtering should be very fast

      // Clean up
      store.reset?.();
    });

    it('Memory usage during real-time updates remains bounded', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping real-time memory test');
        return;
      }

      const initialMemory = getMemoryUsage();
      const memoryReadings: Array<{ time: number; memory: number; events: number }> = [];
      
      let totalEvents = 0;
      const sessions = createMockSessions(10);

      const { rerender, unmount } = render(
        <TestProviders>
          <EventFeed 
            sessions={sessions}
            initialEvents={[]}
            height={600}
            width={800}
            maxEvents={500}
            enableBatching={true}
          />
        </TestProviders>
      );

      // Simulate 60 seconds of real-time updates at 10 events/second
      const duration = 10000; // 10 seconds for test speed
      const eventsPerSecond = 20;
      const intervalMs = 1000 / eventsPerSecond;
      
      let events: any[] = [];
      const startTime = Date.now();

      const updateInterval = setInterval(async () => {
        if (Date.now() - startTime >= duration) {
          clearInterval(updateInterval);
          return;
        }

        // Add new events (simulating real-time flow)
        const newEvents = createMockEvents(2);
        events = [...newEvents, ...events.slice(0, 498)]; // Keep bounded at ~500 events
        totalEvents += newEvents.length;

        await act(async () => {
          rerender(
            <TestProviders>
              <EventFeed 
                sessions={sessions}
                initialEvents={events}
                height={600}
                width={800}
                maxEvents={500}
                enableBatching={true}
              />
            </TestProviders>
          );
        });

        // Record memory usage every second
        if (totalEvents % 20 === 0) {
          await forceGC();
          const currentMemory = getMemoryUsage();
          memoryReadings.push({
            time: (Date.now() - startTime) / 1000,
            memory: (currentMemory - initialMemory) / 1024 / 1024,
            events: totalEvents
          });
        }
      }, intervalMs);

      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, duration + 1000));
      unmount();

      console.log('Real-time Memory Usage:');
      memoryReadings.forEach((reading, index) => {
        if (index % 3 === 0) { // Log every 3rd reading to avoid clutter
          console.log(`  ${reading.time.toFixed(1)}s: ${reading.memory.toFixed(2)}MB (${reading.events} events processed)`);
        }
      });

      // Analyze memory growth pattern
      const memoryGrowth = memoryReadings[memoryReadings.length - 1].memory - memoryReadings[0].memory;
      const maxMemoryUsage = Math.max(...memoryReadings.map(r => r.memory));

      expect(memoryGrowth).toBeLessThan(30); // Should not grow significantly over time
      expect(maxMemoryUsage).toBeLessThan(100); // Peak usage should be reasonable
    });
  });

  describe('Garbage Collection Efficiency', () => {
    it('Large object cleanup triggers efficient garbage collection', async () => {
      if (!('memory' in performance) || !('gc' in global)) {
        console.warn('GC testing not available in this environment, skipping');
        return;
      }

      const memoryBefore = getMemoryUsage();
      const largeObjects: any[] = [];

      // Create large objects that should be collected
      for (let i = 0; i < 100; i++) {
        const largeObject = {
          id: `large-object-${i}`,
          data: new Array(10000).fill(0).map((_, j) => ({
            index: j,
            content: `data-${i}-${j}`,
            metadata: {
              timestamp: Date.now(),
              random: Math.random(),
              nested: {
                level1: `value-${j}`,
                level2: new Array(100).fill(`item-${j}`)
              }
            }
          }))
        };
        largeObjects.push(largeObject);
      }

      const memoryAfterCreation = getMemoryUsage();
      const memoryUsedMB = (memoryAfterCreation - memoryBefore) / 1024 / 1024;

      console.log(`Memory after creating large objects: ${memoryUsedMB.toFixed(2)}MB`);

      // Clear references to objects
      largeObjects.length = 0;

      // Force garbage collection
      (global as any).gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      const memoryAfterGC = getMemoryUsage();
      const memoryRecoveredMB = (memoryAfterCreation - memoryAfterGC) / 1024 / 1024;
      const gcEfficiencyPercent = (memoryRecoveredMB / memoryUsedMB) * 100;

      console.log('Garbage Collection Test:', {
        memoryAllocated: `${memoryUsedMB.toFixed(2)}MB`,
        memoryRecovered: `${memoryRecoveredMB.toFixed(2)}MB`,
        gcEfficiency: `${gcEfficiencyPercent.toFixed(1)}%`
      });

      expect(gcEfficiencyPercent).toBeGreaterThan(70); // Should recover at least 70% of allocated memory
    });

    it('Component unmounting triggers proper cleanup', async () => {
      const componentCleanupTest = async () => {
        const { events, sessions } = createLargeEventDataset(500, 25);
        
        const { unmount } = render(
          <TestProviders>
            <Dashboard 
              sessions={sessions}
              events={events}
              persistLayout={false}
              enableKeyboardShortcuts={false}
            />
          </TestProviders>
        );

        // Allow component to fully initialize with data
        await new Promise(resolve => setTimeout(resolve, 200));

        // Unmount and trigger cleanup
        unmount();

        // Allow cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      };

      const leakDetection = await detectMemoryLeaks(componentCleanupTest, 15);

      console.log('Component Cleanup Test:', {
        iterations: 15,
        memoryLeak: leakDetection.leaked,
        initialMemory: `${leakDetection.initialMemory.toFixed(2)}MB`,
        finalMemory: `${leakDetection.finalMemory.toFixed(2)}MB`,
        maxMemory: `${leakDetection.maxMemory.toFixed(2)}MB`
      });

      expect(leakDetection.leaked).toBe(false);
      expect(leakDetection.maxMemory - leakDetection.initialMemory).toBeLessThan(150); // Reasonable peak usage
    });
  });

  describe('Memory Pressure Handling', () => {
    it('System gracefully handles memory pressure scenarios', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping memory pressure test');
        return;
      }

      // Simulate memory pressure by creating increasingly large datasets
      const pressureLevels = [
        { name: 'Low', events: 100, sessions: 10 },
        { name: 'Medium', events: 500, sessions: 25 },
        { name: 'High', events: 1000, sessions: 50 },
        { name: 'Extreme', events: 2000, sessions: 100 }
      ];

      const results: Array<{
        level: string;
        memoryUsed: number;
        renderTime: number;
        stable: boolean;
      }> = [];

      for (const pressure of pressureLevels) {
        await forceGC();
        const memoryBefore = getMemoryUsage();

        const { events, sessions } = createLargeEventDataset(pressure.events, pressure.sessions);
        
        const renderStart = performance.now();
        
        const { unmount } = render(
          <TestProviders>
            <Dashboard 
              sessions={sessions}
              events={events}
              persistLayout={false}
              enableKeyboardShortcuts={false}
            />
          </TestProviders>
        );

        const renderTime = performance.now() - renderStart;

        // Allow stabilization
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const memoryAfter = getMemoryUsage();
        const memoryUsed = (memoryAfter - memoryBefore) / 1024 / 1024;

        // Test if system remains stable under pressure
        let stable = true;
        try {
          // Try to perform additional operations
          const store = useDashboardStore.getState();
          store.setSelectedSessions(sessions.slice(0, 5).map(s => s.id));
          const filtered = store.getFilteredEvents();
          
          if (filtered.length < 0) { // This should never happen
            stable = false;
          }
        } catch (error) {
          stable = false;
          console.warn(`System instability at ${pressure.name} pressure:`, error);
        }

        unmount();
        await forceGC();

        results.push({
          level: pressure.name,
          memoryUsed,
          renderTime,
          stable
        });
      }

      console.log('Memory Pressure Test Results:');
      results.forEach(result => {
        console.log(`  ${result.level}: ${result.memoryUsed.toFixed(2)}MB, ` +
                   `${result.renderTime.toFixed(2)}ms, stable: ${result.stable}`);
      });

      // Validate that system remains stable even under extreme pressure
      expect(results.every(result => result.stable)).toBe(true);
      expect(results.every(result => result.renderTime < 2000)).toBe(true); // Should render in reasonable time
      expect(results[results.length - 1].memoryUsed).toBeLessThan(500); // Even extreme case should be manageable
    });

    it('Memory optimization recommendations work correctly', async () => {
      const batcher = getEventBatcher({
        windowMs: 100,
        maxBatchSize: 50
      });

      // Generate scenarios that should trigger different optimization recommendations
      const scenarios = [
        {
          name: 'Normal Load',
          eventCount: 100,
          expectedFlushImmediately: false,
          expectedReduceBatchSize: false
        },
        {
          name: 'High Queue Load',
          eventCount: 300,
          expectedFlushImmediately: true,
          expectedReduceBatchSize: false
        },
        {
          name: 'Memory Pressure',
          eventCount: 500,
          expectedFlushImmediately: true,
          expectedReduceBatchSize: true
        }
      ];

      for (const scenario of scenarios) {
        // Reset batcher for each scenario
        resetEventBatcher();
        const testBatcher = getEventBatcher({
          windowMs: 100,
          maxBatchSize: 50
        });

        // Generate load for scenario
        const events = createMockEvents(scenario.eventCount);
        events.forEach(event => testBatcher.addEvent(event));

        // Get optimization recommendations
        const recommendations = testBatcher.getMemoryOptimizationTips();

        console.log(`${scenario.name} Recommendations:`, {
          shouldFlushImmediately: recommendations.shouldFlushImmediately,
          shouldReduceBatchSize: recommendations.shouldReduceBatchSize,
          memoryPressure: `${(recommendations.memoryPressure * 100).toFixed(1)}%`
        });

        // Validate recommendations match expectations
        expect(recommendations.shouldFlushImmediately).toBe(scenario.expectedFlushImmediately);
        expect(recommendations.shouldReduceBatchSize).toBe(scenario.expectedReduceBatchSize);

        testBatcher.destroy();
      }
    });
  });
});