/**
 * Optimized store access hooks for Chronicle Dashboard
 * Provides efficient patterns for Zustand state management with selectors
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import {
  SubscriptionType,
  SubscriptionConfig,
  UnsubscribeFunction,
  EventHandler
} from '../types/chronicle';

/**
 * Hook for optimized store access with shallow comparison
 * Prevents unnecessary re-renders by using selectors
 */
export const useStoreSelector = <T>(selector: (state: any) => T, compare?: (a: T, b: T) => boolean) => {
  return useDashboardStore(selector, compare);
};

/**
 * Hook for accessing frequently used dashboard data with optimizations
 */
export const useDashboardData = () => {
  // Use selectors to prevent unnecessary re-renders
  const sessions = useDashboardStore(useCallback((state) => state.getFilteredSessions(), []));
  const events = useDashboardStore(useCallback((state) => state.getFilteredEvents(), []));
  const loading = useDashboardStore(useCallback((state) => state.ui.loading, []));
  const error = useDashboardStore(useCallback((state) => state.ui.error, []));
  
  const stats = useDashboardStore(useCallback((state) => ({
    activeSessions: state.getActiveSessionsCount(),
    totalEvents: state.getTotalEventsCount(),
    filteredSessionsCount: state.getFilteredSessions().length,
    filteredEventsCount: state.getFilteredEvents().length,
  }), []));

  return {
    sessions,
    events,
    loading,
    error,
    stats
  };
};

/**
 * Hook for real-time connection management
 */
export const useRealTimeConnection = () => {
  const store = useDashboardStore();
  
  const connectionStatus = useDashboardStore(
    useCallback((state) => state.realtime.connectionStatus, [])
  );
  
  const isEnabled = useDashboardStore(
    useCallback((state) => state.realtime.isRealTimeEnabled, [])
  );
  
  const metrics = useDashboardStore(
    useCallback((state) => state.getRealTimeMetrics(), [])
  );

  const initialize = useCallback(async (websocketUrl: string) => {
    return store.initializeRealtime(websocketUrl);
  }, [store]);

  const enable = useCallback(() => {
    store.enableRealTime();
  }, [store]);

  const disable = useCallback(() => {
    store.disableRealTime();
  }, [store]);

  const getHealth = useCallback(() => {
    return store.getConnectionHealth();
  }, [store]);

  return {
    connectionStatus,
    isEnabled,
    metrics,
    initialize,
    enable,
    disable,
    getHealth
  };
};

/**
 * Hook for managing event subscriptions with automatic cleanup
 */
