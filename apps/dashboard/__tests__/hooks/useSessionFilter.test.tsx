import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionFilter, useSimpleSessionFilter, useSessionFilterAnalytics, useRecentSessionSelections } from '../../src/hooks/useSessionFilter';
import { useDashboardStore } from '../../src/stores/dashboardStore';

// Mock the dashboard store
jest.mock('../../src/stores/dashboardStore', () => ({
  useDashboardStore: jest.fn(),
}));

const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

describe('useSessionFilter Hook', () => {
  let mockStoreFunctions: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = '';

    // Mock store functions
    mockStoreFunctions = {
      sessions: [
        { id: 'session-1', project_path: '/project/one', git_branch: 'main' },
        { id: 'session-2', project_path: '/project/two', git_branch: 'feature/test' },
        { id: 'session-3', project_path: '/project/three', git_branch: 'develop' },
      ],
      getSelectedSessionsArray: jest.fn(() => []),
      getFilteredEventsBySelectedSessions: jest.fn(() => []),
      getTotalEventsCount: jest.fn(() => 100),
      toggleSessionSelection: jest.fn(),
      clearSelectedSessions: jest.fn(),
      setSelectedSessions: jest.fn(),
      isSessionSelected: jest.fn(() => false),
    };

    mockUseDashboardStore.mockReturnValue(mockStoreFunctions);
  });

  afterEach(() => {
    // Clean up any event listeners
    document.removeEventListener('keydown', jest.fn());
  });

  describe('Basic Functionality', () => {
    it('should initialize with empty selection state', () => {
      const { result } = renderHook(() => useSessionFilter());

      expect(result.current.state.selectedSessions).toEqual([]);
      expect(result.current.state.isFiltering).toBe(false);
      expect(result.current.state.filteredEventCount).toBe(0);
      expect(result.current.state.totalEventCount).toBe(100);
      expect(result.current.sessions).toEqual(mockStoreFunctions.sessions);
    });

    it('should reflect selected sessions in state', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      mockStoreFunctions.getFilteredEventsBySelectedSessions.mockReturnValue([
        { id: 'event-1', session_id: 'session-1' },
        { id: 'event-2', session_id: 'session-2' },
      ]);

      const { result } = renderHook(() => useSessionFilter());

      expect(result.current.state.selectedSessions).toEqual(['session-1', 'session-2']);
      expect(result.current.state.isFiltering).toBe(true);
      expect(result.current.state.filteredEventCount).toBe(2);
    });

    it('should provide session selection actions', () => {
      const { result } = renderHook(() => useSessionFilter());

      expect(typeof result.current.actions.selectSession).toBe('function');
      expect(typeof result.current.actions.selectSessions).toBe('function');
      expect(typeof result.current.actions.clearSelection).toBe('function');
      expect(typeof result.current.actions.toggleSession).toBe('function');
      expect(typeof result.current.actions.isSessionSelected).toBe('function');
      expect(typeof result.current.actions.handleSessionClick).toBe('function');
    });
  });

  describe('Session Selection Actions', () => {
    it('should call toggleSessionSelection for selectSession', () => {
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        result.current.actions.selectSession('session-1', false);
      });

      expect(mockStoreFunctions.toggleSessionSelection).toHaveBeenCalledWith('session-1', false);
    });

    it('should call toggleSessionSelection with multiSelect for toggleSession', () => {
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        result.current.actions.toggleSession('session-1');
      });

      expect(mockStoreFunctions.toggleSessionSelection).toHaveBeenCalledWith('session-1', true);
    });

    it('should call setSelectedSessions for selectSessions', () => {
      const { result } = renderHook(() => useSessionFilter());
      const sessionIds = ['session-1', 'session-2'];

      act(() => {
        result.current.actions.selectSessions(sessionIds);
      });

      expect(mockStoreFunctions.setSelectedSessions).toHaveBeenCalledWith(sessionIds);
    });

    it('should call clearSelectedSessions for clearSelection', () => {
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        result.current.actions.clearSelection();
      });

      expect(mockStoreFunctions.clearSelectedSessions).toHaveBeenCalled();
    });

    it('should check session selection status', () => {
      mockStoreFunctions.isSessionSelected.mockImplementation((id: string) => id === 'session-1');
      
      const { result } = renderHook(() => useSessionFilter());

      expect(result.current.actions.isSessionSelected('session-1')).toBe(true);
      expect(result.current.actions.isSessionSelected('session-2')).toBe(false);
    });

    it('should handle session click with logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { result } = renderHook(() => useSessionFilter());
      const session = mockStoreFunctions.sessions[0];

      act(() => {
        result.current.actions.handleSessionClick(session, true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session selected: session-1, multi: true'
      );
      expect(mockStoreFunctions.toggleSessionSelection).toHaveBeenCalledWith('session-1', true);

      consoleSpy.mockRestore();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should clear selection on Escape key when filtering', async () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      const { result } = renderHook(() => useSessionFilter());

      // Simulate Escape key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.clearSelectedSessions).toHaveBeenCalled();
    });

    it('should not clear selection on Escape when not filtering', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue([]);
      
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.clearSelectedSessions).not.toHaveBeenCalled();
    });

    it('should select all sessions on Ctrl+A', () => {
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'a', 
          ctrlKey: true,
        });
        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn(),
          writable: true,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).toHaveBeenCalledWith([
        'session-1', 'session-2', 'session-3'
      ]);
    });

    it('should select all sessions on Cmd+A (Mac)', () => {
      const { result } = renderHook(() => useSessionFilter());

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'A', 
          metaKey: true,
        });
        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn(),
          writable: true,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).toHaveBeenCalledWith([
        'session-1', 'session-2', 'session-3'
      ]);
    });

    it('should not interfere with form inputs', () => {
      const { result } = renderHook(() => useSessionFilter());

      // Create and focus an input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'Escape',
          target: input as any,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.clearSelectedSessions).not.toHaveBeenCalled();
    });

    it('should not interfere with textarea elements', () => {
      const { result } = renderHook(() => useSessionFilter());

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'a',
          ctrlKey: true,
          target: textarea as any,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).not.toHaveBeenCalled();
    });

    it('should not interfere with contentEditable elements', () => {
      const { result } = renderHook(() => useSessionFilter());

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'a',
          ctrlKey: true,
          target: div as any,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).not.toHaveBeenCalled();
    });

    it('should disable keyboard shortcuts when option is false', () => {
      const { result } = renderHook(() => 
        useSessionFilter({ enableKeyboardShortcuts: false })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'a', 
          ctrlKey: true,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).not.toHaveBeenCalled();
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = renderHook(() => useSessionFilter());
      
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Auto-scroll Functionality', () => {
    it('should scroll to event feed when autoScrollToEvents is enabled and filtering', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      // Create mock event feed element
      const eventFeedElement = document.createElement('div');
      eventFeedElement.setAttribute('data-testid', 'event-feed');
      eventFeedElement.scrollTo = jest.fn();
      document.body.appendChild(eventFeedElement);

      const { result, rerender } = renderHook(() => 
        useSessionFilter({ autoScrollToEvents: true })
      );

      // Change selection to trigger scroll
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      rerender();

      expect(eventFeedElement.scrollTo).toHaveBeenCalledWith({ 
        top: 0, 
        behavior: 'smooth' 
      });
    });

    it('should not scroll when autoScrollToEvents is disabled', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      const eventFeedElement = document.createElement('div');
      eventFeedElement.setAttribute('data-testid', 'event-feed');
      eventFeedElement.scrollTo = jest.fn();
      document.body.appendChild(eventFeedElement);

      const { result, rerender } = renderHook(() => 
        useSessionFilter({ autoScrollToEvents: false })
      );

      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      rerender();

      expect(eventFeedElement.scrollTo).not.toHaveBeenCalled();
    });

    it('should not scroll when not filtering', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue([]);
      
      const eventFeedElement = document.createElement('div');
      eventFeedElement.setAttribute('data-testid', 'event-feed');
      eventFeedElement.scrollTo = jest.fn();
      document.body.appendChild(eventFeedElement);

      const { result } = renderHook(() => 
        useSessionFilter({ autoScrollToEvents: true })
      );

      expect(eventFeedElement.scrollTo).not.toHaveBeenCalled();
    });

    it('should handle missing event feed element gracefully', () => {
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      const { result, rerender } = renderHook(() => 
        useSessionFilter({ autoScrollToEvents: true })
      );

      // Should not throw when element doesn't exist
      expect(() => {
        mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
        rerender();
      }).not.toThrow();
    });
  });

  describe('State Updates and Reactivity', () => {
    it('should update state when store values change', () => {
      const { result, rerender } = renderHook(() => useSessionFilter());

      // Initially empty
      expect(result.current.state.selectedSessions).toEqual([]);

      // Update store mock to return selections
      mockStoreFunctions.getSelectedSessionsArray.mockReturnValue(['session-1']);
      mockStoreFunctions.getFilteredEventsBySelectedSessions.mockReturnValue([
        { id: 'event-1', session_id: 'session-1' }
      ]);

      rerender();

      expect(result.current.state.selectedSessions).toEqual(['session-1']);
      expect(result.current.state.isFiltering).toBe(true);
      expect(result.current.state.filteredEventCount).toBe(1);
    });

    it('should memoize actions to prevent unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useSessionFilter());
      
      const initialActions = result.current.actions;
      
      rerender();
      
      expect(result.current.actions).toBe(initialActions);
    });

    it('should return filtered events from store', () => {
      const mockEvents = [
        { id: 'event-1', session_id: 'session-1' },
        { id: 'event-2', session_id: 'session-1' },
      ];
      
      mockStoreFunctions.getFilteredEventsBySelectedSessions.mockReturnValue(mockEvents);
      
      const { result } = renderHook(() => useSessionFilter());

      expect(result.current.filteredEvents).toEqual(mockEvents);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large session lists efficiently', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        project_path: `/project/${i}`,
        git_branch: 'main',
      }));

      mockStoreFunctions.sessions = largeSessions;

      const { result } = renderHook(() => useSessionFilter());

      // Should handle select all efficiently
      act(() => {
        const event = new KeyboardEvent('keydown', { 
          key: 'a', 
          ctrlKey: true,
        });
        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn(),
          writable: true,
        });
        document.dispatchEvent(event);
      });

      expect(mockStoreFunctions.setSelectedSessions).toHaveBeenCalledWith(
        largeSessions.map(s => s.id)
      );
    });

    it('should handle rapid selection changes', () => {
      const { result } = renderHook(() => useSessionFilter());

      // Simulate rapid selections
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.actions.selectSession(`session-${i % 3 + 1}`, true);
        }
      });

      expect(mockStoreFunctions.toggleSessionSelection).toHaveBeenCalledTimes(100);
    });
  });
});

