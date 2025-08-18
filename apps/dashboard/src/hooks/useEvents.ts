import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, REALTIME_CONFIG } from '../lib/supabase';
import { MONITORING_INTERVALS } from '../lib/constants';
import { Event } from '@/types/events';
import { FilterState } from '@/types/filters';
import { useSupabaseConnection } from './useSupabaseConnection';
import type { ConnectionStatus } from '@/types/connection';

interface UseEventsState {
  events: Event[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  connectionStatus: ConnectionStatus;
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
 * Custom hook for managing events with real-time subscriptions
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

  // Connection monitoring
  const {
    status: connectionStatus,
    registerChannel,
    unregisterChannel,
    recordEventReceived,
    retry: retryConnection,
    getConnectionQuality,
  } = useSupabaseConnection({
    enableHealthCheck: true,
    healthCheckInterval: MONITORING_INTERVALS.HEALTH_CHECK_INTERVAL,
  });

  // Refs for cleanup and deduplication
  const channelRef = useRef<RealtimeChannel | null>(null);
  const eventIdsRef = useRef<Set<string>>(new Set());

  /**
   * Fetches events from Supabase with filters and pagination
   */
  const fetchEvents = useCallback(async (
    loadOffset = 0,
    append = false
  ): Promise<Event[]> => {
    try {
      setLoading(true);
      setError(null);

      // Use the ref to access current filters without triggering re-renders
      const currentFilters = filtersRef.current;

      let query = supabase
        .from('chronicle_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(loadOffset, loadOffset + limit - 1);

      // Apply filters
      if (currentFilters.sessionIds && currentFilters.sessionIds.length > 0) {
        query = query.in('session_id', currentFilters.sessionIds);
      }

      if (currentFilters.eventTypes && currentFilters.eventTypes.length > 0) {
        query = query.in('type', currentFilters.eventTypes);
      }

      if (currentFilters.dateRange?.start) {
        query = query.gte('timestamp', currentFilters.dateRange.start.toISOString());
      }

      if (currentFilters.dateRange?.end) {
        query = query.lte('timestamp', currentFilters.dateRange.end.toISOString());
      }

      if (currentFilters.searchQuery) {
        query = query.textSearch('data', currentFilters.searchQuery);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const fetchedEvents = data || [];
      
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
      return sortedEvents;

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch events');
      setError(errorObj);
      if (!append) {
        setEvents([]);
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [limit]); // Remove filters from dependencies since we use ref

  /**
   * Handles new events from real-time subscription
   */
  const handleRealtimeEvent = useCallback((payload: { new: Event }) => {
    const newEvent: Event = payload.new;
    
    // Record that we received an event (for connection health monitoring)
    recordEventReceived();
    
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
      if (updatedEvents.length > REALTIME_CONFIG.MAX_CACHED_EVENTS) {
        return updatedEvents.slice(0, REALTIME_CONFIG.MAX_CACHED_EVENTS);
      }
      
      return updatedEvents;
    });
  }, [recordEventReceived]);

  /**
   * Sets up real-time subscription
   */
  const setupRealtimeSubscription = useCallback(() => {
    if (!enableRealtime) return;

    // Cleanup existing subscription
    if (channelRef.current) {
      unregisterChannel(channelRef.current);
      channelRef.current.unsubscribe();
    }

    // Create new channel
    channelRef.current = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chronicle_events',
        },
        handleRealtimeEvent
      )
      .subscribe();

    // Register channel with connection monitoring
    if (channelRef.current) {
      registerChannel(channelRef.current);
    }

  }, [enableRealtime, handleRealtimeEvent, registerChannel, unregisterChannel]);

  /**
   * Retry function for error recovery
   */
  const retry = useCallback(() => {
    setError(null);
    eventIdsRef.current.clear();
    fetchEvents(0, false);
    // Also retry the connection
    retryConnection();
  }, [fetchEvents, retryConnection]);

  /**
   * Load more events (pagination)
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    await fetchEvents(offset, true);
    setOffset(prev => prev + limit);
  }, [fetchEvents, loading, hasMore, offset, limit]);

  // Fetch data when component mounts or filters change
  useEffect(() => {
    fetchEvents(0, false);
  }, [fetchEvents, stableFilters]);

  // Setup real-time subscription
  useEffect(() => {
    if (enableRealtime) {
      setupRealtimeSubscription();
    }

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        unregisterChannel(channelRef.current);
        channelRef.current.unsubscribe();
      }
    };
  }, [enableRealtime, setupRealtimeSubscription, unregisterChannel]);

  return {
    events,
    loading,
    error,
    hasMore,
    connectionStatus,
    connectionQuality: getConnectionQuality,
    retry,
    loadMore,
  };
};