export const useEventSubscription = (
  config?: SubscriptionConfig,
  handler?: EventHandler,
  deps: any[] = []
) => {
  const store = useDashboardStore();
  const subscriptionIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<UnsubscribeFunction | null>(null);

  const subscribe = useCallback(async (
    subscriptionConfig: SubscriptionConfig,
    eventHandler?: EventHandler
  ) => {
    // Clean up existing subscription
    if (subscriptionIdRef.current) {
      store.unsubscribeFromEvents(subscriptionIdRef.current);
    }
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    try {
      // Create new subscription
      const subscriptionId = await store.subscribeToEvents(subscriptionConfig);
      subscriptionIdRef.current = subscriptionId;

      // Set up event handler if provided
      if (eventHandler && store.realtime.connectionManager) {
        const unsubscribe = store.realtime.connectionManager.subscribe(
          '*', // Listen to all events - filter in handler
          eventHandler
        );
        unsubscribeRef.current = unsubscribe;
      }

      return subscriptionId;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }, [store]);

  const unsubscribe = useCallback(() => {
    if (subscriptionIdRef.current) {
      store.unsubscribeFromEvents(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, [store]);

  // Auto-subscribe when config and handler are provided
  useEffect(() => {
    if (config && handler) {
      subscribe(config, handler).catch(console.error);
    }

    return () => {
      unsubscribe();
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    subscribe,
    unsubscribe,
    subscriptionId: subscriptionIdRef.current,
    isSubscribed: subscriptionIdRef.current !== null
  };
};

/**
 * Hook for session-specific event subscriptions
 */
export const useSessionEvents = (sessionId: string | null, autoSubscribe = true) => {
  const config: SubscriptionConfig | undefined = sessionId ? {
    type: SubscriptionType.SESSION_EVENTS,
    sessionId,
    autoReconnect: true,
    heartbeatInterval: 30000,
    maxMissedHeartbeats: 3
  } : undefined;

  const handler = useCallback((event: any) => {
    // Filter events for this specific session
    if (event.session_id === sessionId) {
      console.log('Session event received:', event);
    }
  }, [sessionId]);

  const { subscribe, unsubscribe, subscriptionId, isSubscribed } = useEventSubscription(
    autoSubscribe ? config : undefined,
    autoSubscribe ? handler : undefined,
    [sessionId, autoSubscribe]
  );

  return {
    subscribe: () => config ? subscribe(config, handler) : Promise.reject('No session ID'),
    unsubscribe,
    subscriptionId,
    isSubscribed,
    sessionId
  };
};

/**
 * Hook for performance monitoring with throttling
 */
export const usePerformanceMonitoring = (intervalMs = 5000) => {
  const metrics = useDashboardStore(
    useCallback((state) => state.getRealTimeMetrics(), [])
  );

  const subscriptionStatus = useDashboardStore(
    useCallback((state) => state.getSubscriptionStatus(), [])
  );

  // Throttle metrics updates to prevent excessive re-renders
  const throttledMetrics = useThrottledValue(metrics, intervalMs);
  const throttledSubscriptionStatus = useThrottledValue(subscriptionStatus, intervalMs);

  return {
    metrics: throttledMetrics,
    subscriptionStatus: throttledSubscriptionStatus,
    isHealthy: throttledMetrics.connectionHealth?.isHealthy || false,
    connectionLatency: throttledMetrics.connectionHealth?.metrics?.averageLatency || 0,
    eventThroughput: throttledMetrics.batcherMetrics?.throughput || 0
  };
};

/**
 * Hook for UI state management with optimized selectors
 */
export const useUIState = () => {
  const ui = useDashboardStore(useCallback((state) => state.ui, []));
  const setLoading = useDashboardStore(useCallback((state) => state.setLoading, []));
  const setError = useDashboardStore(useCallback((state) => state.setError, []));
  const setSelectedSession = useDashboardStore(useCallback((state) => state.setSelectedSession, []));
  const setSelectedEvent = useDashboardStore(useCallback((state) => state.setSelectedEvent, []));
  const setModalOpen = useDashboardStore(useCallback((state) => state.setModalOpen, []));
  const setSidebarCollapsed = useDashboardStore(useCallback((state) => state.setSidebarCollapsed, []));

  return {
    ...ui,
    setLoading,
    setError,
    setSelectedSession,
    setSelectedEvent,
    setModalOpen,
    setSidebarCollapsed
  };
};

/**
 * Hook for filter state management
 */
export const useFilters = () => {
  const filters = useDashboardStore(useCallback((state) => state.filters, []));
  const updateFilters = useDashboardStore(useCallback((state) => state.updateFilters, []));
  const resetFilters = useDashboardStore(useCallback((state) => state.resetFilters, []));

  return {
    filters,
    updateFilters,
    resetFilters
  };
};

/**
 * Utility hook for throttling values to prevent excessive updates
 */
const useThrottledValue = <T>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = useStoreValue(value);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= delay) {
      setThrottledValue(value);
      lastUpdateRef.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastUpdateRef.current = Date.now();
      }, delay - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, delay, setThrottledValue]);

  return throttledValue;
};

/**
 * Custom hook for managing local state that syncs with a value
 */
const useStoreValue = <T>(initialValue: T): [T, (value: T) => void] => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return [value, setValue];
};

// Import useState for the helper hook
import { useState } from 'react';

/**
 * Hook for bulk operations on the store
 */
export const useBulkOperations = () => {
  const store = useDashboardStore();

  const addMultipleSessions = useCallback((sessions: any[]) => {
    sessions.forEach(session => store.addSession(session));
  }, [store]);

  const addMultipleEvents = useCallback((events: any[]) => {
    store.addEventsBatch(events);
  }, [store]);

  const clearAllData = useCallback(() => {
    store.setSessions([]);
    store.setEvents([]);
    store.resetFilters();
  }, [store]);

  const exportData = useCallback(() => {
    const state = store.getState();
    return {
      sessions: state.sessions,
      events: state.events,
      filters: state.filters,
      exportedAt: new Date().toISOString()
    };
  }, [store]);

  return {
    addMultipleSessions,
    addMultipleEvents,
    clearAllData,
    exportData
  };
};

/**
 * Hook for debugging store state (development only)
 */
export const useStoreDebug = () => {
  const store = useDashboardStore();

  const logState = useCallback(() => {
    console.log('Dashboard Store State:', store.getState());
  }, [store]);

  const logMetrics = useCallback(() => {
    console.log('Real-time Metrics:', store.getRealTimeMetrics());
  }, [store]);

  const logSubscriptions = useCallback(() => {
    console.log('Subscription Status:', store.getSubscriptionStatus());
  }, [store]);

  const logHealth = useCallback(() => {
    console.log('Connection Health:', store.getConnectionHealth());
  }, [store]);

  return {
    logState,
    logMetrics,
    logSubscriptions,
    logHealth
  };
};