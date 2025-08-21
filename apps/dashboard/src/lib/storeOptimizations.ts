/**
 * Zustand store optimizations for minimal re-renders and high performance
 * Implements selective subscriptions and optimized state updates
 */

import { useEffect, useRef, useMemo } from 'react';
import { subscribeWithSelector } from 'zustand/middleware';
import { useDashboardStore, SessionData, EventData } from '@/stores/dashboardStore';
import { getPerformanceMonitor } from './performanceMonitor';

// Optimized selectors that prevent unnecessary re-renders
export const optimizedSelectors = {
  // Sessions selectors
  sessionCount: (state: any) => state.sessions.length,
  activeSessionCount: (state: any) => state.sessions.filter((s: SessionData) => s.status === 'active').length,
  sessionIds: (state: any) => state.sessions.map((s: SessionData) => s.id),
  selectedSessionIds: (state: any) => state.filters.selectedSessions,
  
  // Events selectors
  eventCount: (state: any) => state.events.length,
  recentEvents: (state: any) => state.events.slice(-50), // Last 50 events
  eventTypes: (state: any) => [...new Set(state.events.map((e: EventData) => e.type))],
  
  // UI selectors
  isLoading: (state: any) => state.ui.loading,
  hasError: (state: any) => state.ui.error !== null,
  sidebarCollapsed: (state: any) => state.ui.sidebarCollapsed,
  
  // Real-time selectors
  connectionStatus: (state: any) => state.realtime.connectionStatus,
  isRealTimeEnabled: (state: any) => state.realtime.isRealTimeEnabled,
  lastEventReceived: (state: any) => state.realtime.lastEventReceived,
};

// Performance-optimized hooks for specific data slices
export const useOptimizedSessions = () => {
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  
  return useDashboardStore(
    useRef((state) => {
      performanceMonitor.trackComponentRender('useOptimizedSessions', 0);
      return {
        sessions: state.sessions,
        filteredSessions: state.getFilteredSessions(),
        activeSessions: state.sessions.filter((s: SessionData) => s.status === 'active'),
        sessionCount: state.sessions.length,
      };
    }).current,
    (prev, next) => 
      prev.sessions === next.sessions &&
      prev.sessionCount === next.sessionCount
  );
};

export const useOptimizedEvents = () => {
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  
  return useDashboardStore(
    useRef((state) => {
      performanceMonitor.trackComponentRender('useOptimizedEvents', 0);
      return {
        events: state.events,
        filteredEvents: state.getFilteredEvents(),
        recentEvents: state.events.slice(-100), // Last 100 events for performance
        eventCount: state.events.length,
      };
    }).current,
    (prev, next) => 
      prev.events === next.events &&
      prev.eventCount === next.eventCount
  );
};

export const useOptimizedFilters = () => {
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  
  return useDashboardStore(
    useRef((state) => {
      performanceMonitor.trackComponentRender('useOptimizedFilters', 0);
      return {
        filters: state.filters,
        selectedSessions: state.filters.selectedSessions,
        searchTerm: state.filters.searchTerm,
        eventTypes: state.filters.eventTypes,
        sessionStatus: state.filters.sessionStatus,
      };
    }).current,
    (prev, next) => 
      prev.filters === next.filters &&
      prev.selectedSessions === next.selectedSessions
  );
};

export const useOptimizedUI = () => {
  return useDashboardStore(
    useRef((state) => ({
      ui: state.ui,
      loading: state.ui.loading,
      error: state.ui.error,
      sidebarCollapsed: state.ui.sidebarCollapsed,
      selectedSession: state.ui.selectedSession,
      selectedEvent: state.ui.selectedEvent,
      modalOpen: state.ui.modalOpen,
    })).current,
    (prev, next) => prev.ui === next.ui
  );
};

export const useOptimizedRealTime = () => {
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  
  return useDashboardStore(
    useRef((state) => {
      performanceMonitor.trackComponentRender('useOptimizedRealTime', 0);
      return {
        realtime: state.realtime,
        connectionStatus: state.realtime.connectionStatus,
        isEnabled: state.realtime.isRealTimeEnabled,
        metrics: state.getRealTimeMetrics(),
        lastEventReceived: state.realtime.lastEventReceived,
      };
    }).current,
    (prev, next) => 
      prev.connectionStatus === next.connectionStatus &&
      prev.isEnabled === next.isEnabled &&
      prev.lastEventReceived === next.lastEventReceived
  );
};

// Batched updates for high-frequency operations
export class BatchedStoreUpdates {
  private updateQueue: Array<() => void> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay: number;

  constructor(batchDelay = 16) { // 60fps = ~16ms
    this.batchDelay = batchDelay;
  }

