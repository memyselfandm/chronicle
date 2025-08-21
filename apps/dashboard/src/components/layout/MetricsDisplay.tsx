"use client";

import React, { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboardStore';
import { SessionBadges } from './SessionBadges';
import { ThroughputIndicator, useEventThroughput } from './ThroughputIndicator';

/**
 * MetricsDisplay - Real-time dashboard metrics header component
 * 
 * Features per consolidated guidance:
 * - Active sessions count with green indicator
 * - Awaiting sessions count with yellow indicator  
 * - Events per minute throughput display
 * - Semantic color coding: Green (active), Yellow (awaiting), Blue (info)
 * - Real-time updates with performance optimization
 */

interface MetricsDisplayProps {
  className?: string;
}

export function MetricsDisplay({ className }: MetricsDisplayProps) {
  // Optimized selectors for better performance - only subscribe to what we need
  const sessions = useDashboardStore((state) => state.sessions);
  const events = useDashboardStore((state) => state.events);
  const connectionStatus = useDashboardStore((state) => state.realtime.connectionStatus);

  // Memoize session counts with optimized calculation
  const sessionCounts = useMemo(() => {
    // Create a map of last events per session for efficient lookup
    const lastEventsBySession = new Map<string, { type: string; timestamp: Date }>();
    
    // Sort events once and find last event per session
    events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .forEach(event => {
        if (!lastEventsBySession.has(event.sessionId)) {
          lastEventsBySession.set(event.sessionId, {
            type: event.type,
            timestamp: event.timestamp
          });
        }
      });

    let activeSessions = 0;
    let awaitingSessions = 0;

    sessions.forEach(session => {
      const lastEvent = lastEventsBySession.get(session.id);
      
      if (session.status === 'active') {
        // Check if last event indicates awaiting input
        if (lastEvent?.type === 'notification') {
          awaitingSessions++;
        } else {
          activeSessions++;
        }
      } else if (session.status === 'awaiting') {
        awaitingSessions++;
      }
    });
    
    return { activeSessions, awaitingSessions };
  }, [sessions, events]);

  // Use the custom hook for throughput calculation
  const eventsPerMinute = useEventThroughput(events, 1);

  // Callback for session badge clicks (future enhancement)
  const handleSessionFilter = useCallback((filter: 'active' | 'awaiting') => {
    // TODO: Integrate with sidebar filtering
    console.log('Filter by:', filter);
  }, []);

  return (
    <div 
      className={cn(
        "flex items-center gap-3",
        "text-xs font-medium",
        className
      )}
      data-testid="metrics-display"
    >
      {/* Session Status Badges */}
      <SessionBadges 
        activeSessions={sessionCounts.activeSessions}
        awaitingSessions={sessionCounts.awaitingSessions}
        onClick={handleSessionFilter}
      />
      
      {/* Events Throughput */}
      <ThroughputIndicator eventsPerMinute={eventsPerMinute} />
      
      {/* Optional: Show if disconnected */}
      {connectionStatus === 'disconnected' && (
        <span className="text-text-muted">
          (Offline)
        </span>
      )}
    </div>
  );
}

export { MetricsDisplay };