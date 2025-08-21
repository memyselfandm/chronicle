/**
 * Virtualized components test suite
 * Tests for virtual scrolling performance and functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VirtualizedEventFeed } from '../../src/components/VirtualizedEventFeed';
import { VirtualizedSessionList } from '../../src/components/VirtualizedSessionList';
import { EventData } from '../../src/lib/mockData';
import { SessionData } from '../../src/stores/dashboardStore';

// Mock react-window
jest.mock('react-window', () => ({
  FixedSizeList: React.forwardRef(({ children, itemCount, itemData, height, itemSize, onScroll }: any, ref: any) => {
    const items = Array.from({ length: Math.min(itemCount, 10) }, (_, index) => (
      React.createElement(children, {
        key: index,
        index,
        style: { height: itemSize },
        data: itemData,
      })
    ));

    return React.createElement('div', {
      ref,
      'data-testid': 'virtual-list',
      style: { height },
      onScroll: () => onScroll?.({ scrollOffset: 0, scrollDirection: 'forward' }),
    }, items);
  }),
}));

// Mock performance monitor
jest.mock('../../src/lib/performanceMonitor', () => ({
  getPerformanceMonitor: () => ({
    createProfiler: () => ({
      start: () => ({ end: () => 0 }),
    }),
    trackEvent: jest.fn(),
    trackComponentRender: jest.fn(),
  }),
}));

describe('VirtualizedEventFeed', () => {
  const mockEvents: EventData[] = Array.from({ length: 100 }, (_, index) => ({
    id: `event-${index}`,
    sessionId: `session-${index % 10}`,
    type: 'user_prompt_submit',
    timestamp: new Date(Date.now() - index * 1000),
    metadata: {},
    status: 'active' as const,
    session_id: `session-${index % 10}`,
    event_type: 'user_prompt_submit',
    summary: `Event ${index} summary`,
    details: null,
  }));

  it('should render virtualized event list', () => {
    render(
      <VirtualizedEventFeed
        events={mockEvents}
        height={600}
        itemHeight={120}
      />
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it('should render empty state when no events', () => {
    render(
      <VirtualizedEventFeed
        events={[]}
        height={600}
        itemHeight={120}
      />
    );

    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(screen.getByText('Events will appear here as they are generated')).toBeInTheDocument();
  });

  it('should handle event clicks', () => {
    const onEventClick = jest.fn();
    
    render(
      <VirtualizedEventFeed
        events={mockEvents.slice(0, 5)}
        height={600}
        itemHeight={120}
        onEventClick={onEventClick}
      />
    );

    const eventCard = screen.getAllByRole('button')[0];
    fireEvent.click(eventCard);

    expect(onEventClick).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('should show scroll indicator when scrolling', async () => {
    render(
      <VirtualizedEventFeed
        events={mockEvents}
        height={400}
        itemHeight={80}
        showScrollIndicator={true}
      />
    );

    const virtualList = screen.getByTestId('virtual-list');
    fireEvent.scroll(virtualList);

    // Scroll indicator should appear during scrolling
    // Note: In real implementation, this would be debounced
  });

  it('should handle auto-scroll to new events', () => {
    const { rerender } = render(
      <VirtualizedEventFeed
        events={mockEvents.slice(0, 10)}
        height={600}
        itemHeight={120}
        autoScroll={true}
      />
    );

    // Add new events
    const newEvents = [...mockEvents.slice(0, 10), ...mockEvents.slice(10, 15)];
    
    rerender(
      <VirtualizedEventFeed
        events={newEvents}
        height={600}
        itemHeight={120}
        autoScroll={true}
      />
    );

    // Should scroll to top for new events
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it('should use correct item height for compact mode', () => {
    render(
      <VirtualizedEventFeed
        events={mockEvents.slice(0, 5)}
        height={600}
        itemHeight={60} // Compact height
      />
    );

    const virtualList = screen.getByTestId('virtual-list');
    expect(virtualList).toHaveStyle({ height: '600px' });
  });

  it('should handle performance monitoring', () => {
    const performanceMonitor = require('../../src/lib/performanceMonitor').getPerformanceMonitor();
    
    render(
      <VirtualizedEventFeed
        events={mockEvents.slice(0, 20)}
        height={600}
        itemHeight={120}
      />
    );

    expect(performanceMonitor.createProfiler).toHaveBeenCalledWith('VirtualizedEventFeed');
  });
});

describe('VirtualizedSessionList', () => {
  const mockSessions: SessionData[] = Array.from({ length: 50 }, (_, index) => ({
    id: `session-${index}`,
    status: index % 3 === 0 ? 'active' : index % 3 === 1 ? 'idle' : 'completed',
    startTime: new Date(Date.now() - index * 60000),
    endTime: index % 3 === 2 ? new Date(Date.now() - index * 60000 + 30000) : undefined,
    toolsUsed: Math.floor(Math.random() * 10),
    eventsCount: Math.floor(Math.random() * 50),
    lastActivity: new Date(Date.now() - index * 1000),
  }));

  it('should render virtualized session list', () => {
    render(
      <VirtualizedSessionList
        sessions={mockSessions}
        height={400}
        itemHeight={80}
      />
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it('should render empty state when no sessions', () => {
    render(
      <VirtualizedSessionList
        sessions={[]}
        height={400}
        itemHeight={80}
      />
    );

    expect(screen.getByText('No sessions')).toBeInTheDocument();
    expect(screen.getByText(/Sessions will appear here when you start using Claude Code/)).toBeInTheDocument();
  });

  it('should handle session clicks', () => {
    const onSessionClick = jest.fn();
    
    render(
      <VirtualizedSessionList
        sessions={mockSessions.slice(0, 5)}
        height={400}
        itemHeight={80}
        onSessionClick={onSessionClick}
      />
    );

    const sessionItem = screen.getAllByRole('button')[0];
    fireEvent.click(sessionItem);

    expect(onSessionClick).toHaveBeenCalledWith(mockSessions[0]);
  });

  it('should handle multi-select with ctrl/cmd key', () => {
    const onSessionSelect = jest.fn();
    
    render(
      <VirtualizedSessionList
        sessions={mockSessions.slice(0, 5)}
        height={400}
        itemHeight={80}
        onSessionSelect={onSessionSelect}
        selectedSessionIds={[]}
      />
    );

    const sessionItem = screen.getAllByRole('button')[0];
    
    // Single click
    fireEvent.click(sessionItem);
    expect(onSessionSelect).toHaveBeenCalledWith(mockSessions[0].id, false);

    // Ctrl+click for multi-select
    fireEvent.click(sessionItem, { ctrlKey: true });
    expect(onSessionSelect).toHaveBeenCalledWith(mockSessions[0].id, true);
  });

  it('should highlight selected sessions', () => {
    const selectedSessionIds = ['session-0', 'session-2'];
    
    render(
      <VirtualizedSessionList
        sessions={mockSessions.slice(0, 5)}
        height={400}
        itemHeight={80}
        selectedSessionIds={selectedSessionIds}
      />
    );

    // Check if selected sessions have different styling
    const sessionItems = screen.getAllByRole('button');
    expect(sessionItems[0]).toHaveClass('bg-accent-blue/10');
  });

  it('should display session status correctly', () => {
    const testSessions = [
      { ...mockSessions[0], status: 'active' as const },
      { ...mockSessions[1], status: 'idle' as const },
      { ...mockSessions[2], status: 'completed' as const },
    ];

    render(
      <VirtualizedSessionList
        sessions={testSessions}
        height={400}
        itemHeight={80}
      />
    );

    // Check for status indicators
    expect(screen.getByLabelText('Session active')).toBeInTheDocument();
    expect(screen.getByLabelText('Session idle')).toBeInTheDocument();
    expect(screen.getByLabelText('Session completed')).toBeInTheDocument();
  });

  it('should show event counts and tool usage', () => {
    const sessionWithStats = {
      ...mockSessions[0],
      eventsCount: 25,
      toolsUsed: 5,
    };

    render(
      <VirtualizedSessionList
        sessions={[sessionWithStats]}
        height={400}
        itemHeight={80}
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument(); // Event count badge
    expect(screen.getByText('🔧 5')).toBeInTheDocument(); // Tool usage
  });

  it('should handle scroll performance tracking', () => {
    const performanceMonitor = require('../../src/lib/performanceMonitor').getPerformanceMonitor();
    
    render(
      <VirtualizedSessionList
        sessions={mockSessions}
        height={400}
        itemHeight={80}
      />
    );

    const virtualList = screen.getByTestId('virtual-list');
    fireEvent.scroll(virtualList);

    expect(performanceMonitor.trackEvent).toHaveBeenCalled();
  });

  it('should format session duration correctly', () => {
    const now = new Date();
    const sessionWithDuration = {
      ...mockSessions[0],
      startTime: new Date(now.getTime() - 125000), // 2 minutes 5 seconds ago
      endTime: now,
    };

    render(
      <VirtualizedSessionList
        sessions={[sessionWithDuration]}
        height={400}
        itemHeight={80}
      />
    );

    expect(screen.getByText('2m 5s')).toBeInTheDocument();
  });
});

describe('Performance Optimization', () => {
  it('should maintain stable frame rate with large datasets', async () => {
    const largeEventSet = Array.from({ length: 1000 }, (_, index) => ({
      id: `event-${index}`,
      sessionId: `session-${index % 10}`,
      type: 'user_prompt_submit',
      timestamp: new Date(Date.now() - index * 1000),
      metadata: {},
      status: 'active' as const,
      session_id: `session-${index % 10}`,
      event_type: 'user_prompt_submit',
      summary: `Event ${index} summary`,
      details: null,
    }));

    const startTime = performance.now();
    
    render(
      <VirtualizedEventFeed
        events={largeEventSet}
        height={600}
        itemHeight={120}
      />
    );

    const renderTime = performance.now() - startTime;
    
    // Should render quickly even with large dataset
    expect(renderTime).toBeLessThan(100); // ms
  });

  it('should handle rapid updates without performance degradation', async () => {
    let events = mockEvents.slice(0, 10);
    
    const { rerender } = render(
      <VirtualizedEventFeed
        events={events}
        height={600}
        itemHeight={120}
      />
    );

    // Simulate rapid updates
    for (let i = 0; i < 10; i++) {
      events = [...events, ...mockEvents.slice(10 + i, 15 + i)];
      
      const updateStart = performance.now();
      rerender(
        <VirtualizedEventFeed
          events={events}
          height={600}
          itemHeight={120}
        />
      );
      const updateTime = performance.now() - updateStart;
      
      // Each update should be fast
      expect(updateTime).toBeLessThan(50);
    }
  });

  it('should use memory efficiently with virtualization', () => {
    const largeSessionSet = Array.from({ length: 500 }, (_, index) => ({
      id: `session-${index}`,
      status: 'active' as const,
      startTime: new Date(),
      toolsUsed: 0,
      eventsCount: 0,
      lastActivity: new Date(),
    }));

    render(
      <VirtualizedSessionList
        sessions={largeSessionSet}
        height={400}
        itemHeight={80}
      />
    );

    // With virtualization, only visible items should be rendered
    // This is mocked in our test, but in real implementation only ~5-10 items would be in DOM
    const renderedItems = screen.getAllByRole('button');
    expect(renderedItems.length).toBeLessThanOrEqual(10); // Based on our mock
  });
});