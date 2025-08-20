# Supabase Real-time Integration Guide for Chronicle MVP

## Overview
Comprehensive guide for implementing Supabase real-time subscriptions in the Chronicle observability dashboard, focusing on connection management, performance optimization, and batching strategies for high-volume real-time data.

## Real-time Subscription Strategies

### 1. Broadcast vs Postgres Changes

**Recommended: Broadcast Method**
- More scalable and secure
- Uses Postgres triggers for controlled events
- Requires Realtime Authorization (private channels)
- Better performance for high-volume applications

**Postgres Changes Method**
- Simpler setup, direct table listening
- Less scalable, recommended for smaller applications
- Direct database change streaming

### 2. Broadcast Implementation Pattern

```javascript
// Postgres trigger function for broadcasting events
CREATE OR REPLACE FUNCTION broadcast_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'topic:chronicle_events',
    'INSERT',
    TG_TABLE_NAME,
    NEW.*
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

// Set up trigger
CREATE TRIGGER chronicle_events_broadcast
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION broadcast_changes();
```

```javascript
// Client-side subscription with private channel
const eventsChannel = supabase
  .channel('topic:chronicle_events', {
    config: { private: true }
  })
  .on('broadcast', { event: 'INSERT' }, (payload) => {
    // Handle new event data
    handleRealtimeEvent(payload);
  })
  .subscribe();
```

## Connection Management Best Practices

### 1. Single Connection Strategy
```javascript
// Limit to one WebSocket connection per user per window
class SupabaseConnectionManager {
  private static instance: SupabaseConnectionManager;
  private connection: RealtimeChannel | null = null;
  private subscribers: Map<string, Function[]> = new Map();

  static getInstance() {
    if (!this.instance) {
      this.instance = new SupabaseConnectionManager();
    }
    return this.instance;
  }

  subscribe(topic: string, callback: Function) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    this.subscribers.get(topic)!.push(callback);
    
    // Establish connection if not exists
    if (!this.connection) {
      this.establishConnection();
    }
  }

  private establishConnection() {
    this.connection = supabase
      .channel('chronicle_main', { config: { private: true } })
      .on('broadcast', { event: '*' }, this.handleMessage.bind(this))
      .subscribe();
  }

  private handleMessage(payload: any) {
    const topic = payload.topic;
    const callbacks = this.subscribers.get(topic) || [];
    callbacks.forEach(callback => callback(payload));
  }
}
```

### 2. Connection Status Monitoring
```javascript
// Connection health monitoring
const useRealtimeConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const connectToRealtime = () => {
      channel.current = supabase
        .channel('chronicle_status')
        .on('system', {}, (payload) => {
          if (payload.type === 'connected') {
            setConnectionStatus('connected');
            setReconnectAttempts(0);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error');
            scheduleReconnect();
          } else if (status === 'TIMED_OUT') {
            setConnectionStatus('disconnected');
            scheduleReconnect();
          }
        });
    };

    const scheduleReconnect = () => {
      if (reconnectAttempts < 5) {
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connectToRealtime();
        }, Math.pow(2, reconnectAttempts) * 1000); // Exponential backoff
      }
    };

    connectToRealtime();

    return () => {
      if (channel.current) {
        channel.current.unsubscribe();
      }
    };
  }, [reconnectAttempts]);

  return { connectionStatus, reconnectAttempts };
};
```

## Performance Optimization Strategies

### 1. Event Batching and Debouncing
```javascript
// Batch real-time events to reduce React re-renders
class EventBatcher {
  private batchedEvents: any[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_DELAY = 100; // ms

  addEvent(event: any, callback: (events: any[]) => void) {
    this.batchedEvents.push(event);

    // Process immediately if batch is full
    if (this.batchedEvents.length >= this.BATCH_SIZE) {
      this.processBatch(callback);
      return;
    }

    // Schedule batch processing
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch(callback);
    }, this.BATCH_DELAY);
  }

  private processBatch(callback: (events: any[]) => void) {
    if (this.batchedEvents.length > 0) {
      callback([...this.batchedEvents]);
      this.batchedEvents = [];
    }
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}
```

### 2. Memory Management for High Volume
```javascript
// Sliding window for real-time events to prevent memory leaks
const useRealtimeEventBuffer = (maxEvents = 1000) => {
  const [events, setEvents] = useState<Event[]>([]);
  const eventBuffer = useRef<Event[]>([]);

  const addEvents = useCallback((newEvents: Event[]) => {
    eventBuffer.current = [...eventBuffer.current, ...newEvents]
      .slice(-maxEvents); // Keep only the latest events

    setEvents([...eventBuffer.current]);
  }, [maxEvents]);

  const clearOldEvents = useCallback(() => {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    eventBuffer.current = eventBuffer.current.filter(
      event => new Date(event.timestamp).getTime() > cutoffTime
    );
    setEvents([...eventBuffer.current]);
  }, []);

  // Cleanup old events periodically
  useEffect(() => {
    const interval = setInterval(clearOldEvents, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [clearOldEvents]);

  return { events, addEvents };
};
```

