"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * ThroughputIndicator - Events per minute display with activity visualization
 * 
 * Features per consolidated guidance:
 * - Events per minute calculation (rolling 60-second average)
 * - "150/min" format display
 * - Real-time calculation from event stream
 * - Smooth number transitions with animations
 * - Visual representation of activity level
 * - Peak indicator for burst detection
 * - Blue color for info status (#3b82f6)
 */

interface ThroughputIndicatorProps {
  eventsPerMinute: number;
  className?: string;
  showActivityLevel?: boolean;
}

interface ActivityLevel {
  level: 'idle' | 'low' | 'moderate' | 'high' | 'burst';
  color: string;
  description: string;
}

export function ThroughputIndicator({ 
  eventsPerMinute, 
  className,
  showActivityLevel = true 
}: ThroughputIndicatorProps) {
  const [previousValue, setPreviousValue] = useState(eventsPerMinute);
  const [isAnimating, setIsAnimating] = useState(false);

  // Determine activity level based on events per minute
  const activityLevel = useMemo((): ActivityLevel => {
    if (eventsPerMinute === 0) {
      return {
        level: 'idle',
        color: 'text-text-muted',
        description: 'No activity'
      };
    } else if (eventsPerMinute <= 10) {
      return {
        level: 'low',
        color: 'text-status-info',
        description: 'Low activity'
      };
    } else if (eventsPerMinute <= 50) {
      return {
        level: 'moderate',
        color: 'text-status-active',
        description: 'Moderate activity'
      };
    } else if (eventsPerMinute <= 100) {
      return {
        level: 'high',
        color: 'text-status-awaiting',
        description: 'High activity'
      };
    } else {
      return {
        level: 'burst',
        color: 'text-status-error',
        description: 'Burst activity'
      };
    }
  }, [eventsPerMinute]);

  // Animate value changes
  useEffect(() => {
    if (eventsPerMinute !== previousValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPreviousValue(eventsPerMinute);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [eventsPerMinute, previousValue]);

  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        className
      )}
      data-testid="throughput-indicator"
    >
      {/* Activity Level Dot */}
      {showActivityLevel && (
        <div 
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            activityLevel.color.replace('text-', 'bg-'),
            activityLevel.level === 'burst' && 'animate-pulse'
          )}
          title={activityLevel.description}
          aria-label={activityLevel.description}
        />
      )}
      
      {/* Events Per Minute Display */}
      <div className="flex items-center gap-1">
        <span 
          className={cn(
            "text-xs font-mono font-medium transition-all duration-300",
            activityLevel.color,
            isAnimating && "scale-110"
          )}
          data-testid="events-count"
        >
          {eventsPerMinute}
        </span>
        <span className="text-xs text-text-muted">
          /min
        </span>
      </div>
      
      {/* Peak Indicator for High Activity */}
      {eventsPerMinute > 80 && (
        <div 
          className="flex items-center"
          title="High throughput detected"
        >
          <span className="text-xs text-status-awaiting">
            ⚡
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook for calculating real-time throughput from event stream
 * Provides rolling window calculation with configurable timeframe
 */
export function useEventThroughput(
  events: Array<{ timestamp: Date }>,
  windowMinutes: number = 1
) {
  return useMemo(() => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (windowMinutes * 60000));
    
    const recentEvents = events.filter(event => event.timestamp >= windowStart);
    
    // Calculate per-minute rate
    return Math.round(recentEvents.length / windowMinutes);
  }, [events, windowMinutes]);
}

export { ThroughputIndicator };