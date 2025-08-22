/**
 * layoutPersistence - User layout preferences and state persistence
 * 
 * Features:
 * - Save sidebar collapsed state
 * - Persist filter preferences  
 * - Remember column widths
 * - Store user preferences
 * - Restore on page reload
 * - Versioned storage for backward compatibility
 * - Error handling and fallbacks
 * - Type-safe storage operations
 */

'use client';

// Storage keys
const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: 'chronicle-sidebar-collapsed',
  FILTER_PREFERENCES: 'chronicle-filter-preferences',
  COLUMN_WIDTHS: 'chronicle-column-widths',
  USER_PREFERENCES: 'chronicle-user-preferences',
  LAYOUT_VERSION: 'chronicle-layout-version'
} as const;

// Current version for backward compatibility
const CURRENT_VERSION = '1.0.0';

// Type definitions
export interface FilterPreferences {
  /** Last used date range */
  lastDateRange?: {
    start?: string; // ISO string
    end?: string;   // ISO string
  };
  /** Recently used event types */
  recentEventTypes: string[];
  /** Preferred session status filters */
  preferredSessionStatus: string[];
  /** Last search term */
  lastSearchTerm?: string;
  /** Auto-apply saved filters on load */
  autoApplyFilters: boolean;
}

export interface ColumnWidths {
  /** Event table column widths */
  eventTable: {
    timestamp?: number;
    type?: number;
    session?: number;
    status?: number;
    details?: number;
  };
  /** Sidebar section heights */
  sidebar: {
    awaitingSection?: number;
    projectSection?: number;
    filtersSection?: number;
  };
}

export interface UserPreferences {
  /** Theme preference */
  theme: 'dark' | 'light' | 'auto';
  /** Auto-scroll preference for event feed */
  autoScroll: boolean;
  /** Preferred event batch size */
  eventBatchSize: number;
  /** Enable keyboard shortcuts */
  keyboardShortcuts: boolean;
  /** Show performance metrics */
  showPerformanceMetrics: boolean;
  /** Notification preferences */
  notifications: {
    newEvents: boolean;
    errorAlerts: boolean;
    sessionUpdates: boolean;
  };
  /** Layout density */
  density: 'compact' | 'comfortable' | 'spacious';
  /** Animation preferences */
  animations: boolean;
}

export interface LayoutState {
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Filter preferences */
  filterPreferences: FilterPreferences;
  /** Column widths */
  columnWidths: ColumnWidths;
  /** User preferences */
  userPreferences: UserPreferences;
  /** Storage version */
  version: string;
  /** Last updated timestamp */
  lastUpdated: string;
}

// Default values
export const DEFAULT_FILTER_PREFERENCES: FilterPreferences = {
  recentEventTypes: [],
  preferredSessionStatus: [],
  autoApplyFilters: false
};

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  eventTable: {
    timestamp: 140,
    type: 120,
    session: 100,
    status: 80,
    details: 200
  },
  sidebar: {
    awaitingSection: 200,
    projectSection: 300,
    filtersSection: 150
  }
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  autoScroll: true,
  eventBatchSize: 50,
  keyboardShortcuts: true,
  showPerformanceMetrics: false,
  notifications: {
    newEvents: true,
    errorAlerts: true,
    sessionUpdates: false
  },
  density: 'comfortable',
  animations: true
};

export const DEFAULT_LAYOUT_STATE: LayoutState = {
  sidebarCollapsed: false,
  filterPreferences: DEFAULT_FILTER_PREFERENCES,
  columnWidths: DEFAULT_COLUMN_WIDTHS,
  userPreferences: DEFAULT_USER_PREFERENCES,
  version: CURRENT_VERSION,
  lastUpdated: new Date().toISOString()
};

/**
 * Safely get item from localStorage with error handling
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to get localStorage item '${key}':`, error);
    return null;
  }
}

/**
 * Safely set item to localStorage with error handling
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item '${key}':`, error);
    return false;
  }
}

/**
 * Safely parse JSON with fallback
 */
