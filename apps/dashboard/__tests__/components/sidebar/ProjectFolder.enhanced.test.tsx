/**
 * Enhanced comprehensive tests for ProjectFolder component
 * Tests: expand/collapse state, localStorage persistence, session sorting, user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectFolder } from '@/components/sidebar/ProjectFolder';
import { 
  createMockSession,
  createMockSessions,
  createSessionScenarios,
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: jest.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store.set(key, value);
  }),
  clear: jest.fn(() => mockLocalStorage.store.clear()),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock the CompactSessionItem component
jest.mock('@/components/sidebar/SessionItem', () => ({
  CompactSessionItem: jest.fn(({ session, onClick }) => (
    <div
      data-testid={`compact-session-${session.id}`}
      onClick={() => onClick?.(session, false)}
    >
      {session.displayTitle}
    </div>
  ))
}));

// Mock the dashboard store
jest.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: {
    getState: jest.fn(() => ({
      toggleSessionSelection: jest.fn(),
    })),
  },
}));

describe('ProjectFolder', () => {
  const mockProps = {
    projectKey: 'test-project',
    projectName: 'Test Project',
    sessions: createMockSessions(3),
    awaitingCount: 1,
    totalCount: 3,
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders project header with correct information', () => {
      render(<ProjectFolder {...mockProps} />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // total count
      
      // Check for folder icon
      const folderIcon = screen.getByText('folder');
      expect(folderIcon).toBeInTheDocument();
      expect(folderIcon).toHaveClass('material-icons');
    });

    it('renders expand/collapse chevron in correct initial state', () => {
      render(<ProjectFolder {...mockProps} />);

      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).toHaveClass('rotate-90'); // Initially expanded
    });

    it('displays sessions when expanded by default', () => {
      render(<ProjectFolder {...mockProps} />);

      mockProps.sessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });
    });

    it('renders empty state when no sessions', () => {
      const emptyProps = {
        ...mockProps,
        sessions: [],
        totalCount: 0,
      };

      render(<ProjectFolder {...emptyProps} />);

      expect(screen.getByText('No sessions in this project')).toBeInTheDocument();
    });

    it('handles long project names with truncation', () => {
      const longNameProps = {
        ...mockProps,
        projectName: 'This is a very long project name that should be truncated properly',
      };

      render(<ProjectFolder {...longNameProps} />);

      const projectName = screen.getByText(longNameProps.projectName);
      expect(projectName).toHaveClass('truncate');
      expect(projectName).toHaveAttribute('title', longNameProps.projectName);
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('toggles expand/collapse state when header is clicked', () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');
      const chevron = screen.getByText('keyboard_arrow_right');

      // Initially expanded
      expect(chevron).toHaveClass('rotate-90');
      mockProps.sessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(header!);

      expect(chevron).not.toHaveClass('rotate-90');
      mockProps.sessions.forEach(session => {
        expect(screen.queryByTestId(`compact-session-${session.id}`)).not.toBeInTheDocument();
      });

      // Click to expand again
      fireEvent.click(header!);

      expect(chevron).toHaveClass('rotate-90');
      mockProps.sessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });
    });

    it('shows smooth transition animations', () => {
      render(<ProjectFolder {...mockProps} />);

      const sessionsList = document.querySelector('.transition-all');
      expect(sessionsList).toHaveClass('duration-200');
    });

    it('handles rapid toggle clicks gracefully', () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');

      // Rapid clicking should not cause issues
      for (let i = 0; i < 10; i++) {
        fireEvent.click(header!);
      }

      // Should still be functional
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('LocalStorage Persistence', () => {
    it('saves expand/collapse state to localStorage', () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');

      // Click to collapse
      fireEvent.click(header!);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar-project-test-project',
        'false'
      );

      // Click to expand
      fireEvent.click(header!);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar-project-test-project',
        'true'
      );
    });

    it('loads initial state from localStorage', () => {
      // Pre-populate localStorage with collapsed state
      mockLocalStorage.store.set('sidebar-project-test-project', 'false');

      render(<ProjectFolder {...mockProps} />);

      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).not.toHaveClass('rotate-90'); // Should be collapsed

      // Sessions should not be visible
      mockProps.sessions.forEach(session => {
        expect(screen.queryByTestId(`compact-session-${session.id}`)).not.toBeInTheDocument();
      });
    });

    it('uses default expanded state when localStorage is empty', () => {
      // Ensure localStorage is empty
      mockLocalStorage.store.clear();

      render(<ProjectFolder {...mockProps} />);

      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).toHaveClass('rotate-90'); // Should be expanded by default
    });

    it('handles invalid localStorage values gracefully', () => {
      mockLocalStorage.store.set('sidebar-project-test-project', 'invalid-value');

      expect(() => {
        render(<ProjectFolder {...mockProps} />);
      }).not.toThrow();

      // Should default to expanded
      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).toHaveClass('rotate-90');
    });

    it('creates unique localStorage keys for different projects', () => {
      const { rerender } = render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');
      fireEvent.click(header!);

      // Change project key
      rerender(<ProjectFolder {...mockProps} projectKey="different-project" />);

      const newHeader = screen.getByText('Test Project').closest('.cursor-pointer');
      fireEvent.click(newHeader!);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar-project-test-project',
        'false'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar-project-different-project',
        'false'
      );
    });
  });

  describe('Session Management', () => {
    it('renders all provided sessions correctly', () => {
      const customSessions = [
        createSessionScenarios.activeSession(),
        createSessionScenarios.awaitingInputSession(),
        createSessionScenarios.completedSession(),
      ];

      const customProps = {
        ...mockProps,
        sessions: customSessions,
        totalCount: customSessions.length,
      };

      render(<ProjectFolder {...customProps} />);

      customSessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });
    });

    it('handles session clicks and passes to store', () => {
      const { useDashboardStore } = require('@/stores/dashboardStore');
      const mockToggleSelection = jest.fn();
      
      useDashboardStore.getState.mockReturnValue({
        toggleSessionSelection: mockToggleSelection,
      });

      render(<ProjectFolder {...mockProps} />);

      const firstSession = screen.getByTestId(`compact-session-${mockProps.sessions[0].id}`);
      fireEvent.click(firstSession);

      expect(mockToggleSelection).toHaveBeenCalledWith(mockProps.sessions[0].id, false);
    });

    it('updates session list dynamically', () => {
      const { rerender } = render(<ProjectFolder {...mockProps} />);

      // Add more sessions
      const newSessions = [
        ...mockProps.sessions,
        createSessionScenarios.activeSession(),
        createSessionScenarios.awaitingInputSession(),
      ];

      rerender(
        <ProjectFolder 
          {...mockProps} 
          sessions={newSessions}
          totalCount={newSessions.length}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument(); // Updated count

      newSessions.forEach(session => {
        expect(screen.getByTestId(`compact-session-${session.id}`)).toBeInTheDocument();
      });
    });

    it('handles empty sessions list gracefully', () => {
      const emptyProps = {
        ...mockProps,
        sessions: [],
        totalCount: 0,
      };

      render(<ProjectFolder {...emptyProps} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('No sessions in this project')).toBeInTheDocument();
    });
  });

  describe('Visual Design & Styling', () => {
    it('applies correct hover effects', () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');
      expect(header).toHaveClass('hover:bg-gray-800');
      expect(header).toHaveClass('transition-colors');
      expect(header).toHaveClass('group');
    });

    it('displays correct count badge styling', () => {
      render(<ProjectFolder {...mockProps} />);

      const countBadge = screen.getByText('3');
      expect(countBadge).toHaveClass('bg-gray-800', 'text-gray-400', 'px-1.5', 'py-0.5', 'rounded-full');
    });

    it('uses correct typography and spacing', () => {
      render(<ProjectFolder {...mockProps} />);

      const projectName = screen.getByText('Test Project');
      expect(projectName).toHaveClass('text-[13px]', 'font-medium', 'text-gray-400');

      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).toHaveClass('text-sm', 'transition-transform');
    });

    it('maintains proper visual hierarchy', () => {
      render(<ProjectFolder {...mockProps} />);

      const container = screen.getByText('Test Project').closest('.mb-1');
      expect(container).toBeInTheDocument();

      const header = screen.getByText('Test Project').closest('.px-3');
      expect(header).toHaveClass('py-2');
    });
  });

  describe('Accessibility & Keyboard Navigation', () => {
    it('maintains accessibility standards', () => {
      const { container } = render(<ProjectFolder {...mockProps} />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('supports keyboard navigation', () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');
      
      // Should be focusable
      fireEvent.focus(header!);
      expect(document.activeElement).toBe(header);

      // Should respond to Enter key
      fireEvent.keyDown(header!, { key: 'Enter' });
      
      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).not.toHaveClass('rotate-90'); // Should toggle
    });

    it('provides meaningful titles and labels', () => {
      const longProjectName = 'Very Long Project Name That Should Show Tooltip';
      const longProps = {
        ...mockProps,
        projectName: longProjectName,
      };

      render(<ProjectFolder {...longProps} />);

      const projectName = screen.getByText(longProjectName);
      expect(projectName).toHaveAttribute('title', longProjectName);
    });
  });

  describe('Performance & Edge Cases', () => {
    it('handles large numbers of sessions efficiently', async () => {
      const manySessions = Array.from({ length: 100 }, () => createMockSession());
      const largeProps = {
        ...mockProps,
        sessions: manySessions,
        totalCount: manySessions.length,
      };

      const { renderTime } = await measureRenderTime(async () => {
        return render(<ProjectFolder {...largeProps} />);
      });

      expect(renderTime).toBeLessThan(150); // Should render quickly
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('handles rapid state changes without memory leaks', () => {
      const { rerender } = render(<ProjectFolder {...mockProps} />);

      // Rapid updates
      for (let i = 0; i < 20; i++) {
        const newSessions = Array.from({ length: i + 1 }, () => createMockSession());
        rerender(
          <ProjectFolder 
            {...mockProps} 
            sessions={newSessions}
            totalCount={newSessions.length}
          />
        );
      }

      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('maintains state consistency during concurrent updates', async () => {
      render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');

      // Simulate concurrent state changes
      const togglePromises = Array.from({ length: 10 }, () => 
        new Promise(resolve => {
          setTimeout(() => {
            fireEvent.click(header!);
            resolve(true);
          }, Math.random() * 100);
        })
      );

      await Promise.all(togglePromises);

      // Should still be functional
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('handles null or undefined sessions gracefully', () => {
      const edgeCaseProps = {
        ...mockProps,
        sessions: [null, createMockSession(), undefined].filter(Boolean) as any,
        totalCount: 1,
      };

      expect(() => {
        render(<ProjectFolder {...edgeCaseProps} />);
      }).not.toThrow();

      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Integration with Dashboard Store', () => {
    it('integrates correctly with Zustand store', () => {
      const { useDashboardStore } = require('@/stores/dashboardStore');
      const mockToggleSelection = jest.fn();
      
      useDashboardStore.getState.mockReturnValue({
        toggleSessionSelection: mockToggleSelection,
      });

      render(<ProjectFolder {...mockProps} />);

      // Verify store integration works
      const sessionElement = screen.getByTestId(`compact-session-${mockProps.sessions[0].id}`);
      fireEvent.click(sessionElement);

      expect(mockToggleSelection).toHaveBeenCalledWith(mockProps.sessions[0].id, false);
    });

    it('handles store errors gracefully', () => {
      const { useDashboardStore } = require('@/stores/dashboardStore');
      
      // Mock store error
      useDashboardStore.getState.mockImplementation(() => {
        throw new Error('Store error');
      });

      expect(() => {
        render(<ProjectFolder {...mockProps} />);
      }).not.toThrow();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('works correctly in sidebar context', () => {
      renderWithProviders(
        <ProjectFolder {...mockProps} />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles project switching scenarios', () => {
      const { rerender } = render(<ProjectFolder {...mockProps} />);

      // Switch to different project
      const newProps = {
        ...mockProps,
        projectKey: 'new-project',
        projectName: 'New Project',
        sessions: [createSessionScenarios.activeSession()],
        totalCount: 1,
      };

      rerender(<ProjectFolder {...newProps} />);

      expect(screen.getByText('New Project')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('preserves state across component unmount/remount', () => {
      // Set initial collapsed state
      const { unmount } = render(<ProjectFolder {...mockProps} />);

      const header = screen.getByText('Test Project').closest('.cursor-pointer');
      fireEvent.click(header!); // Collapse

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar-project-test-project',
        'false'
      );

      unmount();

      // Remount should restore collapsed state
      render(<ProjectFolder {...mockProps} />);

      const chevron = screen.getByText('keyboard_arrow_right');
      expect(chevron).not.toHaveClass('rotate-90');
    });
  });
});