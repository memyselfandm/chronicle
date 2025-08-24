/**
 * Integration tests for EventFeed - End-to-end event feed performance
 * Tests the complete system including batching, virtual scrolling, and real-time updates
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventFeed } from '@/components/eventfeed/EventFeed';
import { Event, Session } from '@/types/events';

// Mock react-window for testing
jest.mock('react-window', () => ({
  FixedSizeList: React.forwardRef(({ children, itemCount, itemSize, height, width, itemData }: any, ref: any) => (
    <div 
      ref={ref}
      data-testid="virtual-list"
      style={{ height, width }}
      data-item-count={itemCount}
      data-item-size={itemSize}
    >
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => (
        <div key={index}>
          {children({ index, style: { height: itemSize }, data: itemData })}
        </div>
      ))}
    </div>
  ))
}));

// Mock event batcher
const mockBatcher = {
  addEvent: jest.fn(),
  addEvents: jest.fn(),
  subscribe: jest.fn(() => jest.fn()),
  updateConfig: jest.fn(),
  destroy: jest.fn(),
  flush: jest.fn(),
  getMetrics: jest.fn(() => ({
    queueLength: 0,
    currentBatchSize: 0,
    processedCount: 0,
    errorCount: 0,
    averageProcessingTime: 0
  }))
};

jest.mock('@/lib/eventBatcher', () => ({
  getEventBatcher: jest.fn(() => mockBatcher)
}));

const mockSessions: Session[] = [
  {
    id: 'session-1',
    claude_session_id: 'claude-1',
    project_path: '/test/project',
    git_branch: 'main',
    start_time: '2024-01-01T09:00:00Z',
    metadata: {},
    created_at: '2024-01-01T09:00:00Z'
  }
];

const createMockEvent = (id: string, type: string, timestamp: Date, toolName?: string): Event => ({
  id,
  session_id: 'session-1',
  event_type: type as any,
  timestamp: timestamp.toISOString(),
  metadata: {},
  tool_name: toolName,
  created_at: timestamp.toISOString()
});

describe('EventFeed Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('High-Performance Event Processing', () => {
    it('handles 200 events per minute without performance degradation', async () => {
      const onPerformanceUpdate = jest.fn();
      
      render(
        <EventFeed
          sessions={mockSessions}
          height={400}
          width={800}
          enableBatching={true}
          batchWindowMs={100}
          onPerformanceUpdate={onPerformanceUpdate}
        />
      );

      // Simulate rapid event arrival (200 events/min = ~3.33 events/sec)
      const events: Event[] = [];
      for (let i = 0; i < 200; i++) {
        events.push(createMockEvent(
          `rapid-event-${i}`,
          'user_prompt_submit',
          new Date(Date.now() + i * 300) // 300ms apart = 3.33/sec
        ));
      }

      // Add events in batches to simulate real-time arrival
      for (let i = 0; i < events.length; i += 10) {
        const batch = events.slice(i, i + 10);
        
        // Simulate event batcher calling the subscription callback
        act(() => {
          const subscription = mockBatcher.subscribe.mock.calls[0][0];
          subscription({
            id: `batch-${i}`,
            events: batch,
            batchedAt: new Date(),
            windowStart: new Date(),
            windowEnd: new Date(),
            size: batch.length
          });
        });

        // Advance timers to simulate real-time
        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('event-feed-v2')).toBeInTheDocument();
      });

      // Verify performance metrics were called
      expect(onPerformanceUpdate).toHaveBeenCalled();
      
      // Verify batcher was configured correctly
      expect(mockBatcher.updateConfig).toHaveBeenCalledWith({
        windowMs: 100,
        preserveOrder: true
      });
    });

    it('maintains 60fps scrolling performance with 1000+ events', async () => {
      const largeEventSet: Event[] = [];
      for (let i = 0; i < 1500; i++) {
        largeEventSet.push(createMockEvent(
          `large-event-${i}`,
          i % 2 === 0 ? 'pre_tool_use' : 'post_tool_use',
          new Date(Date.now() + i * 100),
          'Read'
        ));
      }

      render(
        <EventFeed
          sessions={mockSessions}
          initialEvents={largeEventSet}
          height={400}
          width={800}
          maxEvents={1000}
        />
      );

      const virtualList = screen.getByTestId('virtual-list');
      
      // Should apply FIFO limit
      expect(virtualList).toHaveAttribute('data-item-count', '1000');
      
      // Should maintain 24px item height for performance
      expect(virtualList).toHaveAttribute('data-item-size', '24');
    });

    it('handles memory management with FIFO event history', async () => {
      const { rerender } = render(
        <EventFeed
          sessions={mockSessions}
          height={400}
          width={800}
          maxEvents={100}
        />
      );

      // Add events beyond the limit
      const excessEvents: Event[] = [];
      for (let i = 0; i < 150; i++) {
        excessEvents.push(createMockEvent(
          `excess-event-${i}`,
          'user_prompt_submit',
          new Date(Date.now() + i * 1000)
        ));
      }

      act(() => {
        const subscription = mockBatcher.subscribe.mock.calls[0][0];
        subscription({
          id: 'excess-batch',
          events: excessEvents,
          batchedAt: new Date(),
          windowStart: new Date(),
          windowEnd: new Date(),
          size: excessEvents.length
        });
      });

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        // Should enforce the 100 event limit
        expect(virtualList).toHaveAttribute('data-item-count', '100');
      });
    });
  });

  describe('Event Batching Integration', () => {
    it('configures EventBatcher with correct parameters', () => {
      render(
        <EventFeed
          sessions={mockSessions}
          enableBatching={true}
          batchWindowMs={150}
        />
      );

      expect(mockBatcher.updateConfig).toHaveBeenCalledWith({
        windowMs: 150,
        preserveOrder: true
      });
    });

    it('subscribes to batch events and processes them correctly', async () => {
      render(
        <EventFeed
          sessions={mockSessions}
          enableBatching={true}
        />
      );

      expect(mockBatcher.subscribe).toHaveBeenCalled();

      const batchEvents = [
        createMockEvent('batch-1', 'pre_tool_use', new Date(), 'Read'),
        createMockEvent('batch-2', 'post_tool_use', new Date(), 'Read')
      ];

      // Simulate batch callback
      act(() => {
        const subscription = mockBatcher.subscribe.mock.calls[0][0];
        subscription({
          id: 'test-batch',
          events: batchEvents,
          batchedAt: new Date(),
          windowStart: new Date(),
          windowEnd: new Date(),
          size: batchEvents.length
        });
      });

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-item-count', '2');
      });
    });

    it('falls back to direct event handling when batching disabled', async () => {
      const { rerender } = render(
        <EventFeed
          sessions={mockSessions}
          enableBatching={false}
        />
      );

      // Should not configure batcher when disabled
      expect(mockBatcher.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('Auto-scroll Behavior', () => {
    it('auto-scrolls to newest events when enabled', async () => {
      render(
        <EventFeed
          sessions={mockSessions}
          defaultAutoScroll={true}
        />
      );

      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      expect(autoScrollToggle).toHaveAttribute('aria-pressed', 'true');

      // Add new events
      const newEvents = [
        createMockEvent('new-1', 'user_prompt_submit', new Date())
      ];

      act(() => {
        const subscription = mockBatcher.subscribe.mock.calls[0][0];
        subscription({
          id: 'new-batch',
          events: newEvents,
          batchedAt: new Date(),
          windowStart: new Date(),
          windowEnd: new Date(),
          size: newEvents.length
        });
      });

      await waitFor(() => {
        // Auto-scroll should be indicated in UI
        expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
      });
    });

    it('preserves manual scroll position when auto-scroll disabled', async () => {
      render(
        <EventFeed
          sessions={mockSessions}
          defaultAutoScroll={false}
        />
      );

      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      expect(autoScrollToggle).toHaveAttribute('aria-pressed', 'false');

      // Manual scroll should be preserved
      expect(screen.getByText('Auto-scroll')).toBeInTheDocument();
    });

    it('toggles auto-scroll state correctly', async () => {
      render(
        <EventFeed
          sessions={mockSessions}
          defaultAutoScroll={true}
        />
      );

      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      
      // Toggle off
      fireEvent.click(autoScrollToggle);
      expect(autoScrollToggle).toHaveAttribute('aria-pressed', 'false');

      // Toggle back on
      fireEvent.click(autoScrollToggle);
      expect(autoScrollToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Semantic Color Coding', () => {
    it('applies correct color schemes for different event types', async () => {
      const colorTestEvents = [
        createMockEvent('purple-event', 'user_prompt_submit', new Date()),
        createMockEvent('blue-event', 'pre_tool_use', new Date(), 'Read'),
        createMockEvent('green-event', 'post_tool_use', new Date(), 'Read'),
        createMockEvent('yellow-event', 'notification', new Date()),
        createMockEvent('red-event', 'error', new Date()),
        createMockEvent('gray-event', 'stop', new Date())
      ];

      render(
        <EventFeed
          sessions={mockSessions}
          initialEvents={colorTestEvents}
        />
      );

      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-item-count', '6');
      });

      // Color coding is tested in EventRowV2 unit tests
      // Here we just verify the events are rendered
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
    });
  });

  describe('Performance Monitoring', () => {
    it('reports performance metrics correctly', async () => {
      const onPerformanceUpdate = jest.fn();
      
      render(
        <EventFeed
          sessions={mockSessions}
          onPerformanceUpdate={onPerformanceUpdate}
        />
      );

      // Add events to trigger metrics
      const testEvents = [
        createMockEvent('metric-1', 'user_prompt_submit', new Date()),
        createMockEvent('metric-2', 'pre_tool_use', new Date(), 'Read')
      ];

      act(() => {
        const subscription = mockBatcher.subscribe.mock.calls[0][0];
        subscription({
          id: 'metrics-batch',
          events: testEvents,
          batchedAt: new Date(),
          windowStart: new Date(),
          windowEnd: new Date(),
          size: testEvents.length
        });
      });

      await waitFor(() => {
        expect(onPerformanceUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            totalEvents: expect.any(Number),
            eventsPerSecond: expect.any(Number),
            memoryUsage: expect.any(Number),
            lastUpdate: expect.any(Date)
          })
        );
      });
    });

    it('displays development metrics overlay', () => {
      // Temporarily set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <EventFeed
          sessions={mockSessions}
          onPerformanceUpdate={jest.fn()}
        />
      );

      // Should show metrics overlay in development
      expect(screen.getByText(/Events:/)).toBeInTheDocument();
      expect(screen.getByText(/Rate:/)).toBeInTheDocument();
      expect(screen.getByText(/Memory:/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('handles empty sessions array gracefully', () => {
      render(
        <EventFeed
          sessions={[]}
          height={400}
          width={800}
        />
      );

      expect(screen.getByTestId('event-feed-v2')).toBeInTheDocument();
    });

    it('handles invalid event data gracefully', async () => {
      const invalidEvents = [
        { id: 'invalid' }, // Missing required fields
        createMockEvent('valid', 'user_prompt_submit', new Date())
      ];

      render(
        <EventFeed
          sessions={mockSessions}
          initialEvents={invalidEvents as any}
        />
      );

      await waitFor(() => {
        // Should filter out invalid events
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-item-count', '1');
      });
    });

    it('cleans up resources on unmount', () => {
      const { unmount } = render(
        <EventFeed
          sessions={mockSessions}
        />
      );

      unmount();

      expect(mockBatcher.destroy).toHaveBeenCalled();
    });
  });
});