  public queueUpdate(updateFn: () => void): void {
    this.updateQueue.push(updateFn);
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.flush();
    }, this.batchDelay);
  }

  public flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.updateQueue.length === 0) return;

    // Execute all queued updates in a single batch
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    // Use React's batching mechanism
    updates.forEach(update => update());
  }

  public destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.updateQueue = [];
  }
}

// Global batched updater
let globalBatchedUpdates: BatchedStoreUpdates | null = null;

export const getBatchedUpdates = (): BatchedStoreUpdates => {
  if (!globalBatchedUpdates) {
    globalBatchedUpdates = new BatchedStoreUpdates();
  }
  return globalBatchedUpdates;
};

// Enhanced hooks with batched updates
export const useBatchedSessionUpdates = () => {
  const batchedUpdates = useMemo(() => getBatchedUpdates(), []);
  const store = useDashboardStore();

  const addSession = useMemo(() => (session: SessionData) => {
    batchedUpdates.queueUpdate(() => store.addSession(session));
  }, [batchedUpdates, store.addSession]);

  const updateSession = useMemo(() => (sessionId: string, updates: Partial<SessionData>) => {
    batchedUpdates.queueUpdate(() => store.updateSession(sessionId, updates));
  }, [batchedUpdates, store.updateSession]);

  const removeSession = useMemo(() => (sessionId: string) => {
    batchedUpdates.queueUpdate(() => store.removeSession(sessionId));
  }, [batchedUpdates, store.removeSession]);

  return { addSession, updateSession, removeSession };
};

export const useBatchedEventUpdates = () => {
  const batchedUpdates = useMemo(() => getBatchedUpdates(), []);
  const store = useDashboardStore();

  const addEvent = useMemo(() => (event: EventData) => {
    batchedUpdates.queueUpdate(() => store.addEvent(event));
  }, [batchedUpdates, store.addEvent]);

  const addEventsBatch = useMemo(() => (events: EventData[]) => {
    batchedUpdates.queueUpdate(() => store.addEventsBatch(events));
  }, [batchedUpdates, store.addEventsBatch]);

  const updateEvent = useMemo(() => (eventId: string, updates: Partial<EventData>) => {
    batchedUpdates.queueUpdate(() => store.updateEvent(eventId, updates));
  }, [batchedUpdates, store.updateEvent]);

  return { addEvent, addEventsBatch, updateEvent };
};

// Memory optimization utilities
export const useMemoryOptimization = () => {
  const store = useDashboardStore();
  
  const cleanupOldEvents = useMemo(() => (maxEvents = 1000) => {
    const state = store.getState();
    if (state.events.length > maxEvents) {
      const keepEvents = state.events.slice(-maxEvents);
      store.setEvents(keepEvents);
    }
  }, [store]);

  const cleanupCompletedSessions = useMemo(() => (maxAge = 24 * 60 * 60 * 1000) => {
    const state = store.getState();
    const cutoffTime = new Date(Date.now() - maxAge);
    
    const activeSessions = state.sessions.filter(session => 
      session.status === 'active' || 
      session.status === 'idle' ||
      (session.endTime && session.endTime > cutoffTime)
    );
    
    if (activeSessions.length < state.sessions.length) {
      store.setSessions(activeSessions);
    }
  }, [store]);

  const getMemoryUsage = useMemo(() => () => {
    const state = store.getState();
    return {
      sessions: state.sessions.length,
      events: state.events.length,
      estimatedSizeKB: (state.sessions.length * 0.5) + (state.events.length * 1), // Rough estimate
    };
  }, [store]);

  return {
    cleanupOldEvents,
    cleanupCompletedSessions,
    getMemoryUsage,
  };
};

// Subscription performance monitor
export const useSubscriptionPerformance = () => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);

  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    
    if (timeSinceLastRender > 0) {
      performanceMonitor.trackComponentRender('subscription', timeSinceLastRender);
    }
    
    lastRenderTimeRef.current = now;
  });

  return {
    renderCount: renderCountRef.current,
    getMetrics: () => ({
      renders: renderCountRef.current,
      lastRenderTime: lastRenderTimeRef.current,
    }),
  };
};

// Export convenience hook for all optimizations
export const useStoreOptimizations = () => {
  const sessions = useOptimizedSessions();
  const events = useOptimizedEvents();
  const filters = useOptimizedFilters();
  const ui = useOptimizedUI();
  const realtime = useOptimizedRealTime();
  const memoryOpt = useMemoryOptimization();
  const batchedSessionUpdates = useBatchedSessionUpdates();
  const batchedEventUpdates = useBatchedEventUpdates();

  return {
    // Data
    sessions,
    events,
    filters,
    ui,
    realtime,
    
    // Batched operations
    batchedSessionUpdates,
    batchedEventUpdates,
    
    // Memory management
    memoryOpt,
    
    // Utility
    selectors: optimizedSelectors,
  };
};