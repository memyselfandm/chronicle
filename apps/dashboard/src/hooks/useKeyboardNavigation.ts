/**
 * useKeyboardNavigation - Comprehensive keyboard navigation hook for dashboard
 * 
 * Features:
 * - j/k for event navigation (vim-style)
 * - 1/2/3 for quick filter toggles  
 * - Cmd+B for sidebar toggle
 * - / for search focus
 * - Escape to clear filters
 * - Arrow keys for alternative navigation
 * - Tab navigation support
 * - Configurable shortcuts
 * - Event delegation and cleanup
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

export interface KeyboardNavigationConfig {
  /** Enable j/k navigation */
  enableEventNavigation?: boolean;
  /** Enable filter toggle shortcuts */
  enableFilterShortcuts?: boolean;
  /** Enable sidebar toggle shortcut */
  enableSidebarShortcut?: boolean;
  /** Enable search focus shortcut */
  enableSearchShortcut?: boolean;
  /** Enable escape to clear filters */
  enableEscapeToClear?: boolean;
  /** Custom key mappings */
  keyMappings?: Partial<KeyMappings>;
  /** Prevent default browser behavior for handled keys */
  preventDefault?: boolean;
}

export interface KeyMappings {
  /** Navigate to next event */
  nextEvent: string[];
  /** Navigate to previous event */
  previousEvent: string[];
  /** Toggle sidebar */
  toggleSidebar: string[];
  /** Focus search input */
  focusSearch: string[];
  /** Clear all filters */
  clearFilters: string[];
  /** Quick filter toggles */
  quickFilters: {
    [key: string]: string; // key -> filter type
  };
}

export interface NavigationState {
  /** Currently selected event index */
  selectedEventIndex: number;
  /** Total number of events */
  totalEvents: number;
  /** Whether navigation is active */
  isNavigating: boolean;
  /** Last navigation time */
  lastNavigationTime: number;
}

const DEFAULT_KEY_MAPPINGS: KeyMappings = {
  nextEvent: ['j', 'ArrowDown'],
  previousEvent: ['k', 'ArrowUp'],
  toggleSidebar: ['b'], // Will be combined with Cmd/Ctrl
  focusSearch: ['/'],
  clearFilters: ['Escape'],
  quickFilters: {
    '1': 'active',
    '2': 'awaiting', 
    '3': 'completed'
  }
};

const DEFAULT_CONFIG: Required<KeyboardNavigationConfig> = {
  enableEventNavigation: true,
  enableFilterShortcuts: true,
  enableSidebarShortcut: true,
  enableSearchShortcut: true,
  enableEscapeToClear: true,
  keyMappings: DEFAULT_KEY_MAPPINGS,
  preventDefault: true
};

/**
 * Comprehensive keyboard navigation hook
 */
