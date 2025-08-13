"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionStatusProps {
  status: ConnectionState;
  lastUpdate?: Date | string | null;
  className?: string;
  showText?: boolean;
  onRetry?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  lastUpdate,
  className,
  showText = true,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusConfig = (status: ConnectionState) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-accent-green',
          text: 'Connected',
          icon: '●',
          description: 'Receiving real-time updates'
        };
      case 'connecting':
        return {
          color: 'bg-accent-yellow',
          text: 'Connecting',
          icon: '●',
          description: 'Establishing connection...'
        };
      case 'disconnected':
        return {
          color: 'bg-text-muted',
          text: 'Disconnected',
          icon: '●',
          description: 'Connection lost - attempting to reconnect'
        };
      case 'error':
        return {
          color: 'bg-accent-red',
          text: 'Error',
          icon: '●',
          description: 'Connection error occurred'
        };
      default:
        return {
          color: 'bg-text-muted',
          text: 'Unknown',
          icon: '●',
          description: 'Unknown connection state'
        };
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
          title={formatAbsoluteTime(lastUpdate)}
          data-testid="last-update"
        >
          {formatLastUpdate(lastUpdate)}
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
            'p-3 min-w-64 text-xs'
          )}
          data-testid="status-details"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Status:</span>
              <span className="text-text-primary font-medium">{config.text}</span>
            </div>
            
            <div className="text-text-muted">{config.description}</div>
            
            {lastUpdate && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Last Update:</span>
                  <span className="text-text-primary font-mono">
                    {formatLastUpdate(lastUpdate)}
                  </span>
                </div>
                <div className="text-text-muted text-xs">
                  {formatAbsoluteTime(lastUpdate)}
                </div>
              </>
            )}
            
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', config.color)} />
                <span className="text-text-secondary">
                  Real-time {status === 'connected' ? 'active' : 'inactive'}
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