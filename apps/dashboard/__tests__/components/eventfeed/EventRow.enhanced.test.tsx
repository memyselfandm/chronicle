/**
 * Enhanced comprehensive tests for EventRow component
 * Tests: color coding, event formatting, sub-agent detection, performance with large datasets
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EventRow } from '@/components/eventfeed/EventRow';
import { 
  createMockEvent,
  createMockSession,
  createMockEventsByType,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';

describe('EventRow', () => {
  const defaultProps = {
    event: createMockEvent(),
    index: 0,
  };

  describe('Basic Rendering', () => {
    it('renders event row with correct structure', () => {
      render(<EventRow {...defaultProps} />);

      expect(screen.getByTestId('event-row-v2')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-v2')).toHaveAttribute('data-event-type', defaultProps.event.event_type);
    });

    it('applies correct CSS classes for layout', () => {
      render(<EventRow {...defaultProps} />);

      const eventRow = screen.getByTestId('event-row-v2');
      
      // Grid layout classes
      expect(eventRow).toHaveClass('grid', 'grid-cols-[85px_36px_160px_280px_1fr]', 'gap-2', 'items-center');
      
      // Height and spacing
      expect(eventRow).toHaveClass('h-[22px]', 'min-h-[22px]', 'max-h-[22px]');
      expect(eventRow).toHaveClass('py-[3px]', 'px-4');
      
      // Typography
      expect(eventRow).toHaveClass('text-xs', 'leading-tight');
    });

    it('applies correct border color based on event type', () => {
      const event = createMockEventsByType.user_prompt_submit();
      
      render(<EventRow {...defaultProps} event={event} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('border-l-[3px]', 'border-l-[#8b5cf6]');
    });

    it('passes style prop correctly for react-window positioning', () => {
      const style = { top: 44, height: 22 };
      
      render(<EventRow {...defaultProps} style={style} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveStyle('top: 44px');
      expect(eventRow).toHaveStyle('height: 22px');
    });

    it('displays all column data correctly', () => {
      const event = createMockEventsByType.user_prompt_submit({
        timestamp: '2024-01-15T14:30:45.123Z',
        tool_name: 'TestTool',
      });
      const session = createMockSession();

      render(<EventRow {...defaultProps} event={event} session={session} />);

      // Time column should be formatted as HH:mm:ss
      expect(screen.getByText('14:30:45')).toBeInTheDocument();
      
      // Event type column
      expect(screen.getByText('user prompt submit (TestTool)')).toBeInTheDocument();
      
      // Session column
      expect(screen.getByText(/\//)).toBeInTheDocument(); // folder/branch format
      
      // Details column should show user prompt
      expect(screen.getByText('User prompt submitted')).toBeInTheDocument();
    });
  });

  describe('Event Type Color Coding', () => {
    const colorTestCases = [
      {
        eventType: 'user_prompt_submit',
        expectedBorder: 'border-l-[#8b5cf6]',
        expectedBackground: 'rgba(139, 92, 246, 0.08)',
        expectedIcon: 'chat',
      },
      {
        eventType: 'pre_tool_use',
        expectedBorder: 'border-l-[#3b82f6]',
        expectedBackground: 'rgba(59, 130, 246, 0.08)',
        expectedIcon: 'build',
      },
      {
        eventType: 'post_tool_use',
        expectedBorder: 'border-l-[#4ade80]',
        expectedBackground: 'rgba(74, 222, 128, 0.08)',
        expectedIcon: 'check_circle',
      },
      {
        eventType: 'notification',
        expectedBorder: 'border-l-[#fbbf24]',
        expectedBackground: 'rgba(251, 191, 36, 0.08)',
        expectedIcon: 'notification_important',
      },
      {
        eventType: 'error',
        expectedBorder: 'border-l-[#ef4444]',
        expectedBackground: 'rgba(239, 68, 68, 0.08)',
        expectedIcon: 'error',
      },
      {
        eventType: 'session_start',
        expectedBorder: 'border-l-[#6b7280]',
        expectedBackground: 'rgba(107, 114, 128, 0.08)',
        expectedIcon: 'play_circle',
      },
      {
        eventType: 'stop',
        expectedBorder: 'border-l-[#6b7280]',
        expectedBackground: 'rgba(107, 114, 128, 0.08)',
        expectedIcon: 'stop',
      },
    ];

    colorTestCases.forEach(({ eventType, expectedBorder, expectedBackground, expectedIcon }) => {
      it(`applies correct color coding for ${eventType}`, () => {
        const event = { ...createMockEvent(), event_type: eventType };
        
        render(<EventRow {...defaultProps} event={event} />);

        const eventRow = screen.getByTestId('event-row-v2');
        
        // Check border color
        expect(eventRow).toHaveClass(expectedBorder);
        
        // Check background color (applied via style)
        expect(eventRow).toHaveStyle(`backgroundColor: ${expectedBackground}`);
        
        // Check icon
        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
      });
    });

    it('handles unknown event types gracefully', () => {
      const event = { ...createMockEvent(), event_type: 'unknown_event_type' };
      
      render(<EventRow {...defaultProps} event={event} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('border-l-[#6b7280]'); // Default gray border
      expect(screen.getByText('radio_button_unchecked')).toBeInTheDocument(); // Default icon
    });

    it('maintains visual consistency across different event types', () => {
      const events = [
        { ...createMockEvent(), event_type: 'user_prompt_submit' },
        { ...createMockEvent(), event_type: 'error' },
        { ...createMockEvent(), event_type: 'notification' },
      ];

      events.forEach((event, index) => {
        const { container } = render(<EventRow {...defaultProps} event={event} />);
        
        const eventRow = container.querySelector('[data-testid="event-row-v2"]');
        
        // All should maintain same height
        expect(eventRow).toHaveClass('h-[22px]');
        
        // All should have border
        expect(eventRow).toHaveClass('border-l-[3px]');
        
        container.remove();
      });
    });
  });

  describe('Sub-agent Event Handling', () => {
    it('detects sub-agent events correctly', () => {
      const subAgentEvent = {
        ...createMockEvent(),
        tool_name: 'Task',
        event_type: 'pre_tool_use',
      };

      render(<EventRow {...defaultProps} event={subAgentEvent} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('pl-8'); // Sub-agent indentation
    });

    it('detects sub-agent from metadata', () => {
      const subAgentEvent = {
        ...createMockEvent(),
        metadata: { is_subagent: true },
        event_type: 'notification',
      };

      render(<EventRow {...defaultProps} event={subAgentEvent} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('pl-8');
    });

    it('detects subagent_stop events correctly', () => {
      const subAgentStopEvent = {
        ...createMockEvent(),
        event_type: 'subagent_stop',
      };

      render(<EventRow {...defaultProps} event={subAgentStopEvent} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('pl-8');
      expect(screen.getByText('Sub-agent completed')).toBeInTheDocument();
    });

    it('applies regular padding for non-sub-agent events', () => {
      const regularEvent = {
        ...createMockEvent(),
        event_type: 'user_prompt_submit',
      };

      render(<EventRow {...defaultProps} event={regularEvent} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('px-4');
      expect(eventRow).not.toHaveClass('pl-8');
    });
  });

  describe('Time Formatting', () => {
    it('formats timestamps correctly as UTC HH:mm:ss', () => {
      const event = {
        ...createMockEvent(),
        timestamp: '2024-01-15T09:15:30.456Z',
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('09:15:30')).toBeInTheDocument();
    });

    it('handles different time zones consistently', () => {
      const timestamps = [
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T12:30:45.123Z',
        '2024-01-15T23:59:59.999Z',
      ];

      timestamps.forEach((timestamp, index) => {
        const event = { ...createMockEvent(), timestamp };
        const { container } = render(<EventRow {...defaultProps} event={event} />);

        const timeElement = container.querySelector('.font-mono');
        expect(timeElement).toBeInTheDocument();
        expect(timeElement?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);

        container.remove();
      });
    });

    it('handles invalid timestamps gracefully', () => {
      const event = {
        ...createMockEvent(),
        timestamp: 'invalid-timestamp',
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('--:--:--')).toBeInTheDocument();
    });

    it('uses 11px font for time display', () => {
      const event = {
        ...createMockEvent(),
        timestamp: '2024-01-15T14:30:45.123Z',
      };

      render(<EventRow {...defaultProps} event={event} />);

      const timeElement = screen.getByText('14:30:45');
      expect(timeElement).toHaveStyle('fontSize: 11px');
      expect(timeElement).toHaveClass('font-mono', 'text-text-muted');
    });
  });

  describe('Session Display Formatting', () => {
    it('formats session display as folder/branch', () => {
      const session = {
        ...createMockSession(),
        project_path: '/Users/test/my-project',
        git_branch: 'feature-branch',
      };

      render(<EventRow {...defaultProps} session={session} />);

      expect(screen.getByText('my-project/feature-branch')).toBeInTheDocument();
    });

    it('handles missing project path gracefully', () => {
      const session = {
        ...createMockSession(),
        project_path: null,
        git_branch: 'main',
      };

      render(<EventRow {...defaultProps} session={session} />);

      expect(screen.getByText('unknown/main')).toBeInTheDocument();
    });

    it('handles no git branch correctly', () => {
      const session = {
        ...createMockSession(),
        project_path: '/Users/test/project',
        git_branch: 'no git',
      };

      render(<EventRow {...defaultProps} session={session} />);

      expect(screen.getByText('project/main')).toBeInTheDocument();
    });

    it('shows Unknown for missing session', () => {
      render(<EventRow {...defaultProps} session={undefined} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('provides tooltip with full session display', () => {
      const session = {
        ...createMockSession(),
        project_path: '/Users/test/very-long-project-name',
        git_branch: 'very-long-feature-branch-name',
      };

      render(<EventRow {...defaultProps} session={session} />);

      const sessionColumn = screen.getByText('very-long-project-name/very-long-feature-branch-name');
      expect(sessionColumn).toHaveAttribute('title', 'very-long-project-name/very-long-feature-branch-name');
    });
  });

  describe('Event Details Formatting', () => {
    it('formats user prompt submit details correctly', () => {
      const event = createMockEventsByType.user_prompt_submit({
        metadata: { prompt: 'Please help me with this task' },
      });

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('Please help me with this task')).toBeInTheDocument();
    });

    it('formats pre_tool_use details correctly', () => {
      const event = createMockEventsByType.pre_tool_use({
        tool_name: 'WriteFile',
      });

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('Starting WriteFile')).toBeInTheDocument();
    });

    it('formats post_tool_use details with success status', () => {
      const successEvent = createMockEventsByType.post_tool_use({
        tool_name: 'ReadFile',
        metadata: { 
          tool_response: { success: true }
        },
      });

      render(<EventRow {...defaultProps} event={successEvent} />);

      expect(screen.getByText('ReadFile completed successfully')).toBeInTheDocument();
    });

    it('formats post_tool_use details with failure status', () => {
      const failureEvent = createMockEventsByType.post_tool_use({
        tool_name: 'WriteFile',
        metadata: { 
          tool_response: { success: false }
        },
      });

      render(<EventRow {...defaultProps} event={failureEvent} />);

      expect(screen.getByText('WriteFile failed')).toBeInTheDocument();
    });

    it('formats notification details correctly', () => {
      const event = createMockEventsByType.notification({
        metadata: { message: 'File operation completed successfully' },
      });

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('File operation completed successfully')).toBeInTheDocument();
    });

    it('formats error details correctly', () => {
      const event = createMockEventsByType.error({
        metadata: { error_message: 'File not found: config.json' },
      });

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('File not found: config.json')).toBeInTheDocument();
    });

    it('provides fallback details for missing metadata', () => {
      const testCases = [
        { event_type: 'user_prompt_submit', expected: 'User prompt submitted' },
        { event_type: 'notification', expected: 'Notification' },
        { event_type: 'error', expected: 'Error occurred' },
        { event_type: 'stop', expected: 'Session stopped' },
        { event_type: 'session_start', expected: 'Session started' },
      ];

      testCases.forEach(({ event_type, expected }) => {
        const event = { ...createMockEvent(), event_type, metadata: {} };
        const { container } = render(<EventRow {...defaultProps} event={event} />);

        expect(screen.getByText(expected)).toBeInTheDocument();

        container.remove();
      });
    });

    it('handles complex tool metadata correctly', () => {
      const event = {
        ...createMockEvent(),
        event_type: 'pre_tool_use',
        metadata: {
          tool_input: { tool_name: 'ComplexTool' }
        },
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('Starting ComplexTool')).toBeInTheDocument();
    });
  });

  describe('Duration Display', () => {
    it('displays duration in milliseconds for short operations', () => {
      const event = {
        ...createMockEvent(),
        duration_ms: 250,
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('250ms')).toBeInTheDocument();
    });

    it('displays duration in seconds for longer operations', () => {
      const event = {
        ...createMockEvent(),
        duration_ms: 2500,
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('2.50s')).toBeInTheDocument();
    });

    it('handles very long durations correctly', () => {
      const event = {
        ...createMockEvent(),
        duration_ms: 125000, // 125 seconds
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('125.00s')).toBeInTheDocument();
    });

    it('does not display duration when not available', () => {
      const event = {
        ...createMockEvent(),
        duration_ms: undefined,
      };

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.queryByText(/ms/)).not.toBeInTheDocument();
      expect(screen.queryByText(/s$/)).not.toBeInTheDocument();
    });

    it('uses correct styling for duration display', () => {
      const event = {
        ...createMockEvent(),
        duration_ms: 1500,
      };

      render(<EventRow {...defaultProps} event={event} />);

      const durationElement = screen.getByText('1.50s');
      expect(durationElement).toHaveClass('text-text-muted');
      expect(durationElement).toHaveStyle('fontSize: 11px');
    });
  });

  describe('Icon Display', () => {
    it('uses correct Material Icons for different event types', () => {
      const iconTestCases = [
        { eventType: 'session_start', expectedIcon: 'play_circle' },
        { eventType: 'user_prompt_submit', expectedIcon: 'chat' },
        { eventType: 'pre_tool_use', expectedIcon: 'build' },
        { eventType: 'post_tool_use', expectedIcon: 'check_circle' },
        { eventType: 'notification', expectedIcon: 'notification_important' },
        { eventType: 'error', expectedIcon: 'error' },
        { eventType: 'stop', expectedIcon: 'stop' },
        { eventType: 'subagent_stop', expectedIcon: 'stop_circle' },
        { eventType: 'pre_compact', expectedIcon: 'compress' },
      ];

      iconTestCases.forEach(({ eventType, expectedIcon }) => {
        const event = { ...createMockEvent(), event_type: eventType };
        const { container } = render(<EventRow {...defaultProps} event={event} />);

        const icon = screen.getByText(expectedIcon);
        expect(icon).toHaveClass('material-icons');
        expect(icon).toHaveStyle('fontSize: 16px');
        expect(icon).toHaveAttribute('title', eventType);

        container.remove();
      });
    });

    it('centers icons correctly in their column', () => {
      const event = createMockEventsByType.user_prompt_submit();

      render(<EventRow {...defaultProps} event={event} />);

      const iconContainer = screen.getByText('chat').parentElement;
      expect(iconContainer).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('provides tooltips for icons', () => {
      const event = createMockEventsByType.error();

      render(<EventRow {...defaultProps} event={event} />);

      const icon = screen.getByText('error');
      expect(icon).toHaveAttribute('title', 'error');
    });
  });

  describe('Typography and Styling', () => {
    it('uses correct font sizes throughout the row', () => {
      const event = createMockEventsByType.user_prompt_submit({
        timestamp: '2024-01-15T14:30:45.123Z',
        duration_ms: 1500,
      });
      const session = createMockSession();

      render(<EventRow {...defaultProps} event={event} session={session} />);

      const eventRow = screen.getByTestId('event-row-v2');
      
      // Main content should be 12px
      expect(eventRow).toHaveStyle('fontSize: 12px');
      expect(eventRow).toHaveStyle('lineHeight: 1.2');

      // Time and duration should be 11px
      const timeElement = screen.getByText('14:30:45');
      expect(timeElement).toHaveStyle('fontSize: 11px');

      const durationElement = screen.getByText('1.50s');
      expect(durationElement).toHaveStyle('fontSize: 11px');
    });

    it('applies correct text colors for different content', () => {
      const event = createMockEventsByType.user_prompt_submit({
        timestamp: '2024-01-15T14:30:45.123Z',
        tool_name: 'TestTool',
      });
      const session = createMockSession();

      render(<EventRow {...defaultProps} event={event} session={session} />);

      // Time should be muted
      const timeElement = screen.getByText('14:30:45');
      expect(timeElement).toHaveClass('text-text-muted');

      // Event type and session should be secondary
      const eventTypeElement = screen.getByText('user prompt submit (TestTool)');
      expect(eventTypeElement).toHaveClass('text-text-secondary');
    });

    it('truncates long content correctly', () => {
      const session = {
        ...createMockSession(),
        project_path: '/Users/test/very-long-project-name-that-should-be-truncated',
      };

      render(<EventRow {...defaultProps} session={session} />);

      const sessionElement = screen.getByTitle(/very-long-project-name-that-should-be-truncated/);
      expect(sessionElement).toHaveClass('truncate');
    });

    it('maintains exact 22px height', () => {
      render(<EventRow {...defaultProps} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('h-[22px]', 'min-h-[22px]', 'max-h-[22px]');
    });

    it('applies hover effects correctly', () => {
      render(<EventRow {...defaultProps} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveClass('hover:bg-black/10', 'transition-colors', 'duration-150');
    });
  });

  describe('Performance', () => {
    it('renders quickly with complex event data', async () => {
      const complexEvent = {
        ...createMockEventsByType.pre_tool_use({
          tool_name: 'ComplexTool',
          metadata: {
            tool_input: {
              parameters: { complex: 'data', with: ['arrays', 'and', 'objects'] },
            },
          },
          duration_ms: 2500,
        }),
      };

      const { renderTime } = await measureRenderTime(async () => {
        return render(<EventRow {...defaultProps} event={complexEvent} />);
      });

      expect(renderTime).toBeLessThan(5); // Very fast render
    });

    it('handles rapid re-renders efficiently', () => {
      const { rerender } = render(<EventRow {...defaultProps} />);

      const startTime = performance.now();

      // Rapid re-renders with different events
      for (let i = 0; i < 50; i++) {
        const event = {
          ...createMockEvent(),
          id: `event-${i}`,
          event_type: i % 2 === 0 ? 'user_prompt_submit' : 'tool_use',
        };
        rerender(<EventRow {...defaultProps} event={event} />);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    it('maintains performance with large session data', () => {
      const largeSession = {
        ...createMockSession(),
        project_path: '/Users/test/' + 'very-long-path-segment/'.repeat(20) + 'final-folder',
        git_branch: 'feature-branch-with-very-long-name-that-describes-everything',
      };

      const startTime = performance.now();
      render(<EventRow {...defaultProps} session={largeSession} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Fast even with large data
    });
  });

  describe('Accessibility', () => {
    it('passes accessibility validation', () => {
      const event = createMockEventsByType.user_prompt_submit();
      const session = createMockSession();

      const { container } = render(<EventRow {...defaultProps} event={event} session={session} />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('provides meaningful content for screen readers', () => {
      const event = createMockEventsByType.notification({
        metadata: { message: 'Task completed successfully' },
      });

      render(<EventRow {...defaultProps} event={event} />);

      expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
      expect(screen.getByText('notification_important')).toBeInTheDocument();
    });

    it('includes proper semantic structure', () => {
      render(<EventRow {...defaultProps} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveAttribute('data-testid', 'event-row-v2');
      expect(eventRow).toHaveAttribute('data-event-type');
    });
  });

  describe('Integration Tests', () => {
    it('works correctly with test providers', () => {
      const event = createMockEventsByType.user_prompt_submit();
      const session = createMockSession();

      renderWithProviders(
        <EventRow {...defaultProps} event={event} session={session} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('event-row-v2')).toBeInTheDocument();
    });

    it('integrates correctly with virtual list positioning', () => {
      const style = { 
        position: 'absolute',
        top: 66,
        height: 22,
        width: '100%',
      };

      render(<EventRow {...defaultProps} style={style} />);

      const eventRow = screen.getByTestId('event-row-v2');
      expect(eventRow).toHaveStyle('position: absolute');
      expect(eventRow).toHaveStyle('top: 66px');
    });

    it('maintains consistency across different event scenarios', () => {
      const scenarios = [
        { event: createMockEventsByType.session_start(), description: 'Session start' },
        { event: createMockEventsByType.user_prompt_submit(), description: 'User prompt' },
        { event: createMockEventsByType.tool_use(), description: 'Tool use' },
        { event: createMockEventsByType.notification(), description: 'Notification' },
        { event: createMockEventsByType.error(), description: 'Error' },
      ];

      scenarios.forEach(({ event, description }) => {
        const { container } = render(<EventRow {...defaultProps} event={event} />);

        const eventRow = container.querySelector('[data-testid="event-row-v2"]');
        
        // All should maintain consistent structure
        expect(eventRow).toHaveClass('grid', 'h-[22px]', 'border-l-[3px]');
        
        container.remove();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing event data gracefully', () => {
      const incompleteEvent = {
        id: 'test-event',
        event_type: 'user_prompt_submit',
        // Missing other required fields
      } as any;

      expect(() => {
        render(<EventRow {...defaultProps} event={incompleteEvent} />);
      }).not.toThrow();
    });

    it('handles null metadata gracefully', () => {
      const event = {
        ...createMockEvent(),
        metadata: null,
      };

      expect(() => {
        render(<EventRow {...defaultProps} event={event} />);
      }).not.toThrow();
    });

    it('handles undefined session gracefully', () => {
      render(<EventRow {...defaultProps} session={undefined} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles malformed tool data', () => {
      const event = {
        ...createMockEvent(),
        event_type: 'pre_tool_use',
        tool_name: null,
        metadata: {
          tool_input: null,
        },
      };

      expect(() => {
        render(<EventRow {...defaultProps} event={event} />);
      }).not.toThrow();

      expect(screen.getByText('Starting Unknown Tool')).toBeInTheDocument();
    });

    it('handles extreme duration values', () => {
      const extremeDurations = [0, 1, 999, 1000, 999999, Infinity, -1];

      extremeDurations.forEach(duration => {
        const event = { ...createMockEvent(), duration_ms: duration };
        const { container } = render(<EventRow {...defaultProps} event={event} />);

        // Should not crash
        expect(container.querySelector('[data-testid="event-row-v2"]')).toBeInTheDocument();

        container.remove();
      });
    });
  });
});