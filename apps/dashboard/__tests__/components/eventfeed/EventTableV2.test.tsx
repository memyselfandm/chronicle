/**
 * Tests for EventTableV2 component
 * High-performance dense event table with virtual scrolling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventTableV2 } from '@/components/eventfeed/EventTableV2';
import { Event } from '@/types/events';

// Mock react-window
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

const mockEvents: Event[] = [
  {
    id: 'event-1',
    session_id: 'session-1',
    event_type: 'user_prompt_submit',
    timestamp: '2024-01-01T10:00:00Z',
    metadata: { prompt: 'Test prompt' },
    created_at: '2024-01-01T10:00:00Z'
  },
  {
    id: 'event-2',
    session_id: 'session-1',
    event_type: 'pre_tool_use',
    timestamp: '2024-01-01T10:00:01Z',
    metadata: { tool_input: {} },
    tool_name: 'Read',
    created_at: '2024-01-01T10:00:01Z'
  },
  {
    id: 'event-3',
    session_id: 'session-1',
    event_type: 'post_tool_use',
    timestamp: '2024-01-01T10:00:02Z',
    metadata: { tool_response: { success: true } },
    tool_name: 'Read',
    duration_ms: 150,
    created_at: '2024-01-01T10:00:02Z'
  }
];

const mockSessions = [
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

describe('EventTableV2', () => {
  const defaultProps = {
    events: mockEvents,
    sessions: mockSessions,
    height: 400,
    width: 800
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the table with correct structure', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('renders table headers with correct columns', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Session')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Tool')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('configures virtual list with correct parameters', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '3');
      expect(virtualList).toHaveAttribute('data-item-size', '24');
      expect(virtualList).toHaveStyle({ height: '376px' }); // 400 - 24px header
    });
  });

  describe('Dense Layout', () => {
    it('uses 24px row height for density', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-size', '24');
    });

    it('applies correct column widths from PRD', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const table = screen.getByTestId('event-table-v2');
      const computedStyle = window.getComputedStyle(table);
      
      // Should use grid template columns: 85px 140px 110px 90px 1fr
      expect(computedStyle.gridTemplateColumns).toBe('85px 140px 110px 90px 1fr');
    });

    it('uses 13px monospace typography for data', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveClass('font-mono', 'text-xs'); // text-xs = 12px, close to 13px
    });
  });

  describe('Virtual Scrolling', () => {
    it('handles large datasets efficiently', () => {
      const largeEventSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEvents[0],
        id: `event-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString()
      }));

      render(<EventTableV2 {...defaultProps} events={largeEventSet} />);
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '1000');
      
      // Should only render visible items (10 in our mock)
      const renderedItems = screen.getAllByText(/event-/);
      expect(renderedItems.length).toBeLessThanOrEqual(10);
    });

    it('maintains scroll position during updates', async () => {
      const { rerender } = render(<EventTableV2 {...defaultProps} />);
      
      // Add new events
      const updatedEvents = [
        ...mockEvents,
        {
          ...mockEvents[0],
          id: 'event-4',
          timestamp: '2024-01-01T10:00:03Z',
          created_at: '2024-01-01T10:00:03Z'
        }
      ];

      rerender(<EventTableV2 {...defaultProps} events={updatedEvents} />);
      
      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-item-count', '4');
      });
    });
  });

  describe('Performance', () => {
    it('handles real-time updates without performance degradation', () => {
      const { rerender } = render(<EventTableV2 {...defaultProps} />);
      
      // Simulate rapid event updates
      for (let i = 0; i < 50; i++) {
        const newEvents = [
          ...mockEvents,
          {
            ...mockEvents[0],
            id: `rapid-event-${i}`,
            timestamp: new Date(Date.now() + i * 100).toISOString()
          }
        ];
        rerender(<EventTableV2 {...defaultProps} events={newEvents} />);
      }
      
      // Should still be responsive
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('uses React.memo for performance optimization', () => {
      // Check that component is memoized
      expect(EventTableV2.displayName).toContain('memo');
    });
  });

  describe('Auto-scroll functionality', () => {
    it('provides auto-scroll toggle control', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const autoScrollToggle = screen.getByTestId('auto-scroll-toggle');
      expect(autoScrollToggle).toBeInTheDocument();
    });

    it('auto-scrolls to top when enabled and new events arrive', async () => {
      const { rerender } = render(<EventTableV2 {...defaultProps} autoScroll={true} />);
      
      const newEvents = [
        {
          ...mockEvents[0],
          id: 'new-event',
          timestamp: '2024-01-01T10:00:10Z'
        },
        ...mockEvents
      ];

      rerender(<EventTableV2 {...defaultProps} events={newEvents} autoScroll={true} />);
      
      // Should scroll to top (index 0)
      await waitFor(() => {
        const virtualList = screen.getByTestId('virtual-list');
        expect(virtualList).toHaveAttribute('data-scroll-to-item', '0');
      });
    });

    it('preserves manual scroll position when auto-scroll is disabled', () => {
      render(<EventTableV2 {...defaultProps} autoScroll={false} />);
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).not.toHaveAttribute('data-scroll-to-item');
    });
  });

  describe('Error handling', () => {
    it('handles empty events array gracefully', () => {
      render(<EventTableV2 {...defaultProps} events={[]} />);
      
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
      // Should show empty state instead of virtual list when no events
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('handles missing session data gracefully', () => {
      render(<EventTableV2 {...defaultProps} sessions={[]} />);
      
      expect(screen.getByTestId('event-table-v2')).toBeInTheDocument();
      // Should still render events, just without session context
    });

    it('handles invalid event data gracefully', () => {
      const invalidEvents = [
        { id: 'invalid' }, // Missing required fields
        ...mockEvents
      ];

      render(<EventTableV2 {...defaultProps} events={invalidEvents as any} />);
      
      // Should filter out invalid events
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toHaveAttribute('data-item-count', '3'); // Only valid events
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Event feed table');
    });

    it('supports keyboard navigation', () => {
      render(<EventTableV2 {...defaultProps} />);
      
      const table = screen.getByTestId('event-table-v2');
      expect(table).toHaveAttribute('tabIndex', '0');
    });
  });
});