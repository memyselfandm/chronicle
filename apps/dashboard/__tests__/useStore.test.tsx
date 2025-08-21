/**
 * Tests for optimized store hooks
 * Tests hook behavior, subscription management, and performance optimizations
 */

import { renderHook, act } from '@testing-library/react';
import { 
  useDashboardData,
  useRealTimeConnection,
  useEventSubscription,
  useSessionEvents,
  usePerformanceMonitoring,
  useUIState,
  useFilters,
  useBulkOperations,
  useStoreDebug
} from '../src/hooks/useStore';
import { useDashboardStore } from '../src/stores/dashboardStore';
import { SubscriptionType } from '../src/types/chronicle';

// Mock the store
jest.mock('../src/stores/dashboardStore');
const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

describe('Store Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useDashboardData', () => {
    it('should return filtered sessions and events', () => {
      const mockStore = {
        getFilteredSessions: jest.fn(() => [{ id: 'session-1' }]),
        getFilteredEvents: jest.fn(() => [{ id: 'event-1' }]),
        ui: { loading: false, error: null },
        getActiveSessionsCount: jest.fn(() => 2),
        getTotalEventsCount: jest.fn(() => 10),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          return selector(mockStore);
        }
        return mockStore;
      });

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.sessions).toEqual([{ id: 'session-1' }]);
      expect(result.current.events).toEqual([{ id: 'event-1' }]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.stats.activeSessions).toBe(2);
      expect(result.current.stats.totalEvents).toBe(10);
    });

    it('should use memoized selectors to prevent unnecessary re-renders', () => {
      const mockStore = {
        getFilteredSessions: jest.fn(() => []),
        getFilteredEvents: jest.fn(() => []),
        ui: { loading: false, error: null },
        getActiveSessionsCount: jest.fn(() => 0),
        getTotalEventsCount: jest.fn(() => 0),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => selector(mockStore));

      const { result, rerender } = renderHook(() => useDashboardData());

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // Should return same reference due to memoization
      expect(firstResult.sessions).toBe(secondResult.sessions);
      expect(firstResult.events).toBe(secondResult.events);
    });
  });

  describe('useRealTimeConnection', () => {
    it('should provide real-time connection controls', () => {
      const mockStore = {
        realtime: {
          connectionStatus: 'connected',
          isRealTimeEnabled: true,
        },
        getRealTimeMetrics: jest.fn(() => ({ throughput: 100 })),
        initializeRealtime: jest.fn(),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn(),
        getConnectionHealth: jest.fn(() => ({ isHealthy: true })),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          return selector(mockStore);
        }
        return mockStore;
      });

      const { result } = renderHook(() => useRealTimeConnection());

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.metrics.throughput).toBe(100);
      expect(typeof result.current.initialize).toBe('function');
      expect(typeof result.current.enable).toBe('function');
      expect(typeof result.current.disable).toBe('function');
    });

    it('should call store methods correctly', async () => {
      const mockStore = {
        realtime: {
          connectionStatus: 'disconnected',
          isRealTimeEnabled: false,
        },
        getRealTimeMetrics: jest.fn(() => ({})),
        initializeRealtime: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn(),
        getConnectionHealth: jest.fn(),
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const { result } = renderHook(() => useRealTimeConnection());

      await act(async () => {
        await result.current.initialize('ws://test');
      });

      act(() => {
        result.current.enable();
      });

      act(() => {
        result.current.disable();
      });

      expect(mockStore.initializeRealtime).toHaveBeenCalledWith('ws://test');
      expect(mockStore.enableRealTime).toHaveBeenCalled();
      expect(mockStore.disableRealTime).toHaveBeenCalled();
    });
  });

  describe('useEventSubscription', () => {
    it('should manage subscription lifecycle', async () => {
      const mockStore = {
        subscribeToEvents: jest.fn().mockResolvedValue('sub-123'),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
          },
        },
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const { result } = renderHook(() => useEventSubscription());

      const config = {
        type: SubscriptionType.SESSION_EVENTS,
        sessionId: 'session-1',
        autoReconnect: true,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
      };

      const handler = jest.fn();

      await act(async () => {
        const subscriptionId = await result.current.subscribe(config, handler);
        expect(subscriptionId).toBe('sub-123');
      });

      expect(mockStore.subscribeToEvents).toHaveBeenCalledWith(config);
      expect(result.current.isSubscribed).toBe(true);

      act(() => {
        result.current.unsubscribe();
      });

      expect(mockStore.unsubscribeFromEvents).toHaveBeenCalledWith('sub-123');
      expect(result.current.isSubscribed).toBe(false);
    });

    it('should auto-subscribe when config and handler are provided', () => {
      const mockStore = {
        subscribeToEvents: jest.fn().mockResolvedValue('sub-123'),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn(() => jest.fn()),
          },
        },
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const config = {
        type: SubscriptionType.ALL_EVENTS,
        autoReconnect: true,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
      };

      const handler = jest.fn();

      renderHook(() => useEventSubscription(config, handler, ['test-dep']));

      expect(mockStore.subscribeToEvents).toHaveBeenCalledWith(config);
    });

    it('should clean up subscription on unmount', () => {
      const mockStore = {
        subscribeToEvents: jest.fn().mockResolvedValue('sub-123'),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn(() => jest.fn()),
          },
        },
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const config = {
        type: SubscriptionType.ALL_EVENTS,
        autoReconnect: true,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
      };

      const { unmount } = renderHook(() => useEventSubscription(config, jest.fn()));

      unmount();

      expect(mockStore.unsubscribeFromEvents).toHaveBeenCalled();
    });
  });

  describe('useSessionEvents', () => {
    it('should create session-specific subscription', () => {
      const mockStore = {
        subscribeToEvents: jest.fn().mockResolvedValue('sub-session'),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn(() => jest.fn()),
          },
        },
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const { result } = renderHook(() => useSessionEvents('session-123', true));

      expect(result.current.sessionId).toBe('session-123');
      expect(mockStore.subscribeToEvents).toHaveBeenCalledWith({
        type: SubscriptionType.SESSION_EVENTS,
        sessionId: 'session-123',
        autoReconnect: true,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
      });
    });

    it('should not auto-subscribe when sessionId is null', () => {
      const mockStore = {
        subscribeToEvents: jest.fn(),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn(() => jest.fn()),
          },
        },
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      renderHook(() => useSessionEvents(null, true));

      expect(mockStore.subscribeToEvents).not.toHaveBeenCalled();
    });

    it('should filter events for specific session', () => {
      const mockStore = {
        subscribeToEvents: jest.fn().mockResolvedValue('sub-session'),
        unsubscribeFromEvents: jest.fn(),
        realtime: {
          connectionManager: {
            subscribe: jest.fn((eventType: string, handler: Function) => {
              // Simulate receiving events
              handler({ session_id: 'session-123', type: 'test' });
              handler({ session_id: 'other-session', type: 'test' });
              return jest.fn();
            }),
          },
        },
      };

      console.log = jest.fn();
      mockUseDashboardStore.mockReturnValue(mockStore);

      renderHook(() => useSessionEvents('session-123', true));

      // Should only log event for matching session
      expect(console.log).toHaveBeenCalledWith('Session event received:', {
        session_id: 'session-123',
        type: 'test'
      });
      expect(console.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('usePerformanceMonitoring', () => {
    it('should return throttled performance metrics', () => {
      const mockMetrics = {
        connectionHealth: { isHealthy: true, metrics: { averageLatency: 50 } },
        batcherMetrics: { throughput: 100 }
      };

      const mockSubscriptionStatus = {
        active: 5,
        healthy: 4,
        total: 5
      };

      const mockStore = {
        getRealTimeMetrics: jest.fn(() => mockMetrics),
        getSubscriptionStatus: jest.fn(() => mockSubscriptionStatus),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => selector(mockStore));

      const { result } = renderHook(() => usePerformanceMonitoring(1000));

      expect(result.current.isHealthy).toBe(true);
      expect(result.current.connectionLatency).toBe(50);
      expect(result.current.eventThroughput).toBe(100);
      expect(result.current.subscriptionStatus).toEqual(mockSubscriptionStatus);
    });
  });

  describe('useUIState', () => {
    it('should provide UI state and setters', () => {
      const mockStore = {
        ui: {
          theme: 'dark',
          loading: false,
          error: null,
          selectedSession: 'session-1',
          selectedEvent: null,
          modalOpen: false,
          sidebarCollapsed: false,
        },
        setLoading: jest.fn(),
        setError: jest.fn(),
        setSelectedSession: jest.fn(),
        setSelectedEvent: jest.fn(),
        setModalOpen: jest.fn(),
        setSidebarCollapsed: jest.fn(),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          return selector(mockStore);
        }
        return mockStore;
      });

      const { result } = renderHook(() => useUIState());

      expect(result.current.theme).toBe('dark');
      expect(result.current.selectedSession).toBe('session-1');
      expect(typeof result.current.setLoading).toBe('function');
      expect(typeof result.current.setError).toBe('function');
    });
  });

  describe('useFilters', () => {
    it('should provide filter state and actions', () => {
      const mockFilters = {
        dateRange: { start: new Date(), end: new Date() },
        eventTypes: ['type1', 'type2'],
        sessionStatus: ['active'],
        searchTerm: 'test'
      };

      const mockStore = {
        filters: mockFilters,
        updateFilters: jest.fn(),
        resetFilters: jest.fn(),
      };

      mockUseDashboardStore.mockImplementation((selector: any) => selector(mockStore));

      const { result } = renderHook(() => useFilters());

      expect(result.current.filters).toEqual(mockFilters);
      expect(typeof result.current.updateFilters).toBe('function');
      expect(typeof result.current.resetFilters).toBe('function');
    });
  });

  describe('useBulkOperations', () => {
    it('should provide bulk operation functions', () => {
      const mockStore = {
        addSession: jest.fn(),
        addEventsBatch: jest.fn(),
        setSessions: jest.fn(),
        setEvents: jest.fn(),
        resetFilters: jest.fn(),
        getState: jest.fn(() => ({
          sessions: [],
          events: [],
          filters: {}
        })),
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const { result } = renderHook(() => useBulkOperations());

      const sessions = [{ id: 'session-1' }, { id: 'session-2' }];
      const events = [{ id: 'event-1' }, { id: 'event-2' }];

      act(() => {
        result.current.addMultipleSessions(sessions);
      });

      act(() => {
        result.current.addMultipleEvents(events);
      });

      act(() => {
        result.current.clearAllData();
      });

      expect(mockStore.addSession).toHaveBeenCalledTimes(2);
      expect(mockStore.addEventsBatch).toHaveBeenCalledWith(events);
      expect(mockStore.setSessions).toHaveBeenCalledWith([]);
      expect(mockStore.setEvents).toHaveBeenCalledWith([]);
      expect(mockStore.resetFilters).toHaveBeenCalled();
    });

    it('should export data correctly', () => {
      const mockState = {
        sessions: [{ id: 'session-1' }],
        events: [{ id: 'event-1' }],
        filters: { searchTerm: 'test' }
      };

      const mockStore = {
        getState: jest.fn(() => mockState),
      };

      mockUseDashboardStore.mockReturnValue(mockStore);

      const { result } = renderHook(() => useBulkOperations());

      const exported = result.current.exportData();

      expect(exported.sessions).toEqual(mockState.sessions);
      expect(exported.events).toEqual(mockState.events);
      expect(exported.filters).toEqual(mockState.filters);
      expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('useStoreDebug', () => {
    it('should provide debug functions', () => {
      const mockStore = {
        getState: jest.fn(() => ({ test: 'data' })),
        getRealTimeMetrics: jest.fn(() => ({ metrics: 'data' })),
        getSubscriptionStatus: jest.fn(() => ({ status: 'data' })),
        getConnectionHealth: jest.fn(() => ({ health: 'data' })),
      };

      mockUseDashboardStore.mockReturnValue(mockStore);
      console.log = jest.fn();

      const { result } = renderHook(() => useStoreDebug());

      act(() => {
        result.current.logState();
        result.current.logMetrics();
        result.current.logSubscriptions();
        result.current.logHealth();
      });

      expect(console.log).toHaveBeenCalledWith('Dashboard Store State:', { test: 'data' });
      expect(console.log).toHaveBeenCalledWith('Real-time Metrics:', { metrics: 'data' });
      expect(console.log).toHaveBeenCalledWith('Subscription Status:', { status: 'data' });
      expect(console.log).toHaveBeenCalledWith('Connection Health:', { health: 'data' });
    });
  });
});