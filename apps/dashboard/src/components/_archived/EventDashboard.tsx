"use client";

import { useState, useCallback, useMemo } from 'react';
import { AnimatedEventCard } from './AnimatedEventCard';
import { EventDetailModal } from './EventDetailModal';
import { ConnectionStatus } from './ConnectionStatus';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { useEvents } from '@/hooks/useEvents';
import { useSessions } from '@/hooks/useSessions';
import type { Event } from '@/types/events';
import { TIME_CONSTANTS } from '@/lib/constants';

interface EventDashboardProps {
  className?: string;
}

export const EventDashboard: React.FC<EventDashboardProps> = ({ 
  className 
}) => {
  // Real data hooks
  const { 
    events, 
    loading: eventsLoading, 
    error: eventsError, 
    hasMore, 
    connectionStatus, 
    connectionQuality,
    retry: retryEvents, 
    loadMore 
  } = useEvents({ 
    limit: 50, 
    enableRealtime: true 
  });

  const { 
    sessions, 
    activeSessions, 
    sessionSummaries, 
    loading: sessionsLoading, 
    retry: retrySessions,
    getSessionDuration,
    getSessionSuccessRate
  } = useSessions();

  // Local state for UI interactions
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get session context for selected event
  const getSessionContext = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return undefined;

    const summary = sessionSummaries.get(sessionId);
    const duration = getSessionDuration(session);
    const successRate = getSessionSuccessRate(sessionId);

    return {
      projectPath: session.project_path || 'Unknown Project',
      gitBranch: session.git_branch || 'main',
      lastActivity: session.end_time || session.start_time,
      totalEvents: summary?.total_events || 0,
      toolUsageCount: summary?.tool_usage_count || 0,
      errorCount: summary?.error_count || 0,
      avgResponseTime: summary?.avg_response_time || null,
      duration,
      successRate,
      isActive: !session.end_time
    };
  }, [sessions, sessionSummaries, getSessionDuration, getSessionSuccessRate]);

  // Event handlers
  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleRetry = useCallback(async () => {
    await Promise.all([retryEvents(), retrySessions()]);
  }, [retryEvents, retrySessions]);

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !eventsLoading) {
      await loadMore();
    }
  }, [hasMore, eventsLoading, loadMore]);

  // Get related events for modal
  const getRelatedEvents = useCallback((event: Event | null) => {
    if (!event) return [];
    return events.filter(e => e.session_id === event.session_id);
  }, [events]);

  // Calculate stats for display
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const activeSessionsCount = activeSessions.length;
    const totalSessions = sessions.length;
    const recentErrors = events.filter(e => 
      e.event_type === 'error' && 
      new Date(e.timestamp).getTime() > Date.now() - TIME_CONSTANTS.ONE_DAY_MS
    ).length;

    return {
      totalEvents,
      activeSessionsCount,
      totalSessions,
      recentErrors
    };
  }, [events, activeSessions, sessions]);

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Chronicle Dashboard
              </h1>
              <p className="text-text-muted">
                Real-time monitoring of Claude Code tool usage and events
              </p>
            </div>
            <ConnectionStatus 
              status={connectionStatus.state}
              lastUpdate={connectionStatus.lastUpdate}
              lastEventReceived={connectionStatus.lastEventReceived}
              subscriptions={connectionStatus.subscriptions}
              reconnectAttempts={connectionStatus.reconnectAttempts}
              error={connectionStatus.error}
              isHealthy={connectionStatus.isHealthy}
              connectionQuality={connectionQuality}
              onRetry={handleRetry}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.totalEvents}</div>
              <div className="text-sm text-text-muted">Total Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent-green">{stats.activeSessionsCount}</div>
              <div className="text-sm text-text-muted">Active Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.totalSessions}</div>
              <div className="text-sm text-text-muted">Total Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent-red">{stats.recentErrors}</div>
              <div className="text-sm text-text-muted">Recent Errors (24h)</div>
            </div>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              disabled={eventsLoading || sessionsLoading}
            >
              {eventsLoading || sessionsLoading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            
            {hasMore && (
              <Button
                onClick={handleLoadMore}
                variant="outline"
                size="sm"
                disabled={eventsLoading}
              >
                {eventsLoading ? 'Loading...' : 'Load More Events'}
              </Button>
            )}
            
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span>Real-time:</span>
              <span className={connectionStatus.state === 'connected' ? 'text-accent-green' : 'text-accent-red'}>
                {connectionStatus.state === 'connected' ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Live Event Feed ({events.length})
            </h2>
            {eventsLoading && (
              <div className="text-sm text-text-muted">Loading events...</div>
            )}
          </div>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto space-y-2">
          {/* Error States */}
          {eventsError && (
            <div className="text-center py-8 text-accent-red">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="mb-2">Failed to load events</p>
              <p className="text-sm text-text-muted mb-4">{eventsError.message}</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {eventsLoading && events.length === 0 && (
            <div className="text-center py-8 text-text-muted">
              <div className="text-4xl mb-2">⏳</div>
              <p>Loading events...</p>
            </div>
          )}

          {/* Empty State */}
          {!eventsLoading && !eventsError && events.length === 0 && (
            <div className="text-center py-8 text-text-muted">
              <div className="text-4xl mb-2">📭</div>
              <p className="mb-2">No events found</p>
              <p className="text-sm">
                Events will appear here when Claude Code tools are used.
              </p>
            </div>
          )}

          {/* Events List */}
          {events.length > 0 && (
            <>
              {events.map((event, index) => (
                <AnimatedEventCard
                  key={event.id}
                  event={event}
                  onClick={handleEventClick}
                  isNew={false} // Real-time events don't need artificial "new" highlighting
                  animateIn={index < 3} // Animate first 3 events for smooth loading
                />
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <Button
                    onClick={handleLoadMore}
                    variant="outline"
                    size="sm"
                    disabled={eventsLoading}
                  >
                    {eventsLoading ? 'Loading...' : 'Load More Events'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        relatedEvents={getRelatedEvents(selectedEvent)}
        sessionContext={selectedEvent ? getSessionContext(selectedEvent.session_id) : undefined}
      />
    </div>
  );
};