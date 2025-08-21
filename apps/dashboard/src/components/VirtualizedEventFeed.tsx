'use client';

import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { cn } from '@/lib/utils';
import { EventData } from '@/lib/mockData';
import { MemoizedEventCard } from './EventCard';
import { getPerformanceMonitor } from '@/lib/performanceMonitor';

export interface VirtualizedEventFeedProps {
  events: EventData[];
  className?: string;
  height?: number;
  itemHeight?: number;
  overscan?: number;
  onEventClick?: (event: EventData) => void;
  autoScroll?: boolean;
  showScrollIndicator?: boolean;
  debounceMs?: number;
}

interface EventItemProps extends ListChildComponentProps {
  data: {
    events: EventData[];
    onEventClick?: (event: EventData) => void;
    itemHeight: number;
  };
}

// Memoized event item component for virtual scrolling
const EventItem = memo<EventItemProps>(({ index, style, data }) => {
  const { events, onEventClick, itemHeight } = data;
  const event = events[index];
  
  if (!event) {
    return (
      <div style={style} className="flex items-center justify-center text-text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div style={style} className="px-1">
      <div style={{ height: itemHeight - 8 }} className="py-1">
        <MemoizedEventCard
          event={event}
          onClick={onEventClick}
          compact={true}
        />
      </div>
    </div>
  );
});

EventItem.displayName = 'EventItem';

// Scroll indicator component
const ScrollIndicator = memo<{
  isScrolling: boolean;
  scrollProgress: number;
  totalItems: number;
  visibleItems: number;
}>(({ isScrolling, scrollProgress, totalItems, visibleItems }) => {
  if (!isScrolling || totalItems <= visibleItems) return null;

  return (
    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10">
      <div className="bg-bg-secondary/90 rounded-full px-2 py-1 text-xs text-text-muted border border-border">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent-blue transition-all duration-150"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>
          <span>{Math.round(scrollProgress * 100)}%</span>
        </div>
      </div>
    </div>
  );
});

ScrollIndicator.displayName = 'ScrollIndicator';

// Main virtualized event feed component
export const VirtualizedEventFeed = memo<VirtualizedEventFeedProps>(({
  events,
  className,
  height = 600,
  itemHeight = 120,
  overscan = 3,
  onEventClick,
  autoScroll = true,
  showScrollIndicator = true,
  debounceMs = 16,
}) => {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const performanceMonitor = getPerformanceMonitor();
  const profilerRef = useRef(performanceMonitor.createProfiler('VirtualizedEventFeed'));
  
  // Auto-scroll to top when new events arrive
  const prevEventsLengthRef = useRef(events.length);
  useEffect(() => {
    if (autoScroll && events.length > prevEventsLengthRef.current && listRef.current) {
      listRef.current.scrollToItem(0, 'start');
    }
    prevEventsLengthRef.current = events.length;
  }, [events.length, autoScroll]);

  // Debounced scroll handler
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: {
    scrollOffset: number;
    scrollDirection: 'forward' | 'backward';
  }) => {
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    setIsScrolling(true);
    
    // Calculate scroll progress
    const maxScroll = Math.max(0, events.length * itemHeight - height);
    const progress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
    setScrollProgress(Math.min(1, Math.max(0, progress)));

    // Track performance
    performanceMonitor.trackEvent();

    // Debounce the scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, debounceMs * 3);
  }, [events.length, itemHeight, height, debounceMs, performanceMonitor]);

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    events,
    onEventClick,
    itemHeight,
  }), [events, onEventClick, itemHeight]);

  // Calculate visible items for scroll indicator
  const visibleItems = Math.ceil(height / itemHeight);

  // Performance profiling
  useEffect(() => {
    const profiler = profilerRef.current.start();
    return () => {
      profiler.end();
    };
  });

  if (events.length === 0) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center text-center',
          className
        )}
        style={{ height }}
      >
        <div className="text-text-muted">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold mb-2">No events yet</h3>
          <p>Events will appear here as they are generated</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn('relative w-full', className)}
      style={{ height }}
    >
      {/* Scroll indicator */}
      {showScrollIndicator && (
        <ScrollIndicator
          isScrolling={isScrolling}
          scrollProgress={scrollProgress}
          totalItems={events.length}
          visibleItems={visibleItems}
        />
      )}

      {/* Virtual list */}
      <List
        ref={listRef}
        height={height}
        itemCount={events.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscan}
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-secondary"
      >
        {EventItem}
      </List>

      {/* Performance overlay for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 bg-bg-secondary/90 rounded px-2 py-1 text-xs text-text-muted">
          {events.length} items • {visibleItems} visible • {overscan} overscan
        </div>
      )}
    </div>
  );
});

VirtualizedEventFeed.displayName = 'VirtualizedEventFeed';

// Hook for managing virtualized list performance
export const useVirtualizedListPerformance = (events: EventData[], itemHeight: number) => {
  const [metrics, setMetrics] = useState({
    visibleRange: { start: 0, end: 0 },
    renderTime: 0,
    memoryUsage: 0,
  });

  const updateMetrics = useCallback((visibleStart: number, visibleEnd: number) => {
    const startTime = performance.now();
    
    setMetrics(prev => ({
      ...prev,
      visibleRange: { start: visibleStart, end: visibleEnd },
      renderTime: performance.now() - startTime,
    }));
  }, []);

  const estimatedMemoryUsage = useMemo(() => {
    // Rough estimation: each event ~1KB in memory
    return (events.length * 1024) / (1024 * 1024); // MB
  }, [events.length]);

  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      memoryUsage: estimatedMemoryUsage,
    }));
  }, [estimatedMemoryUsage]);

  return {
    metrics,
    updateMetrics,
    optimizationTips: {
      shouldVirtualize: events.length > 100,
      recommendedItemHeight: itemHeight < 60 ? 60 : itemHeight,
      recommendedOverscan: Math.min(5, Math.ceil(events.length / 100)),
    },
  };
};