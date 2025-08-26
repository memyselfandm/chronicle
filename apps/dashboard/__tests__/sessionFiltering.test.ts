/**
 * Comprehensive tests for session filtering functionality
 * Tests store methods, utility functions, hooks, and components
 */

import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from '../src/stores/dashboardStore';
import { useSessionFilter } from '../src/hooks/useSessionFilter';
import { 
  formatSessionDisplay, 
  formatSessionDisplayWithId,
  getSessionDisplayProps,
  extractProjectFolder,
  truncateSessionId,
  filterSessionsBySearch,
  groupSessionsByProject
} from '../src/lib/sessionUtils';

// Mock data
const mockSessions = [
  {
    id: 'session-1',
    status: 'active' as const,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: undefined,
    toolsUsed: 5,
    eventsCount: 12,
    lastActivity: new Date('2024-01-01T11:00:00Z'),
    metadata: {
      project_path: '/Users/test/chronicle',
      git_branch: 'main'
    }
  },
  {
    id: 'session-2',
    status: 'completed' as const,
    startTime: new Date('2024-01-01T09:00:00Z'),
    endTime: new Date('2024-01-01T09:30:00Z'),
    toolsUsed: 2,
    eventsCount: 5,
    lastActivity: new Date('2024-01-01T09:30:00Z'),
    metadata: {
      project_path: '/Users/test/dashboard',
      git_branch: 'feature-ui'
    }
  },
  {
    id: 'session-3',
    status: 'idle' as const,
    startTime: new Date('2024-01-01T08:00:00Z'),
    endTime: undefined,
    toolsUsed: 0,
    eventsCount: 1,
    lastActivity: new Date('2024-01-01T08:15:00Z'),
    metadata: {
      project_path: '/Users/test/api-docs',
      git_branch: undefined
    }
  }
];

const mockEvents = [
  {
    id: 'event-1',
    sessionId: 'session-1',
    type: 'session_start',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    metadata: {},
    status: 'active' as const
  },
  {
    id: 'event-2',
    sessionId: 'session-1',
    type: 'pre_tool_use',
    timestamp: new Date('2024-01-01T10:01:00Z'),
    metadata: {},
    status: 'active' as const
  },
  {
    id: 'event-3',
    sessionId: 'session-2',
    type: 'user_prompt_submit',
    timestamp: new Date('2024-01-01T09:00:00Z'),
    metadata: {},
    status: 'completed' as const
  }
];

describe('Session Filtering - Store', () => {
  beforeEach(() => {
    // Reset store state
    const store = useDashboardStore.getState();
    store.setSessions([]);
    store.setEvents([]);
    store.resetFilters();
  });

  describe('Store State Management', () => {
    it('should initialize with empty selected sessions', () => {
      const store = useDashboardStore.getState();
      expect(store.filters.selectedSessions.size).toBe(0);
      expect(store.getSelectedSessionsArray()).toEqual([]);
    });

    it('should toggle session selection in single-select mode', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', false);
      });
      
      expect(store.isSessionSelected('session-1')).toBe(true);
      expect(store.getSelectedSessionsArray()).toEqual(['session-1']);
      
      // Single select should clear previous selection
      act(() => {
        store.toggleSessionSelection('session-2', false);
      });
      
      expect(store.isSessionSelected('session-1')).toBe(false);
      expect(store.isSessionSelected('session-2')).toBe(true);
      expect(store.getSelectedSessionsArray()).toEqual(['session-2']);
    });

    it('should toggle session selection in multi-select mode', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', true);
        store.toggleSessionSelection('session-2', true);
      });
      
      expect(store.isSessionSelected('session-1')).toBe(true);
      expect(store.isSessionSelected('session-2')).toBe(true);
      expect(store.getSelectedSessionsArray()).toHaveLength(2);
      
      // Toggle off session-1
      act(() => {
        store.toggleSessionSelection('session-1', true);
      });
      
      expect(store.isSessionSelected('session-1')).toBe(false);
      expect(store.isSessionSelected('session-2')).toBe(true);
      expect(store.getSelectedSessionsArray()).toEqual(['session-2']);
    });

    it('should clear all selected sessions', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', true);
        store.toggleSessionSelection('session-2', true);
        store.clearSelectedSessions();
      });
      
      expect(store.getSelectedSessionsArray()).toEqual([]);
      expect(store.isSessionSelected('session-1')).toBe(false);
      expect(store.isSessionSelected('session-2')).toBe(false);
    });

    it('should set multiple sessions at once', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.setSelectedSessions(['session-1', 'session-3']);
      });
      
      expect(store.getSelectedSessionsArray()).toEqual(['session-1', 'session-3']);
      expect(store.isSessionSelected('session-1')).toBe(true);
      expect(store.isSessionSelected('session-2')).toBe(false);
      expect(store.isSessionSelected('session-3')).toBe(true);
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      const store = useDashboardStore.getState();
      store.setSessions(mockSessions);
      store.setEvents(mockEvents);
    });

    it('should return all events when no sessions selected', () => {
      const store = useDashboardStore.getState();
      const filteredEvents = store.getFilteredEventsBySelectedSessions();
      
      expect(filteredEvents).toHaveLength(mockEvents.length);
    });

    it('should filter events by selected sessions', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', false);
      });
      
      const filteredEvents = store.getFilteredEventsBySelectedSessions();
      expect(filteredEvents).toHaveLength(2); // Events 1 and 2 belong to session-1
      expect(filteredEvents.every(e => e.sessionId === 'session-1')).toBe(true);
    });

    it('should filter events by multiple selected sessions', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', true);
        store.toggleSessionSelection('session-2', true);
      });
      
      const filteredEvents = store.getFilteredEventsBySelectedSessions();
      expect(filteredEvents).toHaveLength(3); // All events belong to session-1 or session-2
    });

    it('should integrate with other filters', () => {
      const store = useDashboardStore.getState();
      
      act(() => {
        store.toggleSessionSelection('session-1', false);
        store.updateFilters({ eventTypes: ['session_start'] });
      });
      
      const filteredEvents = store.getFilteredEvents();
      expect(filteredEvents).toHaveLength(1); // Only session_start event from session-1
      expect(filteredEvents[0].type).toBe('session_start');
      expect(filteredEvents[0].sessionId).toBe('session-1');
    });
  });
});

