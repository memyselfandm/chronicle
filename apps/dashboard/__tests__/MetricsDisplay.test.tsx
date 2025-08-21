/**
 * MetricsDisplay Component Tests
 * Tests for real-time metrics display in dashboard header
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import { MetricsDisplay } from '../src/components/layout/MetricsDisplay';

// Mock the dashboard store
const mockUseDashboardStore = jest.fn();
jest.mock('../src/stores/dashboardStore', () => ({
  useDashboardStore: (selector: any) => mockUseDashboardStore(selector)
}));

// Mock sub-components
jest.mock('../src/components/layout/SessionBadges', () => ({
  SessionBadges: ({ activeSessions, awaitingSessions, onClick }: any) => (
    <div data-testid="session-badges">
      <span data-testid="active-sessions">{activeSessions}</span>
      <span data-testid="awaiting-sessions">{awaitingSessions}</span>
      <button onClick={() => onClick?.('active')}>Filter Active</button>
    </div>
  )
}));

jest.mock('../src/components/layout/ThroughputIndicator', () => ({
  ThroughputIndicator: ({ eventsPerMinute }: any) => (
    <div data-testid="throughput-indicator">
      <span data-testid="events-per-minute">{eventsPerMinute}</span>
    </div>
  ),
  useEventThroughput: (events: any[], windowMinutes: number) => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (windowMinutes * 60000));
    const recentEvents = events.filter((event: any) => event.timestamp >= windowStart);
    return recentEvents.length;
  }
}));

describe('MetricsDisplay', () => {
  const mockSessions = [
    {
      id: 'session1',
      status: 'active',
      startTime: new Date(),
      toolsUsed: 5,
      eventsCount: 10,
      lastActivity: new Date()
    },
    {
      id: 'session2', 
      status: 'active',
      startTime: new Date(),
      toolsUsed: 3,
      eventsCount: 7,
      lastActivity: new Date()
    },
    {
      id: 'session3',
      status: 'awaiting',
      startTime: new Date(),
      toolsUsed: 2,
      eventsCount: 4,
      lastActivity: new Date()
    }
  ];

  const mockEvents = [
    {
      id: 'event1',
      sessionId: 'session1',
      type: 'pre_tool_use',
      timestamp: new Date(Date.now() - 30000), // 30 seconds ago
      metadata: {},
      status: 'info'
    },
    {
      id: 'event2',
      sessionId: 'session2',
      type: 'notification',
      timestamp: new Date(Date.now() - 15000), // 15 seconds ago
      metadata: {},
      status: 'awaiting'
    },
    {
      id: 'event3',
      sessionId: 'session3',
      type: 'post_tool_use',
      timestamp: new Date(Date.now() - 45000), // 45 seconds ago
      metadata: {},
      status: 'active'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default store mock
    mockUseDashboardStore.mockImplementation((selector) => {
      const state = {
        sessions: mockSessions,
        events: mockEvents,
        realtime: {
          connectionStatus: 'connected'
        }
      };
      return selector(state);
    });
  });

  it('renders the metrics display component', () => {
    render(<MetricsDisplay />);
    
    const metricsDisplay = screen.getByTestId('metrics-display');
    expect(metricsDisplay).toBeInTheDocument();
  });

  it('calculates session counts correctly', () => {
    render(<MetricsDisplay />);
    
    // Should show 1 active session (session1) and 2 awaiting (session2 has notification, session3 is awaiting)
    const activeSessions = screen.getByTestId('active-sessions');
    const awaitingSessions = screen.getByTestId('awaiting-sessions');
    
    expect(activeSessions).toHaveTextContent('1');
    expect(awaitingSessions).toHaveTextContent('2');
  });

  it('calculates events per minute correctly', () => {
    render(<MetricsDisplay />);
    
    const eventsPerMinute = screen.getByTestId('events-per-minute');
    // All 3 events are within the last minute
    expect(eventsPerMinute).toHaveTextContent('3');
  });

  it('includes session badges component', () => {
    render(<MetricsDisplay />);
    
    const sessionBadges = screen.getByTestId('session-badges');
    expect(sessionBadges).toBeInTheDocument();
  });

  it('includes throughput indicator component', () => {
    render(<MetricsDisplay />);
    
    const throughputIndicator = screen.getByTestId('throughput-indicator');
    expect(throughputIndicator).toBeInTheDocument();
  });

  it('shows offline indicator when disconnected', () => {
    mockUseDashboardStore.mockImplementation((selector) => {
      const state = {
        sessions: mockSessions,
        events: mockEvents,
        realtime: {
          connectionStatus: 'disconnected'
        }
      };
      return selector(state);
    });

    render(<MetricsDisplay />);
    
    expect(screen.getByText('(Offline)')).toBeInTheDocument();
  });

  it('does not show offline indicator when connected', () => {
    render(<MetricsDisplay />);
    
    expect(screen.queryByText('(Offline)')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-metrics-class';
    render(<MetricsDisplay className={customClass} />);
    
    const metricsDisplay = screen.getByTestId('metrics-display');
    expect(metricsDisplay).toHaveClass(customClass);
  });

  it('detects sessions awaiting input from notification events', () => {
    // Create a scenario where a session has a notification as last event
    const sessionWithNotification = [
      {
        id: 'session1',
        status: 'active',
        startTime: new Date(),
        toolsUsed: 5,
        eventsCount: 10,
        lastActivity: new Date()
      }
    ];

    const notificationEvent = [
      {
        id: 'event1',
        sessionId: 'session1',
        type: 'notification',
        timestamp: new Date(),
        metadata: {},
        status: 'awaiting'
      }
    ];

    mockUseDashboardStore.mockImplementation((selector) => {
      const state = {
        sessions: sessionWithNotification,
        events: notificationEvent,
        realtime: {
          connectionStatus: 'connected'
        }
      };
      return selector(state);
    });

    render(<MetricsDisplay />);
    
    const activeSessions = screen.getByTestId('active-sessions');
    const awaitingSessions = screen.getByTestId('awaiting-sessions');
    
    expect(activeSessions).toHaveTextContent('0');
    expect(awaitingSessions).toHaveTextContent('1');
  });

  it('handles empty sessions and events', () => {
    mockUseDashboardStore.mockImplementation((selector) => {
      const state = {
        sessions: [],
        events: [],
        realtime: {
          connectionStatus: 'connected'
        }
      };
      return selector(state);
    });

    render(<MetricsDisplay />);
    
    const activeSessions = screen.getByTestId('active-sessions');
    const awaitingSessions = screen.getByTestId('awaiting-sessions');
    const eventsPerMinute = screen.getByTestId('events-per-minute');
    
    expect(activeSessions).toHaveTextContent('0');
    expect(awaitingSessions).toHaveTextContent('0');
    expect(eventsPerMinute).toHaveTextContent('0');
  });
});