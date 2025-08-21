/**
 * Chronicle Dashboard Zustand Store
 * Central state management for dashboard UI and data with real-time capabilities
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools, subscribeWithSelector } from 'zustand/middleware';
import { ConnectionManager } from '../lib/connectionManager';
import { EventBatcher } from '../lib/eventBatcher';
import {
  ChronicleRealtimeState,
  ConnectionManagerState,
  SessionStatus,
  SubscriptionType,
  SubscriptionConfig,
  SubscriptionHealth,
  EventBatch,
  UnsubscribeFunction,
  DEFAULT_CHRONICLE_CONFIG
} from '../types/chronicle';

// Types for dashboard state
export interface SessionData {
  id: string;
  status: 'active' | 'idle' | 'completed';
  startTime: Date;
  endTime?: Date;
  toolsUsed: number;
  eventsCount: number;
  lastActivity: Date;
}

export interface EventData {
  id: string;
  sessionId: string;
  type: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  status: 'active' | 'awaiting' | 'idle' | 'error' | 'info' | 'special';
}

export interface FilterOptions {
  dateRange: {
    start?: Date;
    end?: Date;
  };
  eventTypes: string[];
  sessionStatus: string[];
  searchTerm: string;
}

export interface UIState {
  theme: 'dark';
  sidebarCollapsed: boolean;
  selectedSession: string | null;
  selectedEvent: string | null;
  modalOpen: boolean;
  loading: boolean;
  error: string | null;
}

// Real-time connection state
interface RealtimeState {
  connectionManager: ConnectionManager | null;
  eventBatcher: EventBatcher | null;
  isRealTimeEnabled: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  subscriptions: Map<string, SubscriptionConfig>;
  subscriptionHealth: Map<string, SubscriptionHealth>;
  lastEventReceived: Date | null;
  eventProcessingMetrics: {
    totalProcessed: number;
    averageLatency: number;
    errorCount: number;
    lastBatchProcessed: Date | null;
  };
}

// Main dashboard store interface
interface DashboardStore {
  // Data state
  sessions: SessionData[];
  events: EventData[];
  filters: FilterOptions;
  ui: UIState;
  
  // Real-time state
  realtime: RealtimeState;
  
  // Session actions
  setSessions: (sessions: SessionData[]) => void;
  addSession: (session: SessionData) => void;
  updateSession: (sessionId: string, updates: Partial<SessionData>) => void;
  removeSession: (sessionId: string) => void;
  
  // Event actions
  setEvents: (events: EventData[]) => void;
  addEvent: (event: EventData) => void;
  updateEvent: (eventId: string, updates: Partial<EventData>) => void;
  removeEvent: (eventId: string) => void;
  
  // Filter actions
  updateFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  
  // UI actions
  setSelectedSession: (sessionId: string | null) => void;
  setSelectedEvent: (eventId: string | null) => void;
  setModalOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Real-time actions
  initializeRealtime: (websocketUrl: string) => Promise<void>;
  subscribeToEvents: (config: SubscriptionConfig) => Promise<string>;
  unsubscribeFromEvents: (subscriptionId: string) => void;
  handleEventBatch: (batch: EventBatch) => void;
  updateConnectionStatus: (status: any) => void;
  getConnectionHealth: () => any;
  enableRealTime: () => void;
  disableRealTime: () => void;
  
  // Enhanced event processing
  addEventsBatch: (events: EventData[]) => void;
  processEventQueue: () => void;
  
  // Computed selectors
  getFilteredSessions: () => SessionData[];
  getFilteredEvents: () => EventData[];
  getSessionEvents: (sessionId: string) => EventData[];
  getActiveSessionsCount: () => number;
  getTotalEventsCount: () => number;
  getRealTimeMetrics: () => any;
  getSubscriptionStatus: () => { active: number; healthy: number; total: number };
}

// Default state values
const defaultFilters: FilterOptions = {
  dateRange: {},
  eventTypes: [],
  sessionStatus: [],
  searchTerm: '',
};

const defaultUI: UIState = {
  theme: 'dark',
  sidebarCollapsed: false,
  selectedSession: null,
  selectedEvent: null,
  modalOpen: false,
  loading: false,
  error: null,
};

const defaultRealtimeState: RealtimeState = {
  connectionManager: null,
  eventBatcher: null,
  isRealTimeEnabled: false,
  connectionStatus: 'disconnected',
  subscriptions: new Map(),
  subscriptionHealth: new Map(),
  lastEventReceived: null,
  eventProcessingMetrics: {
    totalProcessed: 0,
    averageLatency: 0,
    errorCount: 0,
    lastBatchProcessed: null
  }
};

// Create the dashboard store with persistence, devtools, and selectors
export const useDashboardStore = create<DashboardStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          sessions: [],
          events: [],
          filters: defaultFilters,
          ui: defaultUI,
          realtime: defaultRealtimeState,
      
      // Session actions
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
      })),
      
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, ...updates } : session
        ),
      })),
      
      removeSession: (sessionId) => set((state) => ({
        sessions: state.sessions.filter((session) => session.id !== sessionId),
        events: state.events.filter((event) => event.sessionId !== sessionId),
      })),
      
      // Event actions
      setEvents: (events) => set({ events }),
      
      addEvent: (event) => set((state) => ({
        events: [...state.events, event],
      })),
      
      updateEvent: (eventId, updates) => set((state) => ({
        events: state.events.map((event) =>
          event.id === eventId ? { ...event, ...updates } : event
        ),
      })),
      
      removeEvent: (eventId) => set((state) => ({
        events: state.events.filter((event) => event.id !== eventId),
      })),
      
      // Filter actions
      updateFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters },
      })),
      
      resetFilters: () => set({ filters: defaultFilters }),
      
      // UI actions
      setSelectedSession: (sessionId) => set((state) => ({
        ui: { ...state.ui, selectedSession: sessionId },
      })),
      
      setSelectedEvent: (eventId) => set((state) => ({
        ui: { ...state.ui, selectedEvent: eventId },
      })),
      
      setModalOpen: (open) => set((state) => ({
        ui: { ...state.ui, modalOpen: open },
      })),
      
      setSidebarCollapsed: (collapsed) => set((state) => ({
        ui: { ...state.ui, sidebarCollapsed: collapsed },
      })),
      
      setLoading: (loading) => set((state) => ({
        ui: { ...state.ui, loading },
      })),
      
      setError: (error) => set((state) => ({
        ui: { ...state.ui, error },
      })),
      
      // Computed selectors
      getFilteredSessions: () => {
        const { sessions, filters } = get();
        let filtered = [...sessions];
        
        // Filter by date range
        if (filters.dateRange.start) {
          filtered = filtered.filter(
            (session) => session.startTime >= filters.dateRange.start!
          );
        }
        if (filters.dateRange.end) {
          filtered = filtered.filter(
            (session) => session.startTime <= filters.dateRange.end!
          );
        }
        
        // Filter by status
        if (filters.sessionStatus.length > 0) {
          filtered = filtered.filter((session) =>
            filters.sessionStatus.includes(session.status)
          );
        }
        
        // Filter by search term
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filtered = filtered.filter((session) =>
            session.id.toLowerCase().includes(searchLower)
          );
        }
        
        return filtered;
      },
      
      getFilteredEvents: () => {
        const { events, filters } = get();
        let filtered = [...events];
        
        // Filter by date range
        if (filters.dateRange.start) {
          filtered = filtered.filter(
            (event) => event.timestamp >= filters.dateRange.start!
          );
        }
        if (filters.dateRange.end) {
          filtered = filtered.filter(
            (event) => event.timestamp <= filters.dateRange.end!
          );
        }
        
        // Filter by event types
        if (filters.eventTypes.length > 0) {
          filtered = filtered.filter((event) =>
            filters.eventTypes.includes(event.type)
          );
        }
        
        // Filter by search term
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filtered = filtered.filter((event) =>
            event.type.toLowerCase().includes(searchLower) ||
            JSON.stringify(event.metadata).toLowerCase().includes(searchLower)
          );
        }
        
        return filtered;
      },
      
      getSessionEvents: (sessionId) => {
        const { events } = get();
        return events.filter((event) => event.sessionId === sessionId);
      },
      
      getActiveSessionsCount: () => {
        const { sessions } = get();
        return sessions.filter((session) => session.status === 'active').length;
      },
      
      getTotalEventsCount: () => {
        const { events } = get();
        return events.length;
      },
      
      // Real-time actions
      initializeRealtime: async (websocketUrl: string) => {
        const state = get();
        if (state.realtime.connectionManager) {
          console.warn('Real-time already initialized');
          return;
        }
        
        try {
          // Create event batcher
          const eventBatcher = new EventBatcher(DEFAULT_CHRONICLE_CONFIG.batch);
          
          // Create connection manager
          const connectionManager = new ConnectionManager(
            websocketUrl,
            DEFAULT_CHRONICLE_CONFIG.reconnect,
            eventBatcher
          );
          
          // Subscribe to event batches
          eventBatcher.subscribe((batch: EventBatch) => {
            get().handleEventBatch(batch);
          });
          
          // Subscribe to connection state changes
          connectionManager.subscribe('state_change', (status: any) => {
            get().updateConnectionStatus(status);
          });
          
          set((state) => ({
            realtime: {
              ...state.realtime,
              connectionManager,
              eventBatcher,
              isRealTimeEnabled: true,
              connectionStatus: 'connecting'
            }
          }));
          
        } catch (error) {
          console.error('Failed to initialize real-time:', error);
          set((state) => ({
            ui: { ...state.ui, error: 'Failed to initialize real-time connection' }
          }));
        }
      },
      
      subscribeToEvents: async (config: SubscriptionConfig): Promise<string> => {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        set((state) => ({
          realtime: {
            ...state.realtime,
            subscriptions: new Map(state.realtime.subscriptions).set(subscriptionId, config),
            subscriptionHealth: new Map(state.realtime.subscriptionHealth).set(subscriptionId, {
              id: subscriptionId,
              type: config.type,
              isActive: true,
              lastEventTime: new Date(),
              errorCount: 0,
              latency: 0,
              missedHeartbeats: 0
            })
          }
        }));
        
        return subscriptionId;
      },
      
      unsubscribeFromEvents: (subscriptionId: string) => {
        set((state) => {
          const newSubscriptions = new Map(state.realtime.subscriptions);
          const newHealth = new Map(state.realtime.subscriptionHealth);
          newSubscriptions.delete(subscriptionId);
          newHealth.delete(subscriptionId);
          
          return {
            realtime: {
              ...state.realtime,
              subscriptions: newSubscriptions,
              subscriptionHealth: newHealth
            }
          };
        });
      },
      
      handleEventBatch: (batch: EventBatch) => {
        const startTime = performance.now();
        
        try {
          // Filter valid events and convert to EventData format
          const validEvents: EventData[] = batch.events
            .filter((event: any) => event.id && event.session_id && event.event_type)
            .map((event: any) => ({
              id: event.id,
              sessionId: event.session_id,
              type: event.event_type,
              timestamp: new Date(event.timestamp),
              metadata: event.metadata || {},
              status: event.status || 'info'
            }));
          
          if (validEvents.length > 0) {
            get().addEventsBatch(validEvents);
          }
          
          // Update processing metrics
          const processingTime = performance.now() - startTime;
          
          set((state) => ({
            realtime: {
              ...state.realtime,
              lastEventReceived: new Date(),
              eventProcessingMetrics: {
                ...state.realtime.eventProcessingMetrics,
                totalProcessed: state.realtime.eventProcessingMetrics.totalProcessed + batch.size,
                averageLatency: (state.realtime.eventProcessingMetrics.averageLatency + processingTime) / 2,
                lastBatchProcessed: new Date()
              }
            }
          }));
          
        } catch (error) {
          console.error('Error processing event batch:', error);
          set((state) => ({
            realtime: {
              ...state.realtime,
              eventProcessingMetrics: {
                ...state.realtime.eventProcessingMetrics,
                errorCount: state.realtime.eventProcessingMetrics.errorCount + 1
              }
            }
          }));
        }
      },
      
      updateConnectionStatus: (status: any) => {
        set((state) => ({
          realtime: {
            ...state.realtime,
            connectionStatus: status.state
          }
        }));
      },
      
      getConnectionHealth: () => {
        const { realtime } = get();
        return realtime.connectionManager?.getHealthStatus() || null;
      },
      
      enableRealTime: () => {
        set((state) => ({
          realtime: {
            ...state.realtime,
            isRealTimeEnabled: true
          }
        }));
      },
      
      disableRealTime: () => {
        const { realtime } = get();
        
        // Clean up connections
        if (realtime.connectionManager) {
          realtime.connectionManager.destroy();
        }
        if (realtime.eventBatcher) {
          realtime.eventBatcher.destroy();
        }
        
        set((state) => ({
          realtime: {
            ...defaultRealtimeState,
            isRealTimeEnabled: false
          }
        }));
      },
      
      // Enhanced event processing
      addEventsBatch: (events: EventData[]) => {
        set((state) => {
          // Use a more efficient approach for batch updates
          const existingEventIds = new Set(state.events.map(e => e.id));
          const newEvents = events.filter(event => !existingEventIds.has(event.id));
          
          if (newEvents.length === 0) return state;
          
          // Sort new events by timestamp to maintain order
          newEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          return {
            events: [...state.events, ...newEvents].slice(-1000) // Keep last 1000 events for performance
          };
        });
      },
      
      processEventQueue: () => {
        const { realtime } = get();
        if (realtime.eventBatcher) {
          realtime.eventBatcher.flush();
        }
      },
      
      getRealTimeMetrics: () => {
        const { realtime } = get();
        return {
          connectionStatus: realtime.connectionStatus,
          isEnabled: realtime.isRealTimeEnabled,
          subscriptionsCount: realtime.subscriptions.size,
          lastEventReceived: realtime.lastEventReceived,
          processingMetrics: realtime.eventProcessingMetrics,
          batcherMetrics: realtime.eventBatcher?.getMetrics() || null,
          connectionHealth: realtime.connectionManager?.getHealthStatus() || null
        };
      },
      
      getSubscriptionStatus: () => {
        const { realtime } = get();
        const total = realtime.subscriptions.size;
        let healthy = 0;
        
        realtime.subscriptionHealth.forEach((health) => {
          if (health.isActive && health.errorCount < 5) {
            healthy++;
          }
        });
        
        return {
          active: healthy,
          healthy,
          total
        };
      },
        }),
        {
          name: 'chronicle-dashboard-store',
          storage: createJSONStorage(() => localStorage),
          // Only persist certain parts of the state
          partialize: (state) => ({
            filters: state.filters,
            ui: {
              ...state.ui,
              loading: false, // Don't persist loading state
              error: null,    // Don't persist errors
            },
            // Don't persist real-time state - it should be recreated on load
          }),
        }
      ),
      { name: 'chronicle-dashboard' } // devtools name
    )
  )
);

// Hook for accessing dashboard statistics
export const useDashboardStats = () => {
  const store = useDashboardStore();
  
  return {
    activeSessions: store.getActiveSessionsCount(),
    totalEvents: store.getTotalEventsCount(),
    filteredSessions: store.getFilteredSessions().length,
    filteredEvents: store.getFilteredEvents().length,
  };
};

// Hook for accessing filtered data
export const useFilteredData = () => {
  const store = useDashboardStore();
  
  return {
    sessions: store.getFilteredSessions(),
    events: store.getFilteredEvents(),
  };
};

// Hook for real-time functionality
export const useRealTime = () => {
  const store = useDashboardStore();
  
  return {
    isEnabled: store.realtime.isRealTimeEnabled,
    connectionStatus: store.realtime.connectionStatus,
    metrics: store.getRealTimeMetrics(),
    subscriptionStatus: store.getSubscriptionStatus(),
    initialize: store.initializeRealtime,
    subscribe: store.subscribeToEvents,
    unsubscribe: store.unsubscribeFromEvents,
    enable: store.enableRealTime,
    disable: store.disableRealTime,
    health: store.getConnectionHealth,
  };
};

// Hook for performance monitoring
export const usePerformanceMetrics = () => {
  const metrics = useDashboardStore((state) => state.getRealTimeMetrics());
  
  return {
    eventProcessing: metrics.processingMetrics,
    batcher: metrics.batcherMetrics,
    connection: metrics.connectionHealth,
    isHealthy: metrics.connectionHealth?.isHealthy || false,
  };
};

// Selectors for optimized access
export const selectConnectionStatus = (state: any) => state.realtime.connectionStatus;
export const selectEventCount = (state: any) => state.events.length;
export const selectActiveSessionCount = (state: any) => 
  state.sessions.filter((s: any) => s.status === 'active').length;
export const selectRealTimeEnabled = (state: any) => state.realtime.isRealTimeEnabled;