/**
 * ThroughputIndicator Component Tests
 * Tests for events per minute display with activity visualization
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThroughputIndicator, useEventThroughput } from '../src/components/layout/ThroughputIndicator';

describe('ThroughputIndicator', () => {
  beforeEach(() => {
    // Setup fake timers for each test that needs them
  });

  afterEach(() => {
    // Clean up fake timers if they were used
    if (jest.isMockFunction(setTimeout)) {
      jest.useRealTimers();
    }
  });

  it('renders throughput indicator', () => {
    render(<ThroughputIndicator eventsPerMinute={25} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    expect(indicator).toBeInTheDocument();
  });

  it('displays events per minute correctly', () => {
    render(<ThroughputIndicator eventsPerMinute={42} />);
    
    const eventsCount = screen.getByTestId('events-count');
    expect(eventsCount).toHaveTextContent('42');
    
    const minLabel = screen.getByText('/min');
    expect(minLabel).toBeInTheDocument();
  });

  it('shows idle activity level for zero events', () => {
    render(<ThroughputIndicator eventsPerMinute={0} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[title="No activity"]');
    
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-text-muted');
  });

  it('shows low activity level for 1-10 events', () => {
    render(<ThroughputIndicator eventsPerMinute={5} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[title="Low activity"]');
    
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-info');
  });

  it('shows moderate activity level for 11-50 events', () => {
    render(<ThroughputIndicator eventsPerMinute={25} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[title="Moderate activity"]');
    
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-active');
  });

  it('shows high activity level for 51-100 events', () => {
    render(<ThroughputIndicator eventsPerMinute={75} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[title="High activity"]');
    
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-awaiting');
  });

  it('shows burst activity level for 100+ events', () => {
    render(<ThroughputIndicator eventsPerMinute={150} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[title="Burst activity"]');
    
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-error');
    expect(dot).toHaveClass('animate-pulse');
  });

  it('shows peak indicator for high throughput', () => {
    render(<ThroughputIndicator eventsPerMinute={90} />);
    
    const peakIndicator = screen.getByText('⚡');
    expect(peakIndicator).toBeInTheDocument();
    
    const peakContainer = peakIndicator.closest('div');
    expect(peakContainer).toHaveAttribute('title', 'High throughput detected');
  });

  it('does not show peak indicator for normal throughput', () => {
    render(<ThroughputIndicator eventsPerMinute={50} />);
    
    const peakIndicator = screen.queryByText('⚡');
    expect(peakIndicator).not.toBeInTheDocument();
  });

  it('can hide activity level when requested', () => {
    render(<ThroughputIndicator eventsPerMinute={25} showActivityLevel={false} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    const dot = indicator.querySelector('div[class*="bg-status"]');
    
    expect(dot).not.toBeInTheDocument();
  });

  it('applies animation on value change', () => {
    jest.useFakeTimers();
    
    const { rerender } = render(<ThroughputIndicator eventsPerMinute={10} />);
    
    const eventsCount = screen.getByTestId('events-count');
    expect(eventsCount).not.toHaveClass('scale-110');
    
    // Change the value
    rerender(<ThroughputIndicator eventsPerMinute={20} />);
    
    // Should have animation class initially
    expect(eventsCount).toHaveClass('scale-110');
    
    // Fast-forward time to complete animation
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // Animation should be removed
    expect(eventsCount).not.toHaveClass('scale-110');
    
    jest.useRealTimers();
  });

  it('uses correct color for different activity levels', () => {
    const testCases = [
      { events: 0, expectedColor: 'text-text-muted' },
      { events: 5, expectedColor: 'text-status-info' },
      { events: 25, expectedColor: 'text-status-active' },
      { events: 75, expectedColor: 'text-status-awaiting' },
      { events: 150, expectedColor: 'text-status-error' }
    ];

    testCases.forEach(({ events, expectedColor }) => {
      const { unmount } = render(<ThroughputIndicator eventsPerMinute={events} />);
      
      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).toHaveClass(expectedColor);
      
      unmount();
    });
  });

  it('applies custom className', () => {
    const customClass = 'custom-throughput-class';
    render(<ThroughputIndicator eventsPerMinute={10} className={customClass} />);
    
    const indicator = screen.getByTestId('throughput-indicator');
    expect(indicator).toHaveClass(customClass);
  });

  it('uses monospace font for numbers', () => {
    render(<ThroughputIndicator eventsPerMinute={42} />);
    
    const eventsCount = screen.getByTestId('events-count');
    expect(eventsCount).toHaveClass('font-mono');
  });
});

describe('useEventThroughput', () => {
  const createMockEvent = (minutesAgo: number) => ({
    timestamp: new Date(Date.now() - (minutesAgo * 60000))
  });

  it('calculates events per minute correctly', () => {
    const events = [
      createMockEvent(0.5), // 30 seconds ago
      createMockEvent(0.8), // 48 seconds ago
      createMockEvent(1.5), // 90 seconds ago (outside window)
      createMockEvent(0.2)  // 12 seconds ago
    ];

    // Using renderHook equivalent
    let result: number;
    function TestComponent() {
      result = useEventThroughput(events, 1);
      return null;
    }
    
    render(<TestComponent />);
    
    // Should count only events within the last minute (3 events)
    expect(result!).toBe(3);
  });

  it('handles empty events array', () => {
    let result: number;
    function TestComponent() {
      result = useEventThroughput([], 1);
      return null;
    }
    
    render(<TestComponent />);
    
    expect(result!).toBe(0);
  });

  it('calculates for different time windows', () => {
    const events = [
      createMockEvent(0.5),  // 30 seconds ago
      createMockEvent(1.5),  // 90 seconds ago 
      createMockEvent(2.5),  // 150 seconds ago
      createMockEvent(3.5)   // 210 seconds ago
    ];

    let result: number;
    function TestComponent() {
      result = useEventThroughput(events, 5); // 5 minute window
      return null;
    }
    
    render(<TestComponent />);
    
    // All events should be within 5 minutes, so rate = 4 events / 5 minutes = 0.8, rounded = 1
    expect(result!).toBe(1);
  });

  it('rounds fractional results', () => {
    const events = [
      createMockEvent(0.5)  // 1 event in 2-minute window = 0.5 per minute
    ];

    let result: number;
    function TestComponent() {
      result = useEventThroughput(events, 2);
      return null;
    }
    
    render(<TestComponent />);
    
    expect(result!).toBe(1); // Should round 0.5 to 1
  });
});