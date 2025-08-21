'use client';

import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { cn } from '@/lib/utils';
import { SessionData } from '@/stores/dashboardStore';
import { getPerformanceMonitor } from '@/lib/performanceMonitor';

export interface VirtualizedSessionListProps {
  sessions: SessionData[];
  className?: string;
  height?: number;
  itemHeight?: number;
  overscan?: number;
  onSessionClick?: (session: SessionData) => void;
  onSessionSelect?: (sessionId: string, multiSelect: boolean) => void;
  selectedSessionIds?: string[];
  showScrollIndicator?: boolean;
  debounceMs?: number;
}

interface SessionItemProps extends ListChildComponentProps {
  data: {
    sessions: SessionData[];
    onSessionClick?: (session: SessionData) => void;
    onSessionSelect?: (sessionId: string, multiSelect: boolean) => void;
    selectedSessionIds: string[];
    itemHeight: number;
  };
}

// Memoized session item component for virtual scrolling
const SessionItem = memo<SessionItemProps>(({ index, style, data }) => {
  const { sessions, onSessionClick, onSessionSelect, selectedSessionIds, itemHeight } = data;
  const session = sessions[index];
  
  if (!session) {
    return (
      <div style={style} className="flex items-center justify-center text-text-muted">
        Loading...
      </div>
    );
  }

  const isSelected = selectedSessionIds.includes(session.id);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onSessionSelect) {
      onSessionSelect(session.id, e.ctrlKey || e.metaKey);
    } else if (onSessionClick) {
      onSessionClick(session);
    }
  }, [session, onSessionClick, onSessionSelect]);

  const getStatusColor = (status: SessionData['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: SessionData['status']) => {
    switch (status) {
      case 'active': return '▶️';
      case 'idle': return '⏸️';
      case 'completed': return '✅';
      default: return '❓';
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const diffMs = end.getTime() - startTime.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const truncateId = (id: string) => {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  };

  return (
    <div style={style} className="px-1">
      <button
        onClick={handleClick}
        className={cn(
          'w-full text-left p-3 rounded-md border transition-all duration-150',
          'hover:bg-bg-tertiary hover:border-accent-blue/30',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1',
          isSelected
            ? 'bg-accent-blue/10 border-accent-blue/50'
            : 'bg-bg-secondary border-border'
        )}
        style={{ height: itemHeight - 4 }}
      >
        <div className="flex items-center justify-between gap-2 h-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-sm" role="img" aria-label={`Session ${session.status}`}>
                {getStatusIcon(session.status)}
              </span>
              <div 
                className={cn('w-2 h-2 rounded-full', getStatusColor(session.status))}
                aria-label={`Status: ${session.status}`}
              />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-primary truncate">
                  {truncateId(session.id)}
                </span>
                {session.eventsCount > 0 && (
                  <span className="text-xs bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded-full">
                    {session.eventsCount}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-muted">
                {formatDuration(session.startTime, session.endTime)}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {session.toolsUsed > 0 && (
              <span className="text-xs text-text-muted">
                🔧 {session.toolsUsed}
              </span>
            )}
            <span className="text-xs text-text-muted">
              {session.startTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
              })}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
});

SessionItem.displayName = 'SessionItem';

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
          <div className="w-12 h-1 bg-bg-tertiary rounded-full overflow-hidden">
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

// Main virtualized session list component
export const VirtualizedSessionList = memo<VirtualizedSessionListProps>(({
  sessions,
  className,
  height = 400,
  itemHeight = 80,
  overscan = 3,
  onSessionClick,
  onSessionSelect,
  selectedSessionIds = [],
  showScrollIndicator = true,
  debounceMs = 16,
}) => {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const performanceMonitor = getPerformanceMonitor();
  const profilerRef = useRef(performanceMonitor.createProfiler('VirtualizedSessionList'));
  
  // Debounced scroll handler
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const handleScroll = useCallback(({ scrollOffset }: {
    scrollOffset: number;
    scrollDirection: 'forward' | 'backward';
  }) => {
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    setIsScrolling(true);
    
    // Calculate scroll progress
    const maxScroll = Math.max(0, sessions.length * itemHeight - height);
    const progress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
    setScrollProgress(Math.min(1, Math.max(0, progress)));

    // Track performance
    performanceMonitor.trackEvent();

    // Debounce the scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, debounceMs * 3);
  }, [sessions.length, itemHeight, height, debounceMs, performanceMonitor]);

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    sessions,
    onSessionClick,
    onSessionSelect,
    selectedSessionIds,
    itemHeight,
  }), [sessions, onSessionClick, onSessionSelect, selectedSessionIds, itemHeight]);

  // Calculate visible items for scroll indicator
  const visibleItems = Math.ceil(height / itemHeight);

  // Performance profiling
  useEffect(() => {
    const profiler = profilerRef.current.start();
    return () => {
      profiler.end();
    };
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        // Handle keyboard navigation if needed
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (sessions.length === 0) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center text-center',
          className
        )}
        style={{ height }}
      >
        <div className="text-text-muted">
          <div className="text-3xl mb-3">👥</div>
          <h3 className="text-sm font-semibold mb-1">No sessions</h3>
          <p className="text-xs">Sessions will appear here when you start using Claude Code</p>
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
          totalItems={sessions.length}
          visibleItems={visibleItems}
        />
      )}

      {/* Virtual list */}
      <List
        ref={listRef}
        height={height}
        itemCount={sessions.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscan}
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-secondary"
      >
        {SessionItem}
      </List>

      {/* Performance overlay for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 bg-bg-secondary/90 rounded px-2 py-1 text-xs text-text-muted">
          {sessions.length} sessions • {visibleItems} visible • {selectedSessionIds.length} selected
        </div>
      )}
    </div>
  );
});

VirtualizedSessionList.displayName = 'VirtualizedSessionList';

// Hook for managing session selection performance
export const useSessionSelectionPerformance = (sessions: SessionData[]) => {
  const [metrics, setMetrics] = useState({
    selectionTime: 0,
    selectedCount: 0,
    lastSelectionAt: null as Date | null,
  });

  const trackSelection = useCallback((selectedIds: string[]) => {
    const startTime = performance.now();
    
    setMetrics(prev => ({
      ...prev,
      selectedCount: selectedIds.length,
      selectionTime: performance.now() - startTime,
      lastSelectionAt: new Date(),
    }));
  }, []);

  const optimizationTips = useMemo(() => ({
    shouldUseMultiSelect: sessions.length > 50,
    recommendedBatchSize: Math.min(10, Math.ceil(sessions.length / 20)),
    memoryImpact: sessions.length * 0.5, // KB estimate
  }), [sessions.length]);

  return {
    metrics,
    trackSelection,
    optimizationTips,
  };
};