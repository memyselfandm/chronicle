import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, REALTIME_CONFIG } from '../lib/supabase';
import { CONNECTION_DELAYS, MONITORING_INTERVALS } from '../lib/constants';
import { logger } from '../lib/utils';
import type {
  ConnectionState,
  ConnectionStatus,
  UseSupabaseConnectionOptions,
} from '../types/connection';

/**
 * Enhanced hook for monitoring Supabase connection state
 * Provides real-time connection monitoring, health checks, and auto-reconnect
 */
export const useSupabaseConnection = (options: UseSupabaseConnectionOptions = {}) => {
  const {
    enableHealthCheck = true,
    healthCheckInterval = MONITORING_INTERVALS.HEALTH_CHECK_INTERVAL,
    maxReconnectAttempts = REALTIME_CONFIG.RECONNECT_ATTEMPTS,
    reconnectDelay = CONNECTION_DELAYS.QUICK_RECONNECT_DELAY,
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
  
  // Debouncing refs
  const stateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const connectingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<ConnectionState | null>(null);

  /**
   * Updates connection status immediately (internal use)
   */
  const updateStatusImmediate = useCallback((updates: Partial<ConnectionStatus>) => {
    setStatus(prev => ({
      ...prev,
      ...updates,
      lastUpdate: new Date(),
    }));
  }, []);

  /**
   * Debounced state update to prevent flickering
   */
  const updateConnectionState = useCallback((newState: ConnectionState, debounceMs: number = CONNECTION_DELAYS.DEBOUNCE_DELAY) => {
    // Special handling for 'connecting' state - only show after delay
    if (newState === 'connecting') {
      // Clear any existing connecting timeout
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
        connectingTimeoutRef.current = null;
      }
      
      // Only show connecting if it takes longer than display delay
      connectingTimeoutRef.current = setTimeout(() => {
        if (pendingStateRef.current === 'connecting') {
          updateStatusImmediate({ state: 'connecting' });
        }
      }, CONNECTION_DELAYS.CONNECTING_DISPLAY_DELAY);
      
      pendingStateRef.current = newState;
      return;
    }
    
    // Clear connecting timeout if we're transitioning to a different state
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
    
    // For other states, use debouncing to prevent rapid changes
    pendingStateRef.current = newState;
    
    // Clear existing debounce timeout
    if (stateDebounceRef.current) {
      clearTimeout(stateDebounceRef.current);
    }
    
    // If transitioning from connected to disconnected, add a small delay
    // to prevent flickers from temporary network hiccups
    const currentState = status.state;
    const shouldDebounce = (
      (currentState === 'connected' && newState === 'disconnected') ||
      (currentState === 'disconnected' && newState === 'connected')
    );
    
    const delay = shouldDebounce ? debounceMs : 0;
    
    stateDebounceRef.current = setTimeout(() => {
      if (pendingStateRef.current === newState) {
        updateStatusImmediate({ state: newState });
        pendingStateRef.current = null;
      }
    }, delay);
  }, [status.state, updateStatusImmediate]);

  /**
   * Updates connection status (uses debouncing for state changes)
   */
  const updateStatus = useCallback((updates: Partial<ConnectionStatus>) => {
    // Handle state changes with debouncing
    if (updates.state && updates.state !== status.state) {
      const { state, ...otherUpdates } = updates;
      
      // Update other properties immediately
      if (Object.keys(otherUpdates).length > 0) {
        updateStatusImmediate(otherUpdates);
      }
      
      // Update state with debouncing
      updateConnectionState(state);
    } else {
      // No state change, update immediately
      updateStatusImmediate(updates);
    }
  }, [status.state, updateStatusImmediate, updateConnectionState]);

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
   * Only changes connection state if there's a persistent issue
   */
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      // Simple query to test connection - use sessions table which we know works
      const { error } = await supabase
        .from('chronicle_sessions')
        .select('id')
        .limit(1);

      if (error) {
        // Check for CORS/network errors which indicate backend is down
        const isCorsError = error.message?.includes('Failed to fetch') || 
                           error.message?.includes('CORS') ||
                           error.message?.includes('NetworkError');
        
        if (isCorsError) {
          logger.warn('Supabase connection failed - backend may be down', {
            component: 'useSupabaseConnection',
            action: 'performHealthCheck',
            data: { error: error.message }
          });
          updateStatus({
            isHealthy: false,
            error: 'Supabase backend is unreachable (CORS/Network error). Service may be down.',
            state: 'error'
          });
          return false;
        }
        
        logger.warn('Health check failed', {
          component: 'useSupabaseConnection', 
          action: 'performHealthCheck',
          data: { error: error.message }
        });
        
        // Only update to error state if we're currently connected
        // and this represents a real connectivity issue
        const shouldUpdateState = status.state === 'connected' && 
          (error.message.includes('network') || error.message.includes('timeout'));
        
        updateStatus({
          isHealthy: false,
          error: `Health check failed: ${error.message}`,
          ...(shouldUpdateState && { state: 'disconnected' })
        });
        return false;
      }

      lastPingRef.current = new Date();
      
      // Health check passed - only update health status, not connection state
      // unless we were previously in an error state
      const updates: Partial<ConnectionStatus> = {
        isHealthy: true,
        error: null,
      };
      
      // If we were disconnected and health check passes, transition to connected
      if (status.state === 'disconnected' || status.state === 'error') {
        updates.state = 'connected';
      }
      
      updateStatus(updates);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown health check error';
      logger.error('Health check error', {
        component: 'useSupabaseConnection',
        action: 'performHealthCheck',
        data: { errorMessage }
      });
      
      // Only transition to error state if we're not already there
      updateStatus({
        isHealthy: false,
        error: errorMessage,
        ...(status.state !== 'error' && { state: 'error' })
      });
      return false;
    }
  }, [updateStatus, status.state]);

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
    // Clear any pending timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (stateDebounceRef.current) {
      clearTimeout(stateDebounceRef.current);
      stateDebounceRef.current = null;
    }
    
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
    
    pendingStateRef.current = null;

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
        setTimeout(() => reconnect(), CONNECTION_DELAYS.RECONNECT_DELAY);
      } else if (status === 'TIMED_OUT') {
        updateStatus({
          state: 'disconnected',
          error: 'Connection timed out',
        });
        // Auto-reconnect on timeout
        setTimeout(() => reconnect(), CONNECTION_DELAYS.QUICK_RECONNECT_DELAY);
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
    if (timeSinceLastEvent < MONITORING_INTERVALS.RECENT_EVENT_THRESHOLD) return 'good';
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
      
      // Clear all timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (stateDebounceRef.current) {
        clearTimeout(stateDebounceRef.current);
        stateDebounceRef.current = null;
      }
      
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
        connectingTimeoutRef.current = null;
      }
      
      // Clear pending state
      pendingStateRef.current = null;
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