describe('useSimpleSessionFilter Hook', () => {
  let mockStoreFunctions: any;

  beforeEach(() => {
    mockStoreFunctions = {
      getSelectedSessionsArray: jest.fn(() => ['session-1']),
      toggleSessionSelection: jest.fn(),
      clearSelectedSessions: jest.fn(),
      isSessionSelected: jest.fn(() => true),
    };

    mockUseDashboardStore.mockReturnValue(mockStoreFunctions);
  });

  it('should return simplified session filter interface', () => {
    const { result } = renderHook(() => useSimpleSessionFilter());

    expect(result.current.selectedSessions).toEqual(['session-1']);
    expect(typeof result.current.selectSession).toBe('function');
    expect(typeof result.current.clearSelection).toBe('function');
    expect(typeof result.current.isSelected).toBe('function');
  });

  it('should call store functions correctly', () => {
    const { result } = renderHook(() => useSimpleSessionFilter());

    act(() => {
      result.current.selectSession('session-2', true);
      result.current.clearSelection();
    });

    expect(mockStoreFunctions.toggleSessionSelection).toHaveBeenCalledWith('session-2', true);
    expect(mockStoreFunctions.clearSelectedSessions).toHaveBeenCalled();
    expect(result.current.isSelected).toBe(mockStoreFunctions.isSessionSelected);
  });
});

