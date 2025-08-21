/**
 * WebSocket Connection Manager for Chronicle Dashboard
 * Implements exponential backoff, health monitoring, and event queuing
 */

import {
  ConnectionState,
  ConnectionStatus,
  ConnectionQuality,
  ConnectionManagerState,
  ConnectionMetrics,
  ReconnectConfig,
  SubscriptionType,
  SubscriptionConfig,
  SubscriptionHealth,
  HealthCheckResult,
  DEFAULT_RECONNECT_CONFIG,
  EventHandler,
  UnsubscribeFunction
} from '../types/chronicle';

import { EventBatcher } from './eventBatcher';

/**
 * WebSocket connection manager with intelligent reconnection and health monitoring
 */
export class ConnectionManager {
  private websocket: WebSocket | null = null;
  private reconnectConfig: ReconnectConfig;
  private currentState: ConnectionManagerState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private eventBatcher: EventBatcher;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private eventQueue: any[] = [];
  private isDestroyed = false;

  // Health monitoring
  private lastHeartbeatSent: Date | null = null;
  private lastHeartbeatReceived: Date | null = null;
  private connectionStartTime: Date | null = null;
  private latencyHistory: number[] = [];

  constructor(
    private url: string,
    config: Partial<ReconnectConfig> = {},
    eventBatcher?: EventBatcher
  ) {
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...config };
    this.eventBatcher = eventBatcher || new EventBatcher();
    
    this.currentState = {
      isConnected: false,
      connectionQuality: 'unknown',
      lastConnectTime: null,
      reconnectAttempt: 0,
      pendingEvents: [],
      subscriptions: new Map(),
      metrics: this.createInitialMetrics()
    };

    this.initializeConnection();
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionManagerState {
    return { ...this.currentState };
  }

  /**
   * Get connection status for UI components
   */
  public getConnectionStatus(): ConnectionStatus {
    return {
      state: this.currentState.isConnected ? 'connected' : 
             this.reconnectTimer ? 'connecting' : 'disconnected',
      lastUpdate: this.currentState.lastConnectTime,
      lastEventReceived: this.currentState.metrics.lastHeartbeat,
      subscriptions: this.currentState.subscriptions.size,
      reconnectAttempts: this.currentState.reconnectAttempt,
      error: null,
      isHealthy: this.isConnectionHealthy()
    };
  }

