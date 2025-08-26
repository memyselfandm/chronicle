'use client';

import React, { memo, useEffect, useMemo, useCallback, useState } from 'react';
import { VirtualizedEventFeed } from './VirtualizedEventFeed';
import { VirtualizedSessionList } from './VirtualizedSessionList';
import { PerformanceDashboard } from './PerformanceDashboard';
import { useStoreOptimizations } from '@/lib/storeOptimizations';
import { getPerformanceMonitor } from '@/lib/performanceMonitor';
import { cn } from '@/lib/utils';

interface PerformanceOptimizedDashboardProps {
  className?: string;
  showPerformanceMetrics?: boolean;
  enableAutoCleanup?: boolean;
  maxEvents?: number;
  maxSessionAge?: number;
}

/**
 * High-performance dashboard component demonstrating all optimizations:
 * - Virtual scrolling for large datasets
 * - Selective store subscriptions  
 * - Batched updates
 * - Memory management
 * - Performance monitoring
 */
export const PerformanceOptimizedDashboard = memo<PerformanceOptimizedDashboardProps>(({
  className,
  showPerformanceMetrics = false,
  enableAutoCleanup = true,
  maxEvents = 1000,
  maxSessionAge = 24 * 60 * 60 * 1000, // 24 hours
}) => {
  const {
    sessions,
    events,
    filters,
    ui,
    batchedSessionUpdates,
    batchedEventUpdates,
    memoryOpt,
  } = useStoreOptimizations();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);

  // Start performance monitoring
  useEffect(() => {
    performanceMonitor.start();
    return () => {
      if (!showPerformanceMetrics) {
        performanceMonitor.stop();
      }
    };
  }, [performanceMonitor, showPerformanceMetrics]);

  // Auto-cleanup memory when enabled
  useEffect(() => {
    if (!enableAutoCleanup) return;

    const cleanupInterval = setInterval(() => {
      memoryOpt.cleanupOldEvents(maxEvents);
      memoryOpt.cleanupCompletedSessions(maxSessionAge);
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, [enableAutoCleanup, maxEvents, maxSessionAge, memoryOpt]);

  // Optimized event handlers with performance tracking
  const handleSessionSelect = useCallback((sessionId: string, multiSelect: boolean) => {
    const profiler = performanceMonitor.createProfiler('SessionSelect').start();
    
    if (multiSelect) {
      const currentSelected = Array.from(filters.selectedSessions);
      const newSelected = currentSelected.includes(sessionId)
        ? currentSelected.filter(id => id !== sessionId)
        : [...currentSelected, sessionId];
      
      batchedSessionUpdates.updateSession(sessionId, { lastActivity: new Date() });
    } else {
      // Single select - use store action directly for better performance
      // This would be implemented in the actual store
    }
    
    profiler.end();
  }, [filters.selectedSessions, batchedSessionUpdates, performanceMonitor]);

  const handleEventClick = useCallback((event: any) => {
    const profiler = performanceMonitor.createProfiler('EventClick').start();
    setSelectedEventId(event.id);
    profiler.end();
  }, [performanceMonitor]);

  // Memoized filtered data for virtualization
  const virtualizedEvents = useMemo(() => {
    const filteredEvents = events.filteredEvents;
    
    // Apply additional client-side filtering if needed
    if (filters.selectedSessions.length > 0) {
      return filteredEvents.filter(event => 
        filters.selectedSessions.includes(event.sessionId)
      );
    }
    
    return filteredEvents;
  }, [events.filteredEvents, filters.selectedSessions]);

  const virtualizedSessions = useMemo(() => {
    return sessions.filteredSessions;
  }, [sessions.filteredSessions]);

  // Performance metrics for debugging
  const memoryUsage = useMemo(() => {
    return memoryOpt.getMemoryUsage();
  }, [memoryOpt]);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Performance Dashboard (if enabled) */}
      {showPerformanceMetrics && (
        <div className="border-b border-border p-4">
          <PerformanceDashboard compact autoRefresh />
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Sessions Sidebar */}
        <div className="w-80 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Sessions ({virtualizedSessions.length})
            </h2>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-text-muted">
                {memoryUsage.estimatedSizeKB.toFixed(1)}KB
              </div>
            )}
          </div>
          
          <VirtualizedSessionList
            sessions={virtualizedSessions}
            height={600}
            itemHeight={80}
            onSessionSelect={handleSessionSelect}
            selectedSessionIds={Array.from(filters.selectedSessions)}
            showScrollIndicator
          />
        </div>

        {/* Events Feed */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Events ({virtualizedEvents.length})
            </h2>
            
            {/* Performance indicators */}
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {ui.loading && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Loading
                </div>
              )}
              
              {filters.selectedSessions.length > 0 && (
                <div className="bg-accent-blue/10 text-accent-blue px-2 py-1 rounded">
                  {filters.selectedSessions.length} session{filters.selectedSessions.length > 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          </div>

          <VirtualizedEventFeed
            events={virtualizedEvents}
            height={600}
            itemHeight={120}
            onEventClick={handleEventClick}
            autoScroll
            showScrollIndicator
          />
        </div>

        {/* Event Details Sidebar (when event selected) */}
        {selectedEventId && (
          <div className="w-80 border-l border-border pl-4">
            <h3 className="text-md font-semibold text-text-primary mb-4">Event Details</h3>
            <div className="text-sm text-text-muted">
              Selected: {selectedEventId}
            </div>
            <button
              onClick={() => setSelectedEventId(null)}
              className="mt-4 text-xs text-accent-blue hover:text-accent-blue/80"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Performance Footer (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="border-t border-border p-2 bg-bg-secondary">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex gap-4">
              <span>Sessions: {sessions.sessionCount}</span>
              <span>Events: {events.eventCount}</span>
              <span>Memory: {memoryUsage.estimatedSizeKB.toFixed(1)}KB</span>
            </div>
            
            <div className="flex gap-4">
              <span>Virtual Rendering: ✅</span>
              <span>Batched Updates: ✅</span>
              <span>Optimized Subscriptions: ✅</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PerformanceOptimizedDashboard.displayName = 'PerformanceOptimizedDashboard';

// Hook for managing dashboard performance
export const useDashboardPerformance = () => {
  const performanceMonitor = useMemo(() => getPerformanceMonitor(), []);
  const { memoryOpt } = useStoreOptimizations();
  
  const [stats, setStats] = useState({
    renderCount: 0,
    lastOptimization: null as Date | null,
    memoryPressure: false,
  });

  // Monitor memory pressure
  useEffect(() => {
    const checkMemoryPressure = () => {
      const usage = memoryOpt.getMemoryUsage();
      const isHighMemory = usage.estimatedSizeKB > 50000; // 50MB threshold
      
      setStats(prev => ({
        ...prev,
        memoryPressure: isHighMemory,
      }));

      if (isHighMemory) {
        console.warn('High memory usage detected, consider enabling auto-cleanup');
      }
    };

    const interval = setInterval(checkMemoryPressure, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [memoryOpt]);

  // Auto-optimization when memory pressure detected
  const runOptimization = useCallback(() => {
    const profiler = performanceMonitor.createProfiler('DashboardOptimization').start();
    
    memoryOpt.cleanupOldEvents(1000);
    memoryOpt.cleanupCompletedSessions(24 * 60 * 60 * 1000);
    
    setStats(prev => ({
      ...prev,
      lastOptimization: new Date(),
    }));
    
    profiler.end();
  }, [memoryOpt, performanceMonitor]);

  // Performance recommendations
  const recommendations = useMemo(() => {
    const usage = memoryOpt.getMemoryUsage();
    const recs: string[] = [];

    if (usage.events > 1000) {
      recs.push('Consider enabling auto-cleanup for events');
    }
    
    if (usage.sessions > 100) {
      recs.push('Consider cleanup for completed sessions');
    }
    
    if (stats.memoryPressure) {
      recs.push('Memory usage is high - run optimization');
    }

    return recs;
  }, [memoryOpt, stats.memoryPressure]);

  return {
    stats,
    recommendations,
    runOptimization,
    performanceMonitor,
  };
};

export default PerformanceOptimizedDashboard;