"use client";

import { forwardRef, useState, useEffect, useCallback, useMemo } from 'react';
import { CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDuration, getEventDescription, formatEventTimestamp, formatAbsoluteTime, getEventBadgeVariant, getEventIcon, truncateSessionId, getEventTypeLabel } from '@/lib/utils';
import type { Event } from '@/types/events';
import { CSS_CLASSES } from '@/lib/constants';


interface AnimatedEventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  className?: string;
  isNew?: boolean;
  animateIn?: boolean;
}

const AnimatedEventCard = forwardRef<HTMLButtonElement, AnimatedEventCardProps>(
  ({ event, onClick, className, isNew = false, animateIn = false }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showNewHighlight, setShowNewHighlight] = useState(isNew);
    const [hasAnimatedIn, setHasAnimatedIn] = useState(!animateIn);

    // Handle initial animation
    useEffect(() => {
      if (animateIn && !hasAnimatedIn) {
        const timer = setTimeout(() => {
          setHasAnimatedIn(true);
        }, 50); // Small delay to ensure the element is mounted
        return () => clearTimeout(timer);
      }
    }, [animateIn, hasAnimatedIn]);

    // Handle new event highlight pulse
    useEffect(() => {
      if (isNew) {
        setShowNewHighlight(true);
        const timer = setTimeout(() => {
          setShowNewHighlight(false);
        }, 3000); // Highlight for 3 seconds
        return () => clearTimeout(timer);
      }
    }, [isNew]);

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
      badgeVariant: getEventBadgeVariant(event.event_type),
      eventIcon: getEventIcon(event.event_type)
    }), [event.session_id, event.timestamp, event.event_type]);

    const { truncatedSessionId, relativeTime, absoluteTime, badgeVariant, eventIcon } = computedValues;

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'w-full text-left mb-3',
          'rounded-lg border border-border bg-bg-secondary text-text-primary shadow-sm',
          `cursor-pointer ${CSS_CLASSES.TRANSITION_ANIMATION}`,
          'hover:shadow-md hover:border-accent-blue/20 hover:scale-[1.02]',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-bg-primary',
          // Animation classes
          !hasAnimatedIn && animateIn && 'opacity-0 transform translate-y-4 scale-95',
          hasAnimatedIn && 'opacity-100 transform translate-y-0 scale-100',
          // New event highlight pulse
          showNewHighlight && 'animate-pulse shadow-lg shadow-accent-blue/30 border-accent-blue/50',
          className
        )}
        type="button"
        data-testid={`animated-event-card-${event.id}`}
        style={{
          transition: animateIn 
            ? 'opacity 0.5s ease-out, transform 0.5s ease-out, box-shadow 0.3s ease-out, border-color 0.3s ease-out'
            : 'all 0.3s ease-out'
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg flex-shrink-0" role="img" aria-label={`${event.event_type} event`}>
                {eventIcon}
              </span>
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
              {showNewHighlight && (
                <span 
                  className="text-xs font-medium text-accent-blue animate-pulse"
                  data-testid="new-indicator"
                >
                  NEW
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

AnimatedEventCard.displayName = 'AnimatedEventCard';

export { AnimatedEventCard };