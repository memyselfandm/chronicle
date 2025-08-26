import { renderHook, act } from '@testing-library/react';
import {
  saveSidebarCollapsed,
  loadSidebarCollapsed,
  saveFilterPreferences,
  loadFilterPreferences,
  saveColumnWidths,
  loadColumnWidths,
  saveUserPreferences,
  loadUserPreferences,
  saveLayoutState,
  loadLayoutState,
  clearLayoutPreferences,
  exportLayoutPreferences,
  importLayoutPreferences,
  migrateLayoutState,
  useLayoutPersistence,
  DEFAULT_FILTER_PREFERENCES,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_LAYOUT_STATE,
  FilterPreferences,
  ColumnWidths,
  UserPreferences,
  LayoutState,
} from '../../src/lib/layoutPersistence';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get store() {
      return { ...store };
    },
    setStore(newStore: Record<string, string>) {
      store = { ...newStore };
    },
  };
})();

// Mock console methods
const consoleSpy = {
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('layoutPersistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Sidebar Collapsed State', () => {
    it('should save and load sidebar collapsed state', () => {
      saveSidebarCollapsed(true);
      expect(loadSidebarCollapsed()).toBe(true);

      saveSidebarCollapsed(false);
      expect(loadSidebarCollapsed()).toBe(false);
    });

    it('should return default value when no saved state', () => {
      expect(loadSidebarCollapsed()).toBe(DEFAULT_LAYOUT_STATE.sidebarCollapsed);
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage not available');
      });

      const result = loadSidebarCollapsed();
      expect(result).toBe(DEFAULT_LAYOUT_STATE.sidebarCollapsed);
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.setStore({
        'chronicle-sidebar-collapsed': 'invalid-json{'
      });

      const result = loadSidebarCollapsed();
      expect(result).toBe(DEFAULT_LAYOUT_STATE.sidebarCollapsed);
      expect(consoleSpy.warn).toHaveBeenCalled();
    });
  });

  describe('Filter Preferences', () => {
    const mockPreferences: FilterPreferences = {
      lastDateRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      },
      recentEventTypes: ['user_prompt_submit', 'post_tool_use'],
      preferredSessionStatus: ['active', 'idle'],
      lastSearchTerm: 'dashboard',
      autoApplyFilters: true,
    };

    it('should save and load filter preferences', () => {
      saveFilterPreferences(mockPreferences);
      const loaded = loadFilterPreferences();

      expect(loaded).toEqual(mockPreferences);
    });

    it('should merge partial preferences with existing ones', () => {
      saveFilterPreferences({ recentEventTypes: ['error'], autoApplyFilters: true });
      saveFilterPreferences({ lastSearchTerm: 'test' });

      const loaded = loadFilterPreferences();
      expect(loaded.recentEventTypes).toEqual(['error']);
      expect(loaded.autoApplyFilters).toBe(true);
      expect(loaded.lastSearchTerm).toBe('test');
    });

    it('should return default preferences when no saved state', () => {
      const loaded = loadFilterPreferences();
      expect(loaded).toEqual(DEFAULT_FILTER_PREFERENCES);
    });

    it('should handle partial saved data gracefully', () => {
      mockLocalStorage.setStore({
        'chronicle-filter-preferences': JSON.stringify({ lastSearchTerm: 'test' })
      });

      const loaded = loadFilterPreferences();
      expect(loaded.lastSearchTerm).toBe('test');
      expect(loaded.recentEventTypes).toEqual(DEFAULT_FILTER_PREFERENCES.recentEventTypes);
    });
  });

  describe('Column Widths', () => {
    const mockWidths: ColumnWidths = {
      eventTable: {
        timestamp: 200,
        type: 150,
        session: 120,
        status: 100,
        details: 300,
      },
      sidebar: {
        awaitingSection: 250,
        projectSection: 350,
        filtersSection: 200,
      },
    };

    it('should save and load column widths', () => {
      saveColumnWidths(mockWidths);
      const loaded = loadColumnWidths();

      expect(loaded).toEqual(mockWidths);
    });

    it('should merge partial widths with existing ones', () => {
      saveColumnWidths({ 
        eventTable: { timestamp: 180, type: 130 } 
      });
      saveColumnWidths({ 
        sidebar: { awaitingSection: 280 } 
      });

      const loaded = loadColumnWidths();
      expect(loaded.eventTable.timestamp).toBe(180);
      expect(loaded.eventTable.type).toBe(130);
      expect(loaded.eventTable.session).toBe(DEFAULT_COLUMN_WIDTHS.eventTable.session);
      expect(loaded.sidebar.awaitingSection).toBe(280);
    });

    it('should return default widths when no saved state', () => {
      const loaded = loadColumnWidths();
      expect(loaded).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('should handle deeply nested updates', () => {
      saveColumnWidths({
        eventTable: { timestamp: 250 },
        sidebar: { projectSection: 400 }
      });

      const loaded = loadColumnWidths();
      expect(loaded.eventTable.timestamp).toBe(250);
      expect(loaded.eventTable.type).toBe(DEFAULT_COLUMN_WIDTHS.eventTable.type);
      expect(loaded.sidebar.projectSection).toBe(400);
      expect(loaded.sidebar.awaitingSection).toBe(DEFAULT_COLUMN_WIDTHS.sidebar.awaitingSection);
    });
  });

  describe('User Preferences', () => {
    const mockPreferences: UserPreferences = {
      theme: 'light',
      autoScroll: false,
      eventBatchSize: 100,
      keyboardShortcuts: false,
      showPerformanceMetrics: true,
      notifications: {
        newEvents: false,
        errorAlerts: true,
        sessionUpdates: true,
      },
      density: 'compact',
      animations: false,
    };

    it('should save and load user preferences', () => {
      saveUserPreferences(mockPreferences);
      const loaded = loadUserPreferences();

      expect(loaded).toEqual(mockPreferences);
    });

    it('should merge notification preferences separately', () => {
      saveUserPreferences({ 
        theme: 'dark',
        notifications: { newEvents: false }
      });

      const loaded = loadUserPreferences();
      expect(loaded.theme).toBe('dark');
      expect(loaded.notifications.newEvents).toBe(false);
      expect(loaded.notifications.errorAlerts).toBe(DEFAULT_USER_PREFERENCES.notifications.errorAlerts);
    });

    it('should return default preferences when no saved state', () => {
      const loaded = loadUserPreferences();
      expect(loaded).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it('should handle partial notification updates', () => {
      saveUserPreferences({ notifications: { errorAlerts: false } });
      saveUserPreferences({ notifications: { sessionUpdates: true } });

      const loaded = loadUserPreferences();
      expect(loaded.notifications.errorAlerts).toBe(false);
      expect(loaded.notifications.sessionUpdates).toBe(true);
      expect(loaded.notifications.newEvents).toBe(DEFAULT_USER_PREFERENCES.notifications.newEvents);
    });
  });

  describe('Complete Layout State', () => {
    const mockLayoutState: Partial<LayoutState> = {
      sidebarCollapsed: true,
      filterPreferences: {
        recentEventTypes: ['error'],
        preferredSessionStatus: ['active'],
        autoApplyFilters: true,
      },
      columnWidths: {
        eventTable: { timestamp: 200 },
        sidebar: { awaitingSection: 250 },
      },
      userPreferences: {
        theme: 'light',
        autoScroll: false,
        notifications: { newEvents: false },
      },
    };

    it('should save and load complete layout state', () => {
      saveLayoutState(mockLayoutState);
      const loaded = loadLayoutState();

      expect(loaded.sidebarCollapsed).toBe(true);
      expect(loaded.filterPreferences.recentEventTypes).toEqual(['error']);
      expect(loaded.columnWidths.eventTable.timestamp).toBe(200);
      expect(loaded.userPreferences.theme).toBe('light');
    });

    it('should set version and timestamp when saving', () => {
      const beforeSave = Date.now();
      saveLayoutState(mockLayoutState);
      const afterSave = Date.now();

      const loaded = loadLayoutState();
      expect(loaded.version).toBe('1.0.0');
      
      const lastUpdated = new Date(loaded.lastUpdated).getTime();
      expect(lastUpdated).toBeGreaterThanOrEqual(beforeSave);
      expect(lastUpdated).toBeLessThanOrEqual(afterSave);
    });

    it('should save individual components for backward compatibility', () => {
      saveLayoutState({
        sidebarCollapsed: true,
        filterPreferences: { autoApplyFilters: true },
      });

      // Should be able to load individual components
      expect(loadSidebarCollapsed()).toBe(true);
      expect(loadFilterPreferences().autoApplyFilters).toBe(true);
    });

    it('should load current state even with partial saves', () => {
      saveSidebarCollapsed(true);
      saveFilterPreferences({ lastSearchTerm: 'test' });

      const loaded = loadLayoutState();
      expect(loaded.sidebarCollapsed).toBe(true);
      expect(loaded.filterPreferences.lastSearchTerm).toBe('test');
      expect(loaded.userPreferences).toEqual(DEFAULT_USER_PREFERENCES);
    });
  });

  describe('Clear Layout Preferences', () => {
    it('should clear all layout preferences', () => {
      // Save some data
      saveSidebarCollapsed(true);
      saveFilterPreferences({ lastSearchTerm: 'test' });
      saveColumnWidths({ eventTable: { timestamp: 200 } });
      saveUserPreferences({ theme: 'light' });

      clearLayoutPreferences();

      // Should return to defaults
      expect(loadSidebarCollapsed()).toBe(DEFAULT_LAYOUT_STATE.sidebarCollapsed);
      expect(loadFilterPreferences()).toEqual(DEFAULT_FILTER_PREFERENCES);
      expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
      expect(loadUserPreferences()).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it('should handle localStorage errors during clear', () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Failed to remove item');
      });

      expect(() => clearLayoutPreferences()).not.toThrow();
      expect(consoleSpy.warn).toHaveBeenCalled();
    });
  });

  describe('Export/Import Layout Preferences', () => {
    const mockLayoutState: Partial<LayoutState> = {
      sidebarCollapsed: true,
      filterPreferences: {
        recentEventTypes: ['error', 'warning'],
        autoApplyFilters: true,
      },
      userPreferences: {
        theme: 'dark',
        autoScroll: false,
      },
    };

    it('should export layout preferences as JSON', () => {
      saveLayoutState(mockLayoutState);
      const exported = exportLayoutPreferences();

      expect(() => JSON.parse(exported)).not.toThrow();
      
      const parsed = JSON.parse(exported) as LayoutState;
      expect(parsed.sidebarCollapsed).toBe(true);
      expect(parsed.filterPreferences.recentEventTypes).toEqual(['error', 'warning']);
      expect(parsed.userPreferences.theme).toBe('dark');
    });

    it('should import layout preferences from JSON', () => {
      const jsonString = JSON.stringify(mockLayoutState);
      const success = importLayoutPreferences(jsonString);

      expect(success).toBe(true);
      expect(loadSidebarCollapsed()).toBe(true);
      expect(loadFilterPreferences().autoApplyFilters).toBe(true);
      expect(loadUserPreferences().theme).toBe('dark');
    });

    it('should handle invalid JSON during import', () => {
      const success = importLayoutPreferences('invalid-json{');

      expect(success).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle empty export/import cycle', () => {
      const exported = exportLayoutPreferences();
      const success = importLayoutPreferences(exported);

      expect(success).toBe(true);
    });

    it('should maintain data integrity through export/import cycle', () => {
      saveLayoutState(mockLayoutState);
      const exported = exportLayoutPreferences();
      
      clearLayoutPreferences();
      importLayoutPreferences(exported);

      const loaded = loadLayoutState();
      expect(loaded.sidebarCollapsed).toBe(mockLayoutState.sidebarCollapsed);
      expect(loaded.filterPreferences.autoApplyFilters).toBe(mockLayoutState.filterPreferences!.autoApplyFilters);
    });
  });

  describe('Migration', () => {
    it('should not migrate when version matches', () => {
      mockLocalStorage.setStore({
        'chronicle-layout-version': '1.0.0'
      });

      migrateLayoutState();

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should update version when migration needed', () => {
      mockLocalStorage.setStore({
        'chronicle-layout-version': '0.9.0'
      });

      migrateLayoutState();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('chronicle-layout-version', '1.0.0');
    });

    it('should handle missing version gracefully', () => {
      migrateLayoutState();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('chronicle-layout-version', '1.0.0');
    });
  });

  describe('useLayoutPersistence Hook', () => {
    beforeEach(() => {
      // Mock React hooks since we can't easily test them in this environment
      // In a real test, you'd use @testing-library/react-hooks
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() => useLayoutPersistence());

      expect(result.current.isLoaded).toBe(true);
      expect(result.current.layoutState).toMatchObject({
        sidebarCollapsed: expect.any(Boolean),
        filterPreferences: expect.any(Object),
        columnWidths: expect.any(Object),
        userPreferences: expect.any(Object),
      });
    });

    it('should load saved state on mount', () => {
      saveSidebarCollapsed(true);
      saveFilterPreferences({ lastSearchTerm: 'test' });

      const { result } = renderHook(() => useLayoutPersistence());

      expect(result.current.layoutState.sidebarCollapsed).toBe(true);
      expect(result.current.layoutState.filterPreferences.lastSearchTerm).toBe('test');
    });

    it('should update and persist state changes', () => {
      const { result } = renderHook(() => useLayoutPersistence());

      act(() => {
        result.current.updateLayoutState({
          sidebarCollapsed: true,
          userPreferences: { theme: 'light' },
        });
      });

      expect(result.current.layoutState.sidebarCollapsed).toBe(true);
      expect(result.current.layoutState.userPreferences.theme).toBe('light');

      // Should also persist to localStorage
      expect(loadSidebarCollapsed()).toBe(true);
      expect(loadUserPreferences().theme).toBe('light');
    });

    it('should provide utility functions', () => {
      const { result } = renderHook(() => useLayoutPersistence());

      expect(typeof result.current.clearPreferences).toBe('function');
      expect(typeof result.current.exportPreferences).toBe('function');
      expect(typeof result.current.importPreferences).toBe('function');
    });

    it('should handle multiple rapid updates', () => {
      const { result } = renderHook(() => useLayoutPersistence());

      act(() => {
        result.current.updateLayoutState({ sidebarCollapsed: true });
        result.current.updateLayoutState({ 
          filterPreferences: { lastSearchTerm: 'test1' } 
        });
        result.current.updateLayoutState({ 
          filterPreferences: { lastSearchTerm: 'test2' } 
        });
      });

      expect(result.current.layoutState.sidebarCollapsed).toBe(true);
      expect(result.current.layoutState.filterPreferences.lastSearchTerm).toBe('test2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage quota exceeded', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      saveSidebarCollapsed(true);

      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle null and undefined values gracefully', () => {
      expect(() => {
        saveFilterPreferences(null as any);
        saveColumnWidths(undefined as any);
        saveUserPreferences({} as any);
      }).not.toThrow();
    });

    it('should handle corrupted data gracefully', () => {
      mockLocalStorage.setStore({
        'chronicle-filter-preferences': '{"recentEventTypes": "not-an-array"}',
        'chronicle-column-widths': '{"eventTable": "invalid"}',
        'chronicle-user-preferences': '{"notifications": "not-an-object"}'
      });

      const filterPrefs = loadFilterPreferences();
      const columnWidths = loadColumnWidths();
      const userPrefs = loadUserPreferences();

      expect(filterPrefs).toMatchObject(DEFAULT_FILTER_PREFERENCES);
      expect(columnWidths).toMatchObject(DEFAULT_COLUMN_WIDTHS);
      expect(userPrefs).toMatchObject(DEFAULT_USER_PREFERENCES);
    });

    it('should handle very large data sets', () => {
      const largePreferences = {
        recentEventTypes: Array(10000).fill('large-event-type'),
        preferredSessionStatus: Array(5000).fill('large-status'),
        lastSearchTerm: 'x'.repeat(10000),
      };

      expect(() => {
        saveFilterPreferences(largePreferences);
        const loaded = loadFilterPreferences();
        expect(loaded.recentEventTypes).toHaveLength(10000);
      }).not.toThrow();
    });

    it('should handle circular references in data', () => {
      const circularData: any = { prop: 'value' };
      circularData.circular = circularData;

      // Should not throw, but also shouldn't save the circular reference
      expect(() => {
        saveLayoutState(circularData);
      }).not.toThrow();
    });

    it('should handle server-side rendering (no localStorage)', () => {
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;

      expect(() => {
        loadSidebarCollapsed();
        saveSidebarCollapsed(true);
        loadLayoutState();
      }).not.toThrow();

      window.localStorage = originalLocalStorage;
    });

    it('should maintain performance with frequent updates', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        saveFilterPreferences({ lastSearchTerm: `search-${i}` });
        loadFilterPreferences();
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Type Safety and Validation', () => {
    it('should maintain type safety for filter preferences', () => {
      const validPrefs: FilterPreferences = {
        recentEventTypes: ['valid', 'types'],
        preferredSessionStatus: ['active'],
        autoApplyFilters: true,
      };

      saveFilterPreferences(validPrefs);
      const loaded = loadFilterPreferences();

      expect(Array.isArray(loaded.recentEventTypes)).toBe(true);
      expect(Array.isArray(loaded.preferredSessionStatus)).toBe(true);
      expect(typeof loaded.autoApplyFilters).toBe('boolean');
    });

    it('should maintain type safety for user preferences', () => {
      const validPrefs: UserPreferences = {
        theme: 'dark',
        autoScroll: true,
        eventBatchSize: 50,
        keyboardShortcuts: true,
        showPerformanceMetrics: false,
        notifications: {
          newEvents: true,
          errorAlerts: false,
          sessionUpdates: true,
        },
        density: 'comfortable',
        animations: true,
      };

      saveUserPreferences(validPrefs);
      const loaded = loadUserPreferences();

      expect(['dark', 'light', 'auto']).toContain(loaded.theme);
      expect(typeof loaded.autoScroll).toBe('boolean');
      expect(typeof loaded.eventBatchSize).toBe('number');
      expect(typeof loaded.notifications).toBe('object');
      expect(['compact', 'comfortable', 'spacious']).toContain(loaded.density);
    });

    it('should validate column width constraints', () => {
      const extremeWidths: ColumnWidths = {
        eventTable: {
          timestamp: -100, // Negative width
          type: 0,        // Zero width
          session: 10000, // Very large width
        },
        sidebar: {
          awaitingSection: NaN,      // Invalid number
          projectSection: Infinity,  // Infinite width
        },
      };

      saveColumnWidths(extremeWidths);
      const loaded = loadColumnWidths();

      // Should still load without throwing
      expect(typeof loaded).toBe('object');
      expect(typeof loaded.eventTable).toBe('object');
      expect(typeof loaded.sidebar).toBe('object');
    });
  });
});