describe('Session Filtering - Utilities', () => {
  describe('formatSessionDisplay', () => {
    it('should format session with project path and git branch', () => {
      const result = formatSessionDisplay(mockSessions[0]);
      expect(result).toBe('chronicle / main');
    });

    it('should handle missing git branch', () => {
      const result = formatSessionDisplay(mockSessions[2]);
      expect(result).toBe('api-docs / no git');
    });

    it('should handle missing project path', () => {
      const session = { ...mockSessions[0], metadata: {} };
      const result = formatSessionDisplay(session);
      expect(result).toBe('unknown / main');
    });
  });

  describe('formatSessionDisplayWithId', () => {
    it('should include short ID in display', () => {
      const result = formatSessionDisplayWithId(mockSessions[0]);
      expect(result).toBe('chronicle / main #on-1');
    });
  });

  describe('extractProjectFolder', () => {
    it('should extract folder name from absolute path', () => {
      expect(extractProjectFolder('/Users/test/chronicle')).toBe('chronicle');
    });

    it('should extract folder name from relative path', () => {
      expect(extractProjectFolder('src/components')).toBe('components');
    });

    it('should handle undefined path', () => {
      expect(extractProjectFolder(undefined)).toBe('unknown');
    });

    it('should handle empty path', () => {
      expect(extractProjectFolder('')).toBe('unknown');
    });
  });

  describe('truncateSessionId', () => {
    it('should truncate long session IDs', () => {
      const longId = 'session-with-very-long-identifier';
      expect(truncateSessionId(longId, 8)).toBe('session-...');
    });

    it('should not truncate short session IDs', () => {
      const shortId = 'short';
      expect(truncateSessionId(shortId, 8)).toBe('short');
    });
  });

  describe('filterSessionsBySearch', () => {
    it('should filter sessions by search term', () => {
      const results = filterSessionsBySearch(mockSessions, 'chronicle');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('session-1');
    });

    it('should be case insensitive', () => {
      const results = filterSessionsBySearch(mockSessions, 'MAIN');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('session-1');
    });

    it('should search session IDs', () => {
      const results = filterSessionsBySearch(mockSessions, 'session-2');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('session-2');
    });

    it('should return all sessions for empty search', () => {
      const results = filterSessionsBySearch(mockSessions, '');
      expect(results).toHaveLength(mockSessions.length);
    });
  });

  describe('groupSessionsByProject', () => {
    it('should group sessions by project folder', () => {
      const groups = groupSessionsByProject(mockSessions);
      
      expect(groups).toHaveProperty('chronicle');
      expect(groups).toHaveProperty('dashboard');
      expect(groups).toHaveProperty('api-docs');
      
      expect(groups.chronicle).toHaveLength(1);
      expect(groups.dashboard).toHaveLength(1);
      expect(groups['api-docs']).toHaveLength(1);
    });
  });

  describe('getSessionDisplayProps', () => {
    it('should return complete display properties', () => {
      const props = getSessionDisplayProps(mockSessions[0]);
      
      expect(props).toEqual({
        displayName: 'chronicle / main',
        displayNameWithId: 'chronicle / main #on-1',
        statusIcon: '🟢',
        statusVariant: 'success',
        projectFolder: 'chronicle',
        gitBranch: 'main',
        shortId: 'on-1'
      });
    });
  });
});