### 3. Subscription Filtering and Row Level Security
```sql
-- Set up Row Level Security for real-time subscriptions
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy for user-specific event access
CREATE POLICY "Users can view their own events" ON events
  FOR SELECT
  USING (user_id = auth.uid());

-- Create policy for session-specific filtering
CREATE POLICY "Users can view session events" ON events
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE user_id = auth.uid()
    )
  );
```

```javascript
// Client-side filtering with real-time subscriptions
const useFilteredRealtimeEvents = (filters: EventFilters) => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    // Create filtered subscription based on current filters
    const channel = supabase
      .channel(`filtered_events_${JSON.stringify(filters)}`)
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const event = payload.new;
        
        // Apply client-side filters for additional filtering
        if (matchesFilters(event, filters)) {
          setEvents(prev => [event, ...prev].slice(0, 1000));
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [filters]);

  return events;
};
```

## React Integration Patterns

### 1. Avoiding React Strict Mode Issues
```javascript
// Handle React Strict Mode double useEffect calls
const useRealtimeSubscription = (topic: string, onEvent: (event: any) => void) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribed = useRef(false);

  useEffect(() => {
    // Prevent double subscription in Strict Mode
    if (isSubscribed.current) return;

    const channel = supabase
      .channel(topic)
      .on('broadcast', { event: '*' }, onEvent)
      .subscribe();

    channelRef.current = channel;
    isSubscribed.current = true;

    return () => {
      if (channelRef.current && isSubscribed.current) {
        channelRef.current.unsubscribe();
        isSubscribed.current = false;
      }
    };
  }, [topic, onEvent]);

  return channelRef.current;
};
```

### 2. Conditional Subscriptions
```javascript
// Subscribe only when needed to reduce resource usage
const useConditionalRealtime = (shouldSubscribe: boolean, filters: EventFilters) => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!shouldSubscribe) return;

    const channel = supabase
      .channel('conditional_events')
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        setEvents(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [shouldSubscribe, filters]);

  return events;
};
```

## Database Maintenance

### 1. Realtime Subscriptions Table Cleanup
```sql
-- Vacuum the realtime.subscriptions table to reduce size
VACUUM FULL realtime.subscriptions;

-- Set up automatic cleanup job
CREATE OR REPLACE FUNCTION cleanup_realtime_subscriptions()
RETURNS void AS $$
BEGIN
  DELETE FROM realtime.subscriptions 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily
SELECT cron.schedule('cleanup-realtime', '0 2 * * *', 'SELECT cleanup_realtime_subscriptions();');
```

### 2. Connection Monitoring
```javascript
// Monitor subscription health and performance
const useRealtimeMetrics = () => {
  const [metrics, setMetrics] = useState({
    messagesReceived: 0,
    averageLatency: 0,
    errorCount: 0,
    connectionUptime: 0
  });

  const startTime = useRef(Date.now());
  const latencyHistory = useRef<number[]>([]);

  const updateMetrics = useCallback((messageTimestamp: number) => {
    const latency = Date.now() - messageTimestamp;
    latencyHistory.current.push(latency);

    // Keep only last 100 latency measurements
    if (latencyHistory.current.length > 100) {
      latencyHistory.current.shift();
    }

    setMetrics(prev => ({
      messagesReceived: prev.messagesReceived + 1,
      averageLatency: latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length,
      errorCount: prev.errorCount,
      connectionUptime: Date.now() - startTime.current
    }));
  }, []);

  return { metrics, updateMetrics };
};
```

## Testing Real-time Subscriptions

### 1. Mock Real-time Events for Development
```javascript
// Mock Supabase real-time for testing
const mockSupabaseRealtime = {
  channel: (topic: string) => ({
    on: (type: string, config: any, callback: Function) => {
      // Simulate real-time events with mock data
      if (process.env.NODE_ENV === 'development') {
        const interval = setInterval(() => {
          callback({
            type: 'INSERT',
            new: generateMockEvent(),
            timestamp: Date.now()
          });
        }, 2000);

        return {
          subscribe: () => 'SUBSCRIBED',
          unsubscribe: () => clearInterval(interval)
        };
      }
      return { subscribe: () => {}, unsubscribe: () => {} };
    })
  })
};
```

## Performance Monitoring

### 1. Real-time Performance Tracking
```javascript
// Track real-time subscription performance
const usePerformanceMonitoring = () => {
  const performanceMetrics = useRef({
    subscriptionLatency: [],
    messageProcessingTime: [],
    memoryUsage: []
  });

  const trackSubscriptionPerformance = useCallback((startTime: number, endTime: number) => {
    const latency = endTime - startTime;
    performanceMetrics.current.subscriptionLatency.push(latency);

    // Report to analytics if latency is concerning
    if (latency > 2000) { // 2 seconds
      console.warn('High real-time subscription latency:', latency);
    }
  }, []);

  return { trackSubscriptionPerformance, performanceMetrics: performanceMetrics.current };
};
```

This guide provides a comprehensive foundation for implementing high-performance Supabase real-time subscriptions in the Chronicle MVP dashboard, with focus on connection stability, memory management, and optimal performance for high-volume real-time data streams.