/**
 * EventFeedV2 - High-performance event feed with batching and virtual scrolling
 * 
 * Features:
 * - EventBatcher integration for 100ms windowing
 * - Virtual scrolling for 1000+ events  
 * - Dense 24px row layout
 * - Semantic color coding
 * - Auto-scroll management
 * - Sub-agent hierarchy
 * - Real-time performance monitoring
 * - FIFO event management (max 1000 events)
 */

'use client';

import React, { 
  useCallback, 
  useEffect, 
  useRef, 
  useState, 
  useMemo, 
  memo 
} from 'react';
import { Event, Session } from '@/types/events';
import { EventBatch, getEventBatcher } from '@/lib/eventBatcher';
import { EventTableV2 } from './EventTableV2';
import { cn } from '@/lib/utils';

export interface EventFeedV2Props {
  /** Array of sessions for context */
  sessions: Session[];
  /** Feed height in pixels */
  height?: number;
  /** Feed width in pixels */
  width?: number;
  /** Maximum events to keep in history */
  maxEvents?: number;
  /** Enable real-time event batching */
  enableBatching?: boolean;
  /** Batch window size in milliseconds */
  batchWindowMs?: number;
  /** Auto-scroll enabled by default */
  defaultAutoScroll?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback for performance metrics */
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  /** Initial events to display */
  initialEvents?: Event[];
}

export interface PerformanceMetrics {
  /** Total events processed */
  totalEvents: number;
  /** Events per second throughput */
  eventsPerSecond: number;
  /** Average batch processing time */
  avgBatchTime: number;
  /** Current memory usage estimate */
  memoryUsage: number;
  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Performance monitoring hook
 */
const usePerformanceMonitoring = (
  events: Event[],
  onUpdate?: (metrics: PerformanceMetrics) => void
) => {
  const metricsRef = useRef<PerformanceMetrics>({
    totalEvents: 0,
    eventsPerSecond: 0,
    avgBatchTime: 0,
    memoryUsage: 0,
    lastUpdate: new Date()
  });
  const lastCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeDiff = now - lastUpdateRef.current;
    const eventDiff = events.length - lastCountRef.current;

    if (timeDiff > 0 && eventDiff > 0) {
      const eventsPerSecond = (eventDiff / timeDiff) * 1000;
      
      // Estimate memory usage (rough calculation)
      const avgEventSize = 1024; // ~1KB per event estimate
      const memoryUsage = events.length * avgEventSize;

      metricsRef.current = {
        totalEvents: events.length,
        eventsPerSecond,
        avgBatchTime: 0, // Will be updated by batcher
        memoryUsage,
        lastUpdate: new Date()
      };

      onUpdate?.(metricsRef.current);
    }

    lastCountRef.current = events.length;
    lastUpdateRef.current = now;
  }, [events.length, onUpdate]);

  return metricsRef.current;
};

/**
 * High-performance event feed with batching and virtual scrolling
 */
export const EventFeedV2 = memo<EventFeedV2Props>(({
  sessions,
  height = 400,
  width = 800,
  maxEvents = 1000,
  enableBatching = true,
  batchWindowMs = 100,
  defaultAutoScroll = true,
  className,
  onPerformanceUpdate,
  initialEvents = []
}) => {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [autoScroll, setAutoScroll] = useState(defaultAutoScroll);
  const [loading, setLoading] = useState(false);

  // Update internal events state when initialEvents prop changes
  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      console.log('📊 EventFeedV2: Received', initialEvents.length, 'initial events');
    }
  }, [initialEvents]);
  const batcherRef = useRef(getEventBatcher({
    windowMs: batchWindowMs,
    maxBatchSize: 50,
    preserveOrder: true
  }));
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Performance monitoring
  const metrics = usePerformanceMonitoring(events, onPerformanceUpdate);

  // Process batched events
  const handleEventBatch = useCallback((batch: EventBatch) => {
    setEvents(prevEvents => {
      // Merge new events with existing ones
      const newEvents = [...prevEvents, ...batch.events];
      
      // Apply FIFO limit
      if (newEvents.length > maxEvents) {
        return newEvents.slice(-maxEvents);
      }
      
      return newEvents;
    });
  }, [maxEvents]);

  // Initialize event batcher
  useEffect(() => {
    if (enableBatching) {
      const batcher = batcherRef.current;
      unsubscribeRef.current = batcher.subscribe(handleEventBatch);

      // Update batcher configuration
      batcher.updateConfig({
        windowMs: batchWindowMs,
        preserveOrder: true
      });

      return () => {
        unsubscribeRef.current?.();
      };
    }
  }, [enableBatching, batchWindowMs, handleEventBatch]);

  // Public API for adding events
  const addEvent = useCallback((event: Event) => {
    if (enableBatching) {
      batcherRef.current.addEvent(event);
    } else {
      setEvents(prevEvents => {
        const newEvents = [...prevEvents, event];
        return newEvents.length > maxEvents 
          ? newEvents.slice(-maxEvents)
          : newEvents;
      });
    }
  }, [enableBatching, maxEvents]);

  const addEvents = useCallback((newEvents: Event[]) => {
    if (enableBatching) {
      batcherRef.current.addEvents(newEvents);
    } else {
      setEvents(prevEvents => {
        const merged = [...prevEvents, ...newEvents];
        return merged.length > maxEvents 
          ? merged.slice(-maxEvents)
          : merged;
      });
    }
  }, [enableBatching, maxEvents]);

  // Sort events by timestamp for display (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [events]);

  // Auto-scroll handler
  const handleAutoScrollChange = useCallback((enabled: boolean) => {
    setAutoScroll(enabled);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      batcherRef.current.destroy();
    };
  }, []);

  // Expose API via ref (for parent components)
  React.useImperativeHandle(React.useRef(), () => ({
    addEvent,
    addEvents,
    clearEvents: () => setEvents([]),
    getEventCount: () => events.length,
    getBatcherMetrics: () => batcherRef.current.getMetrics(),
    flush: () => batcherRef.current.flush()
  }), [addEvent, addEvents, events.length]);

  return (
    <div 
      className={cn('relative flex flex-col h-full', className)}
      data-testid="event-feed-v2"
    >
      {/* Main event table */}
      <div className="flex-1 overflow-hidden">
        <EventTableV2
          events={sortedEvents}
          sessions={sessions}
          height={height}
          width={width}
          autoScroll={autoScroll}
          onAutoScrollChange={handleAutoScrollChange}
          maxEvents={maxEvents}
          loading={loading}
          className="w-full h-full"
        />
      </div>

      {/* Status bar with event count and performance info - now sticky at bottom */}
      <div className="bg-bg-secondary border-t border-border-primary px-3 py-1 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-3">
          <span>
            {sortedEvents.length} events
            {maxEvents && sortedEvents.length >= maxEvents && ' (max reached)'}
          </span>
          {enableBatching && (
            <span className="text-accent-blue">
              Batching: {batchWindowMs}ms window
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span>
            {metrics.eventsPerSecond.toFixed(1)} events/sec
          </span>
          <div className={cn(
            'flex items-center gap-1',
            autoScroll ? 'text-accent-green' : 'text-text-muted'
          )}>
            <span className="material-icons text-sm">
              {autoScroll ? 'sync' : 'sync_disabled'}
            </span>
            <span>Auto-scroll</span>
          </div>
        </div>
      </div>
    </div>
  );
});

EventFeedV2.displayName = 'memo(EventFeedV2)';

// Export additional utilities
export { usePerformanceMonitoring };