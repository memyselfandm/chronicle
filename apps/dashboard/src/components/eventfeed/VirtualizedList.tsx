/**
 * VirtualizedList - High-performance virtual scrolling wrapper
 * 
 * Features:
 * - react-window FixedSizeList integration
 * - 24px itemHeight optimization
 * - 3 overscan items for smooth scrolling
 * - Auto-scroll management
 * - Performance monitoring
 * - Debounced scroll events
 */

'use client';

import React, { useRef, useCallback, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import { FixedSizeList as List, FixedSizeListProps } from 'react-window';
import { cn } from '@/lib/utils';

export interface VirtualizedListProps extends Omit<FixedSizeListProps, 'children'> {
  /** Render function for list items */
  children: FixedSizeListProps['children'];
  /** Additional CSS classes */
  className?: string;
  /** Enable auto-scroll behavior */
  autoScroll?: boolean;
  /** Debounce delay for scroll events (ms) */
  scrollDebounce?: number;
  /** Callback when user manually scrolls */
  onUserScroll?: () => void;
  /** Callback for performance metrics */
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
}

export interface PerformanceMetrics {
  /** Current scroll position */
  scrollTop: number;
  /** Total scrollable height */
  scrollHeight: number;
  /** Visible height */
  clientHeight: number;
  /** Items currently rendered */
  renderedItemCount: number;
  /** Last render time in ms */
  lastRenderTime: number;
}

export interface VirtualizedListRef {
  /** Scroll to specific item */
  scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  /** Scroll to top */
  scrollToTop: () => void;
  /** Get current scroll position */
  getScrollPosition: () => number;
  /** Force re-render */
  forceUpdate: () => void;
}

/**
 * High-performance virtualized list with auto-scroll and performance monitoring
 */
export const VirtualizedList = memo(
  forwardRef<VirtualizedListRef, VirtualizedListProps>(({
    children,
    className,
    autoScroll = false,
    scrollDebounce = 16, // 60fps
    onUserScroll,
    onPerformanceUpdate,
    ...listProps
  }, ref) => {
    const listRef = useRef<List>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>();
    const lastAutoScrollRef = useRef<number>(0);
    const performanceRef = useRef<PerformanceMetrics>({
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      renderedItemCount: 0,
      lastRenderTime: 0
    });

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      scrollToItem: (index: number, align = 'start') => {
        listRef.current?.scrollToItem(index, align);
        lastAutoScrollRef.current = Date.now();
      },
      scrollToTop: () => {
        listRef.current?.scrollToItem(0, 'start');
        lastAutoScrollRef.current = Date.now();
      },
      getScrollPosition: () => {
        return performanceRef.current.scrollTop;
      },
      forceUpdate: () => {
        listRef.current?.forceUpdate();
      }
    }), []);

    // Debounced scroll handler
    const handleScroll = useCallback(({
      scrollDirection,
      scrollOffset,
      scrollUpdateWasRequested
    }: {
      scrollDirection: 'forward' | 'backward';
      scrollOffset: number;
      scrollUpdateWasRequested: boolean;
    }) => {
      // Update performance metrics
      performanceRef.current.scrollTop = scrollOffset;
      performanceRef.current.lastRenderTime = Date.now();

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounced callback
      scrollTimeoutRef.current = setTimeout(() => {
        // Only trigger user scroll callback if it wasn't auto-scroll
        const timeSinceAutoScroll = Date.now() - lastAutoScrollRef.current;
        if (!scrollUpdateWasRequested && timeSinceAutoScroll > 1000) {
          onUserScroll?.();
        }

        // Performance metrics callback
        if (onPerformanceUpdate) {
          onPerformanceUpdate({ ...performanceRef.current });
        }
      }, scrollDebounce);
    }, [scrollDebounce, onUserScroll, onPerformanceUpdate]);

    // Auto-scroll to top when new items are added
    useEffect(() => {
      if (autoScroll && listRef.current && listProps.itemCount > 0) {
        listRef.current.scrollToItem(0, 'start');
        lastAutoScrollRef.current = Date.now();
      }
    }, [autoScroll, listProps.itemCount]);

    // Update performance metrics when list size changes
    useEffect(() => {
      performanceRef.current.scrollHeight = (listProps.itemCount || 0) * (listProps.itemSize as number || 24);
      performanceRef.current.clientHeight = listProps.height as number || 0;
      performanceRef.current.renderedItemCount = Math.min(
        Math.ceil((listProps.height as number || 0) / (listProps.itemSize as number || 24)) + (listProps.overscanCount || 3) * 2,
        listProps.itemCount || 0
      );
    }, [listProps.itemCount, listProps.itemSize, listProps.height, listProps.overscanCount]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div 
        className={cn('relative', className)}
        data-testid="virtualized-list-wrapper"
      >
        <List
          ref={listRef}
          onScroll={handleScroll}
          {...listProps}
          className={cn(
            // Base styling for virtual list
            'outline-none focus:outline-none',
            // Custom scrollbar styling
            '[&::-webkit-scrollbar]:w-2',
            '[&::-webkit-scrollbar-track]:bg-bg-tertiary',
            '[&::-webkit-scrollbar-thumb]:bg-border-primary',
            '[&::-webkit-scrollbar-thumb]:rounded-full',
            '[&::-webkit-scrollbar-thumb:hover]:bg-text-muted',
            listProps.className
          )}
        >
          {children}
        </List>

        {/* Performance overlay for debugging (only in development) */}
        {process.env.NODE_ENV === 'development' && onPerformanceUpdate && (
          <div className="absolute top-2 left-2 bg-bg-primary/90 border border-border-primary rounded px-2 py-1 text-xs font-mono text-text-muted">
            <div>Items: {listProps.itemCount}</div>
            <div>Rendered: {performanceRef.current.renderedItemCount}</div>
            <div>Scroll: {Math.round(performanceRef.current.scrollTop)}px</div>
          </div>
        )}
      </div>
    );
  })
);

VirtualizedList.displayName = 'memo(VirtualizedList)';