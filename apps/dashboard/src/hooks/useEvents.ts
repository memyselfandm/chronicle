import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Event } from '@/types/events';
import { FilterState } from '@/types/filters';
import { getBackend } from '../lib/backend/factory';
import { 
  ChronicleBackend, 
  BackendConnectionStatus, 
  EventFilters,
  SubscriptionHandle 
} from '../lib/backend';
import { logger } from '../lib/utils';
import { config } from '../lib/config';

interface UseEventsState {
  events: Event[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  connectionStatus: BackendConnectionStatus;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  retry: () => void;
  loadMore: () => Promise<void>;
}

interface UseEventsOptions {
  limit?: number;
  filters?: Partial<FilterState>;
  enableRealtime?: boolean;
}

/**
 * Custom hook for managing events with backend abstraction
 * Supports both Supabase and local Chronicle server backends
 * Provides state management, data fetching, and real-time updates
 */
export const useEvents = (options: UseEventsOptions = {}): UseEventsState => {
  const {
    limit = 50,
    filters = {},
    enableRealtime = true,
  } = options;

  // Store filters in a ref to prevent unnecessary re-renders
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Create stable filter keys for dependency comparisons
  const sessionIdsKey = filters.sessionIds?.join(',') || '';
  const eventTypesKey = filters.eventTypes?.join(',') || '';
  const dateRangeStartKey = filters.dateRange?.start?.toISOString() || '';
  const dateRangeEndKey = filters.dateRange?.end?.toISOString() || '';
  const searchQueryKey = filters.searchQuery || '';

  // Stabilize filters object for dependency comparisons
  const stableFilters = useMemo(() => ({
    sessionIds: filters.sessionIds || [],
    eventTypes: filters.eventTypes || [],
    dateRange: filters.dateRange || null,
    searchQuery: filters.searchQuery || ''
  }), [sessionIdsKey, eventTypesKey, dateRangeStartKey, dateRangeEndKey, searchQueryKey]);

  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>('disconnected');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');

  // Backend and subscription refs
  const backendRef = useRef<ChronicleBackend | null>(null);
  const eventSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const connectionSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const eventIdsRef = useRef<Set<string>>(new Set());
  const lastEventReceived = useRef<Date | null>(null);

  /**
   * Initialize backend connection
   */
  const initializeBackend = useCallback(async () => {
    try {
      if (!backendRef.current) {
        logger.info('Initializing backend for useEvents', {
          component: 'useEvents',
          action: 'initializeBackend'
        });
        
        backendRef.current = await getBackend();
        
        // Subscribe to connection status changes
        connectionSubscriptionRef.current = backendRef.current.onConnectionStatusChange((status) => {
          setConnectionStatus(status);
          updateConnectionQuality(status);
        });

        // Set initial connection status
        setConnectionStatus(backendRef.current.getConnectionStatus());
        updateConnectionQuality(backendRef.current.getConnectionStatus());
      }
    } catch (error) {
      logger.error('Failed to initialize backend', {
        component: 'useEvents',
        action: 'initializeBackend'
      }, error as Error);
      
      setError(error as Error);
      setConnectionStatus('error');
    }
  }, []);

  /**
   * Update connection quality based on status and response times
   */
  const updateConnectionQuality = useCallback((status: BackendConnectionStatus) => {
    if (status === 'connected') {
      const now = new Date();
      const lastReceived = lastEventReceived.current;
      
      if (!lastReceived) {
        setConnectionQuality('good');
      } else {
        const timeSinceLastEvent = now.getTime() - lastReceived.getTime();
        
        if (timeSinceLastEvent < 30000) { // Less than 30 seconds
          setConnectionQuality('excellent');
        } else if (timeSinceLastEvent < 120000) { // Less than 2 minutes
          setConnectionQuality('good');
        } else {
          setConnectionQuality('poor');
        }
      }
    } else if (status === 'connecting' || status === 'retrying') {
      setConnectionQuality('poor');
    } else {
      setConnectionQuality('unknown');
    }
  }, []);

  /**
   * Convert FilterState to EventFilters
   */
  const convertFilters = useCallback((filters: Partial<FilterState>): EventFilters => {
    return {
      sessionIds: filters.sessionIds,
      eventTypes: filters.eventTypes,
      dateRange: filters.dateRange,
      searchQuery: filters.searchQuery,
    };
  }, []);

  /**
   * Fetches events from the current backend with filters and pagination
   */
  const fetchEvents = useCallback(async (
    loadOffset = 0,
    append = false
  ): Promise<Event[]> => {
    try {
      if (!backendRef.current) {
        await initializeBackend();
        if (!backendRef.current) {
          throw new Error('Failed to initialize backend');
        }
      }

      setLoading(true);
      setError(null);

      // Use the ref to access current filters without triggering re-renders
      const currentFilters = filtersRef.current;
      const eventFilters: EventFilters = {
        ...convertFilters(currentFilters),
        limit,
        offset: loadOffset,
      };

      const fetchedEvents = await backendRef.current.getEvents(eventFilters);
      
      // Sort by timestamp (newest first) to ensure consistency
      const sortedEvents = fetchedEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Update event IDs for deduplication
      sortedEvents.forEach(event => eventIdsRef.current.add(event.id));

      if (append) {
        setEvents(prev => [...prev, ...sortedEvents]);
      } else {
        setEvents(sortedEvents);
        setOffset(sortedEvents.length);
      }

      setHasMore(sortedEvents.length === limit);
      
      logger.debug('Successfully fetched events', {
        component: 'useEvents',
        action: 'fetchEvents',
        data: { 
          count: sortedEvents.length, 
          append,
          backendMode: config.backend.mode 
        }
      });

      return sortedEvents;

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch events');
      setError(errorObj);
      if (!append) {
        setEvents([]);
      }
      
      logger.error('Failed to fetch events', {
        component: 'useEvents',
        action: 'fetchEvents'
      }, errorObj);

      return [];
    } finally {
      setLoading(false);
    }
  }, [limit, initializeBackend, convertFilters]);

  /**
   * Handles new events from real-time subscription
   */
  const handleRealtimeEvent = useCallback((newEvent: Event) => {
    // Record that we received an event (for connection health monitoring)
    lastEventReceived.current = new Date();
    updateConnectionQuality(connectionStatus);
    
    // Prevent duplicates
    if (eventIdsRef.current.has(newEvent.id)) {
      return;
    }

    // Add to deduplication set
    eventIdsRef.current.add(newEvent.id);

    // Add to events array (newest first)
    setEvents(prev => {
      const updatedEvents = [newEvent, ...prev];
      
      // Maintain memory limit
      const maxCachedEvents = config.performance.maxEventsDisplay;
      if (updatedEvents.length > maxCachedEvents) {
        return updatedEvents.slice(0, maxCachedEvents);
      }
      
      return updatedEvents;
    });

    logger.debug('Received real-time event', {
      component: 'useEvents',
      action: 'handleRealtimeEvent',
      data: { eventId: newEvent.id, eventType: newEvent.event_type }
    });
  }, [connectionStatus, updateConnectionQuality]);

  /**
   * Sets up real-time subscription for events
   */
  const setupRealtimeSubscription = useCallback(async () => {
    if (!enableRealtime || !backendRef.current) {
      return;
    }

    // Cleanup existing subscription
    if (eventSubscriptionRef.current) {
      eventSubscriptionRef.current.unsubscribe();
      eventSubscriptionRef.current = null;
    }

    try {
      // Subscribe to event updates
      eventSubscriptionRef.current = backendRef.current.subscribeToEvents(handleRealtimeEvent);
      
      logger.info('Real-time event subscription established', {
        component: 'useEvents',
        action: 'setupRealtimeSubscription',
        data: { backendMode: config.backend.mode }
      });

    } catch (error) {
      logger.error('Failed to setup real-time subscription', {
        component: 'useEvents',
        action: 'setupRealtimeSubscription'
      }, error as Error);
    }
  }, [enableRealtime, handleRealtimeEvent]);

  /**
   * Cleanup subscriptions
   */
  const cleanup = useCallback(() => {
    if (eventSubscriptionRef.current) {
      eventSubscriptionRef.current.unsubscribe();
      eventSubscriptionRef.current = null;
    }
    if (connectionSubscriptionRef.current) {
      connectionSubscriptionRef.current.unsubscribe();
      connectionSubscriptionRef.current = null;
    }
  }, []);

  /**
   * Retry function for error recovery
   */
  const retry = useCallback(async () => {
    setError(null);
    eventIdsRef.current.clear();
    
    // Re-initialize backend if needed
    await initializeBackend();
    
    // Fetch events again
    await fetchEvents(0, false);
    
    // Re-setup real-time subscription
    await setupRealtimeSubscription();
    
    logger.info('Retry completed', {
      component: 'useEvents',
      action: 'retry'
    });
  }, [initializeBackend, fetchEvents, setupRealtimeSubscription]);

  /**
   * Load more events (pagination)
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    await fetchEvents(offset, true);
    setOffset(prev => prev + limit);
  }, [fetchEvents, loading, hasMore, offset, limit]);

  // Initialize backend and fetch initial data
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await initializeBackend();
        if (mounted) {
          await fetchEvents(0, false);
          await setupRealtimeSubscription();
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initializeBackend]); // Only depend on initializeBackend

  // Re-fetch when filters change
  useEffect(() => {
    if (backendRef.current) {
      fetchEvents(0, false);
    }
  }, [stableFilters]); // Depend on stable filters

  // Setup/cleanup real-time subscription when enableRealtime changes
  useEffect(() => {
    if (backendRef.current) {
      setupRealtimeSubscription();
    }

    return cleanup;
  }, [enableRealtime, setupRealtimeSubscription, cleanup]);

  return {
    events,
    loading,
    error,
    hasMore,
    connectionStatus,
    connectionQuality,
    retry,
    loadMore,
  };
};