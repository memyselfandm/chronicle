/**
 * Custom hook for managing session filtering functionality
 * Provides a clean interface for session selection, filtering, and keyboard shortcuts
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useDashboardStore, SessionData } from '@/stores/dashboardStore';

export interface UseSessionFilterOptions {
  enableKeyboardShortcuts?: boolean;
  autoScrollToEvents?: boolean;
  maxRecentSelections?: number;
}

export interface SessionFilterState {
  selectedSessions: string[];
  isFiltering: boolean;
  filteredEventCount: number;
  totalEventCount: number;
}

export interface SessionFilterActions {
  selectSession: (sessionId: string, multiSelect?: boolean) => void;
  selectSessions: (sessionIds: string[]) => void;
  clearSelection: () => void;
  toggleSession: (sessionId: string) => void;
  isSessionSelected: (sessionId: string) => boolean;
  handleSessionClick: (session: SessionData, isMultiSelect: boolean) => void;
}

export interface UseSessionFilterReturn {
  state: SessionFilterState;
  actions: SessionFilterActions;
  sessions: SessionData[];
  filteredEvents: any[];
}

/**
 * Hook for managing session filtering with keyboard shortcuts and state management
 */
export function useSessionFilter(options: UseSessionFilterOptions = {}): UseSessionFilterReturn {
  const {
    enableKeyboardShortcuts = true,
    autoScrollToEvents = true,
    maxRecentSelections = 10
  } = options;

  // Zustand store selectors and actions
  const {
    sessions,
    getSelectedSessionsArray,
    getFilteredEventsBySelectedSessions,
    getTotalEventsCount,
    toggleSessionSelection,
    clearSelectedSessions,
    setSelectedSessions,
    isSessionSelected: checkIsSessionSelected
  } = useDashboardStore();

  // Compute current state
  const state: SessionFilterState = useMemo(() => {
    const selectedSessions = getSelectedSessionsArray();
    const filteredEvents = getFilteredEventsBySelectedSessions();
    const totalEvents = getTotalEventsCount();

    return {
      selectedSessions,
      isFiltering: selectedSessions.length > 0,
      filteredEventCount: filteredEvents.length,
      totalEventCount: totalEvents
    };
  }, [getSelectedSessionsArray, getFilteredEventsBySelectedSessions, getTotalEventsCount]);

  // Session selection actions
  const selectSession = useCallback((sessionId: string, multiSelect = false) => {
    toggleSessionSelection(sessionId, multiSelect);
  }, [toggleSessionSelection]);

  const selectSessions = useCallback((sessionIds: string[]) => {
    setSelectedSessions(sessionIds);
  }, [setSelectedSessions]);

  const clearSelection = useCallback(() => {
    clearSelectedSessions();
  }, [clearSelectedSessions]);

  const toggleSession = useCallback((sessionId: string) => {
    toggleSessionSelection(sessionId, true); // Always multi-select for toggle
  }, [toggleSessionSelection]);

  const isSessionSelected = useCallback((sessionId: string) => {
    return checkIsSessionSelected(sessionId);
  }, [checkIsSessionSelected]);

  // Enhanced session click handler with logic
  const handleSessionClick = useCallback((session: SessionData, isMultiSelect: boolean) => {
    // Log selection for analytics (if needed)
    console.log(`Session selected: ${session.id}, multi: ${isMultiSelect}`);
    
    toggleSessionSelection(session.id, isMultiSelect);
  }, [toggleSessionSelection]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with form inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      switch (event.key) {
        case 'Escape':
          if (state.isFiltering) {
            event.preventDefault();
            clearSelection();
          }
          break;
        
        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Select all sessions
            const allSessionIds = sessions.map(s => s.id);
            selectSessions(allSessionIds);
          }
          break;

        case 'c':
        case 'C':
          if (event.ctrlKey || event.metaKey) {
            // Don't prevent default - let normal copy work
            // But could add custom copy behavior here
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, state.isFiltering, clearSelection, sessions, selectSessions]);

  // Auto-scroll to events when selection changes (optional)
  useEffect(() => {
    if (!autoScrollToEvents || !state.isFiltering) return;

    // Could implement auto-scroll logic here
    // For now, just a placeholder
    const eventFeedElement = document.querySelector('[data-testid="event-feed"]');
    if (eventFeedElement) {
      eventFeedElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [autoScrollToEvents, state.selectedSessions.length]);

  // Get filtered events
  const filteredEvents = useMemo(() => {
    return getFilteredEventsBySelectedSessions();
  }, [getFilteredEventsBySelectedSessions]);

  // Actions object
  const actions: SessionFilterActions = useMemo(() => ({
    selectSession,
    selectSessions,
    clearSelection,
    toggleSession,
    isSessionSelected,
    handleSessionClick
  }), [
    selectSession,
    selectSessions,
    clearSelection,
    toggleSession,
    isSessionSelected,
    handleSessionClick
  ]);

  return {
    state,
    actions,
    sessions,
    filteredEvents
  };
}

/**
 * Simplified hook for basic session selection without advanced features
 */
export function useSimpleSessionFilter() {
  const {
    getSelectedSessionsArray,
    toggleSessionSelection,
    clearSelectedSessions,
    isSessionSelected
  } = useDashboardStore();

  return {
    selectedSessions: getSelectedSessionsArray(),
    selectSession: (sessionId: string, multiSelect = false) => 
      toggleSessionSelection(sessionId, multiSelect),
    clearSelection: clearSelectedSessions,
    isSelected: isSessionSelected
  };
}

/**
 * Hook for session filter analytics and metrics
 */
export function useSessionFilterAnalytics() {
  const {
    getSelectedSessionsArray,
    getFilteredEventsBySelectedSessions,
    getTotalEventsCount,
    sessions
  } = useDashboardStore();

  return useMemo(() => {
    const selectedSessions = getSelectedSessionsArray();
    const filteredEvents = getFilteredEventsBySelectedSessions();
    const totalEvents = getTotalEventsCount();

    const reductionPercentage = totalEvents > 0 
      ? Math.round(((totalEvents - filteredEvents.length) / totalEvents) * 100)
      : 0;

    return {
      selectedSessionCount: selectedSessions.length,
      totalSessionCount: sessions.length,
      filteredEventCount: filteredEvents.length,
      totalEventCount: totalEvents,
      reductionPercentage,
      isFiltering: selectedSessions.length > 0,
      averageEventsPerSelectedSession: selectedSessions.length > 0 
        ? Math.round(filteredEvents.length / selectedSessions.length)
        : 0
    };
  }, [getSelectedSessionsArray, getFilteredEventsBySelectedSessions, getTotalEventsCount, sessions]);
}

/**
 * Hook for managing recent session selections (for quick access)
 */
export function useRecentSessionSelections(maxRecent: number = 5) {
  const { getSelectedSessionsArray } = useDashboardStore();
  
  // In a real implementation, you'd store this in localStorage or state
  // For now, just return the current selection
  const recentSelections = useMemo(() => {
    const current = getSelectedSessionsArray();
    return current.slice(0, maxRecent);
  }, [getSelectedSessionsArray, maxRecent]);

  return recentSelections;
}