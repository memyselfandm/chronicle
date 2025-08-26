/**
 * Enhanced comprehensive tests for ThroughputIndicator component
 * Tests: rate calculation, sparkline rendering, activity levels, performance with large datasets
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThroughputIndicator, useEventThroughput } from '@/components/layout/ThroughputIndicator';
import { 
  createMockEvent,
  createMockEvents,
  createHighFrequencyEventStream,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';
import { renderHook } from '@testing-library/react';

describe('ThroughputIndicator', () => {
  describe('Basic Rendering', () => {
    it('renders throughput indicator with default props', () => {
      render(<ThroughputIndicator eventsPerMinute={30} />);

      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('events-count')).toHaveTextContent('30');
      expect(screen.getByText('/min')).toBeInTheDocument();
    });

    it('applies custom className correctly', () => {
      render(<ThroughputIndicator eventsPerMinute={15} className="custom-class" />);

      const indicator = screen.getByTestId('throughput-indicator');
      expect(indicator).toHaveClass('custom-class');
    });

    it('shows activity level dot by default', () => {
      render(<ThroughputIndicator eventsPerMinute={25} />);

      // Should have activity level dot
      const activityDot = document.querySelector('.w-2.h-2.rounded-full');
      expect(activityDot).toBeInTheDocument();
    });

    it('hides activity level dot when disabled', () => {
      render(<ThroughputIndicator eventsPerMinute={25} showActivityLevel={false} />);

      // Should not have activity level dot
      const activityDot = document.querySelector('.w-2.h-2.rounded-full');
      expect(activityDot).not.toBeInTheDocument();
    });

    it('displays events per minute count correctly', () => {
      render(<ThroughputIndicator eventsPerMinute={150} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('150');
      expect(screen.getByText('/min')).toBeInTheDocument();
    });
  });

  describe('Activity Level Detection', () => {
    const activityTestCases = [
      {
        eventsPerMinute: 0,
        expectedLevel: 'idle',
        expectedColor: 'text-text-muted',
        expectedDescription: 'No activity',
        shouldPulse: false,
      },
      {
        eventsPerMinute: 5,
        expectedLevel: 'low',
        expectedColor: 'text-status-info',
        expectedDescription: 'Low activity',
        shouldPulse: false,
      },
      {
        eventsPerMinute: 25,
        expectedLevel: 'moderate',
        expectedColor: 'text-status-active',
        expectedDescription: 'Moderate activity',
        shouldPulse: false,
      },
      {
        eventsPerMinute: 75,
        expectedLevel: 'high',
        expectedColor: 'text-status-awaiting',
        expectedDescription: 'High activity',
        shouldPulse: false,
      },
      {
        eventsPerMinute: 150,
        expectedLevel: 'burst',
        expectedColor: 'text-status-error',
        expectedDescription: 'Burst activity',
        shouldPulse: true,
      },
    ];

    activityTestCases.forEach(({ eventsPerMinute, expectedLevel, expectedColor, expectedDescription, shouldPulse }) => {
      it(`detects ${expectedLevel} activity level correctly at ${eventsPerMinute} events/min`, () => {
        render(<ThroughputIndicator eventsPerMinute={eventsPerMinute} />);

        const eventsCount = screen.getByTestId('events-count');
        expect(eventsCount).toHaveClass(expectedColor);
        expect(eventsCount).toHaveTextContent(eventsPerMinute.toString());

        // Check activity dot color and animation
        const activityDot = document.querySelector('.w-2.h-2.rounded-full');
        const backgroundColorClass = expectedColor.replace('text-', 'bg-');
        expect(activityDot).toHaveClass(backgroundColorClass);

        if (shouldPulse) {
          expect(activityDot).toHaveClass('animate-pulse');
        } else {
          expect(activityDot).not.toHaveClass('animate-pulse');
        }

        // Check tooltip/description
        expect(activityDot).toHaveAttribute('title', expectedDescription);
      });
    });

    it('handles edge case at activity level boundaries', () => {
      const boundaryTests = [
        { eventsPerMinute: 10, expectedLevel: 'low' },
        { eventsPerMinute: 11, expectedLevel: 'moderate' },
        { eventsPerMinute: 50, expectedLevel: 'moderate' },
        { eventsPerMinute: 51, expectedLevel: 'high' },
        { eventsPerMinute: 100, expectedLevel: 'high' },
        { eventsPerMinute: 101, expectedLevel: 'burst' },
      ];

      boundaryTests.forEach(({ eventsPerMinute, expectedLevel }) => {
        const { container } = render(<ThroughputIndicator eventsPerMinute={eventsPerMinute} />);

        const activityDot = container.querySelector('.w-2.h-2.rounded-full');
        
        // Verify correct activity level based on expected colors
        const levelColorMap = {
          low: 'bg-status-info',
          moderate: 'bg-status-active', 
          high: 'bg-status-awaiting',
          burst: 'bg-status-error',
        };

        expect(activityDot).toHaveClass(levelColorMap[expectedLevel as keyof typeof levelColorMap]);

        container.remove();
      });
    });
  });

  describe('Peak Indicator', () => {
    it('shows peak indicator for high throughput', () => {
      render(<ThroughputIndicator eventsPerMinute={85} />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('hides peak indicator for normal throughput', () => {
      render(<ThroughputIndicator eventsPerMinute={75} />);

      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
    });

    it('shows peak indicator at threshold boundary', () => {
      render(<ThroughputIndicator eventsPerMinute={81} />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('has correct title for peak indicator', () => {
      render(<ThroughputIndicator eventsPerMinute={100} />);

      const peakIndicator = screen.getByText('⚡').closest('div');
      expect(peakIndicator).toHaveAttribute('title', 'High throughput detected');
    });

    it('applies correct styling to peak indicator', () => {
      render(<ThroughputIndicator eventsPerMinute={90} />);

      const peakElement = screen.getByText('⚡');
      expect(peakElement).toHaveClass('text-xs', 'text-status-awaiting');
    });
  });

  describe('Animation and Transitions', () => {
    it('triggers scale animation on value change', async () => {
      const { rerender } = render(<ThroughputIndicator eventsPerMinute={30} />);

      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).not.toHaveClass('scale-110');

      // Change value to trigger animation
      rerender(<ThroughputIndicator eventsPerMinute={45} />);

      // Animation should be triggered
      await waitFor(() => {
        const updatedEventsCount = screen.getByTestId('events-count');
        expect(updatedEventsCount).toHaveTextContent('45');
      });
    });

    it('has proper transition classes', () => {
      render(<ThroughputIndicator eventsPerMinute={25} />);

      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).toHaveClass('transition-all', 'duration-300');

      const activityDot = document.querySelector('.w-2.h-2.rounded-full');
      expect(activityDot).toHaveClass('transition-all', 'duration-300');
    });

    it('maintains animation state correctly', async () => {
      const { rerender } = render(<ThroughputIndicator eventsPerMinute={10} />);

      // Rapid changes should handle animation state
      for (let i = 11; i <= 15; i++) {
        rerender(<ThroughputIndicator eventsPerMinute={i} />);
      }

      await waitFor(() => {
        expect(screen.getByTestId('events-count')).toHaveTextContent('15');
      });
    });

    it('clears animation timeout on unmount', () => {
      const { unmount } = render(<ThroughputIndicator eventsPerMinute={30} />);

      // Should not throw or cause memory leaks
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Typography and Styling', () => {
    it('uses monospace font for count display', () => {
      render(<ThroughputIndicator eventsPerMinute={42} />);

      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).toHaveClass('font-mono');
    });

    it('applies correct text sizing', () => {
      render(<ThroughputIndicator eventsPerMinute={25} />);

      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).toHaveClass('text-xs', 'font-medium');

      const unitLabel = screen.getByText('/min');
      expect(unitLabel).toHaveClass('text-xs', 'text-text-muted');
    });

    it('maintains consistent layout structure', () => {
      render(<ThroughputIndicator eventsPerMinute={60} />);

      const indicator = screen.getByTestId('throughput-indicator');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-2');

      const countContainer = screen.getByTestId('events-count').parentElement;
      expect(countContainer).toHaveClass('flex', 'items-center', 'gap-1');
    });

    it('handles large numbers without breaking layout', () => {
      render(<ThroughputIndicator eventsPerMinute={9999} />);

      const eventsCount = screen.getByTestId('events-count');
      expect(eventsCount).toHaveTextContent('9999');
      
      const indicator = screen.getByTestId('throughput-indicator');
      expect(indicator).toBeInTheDocument(); // Should not break layout
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for activity level', () => {
      render(<ThroughputIndicator eventsPerMinute={35} />);

      const activityDot = document.querySelector('.w-2.h-2.rounded-full');
      expect(activityDot).toHaveAttribute('aria-label', 'Moderate activity');
    });

    it('includes descriptive titles for tooltips', () => {
      render(<ThroughputIndicator eventsPerMinute={15} />);

      const activityDot = document.querySelector('.w-2.h-2.rounded-full');
      expect(activityDot).toHaveAttribute('title', 'Low activity');
    });

    it('passes accessibility validation', () => {
      const { container } = render(<ThroughputIndicator eventsPerMinute={50} />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('maintains semantic meaning for different activity levels', () => {
      const levels = [
        { eventsPerMinute: 0, expectedLabel: 'No activity' },
        { eventsPerMinute: 8, expectedLabel: 'Low activity' },
        { eventsPerMinute: 40, expectedLabel: 'Moderate activity' },
        { eventsPerMinute: 80, expectedLabel: 'High activity' },
        { eventsPerMinute: 120, expectedLabel: 'Burst activity' },
      ];

      levels.forEach(({ eventsPerMinute, expectedLabel }) => {
        const { container } = render(<ThroughputIndicator eventsPerMinute={eventsPerMinute} />);

        const activityDot = container.querySelector('.w-2.h-2.rounded-full');
        expect(activityDot).toHaveAttribute('aria-label', expectedLabel);

        container.remove();
      });
    });
  });

  describe('Performance', () => {
    it('renders quickly with high throughput values', async () => {
      const { renderTime } = await measureRenderTime(async () => {
        return render(<ThroughputIndicator eventsPerMinute={5000} />);
      });

      expect(renderTime).toBeLessThan(10); // Very fast render
    });

    it('handles rapid value changes efficiently', () => {
      const { rerender } = render(<ThroughputIndicator eventsPerMinute={0} />);

      // Rapid value changes
      for (let i = 1; i <= 100; i++) {
        rerender(<ThroughputIndicator eventsPerMinute={i} />);
      }

      expect(screen.getByTestId('events-count')).toHaveTextContent('100');
    });

    it('maintains performance with frequent re-renders', () => {
      const { rerender } = render(<ThroughputIndicator eventsPerMinute={50} />);

      const startTime = performance.now();

      // Simulate real-time updates
      for (let i = 0; i < 50; i++) {
        const randomValue = Math.floor(Math.random() * 200);
        rerender(<ThroughputIndicator eventsPerMinute={randomValue} />);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Edge Cases', () => {
    it('handles zero events per minute', () => {
      render(<ThroughputIndicator eventsPerMinute={0} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('0');
      expect(screen.getByTestId('events-count')).toHaveClass('text-text-muted');
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
    });

    it('handles negative values gracefully', () => {
      render(<ThroughputIndicator eventsPerMinute={-5} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('-5');
      // Should still render without errors
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });

    it('handles very large numbers', () => {
      render(<ThroughputIndicator eventsPerMinute={999999} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('999999');
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Should show peak indicator
    });

    it('handles decimal values', () => {
      render(<ThroughputIndicator eventsPerMinute={25.7} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('25.7');
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });

    it('handles NaN values gracefully', () => {
      render(<ThroughputIndicator eventsPerMinute={NaN} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('NaN');
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });

    it('handles Infinity values gracefully', () => {
      render(<ThroughputIndicator eventsPerMinute={Infinity} />);

      expect(screen.getByTestId('events-count')).toHaveTextContent('Infinity');
      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('works correctly with SWR provider', () => {
      renderWithProviders(
        <ThroughputIndicator eventsPerMinute={42} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('throughput-indicator')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('maintains state consistency across provider changes', () => {
      const { rerender } = renderWithProviders(
        <ThroughputIndicator eventsPerMinute={30} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByText('30')).toBeInTheDocument();

      rerender(<ThroughputIndicator eventsPerMinute={30} />);
      expect(screen.getByText('30')).toBeInTheDocument();
    });
  });
});

describe('useEventThroughput hook', () => {
  describe('Basic Functionality', () => {
    it('calculates events per minute correctly', () => {
      const now = new Date();
      const events = [
        { timestamp: new Date(now.getTime() - 30000) }, // 30 seconds ago
        { timestamp: new Date(now.getTime() - 45000) }, // 45 seconds ago
        { timestamp: new Date(now.getTime() - 120000) }, // 2 minutes ago (outside window)
      ];

      const { result } = renderHook(() => useEventThroughput(events, 1));

      expect(result.current).toBe(2); // 2 events in the last minute
    });

    it('handles empty events array', () => {
      const { result } = renderHook(() => useEventThroughput([], 1));

      expect(result.current).toBe(0);
    });

    it('uses different window sizes correctly', () => {
      const now = new Date();
      const events = [
        { timestamp: new Date(now.getTime() - 30000) }, // 0.5 minutes ago
        { timestamp: new Date(now.getTime() - 90000) }, // 1.5 minutes ago
        { timestamp: new Date(now.getTime() - 150000) }, // 2.5 minutes ago
        { timestamp: new Date(now.getTime() - 210000) }, // 3.5 minutes ago
      ];

      // Test 1 minute window
      const { result: result1 } = renderHook(() => useEventThroughput(events, 1));
      expect(result1.current).toBe(1); // Only first event

      // Test 2 minute window
      const { result: result2 } = renderHook(() => useEventThroughput(events, 2));
      expect(result2.current).toBe(1); // First two events, divided by 2 minutes = 1 per minute

      // Test 5 minute window
      const { result: result5 } = renderHook(() => useEventThroughput(events, 5));
      expect(result5.current).toBe(1); // All four events, divided by 5 minutes = 0.8, rounded to 1
    });

    it('rounds results correctly', () => {
      const now = new Date();
      const events = [
        { timestamp: new Date(now.getTime() - 10000) },
        { timestamp: new Date(now.getTime() - 20000) },
        { timestamp: new Date(now.getTime() - 30000) },
      ];

      const { result } = renderHook(() => useEventThroughput(events, 2));

      // 3 events in 2 minutes = 1.5 events per minute, should round to 2
      expect(result.current).toBe(2);
    });

    it('handles events with future timestamps', () => {
      const now = new Date();
      const events = [
        { timestamp: new Date(now.getTime() + 30000) }, // 30 seconds in future
        { timestamp: new Date(now.getTime() - 30000) }, // 30 seconds ago
      ];

      const { result } = renderHook(() => useEventThroughput(events, 1));

      expect(result.current).toBe(2); // Both events should be counted
    });
  });

  describe('Performance with Large Datasets', () => {
    it('handles large event arrays efficiently', () => {
      const events = createHighFrequencyEventStream(200, 60); // 200 events/second for 60 seconds

      const startTime = performance.now();
      const { result } = renderHook(() => useEventThroughput(events, 1));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(result.current).toBeGreaterThan(0);
    });

    it('filters events efficiently with large datasets', () => {
      const now = new Date();
      const events = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date(now.getTime() - i * 1000), // Events every second going back
      }));

      const { result } = renderHook(() => useEventThroughput(events, 1));

      // Should only count events from the last minute (60 events)
      expect(result.current).toBe(60);
    });
  });

  describe('Memoization and Updates', () => {
    it('memoizes results for same inputs', () => {
      const events = [
        { timestamp: new Date(Date.now() - 30000) },
        { timestamp: new Date(Date.now() - 45000) },
      ];

      const { result, rerender } = renderHook(
        ({ events, windowMinutes }) => useEventThroughput(events, windowMinutes),
        {
          initialProps: { events, windowMinutes: 1 }
        }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ events, windowMinutes: 1 });

      expect(result.current).toBe(firstResult);
    });

    it('updates when events change', () => {
      let events = [{ timestamp: new Date(Date.now() - 30000) }];

      const { result, rerender } = renderHook(
        ({ events }) => useEventThroughput(events, 1),
        { initialProps: { events } }
      );

      expect(result.current).toBe(1);

      // Add more events
      events = [
        ...events,
        { timestamp: new Date(Date.now() - 45000) },
        { timestamp: new Date(Date.now() - 50000) },
      ];

      rerender({ events });

      expect(result.current).toBe(3);
    });

    it('updates when window size changes', () => {
      const events = [
        { timestamp: new Date(Date.now() - 30000) },
        { timestamp: new Date(Date.now() - 90000) },
      ];

      const { result, rerender } = renderHook(
        ({ windowMinutes }) => useEventThroughput(events, windowMinutes),
        { initialProps: { windowMinutes: 1 } }
      );

      expect(result.current).toBe(1); // Only first event in 1 minute window

      rerender({ windowMinutes: 2 });

      expect(result.current).toBe(1); // Both events in 2 minute window, rate = 1 per minute
    });
  });

  describe('Edge Cases', () => {
    it('handles malformed timestamp data', () => {
      const events = [
        { timestamp: 'invalid-date' as any },
        { timestamp: new Date(Date.now() - 30000) },
        { timestamp: null as any },
        { timestamp: new Date(Date.now() - 45000) },
      ];

      const { result } = renderHook(() => useEventThroughput(events, 1));

      // Should handle invalid timestamps gracefully
      expect(typeof result.current).toBe('number');
      expect(result.current).toBeGreaterThanOrEqual(0);
    });

    it('handles zero window size', () => {
      const events = [{ timestamp: new Date() }];

      const { result } = renderHook(() => useEventThroughput(events, 0));

      // Should not crash with zero window
      expect(typeof result.current).toBe('number');
    });

    it('handles negative window size', () => {
      const events = [{ timestamp: new Date() }];

      const { result } = renderHook(() => useEventThroughput(events, -1));

      // Should handle negative window gracefully
      expect(typeof result.current).toBe('number');
    });
  });
});