/**
 * AutoSizeWrapper - Measures container dimensions and provides them to children
 * Fixes the issue where EventFeedV2 was using hardcoded 800px width
 */

'use client';

import React, { useRef, useState, useEffect, ReactElement } from 'react';
import { useResizeObserver } from '@/hooks/useResizeObserver';

interface AutoSizeWrapperProps {
  children: (dimensions: { width: number; height: number }) => ReactElement;
  className?: string;
  minHeight?: number;
  minWidth?: number;
}

export function AutoSizeWrapper({ 
  children, 
  className,
  minHeight = 200,
  minWidth = 300
}: AutoSizeWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ 
    width: minWidth, 
    height: minHeight 
  });

  // Custom hook for resize observation
  useResizeObserver(containerRef, (entry) => {
    const { width, height } = entry.contentRect;
    setDimensions({
      width: Math.max(width, minWidth),
      height: Math.max(height, minHeight)
    });
  });

  // Initial measurement
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.max(rect.width, minWidth),
        height: Math.max(rect.height, minHeight)
      });
    }
  }, [minWidth, minHeight]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }}>
      {children(dimensions)}
    </div>
  );
}