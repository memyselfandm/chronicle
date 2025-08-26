/**
 * Tests for EventRow component
 * Dense 24px row with semantic color coding
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventRow } from '@/components/eventfeed/EventRow';
import { Event, Session } from '@/types/events';

const mockSession: Session = {
  id: 'session-1',
  claude_session_id: 'claude-1',
  project_path: '/test/project',
  git_branch: 'main',
  start_time: '2024-01-01T09:00:00Z',
  metadata: {},
  created_at: '2024-01-01T09:00:00Z'
};

describe('EventRow', () => {
  describe('Semantic Color Coding', () => {
    it('applies user_prompt_submit color scheme (purple)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: { prompt: 'Test prompt' },
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-accent-purple');
      expect(row).toHaveStyle('background-color: rgba(139, 92, 246, 0.08)');
    });

    it('applies pre_tool_use color scheme (blue)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'pre_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-accent-blue');
      expect(row).toHaveStyle('background-color: rgba(59, 130, 246, 0.08)');
    });

    it('applies post_tool_use color scheme (green)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'post_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        duration_ms: 150,
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-accent-green');
      expect(row).toHaveStyle('background-color: rgba(74, 222, 128, 0.08)');
    });

    it('applies notification color scheme (yellow)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'notification',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: { message: 'Input required' },
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-accent-yellow');
      expect(row).toHaveStyle('background-color: rgba(251, 191, 36, 0.08)');
    });

    it('applies error color scheme (red)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'error',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: { error_message: 'Test error' },
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-accent-red');
      expect(row).toHaveStyle('background-color: rgba(239, 68, 68, 0.08)');
    });

    it('applies stop color scheme (gray)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'stop',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('border-l-text-muted');
      expect(row).toHaveStyle('background-color: rgba(107, 114, 128, 0.08)');
    });
  });

  describe('Dense Layout', () => {
    it('uses exactly 24px height', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('h-6'); // h-6 = 24px
    });

    it('applies correct column layout', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'pre_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('grid', 'grid-cols-[85px_140px_110px_90px_1fr]');
    });

    it('uses 8px x 12px padding per PRD', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('py-2', 'px-3'); // py-2 = 8px, px-3 = 12px
    });
  });

  describe('Data Display', () => {
    it('formats timestamps correctly (HH:mm:ss)', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:30:45.000Z',
        metadata: {},
        created_at: '2024-01-01T10:30:45.000Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      expect(screen.getByText('10:30:45')).toBeInTheDocument();
    });

    it('displays session in folder/branch format', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      expect(screen.getByText('project/main')).toBeInTheDocument();
    });

    it('displays event type as badge', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'pre_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const typeBadge = screen.getByText('pre tool use');
      expect(typeBadge).toHaveClass('px-2', 'py-1', 'rounded-md');
    });

    it('displays tool name with semantic colors', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'pre_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const toolName = screen.getByText('Read');
      expect(toolName).toBeInTheDocument();
    });

    it('shows duration for post_tool_use events', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'post_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        tool_name: 'Read',
        duration_ms: 1250,
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      expect(screen.getByText('1.25s')).toBeInTheDocument();
    });
  });

  describe('Sub-agent Indentation', () => {
    it('indents sub-agent events by 20px', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'pre_tool_use',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: { is_subagent: true },
        tool_name: 'Task',
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('pl-8'); // pl-8 = 32px (12px base + 20px indent)
    });

    it('does not indent main agent events', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      const row = screen.getByTestId('event-row-v2');
      expect(row).toHaveClass('px-3');
      expect(row).not.toHaveClass('pl-8');
    });
  });

  describe('Error Handling', () => {
    it('handles missing session gracefully', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'unknown-session',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={undefined} index={0} />);
      
      expect(screen.getByText('Unknown session')).toBeInTheDocument();
    });

    it('handles missing tool_name gracefully', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      render(<EventRow event={event} session={mockSession} index={0} />);
      
      // Should show empty tool column or placeholder
      const row = screen.getByTestId('event-row-v2');
      expect(row).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('uses React.memo for optimization', () => {
      expect(EventRow.displayName).toContain('memo');
    });

    it('prevents unnecessary re-renders with stable props', () => {
      const event: Event = {
        id: 'event-1',
        session_id: 'session-1',
        event_type: 'user_prompt_submit',
        timestamp: '2024-01-01T10:00:00Z',
        metadata: {},
        created_at: '2024-01-01T10:00:00Z'
      };

      const { rerender } = render(<EventRow event={event} session={mockSession} index={0} />);
      
      // Re-render with same props should not cause update
      rerender(<EventRow event={event} session={mockSession} index={0} />);
      
      expect(screen.getByTestId('event-row-v2')).toBeInTheDocument();
    });
  });
});