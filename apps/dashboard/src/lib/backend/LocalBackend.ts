/**
 * Local Chronicle Backend Implementation
 * Connects to Chronicle server running on localhost:8510
 */

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
  ValidationError
} from './index';
import { Event, Session } from '@/types/events';
import { logger } from '../utils';

/**
 * WebSocket message types for Chronicle local server
 */
interface WebSocketMessage {
  type: 'event' | 'session' | 'heartbeat' | 'error' | 'subscribe' | 'unsubscribe';
  data?: unknown;
  id?: string;
  error?: string;
}

/**
 * Local backend implementation for Chronicle server
 */
export class LocalBackend implements ChronicleBackend {
  private serverUrl: string;
  private ws: WebSocket | null = null;
  private connectionStatus: BackendConnectionStatus = 'disconnected';
  private connectionStatusCallbacks = new Set<ConnectionStatusCallback>();
  private eventSubscriptions = new Set<EventSubscriptionCallback>();
  private sessionSubscriptions = new Set<SessionSubscriptionCallback>();
  private config: BackendConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(serverUrl: string, config: BackendConfig = {}) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.config = config;
    this.maxReconnectAttempts = config.retryAttempts || 5;
    this.reconnectDelay = config.retryDelay || 2000;
  }

  /**
   * Connect to the Chronicle local server
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
      logger.info('Connecting to Chronicle local server', {
        component: 'LocalBackend',
        action: 'connect',
        data: { serverUrl: this.serverUrl }
      });

      // First test HTTP connectivity
      await this.healthCheck();

      // Setup WebSocket connection for real-time updates
      await this.setupWebSocketConnection();

      // Start health monitoring
      this.startHealthMonitoring();

      this.setConnectionStatus('connected');
      this.reconnectAttempts = 0;
      this.connectionPromise = null;

      logger.info('Successfully connected to Chronicle local server', {
        component: 'LocalBackend',
        action: 'connect'
      });

    } catch (error) {
      this.connectionPromise = null;
      this.setConnectionStatus('error');
      
      logger.error('Failed to connect to Chronicle local server', {
        component: 'LocalBackend',
        action: 'connect'
      }, error as Error);

      throw new ConnectionError(
        'Failed to connect to Chronicle local server',
        { serverUrl: this.serverUrl, error: (error as Error).message }
      );
    }
  }

  /**
   * Setup WebSocket connection for real-time updates
   */
  private async setupWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws';
        logger.debug('Connecting to WebSocket', {
          component: 'LocalBackend',
          action: 'setupWebSocket',
          data: { wsUrl }
        });

        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
          reject(new TimeoutError('WebSocket connection timeout'));
        }, this.config.timeout || 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          logger.debug('WebSocket connected', {
            component: 'LocalBackend',
            action: 'webSocketOpen'
          });
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          logger.warn('WebSocket connection closed', {
            component: 'LocalBackend',
            action: 'webSocketClose',
            data: { code: event.code, reason: event.reason }
          });
          
          if (this.connectionStatus === 'connected') {
            this.attemptReconnection();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          logger.error('WebSocket error', {
            component: 'LocalBackend',
            action: 'webSocketError'
          });
          reject(new ConnectionError('WebSocket connection error'));
        };

      } catch (error) {
        reject(new ConnectionError('Failed to create WebSocket connection', {
          error: (error as Error).message
        }));
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'event':
          if (message.data) {
            this.eventSubscriptions.forEach(callback => {
              try {
                callback(message.data as Event);
              } catch (error) {
                logger.error('Error in event subscription callback', {
                  component: 'LocalBackend',
                  action: 'handleEventCallback'
                }, error as Error);
              }
            });
          }
          break;

        case 'session':
          if (message.data) {
            this.sessionSubscriptions.forEach(callback => {
              try {
                callback(message.data as Session);
              } catch (error) {
                logger.error('Error in session subscription callback', {
                  component: 'LocalBackend',
                  action: 'handleSessionCallback'
                }, error as Error);
              }
            });
          }
          break;

        case 'heartbeat':
          this.lastHeartbeat = new Date();
          break;

        case 'error':
          logger.error('Received error from Chronicle server', {
            component: 'LocalBackend',
            action: 'handleWebSocketMessage',
            data: { error: message.error }
          });
          break;

        default:
          logger.warn('Unknown WebSocket message type', {
            component: 'LocalBackend',
            action: 'handleWebSocketMessage',
            data: { type: message.type }
          });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        component: 'LocalBackend',
        action: 'handleWebSocketMessage'
      }, error as Error);
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
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
        await this.healthCheck();
      } catch (error) {
        logger.warn('Health check failed', {
          component: 'LocalBackend',
          action: 'healthCheck'
        }, error as Error);
        
        if (this.connectionStatus === 'connected') {
          this.setConnectionStatus('error');
          this.attemptReconnection();
        }
      }
    }, interval);
  }

  /**
   * Attempt to reconnect on connection failure
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', {
        component: 'LocalBackend',
        action: 'attemptReconnection',
        data: { attempts: this.reconnectAttempts }
      });
      this.setConnectionStatus('error');
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionStatus('retrying');

    logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
      component: 'LocalBackend',
      action: 'attemptReconnection'
    });

    setTimeout(() => {
      this.connect().catch(error => {
        logger.error('Reconnection failed', {
          component: 'LocalBackend',
          action: 'attemptReconnection'
        }, error as Error);
      });
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Chronicle local server', {
      component: 'LocalBackend',
      action: 'disconnect'
    });

    this.setConnectionStatus('disconnected');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    // Clear callbacks
    this.connectionStatusCallbacks.clear();
    this.eventSubscriptions.clear();
    this.sessionSubscriptions.clear();

    this.connectionPromise = null;
    this.reconnectAttempts = 0;
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
            component: 'LocalBackend',
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
   * Fetch events from Chronicle server
   */
  async getEvents(filters: EventFilters = {}): Promise<Event[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.offset) params.set('offset', filters.offset.toString());
      if (filters.sessionIds?.length) {
        params.set('session_ids', filters.sessionIds.join(','));
      }
      if (filters.eventTypes?.length) {
        params.set('event_types', filters.eventTypes.join(','));
      }
      if (filters.searchQuery) params.set('search', filters.searchQuery);
      if (filters.dateRange?.start) {
        params.set('start_date', filters.dateRange.start.toISOString());
      }
      if (filters.dateRange?.end) {
        params.set('end_date', filters.dateRange.end.toISOString());
      }

      const url = `${this.serverUrl}/api/events?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.events || [];

    } catch (error) {
      logger.error('Failed to fetch events', {
        component: 'LocalBackend',
        action: 'getEvents'
      }, error as Error);

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError('Request timeout while fetching events');
      }

      throw new ConnectionError('Failed to fetch events from Chronicle server', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Subscribe to real-time event updates
   */
  subscribeToEvents(callback: EventSubscriptionCallback): SubscriptionHandle {
    this.eventSubscriptions.add(callback);

    // Send subscription message to server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', data: { channel: 'events' } }));
    }

    return {
      unsubscribe: () => {
        this.eventSubscriptions.delete(callback);
        
        // If no more event subscriptions, unsubscribe from server
        if (this.eventSubscriptions.size === 0 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'unsubscribe', data: { channel: 'events' } }));
        }
      }
    };
  }

  /**
   * Fetch sessions from Chronicle server
   */
  async getSessions(filters: SessionFilters = {}): Promise<Session[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.timeRangeMinutes) {
        params.set('time_range_minutes', filters.timeRangeMinutes.toString());
      }
      if (filters.includeEnded !== undefined) {
        params.set('include_ended', filters.includeEnded.toString());
      }
      if (filters.projectPath) params.set('project_path', filters.projectPath);
      if (filters.gitBranch) params.set('git_branch', filters.gitBranch);

      const url = `${this.serverUrl}/api/sessions?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.sessions || [];

    } catch (error) {
      logger.error('Failed to fetch sessions', {
        component: 'LocalBackend',
        action: 'getSessions'
      }, error as Error);

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError('Request timeout while fetching sessions');
      }

      throw new ConnectionError('Failed to fetch sessions from Chronicle server', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Subscribe to real-time session updates
   */
  subscribeToSessions(callback: SessionSubscriptionCallback): SubscriptionHandle {
    this.sessionSubscriptions.add(callback);

    // Send subscription message to server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', data: { channel: 'sessions' } }));
    }

    return {
      unsubscribe: () => {
        this.sessionSubscriptions.delete(callback);
        
        // If no more session subscriptions, unsubscribe from server
        if (this.sessionSubscriptions.size === 0 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'unsubscribe', data: { channel: 'sessions' } }));
        }
      }
    };
  }

  /**
   * Get session summaries with analytics
   */
  async getSessionSummaries(sessionIds: string[]): Promise<SessionSummary[]> {
    if (sessionIds.length === 0) return [];

    try {
      const url = `${this.serverUrl}/api/sessions/summaries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_ids: sessionIds }),
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.summaries || [];

    } catch (error) {
      logger.error('Failed to fetch session summaries', {
        component: 'LocalBackend',
        action: 'getSessionSummaries'
      }, error as Error);

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError('Request timeout while fetching session summaries');
      }

      throw new ConnectionError('Failed to fetch session summaries from Chronicle server', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Health check to verify server connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Shorter timeout for health checks
      });

      return response.ok;

    } catch (error) {
      logger.debug('Health check failed', {
        component: 'LocalBackend',
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
      const response = await fetch(`${this.serverUrl}/api/metadata`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      let version = 'unknown';
      if (response.ok) {
        const data = await response.json();
        version = data.version || 'unknown';
      }

      return {
        type: 'local',
        version,
        capabilities: {
          realtime: true,
          websockets: true,
          analytics: true,
          export: true,
        },
        connectionInfo: {
          url: this.serverUrl,
          lastPing: this.lastHeartbeat,
        }
      };

    } catch (error) {
      return {
        type: 'local',
        version: 'unknown',
        capabilities: {
          realtime: false,
          websockets: false,
          analytics: true,
          export: true,
        },
        connectionInfo: {
          url: this.serverUrl,
          lastPing: this.lastHeartbeat,
        }
      };
    }
  }
}