# Chronicle Dashboard API Documentation

This document provides comprehensive API documentation for the Chronicle Dashboard hooks, interfaces, and usage patterns.

## Table of Contents

- [Hooks](#hooks)
  - [useEvents](#useevents)
  - [useSessions](#usesessions)
  - [useSupabaseConnection](#usesupabaseconnection)
- [TypeScript Interfaces](#typescript-interfaces)
- [Real-time Subscriptions](#real-time-subscriptions)
- [Usage Examples](#usage-examples)

## Hooks

### useEvents

Hook for managing events with real-time subscriptions, filtering, and pagination.

#### Interface

```typescript
interface UseEventsState {
  events: Event[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  connectionStatus: ConnectionStatus;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  retry: () => void;
  loadMore: () => Promise<void>;
}

interface UseEventsOptions {
  limit?: number;
  filters?: Partial<FilterState>;
  enableRealtime?: boolean;
}
```

#### Usage

```typescript
import { useEvents } from '@/hooks/useEvents';

const MyComponent = () => {
  const {
    events,
    loading,
    error,
    hasMore,
    connectionStatus,
    connectionQuality,
    retry,
    loadMore
  } = useEvents({
    limit: 25,
    filters: {
      eventTypes: ['session_start', 'error'],
      sessionIds: ['session-uuid'],
      dateRange: {
        start: new Date('2025-08-01'),
        end: new Date('2025-08-18')
      }
    },
    enableRealtime: true
  });

  if (loading) return <div>Loading events...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div>Connection: {connectionStatus.state} ({connectionQuality})</div>
      {events.map(event => (
        <div key={event.id}>{event.event_type}</div>
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
};
```

#### Features

- **Real-time updates**: Automatically receives new events via Supabase subscriptions
- **Filtering**: Supports filtering by event type, session, date range, and search query
- **Pagination**: Infinite scroll with `loadMore()` function
- **Connection monitoring**: Tracks connection health and quality
- **Error handling**: Automatic retry on connection failures
- **Memory management**: Limits cached events to prevent memory leaks

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Number of events per page |
| `filters` | `Partial<FilterState>` | `{}` | Event filtering options |
| `enableRealtime` | `boolean` | `true` | Enable real-time subscriptions |

### useSessions

Hook for managing session data and analytics.

#### Interface

```typescript
interface UseSessionsState {
  sessions: Session[];
  activeSessions: Session[];
  sessionSummaries: Map<string, SessionSummary>;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  getSessionDuration: (session: Session) => number | null;
  getSessionSuccessRate: (sessionId: string) => number | null;
  isSessionActive: (sessionId: string) => Promise<boolean>;
  updateSessionEndTimes: () => Promise<void>;
}

interface SessionSummary {
  session_id: string;
  total_events: number;
  tool_usage_count: number;
  error_count: number;
  avg_response_time: number | null;
}
```

#### Usage

```typescript
import { useSessions } from '@/hooks/useSessions';

const SessionsDashboard = () => {
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

  return (
    <div>
      <h2>Active Sessions ({activeSessions.length})</h2>
      {activeSessions.map(session => {
        const summary = sessionSummaries.get(session.id);
        const duration = getSessionDuration(session);
        const successRate = getSessionSuccessRate(session.id);

        return (
          <div key={session.id}>
            <h3>{session.project_path}</h3>
            <p>Duration: {duration ? `${Math.round(duration / 1000)}s` : 'Unknown'}</p>
            <p>Success Rate: {successRate ? `${successRate.toFixed(1)}%` : 'N/A'}</p>
            <p>Events: {summary?.total_events || 0}</p>
            <p>Tool Usage: {summary?.tool_usage_count || 0}</p>
          </div>
        );
      })}
    </div>
  );
};
```

#### Features

- **Session tracking**: Monitors all Claude Code sessions
- **Real-time status**: Distinguishes between active and completed sessions
- **Analytics**: Provides session summaries with metrics
- **Performance data**: Tracks tool usage and response times
- **Error analysis**: Calculates success rates and error counts

### useSupabaseConnection

Hook for monitoring Supabase connection state with health checks and auto-reconnect.

#### Interface

```typescript
interface UseSupabaseConnectionOptions {
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  debounceMs?: number;
}

interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: Date | null;
  lastEventReceived: Date | null;
  subscriptions: number;
  reconnectAttempts: number;
  error: string | null;
  isHealthy: boolean;
}

type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'checking';
```

#### Usage

```typescript
import { useSupabaseConnection } from '@/hooks/useSupabaseConnection';

const ConnectionMonitor = () => {
  const {
    status,
    registerChannel,
    unregisterChannel,
    recordEventReceived,
    retry,
    getConnectionQuality
  } = useSupabaseConnection({
    enableHealthCheck: true,
    healthCheckInterval: 30000,
    maxReconnectAttempts: 5
  });

  return (
    <div>
      <div>Status: {status.state}</div>
      <div>Quality: {getConnectionQuality}</div>
      <div>Subscriptions: {status.subscriptions}</div>
      {status.error && <div>Error: {status.error}</div>}
      <button onClick={retry}>Retry Connection</button>
    </div>
  );
};
```

#### Features

- **Health monitoring**: Periodic health checks with configurable intervals
- **Auto-reconnect**: Exponential backoff retry strategy
- **Channel management**: Tracks real-time subscription channels
- **Connection quality**: Measures connection performance
- **Error recovery**: Handles network issues gracefully

## TypeScript Interfaces

### Core Event Interfaces

```typescript
// Base event structure
interface BaseEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  timestamp: string;
  metadata: Record<string, any>;
  tool_name?: string;
  duration_ms?: number;
  created_at: string;
}

// Event type union
type Event = 
  | SessionStartEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | UserPromptSubmitEvent
  | StopEvent
  | SubagentStopEvent
  | PreCompactEvent
  | NotificationEvent
  | ErrorEvent;

// Event types
type EventType = 
  | 'session_start'
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'user_prompt_submit'
  | 'stop'
  | 'subagent_stop'
  | 'pre_compact'
  | 'notification'
  | 'error';
```

### Session Interface

```typescript
interface Session {
  id: string;
  claude_session_id: string;
  project_path?: string;
  git_branch?: string;
  start_time: string;
  end_time?: string;
  metadata: Record<string, any>;
  created_at: string;
}
```

### Connection Types

```typescript
type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'checking';
type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';

interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: Date | null;
  lastEventReceived: Date | null;
  subscriptions: number;
  reconnectAttempts: number;
  error: string | null;
  isHealthy: boolean;
}
```

### Filter Types

```typescript
interface FilterState {
  eventTypes: EventType[];
  showAll: boolean;
}

interface ExtendedFilterState extends FilterState {
  sessionIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  } | null;
  searchQuery?: string;
}
```

## Real-time Subscriptions

The Chronicle Dashboard uses Supabase real-time subscriptions for live event updates.

### Subscription Model

```typescript
// Real-time channel setup
const channel = supabase
  .channel('events-realtime')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chronicle_events',
    },
    handleRealtimeEvent
  )
  .subscribe();
```

### Event Handling

```typescript
const handleRealtimeEvent = useCallback((payload: { new: Event }) => {
  const newEvent: Event = payload.new;
  
  // Record event received for connection health
  recordEventReceived();
  
  // Prevent duplicates
  if (!eventIdsRef.current.has(newEvent.id)) {
    eventIdsRef.current.add(newEvent.id);
    
    // Add to events array (newest first)
    setEvents(prev => [newEvent, ...prev]);
  }
}, [recordEventReceived]);
```

### Configuration

```typescript
const REALTIME_CONFIG = {
  EVENTS_PER_SECOND: 5,          // Rate limiting
  RECONNECT_ATTEMPTS: 5,         // Max reconnection tries
  BATCH_SIZE: 50,               // Event batch size
  BATCH_DELAY: 100,             // Batch processing delay
  MAX_CACHED_EVENTS: 1000,      // Memory limit
  HEARTBEAT_INTERVAL: 30000,    // Health check interval
  TIMEOUT: 10000,               // Connection timeout
};
```

## Usage Examples

### Basic Event Display

```typescript
import { useEvents } from '@/hooks/useEvents';

const EventFeed = () => {
  const { events, loading, error } = useEvents();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {events.map(event => (
        <div key={event.id} className="event-card">
          <h3>{event.event_type}</h3>
          <p>{event.timestamp}</p>
          {event.tool_name && <p>Tool: {event.tool_name}</p>}
          {event.duration_ms && <p>Duration: {event.duration_ms}ms</p>}
        </div>
      ))}
    </div>
  );
};
```

### Filtered Events with Pagination

```typescript
const FilteredEvents = () => {
  const [filters, setFilters] = useState<ExtendedFilterState>({
    eventTypes: ['error'],
    showAll: false,
    dateRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    }
  });

  const { events, loading, hasMore, loadMore } = useEvents({
    limit: 20,
    filters
  });

  return (
    <div>
      <button onClick={() => setFilters({
        ...filters,
        eventTypes: ['error']
      })}>
        Show Errors Only
      </button>
      
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
      
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          Load More
        </button>
      )}
    </div>
  );
};
```

### Session Analytics

```typescript
const SessionAnalytics = () => {
  const { sessions, sessionSummaries, getSessionDuration } = useSessions();

  const analytics = useMemo(() => {
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => !s.end_time).length;
    
    const avgDuration = sessions
      .map(getSessionDuration)
      .filter(d => d !== null)
      .reduce((sum, d) => sum + d!, 0) / totalSessions;

    return { totalSessions, activeSessions, avgDuration };
  }, [sessions, getSessionDuration]);

  return (
    <div>
      <h2>Session Analytics</h2>
      <p>Total Sessions: {analytics.totalSessions}</p>
      <p>Active Sessions: {analytics.activeSessions}</p>
      <p>Average Duration: {Math.round(analytics.avgDuration / 1000)}s</p>
    </div>
  );
};
```

### Connection Status Monitor

```typescript
const ConnectionMonitor = () => {
  const { status, retry, getConnectionQuality } = useSupabaseConnection();

  const getStatusColor = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'disconnected': return 'orange';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="connection-monitor">
      <div 
        className={`status-indicator ${getStatusColor(status.state)}`}
        title={`Connection: ${status.state}`}
      />
      <span>{status.state}</span>
      <span>({getConnectionQuality})</span>
      
      {status.error && (
        <div className="error">
          {status.error}
          <button onClick={retry}>Retry</button>
        </div>
      )}
      
      <div className="stats">
        <span>Subscriptions: {status.subscriptions}</span>
        <span>Reconnect Attempts: {status.reconnectAttempts}</span>
      </div>
    </div>
  );
};
```

## Error Handling

All hooks implement comprehensive error handling:

```typescript
// Automatic retry on failure
const { retry } = useEvents();

// Error state management
if (error) {
  return (
    <div className="error-state">
      <p>Failed to load events: {error.message}</p>
      <button onClick={retry}>Try Again</button>
    </div>
  );
}

// Connection error handling
const { status, retry: retryConnection } = useSupabaseConnection();

if (status.state === 'error') {
  return (
    <div className="connection-error">
      <p>Connection lost: {status.error}</p>
      <button onClick={retryConnection}>Reconnect</button>
    </div>
  );
}
```

## Performance Considerations

1. **Pagination**: Use `limit` parameter to control data loading
2. **Memory Management**: Events are automatically limited to prevent memory leaks
3. **Debouncing**: Connection state changes are debounced to prevent flicker
4. **Filtering**: Apply filters to reduce data transfer
5. **Real-time Throttling**: Event subscriptions are rate-limited to prevent overwhelm