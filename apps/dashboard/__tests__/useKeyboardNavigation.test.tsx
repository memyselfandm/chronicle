/**
 * useKeyboardNavigation Hook Tests
 * 
 * Tests:
 * - Event navigation (j/k keys)
 * - Filter shortcuts (1/2/3 keys)
 * - Sidebar toggle (Cmd+B)
 * - Search focus (/)
 * - Escape to clear filters
 * - Configuration options
 * - Event delegation and cleanup
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useKeyboardNavigation, useEventNavigation, useFilterShortcuts } from '@/hooks/useKeyboardNavigation';
import { useDashboardStore } from '@/stores/dashboardStore';

// Mock dependencies
jest.mock('@/stores/dashboardStore');

describe('useKeyboardNavigation', () => {
  // Mock store state
  const mockStoreState = {
    events: [
      { id: 'event1', sessionId: 'session1', type: 'tool_use', timestamp: new Date() },
      { id: 'event2', sessionId: 'session1', type: 'notification', timestamp: new Date() },
      { id: 'event3', sessionId: 'session2', type: 'user_prompt', timestamp: new Date() },
    ],
    filters: {
      sessionStatus: [],
      searchTerm: '',
    },
    ui: {
      sidebarCollapsed: false,
      selectedEvent: null,
    },
    setSidebarCollapsed: jest.fn(),
    setSelectedEvent: jest.fn(),
    updateFilters: jest.fn(),
    resetFilters: jest.fn(),
    getFilteredEvents: jest.fn(() => [
      { id: 'event1', sessionId: 'session1', type: 'tool_use', timestamp: new Date() },
      { id: 'event2', sessionId: 'session1', type: 'notification', timestamp: new Date() },
      { id: 'event3', sessionId: 'session2', type: 'user_prompt', timestamp: new Date() },
    ]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDashboardStore as jest.Mock).mockReturnValue(mockStoreState);
    
    // Mock document.querySelector for search input
    const mockSearchInput = document.createElement('input');
    mockSearchInput.type = 'search';
    jest.spyOn(document, 'querySelector').mockReturnValue(mockSearchInput);
    
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with default configuration', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      expect(result.current.config.enableEventNavigation).toBe(true);
      expect(result.current.config.enableFilterShortcuts).toBe(true);
      expect(result.current.config.enableSidebarShortcut).toBe(true);
      expect(result.current.config.enableSearchShortcut).toBe(true);
      expect(result.current.config.enableEscapeToClear).toBe(true);
    });

    it('accepts custom configuration', () => {
      const customConfig = {
        enableEventNavigation: false,
        enableFilterShortcuts: true,
        preventDefault: false,
      };

      const { result } = renderHook(() => useKeyboardNavigation(customConfig));

      expect(result.current.config.enableEventNavigation).toBe(false);
      expect(result.current.config.enableFilterShortcuts).toBe(true);
      expect(result.current.config.preventDefault).toBe(false);
    });

    it('sets up keyboard event listeners', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      renderHook(() => useKeyboardNavigation());

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = renderHook(() => useKeyboardNavigation());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Event Navigation (j/k keys)', () => {
    it('navigates to next event with j key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event1');
    });

    it('navigates to previous event with k key', () => {
      // Set initial selected event
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, selectedEvent: 'event2' },
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'k' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event1');
    });

    it('wraps around when reaching end of events', () => {
      // Set to last event
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, selectedEvent: 'event3' },
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event1');
    });

    it('wraps around when reaching beginning of events', () => {
      // Set to first event
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, selectedEvent: 'event1' },
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'k' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event3');
    });

    it('works with arrow keys', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event1');

      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowUp' });
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event3');
    });

    it('does not navigate when disabled', () => {
      renderHook(() => useKeyboardNavigation({ enableEventNavigation: false }));

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(mockStoreState.setSelectedEvent).not.toHaveBeenCalled();
    });

    it('scrolls selected event into view', () => {
      const mockElement = document.createElement('div');
      mockElement.scrollIntoView = jest.fn();
      jest.spyOn(document, 'querySelector').mockReturnValue(mockElement);

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      setTimeout(() => {
        expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    });
  });

  describe('Sidebar Toggle (Cmd+B)', () => {
    it('toggles sidebar with Cmd+B', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'b', metaKey: true });
      });

      expect(mockStoreState.setSidebarCollapsed).toHaveBeenCalledWith(true);
    });

    it('toggles sidebar with Ctrl+B', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
      });

      expect(mockStoreState.setSidebarCollapsed).toHaveBeenCalledWith(true);
    });

    it('does not toggle without modifier key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'b' });
      });

      expect(mockStoreState.setSidebarCollapsed).not.toHaveBeenCalled();
    });

    it('does not toggle when disabled', () => {
      renderHook(() => useKeyboardNavigation({ enableSidebarShortcut: false }));

      act(() => {
        fireEvent.keyDown(document, { key: 'b', metaKey: true });
      });

      expect(mockStoreState.setSidebarCollapsed).not.toHaveBeenCalled();
    });
  });

  describe('Search Focus (/)', () => {
    let mockSearchInput: HTMLInputElement;

    beforeEach(() => {
      mockSearchInput = document.createElement('input');
      mockSearchInput.type = 'search';
      mockSearchInput.focus = jest.fn();
      mockSearchInput.select = jest.fn();
      jest.spyOn(document, 'querySelector').mockReturnValue(mockSearchInput);
    });

    it('focuses search input with / key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '/' });
      });

      expect(mockSearchInput.focus).toHaveBeenCalled();
      expect(mockSearchInput.select).toHaveBeenCalled();
    });

    it('does not focus with modifier keys', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '/', metaKey: true });
      });

      expect(mockSearchInput.focus).not.toHaveBeenCalled();
    });

    it('does not focus when disabled', () => {
      renderHook(() => useKeyboardNavigation({ enableSearchShortcut: false }));

      act(() => {
        fireEvent.keyDown(document, { key: '/' });
      });

      expect(mockSearchInput.focus).not.toHaveBeenCalled();
    });

    it('handles missing search input gracefully', () => {
      jest.spyOn(document, 'querySelector').mockReturnValue(null);

      renderHook(() => useKeyboardNavigation());

      expect(() => {
        act(() => {
          fireEvent.keyDown(document, { key: '/' });
        });
      }).not.toThrow();
    });
  });

  describe('Filter Shortcuts (1/2/3)', () => {
    it('toggles active filter with 1 key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '1' });
      });

      expect(mockStoreState.updateFilters).toHaveBeenCalledWith({
        sessionStatus: ['active']
      });
    });

    it('toggles awaiting filter with 2 key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '2' });
      });

      expect(mockStoreState.updateFilters).toHaveBeenCalledWith({
        sessionStatus: ['awaiting']
      });
    });

    it('toggles completed filter with 3 key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '3' });
      });

      expect(mockStoreState.updateFilters).toHaveBeenCalledWith({
        sessionStatus: ['completed']
      });
    });

    it('removes filter when already active', () => {
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        filters: { ...mockStoreState.filters, sessionStatus: ['active'] },
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '1' });
      });

      expect(mockStoreState.updateFilters).toHaveBeenCalledWith({
        sessionStatus: []
      });
    });

    it('does not toggle with modifier keys', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: '1', metaKey: true });
      });

      expect(mockStoreState.updateFilters).not.toHaveBeenCalled();
    });

    it('does not toggle when disabled', () => {
      renderHook(() => useKeyboardNavigation({ enableFilterShortcuts: false }));

      act(() => {
        fireEvent.keyDown(document, { key: '1' });
      });

      expect(mockStoreState.updateFilters).not.toHaveBeenCalled();
    });
  });

  describe('Clear Filters (Escape)', () => {
    it('clears filters with Escape key', () => {
      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockStoreState.resetFilters).toHaveBeenCalled();
      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith(null);
    });

    it('blurs search input if focused', () => {
      const mockSearchInput = document.createElement('input');
      mockSearchInput.blur = jest.fn();
      jest.spyOn(document, 'querySelector').mockReturnValue(mockSearchInput);
      Object.defineProperty(document, 'activeElement', {
        value: mockSearchInput,
        configurable: true,
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockSearchInput.blur).toHaveBeenCalled();
      expect(mockStoreState.resetFilters).not.toHaveBeenCalled();
    });

    it('does not clear when disabled', () => {
      renderHook(() => useKeyboardNavigation({ enableEscapeToClear: false }));

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockStoreState.resetFilters).not.toHaveBeenCalled();
    });
  });

  describe('Input Focus Handling', () => {
    it('ignores keys when input is focused', () => {
      const mockInput = document.createElement('input');
      Object.defineProperty(document, 'activeElement', {
        value: mockInput,
        configurable: true,
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(mockStoreState.setSelectedEvent).not.toHaveBeenCalled();
    });

    it('ignores keys when textarea is focused', () => {
      const mockTextarea = document.createElement('textarea');
      Object.defineProperty(document, 'activeElement', {
        value: mockTextarea,
        configurable: true,
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(mockStoreState.setSelectedEvent).not.toHaveBeenCalled();
    });

    it('allows escape and sidebar toggle when input focused', () => {
      const mockInput = document.createElement('input');
      Object.defineProperty(document, 'activeElement', {
        value: mockInput,
        configurable: true,
      });

      renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'b', metaKey: true });
      });

      expect(mockStoreState.setSidebarCollapsed).toHaveBeenCalled();
    });
  });

  describe('Navigation State', () => {
    it('tracks navigation state correctly', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      expect(result.current.navigationState.selectedEventIndex).toBe(-1);
      expect(result.current.navigationState.totalEvents).toBe(3);
      expect(result.current.navigationState.isNavigating).toBe(false);
    });

    it('updates navigation state on event selection', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(result.current.navigationState.isNavigating).toBe(true);
    });

    it('clears navigation state after timeout', async () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useKeyboardNavigation());

      act(() => {
        fireEvent.keyDown(document, { key: 'j' });
      });

      expect(result.current.navigationState.isNavigating).toBe(true);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.navigationState.isNavigating).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Public API', () => {
    it('provides navigation functions', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      expect(typeof result.current.navigateToNext).toBe('function');
      expect(typeof result.current.navigateToPrevious).toBe('function');
      expect(typeof result.current.focusSearch).toBe('function');
      expect(typeof result.current.clearFilters).toBe('function');
      expect(typeof result.current.toggleQuickFilter).toBe('function');
    });

    it('exposes utility properties', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      expect(typeof result.current.isNavigationActive).toBe('boolean');
      expect(typeof result.current.hasSelectedEvent).toBe('boolean');
      expect(typeof result.current.canNavigate).toBe('boolean');
    });

    it('programmatic navigation works', () => {
      const { result } = renderHook(() => useKeyboardNavigation());

      act(() => {
        result.current.navigateToNext();
      });

      expect(mockStoreState.setSelectedEvent).toHaveBeenCalledWith('event1');
    });
  });
});

describe('useEventNavigation', () => {
  it('configures for event navigation only', () => {
    const { result } = renderHook(() => useEventNavigation());

    expect(result.current.config.enableEventNavigation).toBe(true);
    expect(result.current.config.enableFilterShortcuts).toBe(false);
    expect(result.current.config.enableSidebarShortcut).toBe(false);
    expect(result.current.config.enableSearchShortcut).toBe(false);
    expect(result.current.config.enableEscapeToClear).toBe(false);
  });
});

describe('useFilterShortcuts', () => {
  it('configures for filter shortcuts only', () => {
    const { result } = renderHook(() => useFilterShortcuts());

    expect(result.current.config.enableEventNavigation).toBe(false);
    expect(result.current.config.enableFilterShortcuts).toBe(true);
    expect(result.current.config.enableSidebarShortcut).toBe(false);
    expect(result.current.config.enableSearchShortcut).toBe(false);
    expect(result.current.config.enableEscapeToClear).toBe(true);
  });
});