import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, REALTIME_CONFIG } from '../lib/supabase';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: Date | null;
  lastEventReceived: Date | null;
  subscriptions: number;
  reconnectAttempts: number;
  error: string | null;
  isHealthy: boolean;
}

export interface UseSupabaseConnectionOptions {
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * Enhanced hook for monitoring Supabase connection state
 * Provides real-time connection monitoring, health checks, and auto-reconnect
 */
export const useSupabaseConnection = (options: UseSupabaseConnectionOptions = {}) => {
  const {
    enableHealthCheck = true,
    healthCheckInterval = 30000, // 30 seconds
    maxReconnectAttempts = REALTIME_CONFIG.RECONNECT_ATTEMPTS,
    reconnectDelay = 1000, // Start with 1 second
  } = options;

  // State management
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    lastUpdate: null,
    lastEventReceived: null,
    subscriptions: 0,
    reconnectAttempts: 0,
    error: null,
    isHealthy: false,
  });

  // Refs for tracking
  const channelsRef = useRef<Set<RealtimeChannel>>(new Set());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<Date | null>(null);

  /**
   * Updates connection status
   */
  const updateStatus = useCallback((updates: Partial<ConnectionStatus>) => {
    setStatus(prev => ({
      ...prev,
      ...updates,
      lastUpdate: new Date(),
    }));
  }, []);

  /**
   * Records when an event is received (for health monitoring)
   */
  const recordEventReceived = useCallback(() => {
    updateStatus({
      lastEventReceived: new Date(),
      isHealthy: true,
    });
  }, [updateStatus]);

  /**
   * Performs health check by testing connection
   */
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('chronicle_events')
        .select('id')
        .limit(1);

      if (error) {
        console.warn('Health check failed:', error.message);
        updateStatus({
          isHealthy: false,
          error: `Health check failed: ${error.message}`,
        });
        return false;
      }

      lastPingRef.current = new Date();
      updateStatus({
        isHealthy: true,
        error: null,
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown health check error';
      console.error('Health check error:', errorMessage);
      updateStatus({
        isHealthy: false,
        error: errorMessage,
      });
      return false;
    }
  }, [updateStatus]);

  /**
   * Starts health check monitoring
   */
  const startHealthCheck = useCallback(() => {
    if (!enableHealthCheck || healthCheckIntervalRef.current) return;

    healthCheckIntervalRef.current = setInterval(() => {
      performHealthCheck();
    }, healthCheckInterval);

    // Perform initial health check
    performHealthCheck();
  }, [enableHealthCheck, healthCheckInterval, performHealthCheck]);

  /**
   * Stops health check monitoring
   */
  const stopHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  /**
   * Reconnect with exponential backoff
   */
  const reconnect = useCallback(() => {
    if (status.reconnectAttempts >= maxReconnectAttempts) {
      updateStatus({
        state: 'error',
        error: 'Max reconnection attempts reached',
      });
      return;
    }

    const delay = reconnectDelay * Math.pow(2, status.reconnectAttempts);
    
    updateStatus({
      state: 'connecting',
      reconnectAttempts: status.reconnectAttempts + 1,
      error: null,
    });

    reconnectTimeoutRef.current = setTimeout(async () => {
      const isHealthy = await performHealthCheck();
      
      if (isHealthy) {
        updateStatus({
          state: 'connected',
          reconnectAttempts: 0,
          error: null,
        });
        startHealthCheck();
      } else {
        // Try again
        reconnect();
      }
    }, delay);
  }, [status.reconnectAttempts, maxReconnectAttempts, reconnectDelay, performHealthCheck, updateStatus, startHealthCheck]);

  /**
   * Manually retry connection
   */
  const retry = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset attempts and try to reconnect
    updateStatus({
      reconnectAttempts: 0,
      error: null,
    });
    
    reconnect();
  }, [reconnect, updateStatus]);

  /**
   * Registers a new channel for monitoring
   */
  const registerChannel = useCallback((channel: RealtimeChannel) => {
    channelsRef.current.add(channel);
    
    updateStatus({
      subscriptions: channelsRef.current.size,
    });

    // Set up connection state listeners
    channel.on('system', {}, (payload) => {
      if (payload.extension === 'postgres_changes') {
        switch (payload.status) {
          case 'ok':
            updateStatus({
              state: 'connected',
              reconnectAttempts: 0,
              error: null,
            });
            break;
          case 'error':
            updateStatus({
              state: 'error',
              error: payload.message || 'Connection error',
            });
            break;
        }
      }
    });

    // Monitor for successful subscription
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        updateStatus({
          state: 'connected',
          reconnectAttempts: 0,
          error: null,
        });
        startHealthCheck();
      } else if (status === 'CHANNEL_ERROR') {
        updateStatus({
          state: 'error',
          error: err?.message || 'Channel subscription error',
        });
        // Auto-reconnect on channel error
        setTimeout(() => reconnect(), 2000);
      } else if (status === 'TIMED_OUT') {
        updateStatus({
          state: 'disconnected',
          error: 'Connection timed out',
        });
        // Auto-reconnect on timeout
        setTimeout(() => reconnect(), 1000);
      }
    });

    return channel;
  }, [updateStatus, startHealthCheck, reconnect]);

  /**
   * Unregisters a channel
   */
  const unregisterChannel = useCallback((channel: RealtimeChannel) => {
    channelsRef.current.delete(channel);
    
    updateStatus({
      subscriptions: channelsRef.current.size,
    });

    // If no more channels, stop health check
    if (channelsRef.current.size === 0) {
      stopHealthCheck();
      updateStatus({
        state: 'disconnected',
        isHealthy: false,
      });
    }
  }, [updateStatus, stopHealthCheck]);

  /**
   * Gets connection quality based on recent activity
   */
  const getConnectionQuality = useCallback((): 'excellent' | 'good' | 'poor' | 'unknown' => {
    if (!status.lastEventReceived || !status.isHealthy) return 'unknown';
    
    const now = new Date();
    const timeSinceLastEvent = now.getTime() - status.lastEventReceived.getTime();
    
    // Quality based on how recent the last event was
    if (timeSinceLastEvent < 10000) return 'excellent'; // < 10s
    if (timeSinceLastEvent < 30000) return 'good';      // < 30s
    if (timeSinceLastEvent < 120000) return 'poor';     // < 2m
    return 'unknown';
  }, [status.lastEventReceived, status.isHealthy]);

  // Initialize connection monitoring
  useEffect(() => {
    updateStatus({
      state: 'connecting',
    });

    // Start with a health check to establish initial state
    performHealthCheck().then(isHealthy => {
      if (isHealthy) {
        updateStatus({
          state: 'connected',
        });
        startHealthCheck();
      } else {
        updateStatus({
          state: 'disconnected',
        });
      }
    });

    // Cleanup on unmount
    return () => {
      stopHealthCheck();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [performHealthCheck, startHealthCheck, stopHealthCheck, updateStatus]);

  return {
    status,
    registerChannel,
    unregisterChannel,
    recordEventReceived,
    retry,
    performHealthCheck,
    getConnectionQuality: getConnectionQuality(),
  };
};