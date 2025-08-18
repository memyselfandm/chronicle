/**
 * Shared connection types for the Chronicle Dashboard
 * Single source of truth for connection-related type definitions
 */

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'checking';

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';

export interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: Date | null;
  lastEventReceived: Date | null;
  subscriptions: number;
  reconnectAttempts: number;
  error: string | null;
  isHealthy: boolean;
}

export interface ConnectionStatusProps {
  status: ConnectionState;
  lastUpdate?: Date | string | null;
  lastEventReceived?: Date | string | null;
  subscriptions?: number;
  reconnectAttempts?: number;
  error?: string | null;
  isHealthy?: boolean;
  connectionQuality?: ConnectionQuality;
  className?: string;
  showText?: boolean;
  onRetry?: () => void;
}

export interface UseSupabaseConnectionOptions {
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  debounceMs?: number;
}