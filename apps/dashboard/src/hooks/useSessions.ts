import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
  getSessionDuration: (session: Session) => number | null;
  getSessionSuccessRate: (sessionId: string) => number | null;
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
      // Try to use RPC function first (assumes it exists in the database)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_session_summaries', { session_ids: sessionIds });

      if (!rpcError && rpcData) {
        return rpcData;
      }

      // Fallback to manual aggregation if RPC doesn't exist
      const summaries: SessionSummary[] = [];

      for (const sessionId of sessionIds) {
        const { data: events, error: eventsError } = await supabase
          .from('chronicle_events')
          .select('type, data, timestamp')
          .eq('session_id', sessionId);

        if (eventsError) {
          console.warn(`Failed to fetch events for session ${sessionId}:`, eventsError);
          continue;
        }

        const totalEvents = events?.length || 0;
        const toolUsageCount = events?.filter(e => e.type === 'tool_use').length || 0;
        const errorCount = events?.filter(e => 
          e.data?.success === false || e.data?.error
        ).length || 0;

        // Calculate average response time from tool_use events
        const toolEvents = events?.filter(e => 
          e.type === 'tool_use' && e.data?.duration_ms
        ) || [];
        
        const avgResponseTime = toolEvents.length > 0
          ? toolEvents.reduce((sum, e) => sum + (e.data.duration_ms || 0), 0) / toolEvents.length
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
      console.error('Failed to fetch session summaries:', err);
      return [];
    }
  }, []);

  /**
   * Fetches sessions from Supabase
   */
  const fetchSessions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all sessions, excluding any that might be test data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chronicle_sessions')
        .select('*')
        .neq('project_path', 'test') // Exclude test sessions
        .order('start_time', { ascending: false });

      if (sessionsError) {
        throw sessionsError;
      }

      const fetchedSessions = sessionsData || [];
      setSessions(fetchedSessions);

      // Fetch summaries for all sessions
      if (fetchedSessions.length > 0) {
        const sessionIds = fetchedSessions.map(s => s.id);
        const summaries = await fetchSessionSummaries(sessionIds);
        
        const summaryMap = new Map<string, SessionSummary>();
        summaries.forEach(summary => {
          summaryMap.set(summary.session_id, summary);
        });
        
        setSessionSummaries(summaryMap);
      }

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch sessions');
      setError(errorObj);
      setSessions([]);
    } finally {
      setLoading(false);
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
  const retry = useCallback(async (): Promise<void> => {
    await fetchSessions();
  }, [fetchSessions]);

  // Computed values
  const activeSessions = sessions.filter(session => session.status === 'active');

  // Initial data fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    activeSessions,
    sessionSummaries,
    loading,
    error,
    retry,
    getSessionDuration,
    getSessionSuccessRate,
  };
};