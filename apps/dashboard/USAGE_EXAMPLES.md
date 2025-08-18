# Chronicle Dashboard Usage Examples

This document provides practical usage examples and common patterns for working with the Chronicle Dashboard API, hooks, and components.

## Table of Contents

- [Basic Event Display](#basic-event-display)
- [Real-time Event Feed](#real-time-event-feed)
- [Event Filtering](#event-filtering)
- [Session Management](#session-management)
- [Connection Monitoring](#connection-monitoring)
- [Analytics and Metrics](#analytics-and-metrics)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)

## Basic Event Display

### Simple Event List

```typescript
import React from 'react';
import { useEvents } from '@/hooks/useEvents';
import { Event } from '@/types/events';

const SimpleEventList: React.FC = () => {
  const { events, loading, error } = useEvents({
    limit: 20,
    enableRealtime: true
  });

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="event-list">
      <h2>Recent Events ({events.length})</h2>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};

const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="event-card">
      <div className="event-header">
        <span className={`event-type ${event.event_type}`}>
          {event.event_type}
        </span>
        <span className="timestamp">
          {formatTimestamp(event.timestamp)}
        </span>
      </div>
      
      {event.tool_name && (
        <div className="tool-info">
          Tool: <strong>{event.tool_name}</strong>
          {event.duration_ms && (
            <span className="duration"> ({event.duration_ms}ms)</span>
          )}
        </div>
      )}
      
      <div className="session-info">
        Session: {event.session_id.slice(0, 8)}...
      </div>
    </div>
  );
};
```

### Event Type Badge Component

```typescript
import React from 'react';
import { EventType } from '@/types/filters';

interface EventTypeBadgeProps {
  eventType: EventType;
  count?: number;
  showCount?: boolean;
}

const EventTypeBadge: React.FC<EventTypeBadgeProps> = ({ 
  eventType, 
  count, 
  showCount = false 
}) => {
  const getEventTypeColor = (type: EventType): string => {
    const colorMap: Record<EventType, string> = {
      'session_start': 'bg-blue-100 text-blue-800',
      'pre_tool_use': 'bg-yellow-100 text-yellow-800',
      'post_tool_use': 'bg-green-100 text-green-800',
      'user_prompt_submit': 'bg-purple-100 text-purple-800',
      'stop': 'bg-gray-100 text-gray-800',
      'subagent_stop': 'bg-indigo-100 text-indigo-800',
      'pre_compact': 'bg-orange-100 text-orange-800',
      'notification': 'bg-cyan-100 text-cyan-800',
      'error': 'bg-red-100 text-red-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  const formatEventType = (type: EventType): string => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(eventType)}`}>
      {formatEventType(eventType)}
      {showCount && count !== undefined && (
        <span className="ml-1 font-bold">({count})</span>
      )}
    </span>
  );
};
```

## Real-time Event Feed

### Live Event Stream

```typescript
import React, { useState, useCallback } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { Event } from '@/types/events';

const LiveEventFeed: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  const { 
    events, 
    loading, 
    error, 
    connectionStatus, 
    connectionQuality,
    retry 
  } = useEvents({
    limit: 100,
    enableRealtime: !isPaused
  });

  // Track new events
  React.useEffect(() => {
    setEventCount(events.length);
  }, [events.length]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return (
    <div className="live-event-feed">
      <div className="feed-header">
        <h2>Live Event Feed</h2>
        
        <div className="feed-controls">
          <button 
            onClick={togglePause}
            className={`pause-btn ${isPaused ? 'paused' : 'live'}`}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          
          <div className="event-count">
            Events: {eventCount}
          </div>
          
          <ConnectionIndicator 
            status={connectionStatus.state}
            quality={connectionQuality}
            onRetry={retry}
          />
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>Connection error: {error.message}</span>
          <button onClick={retry}>Retry</button>
        </div>
      )}

      <div className="event-stream">
        {loading && events.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading events...</span>
          </div>
        ) : (
          <div className="events-container">
            {events.map((event, index) => (
              <AnimatedEventCard 
                key={event.id} 
                event={event} 
                isNew={index === 0 && !isPaused}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AnimatedEventCard: React.FC<{ 
  event: Event; 
  isNew: boolean; 
}> = ({ event, isNew }) => {
  return (
    <div 
      className={`animated-event-card ${isNew ? 'new-event' : ''}`}
      style={{
        animation: isNew ? 'slideIn 0.3s ease-out' : undefined
      }}
    >
      <EventCard event={event} />
    </div>
  );
};
```

### Connection Status Indicator

```typescript
import React from 'react';
import { ConnectionState, ConnectionQuality } from '@/types/connection';

interface ConnectionIndicatorProps {
  status: ConnectionState;
  quality?: ConnectionQuality;
  onRetry?: () => void;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  status,
  quality,
  onRetry
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🟠';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getQualityText = () => {
    if (!quality || quality === 'unknown') return '';
    return ` (${quality})`;
  };

  return (
    <div className="connection-indicator">
      <span className="status-icon">{getStatusIcon()}</span>
      <span className="status-text">
        {status}{getQualityText()}
      </span>
      
      {status === 'error' && onRetry && (
        <button 
          onClick={onRetry}
          className="retry-button"
          title="Retry connection"
        >
          🔄
        </button>
      )}
    </div>
  );
};
```

## Event Filtering

### Advanced Filter Component

```typescript
import React, { useState, useCallback } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { EventType, ExtendedFilterState } from '@/types/filters';

const EventFilterPanel: React.FC = () => {
  const [filters, setFilters] = useState<ExtendedFilterState>({
    eventTypes: [],
    showAll: true,
    dateRange: null,
    searchQuery: ''
  });

  const { events, loading, hasMore, loadMore } = useEvents({
    limit: 25,
    filters
  });

  const eventTypes: EventType[] = [
    'session_start', 'pre_tool_use', 'post_tool_use', 
    'user_prompt_submit', 'stop', 'subagent_stop', 
    'pre_compact', 'notification', 'error'
  ];

  const updateEventTypes = useCallback((types: EventType[]) => {
    setFilters(prev => ({
      ...prev,
      eventTypes: types,
      showAll: types.length === 0
    }));
  }, []);

  const updateDateRange = useCallback((start: Date | null, end: Date | null) => {
    setFilters(prev => ({
      ...prev,
      dateRange: start && end ? { start, end } : null
    }));
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: query
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      eventTypes: [],
      showAll: true,
      dateRange: null,
      searchQuery: ''
    });
  }, []);

  return (
    <div className="event-filter-panel">
      <div className="filter-section">
        <h3>Event Types</h3>
        <div className="event-type-checkboxes">
          {eventTypes.map(type => (
            <label key={type} className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.eventTypes.includes(type)}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateEventTypes([...filters.eventTypes, type]);
                  } else {
                    updateEventTypes(filters.eventTypes.filter(t => t !== type));
                  }
                }}
              />
              <EventTypeBadge eventType={type} />
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <h3>Date Range</h3>
        <DateRangePicker
          startDate={filters.dateRange?.start || null}
          endDate={filters.dateRange?.end || null}
          onChange={updateDateRange}
        />
      </div>

      <div className="filter-section">
        <h3>Search</h3>
        <input
          type="text"
          placeholder="Search events..."
          value={filters.searchQuery}
          onChange={(e) => updateSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-actions">
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear All Filters
        </button>
      </div>

      <div className="filtered-results">
        <h3>Results ({events.length})</h3>
        {loading && <div className="loading">Loading...</div>}
        
        <div className="events-list">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {hasMore && (
          <button 
            onClick={loadMore} 
            disabled={loading}
            className="load-more-btn"
          >
            Load More Events
          </button>
        )}
      </div>
    </div>
  );
};
```

### Quick Filter Presets

```typescript
const QuickFilters: React.FC<{
  onFilterChange: (filters: ExtendedFilterState) => void;
}> = ({ onFilterChange }) => {
  const presets = [
    {
      name: 'All Events',
      filters: { eventTypes: [], showAll: true }
    },
    {
      name: 'Errors Only',
      filters: { eventTypes: ['error'], showAll: false }
    },
    {
      name: 'Tool Usage',
      filters: { eventTypes: ['pre_tool_use', 'post_tool_use'], showAll: false }
    },
    {
      name: 'Session Events',
      filters: { eventTypes: ['session_start', 'stop'], showAll: false }
    },
    {
      name: 'Last Hour',
      filters: {
        eventTypes: [],
        showAll: true,
        dateRange: {
          start: new Date(Date.now() - 60 * 60 * 1000),
          end: new Date()
        }
      }
    },
    {
      name: 'Last 24 Hours',
      filters: {
        eventTypes: [],
        showAll: true,
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        }
      }
    }
  ];

  return (
    <div className="quick-filters">
      <h4>Quick Filters</h4>
      <div className="preset-buttons">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => onFilterChange(preset.filters)}
            className="preset-btn"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
};
```

## Session Management

### Session Dashboard

```typescript
import React from 'react';
import { useSessions } from '@/hooks/useSessions';
import { Session } from '@/types/events';

const SessionDashboard: React.FC = () => {
  const {
    sessions,
    activeSessions,
    sessionSummaries,
    loading,
    error,
    retry,
    getSessionDuration,
    getSessionSuccessRate
  } = useSessions();

  if (loading) {
    return <div className="loading">Loading sessions...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Error loading sessions: {error.message}
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  return (
    <div className="session-dashboard">
      <div className="dashboard-header">
        <h2>Session Dashboard</h2>
        <div className="session-stats">
          <div className="stat">
            <span className="stat-label">Total Sessions</span>
            <span className="stat-value">{sessions.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Sessions</span>
            <span className="stat-value">{activeSessions.length}</span>
          </div>
        </div>
      </div>

      <div className="active-sessions-section">
        <h3>Active Sessions</h3>
        <div className="sessions-grid">
          {activeSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              summary={sessionSummaries.get(session.id)}
              duration={getSessionDuration(session)}
              successRate={getSessionSuccessRate(session.id)}
              isActive={true}
            />
          ))}
        </div>
      </div>

      <div className="recent-sessions-section">
        <h3>Recent Sessions</h3>
        <div className="sessions-grid">
          {sessions.slice(0, 10).map(session => (
            <SessionCard
              key={session.id}
              session={session}
              summary={sessionSummaries.get(session.id)}
              duration={getSessionDuration(session)}
              successRate={getSessionSuccessRate(session.id)}
              isActive={activeSessions.includes(session)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface SessionCardProps {
  session: Session;
  summary?: SessionSummary;
  duration: number | null;
  successRate: number | null;
  isActive: boolean;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  summary,
  duration,
  successRate,
  isActive
}) => {
  const formatDuration = (ms: number | null): string => {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatSuccessRate = (rate: number | null): string => {
    return rate ? `${rate.toFixed(1)}%` : 'N/A';
  };

  return (
    <div className={`session-card ${isActive ? 'active' : 'completed'}`}>
      <div className="session-header">
        <div className="session-id">
          {session.id.slice(0, 8)}...
        </div>
        <div className={`session-status ${isActive ? 'active' : 'completed'}`}>
          {isActive ? 'Active' : 'Completed'}
        </div>
      </div>

      <div className="session-details">
        {session.project_path && (
          <div className="project-path">
            📁 {session.project_path.split('/').pop()}
          </div>
        )}
        
        {session.git_branch && (
          <div className="git-branch">
            🌿 {session.git_branch}
          </div>
        )}
        
        <div className="session-metrics">
          <div className="metric">
            <span className="metric-label">Duration:</span>
            <span className="metric-value">{formatDuration(duration)}</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Events:</span>
            <span className="metric-value">{summary?.total_events || 0}</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Tools Used:</span>
            <span className="metric-value">{summary?.tool_usage_count || 0}</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Success Rate:</span>
            <span className="metric-value">{formatSuccessRate(successRate)}</span>
          </div>
          
          {summary?.avg_response_time && (
            <div className="metric">
              <span className="metric-label">Avg Response:</span>
              <span className="metric-value">{Math.round(summary.avg_response_time)}ms</span>
            </div>
          )}
        </div>
      </div>

      <div className="session-actions">
        <button className="view-events-btn">
          View Events
        </button>
      </div>
    </div>
  );
};
```

## Analytics and Metrics

### Event Analytics Dashboard

```typescript
import React, { useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useSessions } from '@/hooks/useSessions';
import { EventType } from '@/types/filters';

const AnalyticsDashboard: React.FC = () => {
  const { events } = useEvents({ limit: 1000 });
  const { sessions, sessionSummaries } = useSessions();

  const analytics = useMemo(() => {
    // Event type distribution
    const eventTypeCount = events.reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {} as Record<EventType, number>);

    // Tool usage statistics
    const toolUsage = events
      .filter(event => event.tool_name)
      .reduce((acc, event) => {
        acc[event.tool_name!] = (acc[event.tool_name!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Average response times
    const toolTimes = events
      .filter(event => event.event_type === 'post_tool_use' && event.duration_ms)
      .reduce((acc, event) => {
        const tool = event.tool_name!;
        if (!acc[tool]) acc[tool] = [];
        acc[tool].push(event.duration_ms!);
        return acc;
      }, {} as Record<string, number[]>);

    const avgResponseTimes = Object.entries(toolTimes).reduce((acc, [tool, times]) => {
      acc[tool] = times.reduce((sum, time) => sum + time, 0) / times.length;
      return acc;
    }, {} as Record<string, number>);

    // Error rate
    const errorCount = events.filter(event => event.event_type === 'error').length;
    const errorRate = events.length > 0 ? (errorCount / events.length) * 100 : 0;

    // Session metrics
    const avgSessionDuration = Array.from(sessionSummaries.values())
      .reduce((sum, summary) => sum + (summary.avg_response_time || 0), 0) 
      / sessionSummaries.size;

    return {
      eventTypeCount,
      toolUsage,
      avgResponseTimes,
      errorRate,
      errorCount,
      totalEvents: events.length,
      avgSessionDuration
    };
  }, [events, sessionSummaries]);

  return (
    <div className="analytics-dashboard">
      <h2>Analytics Dashboard</h2>

      <div className="metrics-overview">
        <MetricCard
          title="Total Events"
          value={analytics.totalEvents}
          icon="📊"
        />
        <MetricCard
          title="Error Rate"
          value={`${analytics.errorRate.toFixed(1)}%`}
          icon="⚠️"
          status={analytics.errorRate > 5 ? 'warning' : 'good'}
        />
        <MetricCard
          title="Active Sessions"
          value={sessions.filter(s => !s.end_time).length}
          icon="🔄"
        />
        <MetricCard
          title="Avg Session Duration"
          value={`${Math.round(analytics.avgSessionDuration / 1000)}s`}
          icon="⏱️"
        />
      </div>

      <div className="charts-section">
        <div className="chart-container">
          <h3>Event Type Distribution</h3>
          <EventTypeChart data={analytics.eventTypeCount} />
        </div>

        <div className="chart-container">
          <h3>Tool Usage Frequency</h3>
          <ToolUsageChart data={analytics.toolUsage} />
        </div>

        <div className="chart-container">
          <h3>Average Response Times</h3>
          <ResponseTimeChart data={analytics.avgResponseTimes} />
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  status?: 'good' | 'warning' | 'error';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon, 
  status = 'good' 
}) => {
  return (
    <div className={`metric-card ${status}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <div className="metric-title">{title}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  );
};
```

## Error Handling

### Comprehensive Error Boundary

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p>The application encountered an unexpected error.</p>
            
            {this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleRetry}>
                Try Again
              </button>
              <button onClick={() => window.location.reload()}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage with specific error handling
const DashboardWithErrorBoundary: React.FC = () => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    // Send error to monitoring service
    console.error('Dashboard error:', { error, errorInfo });
  };

  return (
    <ErrorBoundary onError={handleError}>
      <EventDashboard />
    </ErrorBoundary>
  );
};
```

### Hook Error Handling Pattern

```typescript
import React, { useState, useCallback } from 'react';
import { useEvents } from '@/hooks/useEvents';

const RobustEventDisplay: React.FC = () => {
  const [retryCount, setRetryCount] = useState(0);
  
  const { 
    events, 
    loading, 
    error, 
    retry: hookRetry,
    connectionStatus 
  } = useEvents({
    limit: 50,
    enableRealtime: true
  });

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    hookRetry();
  }, [hookRetry]);

  // Show different error states
  if (error) {
    return (
      <div className="error-state">
        <div className="error-message">
          <h3>Failed to load events</h3>
          <p>{error.message}</p>
          
          {retryCount > 0 && (
            <p className="retry-info">
              Retry attempt: {retryCount}
            </p>
          )}
        </div>
        
        <div className="error-actions">
          <button 
            onClick={handleRetry}
            disabled={loading}
            className="retry-btn"
          >
            {loading ? 'Retrying...' : 'Try Again'}
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="reload-btn"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show connection issues
  if (connectionStatus.state === 'error') {
    return (
      <div className="connection-error">
        <h3>Connection Error</h3>
        <p>{connectionStatus.error}</p>
        <button onClick={handleRetry}>
          Reconnect
        </button>
      </div>
    );
  }

  // Normal render
  return (
    <div className="event-display">
      {loading && events.length === 0 && (
        <div className="loading-state">Loading events...</div>
      )}
      
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
```

This comprehensive usage examples document provides practical, real-world patterns for building robust Chronicle Dashboard applications with proper error handling, performance optimization, and user experience considerations.