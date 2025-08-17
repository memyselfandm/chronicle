"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionStatusProps {
  status: ConnectionState;
  lastUpdate?: Date | string | null;
  lastEventReceived?: Date | string | null;
  subscriptions?: number;
  reconnectAttempts?: number;
  error?: string | null;
  isHealthy?: boolean;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
  className?: string;
  showText?: boolean;
  onRetry?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  lastUpdate,
  lastEventReceived,
  subscriptions = 0,
  reconnectAttempts = 0,
  error,
  isHealthy = false,
  connectionQuality = 'unknown',
  className,
  showText = true,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [lastUpdateText, setLastUpdateText] = useState<string>('--');
  const [lastUpdateAbsolute, setLastUpdateAbsolute] = useState<string>('--');
  const [lastEventText, setLastEventText] = useState<string>('--');
  const [lastEventAbsolute, setLastEventAbsolute] = useState<string>('--');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Update lastUpdate times when mounted or when lastUpdate changes
    if (lastUpdate) {
      setLastUpdateText(formatLastUpdate(lastUpdate));
      setLastUpdateAbsolute(formatAbsoluteTime(lastUpdate));
    } else {
      setLastUpdateText('Never');
      setLastUpdateAbsolute('No updates received');
    }
  }, [isMounted, lastUpdate]);

  useEffect(() => {
    if (!isMounted) return;

    // Update lastEventReceived times when mounted or when lastEventReceived changes
    if (lastEventReceived) {
      setLastEventText(formatLastUpdate(lastEventReceived));
      setLastEventAbsolute(formatAbsoluteTime(lastEventReceived));
    } else {
      setLastEventText('Never');
      setLastEventAbsolute('No events received');
    }
  }, [isMounted, lastEventReceived]);

  // Update time displays every second when mounted
  useEffect(() => {
    if (!isMounted) return;

    const interval = setInterval(() => {
      if (lastUpdate) {
        setLastUpdateText(formatLastUpdate(lastUpdate));
      }
      if (lastEventReceived) {
        setLastEventText(formatLastUpdate(lastEventReceived));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isMounted, lastUpdate, lastEventReceived]);

  const getStatusConfig = (status: ConnectionState) => {
    const baseConfig = (() => {
      switch (status) {
        case 'connected':
          return {
            color: isHealthy ? 'bg-accent-green' : 'bg-accent-yellow',
            text: isHealthy ? 'Connected' : 'Connected (No Activity)',
            icon: '●',
            description: isHealthy 
              ? `Receiving real-time updates (${subscriptions} subscriptions)`
              : 'Connected but no recent activity detected'
          };
        case 'connecting':
          return {
            color: 'bg-accent-yellow',
            text: reconnectAttempts > 0 ? `Reconnecting (${reconnectAttempts})` : 'Connecting',
            icon: '●',
            description: reconnectAttempts > 0 
              ? `Attempting to reconnect... (attempt ${reconnectAttempts})`
              : 'Establishing connection...'
          };
        case 'disconnected':
          return {
            color: 'bg-text-muted',
            text: 'Disconnected',
            icon: '●',
            description: 'Connection lost - will attempt to reconnect'
          };
        case 'error':
          return {
            color: 'bg-accent-red',
            text: 'Error',
            icon: '●',
            description: error || 'Connection error occurred'
          };
        default:
          return {
            color: 'bg-text-muted',
            text: 'Unknown',
            icon: '●',
            description: 'Unknown connection state'
          };
      }
    })();

    return baseConfig;
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-accent-green';
      case 'good': return 'text-accent-blue';
      case 'poor': return 'text-accent-yellow';
      default: return 'text-text-muted';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return '●●●';
      case 'good': return '●●○';
      case 'poor': return '●○○';
      default: return '○○○';
    }
  };

  const config = getStatusConfig(status);

  const formatLastUpdate = (timestamp: Date | string | null) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        return `${diffInSeconds}s ago`;
      }
      
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      }
      
      return format(date, 'HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  const formatAbsoluteTime = (timestamp: Date | string | null) => {
    if (!timestamp) return 'No updates received';
    
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return format(date, 'MMM d, yyyy \'at\' HH:mm:ss');
    } catch {
      return 'Invalid timestamp';
    }
  };

  return (
    <div 
      className={cn('relative flex items-center gap-2', className)}
      data-testid="connection-status"
    >
      {/* Status Indicator */}
      <div className="relative flex items-center gap-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-300',
            config.color,
            status === 'connecting' && 'animate-pulse'
          )}
          data-testid="status-indicator"
          aria-label={`Connection status: ${config.text}`}
        />
        
        {showText && (
          <span 
            className="text-xs text-text-secondary font-medium cursor-pointer"
            onClick={() => setShowDetails(!showDetails)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowDetails(!showDetails);
              }
            }}
            role="button"
            tabIndex={0}
            data-testid="status-text"
          >
            {config.text}
          </span>
        )}
      </div>

      {/* Last Update Time */}
      {lastUpdate && (
        <span 
          className="text-xs text-text-muted"
          title={lastUpdateAbsolute}
          data-testid="last-update"
          suppressHydrationWarning
        >
          {lastUpdateText}
        </span>
      )}

      {/* Retry Button for Error State */}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'text-xs text-accent-blue hover:text-accent-blue/80 transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-accent-blue rounded px-1'
          )}
          data-testid="retry-button"
        >
          Retry
        </button>
      )}

      {/* Details Tooltip */}
      {showDetails && (
        <div 
          className={cn(
            'absolute top-full left-0 mt-2 z-20',
            'bg-bg-tertiary border border-border rounded-lg shadow-lg',
            'p-3 min-w-80 text-xs'
          )}
          data-testid="status-details"
        >
          <div className="space-y-3">
            {/* Primary Status */}
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Status:</span>
              <span className="text-text-primary font-medium">{config.text}</span>
            </div>
            
            <div className="text-text-muted">{config.description}</div>
            
            {/* Connection Quality */}
            {status === 'connected' && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Connection Quality:</span>
                <div className="flex items-center gap-2">
                  <span className={cn('font-mono text-xs', getQualityColor(connectionQuality))}>
                    {getQualityIcon(connectionQuality)}
                  </span>
                  <span className="text-text-primary capitalize">{connectionQuality}</span>
                </div>
              </div>
            )}

            {/* Subscriptions */}
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Active Subscriptions:</span>
              <span className="text-text-primary font-medium">{subscriptions}</span>
            </div>

            {/* Reconnect Attempts */}
            {reconnectAttempts > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Reconnect Attempts:</span>
                <span className="text-accent-yellow font-medium">{reconnectAttempts}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="pt-2 border-t border-border">
                <span className="text-text-muted">Error:</span>
                <div className="text-accent-red text-xs mt-1 break-words">{error}</div>
              </div>
            )}
            
            {/* Timestamps */}
            <div className="pt-2 border-t border-border space-y-2">
              {lastUpdate && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Connection Updated:</span>
                    <span className="text-text-primary font-mono" suppressHydrationWarning>
                      {lastUpdateText}
                    </span>
                  </div>
                  <div className="text-text-muted text-xs" suppressHydrationWarning>
                    {lastUpdateAbsolute}
                  </div>
                </div>
              )}

              {lastEventReceived && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Last Event:</span>
                    <span className="text-text-primary font-mono" suppressHydrationWarning>
                      {lastEventText}
                    </span>
                  </div>
                  <div className="text-text-muted text-xs" suppressHydrationWarning>
                    {lastEventAbsolute}
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', config.color)} />
                <span className="text-text-secondary">
                  Real-time {status === 'connected' && isHealthy ? 'active' : 'inactive'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={() => setShowDetails(false)}
            className={cn(
              'absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center',
              'text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors'
            )}
            aria-label="Close details"
            data-testid="close-details"
          >
            ×
          </button>
        </div>
      )}

      {/* Backdrop for closing details */}
      {showDetails && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDetails(false)}
          data-testid="details-backdrop"
        />
      )}
    </div>
  );
};

// Hook for managing connection status
export const useConnectionStatus = (initialStatus: ConnectionState = 'disconnected') => {
  const [status, setStatus] = useState<ConnectionState>(initialStatus);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const updateStatus = (newStatus: ConnectionState) => {
    setStatus(newStatus);
    if (newStatus === 'connected') {
      setLastUpdate(new Date());
    }
  };

  const recordUpdate = () => {
    setLastUpdate(new Date());
  };

  const retry = () => {
    setStatus('connecting');
  };

  return {
    status,
    lastUpdate,
    updateStatus,
    recordUpdate,
    retry,
  };
};

export { ConnectionStatus };
export type { ConnectionStatusProps };