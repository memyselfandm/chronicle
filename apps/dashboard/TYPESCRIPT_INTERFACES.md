# TypeScript Interface Reference

This document provides comprehensive TypeScript interface documentation for the Chronicle Dashboard, serving as a reference for developers working with the codebase.

## Table of Contents

- [Event Interfaces](#event-interfaces)
- [Session Interfaces](#session-interfaces)
- [Connection Interfaces](#connection-interfaces)
- [Filter Interfaces](#filter-interfaces)
- [Hook Interfaces](#hook-interfaces)
- [Utility Interfaces](#utility-interfaces)

## Event Interfaces

### BaseEvent

Base interface that all event types extend from, matching the database schema exactly.

```typescript
interface BaseEvent {
  /** Unique event identifier (UUID) */
  id: string;
  /** Session ID this event belongs to (UUID) */
  session_id: string;
  /** Event type category */
  event_type: EventType;
  /** Event timestamp (TIMESTAMPTZ) */
  timestamp: string;
  /** Event metadata (JSONB) */
  metadata: Record<string, any>;
  /** Tool name for tool-related events */
  tool_name?: string;
  /** Duration in milliseconds for tool events */
  duration_ms?: number;
  /** When record was created */
  created_at: string;
}
```

### Specific Event Interfaces

Each event type has a specific interface that extends `BaseEvent`:

```typescript
/** Session start event interface */
interface SessionStartEvent extends BaseEvent {
  event_type: 'session_start';
}

/** Pre-tool use event interface */
interface PreToolUseEvent extends BaseEvent {
  event_type: 'pre_tool_use';
  tool_name: string; // Required for tool events
}

/** Post-tool use event interface */
interface PostToolUseEvent extends BaseEvent {
  event_type: 'post_tool_use';
  tool_name: string; // Required for tool events
  duration_ms?: number; // Often present for completed tool events
}

/** User prompt submit event interface */
interface UserPromptSubmitEvent extends BaseEvent {
  event_type: 'user_prompt_submit';
}

/** Stop event interface */
interface StopEvent extends BaseEvent {
  event_type: 'stop';
}

/** Subagent stop event interface */
interface SubagentStopEvent extends BaseEvent {
  event_type: 'subagent_stop';
}

/** Pre-compact event interface */
interface PreCompactEvent extends BaseEvent {
  event_type: 'pre_compact';
}

/** Notification event interface */
interface NotificationEvent extends BaseEvent {
  event_type: 'notification';
}

/** Error event interface */
interface ErrorEvent extends BaseEvent {
  event_type: 'error';
}
```

### Event Union Type

```typescript
/** Union type for all event types */
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
```

### EventSummary

Interface for dashboard event summary statistics:

```typescript
interface EventSummary {
  /** Total number of events */
  total: number;
  /** Events by type */
  byType: Record<EventType, number>;
  /** Events by status */
  byStatus: Record<string, number>;
  /** Time range of events */
  timeRange: {
    earliest: string;
    latest: string;
  };
}
```

## Session Interfaces

### Session

Main session interface matching the database schema:

```typescript
interface Session {
  /** Unique session identifier (UUID) */
  id: string;
  /** Claude session identifier */
  claude_session_id: string;
  /** Project file path */
  project_path?: string;
  /** Git branch name */
  git_branch?: string;
  /** Session start timestamp */
  start_time: string;
  /** Session end timestamp (if completed) */
  end_time?: string;
  /** Session metadata (JSONB) */
  metadata: Record<string, any>;
  /** When record was created */
  created_at: string;
}
```

### SessionSummary

Interface for session analytics and metrics:

```typescript
interface SessionSummary {
  /** Session identifier */
  session_id: string;
  /** Total number of events in session */
  total_events: number;
  /** Number of tool usage events */
  tool_usage_count: number;
  /** Number of error events */
  error_count: number;
  /** Average response time for tool operations */
  avg_response_time: number | null;
}
```

## Connection Interfaces

### ConnectionState

Union type for connection states:

```typescript
type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'checking';
```

### ConnectionQuality

Union type for connection quality assessment:

```typescript
type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';
```

### ConnectionStatus

Main interface for connection status tracking:

```typescript
interface ConnectionStatus {
  /** Current connection state */
  state: ConnectionState;
  /** When status was last updated */
  lastUpdate: Date | null;
  /** When last event was received (for health monitoring) */
  lastEventReceived: Date | null;
  /** Number of active subscriptions */
  subscriptions: number;
  /** Number of reconnection attempts made */
  reconnectAttempts: number;
  /** Current error message if any */
  error: string | null;
  /** Whether connection is considered healthy */
  isHealthy: boolean;
}
```

### ConnectionStatusProps

Props interface for connection status components:

```typescript
interface ConnectionStatusProps {
  /** Connection state */
  status: ConnectionState;
  /** Optional last update timestamp */
  lastUpdate?: Date | string | null;
  /** Optional last event received timestamp */
  lastEventReceived?: Date | string | null;
  /** Optional number of subscriptions */
  subscriptions?: number;
  /** Optional reconnection attempts count */
  reconnectAttempts?: number;
  /** Optional error message */
  error?: string | null;
  /** Optional health status */
  isHealthy?: boolean;
  /** Optional connection quality */
  connectionQuality?: ConnectionQuality;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show text labels */
  showText?: boolean;
  /** Optional retry callback */
  onRetry?: () => void;
}
```

### UseSupabaseConnectionOptions

Configuration options for the useSupabaseConnection hook:

```typescript
interface UseSupabaseConnectionOptions {
  /** Enable periodic health checks */
  enableHealthCheck?: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Base delay between reconnection attempts */
  reconnectDelay?: number;
  /** Debounce delay for state changes */
  debounceMs?: number;
}
```

## Filter Interfaces

### EventType

Union type for all supported event types:

```typescript
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

### FilterState

Basic filter state interface:

```typescript
interface FilterState {
  /** Array of selected event types to filter by */
  eventTypes: EventType[];
  /** Whether to show all events (no filtering) */
  showAll: boolean;
}
```

### ExtendedFilterState

Extended filter options for advanced filtering:

```typescript
interface ExtendedFilterState extends FilterState {
  /** Session IDs to filter by */
  sessionIds?: string[];
  /** Date range for filtering events */
  dateRange?: {
    start: Date;
    end: Date;
  } | null;
  /** Search query for text-based filtering */
  searchQuery?: string;
}
```

### FilterChangeHandler

Interface for components that handle filter changes:

```typescript
interface FilterChangeHandler {
  /** Callback function when filters are updated */
  onFilterChange: (filters: FilterState) => void;
}
```

### FilterOption

Interface for filter option configuration:

```typescript
interface FilterOption {
  /** Unique identifier for the filter option */
  value: string;
  /** Display label for the filter option */
  label: string;
  /** Whether this option is currently selected */
  selected: boolean;
  /** Number of items matching this filter (optional) */
  count?: number;
}
```

### EventFilterUtils

Interface for event filtering utility functions:

```typescript
interface EventFilterUtils {
  /** Format event type for display */
  formatEventType: (eventType: EventType) => string;
  /** Check if an event matches the current filters */
  matchesFilter: (event: any, filters: FilterState) => boolean;
  /** Get all unique event types from a list of events */
  getUniqueEventTypes: (events: any[]) => EventType[];
}
```

## Hook Interfaces

### UseEventsState

Return type for the useEvents hook:

```typescript
interface UseEventsState {
  /** Array of fetched events */
  events: Event[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether more events are available for pagination */
  hasMore: boolean;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Current connection quality */
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  /** Function to retry on error */
  retry: () => void;
  /** Function to load more events (pagination) */
  loadMore: () => Promise<void>;
}
```

### UseEventsOptions

Options for configuring the useEvents hook:

```typescript
interface UseEventsOptions {
  /** Number of events to fetch per page */
  limit?: number;
  /** Filter options to apply */
  filters?: Partial<FilterState>;
  /** Whether to enable real-time subscriptions */
  enableRealtime?: boolean;
}
```

### UseSessionsState

Return type for the useSessions hook:

```typescript
interface UseSessionsState {
  /** Array of all sessions */
  sessions: Session[];
  /** Array of currently active sessions */
  activeSessions: Session[];
  /** Map of session summaries by session ID */
  sessionSummaries: Map<string, SessionSummary>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Function to retry on error */
  retry: () => Promise<void>;
  /** Function to calculate session duration */
  getSessionDuration: (session: Session) => number | null;
  /** Function to calculate session success rate */
  getSessionSuccessRate: (sessionId: string) => number | null;
  /** Function to check if session is active */
  isSessionActive: (sessionId: string) => Promise<boolean>;
  /** Function to update session end times */
  updateSessionEndTimes: () => Promise<void>;
}
```

## Utility Interfaces

### EventData (Mock Data)

Interface used for mock data generation and testing:

```typescript
interface EventData {
  id: string;
  timestamp: Date;
  type: EventType;
  session_id: string;
  summary: string;
  details?: Record<string, any>;
  tool_name?: string;
  duration_ms?: number;
  success?: boolean;
}
```

### SessionData (Mock Data)

Interface used for mock session data:

```typescript
interface SessionData {
  id: string;
  status: 'active' | 'idle' | 'completed';
  startedAt: Date;
  projectName?: string;
  color: string; // Consistent color for session identification
}
```

## Type Guards

### isValidEventType

Type guard function to check if a string is a valid EventType:

```typescript
const isValidEventType = (type: any): type is EventType => {
  return [
    'session_start',
    'pre_tool_use',
    'post_tool_use',
    'user_prompt_submit',
    'stop',
    'subagent_stop',
    'pre_compact',
    'notification',
    'error'
  ].includes(type);
};
```

## Constants and Configuration

### REALTIME_CONFIG

Configuration constants for real-time subscriptions:

```typescript
const REALTIME_CONFIG = {
  EVENTS_PER_SECOND: number;
  RECONNECT_ATTEMPTS: number;
  BATCH_SIZE: number;
  BATCH_DELAY: number;
  MAX_CACHED_EVENTS: number;
  HEARTBEAT_INTERVAL: number;
  TIMEOUT: number;
} as const;
```

### CONNECTION_DELAYS

Timing constants for connection management:

```typescript
const CONNECTION_DELAYS = {
  DEBOUNCE_DELAY: number;
  CONNECTING_DISPLAY_DELAY: number;
  RECONNECT_DELAY: number;
  QUICK_RECONNECT_DELAY: number;
} as const;
```

### MONITORING_INTERVALS

Monitoring and health check intervals:

```typescript
const MONITORING_INTERVALS = {
  HEALTH_CHECK_INTERVAL: number;
  REALTIME_HEARTBEAT_INTERVAL: number;
  RECENT_EVENT_THRESHOLD: number;
} as const;
```

## Usage Examples

### Type-safe Event Handling

```typescript
const handleEvent = (event: Event) => {
  switch (event.event_type) {
    case 'session_start':
      // TypeScript knows this is SessionStartEvent
      console.log('Session started:', event.session_id);
      break;
    case 'pre_tool_use':
      // TypeScript knows this is PreToolUseEvent with tool_name
      console.log('Using tool:', event.tool_name);
      break;
    case 'post_tool_use':
      // TypeScript knows this is PostToolUseEvent
      if (event.duration_ms) {
        console.log('Tool completed in:', event.duration_ms, 'ms');
      }
      break;
    case 'error':
      // TypeScript knows this is ErrorEvent
      console.error('Error occurred:', event.metadata);
      break;
  }
};
```

### Filter State Management

```typescript
const [filters, setFilters] = useState<ExtendedFilterState>({
  eventTypes: ['session_start', 'error'],
  showAll: false,
  dateRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date()
  },
  searchQuery: ''
});

const updateEventTypes = (types: EventType[]) => {
  setFilters(prev => ({
    ...prev,
    eventTypes: types
  }));
};
```

### Connection Status Handling

```typescript
const renderConnectionStatus = (status: ConnectionStatus) => {
  const getStatusColor = (): string => {
    switch (status.state) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-orange-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`connection-status ${getStatusColor()}`}>
      <span>{status.state}</span>
      {status.subscriptions > 0 && (
        <span>({status.subscriptions} active)</span>
      )}
    </div>
  );
};
```

This reference provides complete TypeScript interface documentation for the Chronicle Dashboard, ensuring type safety and developer productivity when working with the codebase.