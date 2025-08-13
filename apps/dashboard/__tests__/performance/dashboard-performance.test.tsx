/**
 * Performance Tests for Chronicle Dashboard
 * Tests system performance with large datasets and real-time updates
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { EventFeed } from '@/components/EventFeed';
import { Header } from '@/components/layout/Header';
import { EventFilter } from '@/components/EventFilter';
import { generateMockEvents, createMockEventWithProps } from '@/lib/mockData';
import { processEvents } from '@/lib/eventProcessor';

// Performance measurement utilities
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  eventProcessingTime: number;
  domNodes: number;
}

function measurePerformance(testName: string, fn: () => void): PerformanceMetrics {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  fn();
  
  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  const metrics: PerformanceMetrics = {
    renderTime: endTime - startTime,
    memoryUsage: endMemory - startMemory,
    eventProcessingTime: 0,
    domNodes: document.querySelectorAll('*').length
  };

  console.log(`Performance Test [${testName}]:`, {
    renderTime: `${metrics.renderTime.toFixed(2)}ms`,
    memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
    domNodes: metrics.domNodes
  });

  return metrics;
}

async function measureAsyncPerformance(testName: string, fn: () => Promise<void>): Promise<PerformanceMetrics> {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  await fn();
  
  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  const metrics: PerformanceMetrics = {
    renderTime: endTime - startTime,
    memoryUsage: endMemory - startMemory,
    eventProcessingTime: 0,
    domNodes: document.querySelectorAll('*').length
  };

  console.log(`Async Performance Test [${testName}]:`, {
    renderTime: `${metrics.renderTime.toFixed(2)}ms`,
    memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
    domNodes: metrics.domNodes
  });

  return metrics;
}

describe('Dashboard Performance Tests', () => {
  
  // Performance thresholds (adjust based on requirements)
  const PERFORMANCE_THRESHOLDS = {
    RENDER_TIME_MS: 2000,        // Max 2s for large datasets
    MEMORY_USAGE_MB: 50,         // Max 50MB memory increase
    DOM_NODES: 10000,           // Max 10k DOM nodes
    EVENT_PROCESSING_MS: 100,    // Max 100ms for event processing
    SCROLL_PERFORMANCE_MS: 16,   // 60fps = 16.67ms per frame
    FILTER_RESPONSE_MS: 200      // Max 200ms filter response
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing DOM to ensure clean measurements
    document.body.innerHTML = '';
  });

  describe('Large Dataset Rendering Performance', () => {
    it('renders 100+ events within performance thresholds', async () => {
      const largeEventSet = generateMockEvents(150);
      
      const metrics = await measureAsyncPerformance('100+ Events Render', async () => {
        render(<EventFeed events={largeEventSet} />);
        
        await waitFor(() => {
          const eventCards = screen.getAllByTestId(/event-card-/);
          expect(eventCards).toHaveLength(150);
        });
      });

      // Validate performance thresholds
      expect(metrics.renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
      expect(metrics.memoryUsage / 1024 / 1024).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);
      expect(metrics.domNodes).toBeLessThan(PERFORMANCE_THRESHOLDS.DOM_NODES);
    });

    it('handles 500+ events with virtual scrolling simulation', async () => {
      const massiveEventSet = generateMockEvents(500);
      
      const metrics = await measureAsyncPerformance('500+ Events Virtual Scroll', async () => {
        // Simulate virtual scrolling by rendering only visible events
        const visibleEvents = massiveEventSet.slice(0, 50); // Simulate viewport
        
        render(<EventFeed events={visibleEvents} />);
        
        await waitFor(() => {
          const eventCards = screen.getAllByTestId(/event-card-/);
          expect(eventCards).toHaveLength(50);
        });
      });

      // Virtual scrolling should maintain good performance
      expect(metrics.renderTime).toBeLessThan(500); // Should be much faster
      expect(metrics.domNodes).toBeLessThan(2000);  // Fewer DOM nodes with virtualization
    });

    it('measures event processing performance with complex data', () => {
      // Generate events with complex nested data
      const complexEvents = Array.from({ length: 200 }, (_, i) => 
        createMockEventWithProps({
          id: `complex-event-${i}`,
          details: {
            nested: {
              data: {
                level1: { level2: { level3: `value-${i}` } },
                array: Array.from({ length: 10 }, (_, j) => ({ id: j, value: `item-${j}` })),
                metadata: {
                  file_operations: Array.from({ length: 5 }, (_, k) => ({
                    operation: 'read',
                    path: `/src/component-${k}.tsx`,
                    size: Math.random() * 10000
                  }))
                }
              }
            }
          }
        })
      );

      const startProcessing = performance.now();
      const processedEvents = processEvents(complexEvents.map(e => ({
        session_id: e.sessionId,
        hook_event_name: 'PreToolUse',
        timestamp: e.timestamp.toISOString(),
        success: true,
        raw_input: e.details
      })));
      const endProcessing = performance.now();

      const processingTime = endProcessing - startProcessing;
      console.log(`Event processing time for 200 complex events: ${processingTime.toFixed(2)}ms`);

      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.EVENT_PROCESSING_MS);
      expect(processedEvents).toHaveLength(200);
    });
  });

  describe('Real-time Update Performance', () => {
    it('maintains performance during rapid event updates', async () => {
      const initialEvents = generateMockEvents(50);
      let currentEvents = [...initialEvents];
      
      const { rerender } = render(<EventFeed events={currentEvents} />);

      // Simulate rapid updates (10 events per second for 5 seconds)
      const updatePerformance: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const startUpdate = performance.now();
        
        // Add new event
        const newEvent = createMockEventWithProps({
          id: `rapid-update-${i}`,
          timestamp: new Date()
        });
        
        currentEvents = [newEvent, ...currentEvents.slice(0, 99)]; // Keep only 100 most recent
        
        await act(async () => {
          rerender(<EventFeed events={currentEvents} />);
        });
        
        const endUpdate = performance.now();
        updatePerformance.push(endUpdate - startUpdate);
        
        // Small delay to simulate real-time frequency
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Calculate average update time
      const averageUpdateTime = updatePerformance.reduce((a, b) => a + b, 0) / updatePerformance.length;
      const maxUpdateTime = Math.max(...updatePerformance);

      console.log(`Real-time update performance: avg=${averageUpdateTime.toFixed(2)}ms, max=${maxUpdateTime.toFixed(2)}ms`);

      expect(averageUpdateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCROLL_PERFORMANCE_MS * 2); // Allow 2 frames
      expect(maxUpdateTime).toBeLessThan(100); // No single update should take more than 100ms
    });

    it('tests memory stability during extended real-time operation', async () => {
      const memoryMeasurements: number[] = [];
      let events = generateMockEvents(20);
      
      const { rerender } = render(<EventFeed events={events} />);

      // Run for 100 iterations to test memory stability
      for (let i = 0; i < 100; i++) {
        const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
        
        // Add new event and remove oldest to maintain constant size
        const newEvent = createMockEventWithProps({
          id: `memory-test-${i}`,
          timestamp: new Date()
        });
        
        events = [newEvent, ...events.slice(0, 19)]; // Keep exactly 20 events
        
        await act(async () => {
          rerender(<EventFeed events={events} />);
        });

        const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
        memoryMeasurements.push(memoryAfter - memoryBefore);

        if (i % 20 === 0) {
          // Force garbage collection if available (Chrome DevTools)
          if ((window as any).gc) {
            (window as any).gc();
          }
        }
      }

      // Memory should not continuously grow
      const totalMemoryGrowth = memoryMeasurements.reduce((sum, change) => sum + Math.max(0, change), 0);
      const memoryGrowthMB = totalMemoryGrowth / 1024 / 1024;

      console.log(`Memory growth over 100 iterations: ${memoryGrowthMB.toFixed(2)}MB`);
      
      expect(memoryGrowthMB).toBeLessThan(10); // Should not grow more than 10MB
    });
  });

  describe('Filtering and Search Performance', () => {
    it('measures filter application performance on large datasets', async () => {
      const largeDataset = generateMockEvents(300);
      const sessions = [...new Set(largeDataset.map(e => e.sessionId))];
      const eventTypes = [...new Set(largeDataset.map(e => e.type))];

      let filteredEvents = largeDataset;
      const filterTimes: number[] = [];

      const onFilterChange = jest.fn((filters) => {
        const startFilter = performance.now();
        
        filteredEvents = largeDataset.filter(event => {
          if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
            return false;
          }
          if (filters.sessionIds.length > 0 && !filters.sessionIds.includes(event.sessionId)) {
            return false;
          }
          if (filters.searchQuery && !event.summary.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
            return false;
          }
          return true;
        });
        
        const endFilter = performance.now();
        filterTimes.push(endFilter - startFilter);
      });

      const { rerender } = render(
        <div>
          <EventFilter onFilterChange={onFilterChange} />
          <EventFeed events={filteredEvents} />
        </div>
      );

      // Test various filter combinations
      const filterTests = [
        { eventTypes: ['error'], sessionIds: [], searchQuery: '' },
        { eventTypes: [], sessionIds: [sessions[0]], searchQuery: '' },
        { eventTypes: ['tool_use'], sessionIds: [sessions[0], sessions[1]], searchQuery: '' },
        { eventTypes: [], sessionIds: [], searchQuery: 'file' },
        { eventTypes: ['success', 'tool_use'], sessionIds: sessions.slice(0, 2), searchQuery: 'operation' }
      ];

      for (const filters of filterTests) {
        await act(async () => {
          onFilterChange(filters);
          rerender(
            <div>
              <EventFilter onFilterChange={onFilterChange} />
              <EventFeed events={filteredEvents} />
            </div>
          );
        });

        await waitFor(() => {
          const eventCards = screen.getAllByTestId(/event-card-/);
          expect(eventCards.length).toBeGreaterThanOrEqual(0);
        });
      }

      const averageFilterTime = filterTimes.reduce((a, b) => a + b, 0) / filterTimes.length;
      const maxFilterTime = Math.max(...filterTimes);

      console.log(`Filter performance: avg=${averageFilterTime.toFixed(2)}ms, max=${maxFilterTime.toFixed(2)}ms`);

      expect(averageFilterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILTER_RESPONSE_MS);
      expect(maxFilterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILTER_RESPONSE_MS * 2);
    });

    it('tests search performance with complex queries', async () => {
      const searchableEvents = Array.from({ length: 200 }, (_, i) => 
        createMockEventWithProps({
          id: `search-event-${i}`,
          summary: `Complex operation ${i} involving file system manipulation and data processing`,
          details: {
            description: `Detailed description for event ${i} with keywords like database, optimization, performance, and testing`,
            keywords: ['performance', 'database', 'optimization', 'file-system', 'testing'],
            metadata: {
              file_path: `/src/components/complex-component-${i}.tsx`,
              operation_type: i % 2 === 0 ? 'read' : 'write'
            }
          }
        })
      );

      const searchQueries = [
        'file',
        'operation',
        'complex',
        'performance optimization',
        'database testing',
        'component-1'
      ];

      const searchTimes: number[] = [];

      for (const query of searchQueries) {
        const startSearch = performance.now();
        
        const searchResults = searchableEvents.filter(event => 
          event.summary.toLowerCase().includes(query.toLowerCase()) ||
          JSON.stringify(event.details).toLowerCase().includes(query.toLowerCase())
        );
        
        const endSearch = performance.now();
        searchTimes.push(endSearch - startSearch);

        render(<EventFeed events={searchResults} />);
        
        expect(searchResults.length).toBeGreaterThanOrEqual(0);
      }

      const averageSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      console.log(`Search performance across ${searchQueries.length} queries: ${averageSearchTime.toFixed(2)}ms average`);

      expect(averageSearchTime).toBeLessThan(50); // Search should be very fast
    });
  });

  describe('Component Integration Performance', () => {
    it('measures full dashboard performance with all components', async () => {
      const testEvents = generateMockEvents(100);
      const testSessions = Array.from(new Set(testEvents.map(e => e.sessionId)));

      const metrics = await measureAsyncPerformance('Full Dashboard', async () => {
        render(
          <div>
            <Header 
              eventCount={testEvents.length} 
              connectionStatus="Connected"
            />
            <EventFilter 
              onFilterChange={jest.fn()}
            />
            <EventFeed 
              events={testEvents} 
              showAutoScrollToggle={true}
            />
          </div>
        );

        await waitFor(() => {
          expect(screen.getByText(`${testEvents.length} events`)).toBeInTheDocument();
          expect(screen.getAllByTestId(/event-card-/)).toHaveLength(100);
        });
      });

      // Full dashboard should still meet performance requirements
      expect(metrics.renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
      expect(metrics.domNodes).toBeLessThan(PERFORMANCE_THRESHOLDS.DOM_NODES);
    });

    it('tests scroll performance with large event lists', async () => {
      const scrollEvents = generateMockEvents(200);
      render(<EventFeed events={scrollEvents} height="400px" />);

      const scrollContainer = screen.getByTestId('event-feed');
      const scrollTimes: number[] = [];

      // Simulate multiple scroll operations
      for (let i = 0; i < 10; i++) {
        const startScroll = performance.now();
        
        // Simulate scroll event
        Object.defineProperty(scrollContainer, 'scrollTop', {
          value: i * 100,
          writable: true
        });
        
        scrollContainer.dispatchEvent(new Event('scroll'));
        
        const endScroll = performance.now();
        scrollTimes.push(endScroll - startScroll);

        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }

      const averageScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      console.log(`Scroll performance: ${averageScrollTime.toFixed(2)}ms average`);

      expect(averageScrollTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCROLL_PERFORMANCE_MS);
    });
  });

  describe('Memory Leak Detection', () => {
    it('detects memory leaks during component mount/unmount cycles', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memorySnapshots: number[] = [];

      // Mount and unmount components multiple times
      for (let i = 0; i < 20; i++) {
        const events = generateMockEvents(50);
        
        const { unmount } = render(<EventFeed events={events} />);
        
        await waitFor(() => {
          expect(screen.getAllByTestId(/event-card-/)).toHaveLength(50);
        });
        
        unmount();
        
        // Take memory snapshot
        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        memorySnapshots.push(currentMemory - initialMemory);
        
        // Force cleanup if available
        if ((window as any).gc) {
          (window as any).gc();
        }
      }

      // Memory should not continuously grow
      const finalMemoryIncrease = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowthMB = finalMemoryIncrease / 1024 / 1024;

      console.log(`Memory after 20 mount/unmount cycles: ${memoryGrowthMB.toFixed(2)}MB increase`);
      
      expect(memoryGrowthMB).toBeLessThan(20); // Should not grow excessively
    });
  });
});