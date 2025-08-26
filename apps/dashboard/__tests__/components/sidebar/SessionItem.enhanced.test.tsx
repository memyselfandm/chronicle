/**
 * Enhanced comprehensive tests for SessionItem components
 * Tests: display format, status indicators, multi-select, accessibility, performance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionItem, CompactSessionItem, SessionItemSkeleton } from '@/components/sidebar/SessionItem';
import { 
  createMockSession,
  createMockSessions,
  createSessionScenarios,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime,
  mockIntersectionObserver,
  mockResizeObserver
} from '@/test-utils';
import { formatDistanceToNow } from 'date-fns';

// Mock dependencies
jest.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: jest.fn((selector) => {
    const mockState = {
      isSessionSelected: jest.fn(() => false),
      getSessionEvents: jest.fn(() => []),
    };
    
    if (typeof selector === 'function') {
      return selector(mockState);
    }
    return mockState;
  }),
}));

jest.mock('@/lib/sessionUtils', () => ({
  formatSessionDisplay: jest.fn((session) => ({
    displayName: session.displayTitle || `Session ${session.id}`,
  })),
  getSessionDisplayProps: jest.fn((session) => ({
    statusIcon: session.status === 'active' ? '🟢' : 
                session.status === 'awaiting_input' ? '🟡' : 
                session.status === 'completed' ? '⚪' : '🔴',
    statusVariant: 'default' as const,
    displayName: session.displayTitle || `Session ${session.id}`,
  })),
  truncateSessionId: jest.fn((id) => id.slice(0, 8)),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

describe('SessionItem', () => {
  const mockOnClick = jest.fn();
  const mockOnDoubleClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIntersectionObserver();
    mockResizeObserver();
  });

  describe('Basic Rendering', () => {
    it('renders session with all required information', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
          onDoubleClick={mockOnDoubleClick}
        />
      );

      expect(screen.getByTestId(`session-item-${session.id}`)).toBeInTheDocument();
      expect(screen.getByText(session.status)).toBeInTheDocument();
      expect(screen.getByText(session.displayTitle)).toBeInTheDocument();
      expect(screen.getByText(session.displaySubtitle)).toBeInTheDocument();
    });

    it('displays correct status icon and badge', () => {
      const activeSession = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={activeSession}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('🟢')).toBeInTheDocument(); // Active icon
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('shows event count when enabled', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          showEventCount={true}
          onClick={mockOnClick}
        />
      );

      // Should show "0 events" since mock returns empty array
      expect(screen.getByText('0 events')).toBeInTheDocument();
    });

    it('hides event count when disabled', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          showEventCount={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.queryByText(/events/)).not.toBeInTheDocument();
    });

    it('displays last activity when enabled', () => {
      const session = {
        ...createSessionScenarios.activeSession(),
        lastActivity: new Date(),
      };
      
      render(
        <SessionItem 
          session={session}
          showLastActivity={true}
          onClick={mockOnClick}
        />
      );

      // Should show relative time
      const expectedTime = formatDistanceToNow(session.lastActivity, { addSuffix: true });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it('uses startTime when lastActivity is not available', () => {
      const session = {
        ...createSessionScenarios.activeSession(),
        lastActivity: undefined,
      };
      
      render(
        <SessionItem 
          session={session}
          showLastActivity={true}
          onClick={mockOnClick}
        />
      );

      const expectedTime = formatDistanceToNow(session.startTime, { addSuffix: true });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });
  });

  describe('Selection State Management', () => {
    it('shows unselected state by default', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      expect(sessionElement).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows selected state when session is selected', () => {
      const session = createSessionScenarios.activeSession();
      
      // Mock store to return true for isSelected
      const { useDashboardStore } = require('@/stores/dashboardStore');
      useDashboardStore.mockImplementation((selector) => {
        const mockState = {
          isSessionSelected: jest.fn(() => true),
          getSessionEvents: jest.fn(() => []),
        };
        return selector(mockState);
      });

      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      expect(sessionElement).toHaveAttribute('aria-pressed', 'true');
      expect(sessionElement).toHaveClass('ring-2', 'ring-accent-blue');
    });

    it('displays selection checkbox in correct state', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      // Checkbox should be present but not checked (unselected state)
      const checkboxContainer = document.querySelector('.border-border');
      expect(checkboxContainer).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles single click correctly', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.click(sessionElement);

      expect(mockOnClick).toHaveBeenCalledWith(session, false);
    });

    it('handles double click correctly', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onDoubleClick={mockOnDoubleClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.doubleClick(sessionElement);

      expect(mockOnDoubleClick).toHaveBeenCalledWith(session);
    });

    it('detects multi-select with Ctrl key', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.click(sessionElement, { ctrlKey: true });

      expect(mockOnClick).toHaveBeenCalledWith(session, true);
    });

    it('detects multi-select with Cmd key on Mac', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.click(sessionElement, { metaKey: true });

      expect(mockOnClick).toHaveBeenCalledWith(session, true);
    });

    it('handles hover state changes', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      
      fireEvent.mouseEnter(sessionElement);
      expect(sessionElement).toHaveClass('hover:shadow-md');

      fireEvent.mouseLeave(sessionElement);
      // Should still have hover class defined
      expect(sessionElement).toHaveClass('hover:shadow-md');
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles Enter key for selection', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.keyDown(sessionElement, { key: 'Enter' });

      expect(mockOnClick).toHaveBeenCalledWith(session, false);
    });

    it('handles Enter with Ctrl for multi-select', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.keyDown(sessionElement, { key: 'Enter', ctrlKey: true });

      expect(mockOnClick).toHaveBeenCalledWith(session, true);
    });

    it('handles Space key for multi-select', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      fireEvent.keyDown(sessionElement, { key: ' ' });

      expect(mockOnClick).toHaveBeenCalledWith(session, true);
    });

    it('has correct tabIndex for keyboard navigation', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      expect(sessionElement).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA labels and roles', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      expect(sessionElement).toHaveAttribute('role', 'button');
      expect(sessionElement).toHaveAttribute('aria-label');
      expect(sessionElement).toHaveAttribute('aria-pressed');
    });

    it('updates ARIA labels based on selection state', () => {
      const session = createSessionScenarios.activeSession();
      
      const { useDashboardStore } = require('@/stores/dashboardStore');
      useDashboardStore.mockImplementation((selector) => {
        const mockState = {
          isSessionSelected: jest.fn(() => true),
          getSessionEvents: jest.fn(() => []),
        };
        return selector(mockState);
      });

      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      const ariaLabel = sessionElement.getAttribute('aria-label');
      expect(ariaLabel).toContain('selected');
    });

    it('passes accessibility validation', () => {
      const session = createSessionScenarios.activeSession();
      
      const { container } = render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('has proper focus management', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`session-item-${session.id}`);
      
      fireEvent.focus(sessionElement);
      expect(sessionElement).toHaveFocus();
      expect(sessionElement).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Status Indicators', () => {
    it('displays correct status for different session states', () => {
      const testCases = [
        { session: createSessionScenarios.activeSession(), expectedIcon: '🟢' },
        { session: createSessionScenarios.awaitingInputSession(), expectedIcon: '🟡' },
        { session: createSessionScenarios.completedSession(), expectedIcon: '⚪' },
        { session: createSessionScenarios.errorSession(), expectedIcon: '🔴' },
      ];

      testCases.forEach(({ session, expectedIcon }) => {
        const { container } = render(
          <SessionItem 
            session={session}
            onClick={mockOnClick}
          />
        );

        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
        
        // Clean up for next test
        container.remove();
      });
    });

    it('shows tools count correctly', () => {
      const session = {
        ...createSessionScenarios.activeSession(),
        toolsUsed: 5,
      };
      
      render(
        <SessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('5 tools')).toBeInTheDocument();
    });

    it('handles singular vs plural tools correctly', () => {
      const sessionSingle = {
        ...createSessionScenarios.activeSession(),
        toolsUsed: 1,
      };
      
      render(
        <SessionItem 
          session={sessionSingle}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('1 tool')).toBeInTheDocument();
    });
  });
});

describe('CompactSessionItem', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders compact session correctly', () => {
      const session = createSessionScenarios.awaitingInputSession();
      
      render(
        <CompactSessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByTestId(`compact-session-item-${session.id}`)).toBeInTheDocument();
      expect(screen.getByText(session.displayTitle)).toBeInTheDocument();
    });

    it('shows correct status dot color and animation', () => {
      const awaitingSession = {
        ...createSessionScenarios.awaitingInputSession(),
        isAwaiting: true,
      };
      
      render(
        <CompactSessionItem 
          session={awaitingSession}
          onClick={mockOnClick}
        />
      );

      const statusDot = document.querySelector('.bg-yellow-500');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveClass('animate-pulse');
      expect(statusDot).toHaveClass('shadow-[0_0_8px_rgba(245,158,11,0.8)]');
    });

    it('displays session detail based on status', () => {
      const awaitingSession = {
        ...createSessionScenarios.awaitingInputSession(),
        isAwaiting: true,
      };
      
      render(
        <CompactSessionItem 
          session={awaitingSession}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Awaiting input')).toBeInTheDocument();
    });

    it('shows running status for active sessions', () => {
      const activeSession = createSessionScenarios.activeSession();
      
      render(
        <CompactSessionItem 
          session={activeSession}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    it('displays idle time correctly', () => {
      const idleSession = {
        ...createMockSession(),
        status: 'idle' as const,
        minutesSinceLastEvent: 30,
      };
      
      render(
        <CompactSessionItem 
          session={idleSession}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Idle 30min ago')).toBeInTheDocument();
    });

    it('displays hours for long idle times', () => {
      const longIdleSession = {
        ...createMockSession(),
        status: 'idle' as const,
        minutesSinceLastEvent: 120, // 2 hours
      };
      
      render(
        <CompactSessionItem 
          session={longIdleSession}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Idle 2hr ago')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles click correctly', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <CompactSessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`compact-session-item-${session.id}`);
      fireEvent.click(sessionElement);

      expect(mockOnClick).toHaveBeenCalledWith(session, false);
    });

    it('supports keyboard navigation', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <CompactSessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`compact-session-item-${session.id}`);
      expect(sessionElement).toHaveAttribute('tabIndex', '0');
      expect(sessionElement).toHaveAttribute('role', 'button');
    });
  });

  describe('Visual States', () => {
    it('applies different border colors based on session type', () => {
      const testCases = [
        { 
          session: { ...createMockSession(), isAwaiting: true, status: 'awaiting_input' as const },
          expectedBorder: 'border-l-yellow-500'
        },
        { 
          session: { ...createMockSession(), status: 'active' as const, isAwaiting: false },
          expectedBorder: 'border-l-green-500'
        },
        { 
          session: { ...createMockSession(), status: 'idle' as const, isAwaiting: false },
          expectedBorder: 'border-l-gray-500'
        },
      ];

      testCases.forEach(({ session, expectedBorder }) => {
        const { container } = render(
          <CompactSessionItem 
            session={session}
            onClick={mockOnClick}
          />
        );

        const sessionElement = screen.getByTestId(`compact-session-item-${session.id}`);
        expect(sessionElement).toHaveClass(expectedBorder);
        
        container.remove();
      });
    });

    it('applies hover effects correctly', () => {
      const session = createSessionScenarios.activeSession();
      
      render(
        <CompactSessionItem 
          session={session}
          onClick={mockOnClick}
        />
      );

      const sessionElement = screen.getByTestId(`compact-session-item-${session.id}`);
      expect(sessionElement).toHaveClass('hover:bg-gray-800/30');
    });
  });
});

describe('SessionItemSkeleton', () => {
  it('renders loading skeleton correctly', () => {
    render(<SessionItemSkeleton />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-skeleton-class';
    
    render(<SessionItemSkeleton className={customClass} />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass(customClass);
  });

  it('shows placeholder elements in correct structure', () => {
    render(<SessionItemSkeleton />);

    // Should have placeholder elements for all parts of a session item
    const placeholders = document.querySelectorAll('.bg-bg-tertiary');
    expect(placeholders.length).toBeGreaterThan(5); // Multiple placeholder elements
  });
});

describe('Performance Tests', () => {
  it('renders large lists efficiently', async () => {
    const sessions = Array.from({ length: 100 }, () => createMockSession());
    
    const { renderTime } = await measureRenderTime(async () => {
      return render(
        <div>
          {sessions.map(session => (
            <SessionItem 
              key={session.id}
              session={session}
              onClick={() => {}}
            />
          ))}
        </div>
      );
    });

    expect(renderTime).toBeLessThan(500); // Should render 100 items quickly
  });

  it('handles rapid state changes efficiently', async () => {
    const session = createSessionScenarios.activeSession();
    const { rerender } = render(
      <SessionItem session={session} onClick={() => {}} />
    );

    // Rapid re-renders
    for (let i = 0; i < 50; i++) {
      const updatedSession = {
        ...session,
        displayTitle: `Updated Title ${i}`,
      };
      rerender(<SessionItem session={updatedSession} onClick={() => {}} />);
    }

    expect(screen.getByText('Updated Title 49')).toBeInTheDocument();
  });
});