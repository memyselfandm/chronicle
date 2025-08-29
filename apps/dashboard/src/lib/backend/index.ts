/**
 * Backend abstraction layer for Chronicle Dashboard
 * Supports both Supabase and local Chronicle server backends
 */

import { Event, Session } from '@/types/events';
import { FilterState } from '@/types/filters';

/**
 * Connection status for backend monitoring
 */
export type BackendConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'retrying';

/**
 * Event filters for querying
 */
export interface EventFilters {
  sessionIds?: string[];
  eventTypes?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  } | null;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Session filters for querying
 */
export interface SessionFilters {
  timeRangeMinutes?: number;
  includeEnded?: boolean;
  projectPath?: string;
  gitBranch?: string;
}

/**
 * Backend connection configuration
 */
export interface BackendConfig {
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  healthCheckInterval?: number;
}

/**
 * Event subscription callback
 */
export type EventSubscriptionCallback = (event: Event) => void;

/**
 * Session subscription callback
 */
export type SessionSubscriptionCallback = (session: Session) => void;

/**
 * Connection status callback
 */
export type ConnectionStatusCallback = (status: BackendConnectionStatus) => void;

/**
 * Subscription handle for cleanup
 */
export interface SubscriptionHandle {
  unsubscribe: () => void;
}

/**
 * Main backend interface that both Supabase and Local backends implement
 */
export interface ChronicleBackend {
  /**
   * Initialize and connect to the backend
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the backend and cleanup resources
   */
  disconnect(): Promise<void>;

  /**
   * Get current connection status
   */
  getConnectionStatus(): BackendConnectionStatus;

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(callback: ConnectionStatusCallback): SubscriptionHandle;

  /**
   * Fetch events with optional filters and pagination
   */
  getEvents(filters?: EventFilters): Promise<Event[]>;

  /**
   * Subscribe to real-time event updates
   */
  subscribeToEvents(callback: EventSubscriptionCallback): SubscriptionHandle;

  /**
   * Fetch sessions with optional filters
   */
  getSessions(filters?: SessionFilters): Promise<Session[]>;

  /**
   * Subscribe to real-time session updates
   */
  subscribeToSessions(callback: SessionSubscriptionCallback): SubscriptionHandle;

  /**
   * Get session summaries with metrics
   */
  getSessionSummaries(sessionIds: string[]): Promise<SessionSummary[]>;

  /**
   * Health check to verify backend connectivity
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get backend-specific metadata (version, capabilities, etc.)
   */
  getMetadata(): Promise<BackendMetadata>;
}

/**
 * Session summary with analytics data
 */
export interface SessionSummary {
  session_id: string;
  total_events: number;
  tool_usage_count: number;
  error_count: number;
  avg_response_time: number | null;
  duration_ms?: number;
  is_active?: boolean;
}

/**
 * Backend metadata
 */
export interface BackendMetadata {
  type: 'supabase' | 'local';
  version?: string;
  capabilities: {
    realtime: boolean;
    websockets: boolean;
    analytics: boolean;
    export: boolean;
  };
  connectionInfo: {
    url: string;
    latency?: number;
    lastPing?: Date;
  };
}

/**
 * Backend factory result
 */
export interface BackendFactory {
  backend: ChronicleBackend;
  metadata: BackendMetadata;
}

/**
 * Error types for backend operations
 */
export class BackendError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export class ConnectionError extends BackendError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', true, details);
    this.name = 'ConnectionError';
  }
}

export class AuthenticationError extends BackendError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', false, details);
    this.name = 'AuthenticationError';
  }
}

export class TimeoutError extends BackendError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', true, details);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends BackendError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', false, details);
    this.name = 'ValidationError';
  }
}