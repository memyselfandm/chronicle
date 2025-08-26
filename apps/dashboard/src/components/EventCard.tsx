import { forwardRef, useState, useCallback, useMemo, memo } from 'react';
import { CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDuration, getEventDescription, formatEventTimestamp, formatAbsoluteTime, getEventBadgeVariant, truncateSessionId, getEventTypeLabel } from '@/lib/utils';
import type { Event } from '@/types/events';
import { getPerformanceMonitor } from '@/lib/performanceMonitor';

interface EventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  className?: string;
  compact?: boolean;
}

const EventCard = forwardRef<HTMLButtonElement, EventCardProps>(
  ({ event, onClick, className, compact = false }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);

    const handleClick = useCallback(() => {
      const profiler = performanceMonitor.createProfiler('EventCard.onClick').start();
      onClick?.(event);
      profiler.end();
    }, [event, onClick, performanceMonitor]);

    // Memoize event handlers to prevent unnecessary re-renders
    const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
    const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

    // Memoize computed values to prevent recalculation
    const computedValues = useMemo(() => ({
      truncatedSessionId: truncateSessionId(event.session_id, compact ? 8 : 16),
      relativeTime: formatEventTimestamp(event.timestamp),
      absoluteTime: formatAbsoluteTime(event.timestamp),
      badgeVariant: getEventBadgeVariant(event.event_type)
    }), [event.session_id, event.timestamp, event.event_type, compact]);

    const { truncatedSessionId, relativeTime, absoluteTime, badgeVariant } = computedValues;

    // Compact mode for virtualized lists
    if (compact) {
      return (
        <button
          ref={ref}
          onClick={handleClick}
          className={cn(
            'w-full text-left p-3',
            'rounded-md border border-border bg-bg-secondary text-text-primary',
            'cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary hover:border-accent-blue/30',
            className
          )}
          type="button"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge 
                variant={badgeVariant}
                className="text-xs font-medium flex-shrink-0"
              >
                {getEventTypeLabel(event.event_type)}
              </Badge>
              {event.tool_name && (
                <span className="text-xs font-medium text-text-primary bg-accent-blue/10 px-1.5 py-0.5 rounded flex-shrink-0">
                  {event.tool_name}
                </span>
              )}
              <span className="text-xs text-text-muted font-mono truncate">
                {truncatedSessionId}
              </span>
            </div>
            <span className="text-xs text-text-muted flex-shrink-0">
              {relativeTime}
            </span>
          </div>
        </button>
      );
    }

    // Full mode for regular display
    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'w-full text-left',
          'rounded-lg border border-border bg-bg-secondary text-text-primary shadow-sm',
          'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent-blue/20 hover:scale-[1.02]',
          className
        )}
        type="button"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge 
                variant={badgeVariant}
                className="text-xs font-medium"
              >
                {getEventTypeLabel(event.event_type)}
              </Badge>
              {event.tool_name && (
                <span className="text-xs font-medium text-text-primary bg-accent-blue/10 px-2 py-0.5 rounded">
                  {event.tool_name}
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted">
              <span 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {relativeTime}
                {showTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 z-10 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap">
                    {absoluteTime}
                  </div>
                )}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="text-sm text-text-secondary">
              <span className="text-text-muted">Session:</span>{' '}
              <span className="font-mono text-xs">{truncatedSessionId}</span>
            </div>
            <div className="text-sm text-text-secondary">
              {getEventDescription(event)}
            </div>
            {event.event_type === 'post_tool_use' && event.duration_ms && (
              <div className="text-xs text-text-muted">
                Duration: <span className="font-medium">{formatDuration(event.duration_ms)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </button>
    );
  }
);

EventCard.displayName = 'EventCard';

// Memoized version for performance optimization
const MemoizedEventCard = memo(EventCard, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.event.timestamp === nextProps.event.timestamp &&
    prevProps.event.event_type === nextProps.event.event_type &&
    prevProps.compact === nextProps.compact &&
    prevProps.className === nextProps.className
  );
});

MemoizedEventCard.displayName = 'MemoizedEventCard';

export { EventCard, MemoizedEventCard };
export default MemoizedEventCard;