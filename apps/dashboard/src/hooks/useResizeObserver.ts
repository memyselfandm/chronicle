/**
 * useResizeObserver - Hook to observe element resize events
 * Provides real-time dimension updates for responsive components
 */

import { useEffect, useRef, RefObject } from 'react';

type ResizeObserverCallback = (entry: ResizeObserverEntry) => void;

export function useResizeObserver(
  elementRef: RefObject<Element>,
  callback: ResizeObserverCallback
): void {
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        callbackRef.current(entry);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef]);
}