# Zustand State Management Documentation for Chronicle MVP

## Overview
Comprehensive guide for implementing Zustand global state management in the Chronicle observability dashboard, focusing on real-time data patterns, performance optimization, and memory management for high-volume event streams.

## Core Zustand Patterns

### 1. Basic Store Creation
```javascript
import { create } from 'zustand';

// Simple store with actions
const useChronicleStore = create((set, get) => ({
  // State
  events: [],
  sessions: [],
  filters: {
    dateRange: null,
    eventTypes: [],
    sessionIds: [],
    searchQuery: ''
  },
  
  // Actions
  addEvents: (newEvents) => set((state) => ({
    events: [...newEvents, ...state.events].slice(0, 1000) // Keep only latest 1000
  })),
  
  updateFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  clearEvents: () => set({ events: [] }),
  
  // Computed values
  getFilteredEvents: () => {
    const { events, filters } = get();
    return events.filter(event => matchesFilters(event, filters));
  }
}));
```

### 2. Performance-Optimized Selectors
```javascript
// Selective state access to prevent unnecessary re-renders
const EventsList = () => {
  // Only subscribe to events, not the entire store
  const events = useChronicleStore(state => state.events);
  const addEvents = useChronicleStore(state => state.addEvents);
  
  return (
    <div>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};

// Computed selector with shallow comparison
const FilteredEventsList = () => {
  const filteredEvents = useChronicleStore(
    state => state.getFilteredEvents(),
    shallow // Only re-render if the filtered result changes
  );
  
  return (
    <div>
      {filteredEvents.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
```

## Real-time Data Management Patterns

### 1. Real-time Event Store with Batching
```javascript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const useRealtimeEventStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    events: [],
    pendingEvents: [],
    isProcessingBatch: false,
    lastProcessedAt: Date.now(),
    
    // Real-time event processing
    addRealtimeEvent: (event) => {
      set((state) => ({
        pendingEvents: [...state.pendingEvents, event]
      }));
      
      // Trigger batch processing
      get().processPendingEvents();
    },
    
    processPendingEvents: () => {
      const { pendingEvents, isProcessingBatch } = get();
      
      if (isProcessingBatch || pendingEvents.length === 0) return;
      
      set({ isProcessingBatch: true });
      
      // Use requestAnimationFrame for smooth UI updates
      requestAnimationFrame(() => {
        set((state) => ({
          events: [...state.pendingEvents, ...state.events].slice(0, 1000),
          pendingEvents: [],
          isProcessingBatch: false,
          lastProcessedAt: Date.now()
        }));
      });
    },
    
    // Bulk operations for better performance
    addEventsBulk: (newEvents) => set((state) => ({
      events: [...newEvents, ...state.events].slice(0, 1000)
    })),
    
    // Memory management
    clearOldEvents: () => {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      set((state) => ({
        events: state.events.filter(
          event => new Date(event.timestamp).getTime() > cutoffTime
        )
      }));
    }
  }))
);
```

### 2. Session Management Store
```javascript
const useSessionStore = create((set, get) => ({
  // State
  activeSessions: new Map(),
  sessionMetrics: {},
  selectedSessionId: null,
  
  // Session tracking
  createSession: (sessionData) => {
    const sessionId = sessionData.id;
    set((state) => ({
      activeSessions: new Map(state.activeSessions).set(sessionId, {
        ...sessionData,
        startTime: Date.now(),
        eventCount: 0,
        lastActivity: Date.now()
      })
    }));
  },
  
  updateSessionActivity: (sessionId) => {
    set((state) => {
      const newSessions = new Map(state.activeSessions);
      const session = newSessions.get(sessionId);
      if (session) {
        newSessions.set(sessionId, {
          ...session,
          lastActivity: Date.now(),
          eventCount: session.eventCount + 1
        });
      }
      return { activeSessions: newSessions };
    });
  },
  
  endSession: (sessionId) => {
    set((state) => {
      const newSessions = new Map(state.activeSessions);
      const session = newSessions.get(sessionId);
      
      if (session) {
        // Move to session metrics for historical data
        const metrics = {
          ...session,
          endTime: Date.now(),
          duration: Date.now() - session.startTime
        };
        
        newSessions.delete(sessionId);
        
        return {
          activeSessions: newSessions,
          sessionMetrics: {
            ...state.sessionMetrics,
            [sessionId]: metrics
          }
        };
      }
      
      return state;
    });
  },
  
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  
  // Computed getters
  getActiveSessionCount: () => get().activeSessions.size,
  getSessionById: (sessionId) => get().activeSessions.get(sessionId),
  getAllSessions: () => Array.from(get().activeSessions.values())
}));
```

## Advanced State Management Patterns

