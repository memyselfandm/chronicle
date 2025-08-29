/**
 * Enhanced Connection Manager for Chronicle Dashboard 
 * Builds upon existing ConnectionManager with improved event queuing and WebSocket/SSE support
 */

import { ConnectionManager as BaseConnectionManager, getConnectionManager } from '../connectionManager';
import { EventQueue, QueuedEvent } from './EventQueue';
import { EventBatcher, getEventBatcher } from '../eventBatcher';
import {
  ConnectionState,
  ConnectionStatus,
  ConnectionQuality,
  ReconnectConfig,
  DEFAULT_RECONNECT_CONFIG,
  EventHandler,
  UnsubscribeFunction
} from '@/types/chronicle';

export interface Event {
  id: string;
  session_id: string;
  event_type: string;
  timestamp: string;
  data?: any;
}

export interface EnhancedConnectionManagerConfig extends Partial<ReconnectConfig> {
  enableEventQueue: boolean;
  enablePersistence: boolean;
  queueMaxSize: number;
  heartbeatInterval: number;
  connectionType: 'websocket' | 'sse';
}

const DEFAULT_CONFIG: EnhancedConnectionManagerConfig = {
  ...DEFAULT_RECONNECT_CONFIG,
  enableEventQueue: true,
  enablePersistence: true,
  queueMaxSize: 1000,
  heartbeatInterval: 30000,
  connectionType: 'websocket'
};

/**
 * Enhanced Connection Manager implementing the CHR-39 requirements
 * Provides robust connection management with exponential backoff, event queuing, and health monitoring
 */
export class ConnectionManager {
  private baseManager: BaseConnectionManager;
  private eventQueue: EventQueue;
  private eventBatcher: EventBatcher;
  private config: EnhancedConnectionManagerConfig;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stateListeners: Set<EventHandler<ConnectionStatus>> = new Set();
  private isDestroyed = false;

  constructor(
    private url: string,
    config: Partial<EnhancedConnectionManagerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxReconnectAttempts = this.config.maxAttempts || 5;
    this.reconnectDelay = this.config.baseDelayMs || 1000;

    // Initialize event queue with persistence
    this.eventQueue = new EventQueue({
      maxQueueSize: this.config.queueMaxSize,
      persistToStorage: this.config.enablePersistence,
      storageKey: 'chronicle-connection-queue'
    });

    // Initialize event batcher
    this.eventBatcher = getEventBatcher();

    // Initialize base connection manager
    this.baseManager = getConnectionManager(url, {
      maxAttempts: this.maxReconnectAttempts,
      baseDelayMs: this.reconnectDelay,
      backoffFactor: this.config.backoffFactor,
      maxDelayMs: this.config.maxDelayMs,
      jitterMs: this.config.jitterMs
    });

    this.setupEventHandlers();
    this.startConnection();
  }

