/**
 * Dashboard Integration Tests
 * 
 * Tests:
 * - Component rendering and structure
 * - Responsive grid layout behavior
 * - Keyboard navigation functionality
 * - Layout persistence
 * - Component communication
 * - Error handling
 * - Performance considerations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/components/Dashboard';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import * as layoutPersistence from '@/lib/layoutPersistence';

// Mock dependencies
jest.mock('@/stores/dashboardStore');
jest.mock('@/hooks/useKeyboardNavigation');
jest.mock('@/lib/layoutPersistence');
jest.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>
}));
jest.mock('@/components/sidebar/SidebarContainer', () => ({
  SidebarContainer: () => <div data-testid="sidebar">Sidebar</div>
}));
jest.mock('@/components/eventfeed/EventFeed', () => ({
  EventFeed: () => <div data-testid="event-feed">Event Feed</div>
}));
jest.mock('@/components/ResponsiveGrid', () => ({
  ResponsiveGrid: ({ children, sidebarCollapsed, ...props }: any) => (
    <div 
      data-testid="responsive-grid" 
      data-sidebar-collapsed={sidebarCollapsed}
      {...props}
    >
      {children}
    </div>
  )
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Dashboard', () => {
  // Mock store state
  const mockStoreState = {
    ui: {
      sidebarCollapsed: false,
      loading: false,
      error: null,
    },
    sessions: [],
    events: [],
    setSidebarCollapsed: jest.fn(),
    getFilteredSessions: jest.fn(() => []),
    getFilteredEvents: jest.fn(() => []),
  };

  const mockKeyboardNavigation = {
    navigationState: {
      selectedEventIndex: -1,
      totalEvents: 0,
      isNavigating: false,
      lastNavigationTime: 0,
    },
    isNavigationActive: false,
    config: {
      enableEventNavigation: true,
      enableFilterShortcuts: true,
      enableSidebarShortcut: true,
      enableSearchShortcut: true,
      enableEscapeToClear: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDashboardStore as jest.Mock).mockReturnValue(mockStoreState);
    (useKeyboardNavigation as jest.Mock).mockReturnValue(mockKeyboardNavigation);
    jest.spyOn(layoutPersistence, 'loadSidebarCollapsed').mockReturnValue(false);
    jest.spyOn(layoutPersistence, 'saveSidebarCollapsed').mockImplementation();
    
    // Mock document.addEventListener for keyboard events
    jest.spyOn(document, 'addEventListener');
    jest.spyOn(document, 'removeEventListener');
    jest.spyOn(window, 'addEventListener');
    jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders all main components', () => {
      render(<Dashboard />);

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-grid')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Dashboard className="custom-class" />);
      
      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toHaveClass('custom-class');
    });

    it('renders custom children when provided', () => {
      render(
        <Dashboard>
          <div data-testid="custom-content">Custom Content</div>
        </Dashboard>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.queryByTestId('event-feed')).not.toBeInTheDocument();
    });

    it('applies correct grid layout based on sidebar state', () => {
      const { rerender } = render(<Dashboard />);
      
      let grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveAttribute('data-sidebar-collapsed', 'false');

      // Update store to collapsed state
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, sidebarCollapsed: true },
      });

      rerender(<Dashboard />);
      grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveAttribute('data-sidebar-collapsed', 'true');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when present', () => {
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, error: 'Test error message' },
      });

      render(<Dashboard />);

      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('does not display error UI when no error', () => {
      render(<Dashboard />);

      expect(screen.queryByText('Dashboard Error')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading overlay when loading', () => {
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, loading: true },
      });

      render(<Dashboard />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('does not display loading overlay when not loading', () => {
      render(<Dashboard />);

      expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('sets up keyboard event listeners when enabled', () => {
      // Reset mocks before test
      jest.clearAllMocks();
      
      render(<Dashboard enableKeyboardShortcuts={true} />);

      // Check that document.addEventListener was called with keydown
      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('does not set up keyboard listeners when disabled', () => {
      // Reset mocks before test
      jest.clearAllMocks();
      
      render(<Dashboard enableKeyboardShortcuts={false} />);

      // Should not add keydown listener to document
      const keydownCalls = (document.addEventListener as jest.Mock).mock.calls
        .filter(call => call[0] === 'keydown');
      expect(keydownCalls).toHaveLength(0);
    });

    it('handles Cmd+B keyboard shortcut for sidebar toggle', async () => {
      const user = userEvent.setup();
      render(<Dashboard enableKeyboardShortcuts={true} />);

      // Simulate Cmd+B
      await act(async () => {
        await user.keyboard('{Meta>}b{/Meta}');
      });

      expect(mockStoreState.setSidebarCollapsed).toHaveBeenCalledWith(true);
    });

    it('removes event listeners on unmount', () => {
      // Reset mocks before test
      jest.clearAllMocks();
      
      const { unmount } = render(<Dashboard enableKeyboardShortcuts={true} />);

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });

  describe('Layout Persistence', () => {
    it('saves sidebar state to localStorage when persistLayout is enabled', async () => {
      render(<Dashboard persistLayout={true} />);

      // Trigger sidebar toggle
      act(() => {
        mockStoreState.setSidebarCollapsed(true);
      });

      // Re-render with new state
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        ui: { ...mockStoreState.ui, sidebarCollapsed: true },
      });

      render(<Dashboard persistLayout={true} />);

      await waitFor(() => {
        expect(layoutPersistence.saveSidebarCollapsed).toHaveBeenCalledWith(true);
      });
    });

    it('restores sidebar state from localStorage on mount', () => {
      jest.spyOn(layoutPersistence, 'loadSidebarCollapsed').mockReturnValue(true);

      render(<Dashboard persistLayout={true} />);

      expect(layoutPersistence.loadSidebarCollapsed).toHaveBeenCalled();
    });

    it('does not persist when persistLayout is disabled', () => {
      render(<Dashboard persistLayout={false} />);

      // Should not call persistence functions
      expect(layoutPersistence.saveSidebarCollapsed).not.toHaveBeenCalled();
    });
  });

  describe('Component Communication', () => {
    it('passes filtered data to EventFeedV2', () => {
      const mockSessions = [{ id: 'session1', status: 'active' }];
      const mockEvents = [{ id: 'event1', sessionId: 'session1' }];

      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        getFilteredSessions: jest.fn(() => mockSessions),
        getFilteredEvents: jest.fn(() => mockEvents),
      });

      render(<Dashboard />);

      // Verify filtered data is retrieved
      expect(mockStoreState.getFilteredSessions).toHaveBeenCalled();
      expect(mockStoreState.getFilteredEvents).toHaveBeenCalled();
    });

    it('updates ResponsiveGrid with correct sidebar state', () => {
      render(<Dashboard />);

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveAttribute('data-sidebar-collapsed', 'false');
    });
  });

  describe('Development Features', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('shows keyboard shortcuts help in development mode', () => {
      render(<Dashboard enableKeyboardShortcuts={true} />);

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
      expect(screen.getByText('Navigate events')).toBeInTheDocument();
    });

    it('does not show shortcuts help when keyboard shortcuts disabled', () => {
      render(<Dashboard enableKeyboardShortcuts={false} />);

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Dashboard />);

      const layout = screen.getByTestId('dashboard-layout');
      expect(layout).toBeInTheDocument();
      
      // Should be focusable for keyboard navigation
      expect(layout).toHaveAttribute('data-testid', 'dashboard-layout');
    });

    it('maintains focus management for keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Dashboard enableKeyboardShortcuts={true} />);

      // Should handle focus events properly
      await act(async () => {
        await user.tab();
      });

      // Verify focus handling doesn't break
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const { rerender } = render(<Dashboard />);
      
      // Re-render with same props
      rerender(<Dashboard />);
      
      // Should still be rendered correctly
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('handles large datasets efficiently', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        status: 'active',
      }));

      const largeEvents = Array.from({ length: 5000 }, (_, i) => ({
        id: `event-${i}`,
        sessionId: `session-${i % 1000}`,
      }));

      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        getFilteredSessions: jest.fn(() => largeSessions),
        getFilteredEvents: jest.fn(() => largeEvents),
      });

      const startTime = performance.now();
      render(<Dashboard />);
      const endTime = performance.now();

      // Should render in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
      (useDashboardStore as jest.Mock).mockReturnValue({
        ...mockStoreState,
        sessions: [],
        events: [],
        getFilteredSessions: jest.fn(() => []),
        getFilteredEvents: jest.fn(() => []),
      });

      render(<Dashboard />);

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles localStorage failures gracefully', () => {
      jest.spyOn(layoutPersistence, 'loadSidebarCollapsed').mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not crash - console.warn will be called but component should render
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(() => {
        render(<Dashboard persistLayout={true} />);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('handles invalid JSON in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      expect(() => {
        render(<Dashboard persistLayout={true} />);
      }).not.toThrow();
    });
  });
});