### 1. Middleware Integration with Immer
```javascript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useComplexEventStore = create(
  immer((set, get) => ({
    // Complex nested state
    eventGroups: {
      byType: {},
      bySession: {},
      byTimestamp: {}
    },
    
    // Immer allows direct mutation syntax
    addEventToGroups: (event) => set((state) => {
      // Group by type
      if (!state.eventGroups.byType[event.type]) {
        state.eventGroups.byType[event.type] = [];
      }
      state.eventGroups.byType[event.type].push(event);
      
      // Group by session
      if (!state.eventGroups.bySession[event.sessionId]) {
        state.eventGroups.bySession[event.sessionId] = [];
      }
      state.eventGroups.bySession[event.sessionId].push(event);
      
      // Group by timestamp (hour buckets)
      const hourBucket = new Date(event.timestamp).toISOString().slice(0, 13);
      if (!state.eventGroups.byTimestamp[hourBucket]) {
        state.eventGroups.byTimestamp[hourBucket] = [];
      }
      state.eventGroups.byTimestamp[hourBucket].push(event);
    }),
    
    updateEventInGroups: (eventId, updates) => set((state) => {
      // Find and update event across all groups
      Object.values(state.eventGroups).forEach(groupType => {
        Object.values(groupType).forEach(group => {
          const eventIndex = group.findIndex(e => e.id === eventId);
          if (eventIndex !== -1) {
            Object.assign(group[eventIndex], updates);
          }
        });
      });
    })
  }))
);
```

### 2. Async Action Patterns
```javascript
const useAsyncEventStore = create((set, get) => ({
  // State
  events: [],
  loading: false,
  error: null,
  
  // Async actions
  fetchEvents: async (filters) => {
    set({ loading: true, error: null });
    
    try {
      const response = await api.getEvents(filters);
      set({ events: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  // Optimistic updates for real-time events
  addEventOptimistic: (event) => {
    // Add immediately for UI responsiveness
    set((state) => ({
      events: [event, ...state.events]
    }));
    
    // Persist to backend
    api.createEvent(event).catch((error) => {
      // Rollback on error
      set((state) => ({
        events: state.events.filter(e => e.id !== event.id),
        error: 'Failed to save event'
      }));
    });
  },
  
  // Retry mechanism
  retryFailedOperation: async (operation) => {
    const maxRetries = 3;
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        await operation();
        break;
      } catch (error) {
        attempts++;
        if (attempts === maxRetries) {
          set({ error: 'Operation failed after retries' });
        } else {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempts) * 1000)
          );
        }
      }
    }
  }
}));
```

## Memory Management and Performance

### 1. Store Slicing for Large Applications
```javascript
// Split large stores into smaller, focused slices
const createEventSlice = (set, get) => ({
  events: [],
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events].slice(0, 1000)
  })),
  clearEvents: () => set({ events: [] })
});

const createFilterSlice = (set, get) => ({
  filters: {
    dateRange: null,
    eventTypes: [],
    searchQuery: ''
  },
  updateFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  resetFilters: () => set({
    filters: {
      dateRange: null,
      eventTypes: [],
      searchQuery: ''
    }
  })
});

const createUISlice = (set, get) => ({
  sidebarOpen: true,
  selectedEventId: null,
  viewMode: 'list',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  selectEvent: (eventId) => set({ selectedEventId: eventId }),
  setViewMode: (mode) => set({ viewMode: mode })
});

// Combine slices
const useChronicleStore = create((set, get) => ({
  ...createEventSlice(set, get),
  ...createFilterSlice(set, get),
  ...createUISlice(set, get)
}));
```

### 2. Transient Updates for High-Frequency Data
```javascript
// Use transient updates for data that doesn't need to trigger re-renders
const useRealtimeMetricsStore = create((set, get) => ({
  // Regular state that triggers re-renders
  visibleMetrics: {
    eventCount: 0,
    averageLatency: 0,
    errorRate: 0
  },
  
  // Transient state for internal tracking
  _transientMetrics: {
    totalEvents: 0,
    latencySum: 0,
    errorCount: 0
  },
  
  // High-frequency updates that don't trigger re-renders
  recordEventLatency: (latency) => {
    const store = get();
    store._transientMetrics.totalEvents++;
    store._transientMetrics.latencySum += latency;
    
    // Update visible metrics every 100 events
    if (store._transientMetrics.totalEvents % 100 === 0) {
      set({
        visibleMetrics: {
          eventCount: store._transientMetrics.totalEvents,
          averageLatency: store._transientMetrics.latencySum / store._transientMetrics.totalEvents,
          errorRate: store._transientMetrics.errorCount / store._transientMetrics.totalEvents
        }
      });
    }
  },
  
  recordError: () => {
    get()._transientMetrics.errorCount++;
  }
}));
```

