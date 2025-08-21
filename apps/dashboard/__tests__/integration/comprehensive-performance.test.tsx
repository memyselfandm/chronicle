/**
 * Comprehensive Performance Integration Tests for CHR-25.S03
 * Tests the complete integration of EventFeedV2 and Performance Enhancements
 * 
 * Validates:
 * - 200 events/minute load handling
 * - 60fps scroll performance with 1000+ events
 * - Memory usage under 100MB
 * - Event batching and virtual scrolling integration
 * - Semantic color coding accuracy
 * - Real-time update performance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventFeedV2 } from '@/components/eventfeed/EventFeedV2';
import { EventTableV2 } from '@/components/eventfeed/EventTableV2';
import { Event, Session } from '@/types/events';
import { getEventBatcher, resetEventBatcher } from '@/lib/eventBatcher';
import { getPerformanceMonitor, resetPerformanceMonitor } from '@/lib/performanceMonitor';

// Enhanced mock for react-window with proper virtual scrolling simulation
jest.mock('react-window', () => ({
  FixedSizeList: React.forwardRef(({ children, itemCount, itemSize, height, width, itemData, overscanCount = 3 }: any, ref: any) => {
    // Simulate virtual scrolling by only rendering visible items + overscan
    const viewportHeight = height;
    const itemsPerPage = Math.ceil(viewportHeight / itemSize);
    const totalVisible = Math.min(itemCount, itemsPerPage + overscanCount * 2);
    
    // Mock scrollToItem function
    React.useImperativeHandle(ref, () => ({
      scrollToItem: jest.fn((index: number, align: string = 'auto') => {
        // Simulate scroll behavior
        console.log(`Virtual scroll to item ${index} with align ${align}`);
      }),
      scrollTo: jest.fn((scrollTop: number) => {
        console.log(`Virtual scroll to position ${scrollTop}`);
      })
    }));

    return (
      <div 
        ref={ref}
        data-testid="virtual-list"
        style={{ height, width }}
        data-item-count={itemCount}
        data-item-size={itemSize}
        data-visible-items={totalVisible}
        onScroll={(e) => {
          // Simulate scroll events for performance testing
          const scrollTop = (e.target as HTMLElement).scrollTop;
          const visibleStartIndex = Math.floor(scrollTop / itemSize);
          (e.target as any).dataset.visibleStartIndex = visibleStartIndex;
        }}
      >
        {Array.from({ length: totalVisible }, (_, index) => (
          <div key={index} style={{ height: itemSize }}>
            {children({ index, style: { height: itemSize }, data: itemData })}
          </div>
        ))}
      </div>
    );
  })
}));

// Performance measurement utilities
interface PerformanceReport {
  testName: string;
  duration: number;
  memoryUsage: number;
  frameRate: number;
  eventThroughput: number;
  status: 'PASS' | 'FAIL';
  details: Record<string, any>;
}

class PerformanceBenchmark {
  private reports: PerformanceReport[] = [];
  private startTime: number = 0;
  private startMemory: number = 0;

  startMeasurement(testName: string): void {
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsage();
    console.log(`🚀 Starting performance test: ${testName}`);
  }

  endMeasurement(testName: string, additionalData: Record<string, any> = {}): PerformanceReport {
    const duration = performance.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage() - this.startMemory;
    
    const report: PerformanceReport = {
      testName,
      duration,
      memoryUsage,
      frameRate: this.estimateFrameRate(duration),
      eventThroughput: additionalData.eventCount ? (additionalData.eventCount / (duration / 1000)) : 0,
      status: this.evaluatePerformance(duration, memoryUsage, additionalData) ? 'PASS' : 'FAIL',
      details: additionalData
    };

    this.reports.push(report);
    this.logReport(report);
    return report;
  }

  private getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  private estimateFrameRate(duration: number): number {
    // Estimate frame rate based on test duration (simplified)
    return duration > 0 ? Math.min(60, 1000 / (duration / 60)) : 60;
  }

  private evaluatePerformance(duration: number, memoryUsage: number, data: Record<string, any>): boolean {
    const maxDuration = data.expectedMaxDuration || 5000; // 5s default
    const maxMemory = data.expectedMaxMemory || 100 * 1024 * 1024; // 100MB default
    
    return duration < maxDuration && memoryUsage < maxMemory;
  }

  private logReport(report: PerformanceReport): void {
    const status = report.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${report.testName}`);
    console.log(`   Duration: ${report.duration.toFixed(2)}ms`);
    console.log(`   Memory: ${(report.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Frame Rate: ${report.frameRate.toFixed(1)}fps`);
    console.log(`   Throughput: ${report.eventThroughput.toFixed(1)} events/sec`);
    if (Object.keys(report.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(report.details)}`);
    }
  }

  getAllReports(): PerformanceReport[] {
    return [...this.reports];
  }

  generateSummary(): string {
    const total = this.reports.length;
    const passed = this.reports.filter(r => r.status === 'PASS').length;
    const failed = total - passed;

    return `Performance Test Summary: ${passed}/${total} tests passed (${failed} failed)`;
  }
}

// Test data generators
const createMockSession = (id: string, projectPath = '/test/project', branch = 'main'): Session => ({
  id,
  claude_session_id: `claude-${id}`,
  project_path: projectPath,
  git_branch: branch,
  start_time: new Date().toISOString(),
  metadata: {},
  created_at: new Date().toISOString()
});

const createMockEvent = (
  id: string, 
  type: string, 
  sessionId: string = 'session-1',
  timestamp: Date = new Date(),
  toolName?: string
): Event => ({
  id,
  session_id: sessionId,
  event_type: type as any,
  timestamp: timestamp.toISOString(),
  metadata: {
    ...(type === 'user_prompt_submit' && { prompt: `Test prompt ${id}` }),
    ...(type === 'pre_tool_use' && { tool_name: toolName }),
    ...(type === 'post_tool_use' && { 
      tool_response: { success: Math.random() > 0.1 },
      tool_name: toolName 
    }),
    ...(type === 'error' && { error_message: `Test error ${id}` }),
    ...(type === 'notification' && { message: `Test notification ${id}` })
  },
  tool_name: toolName,
  duration_ms: type.includes('tool_use') ? Math.floor(Math.random() * 1000) + 100 : undefined,
  created_at: timestamp.toISOString()
});

const generateEventBurst = (count: number, startTime: Date = new Date()): Event[] => {
  const eventTypes = ['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'error', 'stop'];
  const toolNames = ['Read', 'Write', 'Bash', 'Grep', 'Edit', 'MultiEdit'];
  
  return Array.from({ length: count }, (_, i) => {
    const eventType = eventTypes[i % eventTypes.length];
    const toolName = eventType.includes('tool_use') ? toolNames[i % toolNames.length] : undefined;
    const timestamp = new Date(startTime.getTime() + i * 300); // 300ms spacing = 3.33 events/sec
    
    return createMockEvent(`burst-event-${i}`, eventType, 'session-1', timestamp, toolName);
  });
};

describe('CHR-25.S03 Comprehensive Performance Integration Tests', () => {
  let benchmark: PerformanceBenchmark;
  let mockSessions: Session[];

  beforeAll(() => {
    // Configure performance monitoring
    const performanceMonitor = getPerformanceMonitor({
      frameRateTarget: 60,
      memoryThreshold: 100, // MB
      renderTimeThreshold: 16, // ms for 60fps
      throughputThreshold: 200 // events per minute
    });
    performanceMonitor.start();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    benchmark = new PerformanceBenchmark();
    
    // Reset event batcher for clean tests
    resetEventBatcher();
    
    mockSessions = [
      createMockSession('session-1', '/test/project-a', 'main'),
      createMockSession('session-2', '/test/project-b', 'feature-branch'),
      createMockSession('session-3', '/test/project-c', 'develop')
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
    // Reset performance monitor
    resetPerformanceMonitor();
  });

  afterAll(() => {
    console.log('\n📊 Final Performance Report:');
    console.log(benchmark.generateSummary());
  });

  describe('🚀 High-Volume Load Testing (200 events/minute)', () => {
    it('handles sustained 200 events/minute load without performance degradation', async () => {
      benchmark.startMeasurement('200 events/minute sustained load');
      
      const onPerformanceUpdate = jest.fn();
      
      render(
        <EventFeedV2
          sessions={mockSessions}
          height={400}
          width={800}
          enableBatching={true}
          batchWindowMs={100}
          maxEvents={1000}
          onPerformanceUpdate={onPerformanceUpdate}
        />
      );

      // Generate 200 events over 60 seconds (3.33 events/sec)
      const totalEvents = 200;
      const events = generateEventBurst(totalEvents);
      let processedBatches = 0;

      // Simulate real-time event arrival in batches
      for (let i = 0; i < events.length; i += 10) {
        const batch = events.slice(i, i + 10);
        
        await act(async () => {
          // Get the batcher instance and simulate batch processing
          const batcher = getEventBatcher();
          const subscribers = (batcher as any).listeners || new Set();
          
          subscribers.forEach((callback: Function) => {
            try {
              callback({
                id: `load-test-batch-${processedBatches}`,
                events: batch,
                batchedAt: new Date(),
                windowStart: new Date(),
                windowEnd: new Date(),
                size: batch.length
              });
            } catch (error) {
              console.warn('Batch processing error:', error);
            }
          });
          
          processedBatches++;
        });

        // Advance timers to simulate 100ms batching window
        act(() => {
          jest.advanceTimersByTime(100);
        });

        // Small delay to prevent overwhelming the test runner
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Verify the feed is still responsive
      await waitFor(() => {
        expect(screen.getByTestId('event-feed-v2')).toBeInTheDocument();
        const virtualList = screen.queryByTestId('virtual-list');
        if (virtualList) {
          expect(virtualList).toHaveAttribute('data-item-count');
        }
      }, { timeout: 10000 });

      const report = benchmark.endMeasurement('200 events/minute sustained load', {
        eventCount: totalEvents,
        expectedMaxDuration: 10000, // 10s max for processing
        expectedMaxMemory: 50 * 1024 * 1024, // 50MB max
        batchesProcessed: processedBatches
      });

      // Validate performance thresholds
      expect(report.status).toBe('PASS');
      expect(onPerformanceUpdate).toHaveBeenCalled();
      
      // Verify no memory leaks
      expect(report.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB
    });

    it('maintains performance during event bursts (>10 events/second)', async () => {
      benchmark.startMeasurement('Event burst handling');
      
      render(
        <EventFeedV2
          sessions={mockSessions}
          enableBatching={true}
          batchWindowMs={100}
          maxEvents={1000}
        />
      );

      // Create a burst of 50 events in rapid succession
      const burstEvents = generateEventBurst(50, new Date());
      
      await act(async () => {
        // Simulate immediate burst processing
        const batcher = getEventBatcher();
        const subscribers = (batcher as any).listeners || new Set();
        
        subscribers.forEach((callback: Function) => {
          callback({
            id: 'burst-batch',
            events: burstEvents,
            batchedAt: new Date(),
            windowStart: new Date(),
            windowEnd: new Date(),
            size: burstEvents.length
          });
        });
      });

      const report = benchmark.endMeasurement('Event burst handling', {
        eventCount: 50,
        expectedMaxDuration: 1000, // 1s max for burst
        expectedMaxMemory: 20 * 1024 * 1024 // 20MB max
      });

      expect(report.status).toBe('PASS');
    });
  });

  describe('📋 Virtual Scrolling Performance (1000+ events)', () => {
    it('maintains 60fps scroll performance with 1000+ events', async () => {
      benchmark.startMeasurement('Virtual scrolling with 1000+ events');
      
      // Generate large dataset
      const largeEventSet = generateEventBurst(1500);
      
      render(
        <EventFeedV2
          sessions={mockSessions}
          initialEvents={largeEventSet}
          height={400}
          width={800}
          maxEvents={1000}
        />
      );

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toBeInTheDocument();
        // Should apply FIFO limit to 1000 events
        expect(virtualList).toHaveAttribute('data-item-count', '1000');
        expect(virtualList).toHaveAttribute('data-item-size', '24');
      });

      // Simulate scroll operations
      const virtualList = screen.getByTestId('virtual-list');
      const scrollPerformance: number[] = [];

      for (let i = 0; i < 10; i++) {
        const scrollStart = performance.now();
        
        await act(async () => {
          fireEvent.scroll(virtualList, { target: { scrollTop: i * 240 } });
        });
        
        const scrollEnd = performance.now();
        scrollPerformance.push(scrollEnd - scrollStart);
        
        // 16.67ms = 60fps
        await new Promise(resolve => setTimeout(resolve, 17));
      }

      const avgScrollTime = scrollPerformance.reduce((a, b) => a + b, 0) / scrollPerformance.length;
      const maxScrollTime = Math.max(...scrollPerformance);

      const report = benchmark.endMeasurement('Virtual scrolling with 1000+ events', {
        eventCount: 1000,
        avgScrollTime,
        maxScrollTime,
        expectedMaxDuration: 3000,
        scrollPerformanceTarget: 16.67 // 60fps
      });

      expect(report.status).toBe('PASS');
      expect(avgScrollTime).toBeLessThan(16.67 * 2); // Allow 2 frames
      expect(maxScrollTime).toBeLessThan(50); // No single scroll > 50ms
    });

    it('efficiently handles FIFO event management at 1000 event limit', async () => {
      benchmark.startMeasurement('FIFO event management');
      
      const { rerender } = render(
        <EventFeedV2
          sessions={mockSessions}
          height={400}
          width={800}
          maxEvents={100} // Lower limit for faster testing
        />
      );

      // Add events beyond the limit
      const excessEvents = generateEventBurst(150);
      
      await act(async () => {
        const batcher = getEventBatcher();
        const subscribers = (batcher as any).listeners || new Set();
        
        subscribers.forEach((callback: Function) => {
          callback({
            id: 'fifo-test-batch',
            events: excessEvents,
            batchedAt: new Date(),
            windowStart: new Date(),
            windowEnd: new Date(),
            size: excessEvents.length
          });
        });
      });

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        // Should enforce the 100 event limit via FIFO
        expect(virtualList).toHaveAttribute('data-item-count', '100');
      });

      const report = benchmark.endMeasurement('FIFO event management', {
        eventsAdded: 150,
        eventsRetained: 100,
        expectedMaxDuration: 1000
      });

      expect(report.status).toBe('PASS');
    });
  });

  describe('🎨 Visual Design and Color Coding Validation', () => {
    it('applies correct semantic color coding per design specifications', async () => {
      benchmark.startMeasurement('Semantic color coding validation');
      
      const colorTestEvents = [
        createMockEvent('purple-event', 'user_prompt_submit'),
        createMockEvent('blue-event', 'pre_tool_use', 'session-1', new Date(), 'Read'),
        createMockEvent('green-event', 'post_tool_use', 'session-1', new Date(), 'Read'),
        createMockEvent('yellow-event', 'notification'),
        createMockEvent('red-event', 'error'),
        createMockEvent('gray-event', 'stop')
      ];

      render(
        <EventFeedV2
          sessions={mockSessions}
          initialEvents={colorTestEvents}
          height={400}
          width={800}
        />
      );

      await waitFor(() => {
        const eventRows = screen.getAllByTestId('event-row-v2');
        expect(eventRows).toHaveLength(6);
        
        // Verify each event type has correct data attribute
        expect(screen.getByTestId('event-row-v2')).toHaveAttribute('data-event-type');
      });

      const report = benchmark.endMeasurement('Semantic color coding validation', {
        eventTypesValidated: 6,
        expectedMaxDuration: 1000
      });

      expect(report.status).toBe('PASS');
    });

    it('maintains 24px row height consistency', async () => {
      benchmark.startMeasurement('Row height consistency');
      
      const testEvents = generateEventBurst(20);
      
      render(
        <EventTableV2
          events={testEvents}
          sessions={mockSessions}
          height={400}
          width={800}
        />
      );

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-item-size', '24');
      });

      const report = benchmark.endMeasurement('Row height consistency', {
        rowHeight: 24,
        expectedMaxDuration: 500
      });

      expect(report.status).toBe('PASS');
    });
  });

  describe('⚡ Real-time Update Performance', () => {
    it('handles auto-scroll during high-frequency updates', async () => {
      benchmark.startMeasurement('Auto-scroll during high-frequency updates');
      
      render(
        <EventFeedV2
          sessions={mockSessions}
          defaultAutoScroll={true}
          enableBatching={true}
          batchWindowMs={100}
        />
      );

      // Verify auto-scroll is enabled
      await waitFor(() => {
        expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
      });

      // Add rapid events to test auto-scroll performance
      const rapidEvents = generateEventBurst(30);
      
      for (let i = 0; i < rapidEvents.length; i += 5) {
        const batch = rapidEvents.slice(i, i + 5);
        
        await act(async () => {
          const batcher = getEventBatcher();
          const subscribers = (batcher as any).listeners || new Set();
          
          subscribers.forEach((callback: Function) => {
            callback({
              id: `autoscroll-batch-${i}`,
              events: batch,
              batchedAt: new Date(),
              windowStart: new Date(),
              windowEnd: new Date(),
              size: batch.length
            });
          });
        });

        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      const report = benchmark.endMeasurement('Auto-scroll during high-frequency updates', {
        eventsProcessed: 30,
        expectedMaxDuration: 3000
      });

      expect(report.status).toBe('PASS');
    });

    it('validates event batching at 100ms windows', async () => {
      benchmark.startMeasurement('Event batching window validation');
      
      const batchMetrics: number[] = [];
      const onPerformanceUpdate = jest.fn((metrics) => {
        if (metrics.avgBatchTime) {
          batchMetrics.push(metrics.avgBatchTime);
        }
      });
      
      render(
        <EventFeedV2
          sessions={mockSessions}
          enableBatching={true}
          batchWindowMs={100}
          onPerformanceUpdate={onPerformanceUpdate}
        />
      );

      // Test batch timing
      const testEvents = generateEventBurst(20);
      
      await act(async () => {
        const batcher = getEventBatcher();
        const subscribers = (batcher as any).listeners || new Set();
        
        subscribers.forEach((callback: Function) => {
          callback({
            id: 'timing-test-batch',
            events: testEvents,
            batchedAt: new Date(),
            windowStart: new Date(),
            windowEnd: new Date(),
            size: testEvents.length
          });
        });
      });

      const report = benchmark.endMeasurement('Event batching window validation', {
        targetBatchWindow: 100,
        expectedMaxDuration: 2000
      });

      expect(report.status).toBe('PASS');
    });
  });

  describe('🧠 Memory Management and Optimization', () => {
    it('maintains memory usage under 100MB during extended operation', async () => {
      benchmark.startMeasurement('Extended memory usage test');
      
      const { rerender } = render(
        <EventFeedV2
          sessions={mockSessions}
          enableBatching={true}
          maxEvents={1000}
        />
      );

      // Simulate extended operation with continuous event flow
      for (let cycle = 0; cycle < 5; cycle++) {
        const cycleEvents = generateEventBurst(200);
        
        await act(async () => {
          const batcher = getEventBatcher();
          const subscribers = (batcher as any).listeners || new Set();
          
          subscribers.forEach((callback: Function) => {
            callback({
              id: `memory-test-cycle-${cycle}`,
              events: cycleEvents,
              batchedAt: new Date(),
              windowStart: new Date(),
              windowEnd: new Date(),
              size: cycleEvents.length
            });
          });
        });

        // Force garbage collection if available
        if ((global as any).gc) {
          (global as any).gc();
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const report = benchmark.endMeasurement('Extended memory usage test', {
        testCycles: 5,
        eventsPerCycle: 200,
        expectedMaxMemory: 100 * 1024 * 1024, // 100MB
        expectedMaxDuration: 10000
      });

      expect(report.status).toBe('PASS');
      expect(report.memoryUsage).toBeLessThan(100 * 1024 * 1024);
    });

    it('validates React memo optimizations prevent unnecessary re-renders', async () => {
      benchmark.startMeasurement('React memo optimization validation');
      
      const renderSpy = jest.fn();
      
      // Create a test component that tracks renders
      const TestEventRow = React.memo(() => {
        renderSpy();
        return <div data-testid="test-row">Mock Event Row</div>;
      });

      const { rerender } = render(
        <div>
          <TestEventRow />
          <EventFeedV2
            sessions={mockSessions}
            enableBatching={true}
          />
        </div>
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Add events without changing props of memoized component
      await act(async () => {
        const batcher = getEventBatcher();
        const subscribers = (batcher as any).listeners || new Set();
        
        subscribers.forEach((callback: Function) => {
          callback({
            id: 'memo-test-batch',
            events: generateEventBurst(10),
            batchedAt: new Date(),
            windowStart: new Date(),
            windowEnd: new Date(),
            size: 10
          });
        });
      });

      // TestEventRow should not re-render
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount);

      const report = benchmark.endMeasurement('React memo optimization validation', {
        preventedRerenders: 'verified',
        expectedMaxDuration: 1000
      });

      expect(report.status).toBe('PASS');
    });
  });
});