function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  
  try {
    const parsed = JSON.parse(json);
    return parsed !== null && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Save sidebar collapsed state
 */
export function saveSidebarCollapsed(collapsed: boolean): void {
  safeSetItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
}

/**
 * Load sidebar collapsed state
 */
export function loadSidebarCollapsed(): boolean {
  const saved = safeGetItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
  return safeParse(saved, DEFAULT_LAYOUT_STATE.sidebarCollapsed);
}

/**
 * Save filter preferences
 */
export function saveFilterPreferences(preferences: Partial<FilterPreferences>): void {
  const current = loadFilterPreferences();
  const updated = { ...current, ...preferences };
  safeSetItem(STORAGE_KEYS.FILTER_PREFERENCES, JSON.stringify(updated));
}

/**
 * Load filter preferences
 */
export function loadFilterPreferences(): FilterPreferences {
  const saved = safeGetItem(STORAGE_KEYS.FILTER_PREFERENCES);
  return safeParse(saved, DEFAULT_FILTER_PREFERENCES);
}

/**
 * Save column widths
 */
export function saveColumnWidths(widths: Partial<ColumnWidths>): void {
  const current = loadColumnWidths();
  const updated = {
    eventTable: { ...current.eventTable, ...widths.eventTable },
    sidebar: { ...current.sidebar, ...widths.sidebar }
  };
  safeSetItem(STORAGE_KEYS.COLUMN_WIDTHS, JSON.stringify(updated));
}

/**
 * Load column widths
 */
export function loadColumnWidths(): ColumnWidths {
  const saved = safeGetItem(STORAGE_KEYS.COLUMN_WIDTHS);
  return safeParse(saved, DEFAULT_COLUMN_WIDTHS);
}

/**
 * Save user preferences
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  const current = loadUserPreferences();
  const updated = {
    ...current,
    ...preferences,
    notifications: { ...current.notifications, ...preferences.notifications }
  };
  safeSetItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
}

/**
 * Load user preferences
 */
export function loadUserPreferences(): UserPreferences {
  const saved = safeGetItem(STORAGE_KEYS.USER_PREFERENCES);
  return safeParse(saved, DEFAULT_USER_PREFERENCES);
}

/**
 * Save complete layout state
 */
export function saveLayoutState(state: Partial<LayoutState>): void {
  const current = loadLayoutState();
  const updated: LayoutState = {
    ...current,
    ...state,
    version: CURRENT_VERSION,
    lastUpdated: new Date().toISOString()
  };
  
  // Save individual components for backward compatibility
  if (state.sidebarCollapsed !== undefined) {
    saveSidebarCollapsed(state.sidebarCollapsed);
  }
  if (state.filterPreferences) {
    saveFilterPreferences(state.filterPreferences);
  }
  if (state.columnWidths) {
    saveColumnWidths(state.columnWidths);
  }
  if (state.userPreferences) {
    saveUserPreferences(state.userPreferences);
  }
}

/**
 * Load complete layout state
 */
export function loadLayoutState(): LayoutState {
  return {
    sidebarCollapsed: loadSidebarCollapsed(),
    filterPreferences: loadFilterPreferences(),
    columnWidths: loadColumnWidths(),
    userPreferences: loadUserPreferences(),
    version: CURRENT_VERSION,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Clear all layout preferences
 */
export function clearLayoutPreferences(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage item '${key}':`, error);
    }
  });
}

/**
 * Export layout preferences as JSON
 */
export function exportLayoutPreferences(): string {
  const state = loadLayoutState();
  return JSON.stringify(state, null, 2);
}

/**
 * Import layout preferences from JSON
 */
export function importLayoutPreferences(json: string): boolean {
  try {
    const state = JSON.parse(json) as Partial<LayoutState>;
    saveLayoutState(state);
    return true;
  } catch (error) {
    console.error('Failed to import layout preferences:', error);
    return false;
  }
}

/**
 * Migration helper for version compatibility
 */
export function migrateLayoutState(): void {
  const currentVersion = safeGetItem(STORAGE_KEYS.LAYOUT_VERSION);
  
  if (currentVersion === CURRENT_VERSION) {
    return; // No migration needed
  }
  
  // Future migration logic can go here
  // For now, we'll just update the version
  safeSetItem(STORAGE_KEYS.LAYOUT_VERSION, CURRENT_VERSION);
}

/**
 * React hook for layout persistence
 */
export function useLayoutPersistence() {
  const [layoutState, setLayoutState] = React.useState<LayoutState>(DEFAULT_LAYOUT_STATE);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load state on mount
  React.useEffect(() => {
    migrateLayoutState();
    const state = loadLayoutState();
    setLayoutState(state);
    setIsLoaded(true);
  }, []);

  // Save state when it changes
  const updateLayoutState = React.useCallback((updates: Partial<LayoutState>) => {
    setLayoutState(prev => {
      const newState = { ...prev, ...updates };
      saveLayoutState(updates);
      return newState;
    });
  }, []);

  return {
    layoutState,
    updateLayoutState,
    isLoaded,
    clearPreferences: clearLayoutPreferences,
    exportPreferences: exportLayoutPreferences,
    importPreferences: importLayoutPreferences
  };
}

// Need to import React for the hook
import React from 'react';