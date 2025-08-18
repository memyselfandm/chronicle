import { forwardRef, useState, useCallback, useMemo } from 'react';
import { CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDuration, getEventDescription, formatEventTimestamp, formatAbsoluteTime, getEventBadgeVariant, truncateSessionId, getEventTypeLabel } from '@/lib/utils';
import type { Event } from '@/types/events';


interface EventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  className?: string;
}

const EventCard = forwardRef<HTMLButtonElement, EventCardProps>(
  ({ event, onClick, className }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const handleClick = () => {
      onClick?.(event);
    };

    // Memoize event handlers to prevent unnecessary re-renders
    const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
    const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

    // Memoize computed values to prevent recalculation
    const computedValues = useMemo(() => ({
      truncatedSessionId: truncateSessionId(event.session_id, 16),
      relativeTime: formatEventTimestamp(event.timestamp),
      absoluteTime: formatAbsoluteTime(event.timestamp),
      badgeVariant: getEventBadgeVariant(event.event_type)
    }), [event.session_id, event.timestamp, event.event_type]);

    const { truncatedSessionId, relativeTime, absoluteTime, badgeVariant } = computedValues;

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

export { EventCard };