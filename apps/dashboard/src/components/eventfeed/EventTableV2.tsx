/**
 * EventTableV2 - High-performance dense event table with virtual scrolling
 * 
 * Features:
 * - 24px row height for maximum density
 * - Virtual scrolling for 1000+ events
 * - Semantic color coding per variant_3 design
 * - Fixed column layout for consistent alignment
 * - Auto-scroll toggle for real-time updates
 * - React.memo optimization for performance
 */

'use client';

import React, { useRef, useCallback, useMemo, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Event, Session } from '@/types/events';
import { EventRowV2 } from './EventRowV2';
import { AutoScrollToggle } from './AutoScrollToggle';
import { cn } from '@/lib/utils';

export interface EventTableV2Props {
  /** Array of events to display */
  events: Event[];
  /** Array of sessions for context */
  sessions: Session[];
  /** Table height in pixels */
  height: number;
  /** Table width in pixels */
  width: number;
  /** Auto-scroll to newest events */
  autoScroll?: boolean;
  /** Callback when auto-scroll state changes */
  onAutoScrollChange?: (enabled: boolean) => void;
  /** Maximum events to keep in history (FIFO) */
  maxEvents?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show loading state */
  loading?: boolean;
}

/**
 * Table header with fixed column widths per PRD specification
 */
const TableHeader = memo(() => (
  <div 
    className={cn(
      'grid gap-3 px-4 py-2 bg-bg-secondary border-b border-border-primary',
      'text-xs font-semibold text-text-muted uppercase tracking-wide',
      // Fixed column widths per PRD: Time 85px, Session 140px, Type 110px, Tool 90px, Details flex
      'grid-cols-[85px_140px_110px_90px_1fr]'
    )}
    data-testid="event-table-header"
  >
    <div>Time</div>
    <div>Session</div>
    <div>Type</div>
    <div>Tool</div>
    <div>Details</div>
  </div>
));

TableHeader.displayName = 'TableHeader';

/**
 * Empty state when no events are available
 */
const EmptyState = memo(() => (
  <div 
    className="flex items-center justify-center h-32 text-text-muted"
    data-testid="empty-state"
  >
    <div className="text-center">
      <div className="text-sm font-medium">No events to display</div>
      <div className="text-xs mt-1">Events will appear here as they are received</div>
    </div>
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * Loading state component
 */
const LoadingState = memo(() => (
  <div 
    className="flex items-center justify-center h-32 text-text-muted"
    data-testid="loading-state"
  >
    <div className="text-center">
      <div className="animate-spin w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full mx-auto mb-2"></div>
      <div className="text-sm font-medium">Loading events...</div>
    </div>
  </div>
));

LoadingState.displayName = 'LoadingState';

/**
 * High-performance event table with virtual scrolling and dense layout
 */
export const EventTableV2 = memo<EventTableV2Props>(({
  events,
  sessions,
  height,
  width,
  autoScroll = false,
  onAutoScrollChange,
  maxEvents = 1000,
  className,
  loading = false
}) => {
  const listRef = useRef<List>(null);
  const prevEventsLengthRef = useRef(events.length);

  // Filter and validate events
  const validEvents = useMemo(() => {
    const filtered = events.filter(event => 
      event && 
      typeof event.id === 'string' &&
      typeof event.session_id === 'string' &&
      typeof event.event_type === 'string' &&
      typeof event.timestamp === 'string'
    );

    // Apply FIFO limit
    if (filtered.length > maxEvents) {
      return filtered.slice(-maxEvents);
    }

    return filtered;
  }, [events, maxEvents]);

  // Create session lookup map for performance
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    sessions.forEach(session => {
      map.set(session.id, session);
    });
    return map;
  }, [sessions]);

  // Auto-scroll to top when new events arrive
  React.useEffect(() => {
    if (autoScroll && listRef.current && validEvents.length > 0) {
      const currentLength = validEvents.length;
      const prevLength = prevEventsLengthRef.current;
      
      // Scroll to top if new events were added
      if (currentLength > prevLength) {
        listRef.current.scrollToItem(0, 'start');
      }
    }
    prevEventsLengthRef.current = validEvents.length;
  }, [validEvents.length, autoScroll]);

  // Row renderer for virtual list
  const renderRow = useCallback(({ index, style, data }: any) => {
    const event = data.events[index];
    const session = data.sessionMap.get(event.session_id);
    
    return (
      <div style={style}>
        <EventRowV2
          event={event}
          session={session}
          index={index}
        />
      </div>
    );
  }, []);

  // Item data for virtual list
  const itemData = useMemo(() => ({
    events: validEvents,
    sessionMap
  }), [validEvents, sessionMap]);

  const headerHeight = 24;
  const rowHeight = 24;
  const listHeight = height - headerHeight;

  if (loading) {
    return (
      <div 
        className={cn('bg-bg-primary border border-border-primary rounded-lg', className)}
        data-testid="event-table-v2"
      >
        <TableHeader />
        <LoadingState />
      </div>
    );
  }

  if (validEvents.length === 0) {
    return (
      <div 
        className={cn('bg-bg-primary border border-border-primary rounded-lg', className)}
        data-testid="event-table-v2"
      >
        <TableHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'bg-bg-primary border border-border-primary rounded-lg overflow-hidden',
        'font-mono text-xs', // 13px monospace typography
        className
      )}
      data-testid="event-table-v2"
      role="table"
      aria-label="Event feed table"
      tabIndex={0}
      style={{
        // Fixed column layout per PRD
        gridTemplateColumns: '85px 140px 110px 90px 1fr'
      }}
    >
      {/* Auto-scroll toggle */}
      <div className="absolute top-2 right-2 z-10">
        <AutoScrollToggle
          enabled={autoScroll}
          onChange={onAutoScrollChange}
        />
      </div>

      {/* Table header */}
      <TableHeader />

      {/* Virtual scrolling list */}
      <List
        ref={listRef}
        height={listHeight}
        width={width}
        itemCount={validEvents.length}
        itemSize={rowHeight}
        itemData={itemData}
        overscanCount={3} // Render 3 extra items for smooth scrolling
        data-testid="virtual-list"
        data-item-count={validEvents.length}
        data-item-size={rowHeight}
      >
        {renderRow}
      </List>
    </div>
  );
});

EventTableV2.displayName = 'memo(EventTableV2)';