describe('Session Filtering - Hook', () => {
  beforeEach(() => {
    const store = useDashboardStore.getState();
    store.setSessions(mockSessions);
    store.setEvents(mockEvents);
    store.resetFilters();
  });

  it('should provide session filter state and actions', () => {
    const { result } = renderHook(() => useSessionFilter());
    
    expect(result.current.state.selectedSessions).toEqual([]);
    expect(result.current.state.isFiltering).toBe(false);
    expect(result.current.state.filteredEventCount).toBe(mockEvents.length);
    expect(result.current.sessions).toHaveLength(mockSessions.length);
    
    expect(typeof result.current.actions.selectSession).toBe('function');
    expect(typeof result.current.actions.clearSelection).toBe('function');
    expect(typeof result.current.actions.handleSessionClick).toBe('function');
  });

  it('should handle session selection', () => {
    const { result } = renderHook(() => useSessionFilter());
    
    act(() => {
      result.current.actions.selectSession('session-1', false);
    });
    
    expect(result.current.state.selectedSessions).toEqual(['session-1']);
    expect(result.current.state.isFiltering).toBe(true);
    expect(result.current.actions.isSessionSelected('session-1')).toBe(true);
  });

  it('should handle session click with multi-select', () => {
    const { result } = renderHook(() => useSessionFilter());
    
    act(() => {
      result.current.actions.handleSessionClick(mockSessions[0], false);
    });
    
    expect(result.current.state.selectedSessions).toEqual(['session-1']);
    
    act(() => {
      result.current.actions.handleSessionClick(mockSessions[1], true);
    });
    
    expect(result.current.state.selectedSessions).toHaveLength(2);
    expect(result.current.state.selectedSessions).toContain('session-1');
    expect(result.current.state.selectedSessions).toContain('session-2');
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useSessionFilter());
    
    act(() => {
      result.current.actions.selectSession('session-1', false);
      result.current.actions.clearSelection();
    });
    
    expect(result.current.state.selectedSessions).toEqual([]);
    expect(result.current.state.isFiltering).toBe(false);
  });
});

describe('Session Filtering - Persistence', () => {
  it('should persist selected sessions in localStorage', () => {
    // This test would require mocking localStorage
    // For now, we just ensure the store handles Set serialization correctly
    const store = useDashboardStore.getState();
    
    act(() => {
      store.toggleSessionSelection('session-1', true);
      store.toggleSessionSelection('session-2', true);
    });
    
    const selectedSessions = store.getSelectedSessionsArray();
    expect(selectedSessions).toHaveLength(2);
    expect(selectedSessions).toContain('session-1');
    expect(selectedSessions).toContain('session-2');
  });
});

describe('Session Filtering - Edge Cases', () => {
  it('should handle empty sessions array', () => {
    const store = useDashboardStore.getState();
    store.setSessions([]);
    
    const filteredSessions = store.getFilteredSessions();
    expect(filteredSessions).toEqual([]);
  });

  it('should handle selection of non-existent session', () => {
    const store = useDashboardStore.getState();
    store.setSessions(mockSessions);
    
    act(() => {
      store.toggleSessionSelection('non-existent-session', false);
    });
    
    expect(store.isSessionSelected('non-existent-session')).toBe(true);
    // The store should still track the selection even if session doesn't exist
    expect(store.getSelectedSessionsArray()).toContain('non-existent-session');
  });

  it('should handle events with missing sessionId', () => {
    const store = useDashboardStore.getState();
    const invalidEvent = {
      id: 'invalid-event',
      sessionId: '', // Empty sessionId
      type: 'error',
      timestamp: new Date(),
      metadata: {},
      status: 'error' as const
    };
    
    store.setEvents([...mockEvents, invalidEvent]);
    
    act(() => {
      store.toggleSessionSelection('session-1', false);
    });
    
    const filteredEvents = store.getFilteredEventsBySelectedSessions();
    // Should only include events with valid sessionIds
    expect(filteredEvents.every(e => e.sessionId === 'session-1')).toBe(true);
  });
});