### 3. Memory Cleanup and Garbage Collection
```javascript
// Automatic memory management
const useMemoryManagedStore = create((set, get) => ({
  events: [],
  maxEvents: 1000,
  lastCleanup: Date.now(),
  
  addEvent: (event) => {
    set((state) => {
      const newEvents = [event, ...state.events];
      
      // Automatic cleanup when approaching memory limits
      if (newEvents.length > state.maxEvents * 1.2) {
        return {
          events: newEvents.slice(0, state.maxEvents),
          lastCleanup: Date.now()
        };
      }
      
      return { events: newEvents };
    });
  },
  
  performMemoryCleanup: () => {
    set((state) => {
      // Remove events older than 24 hours
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      const filteredEvents = state.events.filter(
        event => new Date(event.timestamp).getTime() > cutoffTime
      );
      
      return {
        events: filteredEvents.slice(0, state.maxEvents),
        lastCleanup: Date.now()
      };
    });
  },
  
  // Schedule periodic cleanup
  scheduleCleanup: () => {
    const { lastCleanup, performMemoryCleanup } = get();
    const timeSinceCleanup = Date.now() - lastCleanup;
    
    if (timeSinceCleanup > 5 * 60 * 1000) { // 5 minutes
      performMemoryCleanup();
    }
  }
}));

// Use cleanup in components
const EventsComponent = () => {
  const { events, scheduleCleanup } = useMemoryManagedStore();
  
  useEffect(() => {
    const interval = setInterval(scheduleCleanup, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [scheduleCleanup]);
  
  return <div>{/* render events */}</div>;
};
```

## Integration with External Systems

### 1. Zustand + Supabase Real-time Integration
```javascript
// Integration layer between Zustand and Supabase
const createRealtimeStore = () => {
  const store = create((set, get) => ({
    events: [],
    connectionStatus: 'disconnected',
    
    addRealtimeEvent: (event) => set((state) => ({
      events: [event, ...state.events].slice(0, 1000)
    })),
    
    setConnectionStatus: (status) => set({ connectionStatus: status })
  }));
  
  // Set up Supabase real-time integration
  const channel = supabase
    .channel('chronicle_events')
    .on('broadcast', { event: 'INSERT' }, (payload) => {
      store.getState().addRealtimeEvent(payload.new);
    })
    .on('system', {}, (payload) => {
      if (payload.type === 'connected') {
        store.getState().setConnectionStatus('connected');
      } else if (payload.type === 'disconnected') {
        store.getState().setConnectionStatus('disconnected');
      }
    })
    .subscribe();
  
  // Add cleanup method
  store.cleanup = () => {
    channel.unsubscribe();
  };
  
  return store;
};
```

### 2. State Persistence and Hydration
```javascript
import { persist } from 'zustand/middleware';

// Persist filters and UI preferences
const usePersistentStore = create(
  persist(
    (set, get) => ({
      // Persistent state
      filters: {
        dateRange: null,
        eventTypes: [],
        searchQuery: ''
      },
      uiPreferences: {
        sidebarOpen: true,
        viewMode: 'list',
        theme: 'dark'
      },
      
      // Non-persistent state (will be excluded)
      events: [],
      connectionStatus: 'disconnected',
      
      // Actions
      updateFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
      })),
      
      updateUIPreferences: (preferences) => set((state) => ({
        uiPreferences: { ...state.uiPreferences, ...preferences }
      }))
    }),
    {
      name: 'chronicle-store',
      partialize: (state) => ({
        filters: state.filters,
        uiPreferences: state.uiPreferences
        // events and connectionStatus will not be persisted
      })
    }
  )
);
```

## Testing Strategies

### 1. Store Testing Utilities
```javascript
// Testing utilities for Zustand stores
export const createTestStore = (initialState = {}) => {
  return create((set, get) => ({
    ...useChronicleStore.getState(),
    ...initialState,
    
    // Test utilities
    __reset: () => set(useChronicleStore.getInitialState()),
    __setState: (newState) => set(newState)
  }));
};

// Usage in tests
describe('Chronicle Store', () => {
  let testStore;
  
  beforeEach(() => {
    testStore = createTestStore();
  });
  
  it('should add events correctly', () => {
    const mockEvent = { id: '1', type: 'test', timestamp: Date.now() };
    
    testStore.getState().addEvent(mockEvent);
    
    expect(testStore.getState().events).toContain(mockEvent);
  });
  
  it('should limit events to maximum count', () => {
    const events = Array.from({ length: 1500 }, (_, i) => ({
      id: i.toString(),
      type: 'test',
      timestamp: Date.now()
    }));
    
    testStore.getState().addEventsBulk(events);
    
    expect(testStore.getState().events.length).toBe(1000);
  });
});
```

This comprehensive Zustand documentation provides patterns and strategies specifically designed for high-performance real-time applications like the Chronicle MVP dashboard, with focus on memory management, performance optimization, and scalable state architecture.