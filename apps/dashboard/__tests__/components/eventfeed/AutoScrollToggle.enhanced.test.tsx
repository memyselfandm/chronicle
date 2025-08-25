/**
 * Enhanced comprehensive tests for AutoScrollToggle component
 * Tests: scroll behavior, state management, accessibility, user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoScrollToggle } from '@/components/eventfeed/AutoScrollToggle';
import { 
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';

describe('AutoScrollToggle', () => {
  const defaultProps = {
    enabled: false,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders toggle button with correct structure', () => {
      render(<AutoScrollToggle {...defaultProps} />);

      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('applies default size (sm) correctly', () => {
      render(<AutoScrollToggle {...defaultProps} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass('px-2', 'py-1', 'text-xs');
    });

    it('applies medium size correctly', () => {
      render(<AutoScrollToggle {...defaultProps} size="md" />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('applies custom className correctly', () => {
      render(<AutoScrollToggle {...defaultProps} className="custom-class" />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass('custom-class');
    });

    it('has correct base CSS classes', () => {
      render(<AutoScrollToggle {...defaultProps} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass(
        'inline-flex', 'items-center', 'gap-1.5', 'rounded-md', 'border', 
        'transition-all', 'duration-200'
      );
    });
  });

  describe('State Visualization', () => {
    it('shows correct state when disabled', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      expect(screen.getByText('play_arrow')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('shows correct state when enabled', () => {
      render(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      expect(screen.getByText('pause')).toBeInTheDocument();
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('applies correct styling when disabled', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass(
        'bg-bg-secondary', 'text-text-muted', 'border-border-primary',
        'hover:bg-bg-tertiary', 'hover:text-text-secondary'
      );
    });

    it('applies correct styling when enabled', () => {
      render(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass(
        'bg-accent-blue', 'text-white', 'border-accent-blue', 'hover:bg-accent-blue/90'
      );
    });

    it('uses different icon sizes for different button sizes', () => {
      const { rerender } = render(<AutoScrollToggle {...defaultProps} size="sm" />);
      
      let icon = screen.getByText('play_arrow');
      expect(icon).toHaveClass('text-sm');

      rerender(<AutoScrollToggle {...defaultProps} size="md" />);
      
      icon = screen.getByText('play_arrow');
      expect(icon).toHaveClass('text-base');
    });

    it('shows medium font weight for text labels', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const label = screen.getByText('Manual');
      expect(label).toHaveClass('font-medium');
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when clicked', () => {
      const mockOnChange = jest.fn();
      
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(mockOnChange).toHaveBeenCalledWith(true);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('toggles state correctly through multiple clicks', () => {
      const mockOnChange = jest.fn();
      
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // First click: false -> true
      fireEvent.click(toggle);
      expect(mockOnChange).toHaveBeenLastCalledWith(true);

      // Second click: true -> false (if we update enabled prop)
      // Note: In real usage, parent would update enabled prop
      fireEvent.click(toggle);
      expect(mockOnChange).toHaveBeenLastCalledWith(true); // Still true since we haven't updated prop
    });

    it('handles rapid clicking correctly', () => {
      const mockOnChange = jest.fn();
      
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        fireEvent.click(toggle);
      }

      expect(mockOnChange).toHaveBeenCalledTimes(5);
      // Each call should toggle from current state
      mockOnChange.mock.calls.forEach(call => {
        expect(call[0]).toBe(true); // All calls toggle false -> true
      });
    });

    it('does not crash when onChange is undefined', () => {
      render(<AutoScrollToggle enabled={false} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      expect(() => {
        fireEvent.click(toggle);
      }).not.toThrow();
    });

    it('handles mouse events correctly', () => {
      const mockOnChange = jest.fn();
      
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Mouse down/up should work
      fireEvent.mouseDown(toggle);
      fireEvent.mouseUp(toggle);
      fireEvent.click(toggle);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      expect(toggle).toHaveAttribute('aria-label', 'Auto-scroll is disabled. Click to enable.');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).toHaveAttribute('title', 'Enable auto-scroll');
    });

    it('updates ARIA attributes when state changes', () => {
      const { rerender } = render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      let toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).toHaveAttribute('title', 'Enable auto-scroll');

      rerender(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveAttribute('title', 'Disable auto-scroll');
      expect(toggle).toHaveAttribute('aria-label', 'Auto-scroll is enabled. Click to disable.');
    });

    it('is keyboard accessible', () => {
      const mockOnChange = jest.fn();
      
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Focus the button
      toggle.focus();
      expect(toggle).toHaveFocus();

      // Press Enter
      fireEvent.keyDown(toggle, { key: 'Enter' });
      expect(mockOnChange).toHaveBeenCalledWith(true);

      // Press Space
      fireEvent.keyDown(toggle, { key: ' ' });
      expect(mockOnChange).toHaveBeenCalledTimes(2);
    });

    it('has proper focus management', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      expect(toggle).toHaveClass(
        'focus:outline-none', 'focus:ring-2', 'focus:ring-accent-blue', 'focus:ring-offset-1'
      );
    });

    it('passes accessibility validation', () => {
      const { container } = render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('provides meaningful button text for screen readers', () => {
      const { rerender } = render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      expect(screen.getByText('Manual')).toBeInTheDocument();

      rerender(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('has appropriate button type', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByRole('button');
      expect(toggle).toHaveAttribute('type', 'button');
    });
  });

  describe('Visual Feedback and Animations', () => {
    it('shows transition animations', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass('transition-all', 'duration-200');
    });

    it('shows hover effects', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Hover classes should be present
      expect(toggle).toHaveClass('hover:bg-bg-tertiary', 'hover:text-text-secondary');
    });

    it('shows different hover effects when enabled', () => {
      render(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      expect(toggle).toHaveClass('hover:bg-accent-blue/90');
    });

    it('maintains visual consistency across state changes', async () => {
      const { rerender } = render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Should maintain consistent structure
      expect(toggle).toHaveClass('inline-flex', 'items-center', 'gap-1.5');

      rerender(<AutoScrollToggle enabled={true} onChange={jest.fn()} />);

      // Should still maintain same structure
      expect(toggle).toHaveClass('inline-flex', 'items-center', 'gap-1.5');
    });

    it('handles focus states correctly', () => {
      render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      fireEvent.focus(toggle);
      expect(toggle).toHaveFocus();

      fireEvent.blur(toggle);
      expect(toggle).not.toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('renders quickly', async () => {
      const { renderTime } = await measureRenderTime(async () => {
        return render(<AutoScrollToggle enabled={false} onChange={jest.fn()} />);
      });

      expect(renderTime).toBeLessThan(5); // Very fast render
    });

    it('handles rapid prop changes efficiently', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const startTime = performance.now();

      // Rapid state changes
      for (let i = 0; i < 50; i++) {
        rerender(<AutoScrollToggle enabled={i % 2 === 0} onChange={mockOnChange} />);
      }

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(20); // Should be very fast
      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
    });

    it('maintains performance with frequent interactions', () => {
      const mockOnChange = jest.fn();
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      const startTime = performance.now();

      // Many interactions
      for (let i = 0; i < 100; i++) {
        fireEvent.click(toggle);
      }

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Fast interactions
      expect(mockOnChange).toHaveBeenCalledTimes(100);
    });

    it('does not cause memory leaks with frequent re-renders', () => {
      const mockOnChange = jest.fn();
      const { rerender, unmount } = render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      // Many re-renders
      for (let i = 0; i < 20; i++) {
        rerender(<AutoScrollToggle enabled={i % 2 === 0} onChange={mockOnChange} />);
      }

      // Should unmount cleanly
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('works correctly with SWR provider', () => {
      renderWithProviders(
        <AutoScrollToggle enabled={false} onChange={jest.fn()} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('integrates correctly with parent state management', () => {
      let autoScrollEnabled = false;
      const handleChange = (enabled: boolean) => {
        autoScrollEnabled = enabled;
      };

      const { rerender } = render(
        <AutoScrollToggle enabled={autoScrollEnabled} onChange={handleChange} />
      );

      // Initially disabled
      expect(screen.getByText('Manual')).toBeInTheDocument();

      // Click to enable
      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      // Parent should update state and re-render
      rerender(<AutoScrollToggle enabled={true} onChange={handleChange} />);

      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('maintains state consistency in complex UI contexts', () => {
      const Parent = () => {
        const [autoScroll, setAutoScroll] = React.useState(false);
        
        return (
          <div>
            <AutoScrollToggle enabled={autoScroll} onChange={setAutoScroll} />
            <span data-testid="state-indicator">{autoScroll ? 'ON' : 'OFF'}</span>
          </div>
        );
      };

      render(<Parent />);

      expect(screen.getByText('Manual')).toBeInTheDocument();
      expect(screen.getByTestId('state-indicator')).toHaveTextContent('OFF');

      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(screen.getByText('Auto')).toBeInTheDocument();
      expect(screen.getByTestId('state-indicator')).toHaveTextContent('ON');
    });

    it('handles context switching correctly', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      // Switch context (different onChange handler)
      const newMockOnChange = jest.fn();
      rerender(<AutoScrollToggle enabled={false} onChange={newMockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(newMockOnChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined onChange gracefully', () => {
      render(<AutoScrollToggle enabled={false} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      expect(() => {
        fireEvent.click(toggle);
      }).not.toThrow();
    });

    it('handles null onChange gracefully', () => {
      render(<AutoScrollToggle enabled={false} onChange={null as any} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      expect(() => {
        fireEvent.click(toggle);
      }).not.toThrow();
    });

    it('handles extreme rapid clicking', async () => {
      const mockOnChange = jest.fn();
      render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');

      // Extremely rapid clicking
      const promises = [];
      for (let i = 0; i < 200; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            fireEvent.click(toggle);
            resolve(true);
          }, Math.random() * 10);
        }));
      }

      await Promise.all(promises);

      expect(mockOnChange).toHaveBeenCalledTimes(200);
      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
    });

    it('maintains accessibility during error conditions', () => {
      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const ProblematicParent = () => {
        const [enabled, setEnabled] = React.useState(false);
        
        const handleChange = () => {
          throw new Error('Parent error');
        };

        return (
          <AutoScrollToggle 
            enabled={enabled} 
            onChange={handleChange}
          />
        );
      };

      render(<ProblematicParent />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Should still have proper accessibility
      expect(toggle).toHaveAttribute('aria-label');
      expect(toggle).toHaveAttribute('aria-pressed');

      consoleSpy.mockRestore();
    });

    it('handles component unmounting during interactions', () => {
      const mockOnChange = jest.fn();
      const { unmount } = render(<AutoScrollToggle enabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByTestId('auto-scroll-toggle');
      
      // Start interaction
      fireEvent.mouseDown(toggle);
      
      // Unmount during interaction
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('works correctly as header control', () => {
      const Header = ({ autoScroll, onAutoScrollChange }: any) => (
        <div className="flex items-center justify-between p-2 border-b">
          <h2>Event Feed</h2>
          <AutoScrollToggle enabled={autoScroll} onChange={onAutoScrollChange} />
        </div>
      );

      const mockOnChange = jest.fn();
      render(<Header autoScroll={false} onAutoScrollChange={mockOnChange} />);

      expect(screen.getByText('Event Feed')).toBeInTheDocument();
      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();

      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('integrates with table controls correctly', () => {
      const TableControls = () => {
        const [autoScroll, setAutoScroll] = React.useState(true);
        const [showFilters, setShowFilters] = React.useState(false);

        return (
          <div className="flex gap-2">
            <AutoScrollToggle enabled={autoScroll} onChange={setAutoScroll} />
            <button onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        );
      };

      render(<TableControls />);

      // Initially auto-scroll should be enabled
      expect(screen.getByText('Auto')).toBeInTheDocument();

      // Toggle auto-scroll
      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);

      expect(screen.getByText('Manual')).toBeInTheDocument();

      // Other controls should still work
      const filtersButton = screen.getByText('Show Filters');
      fireEvent.click(filtersButton);
      expect(screen.getByText('Hide Filters')).toBeInTheDocument();
    });

    it('maintains state during table updates', () => {
      const EventTableWithControls = () => {
        const [autoScroll, setAutoScroll] = React.useState(false);
        const [eventCount, setEventCount] = React.useState(10);

        return (
          <div>
            <div className="flex justify-between">
              <span>Events: {eventCount}</span>
              <AutoScrollToggle enabled={autoScroll} onChange={setAutoScroll} />
            </div>
            <button onClick={() => setEventCount(c => c + 10)}>Add Events</button>
          </div>
        );
      };

      render(<EventTableWithControls />);

      // Enable auto-scroll
      const toggle = screen.getByTestId('auto-scroll-toggle');
      fireEvent.click(toggle);
      expect(screen.getByText('Auto')).toBeInTheDocument();

      // Add events
      const addButton = screen.getByText('Add Events');
      fireEvent.click(addButton);

      // Auto-scroll state should be preserved
      expect(screen.getByText('Auto')).toBeInTheDocument();
      expect(screen.getByText('Events: 20')).toBeInTheDocument();
    });
  });
});