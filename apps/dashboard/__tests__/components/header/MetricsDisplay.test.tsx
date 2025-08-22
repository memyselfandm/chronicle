import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, checkAccessibility, measureRenderTime } from '../../../src/test-utils/renderHelpers';
import { createMockEvents, createMockSessions } from '../../../src/test-utils/mockData';
import { PerformanceMonitor } from '../../../src/test-utils/performanceHelpers';
import { MetricsDisplay } from '../../../src/components/layout/MetricsDisplay';

describe('MetricsDisplay Component', () => {
  const mockMetrics = {
    totalSessions: 15,
    activeSessions: 8,
    totalEvents: 245,
    eventsPerMinute: 12.5,
    averageResponseTime: 850,
    errorRate: 2.1,
  };

  const defaultProps = {
    metrics: mockMetrics,
    loading: false,
    error: null,
  };

  describe('Rendering', () => {
    it('should render all metric values correctly', () => {
      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      expect(screen.getByText('15')).toBeInTheDocument(); // Total sessions
      expect(screen.getByText('8')).toBeInTheDocument(); // Active sessions
      expect(screen.getByText('245')).toBeInTheDocument(); // Total events
      expect(screen.getByText('12.5/min')).toBeInTheDocument(); // Events per minute
      expect(screen.getByText('850ms')).toBeInTheDocument(); // Response time
      expect(screen.getByText('2.1%')).toBeInTheDocument(); // Error rate
    });

    it('should show loading state correctly', () => {
      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          loading={true}
          metrics={null}
        />
      );
      
      expect(screen.getByTestId('metrics-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('skeleton-loader')).toHaveLength(6); // One for each metric
    });

    it('should display error state when metrics fail to load', () => {
      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          error="Failed to load metrics"
          metrics={null}
        />
      );
      
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    it('should handle missing metrics gracefully', () => {
      const partialMetrics = {
        totalSessions: 10,
        // Missing other metrics
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={partialMetrics}
        />
      );
      
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('--')).toBeInTheDocument(); // Fallback for missing metrics
    });
  });

  describe('Visual Indicators', () => {
    it('should show positive trend indicators for good metrics', () => {
      const goodMetrics = {
        ...mockMetrics,
        eventsPerMinute: 15.2,
        averageResponseTime: 650,
        errorRate: 0.5,
        trends: {
          eventsPerMinute: 'up',
          averageResponseTime: 'down', // Lower is better
          errorRate: 'down', // Lower is better
        },
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={goodMetrics}
        />
      );
      
      expect(screen.getAllByTestId('trend-up')).toHaveLength(1); // Events per minute
      expect(screen.getAllByTestId('trend-down')).toHaveLength(2); // Response time and error rate
    });

    it('should show warning indicators for concerning metrics', () => {
      const concerningMetrics = {
        ...mockMetrics,
        averageResponseTime: 2500, // High response time
        errorRate: 8.5, // High error rate
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={concerningMetrics}
        />
      );
      
      expect(screen.getByTestId('metric-response-time')).toHaveClass('warning');
      expect(screen.getByTestId('metric-error-rate')).toHaveClass('warning');
    });

    it('should show critical indicators for severe metrics', () => {
      const criticalMetrics = {
        ...mockMetrics,
        averageResponseTime: 5000, // Very high response time
        errorRate: 15.0, // Very high error rate
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={criticalMetrics}
        />
      );
      
      expect(screen.getByTestId('metric-response-time')).toHaveClass('critical');
      expect(screen.getByTestId('metric-error-rate')).toHaveClass('critical');
    });
  });

  describe('Real-time Updates', () => {
    it('should smoothly animate metric changes', async () => {
      const { rerender } = renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      const updatedMetrics = {
        ...mockMetrics,
        totalEvents: 250, // Increased by 5
        eventsPerMinute: 13.2,
      };

      rerender(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={updatedMetrics}
        />
      );

      // Should show animation classes during transition
      await waitFor(() => {
        expect(screen.getByTestId('metric-total-events')).toHaveClass('updating');
      });

      await waitFor(() => {
        expect(screen.getByText('250')).toBeInTheDocument();
      });
    });

    it('should handle rapid metric updates efficiently', async () => {
      const performanceMonitor = new PerformanceMonitor();
      const { rerender } = renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      performanceMonitor.startMeasurement();

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedMetrics = {
          ...mockMetrics,
          totalEvents: mockMetrics.totalEvents + i,
          eventsPerMinute: mockMetrics.eventsPerMinute + (i * 0.1),
        };

        rerender(<MetricsDisplay {...defaultProps} metrics={updatedMetrics} />);
      }

      const updateTime = performanceMonitor.endMeasurement();
      expect(updateTime).toBeLessThan(100); // Should handle updates within 100ms
    });
  });

  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const { renderTime } = await measureRenderTime(() => 
        renderWithProviders(<MetricsDisplay {...defaultProps} />)
      );
      
      expect(renderTime).toBeLessThan(50); // 50ms budget for initial render
    });

    it('should handle large metric values efficiently', () => {
      const largeMetrics = {
        totalSessions: 999999,
        activeSessions: 50000,
        totalEvents: 1000000,
        eventsPerMinute: 9999.9,
        averageResponseTime: 99999,
        errorRate: 99.99,
      };

      const start = performance.now();
      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={largeMetrics}
        />
      );
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      
      // Should format large numbers appropriately
      expect(screen.getByText('999,999')).toBeInTheDocument();
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', () => {
      const { container } = renderWithProviders(<MetricsDisplay {...defaultProps} />);
      const issues = checkAccessibility(container);
      expect(issues).toHaveLength(0);
    });

    it('should have proper ARIA labels for metrics', () => {
      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      expect(screen.getByLabelText('Total sessions: 15')).toBeInTheDocument();
      expect(screen.getByLabelText('Active sessions: 8')).toBeInTheDocument();
      expect(screen.getByLabelText('Total events: 245')).toBeInTheDocument();
      expect(screen.getByLabelText('Events per minute: 12.5')).toBeInTheDocument();
      expect(screen.getByLabelText('Average response time: 850 milliseconds')).toBeInTheDocument();
      expect(screen.getByLabelText('Error rate: 2.1 percent')).toBeInTheDocument();
    });

    it('should support screen reader announcements for metric changes', async () => {
      const { rerender } = renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      const updatedMetrics = {
        ...mockMetrics,
        totalEvents: 250,
      };

      rerender(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={updatedMetrics}
        />
      );

      // Should have aria-live region for announcements
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      const container = screen.getByTestId('metrics-display');
      expect(container).toHaveClass('mobile-layout');
    });

    it('should maintain readability on small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      // Metrics should still be visible and readable
      expect(screen.getByText('15')).toBeVisible();
      expect(screen.getByText('245')).toBeVisible();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const zeroMetrics = {
        totalSessions: 0,
        activeSessions: 0,
        totalEvents: 0,
        eventsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={zeroMetrics}
        />
      );
      
      expect(screen.getAllByText('0')).toHaveLength(4); // Four zero values
      expect(screen.getByText('0/min')).toBeInTheDocument();
      expect(screen.getByText('0ms')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle negative values gracefully', () => {
      const negativeMetrics = {
        ...mockMetrics,
        eventsPerMinute: -5.2, // Shouldn't happen but test graceful handling
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={negativeMetrics}
        />
      );
      
      // Should display as 0 or handle gracefully
      expect(screen.getByText('0/min')).toBeInTheDocument();
    });

    it('should handle very large numbers with proper formatting', () => {
      const hugeMetrics = {
        ...mockMetrics,
        totalEvents: 1234567890,
      };

      renderWithProviders(
        <MetricsDisplay 
          {...defaultProps} 
          metrics={hugeMetrics}
        />
      );
      
      // Should format large numbers appropriately (e.g., "1.23B" or "1,234,567,890")
      const formattedNumber = screen.getByTestId('metric-total-events').textContent;
      expect(formattedNumber).toMatch(/^(1\.23B|1,234,567,890)$/);
    });
  });

  describe('Tooltips and Help', () => {
    it('should show helpful tooltips on hover', async () => {
      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      const responseTimeMetric = screen.getByTestId('metric-response-time');
      
      // Simulate hover
      fireEvent.mouseEnter(responseTimeMetric);
      
      await waitFor(() => {
        expect(screen.getByText('Average time to process events')).toBeInTheDocument();
      });
    });

    it('should provide context for error rates', async () => {
      renderWithProviders(<MetricsDisplay {...defaultProps} />);
      
      const errorRateMetric = screen.getByTestId('metric-error-rate');
      
      fireEvent.mouseEnter(errorRateMetric);
      
      await waitFor(() => {
        expect(screen.getByText('Percentage of events that resulted in errors')).toBeInTheDocument();
      });
    });
  });
});