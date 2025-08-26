/**
 * Comprehensive Performance Testing Suite for Chronicle Dashboard
 * Agent-5 Performance Testing Implementation
 * 
 * Tests cover:
 * - Component render performance with large datasets
 * - Event processing benchmarks with high-frequency scenarios
 * - Memory leak detection and usage monitoring
 * - Virtual scrolling performance validation
 * - Load testing with concurrent sessions and burst events
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { 
  PERFORMANCE_BENCHMARKS,
  createAdvancedPerformanceTests,
  PerformanceMonitor,
  detectMemoryLeaks,
  testEventBatching,
  measureComponentRender,
  validateTestResults
} from '@/test-utils/performanceHelpers';
import { createLargeEventDataset, createMockEvents, createMockSessions } from '@/test-utils/mockData';
import { TestProviders } from '@/test-utils/testProviders';

// Components under test
import { Dashboard } from '@/components/Dashboard';
import { EventFeed } from '@/components/eventfeed/EventFeed';
import { VirtualizedEventFeed } from '@/components/VirtualizedEventFeed';
import { EventTable } from '@/components/eventfeed/EventTable';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import { Header } from '@/components/layout/Header';

// Core systems
import { EventBatcher, getEventBatcher, resetEventBatcher } from '@/lib/eventBatcher';
import { processEvents } from '@/lib/eventProcessor';
import { useDashboardStore } from '@/stores/dashboardStore';

// Mock heavy dependencies for focused performance testing
jest.mock('@/hooks/useSupabaseConnection', () => ({
  useSupabaseConnection: () => ({ 
    connectionStatus: 'Connected' as const,
    isConnected: true
  })
}));

jest.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({ 
    events: [],
    loading: false,
    error: null
  })
}));

jest.mock('@/hooks/useSessions', () => ({
  useSessions: () => ({ 
    sessions: [],
    loading: false,
    error: null
  })
}));

describe('Chronicle Dashboard - Comprehensive Performance Suite', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    resetEventBatcher();
    // Clear any existing store state
    useDashboardStore.getState().reset?.();
    
    // Force garbage collection if available
    if ('gc' in global && typeof (global as any).gc === 'function') {
      (global as any).gc();
    }
  });

  afterEach(() => {
    resetEventBatcher();
    jest.clearAllTimers();
  });

  describe('Component Render Performance Benchmarks', () => {
    it('Dashboard renders with 30+ sessions within performance targets', async () => {
      const { events, sessions } = createLargeEventDataset(300, 35);
      
      const renderMetrics = await measureComponentRender(
        Dashboard,
        { 
          sessions,
          events,
          persistLayout: false,
          enableKeyboardShortcuts: false
        },
        5 // Multiple renders for stable measurements
      );

      // Validate against benchmark
      const benchmark = PERFORMANCE_BENCHMARKS.initialRender;
      const validation = validateTestResults.performanceWithinThreshold(
        renderMetrics.averageRenderTime,
        benchmark.target,
        benchmark.tolerance
      );

      console.log(`Dashboard Render Performance: ${renderMetrics.averageRenderTime.toFixed(2)}ms avg, ${renderMetrics.maxRenderTime.toFixed(2)}ms max`);
      
      expect(validation.passed).toBe(true);
      expect(renderMetrics.averageRenderTime).toBeLessThan(benchmark.target * (1 + benchmark.tolerance / 100));
    });

    it('EventFeed handles 200+ events/min with stable performance', async () => {
      const events = createMockEvents(200);
      const sessions = createMockSessions(10);
      
      const renderMetrics = await measureComponentRender(
        (props: any) => (
          <TestProviders>
            <EventFeed {...props} />
          </TestProviders>
        ),
        { 
          sessions,
          initialEvents: events,
          height: 600,
          width: 800,
          maxEvents: 1000
        },
        10
      );

      const benchmark = PERFORMANCE_BENCHMARKS.sessionLoad;
      const validation = validateTestResults.performanceWithinThreshold(
        renderMetrics.averageRenderTime,
        benchmark.target,
        benchmark.tolerance
      );

      console.log(`EventFeed 200+ Events: ${renderMetrics.averageRenderTime.toFixed(2)}ms avg`);
      
      expect(validation.passed).toBe(true);
      expect(renderMetrics.maxRenderTime).toBeLessThan(500);
    });

    it('VirtualizedEventFeed maintains performance with 1000+ events', async () => {
      const events = createMockEvents(1000);
      
      const renderMetrics = await measureComponentRender(
        VirtualizedEventFeed,
        { 
          events,
          height: 600,
          itemHeight: 120,
          enablePerformanceMonitoring: true
        },
        5
      );

      console.log(`VirtualizedEventFeed 1000+ Events: ${renderMetrics.averageRenderTime.toFixed(2)}ms avg`);
      
      // Virtualization should maintain excellent performance even with large datasets
      expect(renderMetrics.averageRenderTime).toBeLessThan(100);
      expect(renderMetrics.maxRenderTime).toBeLessThan(200);
    });

    it('EventTable processes complex event data efficiently', async () => {
      // Generate events with complex nested data structures
      const complexEvents = Array.from({ length: 100 }, (_, i) => ({
        id: `complex-evt-${i}`,
        session_id: `session-${i % 10}`,
        event_type: 'tool_use',
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        data: {
          tool_name: 'file_processor',
          parameters: {
            files: Array.from({ length: 20 }, (_, j) => ({
              path: `/src/component-${j}.tsx`,
              size: Math.random() * 50000,
              content: 'x'.repeat(Math.floor(Math.random() * 1000))
            })),
            operations: Array.from({ length: 10 }, (_, k) => ({
              type: 'read',
              timestamp: Date.now(),
              metadata: { lineCount: Math.random() * 1000 }
            }))
          }
        },
        metadata: {
          performance: {
            renderTime: Math.random() * 100,
            memoryUsage: Math.random() * 1024 * 1024
          }
        }
      }));

      const renderMetrics = await measureComponentRender(
        (props: any) => (
          <TestProviders>
            <EventTable {...props} />
          </TestProviders>
        ),
        { events: complexEvents },
        5
      );

      console.log(`EventTable Complex Data: ${renderMetrics.averageRenderTime.toFixed(2)}ms avg`);
      
      expect(renderMetrics.averageRenderTime).toBeLessThan(300);
    });
  });

  describe('Event Processing Performance Benchmarks', () => {
    it('EventBatcher handles 200+ events/sec with <100ms latency', async () => {
      const batcher = getEventBatcher({
        windowMs: 100,
        maxBatchSize: 50,
        preserveOrder: true
      });

      const events = createMockEvents(1000);
      const processedBatches: any[] = [];

      // Subscribe to batch processing
      const unsubscribe = batcher.subscribe((batch) => {
        processedBatches.push(batch);
      });

      const processingMetrics = await createAdvancedPerformanceTests.realtimeDataProcessing(
        async (eventBatch: any[]) => {
          eventBatch.forEach(event => batcher.addEvent(event));
        },
        () => events.slice(0, 10), // 10 events per batch
        20, // 20 batches per second = 200 events/sec
        5   // 5 seconds duration
      );

      await new Promise(resolve => setTimeout(resolve, 200)); // Allow final processing
      batcher.flush();
      unsubscribe();

      const batcherMetrics = batcher.getMetrics();
      
      console.log('EventBatcher Performance:', {
        throughput: `${processingMetrics.throughput.toFixed(2)} batches/sec`,
        averageProcessingTime: `${processingMetrics.averageProcessingTime.toFixed(2)}ms`,
        batcherAvgProcessingTime: `${batcherMetrics.averageProcessingTime.toFixed(2)}ms`,
        droppedBatches: processingMetrics.droppedBatches
      });

      // Validate against benchmarks
      const benchmark = PERFORMANCE_BENCHMARKS.eventProcessing;
      const validation = validateTestResults.performanceWithinThreshold(
        batcherMetrics.averageProcessingTime,
        benchmark.target,
        benchmark.tolerance
      );

      expect(validation.passed).toBe(true);
      expect(processingMetrics.droppedBatches).toBe(0);
      expect(batcherMetrics.averageProcessingTime).toBeLessThan(100);
    });

    it('Event processing pipeline handles burst scenarios efficiently', async () => {
      // Simulate burst of 500 events arriving within 2 seconds
      const burstEvents = createMockEvents(500);
      
      const startTime = performance.now();
      
      const processedEvents = await new Promise<any[]>((resolve) => {
        const results: any[] = [];
        
        // Process events in batches to simulate realistic burst handling
        let eventIndex = 0;
        const processBatch = () => {
          const batchSize = Math.min(50, burstEvents.length - eventIndex);
          const batch = burstEvents.slice(eventIndex, eventIndex + batchSize);
          
          const processed = processEvents(batch.map(e => ({
            session_id: e.session_id,
            hook_event_name: e.event_type,
            timestamp: e.timestamp,
            success: true,
            raw_input: e.data
          })));
          
          results.push(...processed);
          eventIndex += batchSize;
          
          if (eventIndex < burstEvents.length) {
            // Small delay to simulate real-world timing
            setTimeout(processBatch, 10);
          } else {
            resolve(results);
          }
        };
        
        processBatch();
      });
      
      const processingTime = performance.now() - startTime;
      const eventsPerSecond = (processedEvents.length / processingTime) * 1000;

      console.log(`Burst Processing: ${processingTime.toFixed(2)}ms total, ${eventsPerSecond.toFixed(0)} events/sec`);

      const benchmark = PERFORMANCE_BENCHMARKS.highFrequencyEvents;
      const throughputValidation = validateTestResults.throughputSufficient(
        eventsPerSecond,
        benchmark.target,
        'events/sec'
      );

      expect(throughputValidation.passed).toBe(true);
      expect(processedEvents.length).toBe(burstEvents.length);
    });

    it('Session status calculation performs efficiently at scale', async () => {
      const sessions = createMockSessions(50);
      const allEvents = sessions.flatMap(session => 
        createMockEvents(Math.floor(Math.random() * 100) + 20, session.session_id)
      );

      performanceMonitor.startMeasurement();
      
      // Simulate session status calculations based on events
      const sessionStatuses = sessions.map(session => {
        const sessionEvents = allEvents.filter(e => e.session_id === session.session_id);
        const lastEvent = sessionEvents[sessionEvents.length - 1];
        const minutesSinceLastEvent = lastEvent 
          ? (Date.now() - new Date(lastEvent.timestamp).getTime()) / (1000 * 60)
          : Infinity;

        let status: 'active' | 'idle' | 'completed' | 'error' = 'active';
        
        if (session.status === 'completed') {
          status = 'completed';
        } else if (minutesSinceLastEvent > 30) {
          status = 'idle';
        } else if (sessionEvents.some(e => e.event_type === 'error')) {
          status = 'error';
        }

        return { ...session, status };
      });

      const calculationTime = performanceMonitor.endMeasurement();
      
      console.log(`Session Status Calculation: ${calculationTime.toFixed(2)}ms for ${sessions.length} sessions`);
      
      expect(calculationTime).toBeLessThan(50); // Should be very fast
      expect(sessionStatuses.length).toBe(sessions.length);
    });
  });

  describe('Memory Usage and Leak Detection', () => {
    it('Dashboard mount/unmount cycle shows no memory leaks', async () => {
      const { events, sessions } = createLargeEventDataset(200, 20);

      const leakResults = await createAdvancedPerformanceTests.mountUnmountCycle(
        (props: any) => (
          <TestProviders>
            <Dashboard {...props} />
          </TestProviders>
        ),
        { 
          sessions,
          events,
          persistLayout: false 
        },
        25 // 25 mount/unmount cycles
      );

      console.log('Dashboard Mount/Unmount Memory Test:', {
        averageMountTime: `${leakResults.averageMountTime.toFixed(2)}ms`,
        averageUnmountTime: `${leakResults.averageUnmountTime.toFixed(2)}ms`,
        finalMemoryUsage: `${leakResults.finalMemoryUsage.toFixed(2)}MB`,
        memoryLeak: leakResults.memoryLeak
      });

      // Validate memory usage
      const memoryValidation = validateTestResults.memoryUsageAcceptable(
        leakResults.finalMemoryUsage,
        PERFORMANCE_BENCHMARKS.memoryUsage.target
      );

      expect(memoryValidation.passed).toBe(true);
      expect(leakResults.memoryLeak).toBe(false);
      expect(leakResults.averageMountTime).toBeLessThan(200);
    });

    it('EventFeed memory usage remains stable during extended operation', async () => {
      if (!('memory' in performance)) {
        console.warn('Memory measurement not available, skipping memory stability test');
        return;
      }

      const initialEvents = createMockEvents(50);
      let events = [...initialEvents];

      const { rerender, unmount } = render(
        <TestProviders>
          <EventFeed 
            sessions={createMockSessions(10)}
            initialEvents={events}
            height={600}
            width={800}
            maxEvents={1000}
          />
        </TestProviders>
      );

      const memorySnapshots: number[] = [];
      const memory = (performance as any).memory;
      const initialMemory = memory.usedJSHeapSize;

      // Simulate 100 iterations of adding new events and removing old ones
      for (let i = 0; i < 100; i++) {
        // Add 5 new events, remove 5 old ones (stable memory footprint)
        const newEvents = createMockEvents(5);
        events = [...newEvents, ...events.slice(0, 95)]; // Keep last 100 events
        
        await act(async () => {
          rerender(
            <TestProviders>
              <EventFeed 
                sessions={createMockSessions(10)}
                initialEvents={events}
                height={600}
                width={800}
                maxEvents={1000}
              />
            </TestProviders>
          );
        });

        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          const currentMemory = memory.usedJSHeapSize;
          memorySnapshots.push(currentMemory - initialMemory);
          
          // Force GC to get cleaner measurements
          if ('gc' in global && typeof (global as any).gc === 'function') {
            (global as any).gc();
          }
        }
      }

      unmount();

      const finalMemoryIncrease = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowthMB = finalMemoryIncrease / 1024 / 1024;

      console.log(`EventFeed Memory Stability: ${memoryGrowthMB.toFixed(2)}MB increase over 100 iterations`);

      expect(memoryGrowthMB).toBeLessThan(25); // Should not grow significantly
    });

    it('EventBatcher memory usage scales appropriately with load', async () => {
      const batcher = getEventBatcher({
        windowMs: 50,
        maxBatchSize: 100
      });

      const memoryTest = async () => {
        // Generate and process 1000 events
        const events = createMockEvents(1000);
        
        events.forEach(event => batcher.addEvent(event));
        batcher.flush();

        // Wait for processing to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      };

      const leakDetection = await detectMemoryLeaks(memoryTest, 10);

      console.log('EventBatcher Memory Test:', {
        initialMemory: `${leakDetection.initialMemory.toFixed(2)}MB`,
        finalMemory: `${leakDetection.finalMemory.toFixed(2)}MB`,
        maxMemory: `${leakDetection.maxMemory.toFixed(2)}MB`,
        leaked: leakDetection.leaked
      });

      expect(leakDetection.leaked).toBe(false);
      expect(leakDetection.maxMemory - leakDetection.initialMemory).toBeLessThan(50); // Max 50MB increase
    });
  });

  describe('Virtual Scrolling Performance Validation', () => {
    it('Virtual scrolling handles 10,000+ items efficiently', async () => {
      const virtualizationResults = await createAdvancedPerformanceTests.virtualizationStressTest(
        10000, // 10k items
        50,    // 50 visible items
        20     // 20 scroll cycles
      );

      console.log('Virtualization Stress Test:', {
        initialRenderTime: `${virtualizationResults.initialRenderTime.toFixed(2)}ms`,
        avgScrollTime: `${virtualizationResults.scrollPerformance.reduce((a, b) => a + b, 0) / virtualizationResults.scrollPerformance.length}ms`,
        memoryEfficiency: `${virtualizationResults.memoryEfficiency.toFixed(1)}%`,
        avgFrameRate: `${virtualizationResults.avgFrameRate.toFixed(1)}fps`
      });

      expect(virtualizationResults.initialRenderTime).toBeLessThan(500);
      expect(virtualizationResults.memoryEfficiency).toBeGreaterThan(50);
      expect(virtualizationResults.avgFrameRate).toBeGreaterThan(30);
    });

    it('Virtual scrolling scroll performance meets 60fps target', async () => {
      const events = createMockEvents(5000);

      const { container } = render(
        <TestProviders>
          <VirtualizedEventFeed
            events={events}
            height={600}
            itemHeight={80}
            showScrollIndicator={true}
          />
        </TestProviders>
      );

      // Simulate multiple scroll operations and measure frame rate
      const scrollTimes: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        
        // Simulate scroll event
        const scrollContainer = container.querySelector('[data-testid="virtual-list"]') as HTMLElement;
        if (scrollContainer) {
          Object.defineProperty(scrollContainer, 'scrollTop', {
            value: i * 100,
            writable: true
          });
          scrollContainer.dispatchEvent(new Event('scroll'));
        }
        
        await new Promise(resolve => setTimeout(resolve, 16)); // Wait one frame
        const endTime = performance.now();
        scrollTimes.push(endTime - startTime);
      }

      const averageScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      const targetFrameTime = 1000 / 60; // 16.67ms for 60fps

      console.log(`Virtual Scroll Performance: ${averageScrollTime.toFixed(2)}ms avg (target: <${targetFrameTime.toFixed(2)}ms)`);

      expect(averageScrollTime).toBeLessThan(targetFrameTime * 1.5); // Allow some tolerance
    });
  });

  describe('Load Testing Scenarios', () => {
    it('System handles 30+ concurrent sessions with 200+ events/min', async () => {
      const { events: testEvents, sessions: testSessions } = createLargeEventDataset(1000, 35);
      
      performanceMonitor.startMeasurement();
      
      // Render the full dashboard with realistic load
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

      // Wait for initial render to complete
      await waitFor(() => {
        expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument();
      });

      const initialRenderTime = performanceMonitor.endMeasurement();

      // Simulate real-time event updates
      const updateTimes: number[] = [];
      let currentEvents = [...testEvents];

      for (let i = 0; i < 20; i++) {
        const updateStart = performance.now();
        
        // Add new events (simulating real-time updates)
        const newEvents = createMockEvents(10);
        currentEvents = [...newEvents, ...currentEvents.slice(0, 990)]; // Keep total at ~1000

        // Use act to ensure React updates are processed
        await act(async () => {
          // Trigger re-render through store update
          const store = useDashboardStore.getState();
          store.setEvents?.(currentEvents.map(e => ({
            id: e.id,
            sessionId: e.session_id,
            type: e.event_type,
            timestamp: new Date(e.timestamp),
            metadata: e.metadata || {},
            status: 'active' as const
          })));
        });

        const updateEnd = performance.now();
        updateTimes.push(updateEnd - updateStart);

        // Small delay to simulate real-time frequency
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;

      console.log('High Load Performance Test:', {
        sessions: testSessions.length,
        events: testEvents.length,
        initialRenderTime: `${initialRenderTime.toFixed(2)}ms`,
        averageUpdateTime: `${averageUpdateTime.toFixed(2)}ms`,
        maxUpdateTime: `${Math.max(...updateTimes).toFixed(2)}ms`
      });

      // Validate performance under load
      const benchmark = PERFORMANCE_BENCHMARKS.sessionLoad;
      const validation = validateTestResults.performanceWithinThreshold(
        initialRenderTime,
        benchmark.target,
        benchmark.tolerance
      );

      expect(validation.passed).toBe(true);
      expect(averageUpdateTime).toBeLessThan(100); // Real-time updates should be snappy
    });

    it('CPU usage profiling during intensive operations', async () => {
      // This test measures CPU-intensive operations
      const iterations = 1000;
      const complexEvents = Array.from({ length: iterations }, (_, i) => ({
        id: `cpu-test-${i}`,
        session_id: `session-${i % 20}`,
        event_type: 'tool_use',
        timestamp: new Date().toISOString(),
        data: {
          // Complex nested data to stress JSON processing
          operations: Array.from({ length: 50 }, (_, j) => ({
            id: j,
            data: 'x'.repeat(1000), // 1KB per operation
            metadata: {
              timestamp: Date.now(),
              performance: Math.random() * 1000
            }
          }))
        }
      }));

      const processingTimes: number[] = [];
      let totalCPUTime = 0;

      for (let batch = 0; batch < 10; batch++) {
        const batchEvents = complexEvents.slice(batch * 100, (batch + 1) * 100);
        
        const cpuStart = process.cpuUsage?.() || { user: 0, system: 0 };
        const wallStart = performance.now();
        
        // CPU-intensive processing simulation
        const processed = batchEvents.map(event => ({
          ...event,
          processed: true,
          hash: JSON.stringify(event).length, // Simple hash simulation
          normalized: JSON.stringify(event).toLowerCase().slice(0, 100)
        }));

        const wallEnd = performance.now();
        const cpuEnd = process.cpuUsage?.(cpuStart) || { user: 0, system: 0 };
        
        const wallTime = wallEnd - wallStart;
        const cpuTime = cpuEnd ? (cpuEnd.user + cpuEnd.system) / 1000 : wallTime; // Convert to ms

        processingTimes.push(wallTime);
        totalCPUTime += cpuTime;

        expect(processed.length).toBe(batchEvents.length);
      }

      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const averageCPUTime = totalCPUTime / processingTimes.length;

      console.log('CPU Usage Profiling:', {
        averageWallTime: `${averageProcessingTime.toFixed(2)}ms`,
        averageCPUTime: `${averageCPUTime.toFixed(2)}ms`,
        efficiency: `${((averageCPUTime / averageProcessingTime) * 100).toFixed(1)}%`,
        eventsPerSecond: `${(100 * 1000 / averageProcessingTime).toFixed(0)}`
      });

      expect(averageProcessingTime).toBeLessThan(100); // Should process 100 complex events in <100ms
    });
  });

  describe('Performance Regression Detection', () => {
    it('Establishes baseline performance metrics', async () => {
      const baselineResults = {
        componentRender: {
          dashboard: await measureComponentRender(Dashboard, { persistLayout: false }, 3),
          eventFeed: await measureComponentRender(
            (props: any) => <TestProviders><EventFeed {...props} /></TestProviders>, 
            { sessions: createMockSessions(10), initialEvents: createMockEvents(100) }, 
            3
          )
        },
        eventProcessing: {
          batchingLatency: await (async () => {
            const batcher = getEventBatcher();
            const events = createMockEvents(100);
            
            const start = performance.now();
            events.forEach(e => batcher.addEvent(e));
            batcher.flush();
            const end = performance.now();
            
            return end - start;
          })(),
          sessionStatusCalculation: await (async () => {
            const sessions = createMockSessions(30);
            
            const start = performance.now();
            sessions.map(session => ({
              ...session,
              status: session.status === 'completed' ? 'completed' : 'active'
            }));
            const end = performance.now();
            
            return end - start;
          })()
        },
        virtualization: await createAdvancedPerformanceTests.virtualizationStressTest(1000, 20, 5)
      };

      // Store baseline for future regression testing
      const baseline = {
        timestamp: new Date().toISOString(),
        dashboardRender: baselineResults.componentRender.dashboard.averageRenderTime,
        eventFeedRender: baselineResults.componentRender.eventFeed.averageRenderTime,
        batchingLatency: baselineResults.eventProcessing.batchingLatency,
        sessionCalculation: baselineResults.eventProcessing.sessionStatusCalculation,
        virtualizationRender: baselineResults.virtualization.initialRenderTime,
        virtualizationFrameRate: baselineResults.virtualization.avgFrameRate
      };

      console.log('Performance Baseline Established:', JSON.stringify(baseline, null, 2));

      // Validate baseline is reasonable
      expect(baseline.dashboardRender).toBeLessThan(200);
      expect(baseline.eventFeedRender).toBeLessThan(300);
      expect(baseline.batchingLatency).toBeLessThan(50);
      expect(baseline.sessionCalculation).toBeLessThan(20);
      expect(baseline.virtualizationFrameRate).toBeGreaterThan(30);

      // Write baseline to test artifact for CI/CD regression detection
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem('chronicle-performance-baseline', JSON.stringify(baseline));
      }
    });
  });
});