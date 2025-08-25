/**
 * EventFeedHeader - Header section for the event feed with title and controls
 * 
 * Features:
 * - Title with icon and event count
 * - Auto-scroll toggle control
 * - Clean, borderless design matching reference
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface EventFeedHeaderProps {
  /** Total number of events */
  eventCount: number;
  /** Whether auto-scroll is enabled */
  autoScroll: boolean;
  /** Callback when auto-scroll is toggled */
  onAutoScrollChange: (enabled: boolean) => void;
  /** Whether events are filtered */
  isFiltered?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Event feed header with title and controls
 */
export function EventFeedHeader({
  eventCount,
  autoScroll,
  onAutoScrollChange,
  isFiltered = false,
  className
}: EventFeedHeaderProps) {
  return (
    <div 
      className={cn(
        'flex items-center justify-between',
        'px-4 py-3',
        'bg-bg-secondary',
        'border-b border-border-primary',
        className
      )}
    >
      {/* Title section */}
      <div className="flex items-center gap-2">
        <span className="material-icons text-accent-blue text-lg">list</span>
        <h2 className="text-sm font-semibold text-text-primary">Event Feed</h2>
        <span className="text-xs text-text-muted">
          ({eventCount.toLocaleString()} events{isFiltered ? ', filtered' : ''})
        </span>
      </div>

      {/* Controls section */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onAutoScrollChange(!autoScroll)}
          className={cn(
            'flex items-center gap-1.5',
            'px-3 py-1.5',
            'rounded',
            'text-xs',
            'transition-all duration-200',
            autoScroll ? [
              'bg-accent-blue/10',
              'text-accent-blue',
              'border border-accent-blue/30',
              'hover:bg-accent-blue/20'
            ] : [
              'bg-bg-tertiary',
              'text-text-secondary',
              'border border-border-primary',
              'hover:bg-bg-tertiary/80',
              'hover:text-text-primary'
            ]
          )}
          aria-pressed={autoScroll}
          title={autoScroll ? 'Auto-scroll is enabled. Click to disable.' : 'Auto-scroll is disabled. Click to enable.'}
        >
          <span className="material-icons text-sm">
            {autoScroll ? 'sync' : 'sync_disabled'}
          </span>
          <span>Auto-scroll</span>
        </button>
      </div>
    </div>
  );
}

EventFeedHeader.displayName = 'EventFeedHeader';