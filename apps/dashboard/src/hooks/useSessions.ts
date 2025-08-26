import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/utils';
import { Session } from '@/types/events';

interface SessionSummary {
  session_id: string;
  total_events: number;
  tool_usage_count: number;
  error_count: number;
  avg_response_time: number | null;
}

interface UseSessionsState {
  sessions: Session[];
  activeSessions: Session[];
  sessionSummaries: Map<string, SessionSummary>;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  fetchSessions: (timeRangeMinutes?: number) => Promise<void>;
  getSessionDuration: (session: Session) => number | null;
  getSessionSuccessRate: (sessionId: string) => number | null;
  isSessionActive: (sessionId: string) => Promise<boolean>;
  updateSessionEndTimes: () => Promise<void>;
}

/**
 * Custom hook for managing sessions and their summary data
 * Provides active sessions list with status indicators and metrics
 */
export const useSessions = (): UseSessionsState => {
  // State management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionSummaries, setSessionSummaries] = useState<Map<string, SessionSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches session summary data using Supabase RPC or aggregation
   */
  const fetchSessionSummaries = useCallback(async (sessionIds: string[]): Promise<SessionSummary[]> => {
    if (sessionIds.length === 0) return [];

    try {
      // Try using the get_session_summaries RPC function first (CHR-83)
      const { data: rpcSummaries, error: rpcError } = await supabase
        .rpc('get_session_summaries', { session_ids: sessionIds });

      if (!rpcError && rpcSummaries) {
        logger.info('Successfully fetched session summaries via RPC', {
          component: 'useSessions',
          action: 'fetchSessionSummaries',
          data: { sessionCount: sessionIds.length, summaryCount: rpcSummaries.length }
        });
        return rpcSummaries;
      }

      // If RPC fails, log the error and fallback to manual aggregation
      if (rpcError) {
        logger.warn('RPC function failed, falling back to manual aggregation', {
          component: 'useSessions',
          action: 'fetchSessionSummaries',
          data: { error: rpcError.message }
        });
      }

      // Fallback: manual aggregation
      const summaries: SessionSummary[] = [];

      for (const sessionId of sessionIds) {
        const { data: events, error: eventsError } = await supabase
          .from('chronicle_events')
          .select('event_type, metadata, timestamp, duration_ms')
          .eq('session_id', sessionId);

        if (eventsError) {
          logger.warn(`Failed to fetch events for session ${sessionId}`, {
            component: 'useSessions',
            action: 'loadEventSources',
            data: { sessionId, error: eventsError.message }
          });
          continue;
        }

        const totalEvents = events?.length || 0;
        const toolUsageCount = events?.filter(e => 
          e.event_type === 'pre_tool_use' || e.event_type === 'post_tool_use'
        ).length || 0;
        const errorCount = events?.filter(e => 
          e.event_type === 'error' || e.metadata?.success === false || e.metadata?.error
        ).length || 0;

        // Calculate average response time from post_tool_use events
        const toolEvents = events?.filter(e => 
          e.event_type === 'post_tool_use' && (e.duration_ms || e.metadata?.duration_ms)
        ) || [];
        
        const avgResponseTime = toolEvents.length > 0
          ? toolEvents.reduce((sum, e) => sum + (e.duration_ms || e.metadata?.duration_ms || 0), 0) / toolEvents.length
          : null;

        summaries.push({
          session_id: sessionId,
          total_events: totalEvents,
          tool_usage_count: toolUsageCount,
          error_count: errorCount,
          avg_response_time: avgResponseTime,
        });
      }

      return summaries;

    } catch (err) {
      logger.error('Failed to fetch session summaries', {
        component: 'useSessions',
        action: 'loadEventSources'
      }, err as Error);
      return [];
    }
  }, []);

  /**
   * Fetches sessions from Supabase based on recent event activity
   * @param timeRangeMinutes - Time range to fetch sessions from
   * @param silent - If true, won't trigger loading state (for background updates)
   */
  const fetchSessions = useCallback(async (timeRangeMinutes: number = 20, silent: boolean = false): Promise<void> => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Step 1: Get events from the specified time range
      const timeAgo = new Date();
      timeAgo.setMinutes(timeAgo.getMinutes() - timeRangeMinutes);
      
      console.log(`🔍 Fetching events from last ${timeRangeMinutes} minutes...`);
      const { data: recentEvents, error: eventsError } = await supabase
        .from('chronicle_events')
        .select('session_id, timestamp, event_type, metadata')
        .gte('timestamp', timeAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (eventsError) {
        console.error('Error fetching recent events:', eventsError);
        throw eventsError;
      }

      // Step 2: Get unique session IDs from recent events
      const activeSessionIds = [...new Set(recentEvents?.map(e => e.session_id) || [])];
      
      console.log(`📊 Found ${activeSessionIds.length} active sessions from ${recentEvents?.length || 0} recent events`);
      console.log('Recent events sample:', recentEvents?.slice(0, 3));

      if (activeSessionIds.length === 0) {
        console.log('⚠️ No active sessions found in the last', timeRangeMinutes, 'minutes');
        console.log('💡 Falling back to fetching ALL sessions for debugging...');
        
        // Fallback: fetch recent sessions (increased limit and better ordering)
        const { data: allSessions, error: allSessionsError } = await supabase
          .from('chronicle_sessions')
          .select('*')
          .neq('project_path', 'test')
          // Removed the end_time filter - we want to see ALL recent sessions
          // including ones that may have been incorrectly marked as ended
          .order('start_time', { ascending: false })
          .limit(50); // Increased limit to get more sessions
        
        console.log('Active sessions (up to 50):', allSessions?.length || 0, 'sessions found');
        if (allSessionsError) console.log('Sessions query error:', allSessionsError);
        
        if (allSessionsError) {
          console.error('❌ Error fetching all sessions:', allSessionsError);
          setError(allSessionsError);
        } else if (allSessions && allSessions.length > 0) {
          console.log('✅ Found', allSessions.length, 'sessions in fallback query');
          // Map them with default values since we don't have event data
          const sessionsWithDefaults = allSessions.map(session => ({
            ...session,
            last_event_time: session.start_time,
            minutes_since_last_event: Math.floor((Date.now() - new Date(session.start_time).getTime()) / 60000),
            is_awaiting: false,
            last_event_type: null
          }));
          setSessions(sessionsWithDefaults);
          console.log('✅ Set', sessionsWithDefaults.length, 'sessions in state');
        } else {
          console.log('⚠️ No sessions found in database at all');
          setSessions([]);
        }
        
        setLoading(false); // Make sure to clear loading state
        return;
      }

      // Step 3: Fetch only those sessions that have recent activity
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chronicle_sessions')
        .select('*')
        .in('id', activeSessionIds)
        .neq('project_path', 'test') // Still exclude test sessions
        .order('start_time', { ascending: false });

      console.log('📊 Sessions query result:', {
        error: sessionsError,
        dataCount: sessionsData?.length || 0,
        firstSession: sessionsData?.[0]
      });

      if (sessionsError) {
        throw sessionsError;
      }

      // Step 4: Enhance sessions with last event time and status
      const sessionsWithLastEvent = (sessionsData || []).map(session => {
        const sessionEvents = recentEvents?.filter(e => e.session_id === session.id) || [];
        const lastEvent = sessionEvents[0];
        const lastEventTime = lastEvent?.timestamp || session.start_time;
        const minutesSinceLastEvent = Math.floor((Date.now() - new Date(lastEventTime).getTime()) / 60000);
        
        // Determine if session is awaiting input
        const isAwaiting = lastEvent?.event_type === 'notification' && 
          lastEvent?.metadata?.requires_response === true;
        
        return {
          ...session,
          last_event_time: lastEventTime,
          minutes_since_last_event: minutesSinceLastEvent,
          is_awaiting: isAwaiting,
          last_event_type: lastEvent?.event_type || null
        };
      });

      // Sort by last event time (most recent first)
      const sortedSessions = sessionsWithLastEvent.sort((a, b) => {
        return new Date(b.last_event_time).getTime() - new Date(a.last_event_time).getTime();
      });

      // Log ALL sessions to debug the cconami issue
      console.log('📊 ALL SESSIONS DETAILS:');
      sortedSessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`, {
          id: session.id,
          project_path: session.project_path,
          folder: session.project_path?.split('/').pop(),
          git_branch: session.git_branch,
          last_event_time: session.last_event_time,
          minutes_since_last: session.minutes_since_last_event,
          is_awaiting: session.is_awaiting,
          has_end_time: !!session.end_time
        });
      });
      
      setSessions(sortedSessions);

      // Don't wait for summaries - they can load async
      // This prevents the loading state from being stuck
      if (sortedSessions.length > 0) {
        const sessionIds = sortedSessions.map(s => s.id);
        // Fire and forget - summaries will load in background
        fetchSessionSummaries(sessionIds).then(summaries => {
          const summaryMap = new Map<string, SessionSummary>();
          summaries.forEach(summary => {
            summaryMap.set(summary.session_id, summary);
          });
          setSessionSummaries(summaryMap);
        }).catch(err => {
          logger.warn('Failed to fetch some session summaries', {
            component: 'useSessions',
            action: 'fetchSessions'
          });
        });
      }

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch sessions');
      setError(errorObj);
      setSessions([]);
      if (!silent) {
        setLoading(false); // Ensure loading is cleared on error
      }
    } finally {
      // Clear loading state after sessions are fetched (only if not silent)
      if (!silent) {
        setLoading(false);
      }
    }
  }, [fetchSessionSummaries]);

  /**
   * Calculates session duration in milliseconds
   */
  const getSessionDuration = useCallback((session: Session): number | null => {
    if (!session.start_time) return null;
    
    const startTime = new Date(session.start_time).getTime();
    const endTime = session.end_time 
      ? new Date(session.end_time).getTime()
      : Date.now();
    
    return endTime - startTime;
  }, []);

  /**
   * Calculates session success rate as percentage
   */
  const getSessionSuccessRate = useCallback((sessionId: string): number | null => {
    const summary = sessionSummaries.get(sessionId);
    if (!summary || summary.total_events === 0) return null;

    const successCount = summary.total_events - summary.error_count;
    return (successCount / summary.total_events) * 100;
  }, [sessionSummaries]);

  /**
   * Retry function for error recovery
   */
  /**
   * Note: Session end times are now handled automatically by database triggers
   * when stop events with session_termination=true are inserted. This prevents
   * premature session termination on subagent stops or other non-terminal events.
   */

  const retry = useCallback(async (): Promise<void> => {
    await fetchSessions();
  }, [fetchSessions]);

  /**
   * Determines if a session is active based on end_time field
   * Sessions are active if they don't have an end_time (set by database triggers)
   */
  const isSessionActive = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      // Check session end_time directly (set by database triggers on proper termination)
      const { data: session, error: sessionError } = await supabase
        .from('chronicle_sessions')
        .select('end_time')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        logger.warn(`Failed to check session status for ${sessionId}`, {
          component: 'useSessions',
          action: 'checkSessionStatus',
          data: { sessionId, error: sessionError.message }
        });
        return false;
      }

      // Session is active if it doesn't have an end_time
      return !session?.end_time;
    } catch (err) {
      logger.warn(`Error checking session status for ${sessionId}`, {
        component: 'useSessions',
        action: 'checkSessionStatus',
        data: { sessionId }
      });
      return false;
    }
  }, []);

  // Computed values - filter sessions based on event lifecycle
  const activeSessions = sessions.filter(session => {
    // For now, consider sessions active if they don't have an end_time
    // This is more efficient than checking events for each session individually
    return !session.end_time;
  });

  // Initial data fetch with extended time range to catch all active sessions
  useEffect(() => {
    fetchSessions(480); // 8 hours - Initial load with loading state
    
    // Set up polling interval to refresh sessions every 2 seconds for near real-time updates
    // This ensures awaiting sessions get prompt attention
    const intervalId = setInterval(() => {
      fetchSessions(480, true); // 8 hours - Silent refresh - no loading spinner
    }, 2000); // 2 seconds for near real-time updates
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []); // Remove dependencies to prevent infinite loop

  // Placeholder for updateSessionEndTimes - to be implemented if needed
  const updateSessionEndTimes = useCallback(async () => {
    // This function would update session end times based on event data
    // Currently not implemented as sessions are updated via polling
    logger.debug('updateSessionEndTimes called - using polling for updates', {
      component: 'useSessions',
      action: 'updateSessionEndTimes'
    });
  }, []);

  // Update session end times after sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !loading) {
      updateSessionEndTimes();
    }
  }, [sessions.length, loading, updateSessionEndTimes]); // Only depend on sessions.length and loading state

  return {
    sessions,
    activeSessions,
    sessionSummaries,
    loading,
    error,
    retry,
    fetchSessions,
    getSessionDuration,
    getSessionSuccessRate,
    isSessionActive,
    updateSessionEndTimes,
  };
};