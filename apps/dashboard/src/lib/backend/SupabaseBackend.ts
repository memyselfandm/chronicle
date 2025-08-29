/**
 * Supabase Backend Implementation
 * Wraps existing Supabase functionality with the ChronicleBackend interface
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { 
  ChronicleBackend,
  BackendConnectionStatus,
  EventFilters,
  SessionFilters,
  EventSubscriptionCallback,
  SessionSubscriptionCallback,
  ConnectionStatusCallback,
  SubscriptionHandle,
  SessionSummary,
  BackendMetadata,
  BackendConfig,
  ConnectionError,
  TimeoutError,
  AuthenticationError
} from './index';
import { Event, Session } from '@/types/events';
import { supabase } from '../supabase';
import { logger } from '../utils';

/**
 * Supabase backend implementation
 */
export class SupabaseBackend implements ChronicleBackend {
  private connectionStatus: BackendConnectionStatus = 'disconnected';
  private connectionStatusCallbacks = new Set<ConnectionStatusCallback>();
  private eventsChannel: RealtimeChannel | null = null;
  private sessionsChannel: RealtimeChannel | null = null;
  private eventSubscriptions = new Set<EventSubscriptionCallback>();
  private sessionSubscriptions = new Set<SessionSubscriptionCallback>();
  private config: BackendConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: BackendConfig = {}) {
    this.config = config;
  }

  /**
   * Connect to Supabase
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      this.setConnectionStatus('connecting');
      
      logger.info('Connecting to Supabase backend', {
        component: 'SupabaseBackend',
        action: 'connect'
      });

      // Test connection with a simple query
      await this.healthCheck();

      // Setup real-time subscriptions
      this.setupRealtimeChannels();

      // Start health monitoring
      this.startHealthMonitoring();

      this.setConnectionStatus('connected');
      this.connectionPromise = null;

      logger.info('Successfully connected to Supabase backend', {
        component: 'SupabaseBackend',
        action: 'connect'
      });

    } catch (error) {
      this.connectionPromise = null;
      this.setConnectionStatus('error');
      
      logger.error('Failed to connect to Supabase backend', {
        component: 'SupabaseBackend',
        action: 'connect'
      }, error as Error);

      if ((error as Error).message.includes('auth')) {
        throw new AuthenticationError('Supabase authentication failed', {
          error: (error as Error).message
        });
      }

      throw new ConnectionError('Failed to connect to Supabase backend', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Setup real-time channels for events and sessions
   */
  private setupRealtimeChannels(): void {
    // Events channel
    this.eventsChannel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chronicle_events',
        },
        (payload) => {
          const event: Event = payload.new as Event;
          this.eventSubscriptions.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              logger.error('Error in event subscription callback', {
                component: 'SupabaseBackend',
                action: 'handleEventCallback'
              }, error as Error);
            }
          });
        }
      )
      .subscribe();

    // Sessions channel
    this.sessionsChannel = supabase
      .channel('sessions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'chronicle_sessions',
        },
        (payload) => {
          const session: Session = (payload.new || payload.old) as Session;
          this.sessionSubscriptions.forEach(callback => {
            try {
              callback(session);
            } catch (error) {
              logger.error('Error in session subscription callback', {
                component: 'SupabaseBackend',
                action: 'handleSessionCallback'
              }, error as Error);
            }
          });
        }
      )
      .subscribe();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const interval = this.config.healthCheckInterval || 60000; // Default 1 minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.healthCheck();
        if (!isHealthy && this.connectionStatus === 'connected') {
          this.setConnectionStatus('error');
        }
      } catch (error) {
        logger.warn('Health check failed', {
          component: 'SupabaseBackend',
          action: 'healthCheck'
        }, error as Error);
        
        if (this.connectionStatus === 'connected') {
          this.setConnectionStatus('error');
        }
      }
    }, interval);
  }

  /**
   * Disconnect from Supabase
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Supabase backend', {
      component: 'SupabaseBackend',
      action: 'disconnect'
    });

    this.setConnectionStatus('disconnected');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Unsubscribe from real-time channels
    if (this.eventsChannel) {
      this.eventsChannel.unsubscribe();
      this.eventsChannel = null;
    }
    if (this.sessionsChannel) {
      this.sessionsChannel.unsubscribe();
      this.sessionsChannel = null;
    }

    // Clear callbacks
    this.connectionStatusCallbacks.clear();
    this.eventSubscriptions.clear();
    this.sessionSubscriptions.clear();

    this.connectionPromise = null;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): BackendConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Set connection status and notify callbacks
   */
  private setConnectionStatus(status: BackendConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.connectionStatusCallbacks.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          logger.error('Error in connection status callback', {
            component: 'SupabaseBackend',
            action: 'setConnectionStatus'
          }, error as Error);
        }
      });
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(callback: ConnectionStatusCallback): SubscriptionHandle {
    this.connectionStatusCallbacks.add(callback);
    return {
      unsubscribe: () => {
        this.connectionStatusCallbacks.delete(callback);
      }
    };
  }

  /**
   * Fetch events from Supabase
   */
  async getEvents(filters: EventFilters = {}): Promise<Event[]> {
    try {
      let query = supabase
        .from('chronicle_events')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply pagination
      if (filters.limit && filters.offset) {
        query = query.range(filters.offset, filters.offset + filters.limit - 1);
      } else if (filters.limit) {
        query = query.limit(filters.limit);
      }

      // Apply filters
      if (filters.sessionIds && filters.sessionIds.length > 0) {
        query = query.in('session_id', filters.sessionIds);
      }

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        query = query.in('event_type', filters.eventTypes);
      }

      if (filters.dateRange?.start) {
        query = query.gte('timestamp', filters.dateRange.start.toISOString());
      }

      if (filters.dateRange?.end) {
        query = query.lte('timestamp', filters.dateRange.end.toISOString());
      }

      if (filters.searchQuery) {
        query = query.textSearch('metadata', filters.searchQuery);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to fetch events from Supabase', {
        component: 'SupabaseBackend',
        action: 'getEvents'
      }, error as Error);

      throw new ConnectionError('Failed to fetch events from Supabase', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Subscribe to real-time event updates
   */
  subscribeToEvents(callback: EventSubscriptionCallback): SubscriptionHandle {
    this.eventSubscriptions.add(callback);

    return {
      unsubscribe: () => {
        this.eventSubscriptions.delete(callback);
      }
    };
  }

  /**
   * Fetch sessions from Supabase
   */
  async getSessions(filters: SessionFilters = {}): Promise<Session[]> {
    try {
      let query = supabase
        .from('chronicle_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      // Apply filters
      if (!filters.includeEnded) {
        query = query.is('end_time', null);
      }

      if (filters.projectPath) {
        query = query.eq('project_path', filters.projectPath);
      }

      if (filters.gitBranch) {
        query = query.eq('git_branch', filters.gitBranch);
      }

      if (filters.timeRangeMinutes) {
        const timeAgo = new Date();
        timeAgo.setMinutes(timeAgo.getMinutes() - filters.timeRangeMinutes);
        query = query.gte('start_time', timeAgo.toISOString());
      }

      // Exclude test sessions
      query = query.neq('project_path', 'test');

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to fetch sessions from Supabase', {
        component: 'SupabaseBackend',
        action: 'getSessions'
      }, error as Error);

      throw new ConnectionError('Failed to fetch sessions from Supabase', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Subscribe to real-time session updates
   */
  subscribeToSessions(callback: SessionSubscriptionCallback): SubscriptionHandle {
    this.sessionSubscriptions.add(callback);

    return {
      unsubscribe: () => {
        this.sessionSubscriptions.delete(callback);
      }
    };
  }

  /**
   * Get session summaries with analytics
   */
  async getSessionSummaries(sessionIds: string[]): Promise<SessionSummary[]> {
    if (sessionIds.length === 0) return [];

    try {
      // Try using the RPC function first
      const { data: rpcSummaries, error: rpcError } = await supabase
        .rpc('get_session_summaries', { session_ids: sessionIds });

      if (!rpcError && rpcSummaries) {
        logger.info('Successfully fetched session summaries via RPC', {
          component: 'SupabaseBackend',
          action: 'getSessionSummaries',
          data: { sessionCount: sessionIds.length, summaryCount: rpcSummaries.length }
        });
        return rpcSummaries;
      }

      // If RPC fails, fall back to manual aggregation
      if (rpcError) {
        logger.warn('RPC function failed, falling back to manual aggregation', {
          component: 'SupabaseBackend',
          action: 'getSessionSummaries',
          data: { error: rpcError.message }
        });
      }

      // Manual aggregation fallback
      const summaries: SessionSummary[] = [];

      for (const sessionId of sessionIds) {
        const { data: events, error: eventsError } = await supabase
          .from('chronicle_events')
          .select('event_type, metadata, timestamp, duration_ms')
          .eq('session_id', sessionId);

        if (eventsError) {
          logger.warn(`Failed to fetch events for session ${sessionId}`, {
            component: 'SupabaseBackend',
            action: 'getSessionSummaries',
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

    } catch (error) {
      logger.error('Failed to fetch session summaries from Supabase', {
        component: 'SupabaseBackend',
        action: 'getSessionSummaries'
      }, error as Error);

      throw new ConnectionError('Failed to fetch session summaries from Supabase', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Health check to verify Supabase connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('chronicle_events')
        .select('id')
        .limit(1);

      if (error) {
        logger.debug('Supabase health check failed', {
          component: 'SupabaseBackend',
          action: 'healthCheck',
          data: { error: error.message }
        });
        return false;
      }

      this.lastHealthCheck = new Date();
      return true;

    } catch (error) {
      logger.debug('Supabase health check failed with exception', {
        component: 'SupabaseBackend',
        action: 'healthCheck'
      });
      return false;
    }
  }

  /**
   * Get backend metadata
   */
  async getMetadata(): Promise<BackendMetadata> {
    try {
      // Get Supabase project info if available
      const url = supabase.supabaseUrl;
      
      return {
        type: 'supabase',
        version: 'cloud', // Supabase cloud doesn't expose version
        capabilities: {
          realtime: true,
          websockets: true,
          analytics: true,
          export: true,
        },
        connectionInfo: {
          url,
          lastPing: this.lastHealthCheck,
        }
      };

    } catch (error) {
      return {
        type: 'supabase',
        version: 'unknown',
        capabilities: {
          realtime: false,
          websockets: false,
          analytics: true,
          export: true,
        },
        connectionInfo: {
          url: supabase.supabaseUrl || 'unknown',
          lastPing: this.lastHealthCheck,
        }
      };
    }
  }
}