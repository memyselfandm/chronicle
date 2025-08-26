/**
 * Comprehensive Chronicle type definitions for real-time data management
 * Covers all event types, session states, and connection management
 */

// Re-export existing types for centralized access
export type { Event, BaseEvent, Session, EventSummary } from './events';
export type { ConnectionState, ConnectionStatus, ConnectionQuality } from './connection';

/**
 * Chronicle-specific session status enumeration
 */
export enum SessionStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  COMPLETED = 'completed',
  ERROR = 'error'
}

/**
 * Real-time event subscription types
 */
export enum SubscriptionType {
  SESSION_EVENTS = 'session_events',
  ALL_EVENTS = 'all_events', 
  SESSION_STATUS = 'session_status',
  SYSTEM_HEALTH = 'system_health'
}

/**
 * Event batching configuration
 */
export interface BatchConfig {
  windowMs: number;
  maxBatchSize: number;
  flushOnIdle: boolean;
  preserveOrder: boolean;
}

/**
 * WebSocket reconnection configuration
 */
export interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterMs: number;
}

/**
 * Subscription health metrics
 */
export interface SubscriptionHealth {
  id: string;
  type: SubscriptionType;
  isActive: boolean;
  lastEventTime: Date | null;
  errorCount: number;
  latency: number;
  missedHeartbeats: number;
}

/**
 * Connection manager state
 */
export interface ConnectionManagerState {
  isConnected: boolean;
  connectionQuality: ConnectionQuality;
  lastConnectTime: Date | null;
  reconnectAttempt: number;
  pendingEvents: any[];
  subscriptions: Map<string, SubscriptionHealth>;
  metrics: ConnectionMetrics;
}

/**
 * Connection performance metrics
 */
export interface ConnectionMetrics {
  averageLatency: number;
  eventThroughput: number;
  reconnectCount: number;
  totalEventsReceived: number;
  totalEventsSent: number;
  uptime: number;
  lastHeartbeat: Date | null;
}

/**
 * Event batch for performance optimization
 */
export interface EventBatch {
  id: string;
  events: any[];
  batchedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  size: number;
}

/**
 * Real-time subscription configuration
 */
export interface SubscriptionConfig {
  type: SubscriptionType;
  sessionId?: string;
  filters?: EventFilter[];
  autoReconnect: boolean;
  heartbeatInterval: number;
  maxMissedHeartbeats: number;
}

/**
 * Event filtering for subscriptions
 */
export interface EventFilter {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte';
  value: any;
}

/**
 * Chronicle Dashboard real-time store state
 */
export interface ChronicleRealtimeState {
  // Connection management
  connectionManager: ConnectionManagerState;
  
  // Event batching
  eventBatcher: {
    isEnabled: boolean;
    config: BatchConfig;
    pendingBatches: EventBatch[];
    processedCount: number;
  };
  
  // Subscription management
  subscriptions: {
    active: Map<string, SubscriptionConfig>;
    health: Map<string, SubscriptionHealth>;
    totalCount: number;
  };
  
  // Performance monitoring
  performance: {
    eventProcessingTime: number[];
    stateUpdateTime: number[];
    renderTime: number[];
    memoryUsage: number;
  };
}

/**
 * Event processing result
 */
export interface EventProcessingResult {
  success: boolean;
  processedCount: number;
  errors: ProcessingError[];
  duration: number;
  batchId?: string;
}

/**
 * Processing error details
 */
export interface ProcessingError {
  eventId: string;
  error: string;
  timestamp: Date;
  retry: boolean;
}

/**
 * Subscription callback function type
 */
export type SubscriptionCallback = (events: any[], metadata: SubscriptionMetadata) => void;

/**
 * Subscription metadata
 */
export interface SubscriptionMetadata {
  subscriptionId: string;
  eventCount: number;
  batchId?: string;
  latency: number;
  timestamp: Date;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  checks: {
    connection: boolean;
    subscriptions: boolean;
    eventProcessing: boolean;
    performance: boolean;
  };
  metrics: ConnectionMetrics;
  warnings: string[];
  errors: string[];
}

/**
 * Chronicle dashboard configuration
 */
export interface ChronicleConfig {
  batch: BatchConfig;
  reconnect: ReconnectConfig;
  performance: {
    maxEventHistory: number;
    performanceMetricsWindow: number;
    memoryWarningThreshold: number;
  };
  subscriptions: {
    defaultHeartbeatInterval: number;
    maxConcurrentSubscriptions: number;
    healthCheckInterval: number;
  };
}

/**
 * Default configurations
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  windowMs: 100,
  maxBatchSize: 50,
  flushOnIdle: true,
  preserveOrder: true
};

export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitterMs: 1000
};

export const DEFAULT_CHRONICLE_CONFIG: ChronicleConfig = {
  batch: DEFAULT_BATCH_CONFIG,
  reconnect: DEFAULT_RECONNECT_CONFIG,
  performance: {
    maxEventHistory: 1000,
    performanceMetricsWindow: 60000, // 1 minute
    memoryWarningThreshold: 100 * 1024 * 1024 // 100MB
  },
  subscriptions: {
    defaultHeartbeatInterval: 30000, // 30 seconds
    maxConcurrentSubscriptions: 10,
    healthCheckInterval: 5000 // 5 seconds
  }
};

/**
 * Type guards for event processing
 */
export const isValidEvent = (event: any): event is Event => {
  return event && 
    typeof event.id === 'string' &&
    typeof event.session_id === 'string' &&
    typeof event.event_type === 'string' &&
    typeof event.timestamp === 'string';
};

export const isValidSession = (session: any): session is Session => {
  return session &&
    typeof session.id === 'string' &&
    typeof session.claude_session_id === 'string' &&
    typeof session.start_time === 'string';
};

/**
 * Utility types for type-safe operations
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventHandler<T = any> = (event: T, metadata?: any) => void | Promise<void>;

export type UnsubscribeFunction = () => void;