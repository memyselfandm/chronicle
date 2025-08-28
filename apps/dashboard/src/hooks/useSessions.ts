import { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@/types/events';
import { getBackend } from '../lib/backend/factory';
import { 
  ChronicleBackend, 
  BackendConnectionStatus,
  SessionFilters,
  SessionSummary,
  SubscriptionHandle
} from '../lib/backend';
import { logger } from '../lib/utils';
import { config } from '../lib/config';

interface UseSessionsState {
  sessions: Session[];
  activeSessions: Session[];
  sessionSummaries: Map<string, SessionSummary>;
  loading: boolean;
  error: Error | null;
  connectionStatus: BackendConnectionStatus;
  retry: () => Promise<void>;
  fetchSessions: (timeRangeMinutes?: number) => Promise<void>;
  getSessionDuration: (session: Session) => number | null;
  getSessionSuccessRate: (sessionId: string) => number | null;
  isSessionActive: (sessionId: string) => boolean;
  updateSessionEndTimes: () => Promise<void>;
}

/**
 * Custom hook for managing sessions with backend abstraction
 * Supports both Supabase and local Chronicle server backends
 * Provides active sessions list with status indicators and metrics
 */
export const useSessions = (): UseSessionsState => {
  // State management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionSummaries, setSessionSummaries] = useState<Map<string, SessionSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>('disconnected');

  // Backend and subscription refs
  const backendRef = useRef<ChronicleBackend | null>(null);
  const sessionSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const connectionSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize backend connection
   */
  const initializeBackend = useCallback(async () => {
    try {
      if (!backendRef.current) {
        logger.info('Initializing backend for useSessions', {
          component: 'useSessions',
          action: 'initializeBackend'
        });
        
        backendRef.current = await getBackend();
        
        // Subscribe to connection status changes
        connectionSubscriptionRef.current = backendRef.current.onConnectionStatusChange((status) => {
          setConnectionStatus(status);
        });

        // Set initial connection status
        setConnectionStatus(backendRef.current.getConnectionStatus());
      }
    } catch (error) {
      logger.error('Failed to initialize backend', {
        component: 'useSessions',
        action: 'initializeBackend'
      }, error as Error);
      
      setError(error as Error);
      setConnectionStatus('error');
    }
  }, []);

  /**
   * Fetches sessions from the current backend
   */
  const fetchSessions = useCallback(async (timeRangeMinutes: number = 480, silent: boolean = false): Promise<void> => {
    try {
      if (!backendRef.current) {
        await initializeBackend();
        if (!backendRef.current) {
          throw new Error('Failed to initialize backend');
        }
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const filters: SessionFilters = {
        timeRangeMinutes,
        includeEnded: true, // Include both active and ended sessions
      };

      const fetchedSessions = await backendRef.current.getSessions(filters);

      // Enhance sessions with calculated fields for backward compatibility
      const enhancedSessions = fetchedSessions.map(session => {
        const lastEventTime = session.end_time || session.start_time;
        const minutesSinceLastEvent = Math.floor(
          (Date.now() - new Date(lastEventTime).getTime()) / 60000
        );
        
        return {
          ...session,
          last_event_time: lastEventTime,
          minutes_since_last_event: minutesSinceLastEvent,
          is_awaiting: false, // This would need to be determined by checking latest events
          last_event_type: null, // This would need to be fetched separately
        } as Session & {
          last_event_time: string;
          minutes_since_last_event: number;
          is_awaiting: boolean;
          last_event_type: string | null;
        };
      });

      // Sort by start time (most recent first) or last_event_time if available
      const sortedSessions = enhancedSessions.sort((a, b) => {
        const aTime = 'last_event_time' in a ? a.last_event_time : a.start_time;
        const bTime = 'last_event_time' in b ? b.last_event_time : b.start_time;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setSessions(sortedSessions);

      // Fetch session summaries in background
      if (sortedSessions.length > 0) {
        const sessionIds = sortedSessions.map(s => s.id);
        fetchSessionSummaries(sessionIds).then(summaries => {
          const summaryMap = new Map<string, SessionSummary>();
          summaries.forEach(summary => {
            summaryMap.set(summary.session_id, summary);
          });
          setSessionSummaries(summaryMap);
        }).catch(err => {
          logger.warn('Failed to fetch session summaries', {
            component: 'useSessions',
            action: 'fetchSessions'
          });
        });
      }

      logger.debug('Successfully fetched sessions', {
        component: 'useSessions',
        action: 'fetchSessions',
        data: { 
          count: sortedSessions.length,
          timeRange: timeRangeMinutes,
          backendMode: config.backend.mode 
        }
      });

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch sessions');
      setError(errorObj);
      setSessions([]);
      
      logger.error('Failed to fetch sessions', {
        component: 'useSessions',
        action: 'fetchSessions'
      }, errorObj);

    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [initializeBackend]);

  /**
   * Fetches session summaries with analytics
   */
  const fetchSessionSummaries = useCallback(async (sessionIds: string[]): Promise<SessionSummary[]> => {
    if (sessionIds.length === 0 || !backendRef.current) return [];

    try {
      const summaries = await backendRef.current.getSessionSummaries(sessionIds);
      
      logger.debug('Successfully fetched session summaries', {
        component: 'useSessions',
        action: 'fetchSessionSummaries',
        data: { sessionCount: sessionIds.length, summaryCount: summaries.length }
      });

      return summaries;

    } catch (error) {
      logger.error('Failed to fetch session summaries', {
        component: 'useSessions',
        action: 'fetchSessionSummaries'
      }, error as Error);
      return [];
    }
  }, []);

  /**
   * Handles new sessions from real-time subscription
   */
  const handleRealtimeSession = useCallback((session: Session) => {
    logger.debug('Received real-time session update', {
      component: 'useSessions',
      action: 'handleRealtimeSession',
      data: { sessionId: session.id }
    });

    setSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        // Update existing session
        const updated = [...prev];
        updated[existingIndex] = session;
        return updated;
      } else {
        // Add new session (newest first)
        return [session, ...prev];
      }
    });
  }, []);

  /**
   * Sets up real-time subscription for sessions
   */
  const setupRealtimeSubscription = useCallback(async () => {
    if (!backendRef.current) {
      return;
    }

    // Cleanup existing subscription
    if (sessionSubscriptionRef.current) {
      sessionSubscriptionRef.current.unsubscribe();
      sessionSubscriptionRef.current = null;
    }

    try {
      // Subscribe to session updates
      sessionSubscriptionRef.current = backendRef.current.subscribeToSessions(handleRealtimeSession);
      
      logger.info('Real-time session subscription established', {
        component: 'useSessions',
        action: 'setupRealtimeSubscription',
        data: { backendMode: config.backend.mode }
      });

    } catch (error) {
      logger.error('Failed to setup real-time session subscription', {
        component: 'useSessions',
        action: 'setupRealtimeSubscription'
      }, error as Error);
    }
  }, [handleRealtimeSession]);

  /**
   * Start polling for session updates (fallback for when real-time isn't available)
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const pollingInterval = config.performance.pollingInterval || 5000;
    pollingIntervalRef.current = setInterval(() => {
      fetchSessions(480, true); // 8 hours, silent refresh
    }, pollingInterval);

    logger.debug('Started session polling', {
      component: 'useSessions',
      action: 'startPolling',
      data: { interval: pollingInterval }
    });
  }, [fetchSessions]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Cleanup subscriptions
   */
  const cleanup = useCallback(() => {
    if (sessionSubscriptionRef.current) {
      sessionSubscriptionRef.current.unsubscribe();
      sessionSubscriptionRef.current = null;
    }
    if (connectionSubscriptionRef.current) {
      connectionSubscriptionRef.current.unsubscribe();
      connectionSubscriptionRef.current = null;
    }
    stopPolling();
  }, [stopPolling]);

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
   * Determines if a session is active (no end_time)
   */
  const isSessionActive = useCallback((sessionId: string): boolean => {
    const session = sessions.find(s => s.id === sessionId);
    return session ? !session.end_time : false;
  }, [sessions]);

  /**
   * Placeholder for updateSessionEndTimes - not needed with backend abstraction
   */
  const updateSessionEndTimes = useCallback(async () => {
    logger.debug('updateSessionEndTimes called - session end times managed by backend', {
      component: 'useSessions',
      action: 'updateSessionEndTimes'
    });
  }, []);

  /**
   * Retry function for error recovery
   */
  const retry = useCallback(async () => {
    setError(null);
    
    // Re-initialize backend if needed
    await initializeBackend();
    
    // Fetch sessions again
    await fetchSessions(480); // 8 hours
    
    // Re-setup real-time subscription
    await setupRealtimeSubscription();
    
    // Restart polling as fallback
    startPolling();
    
    logger.info('Sessions retry completed', {
      component: 'useSessions',
      action: 'retry'
    });
  }, [initializeBackend, fetchSessions, setupRealtimeSubscription, startPolling]);

  // Computed values - filter sessions based on end_time
  const activeSessions = sessions.filter(session => !session.end_time);

  // Initialize backend and fetch initial data
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await initializeBackend();
        if (mounted) {
          await fetchSessions(480); // 8 hours initial fetch
          await setupRealtimeSubscription();
          startPolling(); // Start polling as fallback
        }
      }
    };

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [initializeBackend, fetchSessions, setupRealtimeSubscription, startPolling, cleanup]);

  return {
    sessions,
    activeSessions,
    sessionSummaries,
    loading,
    error,
    connectionStatus,
    retry,
    fetchSessions,
    getSessionDuration,
    getSessionSuccessRate,
    isSessionActive,
    updateSessionEndTimes,
  };
};