export function useKeyboardNavigation(config: KeyboardNavigationConfig = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const keyMappings = { ...DEFAULT_KEY_MAPPINGS, ...fullConfig.keyMappings };

  const {
    events,
    filters,
    ui: { sidebarCollapsed, selectedEvent },
    setSidebarCollapsed,
    setSelectedEvent,
    updateFilters,
    resetFilters,
    getFilteredEvents
  } = useDashboardStore();

  const [navigationState, setNavigationState] = useState<NavigationState>({
    selectedEventIndex: -1,
    totalEvents: 0,
    isNavigating: false,
    lastNavigationTime: 0
  });

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isHandlingKey = useRef(false);

  // Get filtered events for navigation
  const filteredEvents = getFilteredEvents();

  // Update navigation state when events change
  useEffect(() => {
    const newTotalEvents = filteredEvents.length;
    const newSelectedIndex = selectedEvent 
      ? filteredEvents.findIndex(e => e.id === selectedEvent)
      : -1;
    
    setNavigationState(prev => {
      // Only update if values actually changed
      if (prev.totalEvents === newTotalEvents && prev.selectedEventIndex === newSelectedIndex) {
        return prev;
      }
      return {
        ...prev,
        totalEvents: newTotalEvents,
        selectedEventIndex: newSelectedIndex
      };
    });
  }, [filteredEvents.length, selectedEvent]);

  // Find search input element
  useEffect(() => {
    const findSearchInput = () => {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]') as HTMLInputElement;
      searchInputRef.current = searchInput;
    };

    findSearchInput();
    
    // Re-find search input if DOM changes
    const observer = new MutationObserver(findSearchInput);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);

  // Event navigation functions
  const navigateToEvent = useCallback((direction: 'next' | 'previous') => {
    if (!fullConfig.enableEventNavigation || filteredEvents.length === 0) return;

    const currentIndex = navigationState.selectedEventIndex;
    let newIndex: number;

    if (direction === 'next') {
      newIndex = currentIndex >= filteredEvents.length - 1 ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex <= 0 ? filteredEvents.length - 1 : currentIndex - 1;
    }

    const selectedEventId = filteredEvents[newIndex]?.id;
    if (selectedEventId) {
      setSelectedEvent(selectedEventId);
      setNavigationState(prev => ({
        ...prev,
        selectedEventIndex: newIndex,
        isNavigating: true,
        lastNavigationTime: Date.now()
      }));

      // Scroll selected event into view
      setTimeout(() => {
        const eventElement = document.querySelector(`[data-event-id="${selectedEventId}"]`);
        if (eventElement) {
          eventElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 50);
    }
  }, [
    fullConfig.enableEventNavigation,
    filteredEvents,
    navigationState.selectedEventIndex,
    setSelectedEvent
  ]);

  // Filter toggle functions
  const toggleQuickFilter = useCallback((filterKey: string) => {
    if (!fullConfig.enableFilterShortcuts) return;

    const filterValue = keyMappings.quickFilters[filterKey];
    if (!filterValue) return;

    const currentFilters = filters.sessionStatus || [];
    const isActive = currentFilters.includes(filterValue);
    
    const newFilters = isActive 
      ? currentFilters.filter(f => f !== filterValue)
      : [...currentFilters, filterValue];

    updateFilters({ sessionStatus: newFilters });
  }, [fullConfig.enableFilterShortcuts, keyMappings.quickFilters, filters.sessionStatus, updateFilters]);

  // Focus search input
  const focusSearch = useCallback(() => {
    if (!fullConfig.enableSearchShortcut || !searchInputRef.current) return;
    
    searchInputRef.current.focus();
    searchInputRef.current.select();
  }, [fullConfig.enableSearchShortcut]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    if (!fullConfig.enableEscapeToClear) return;
    
    // If search is focused, blur it first
    if (document.activeElement === searchInputRef.current) {
      searchInputRef.current?.blur();
      return;
    }
    
    resetFilters();
    setSelectedEvent(null);
  }, [fullConfig.enableEscapeToClear, resetFilters, setSelectedEvent]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prevent handling if we're already processing a key
    if (isHandlingKey.current) return;

    // Don't handle keys when typing in inputs (except specific cases)
    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement || 
                          activeElement instanceof HTMLTextAreaElement ||
                          activeElement?.getAttribute('contenteditable') === 'true';

    // Allow escape and sidebar toggle even when input is focused
    const isAllowedWhenInputFocused = 
      keyMappings.clearFilters.includes(event.key) ||
      (keyMappings.toggleSidebar.includes(event.key) && (event.metaKey || event.ctrlKey));

    if (isInputFocused && !isAllowedWhenInputFocused) return;

    isHandlingKey.current = true;
    let handled = false;

    try {
      // Event navigation (j/k and arrow keys)
      if (keyMappings.nextEvent.includes(event.key)) {
        navigateToEvent('next');
        handled = true;
      } else if (keyMappings.previousEvent.includes(event.key)) {
        navigateToEvent('previous');
        handled = true;
      }
      
      // Sidebar toggle (Cmd+B or Ctrl+B)
      else if (
        fullConfig.enableSidebarShortcut &&
        keyMappings.toggleSidebar.includes(event.key) && 
        (event.metaKey || event.ctrlKey)
      ) {
        setSidebarCollapsed(!sidebarCollapsed);
        handled = true;
      }
      
      // Search focus (/)
      else if (
        fullConfig.enableSearchShortcut &&
        keyMappings.focusSearch.includes(event.key) && 
        !event.metaKey && 
        !event.ctrlKey
      ) {
        focusSearch();
        handled = true;
      }
      
      // Clear filters (Escape)
      else if (
        fullConfig.enableEscapeToClear &&
        keyMappings.clearFilters.includes(event.key)
      ) {
        clearAllFilters();
        handled = true;
      }
      
      // Quick filter toggles (1/2/3)
      else if (
        fullConfig.enableFilterShortcuts &&
        keyMappings.quickFilters[event.key] &&
        !event.metaKey && 
        !event.ctrlKey
      ) {
        toggleQuickFilter(event.key);
        handled = true;
      }

      // Prevent default if we handled the key
      if (handled && fullConfig.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        isHandlingKey.current = false;
      }, 10);
    }
  }, [
    keyMappings,
    fullConfig,
    navigateToEvent,
    setSidebarCollapsed,
    sidebarCollapsed,
    focusSearch,
    clearAllFilters,
    toggleQuickFilter
  ]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Clear navigation state after inactivity
  useEffect(() => {
    if (!navigationState.isNavigating) return;

    const timeout = setTimeout(() => {
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false
      }));
    }, 3000); // Clear after 3 seconds

    return () => clearTimeout(timeout);
  }, [navigationState.isNavigating, navigationState.lastNavigationTime]);

  // Public API
  return {
    // State
    navigationState,
    
    // Actions
    navigateToNext: () => navigateToEvent('next'),
    navigateToPrevious: () => navigateToEvent('previous'),
    focusSearch,
    clearFilters: clearAllFilters,
    toggleQuickFilter,
    
    // Utilities
    isNavigationActive: navigationState.isNavigating,
    hasSelectedEvent: navigationState.selectedEventIndex >= 0,
    canNavigate: filteredEvents.length > 0,
    
    // Configuration
    config: fullConfig,
    keyMappings
  };
}

/**
 * Hook for simple event navigation only
 */
export function useEventNavigation() {
  return useKeyboardNavigation({
    enableEventNavigation: true,
    enableFilterShortcuts: false,
    enableSidebarShortcut: false,
    enableSearchShortcut: false,
    enableEscapeToClear: false
  });
}

/**
 * Hook for filter shortcuts only  
 */
export function useFilterShortcuts() {
  return useKeyboardNavigation({
    enableEventNavigation: false,
    enableFilterShortcuts: true,
    enableSidebarShortcut: false,
    enableSearchShortcut: false,
    enableEscapeToClear: true
  });
}