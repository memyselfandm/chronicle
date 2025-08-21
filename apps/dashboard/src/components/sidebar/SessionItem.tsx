'use client';

import { useCallback, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useDashboardStore, SessionData } from '@/stores/dashboardStore';
import { 
  formatSessionDisplay, 
  getSessionDisplayProps,
  truncateSessionId 
} from '@/lib/sessionUtils';

export interface SessionItemProps {
  session: SessionData;
  className?: string;
  showEventCount?: boolean;
  showLastActivity?: boolean;
  onClick?: (session: SessionData, isMultiSelect: boolean) => void;
  onDoubleClick?: (session: SessionData) => void;
}

interface SessionCheckboxProps {
  isSelected: boolean;
  isIndeterminate?: boolean;
  className?: string;
}

// Custom checkbox component for session selection
function SessionCheckbox({ 
  isSelected, 
  isIndeterminate = false, 
  className 
}: SessionCheckboxProps) {
  return (
    <div
      className={cn(
        'w-4 h-4 border-2 rounded transition-all duration-200',
        'flex items-center justify-center',
        isSelected 
          ? 'bg-accent-blue border-accent-blue text-white' 
          : 'border-border bg-bg-primary hover:border-accent-blue/50',
        isIndeterminate && 'bg-accent-blue/50 border-accent-blue',
        className
      )}
      aria-hidden="true"
    >
      {isSelected && (
        <svg
          className="w-3 h-3 fill-current"
          viewBox="0 0 12 12"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      )}
      {isIndeterminate && !isSelected && (
        <div className="w-2 h-0.5 bg-white rounded" />
      )}
    </div>
  );
}

// Main SessionItem component
export function SessionItem({
  session,
  className,
  showEventCount = true,
  showLastActivity = true,
  onClick,
  onDoubleClick
}: SessionItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSessionSelected = useDashboardStore((state) => state.isSessionSelected);
  const getSessionEvents = useDashboardStore((state) => state.getSessionEvents);
  
  const isSelected = isSessionSelected(session.id);
  const sessionEvents = getSessionEvents(session.id);
  const displayProps = getSessionDisplayProps(session);

  // Handle click with multi-select detection
  const handleClick = useCallback((event: React.MouseEvent) => {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    onClick?.(session, isMultiSelect);
  }, [session, onClick]);

  // Handle double-click
  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(session);
  }, [session, onDoubleClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      const isMultiSelect = event.ctrlKey || event.metaKey;
      onClick?.(session, isMultiSelect);
    } else if (event.key === ' ') {
      event.preventDefault();
      onClick?.(session, true); // Space always does multi-select
    }
  }, [session, onClick]);

  // Memoized last activity display
  const lastActivityDisplay = useMemo(() => {
    if (!showLastActivity) return null;
    
    const lastActivity = session.lastActivity || session.startTime;
    return formatDistanceToNow(lastActivity, { addSuffix: true });
  }, [session.lastActivity, session.startTime, showLastActivity]);

  return (
    <Card
      data-testid={`session-item-${session.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Session ${displayProps.displayName}${isSelected ? ', selected' : ''}`}
      className={cn(
        'mb-2 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:shadow-accent-blue/20',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1',
        'focus:ring-offset-bg-primary',
        isSelected && [
          'ring-2 ring-accent-blue ring-offset-1 ring-offset-bg-primary',
          'bg-accent-blue/5 border-accent-blue/50'
        ],
        isHovered && 'border-accent-blue/30',
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          <div className="flex-shrink-0 mt-0.5">
            <SessionCheckbox 
              isSelected={isSelected}
              className="transition-opacity duration-200"
            />
          </div>

          {/* Session content */}
          <div className="flex-1 min-w-0">
            {/* Header with status and display name */}
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="text-lg flex-shrink-0" 
                role="img" 
                aria-label={`Status: ${session.status}`}
              >
                {displayProps.statusIcon}
              </span>
              <Badge
                variant={displayProps.statusVariant}
                className="text-xs flex-shrink-0"
              >
                {session.status}
              </Badge>
            </div>

            {/* Project and branch */}
            <div className="mb-2">
              <p className="text-sm font-medium text-text-primary truncate" title={displayProps.displayName}>
                {displayProps.displayName}
              </p>
              <p className="text-xs text-text-muted">
                ID: {truncateSessionId(session.id)}
              </p>
            </div>

            {/* Metrics row */}
            <div className="flex items-center justify-between text-xs text-text-muted">
              <div className="flex items-center gap-3">
                {showEventCount && (
                  <span>
                    {sessionEvents.length} event{sessionEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span>
                  {session.toolsUsed} tool{session.toolsUsed !== 1 ? 's' : ''}
                </span>
              </div>
              
              {lastActivityDisplay && (
                <time 
                  className="flex-shrink-0"
                  dateTime={session.lastActivity?.toISOString() || session.startTime.toISOString()}
                  title={session.lastActivity?.toLocaleString() || session.startTime.toLocaleString()}
                >
                  {lastActivityDisplay}
                </time>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for smaller spaces
export function CompactSessionItem({
  session,
  className,
  onClick
}: Omit<SessionItemProps, 'showEventCount' | 'showLastActivity'>) {
  const isSessionSelected = useDashboardStore((state) => state.isSessionSelected);
  const isSelected = isSessionSelected(session.id);
  const displayProps = getSessionDisplayProps(session);

  const handleClick = useCallback((event: React.MouseEvent) => {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    onClick?.(session, isMultiSelect);
  }, [session, onClick]);

  return (
    <div
      data-testid={`compact-session-item-${session.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md cursor-pointer',
        'transition-all duration-200 hover:bg-bg-secondary',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue',
        isSelected && 'bg-accent-blue/10 ring-1 ring-accent-blue',
        className
      )}
      onClick={handleClick}
    >
      <SessionCheckbox isSelected={isSelected} />
      <span className="text-lg" role="img" aria-label={`Status: ${session.status}`}>
        {displayProps.statusIcon}
      </span>
      <span className="text-sm font-medium text-text-primary truncate flex-1">
        {displayProps.displayName}
      </span>
    </div>
  );
}

// Loading skeleton for session items
export function SessionItemSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('mb-2 animate-pulse', className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-4 h-4 bg-bg-tertiary rounded flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-bg-tertiary rounded" />
              <div className="w-16 h-5 bg-bg-tertiary rounded-full" />
            </div>
            <div className="w-3/4 h-4 bg-bg-tertiary rounded" />
            <div className="w-1/2 h-3 bg-bg-tertiary rounded" />
            <div className="flex justify-between">
              <div className="w-16 h-3 bg-bg-tertiary rounded" />
              <div className="w-20 h-3 bg-bg-tertiary rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}