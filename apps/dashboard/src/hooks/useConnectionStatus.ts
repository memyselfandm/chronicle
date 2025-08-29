/**
 * Dedicated Connection Status Hook for Chronicle Dashboard
 * WebSocket/SSE focused connection monitoring with real-time state updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionManager, createConnectionManager } from '@/lib/connection/ConnectionManager';
import type {
  ConnectionState,
  ConnectionStatus,
  ConnectionQuality,
  UnsubscribeFunction
} from '@/types/chronicle';

export interface UseConnectionStatusConfig {
  url: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  enableEventQueue?: boolean;
  enablePersistence?: boolean;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onReconnectFailed?: () => void;
  onQueueOverflow?: (queueSize: number) => void;
}

export interface ConnectionStatusHook {
  // Connection state
  connectionState: ConnectionState;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  connectionQuality: ConnectionQuality;
  
  // Metrics
  reconnectAttempts: number;
  queuedEvents: number;
  lastEventReceived: Date | null;
  uptime: number;
  
  // Health status
  isHealthy: boolean;
  healthStatus: {
    isHealthy: boolean;
    connection: boolean;
    queue: boolean;
    eventProcessing: boolean;
    warnings: string[];
    errors: string[];
  };
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => void;
  clearQueue: () => void;
  
  // Event handling
  queueEvent: (event: any) => boolean;
  subscribe: (eventType: string, handler: (event: any) => void) => UnsubscribeFunction;
  
  // Error state
  error: string | null;
  hasError: boolean;
}

/**
 * Hook for managing WebSocket/SSE connection status with comprehensive monitoring
 */
export const useConnectionStatus = (config: UseConnectionStatusConfig): ConnectionStatusHook => {
  const {
    url,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    heartbeatInterval = 30000,
    enableEventQueue = true,
    enablePersistence = true,
    onConnectionChange,
    onReconnectFailed,
    onQueueOverflow
  } = config;

  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    lastUpdate: null,
    lastEventReceived: null,
    subscriptions: 0,
    reconnectAttempts: 0,
    error: null,
    isHealthy: false
  });
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState<number>(0);

  // Refs for cleanup and tracking
  const managerRef = useRef<ConnectionManager | null>(null);
  const unsubscribeRef = useRef<UnsubscribeFunction | null>(null);
  const connectStartTime = useRef<Date | null>(null);
  const uptimeInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize connection manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = createConnectionManager(url, {
        maxAttempts: reconnectAttempts,
        baseDelayMs: reconnectDelay,
        heartbeatInterval,
        enableEventQueue,
        enablePersistence
      });

      // Subscribe to connection state changes
      unsubscribeRef.current = managerRef.current.onConnectionStateChange((status) => {
        setConnectionState(status.state);
        setConnectionStatus(status);
        setError(status.error);

        // Track connection start time for uptime
        if (status.state === 'connected' && !connectStartTime.current) {
          connectStartTime.current = new Date();
          startUptimeTracking();
        } else if (status.state === 'disconnected') {
          connectStartTime.current = null;
          stopUptimeTracking();
          setUptime(0);
        }

        // Call external callback
        if (onConnectionChange) {
          onConnectionChange(status);
        }

        // Handle reconnect failure
        if (status.state === 'disconnected' && 
            status.reconnectAttempts >= reconnectAttempts && 
            onReconnectFailed) {
          onReconnectFailed();
        }

        // Handle queue overflow
        const queuedEvents = (status as any).queuedEvents || 0;
        if (queuedEvents > 800 && onQueueOverflow) {
          onQueueOverflow(queuedEvents);
        }
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      stopUptimeTracking();
    };
  }, [url, reconnectAttempts, reconnectDelay, heartbeatInterval, enableEventQueue, enablePersistence]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && managerRef.current && connectionState === 'disconnected') {
      managerRef.current.connect().catch(err => {
        setError(`Auto-connect failed: ${err.message}`);
      });
    }
  }, [autoConnect]);

  // Start uptime tracking
  const startUptimeTracking = useCallback(() => {
    if (uptimeInterval.current) {
      clearInterval(uptimeInterval.current);
    }

    uptimeInterval.current = setInterval(() => {
      if (connectStartTime.current) {
        const now = new Date();
        setUptime(now.getTime() - connectStartTime.current.getTime());
      }
    }, 1000);
  }, []);

  // Stop uptime tracking
  const stopUptimeTracking = useCallback(() => {
    if (uptimeInterval.current) {
      clearInterval(uptimeInterval.current);
      uptimeInterval.current = null;
    }
  }, []);

  // Connection actions
  const connect = useCallback(async (): Promise<void> => {
    if (managerRef.current) {
      setError(null);
      try {
        await managerRef.current.connect();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection failed';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }
  }, []);

  const disconnect = useCallback((): void => {
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
      setConnectionState('disconnected');
      setError(null);
    }
  }, []);

  const reconnect = useCallback((): void => {
    if (managerRef.current) {
      setError(null);
      managerRef.current.reconnect();
    }
  }, []);

  const clearQueue = useCallback((): void => {
    if (managerRef.current) {
      managerRef.current.clearQueue();
    }
  }, []);

  // Event handling
  const queueEvent = useCallback((event: any): boolean => {
    if (managerRef.current) {
      return managerRef.current.queueEvent(event);
    }
    return false;
  }, []);

  const subscribe = useCallback((eventType: string, handler: (event: any) => void): UnsubscribeFunction => {
    if (managerRef.current) {
      return managerRef.current.subscribe(eventType, handler);
    }
    return () => {};
  }, []);

  // Computed values
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isDisconnected = connectionState === 'disconnected';
  const hasError = error !== null;
  const connectionQuality: ConnectionQuality = connectionStatus.connectionQuality || 'unknown';
  const queuedEvents = (connectionStatus as any).queuedEvents || 0;

  // Get health status
  const healthStatus = managerRef.current?.getHealthStatus() || {
    isHealthy: false,
    connection: false,
    queue: false,
    eventProcessing: false,
    warnings: [],
    errors: []
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      stopUptimeTracking();
    };
  }, [stopUptimeTracking]);

  return {
    // Connection state
    connectionState,
    connectionStatus,
    isConnected,
    isConnecting,
    isDisconnected,
    connectionQuality,
    
    // Metrics
    reconnectAttempts: connectionStatus.reconnectAttempts,
    queuedEvents,
    lastEventReceived: connectionStatus.lastEventReceived,
    uptime,
    
    // Health status
    isHealthy: healthStatus.isHealthy,
    healthStatus,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    clearQueue,
    
    // Event handling
    queueEvent,
    subscribe,
    
    // Error state
    error,
    hasError
  };
};

/**
 * Simple connection status hook with minimal configuration
 */
export const useSimpleConnectionStatus = (url: string) => {
  return useConnectionStatus({
    url,
    autoConnect: true,
    reconnectAttempts: 3,
    reconnectDelay: 1000,
    enableEventQueue: true,
    enablePersistence: false
  });
};

/**
 * Production-ready connection status hook with full monitoring
 */
export const useProductionConnectionStatus = (url: string, callbacks?: {
  onConnectionChange?: (status: ConnectionStatus) => void;
  onReconnectFailed?: () => void;
  onQueueOverflow?: (queueSize: number) => void;
}) => {
  return useConnectionStatus({
    url,
    autoConnect: true,
    reconnectAttempts: 10,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    enableEventQueue: true,
    enablePersistence: true,
    ...callbacks
  });
};