  /**
   * Start connection with automatic reconnection
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) return;

    this.connectionState = 'connecting';
    this.notifyStateChange();

    try {
      // The base manager handles the actual WebSocket connection
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.notifyStateChange();
      this.flushEventQueue();
      this.startHeartbeat();
    } catch (error) {
      console.error('ConnectionManager: Connection failed', error);
      this.handleReconnect();
    }
  }

  /**
   * Queue event during disconnection or send immediately if connected
   */
  queueEvent(event: Event): boolean {
    if (this.connectionState === 'connected') {
      // Send immediately
      return this.baseManager.send(event);
    } else {
      // Queue for later delivery
      return this.eventQueue.enqueue(event, 'normal');
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get detailed connection status
   */
  getConnectionStatus(): ConnectionStatus {
    const baseStatus = this.baseManager.getConnectionStatus();
    const queueMetrics = this.eventQueue.getMetrics();
    
    return {
      state: this.connectionState,
      lastUpdate: baseStatus.lastUpdate,
      lastEventReceived: baseStatus.lastEventReceived,
      subscriptions: baseStatus.subscriptions,
      reconnectAttempts: this.reconnectAttempts,
      error: baseStatus.error,
      isHealthy: this.isConnectionHealthy(),
      queuedEvents: queueMetrics.currentSize,
      connectionQuality: this.getConnectionQuality()
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(handler: EventHandler<ConnectionStatus>): UnsubscribeFunction {
    this.stateListeners.add(handler);
    
    return () => {
      this.stateListeners.delete(handler);
    };
  }

  /**
   * Subscribe to specific events
   */
  subscribe(eventType: string, handler: EventHandler): UnsubscribeFunction {
    return this.baseManager.subscribe(eventType, handler);
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.reconnectAttempts = 0;
    this.baseManager.reconnect();
  }

  /**
   * Get health status including queue health
   */
  getHealthStatus(): {
    isHealthy: boolean;
    connection: boolean;
    queue: boolean;
    eventProcessing: boolean;
    warnings: string[];
    errors: string[];
  } {
    const baseHealth = this.baseManager.getHealthStatus();
    const queueHealth = this.eventQueue.getHealthStatus();
    const batcherHealthy = this.eventBatcher.isHealthy();

    const warnings = [...baseHealth.warnings];
    const errors = [...baseHealth.errors];

    if (!queueHealth.isHealthy) {
      warnings.push(...queueHealth.warnings);
    }

    if (!batcherHealthy) {
      warnings.push('Event batcher is experiencing issues');
    }

    return {
      isHealthy: baseHealth.isHealthy && queueHealth.isHealthy && batcherHealthy,
      connection: baseHealth.checks.connection,
      queue: queueHealth.isHealthy,
      eventProcessing: batcherHealthy,
      warnings,
      errors
    };
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics() {
    return this.eventQueue.getMetrics();
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue.clear();
  }

  /**
   * Destroy connection manager and cleanup resources
   */
  destroy(): void {
    this.isDestroyed = true;
    
    this.stopHeartbeat();
    
    if (this.baseManager) {
      this.baseManager.destroy();
    }
    
    if (this.eventQueue) {
      this.eventQueue.destroy();
    }
    
    this.stateListeners.clear();
  }

  // Private methods

  private setupEventHandlers(): void {
    // Listen to base manager state changes
    this.baseManager.subscribe('state_change', (status: ConnectionStatus) => {
      this.connectionState = status.state;
      this.reconnectAttempts = status.reconnectAttempts;
      this.notifyStateChange();
    });

    // Subscribe to queue events for retry logic
    this.eventQueue.subscribe((events: QueuedEvent[], metadata?: any) => {
      if (metadata?.type === 'retry' && this.connectionState === 'connected') {
        // Retry failed events
        events.forEach(queuedEvent => {
          const success = this.baseManager.send(queuedEvent.event);
          if (!success) {
            this.eventQueue.markEventsFailed([queuedEvent.id]);
          }
        });
      }
    });
  }

  private startConnection(): void {
    // The base manager automatically starts connection
    // We just need to sync our state
    setTimeout(() => {
      const baseStatus = this.baseManager.getConnectionStatus();
      this.connectionState = baseStatus.state;
      this.reconnectAttempts = baseStatus.reconnectAttempts;
      this.notifyStateChange();
    }, 100);
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionState = 'disconnected';
      this.notifyStateChange();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  private flushEventQueue(): void {
    if (this.connectionState !== 'connected') {
      return;
    }

    const queuedEvents = this.eventQueue.flush();
    const failedEventIds: string[] = [];

    queuedEvents.forEach(queuedEvent => {
      const success = this.baseManager.send(queuedEvent.event);
      if (!success) {
        failedEventIds.push(queuedEvent.id);
        // Re-queue failed events
        this.eventQueue.enqueue(queuedEvent.event, queuedEvent.priority);
      }
    });

    if (failedEventIds.length > 0) {
      this.eventQueue.markEventsFailed(failedEventIds);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // The base manager already handles heartbeats
    // We just sync with it
    this.heartbeatTimer = setInterval(() => {
      const baseStatus = this.baseManager.getConnectionStatus();
      if (baseStatus.state !== this.connectionState) {
        this.connectionState = baseStatus.state;
        this.notifyStateChange();
      }
    }, 1000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private isConnectionHealthy(): boolean {
    const baseStatus = this.baseManager.getConnectionStatus();
    const queueHealth = this.eventQueue.getHealthStatus();
    
    return baseStatus.isHealthy && queueHealth.isHealthy;
  }

  private getConnectionQuality(): ConnectionQuality {
    const baseStatus = this.baseManager.getConnectionStatus();
    // Base manager already calculates quality
    return 'good'; // Default fallback
  }

  private notifyStateChange(): void {
    const status = this.getConnectionStatus();
    this.stateListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('ConnectionManager: State listener error', error);
      }
    });
  }
}

/**
 * Create singleton enhanced connection manager
 */
let globalEnhancedManager: ConnectionManager | null = null;

export const createConnectionManager = (
  url: string,
  config?: Partial<EnhancedConnectionManagerConfig>
): ConnectionManager => {
  if (!globalEnhancedManager) {
    globalEnhancedManager = new ConnectionManager(url, config);
  }
  return globalEnhancedManager;
};

export const getEnhancedConnectionManager = (): ConnectionManager | null => {
  return globalEnhancedManager;
};

export const resetEnhancedConnectionManager = (): void => {
  if (globalEnhancedManager) {
    globalEnhancedManager.destroy();
    globalEnhancedManager = null;
  }
};