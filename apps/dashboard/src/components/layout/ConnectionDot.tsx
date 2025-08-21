"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboardStore';

/**
 * ConnectionDot - Simple connection status indicator for header
 * 
 * Features per consolidated guidance:
 * - Simple dot indicator (not critical but nice)
 * - Status dot: green/yellow/red with labels
 * - Labels: "Connected/Reconnecting/Disconnected"
 * - Connection health monitoring
 * - Simple, unobtrusive design
 * - Uses existing ConnectionStatus component logic but simplified for header
 */

interface ConnectionDotProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionDot({ className, showLabel = true }: ConnectionDotProps) {
  // Get connection status from store with proper selectors
  const connectionStatus = useDashboardStore((state) => state.realtime?.connectionStatus || 'disconnected');
  const isRealTimeEnabled = useDashboardStore((state) => state.realtime?.isRealTimeEnabled || false);
  
  // Determine status configuration
  const getStatusConfig = () => {
    if (!isRealTimeEnabled) {
      return {
        color: 'bg-text-muted',
        label: 'Offline',
        description: 'Real-time disabled'
      };
    }

    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-status-active', // Green
          label: 'Connected',
          description: 'Real-time connection active'
        };
      case 'connecting':
        return {
          color: 'bg-status-awaiting', // Yellow
          label: 'Connecting',
          description: 'Establishing connection...'
        };
      case 'disconnected':
        return {
          color: 'bg-text-muted', // Gray
          label: 'Disconnected',
          description: 'Connection lost'
        };
      case 'error':
        return {
          color: 'bg-status-error', // Red
          label: 'Error',
          description: 'Connection error'
        };
      default:
        return {
          color: 'bg-text-muted',
          label: 'Unknown',
          description: 'Unknown connection state'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        className
      )}
      data-testid="connection-dot"
      title={statusConfig.description}
    >
      {/* Status Dot */}
      <div 
        className={cn(
          "w-2 h-2 rounded-full transition-all duration-300",
          statusConfig.color,
          connectionStatus === 'connecting' && 'animate-pulse'
        )}
        data-testid="connection-status-dot"
        aria-label={`Connection status: ${statusConfig.label}`}
      />
      
      {/* Optional Label */}
      {showLabel && (
        <span 
          className="text-xs text-text-secondary font-medium"
          data-testid="connection-status-label"
        >
          {statusConfig.label}
        </span>
      )}
    </div>
  );
}

export { ConnectionDot };