describe('useSessionFilterAnalytics Hook', () => {
  let mockStoreFunctions: any;

  beforeEach(() => {
    mockStoreFunctions = {
      getSelectedSessionsArray: jest.fn(() => ['session-1', 'session-2']),
      getFilteredEventsBySelectedSessions: jest.fn(() => [
        { id: 'event-1' }, { id: 'event-2' }, { id: 'event-3' }
      ]),
      getTotalEventsCount: jest.fn(() => 10),
      sessions: Array.from({ length: 5 }, (_, i) => ({ id: `session-${i + 1}` })),
    };

    mockUseDashboardStore.mockReturnValue(mockStoreFunctions);
  });

  it('should calculate analytics correctly', () => {
    const { result } = renderHook(() => useSessionFilterAnalytics());

    expect(result.current).toEqual({
      selectedSessionCount: 2,
      totalSessionCount: 5,
      filteredEventCount: 3,
      totalEventCount: 10,
      reductionPercentage: 70, // (10 - 3) / 10 * 100 = 70%
      isFiltering: true,
      averageEventsPerSelectedSession: 2, // 3 events / 2 sessions = 1.5, rounded to 2
    });
  });

  it('should handle zero events correctly', () => {
    mockStoreFunctions.getTotalEventsCount.mockReturnValue(0);
    mockStoreFunctions.getFilteredEventsBySelectedSessions.mockReturnValue([]);

    const { result } = renderHook(() => useSessionFilterAnalytics());

    expect(result.current.reductionPercentage).toBe(0);
    expect(result.current.averageEventsPerSelectedSession).toBe(0);
  });

  it('should handle no selected sessions', () => {
    mockStoreFunctions.getSelectedSessionsArray.mockReturnValue([]);

    const { result } = renderHook(() => useSessionFilterAnalytics());

    expect(result.current.isFiltering).toBe(false);
    expect(result.current.averageEventsPerSelectedSession).toBe(0);
  });
});

describe('useRecentSessionSelections Hook', () => {
  let mockStoreFunctions: any;

  beforeEach(() => {
    mockStoreFunctions = {
      getSelectedSessionsArray: jest.fn(() => ['session-1', 'session-2', 'session-3']),
    };

    mockUseDashboardStore.mockReturnValue(mockStoreFunctions);
  });

  it('should return current selections limited by maxRecent', () => {
    const { result } = renderHook(() => useRecentSessionSelections(2));

    expect(result.current).toEqual(['session-1', 'session-2']);
  });

  it('should use default maxRecent of 5', () => {
    mockStoreFunctions.getSelectedSessionsArray.mockReturnValue([
      'session-1', 'session-2', 'session-3', 'session-4', 'session-5', 'session-6'
    ]);

    const { result } = renderHook(() => useRecentSessionSelections());

    expect(result.current).toHaveLength(5);
    expect(result.current).toEqual([
      'session-1', 'session-2', 'session-3', 'session-4', 'session-5'
    ]);
  });

  it('should handle empty selections', () => {
    mockStoreFunctions.getSelectedSessionsArray.mockReturnValue([]);

    const { result } = renderHook(() => useRecentSessionSelections());

    expect(result.current).toEqual([]);
  });
});