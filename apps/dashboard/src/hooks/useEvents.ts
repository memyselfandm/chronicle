import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, REALTIME_CONFIG } from '../lib/supabase';
import { Event } from '@/types/events';
import { FilterState } from '@/types/filters';

interface UseEventsState {
  events: Event[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
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

  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

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

      let query = supabase
        .from('chronicle_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(loadOffset, loadOffset + limit - 1);

      // Apply filters
      if (filters.sessionIds && filters.sessionIds.length > 0) {
        query = query.in('session_id', filters.sessionIds);
      }

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        query = query.in('type', filters.eventTypes);
      }

      if (filters.dateRange?.start) {
        query = query.gte('timestamp', filters.dateRange.start.toISOString());
      }

      if (filters.dateRange?.end) {
        query = query.lte('timestamp', filters.dateRange.end.toISOString());
      }

      if (filters.searchQuery) {
        query = query.textSearch('data', filters.searchQuery);
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
  }, [limit, filters]);

  /**
   * Handles new events from real-time subscription
   */
  const handleRealtimeEvent = useCallback((payload: any) => {
    const newEvent: Event = payload.new;
    
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
  }, []);

  /**
   * Sets up real-time subscription
   */
  const setupRealtimeSubscription = useCallback(() => {
    if (!enableRealtime) return;

    // Cleanup existing subscription
    if (channelRef.current) {
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

  }, [enableRealtime, handleRealtimeEvent]);

  /**
   * Retry function for error recovery
   */
  const retry = useCallback(() => {
    setError(null);
    eventIdsRef.current.clear();
    fetchEvents(0, false);
  }, [fetchEvents]);

  /**
   * Load more events (pagination)
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    await fetchEvents(offset, true);
    setOffset(prev => prev + limit);
  }, [fetchEvents, loading, hasMore, offset, limit]);

  // Initial data fetch
  useEffect(() => {
    fetchEvents(0, false);
  }, [fetchEvents]);

  // Setup real-time subscription
  useEffect(() => {
    setupRealtimeSubscription();

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [setupRealtimeSubscription]);

  // Update subscription when filters change
  useEffect(() => {
    if (enableRealtime) {
      setupRealtimeSubscription();
    }
  }, [filters, setupRealtimeSubscription]);

  return {
    events,
    loading,
    error,
    hasMore,
    retry,
    loadMore,
  };
};