  /**
   * Initialize WebSocket connection
   */
  private initializeConnection(): void {
    if (this.isDestroyed) return;

    try {
      this.websocket = new WebSocket(this.url);
      this.connectionStartTime = new Date();
      
      this.websocket.onopen = this.handleOpen.bind(this);
      this.websocket.onmessage = this.handleMessage.bind(this);
      this.websocket.onclose = this.handleClose.bind(this);
      this.websocket.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('ConnectionManager: Failed to create WebSocket', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('ConnectionManager: WebSocket connected');
    
    this.currentState.isConnected = true;
    this.currentState.lastConnectTime = new Date();
    this.currentState.reconnectAttempt = 0;
    this.currentState.connectionQuality = 'good';
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Start heartbeat monitoring
    this.startHeartbeat();
    this.startHealthCheck();

    // Process queued events
    this.processEventQueue();

    // Reestablish subscriptions
    this.reestablishSubscriptions();

    // Notify listeners
    this.notifyStateChange();
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle heartbeat response
      if (data.type === 'heartbeat_response') {
        this.handleHeartbeatResponse(data);
        return;
      }

      // Update metrics
      this.currentState.metrics.totalEventsReceived++;
      this.currentState.metrics.lastHeartbeat = new Date();

      // Route to appropriate handlers
      this.routeMessage(data);

    } catch (error) {
      console.error('ConnectionManager: Failed to parse message', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('ConnectionManager: WebSocket closed', event.code, event.reason);
    
    this.currentState.isConnected = false;
    this.currentState.connectionQuality = 'unknown';
    
    this.stopHeartbeat();
    this.stopHealthCheck();

    // Schedule reconnect if not intentionally closed
    if (!this.isDestroyed && event.code !== 1000) {
      this.scheduleReconnect();
    }

    this.notifyStateChange();
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event): void {
    console.error('ConnectionManager: WebSocket error', error);
    this.currentState.connectionQuality = 'poor';
    this.notifyStateChange();
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;

    const attempt = this.currentState.reconnectAttempt;
    
    if (attempt >= this.reconnectConfig.maxAttempts) {
      console.error('ConnectionManager: Max reconnect attempts reached');
      return;
    }

    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(
      this.reconnectConfig.baseDelayMs * Math.pow(this.reconnectConfig.backoffFactor, attempt),
      this.reconnectConfig.maxDelayMs
    );
    
    const jitter = Math.random() * this.reconnectConfig.jitterMs;
    const delay = baseDelay + jitter;

    console.log(`ConnectionManager: Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.currentState.reconnectAttempt++;
      this.currentState.metrics.reconnectCount++;
      this.reconnectTimer = null;
      this.initializeConnection();
    }, delay);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    const sendHeartbeat = () => {
      if (!this.currentState.isConnected || !this.websocket) return;
      
      this.lastHeartbeatSent = new Date();
      
      this.websocket.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: this.lastHeartbeatSent.toISOString()
      }));
    };

    // Send initial heartbeat
    sendHeartbeat();
    
    // Schedule periodic heartbeats
    this.heartbeatTimer = setInterval(sendHeartbeat, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle heartbeat response for latency calculation
   */
  private handleHeartbeatResponse(data: any): void {
    if (!this.lastHeartbeatSent) return;
    
    this.lastHeartbeatReceived = new Date();
    const latency = this.lastHeartbeatReceived.getTime() - this.lastHeartbeatSent.getTime();
    
    // Track latency history (keep last 10 measurements)
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }
    
    // Calculate average latency
    this.currentState.metrics.averageLatency = 
      this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    
    // Update connection quality based on latency
    this.updateConnectionQuality(latency);
  }

  /**
   * Update connection quality based on latency
   */
  private updateConnectionQuality(latency: number): void {
    if (latency < 100) {
      this.currentState.connectionQuality = 'excellent';
    } else if (latency < 300) {
      this.currentState.connectionQuality = 'good';
    } else {
      this.currentState.connectionQuality = 'poor';
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 5000); // 5 seconds
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): HealthCheckResult {
    const now = new Date();
    const checks = {
      connection: this.currentState.isConnected,
      subscriptions: this.areSubscriptionsHealthy(),
      eventProcessing: this.eventBatcher.isHealthy(),
      performance: this.currentState.metrics.averageLatency < 1000
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for connection staleness
    if (this.lastHeartbeatReceived) {
      const timeSinceHeartbeat = now.getTime() - this.lastHeartbeatReceived.getTime();
      if (timeSinceHeartbeat > 60000) { // 1 minute
        warnings.push('No heartbeat received in over 1 minute');
      }
    }

    // Check subscription health
    this.currentState.subscriptions.forEach((health) => {
      if (health.errorCount > 5) {
        errors.push(`Subscription ${health.id} has high error count: ${health.errorCount}`);
      }
      if (health.missedHeartbeats > 3) {
        warnings.push(`Subscription ${health.id} missed ${health.missedHeartbeats} heartbeats`);
      }
    });

    const isHealthy = Object.values(checks).every(check => check) && errors.length === 0;

    return {
      isHealthy,
      checks,
      metrics: this.currentState.metrics,
      warnings,
      errors
    };
  }

  /**
   * Check if all subscriptions are healthy
   */
  private areSubscriptionsHealthy(): boolean {
    for (const [_, health] of this.currentState.subscriptions) {
      if (!health.isActive || health.errorCount > 5 || health.missedHeartbeats > 3) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if connection is healthy
   */
  private isConnectionHealthy(): boolean {
    const healthCheck = this.performHealthCheck();
    return healthCheck.isHealthy;
  }

  /**
   * Process queued events when connection is restored
   */
  private processEventQueue(): void {
    if (!this.currentState.isConnected || this.eventQueue.length === 0) {
      return;
    }

    console.log(`ConnectionManager: Processing ${this.eventQueue.length} queued events`);
    
    // Send queued events through event batcher
    this.eventBatcher.addEvents(this.eventQueue);
    this.eventQueue = [];
  }

  /**
   * Reestablish subscriptions after reconnection
   */
  private reestablishSubscriptions(): void {
    this.currentState.subscriptions.forEach((health, subscriptionId) => {
      // Reset health status for reestablished subscriptions
      health.isActive = true;
      health.errorCount = 0;
      health.missedHeartbeats = 0;
      health.lastEventTime = new Date();
    });
  }

  /**
   * Route incoming messages to appropriate handlers
   */
  private routeMessage(data: any): void {
    const eventType = data.type || 'unknown';
    const handlers = this.listeners.get(eventType) || this.listeners.get('*');
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`ConnectionManager: Handler error for ${eventType}`, error);
        }
      });
    }

    // Add to event batcher for processing
    this.eventBatcher.addEvent(data);
  }

  /**
   * Subscribe to specific event types
   */
  public subscribe(eventType: string, handler: EventHandler): UnsubscribeFunction {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(handler);
    
    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Send message through WebSocket
   */
  public send(message: any): boolean {
    if (!this.currentState.isConnected || !this.websocket) {
      // Queue message for later delivery
      this.eventQueue.push(message);
      return false;
    }

    try {
      this.websocket.send(JSON.stringify(message));
      this.currentState.metrics.totalEventsSent++;
      return true;
    } catch (error) {
      console.error('ConnectionManager: Failed to send message', error);
      this.eventQueue.push(message);
      return false;
    }
  }

  /**
   * Notify listeners of state changes
   */
  private notifyStateChange(): void {
    const stateHandlers = this.listeners.get('state_change');
    if (stateHandlers) {
      const status = this.getConnectionStatus();
      stateHandlers.forEach(handler => {
        try {
          handler(status);
        } catch (error) {
          console.error('ConnectionManager: State change handler error', error);
        }
      });
    }
  }

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): ConnectionMetrics {
    return {
      averageLatency: 0,
      eventThroughput: 0,
      reconnectCount: 0,
      totalEventsReceived: 0,
      totalEventsSent: 0,
      uptime: 0,
      lastHeartbeat: null
    };
  }

  /**
   * Get comprehensive health status
   */
  public getHealthStatus(): HealthCheckResult {
    return this.performHealthCheck();
  }

  /**
   * Force reconnection
   */
  public reconnect(): void {
    if (this.websocket) {
      this.websocket.close();
    }
    this.currentState.reconnectAttempt = 0;
    this.initializeConnection();
  }

  /**
   * Cleanup and destroy connection manager
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    this.stopHeartbeat();
    this.stopHealthCheck();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.websocket) {
      this.websocket.close(1000, 'Connection manager destroyed');
      this.websocket = null;
    }
    
    this.listeners.clear();
    this.eventQueue = [];
    
    if (this.eventBatcher) {
      this.eventBatcher.destroy();
    }
  }
}

/**
 * Create a singleton connection manager instance
 */
let globalConnectionManager: ConnectionManager | null = null;

export const getConnectionManager = (
  url?: string, 
  config?: Partial<ReconnectConfig>
): ConnectionManager => {
  if (!globalConnectionManager && url) {
    globalConnectionManager = new ConnectionManager(url, config);
  }
  
  if (!globalConnectionManager) {
    throw new Error('ConnectionManager: URL required for initial creation');
  }
  
  return globalConnectionManager;
};

/**
 * Reset the global instance (useful for testing)
 */
export const resetConnectionManager = (): void => {
  if (globalConnectionManager) {
    globalConnectionManager.destroy();
    globalConnectionManager = null;
  }
};