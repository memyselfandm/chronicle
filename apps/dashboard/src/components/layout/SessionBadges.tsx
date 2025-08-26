"use client";

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SessionBadges - Color-coded session count badges for header
 * 
 * Features per consolidated guidance:
 * - Active sessions: Green indicator (#10b981)
 * - Awaiting sessions: Yellow indicator (#f59e0b) 
 * - Semantic color coding with Material Icons approach
 * - Hover tooltips for additional context
 * - Click to filter functionality (future enhancement)
 */

interface SessionBadgesProps {
  activeSessions: number;
  awaitingSessions: number;
  className?: string;
  onClick?: (filter: 'active' | 'awaiting') => void;
}

interface BadgeProps {
  count: number;
  label: string;
  color: 'green' | 'yellow';
  onClick?: () => void;
  tooltip: string;
}

function Badge({ count, label, color, onClick, tooltip }: BadgeProps) {
  const colorClasses = {
    green: {
      dot: 'bg-status-active',
      text: 'text-status-active',
      hover: 'hover:bg-status-active/10'
    },
    yellow: {
      dot: 'bg-status-awaiting', 
      text: 'text-status-awaiting',
      hover: 'hover:bg-status-awaiting/10'
    }
  };

  const colors = colorClasses[color];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md",
        "transition-all duration-200",
        onClick && "cursor-pointer",
        onClick && colors.hover,
        "group"
      )}
      onClick={onClick}
      title={tooltip}
      data-testid={`session-badge-${color}`}
    >
      {/* Status Dot */}
      <div 
        className={cn(
          "w-2 h-2 rounded-full",
          colors.dot
        )}
        aria-hidden="true"
      />
      
      {/* Count and Label */}
      <span className={cn(
        "text-xs font-medium",
        colors.text
      )}>
        {count} {label}
      </span>
    </div>
  );
}

export function SessionBadges({ 
  activeSessions, 
  awaitingSessions, 
  className,
  onClick 
}: SessionBadgesProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        className
      )}
      data-testid="session-badges"
    >
      {/* Active Sessions Badge */}
      <Badge
        count={activeSessions}
        label="active"
        color="green"
        tooltip={`${activeSessions} sessions currently running`}
        onClick={() => onClick?.('active')}
      />
      
      {/* Awaiting Sessions Badge */}
      <Badge
        count={awaitingSessions}
        label="awaiting"
        color="yellow"
        tooltip={`${awaitingSessions} sessions awaiting user input`}
        onClick={() => onClick?.('awaiting')}
      />
    </div>
  );
}

export { SessionBadges };