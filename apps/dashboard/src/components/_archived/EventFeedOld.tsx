'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { EventData } from '@/lib/mockData';
import { FilterBadges, FilterSummary } from '@/components/eventfeed/FilterBadges';
import { useSessionFilter } from '@/hooks/useSessionFilter';

export interface EventFeedProps {
  events: EventData[];
  className?: string;
  height?: string;
  isLoading?: boolean;
  error?: string;
  autoScroll?: boolean;
  showAutoScrollToggle?: boolean;
  showFilterBadges?: boolean;
  enableSessionFiltering?: boolean;
  onEventClick?: (event: EventData) => void;
  onRetry?: () => void;
}

interface EventCardProps {
  event: EventData;
  onClick?: (event: EventData) => void;
}

// Individual Event Card Component
function EventCard({ event, onClick }: EventCardProps) {
  const handleClick = useCallback(() => {
    onClick?.(event);
  }, [event, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(event);
    }
  }, [event, onClick]);

  const getEventBadgeVariant = (type: EventData['type']) => {
    switch (type) {
      case 'session_start':
        return 'purple';
      case 'pre_tool_use':
      case 'post_tool_use':
        return 'success';
      case 'user_prompt_submit':
        return 'info';
      case 'stop':
      case 'subagent_stop':
        return 'warning';
      case 'pre_compact':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'notification':
        return 'default';
      default:
        return 'default';
    }
  };

  const getEventIcon = (type: EventData['type']) => {
    switch (type) {
      case 'session_start': return '🎯';
      case 'pre_tool_use': return '🔧';
      case 'post_tool_use': return '✅';
      case 'user_prompt_submit': return '💬';
      case 'stop': return '⏹️';
      case 'subagent_stop': return '🔄';
      case 'pre_compact': return '📦';
      case 'notification': return '🔔';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const formatEventType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const truncateSessionId = (sessionId: string) => {
    return sessionId.length > 12 ? `${sessionId.slice(0, 8)}...` : sessionId;
  };

  return (
    <Card
      data-testid={`event-card-${event.id}`}
      role="article"
      tabIndex={0}
      aria-describedby={`event-${event.id}-description`}
      className={cn(
        'mb-3 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:shadow-accent-blue/20 hover:border-accent-blue/30',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2',
        'focus:ring-offset-bg-primary'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg flex-shrink-0" role="img" aria-label={`${event.type} event`}>
              {getEventIcon(event.type)}
            </span>
            <Badge
              data-testid="event-badge"
              variant={getEventBadgeVariant(event.type)}
              className="text-xs flex-shrink-0"
            >
              {formatEventType(event.type)}
            </Badge>
            <span className="text-xs text-text-muted truncate">
              Session: {truncateSessionId(event.session_id)}
            </span>
          </div>
          <time 
            className="text-xs text-text-muted flex-shrink-0"
            dateTime={event.timestamp.toISOString()}
            title={event.timestamp.toLocaleString()}
          >
            {formatDistanceToNow(event.timestamp, { addSuffix: true })}
          </time>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div id={`event-${event.id}-description`} className="space-y-2">
          <p className="text-sm text-text-primary font-medium leading-relaxed">
            {event.summary}
          </p>
          {event.toolName && (
            <p className="text-xs text-text-secondary">
              Tool: <span className="font-medium text-accent-blue">{event.toolName}</span>
            </p>
          )}
          {event.details && (
            <div className="text-xs text-text-muted">
              {event.details.file_path && (
                <p>File: <span className="font-mono">{event.details.file_path}</span></p>
              )}
              {event.details.duration_ms && (
                <p>Duration: {event.details.duration_ms}ms</p>
              )}
              {event.details.error_code && (
                <p className="text-accent-red">Error: {event.details.error_code}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton Component
function EventCardSkeleton() {
  return (
    <Card data-testid="event-card-skeleton" className="mb-3 animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-5 h-5 bg-bg-tertiary rounded"></div>
            <div className="w-16 h-5 bg-bg-tertiary rounded-full"></div>
            <div className="w-24 h-4 bg-bg-tertiary rounded"></div>
          </div>
          <div className="w-16 h-4 bg-bg-tertiary rounded"></div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="w-4/5 h-4 bg-bg-tertiary rounded"></div>
          <div className="w-2/3 h-3 bg-bg-tertiary rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}

// Auto-scroll Toggle Component
function AutoScrollToggle({ 
  isAutoScrollEnabled, 
  onToggle 
}: { 
  isAutoScrollEnabled: boolean; 
  onToggle: () => void; 
}) {
  return (
    <button
      data-testid="auto-scroll-toggle"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs',
        'border border-border transition-colors',
        isAutoScrollEnabled 
          ? 'bg-accent-blue text-white border-accent-blue' 
          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
      )}
      aria-label={`Auto-scroll is ${isAutoScrollEnabled ? 'enabled' : 'disabled'}. Click to toggle.`}
    >
      <span className={cn(
        'w-2 h-2 rounded-full transition-colors',
        isAutoScrollEnabled ? 'bg-white' : 'bg-text-muted'
      )}></span>
      Auto-scroll {isAutoScrollEnabled ? 'On' : 'Off'}
    </button>
  );
}

// Main EventFeed Component
export function EventFeed({
  events,
  className,
  height = '600px',
  isLoading = false,
  error,
  autoScroll = true,
  showAutoScrollToggle = false,
  showFilterBadges = true,
  enableSessionFiltering = true,
  onEventClick,
  onRetry
}: EventFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const [prevEventsLength, setPrevEventsLength] = useState(events.length);
  
  // Session filtering
  const { state: filterState, filteredEvents } = useSessionFilter({
    enableKeyboardShortcuts: enableSessionFiltering,
    autoScrollToEvents: true
  });
  
  // Use filtered events if session filtering is enabled and active
  const displayEvents = enableSessionFiltering && filterState.isFiltering 
    ? filteredEvents.filter(event => events.some(e => e.id === event.id))
    : events;

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (isAutoScrollEnabled && displayEvents.length > prevEventsLength && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPrevEventsLength(displayEvents.length);
  }, [displayEvents.length, prevEventsLength, isAutoScrollEnabled]);

  const handleAutoScrollToggle = useCallback(() => {
    setIsAutoScrollEnabled(prev => !prev);
  }, []);

  // Error State
  if (error) {
    return (
      <div 
        data-testid="event-feed-error"
        className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
        style={{ height }}
      >
        <div className="text-accent-red text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Failed to Load Events
        </h3>
        <p className="text-text-muted mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'px-4 py-2 bg-accent-blue text-white rounded-md',
              'hover:bg-accent-blue/80 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2'
            )}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className={cn('w-full', className)} style={{ height }}>
        <div 
          data-testid="event-feed-loading"
          className="p-4 md:p-6"
        >
          <div className="mb-4 text-center">
            <p className="text-text-muted">Loading events...</p>
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <EventCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  // Empty State
  if (displayEvents.length === 0) {
    const isFiltered = enableSessionFiltering && filterState.isFiltering;
    
    return (
      <div 
        data-testid="event-feed-empty"
        className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
        style={{ height }}
      >
        <div className="text-text-muted text-4xl mb-4">
          {isFiltered ? '🔍' : '📭'}
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {isFiltered ? 'No events match your filter' : 'No events yet'}
        </h3>
        <p className="text-text-muted">
          {isFiltered 
            ? `No events found for the ${filterState.selectedSessions.length} selected session${filterState.selectedSessions.length > 1 ? 's' : ''}`
            : 'Events will appear here as they are generated'
          }
        </p>
        {isFiltered && showFilterBadges && (
          <div className="mt-4">
            <FilterBadges maxVisible={2} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('w-full relative')} style={{ height }}>
      {/* Filter Badges Header */}
      {showFilterBadges && enableSessionFiltering && filterState.isFiltering && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-bg-primary border-b border-border p-4">
          <FilterBadges className="mb-2" />
          <FilterSummary />
        </div>
      )}

      {/* Auto-scroll Toggle */}
      {showAutoScrollToggle && (
        <div className={cn(
          'absolute right-4 z-10',
          showFilterBadges && filterState.isFiltering ? 'top-20' : 'top-4'
        )}>
          <AutoScrollToggle 
            isAutoScrollEnabled={isAutoScrollEnabled}
            onToggle={handleAutoScrollToggle}
          />
        </div>
      )}

      {/* Event Feed Container */}
      <div
        ref={containerRef}
        data-testid="event-feed"
        role="feed"
        aria-label="Event feed"
        className={cn(
          'h-full w-full overflow-y-auto p-4 md:p-6',
          showFilterBadges && filterState.isFiltering && 'pt-24', // Extra padding for filter header
          className
        )}
      >
        {displayEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}