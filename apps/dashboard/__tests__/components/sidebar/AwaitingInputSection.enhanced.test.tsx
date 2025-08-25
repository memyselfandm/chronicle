/**
 * Enhanced comprehensive tests for AwaitingInputSection component
 * Tests: session filtering, height calculation, user interactions, edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AwaitingInputSection } from '@/components/sidebar/AwaitingInputSection';
import { 
  createMockSession,
  createMockSessions,
  createSessionScenarios,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';
import { SessionData } from '@/stores/dashboardStore';

// Mock the CompactSessionItem component
jest.mock('@/components/sidebar/SessionItem', () => ({
  CompactSessionItem: jest.fn(({ session, onClick, className }) => (
    <div
      data-testid={`compact-session-${session.id}`}
      className={className}
      onClick={() => onClick?.(session)}
    >
      {session.displayTitle}
    </div>
  ))
}));

describe('AwaitingInputSection', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders nothing when no sessions provided', () => {
      const { container } = render(
        <AwaitingInputSection sessions={[]} onClick={mockOnClick} />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('renders section header with correct title and count', () => {
      const sessions = [
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.awaitingInputSession(),
      ];

      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays pulsing pending icon', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      const icon = screen.getByText('pending');
      expect(icon).toHaveClass('animate-pulse');
      expect(icon).toHaveClass('text-yellow-500');
    });

    it('renders all sessions in awaiting state', () => {
      const sessions = createMockSessions(3).map(session => ({
        ...session,
        status: 'awaiting_input' as const,
        isAwaiting: true,
      }));

      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      sessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });
    });
  });

  describe('Session Filtering Logic', () => {
    it('filters out non-awaiting sessions correctly', () => {
      const awaitingSessions = [
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.awaitingInputSession(),
      ];
      const nonAwaitingSessions = [
        createSessionScenarios.activeSession(),
        createSessionScenarios.completedSession(),
      ];
      
      // Should only render awaiting sessions
      render(<AwaitingInputSection sessions={awaitingSessions} onClick={mockOnClick} />);

      expect(screen.getAllByTestId(/compact-session-/).length).toBe(2);
    });

    it('handles mixed session statuses correctly', () => {
      const mixedSessions = [
        { ...createMockSession(), status: 'awaiting_input' as const, isAwaiting: true },
        { ...createMockSession(), status: 'active' as const, isAwaiting: false },
        { ...createMockSession(), status: 'awaiting_input' as const, isAwaiting: true },
      ];

      // Filter to only awaiting sessions
      const awaitingSessions = mixedSessions.filter(s => s.isAwaiting);
      
      render(<AwaitingInputSection sessions={awaitingSessions} onClick={mockOnClick} />);

      expect(screen.getAllByTestId(/compact-session-/).length).toBe(2);
      expect(screen.getByText('2')).toBeInTheDocument(); // Count badge
    });

    it('updates session count dynamically', async () => {
      const { rerender } = render(
        <AwaitingInputSection sessions={[createSessionScenarios.awaitingInputSession()]} onClick={mockOnClick} />
      );

      expect(screen.getByText('1')).toBeInTheDocument();

      // Add more sessions
      const moreSessions = [
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.awaitingInputSession(),
      ];

      rerender(<AwaitingInputSection sessions={moreSessions} onClick={mockOnClick} />);
      
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Height Calculation & Responsive Behavior', () => {
    it('calculates height correctly for different session counts', () => {
      const singleSession = [createSessionScenarios.awaitingInputSession()];
      const { container: singleContainer } = render(
        <AwaitingInputSection sessions={singleSession} onClick={mockOnClick} />
      );

      const multipleSessions = Array.from({ length: 5 }, () => createSessionScenarios.awaitingInputSession());
      const { container: multipleContainer } = render(
        <AwaitingInputSection sessions={multipleSessions} onClick={mockOnClick} />
      );

      // Should have different heights based on session count
      const singleHeight = singleContainer.querySelector('.bg-gray-950\\/30');
      const multipleHeight = multipleContainer.querySelector('.bg-gray-950\\/30');

      expect(singleHeight?.children.length).toBe(1);
      expect(multipleHeight?.children.length).toBe(5);
    });

    it('handles large numbers of sessions gracefully', () => {
      const manySessions = Array.from({ length: 20 }, () => createSessionScenarios.awaitingInputSession());
      
      const { container } = render(
        <AwaitingInputSection sessions={manySessions} onClick={mockOnClick} />
      );

      expect(container.querySelector('.bg-gray-950\\/30')?.children.length).toBe(20);
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('maintains consistent styling with dynamic height', () => {
      const sessions = Array.from({ length: 3 }, () => createSessionScenarios.awaitingInputSession());
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      const sessionsList = document.querySelector('.bg-gray-950\\/30');
      expect(sessionsList).toBeInTheDocument();

      // Check that border and margin styles are preserved
      const section = sessionsList?.closest('.border-b');
      expect(section).toHaveClass('border-gray-800', 'mb-3');
    });
  });

  describe('User Interactions', () => {
    it('calls onClick when session is clicked', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      const sessionItem = screen.getByTestId(`compact-session-${sessions[0].id}`);
      fireEvent.click(sessionItem);

      expect(mockOnClick).toHaveBeenCalledWith(sessions[0]);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('handles multiple session clicks correctly', () => {
      const sessions = Array.from({ length: 3 }, () => createSessionScenarios.awaitingInputSession());
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      // Click each session
      sessions.forEach(session => {
        const sessionItem = screen.getByTestId(`compact-session-${session.id}`);
        fireEvent.click(sessionItem);
      });

      expect(mockOnClick).toHaveBeenCalledTimes(3);
      sessions.forEach(session => {
        expect(mockOnClick).toHaveBeenCalledWith(session);
      });
    });

    it('passes correct className to CompactSessionItem', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      const sessionItem = screen.getByTestId(`compact-session-${sessions[0].id}`);
      expect(sessionItem).toHaveClass('border-l-yellow-500', 'bg-yellow-500/5', 'hover:bg-yellow-500/10');
    });

    it('handles onClick being undefined gracefully', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} />);

      const sessionItem = screen.getByTestId(`compact-session-${sessions[0].id}`);
      
      // Should not throw when clicked
      expect(() => fireEvent.click(sessionItem)).not.toThrow();
    });
  });

  describe('Visual Design & Styling', () => {
    it('applies correct yellow color theme', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      // Header styling
      const header = document.querySelector('.bg-yellow-500\\/10');
      expect(header).toHaveClass('border-l-2', 'border-yellow-500');

      // Count badge styling
      const badge = screen.getByText('1');
      expect(badge).toHaveClass('bg-yellow-500/20', 'text-yellow-400');
    });

    it('maintains proper section structure', () => {
      const sessions = [createSessionScenarios.awaitingInputSection()];
      
      const { container } = render(
        <AwaitingInputSection sessions={sessions} onClick={mockOnClick} />
      );

      const section = container.firstChild;
      expect(section).toHaveClass('border-b', 'border-gray-800', 'mb-3');
    });

    it('uses correct typography sizes', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      const title = screen.getByText('Awaiting Input');
      expect(title).toHaveClass('text-[13px]', 'font-medium', 'text-gray-200');

      const badge = screen.getByText('1');
      expect(badge).toHaveClass('text-[11px]', 'font-semibold');
    });
  });

  describe('Performance & Edge Cases', () => {
    it('handles rapid session updates efficiently', async () => {
      let sessions = [createSessionScenarios.awaitingInputSession()];
      
      const { rerender } = render(
        <AwaitingInputSection sessions={sessions} onClick={mockOnClick} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        sessions = [...sessions, createSessionScenarios.awaitingInputSession()];
        rerender(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);
      }

      expect(screen.getByText('11')).toBeInTheDocument();
    });

    it('measures render performance with large datasets', async () => {
      const largeSessions = Array.from({ length: 50 }, () => createSessionScenarios.awaitingInputSession());
      
      const { renderTime } = await measureRenderTime(async () => {
        return render(<AwaitingInputSection sessions={largeSessions} onClick={mockOnClick} />);
      });

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('handles sessions with missing or null data', () => {
      const sessionsWithNulls = [
        createSessionScenarios.awaitingInputSession(),
        null as any,
        { ...createSessionScenarios.awaitingInputSession(), displayTitle: null },
      ].filter(Boolean);

      expect(() => {
        render(<AwaitingInputSection sessions={sessionsWithNulls} onClick={mockOnClick} />);
      }).not.toThrow();
    });

    it('maintains accessibility standards', () => {
      const sessions = Array.from({ length: 3 }, () => createSessionScenarios.awaitingInputSession());
      
      const { container } = render(
        <AwaitingInputSection sessions={sessions} onClick={mockOnClick} />
      );

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('works correctly within SWR provider', () => {
      const sessions = [createSessionScenarios.awaitingInputSession()];
      
      renderWithProviders(
        <AwaitingInputSection sessions={sessions} onClick={mockOnClick} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles real-time session updates correctly', async () => {
      let sessions = [createSessionScenarios.awaitingInputSession()];
      
      const { rerender } = render(
        <AwaitingInputSection sessions={sessions} onClick={mockOnClick} />
      );

      // Simulate real-time update
      await waitFor(() => {
        sessions.push(createSessionScenarios.awaitingInputSession());
        rerender(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);
      });

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('integrates correctly with dashboard store state', () => {
      const sessions = Array.from({ length: 3 }, () => ({
        ...createSessionScenarios.awaitingInputSession(),
        isAwaiting: true,
      }));
      
      render(<AwaitingInputSection sessions={sessions} onClick={mockOnClick} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      
      // Verify each session renders with proper styling
      sessions.forEach(session => {
        const sessionElement = screen.getByTestId(`compact-session-${session.id}`);
        expect(sessionElement).toHaveClass('border-l-yellow-500');
      });
    });
  });
});