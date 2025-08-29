# Chronicle Performance Tuning Guide

## Overview

Chronicle is optimized for production use with validated performance specifications:

- **Event Processing**: 100+ events/second sustained throughput
- **Memory Usage**: <100MB baseline (tested peak: 51.2MB)
- **Query Performance**: <100ms response times
- **Database**: Optimized indexes for session_id, timestamp, event_type

This guide provides comprehensive performance optimization strategies for both SQLite and Supabase backends.

## Performance Specifications

### Validated Benchmarks

Chronicle has been performance-tested with the following validated metrics:

```
Load Testing Results:
├── Event Processing: 100+ events/second sustained
├── Memory Usage: 51.2MB peak, <100MB baseline
├── Query Response: <100ms with proper indexing
├── Database Size: Efficient with 10,000+ events
├── WebSocket Connections: 50+ concurrent connections
└── API Throughput: 1000+ requests/minute
```

### Resource Requirements

**Minimum Requirements:**
- CPU: 1 vCPU (2+ recommended)
- RAM: 512MB (1GB+ recommended)
- Disk: 100MB + data storage
- Network: 10Mbps+ for real-time streaming

**Recommended Production:**
- CPU: 2+ vCPU
- RAM: 2GB+
- Disk: SSD with 1GB+ free space
- Network: 100Mbps+

## Database Performance Optimization

### SQLite Optimization

#### Database Configuration

```sql
-- Enable performance-optimized SQLite settings
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging for better concurrency
PRAGMA synchronous = NORMAL;         -- Balanced durability/performance
PRAGMA cache_size = 10000;          -- 10,000 pages in cache (~40MB)
PRAGMA temp_store = memory;         -- Use memory for temporary tables
PRAGMA mmap_size = 268435456;       -- 256MB memory-mapped I/O
```

Apply these settings programmatically:

```python
# In database.py configuration
def optimize_sqlite_performance(connection):
    """Apply SQLite performance optimizations."""
    optimizations = [
        "PRAGMA journal_mode = WAL",
        "PRAGMA synchronous = NORMAL", 
        "PRAGMA cache_size = 10000",
        "PRAGMA temp_store = memory",
        "PRAGMA mmap_size = 268435456"
    ]
    
    for pragma in optimizations:
        connection.execute(pragma)
```

#### Index Optimization

Chronicle uses optimized indexes for query performance:

```sql
-- Primary indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_session_timestamp 
ON events(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_type_timestamp 
ON events(event_type, timestamp);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
ON sessions(created_at);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_events_session_type_timestamp 
ON events(session_id, event_type, timestamp);

-- Covering index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_events_dashboard_query 
ON events(session_id, timestamp, event_type, tool_name);
```

#### Query Optimization

**Optimized Dashboard Queries:**

```sql
-- Fast session list query with event counts
SELECT s.*, 
       COUNT(e.id) as event_count,
       MAX(e.timestamp) as last_activity
FROM sessions s
LEFT JOIN events e ON s.session_id = e.session_id
WHERE s.created_at > datetime('now', '-7 days')
GROUP BY s.session_id
ORDER BY s.created_at DESC
LIMIT 50;

-- Efficient event feed query
SELECT id, session_id, timestamp, event_type, tool_name, metadata
FROM events
WHERE session_id = ?
  AND timestamp > ?
ORDER BY timestamp DESC
LIMIT 1000;
```

#### Database Maintenance

```sql
-- Regular maintenance queries
ANALYZE;                    -- Update query planner statistics
VACUUM;                     -- Reclaim unused space (run weekly)
PRAGMA optimize;            -- Automatic index optimization
REINDEX;                   -- Rebuild indexes if needed
```

Automate maintenance:

```bash
#!/bin/bash
# chronicle-db-maintenance.sh

DB_PATH="$HOME/.claude/hooks/chronicle/data/chronicle.db"

sqlite3 "$DB_PATH" << EOF
PRAGMA analysis_limit = 1000;
ANALYZE;
PRAGMA optimize;
EOF

echo "$(date): Database maintenance completed"
```

### Supabase/PostgreSQL Optimization

#### Connection Pooling

```python
# Optimize Supabase connection settings
supabase_config = {
    'db_url': os.getenv('SUPABASE_DATABASE_URL'),
    'pool_size': 20,                # Connection pool size
    'max_overflow': 30,             # Additional connections
    'pool_timeout': 30,             # Connection timeout
    'pool_recycle': 1800,           # Recycle connections every 30min
}
```

#### Query Optimization

```sql
-- PostgreSQL-specific optimizations
SET work_mem = '256MB';            -- Memory for sorts/joins
SET effective_cache_size = '1GB';  -- Available system cache
SET random_page_cost = 1.1;       -- SSD optimization

-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;
```

#### Index Maintenance

```sql
-- PostgreSQL automatic maintenance
SET auto_vacuum = on;
SET autovacuum_vacuum_scale_factor = 0.1;
SET autovacuum_analyze_scale_factor = 0.05;

-- Manual maintenance
VACUUM ANALYZE sessions;
VACUUM ANALYZE events;
REINDEX TABLE events;
```

## Memory Management

### Application-Level Memory Optimization

#### Event Queue Management

```python
# Optimized event processing with memory management
class OptimizedEventProcessor:
    def __init__(self):
        self.max_queue_size = 1000
        self.batch_size = 100
        self.memory_threshold = 0.8  # 80% memory usage trigger
        
    async def process_events(self):
        # Process events in batches to manage memory
        while self.event_queue:
            batch = self.get_event_batch()
            await self.process_batch(batch)
            
            # Memory management
            if self.get_memory_usage() > self.memory_threshold:
                await self.cleanup_memory()
                gc.collect()  # Force garbage collection
```

#### WebSocket Connection Management

```python
# Limit concurrent connections to prevent memory issues
class ConnectionManager:
    def __init__(self):
        self.max_connections = 50
        self.connection_timeout = 300  # 5 minutes
        self.cleanup_interval = 60     # 1 minute
        
    async def cleanup_stale_connections(self):
        # Remove inactive connections
        current_time = time.time()
        for conn_id, conn in list(self.connections.items()):
            if current_time - conn.last_activity > self.connection_timeout:
                await self.disconnect(conn_id)
```

### Memory Monitoring

```python
# Memory usage monitoring
import psutil
import gc

def monitor_memory_usage():
    process = psutil.Process()
    memory_info = process.memory_info()
    
    return {
        'rss_mb': memory_info.rss / 1024 / 1024,      # Physical memory
        'vms_mb': memory_info.vms / 1024 / 1024,      # Virtual memory
        'percent': process.memory_percent(),            # Memory percentage
        'available_mb': psutil.virtual_memory().available / 1024 / 1024
    }

# Automatic memory cleanup
def cleanup_memory_if_needed(threshold=0.8):
    memory_usage = monitor_memory_usage()
    
    if memory_usage['percent'] > threshold * 100:
        gc.collect()
        logging.info(f"Memory cleanup triggered at {memory_usage['percent']:.1f}%")
```

## Event Processing Tuning

### Batch Processing Optimization

```python
# Optimized event batching for high throughput
class EventBatcher:
    def __init__(self):
        self.batch_size = 100           # Events per batch
        self.batch_timeout = 1.0        # Max batch wait time (seconds)
        self.max_memory_batch = 50      # Reduce batch size under memory pressure
        
    async def process_event_batch(self, events):
        # Use bulk insert for better performance
        query = """
        INSERT INTO events (session_id, timestamp, event_type, tool_name, metadata)
        VALUES (?, ?, ?, ?, ?)
        """
        
        # Execute in bulk
        await self.db.executemany(query, events)
        
        # Update statistics
        self.update_processing_stats(len(events))
```

### Real-time Processing

```python
# Optimized real-time event streaming
class RealTimeProcessor:
    def __init__(self):
        self.debounce_interval = 0.1    # 100ms debouncing
        self.max_events_per_second = 100
        self.rate_limiter = RateLimiter(self.max_events_per_second)
        
    async def stream_events(self, websocket):
        # Rate-limited event streaming
        async for event in self.event_stream:
            if await self.rate_limiter.acquire():
                await websocket.send_json(event)
            else:
                # Queue for next batch if rate limited
                self.queue_event(event)
```

## Network and I/O Optimization

### WebSocket Performance

```python
# Optimized WebSocket configuration
websocket_config = {
    'ping_interval': 20,        # 20 second ping interval
    'ping_timeout': 10,         # 10 second ping timeout
    'close_timeout': 10,        # Connection close timeout
    'max_size': 1024 * 1024,   # 1MB max message size
    'max_queue': 32,           # Max outbound queue size
    'compression': 'deflate',   # Enable compression
}
```

### File I/O Optimization

```python
# Async file operations for better performance
import aiofiles

async def write_logs_async(log_data):
    async with aiofiles.open('chronicle.log', mode='a') as f:
        await f.write(f"{log_data}\n")

# Batch file operations
class BatchLogger:
    def __init__(self):
        self.log_buffer = []
        self.buffer_size = 100
        
    async def flush_logs(self):
        if self.log_buffer:
            async with aiofiles.open('chronicle.log', mode='a') as f:
                await f.writelines(self.log_buffer)
            self.log_buffer.clear()
```

## Monitoring and Profiling

### Performance Metrics Collection

```python
# Built-in performance monitoring
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'events_per_second': 0,
            'average_response_time': 0,
            'memory_usage_mb': 0,
            'active_connections': 0,
            'database_query_time': 0
        }
        
    def collect_metrics(self):
        self.metrics.update({
            'events_per_second': self.calculate_event_rate(),
            'average_response_time': self.calculate_avg_response_time(),
            'memory_usage_mb': monitor_memory_usage()['rss_mb'],
            'active_connections': len(connection_manager.connections),
            'database_query_time': self.get_db_query_metrics()
        })
        
        return self.metrics

# Performance profiling
import cProfile
import pstats

def profile_performance(func):
    """Decorator for profiling function performance."""
    def wrapper(*args, **kwargs):
        pr = cProfile.Profile()
        pr.enable()
        result = func(*args, **kwargs)
        pr.disable()
        
        # Save profiling results
        stats = pstats.Stats(pr)
        stats.sort_stats('cumulative').print_stats(10)
        
        return result
    return wrapper
```

### Health Check Endpoints

```python
# Enhanced health check with performance metrics
@app.get("/health/performance")
async def performance_health_check():
    metrics = performance_monitor.collect_metrics()
    
    # Performance thresholds
    health_status = {
        'overall': 'healthy',
        'metrics': metrics,
        'thresholds': {
            'events_per_second': {'value': metrics['events_per_second'], 'threshold': 10, 'status': 'ok'},
            'memory_usage_mb': {'value': metrics['memory_usage_mb'], 'threshold': 100, 'status': 'ok'},
            'response_time_ms': {'value': metrics['average_response_time'], 'threshold': 100, 'status': 'ok'}
        }
    }
    
    # Check thresholds
    for metric, config in health_status['thresholds'].items():
        if config['value'] > config['threshold']:
            config['status'] = 'warning'
            health_status['overall'] = 'degraded'
    
    return health_status
```

## Production Optimization

### Server Configuration

```python
# Production-optimized server settings
production_config = {
    'host': '0.0.0.0',              # Bind to all interfaces in production
    'port': 8510,
    'workers': 1,                   # Single worker for SQLite
    'worker_connections': 1000,
    'keepalive_timeout': 2,
    'max_requests': 1000,
    'max_requests_jitter': 100,
    'preload_app': True,
    'timeout': 30,
    'graceful_timeout': 30,
}

# Uvicorn optimization
uvicorn.run(
    "main:app",
    **production_config,
    access_log=False,              # Disable access log for performance
    use_colors=False,
    log_config=None               # Use custom logging
)
```

### Load Testing

```bash
#!/bin/bash
# chronicle-load-test.sh

echo "🧪 Running Chronicle load tests..."

# Test API endpoints
echo "Testing API performance..."
ab -n 1000 -c 10 http://localhost:8510/health
ab -n 500 -c 5 http://localhost:8510/api/sessions

# Test WebSocket connections
echo "Testing WebSocket performance..."
python load_test_websockets.py --connections 50 --duration 60

# Test event processing
echo "Testing event processing..."
python load_test_events.py --events 1000 --rate 100
```

### Monitoring Integration

```python
# Prometheus metrics export
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Metrics
events_processed = Counter('chronicle_events_processed_total', 'Total events processed')
response_time = Histogram('chronicle_response_time_seconds', 'Response time')
memory_usage = Gauge('chronicle_memory_usage_bytes', 'Memory usage')
active_connections = Gauge('chronicle_connections_active', 'Active WebSocket connections')

# Export metrics
start_http_server(8511)  # Metrics on port 8511
```

## Troubleshooting Performance Issues

### Common Performance Problems

#### High CPU Usage

```bash
# Diagnose high CPU usage
top -p $(pgrep -f "main.py")
perf top -p $(pgrep -f "main.py")

# Check for inefficient queries
sqlite3 chronicle.db "EXPLAIN QUERY PLAN SELECT ..."
```

#### High Memory Usage

```bash
# Monitor memory patterns
ps -o pid,rss,vsz,comm -p $(pgrep -f "main.py")

# Check for memory leaks
valgrind --tool=massif python main.py
```

#### Slow Database Queries

```sql
-- Enable SQLite query logging
PRAGMA compile_options;  -- Check if ENABLE_SQLLOG is enabled

-- Analyze slow queries
EXPLAIN QUERY PLAN SELECT ...;
.timer on
SELECT ...;  -- Check execution time
```

### Performance Tuning Checklist

**Database:**
- [ ] WAL mode enabled for SQLite
- [ ] Proper indexes on query columns
- [ ] Regular ANALYZE and VACUUM
- [ ] Optimized cache settings

**Application:**
- [ ] Event batching implemented
- [ ] Memory cleanup at 80% threshold
- [ ] Connection pooling configured
- [ ] Rate limiting in place

**System:**
- [ ] Sufficient RAM allocated
- [ ] SSD storage for database
- [ ] Network bandwidth adequate
- [ ] OS-level tuning applied

**Monitoring:**
- [ ] Performance metrics collection
- [ ] Health check endpoints
- [ ] Alerting on thresholds
- [ ] Regular performance testing

## Advanced Optimizations

### Custom Event Filtering

```python
# Client-side event filtering to reduce network traffic
class EventFilter:
    def __init__(self):
        self.filters = {
            'session_ids': set(),
            'event_types': set(),
            'time_range': None
        }
    
    def should_send_event(self, event):
        # Apply filters before sending to reduce bandwidth
        if self.filters['session_ids'] and event['session_id'] not in self.filters['session_ids']:
            return False
            
        if self.filters['event_types'] and event['event_type'] not in self.filters['event_types']:
            return False
            
        return True
```

### Caching Strategies

```python
# Redis caching for frequently accessed data
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

async def get_session_with_cache(session_id):
    # Try cache first
    cached = redis_client.get(f"session:{session_id}")
    if cached:
        return json.loads(cached)
    
    # Fallback to database
    session = await database.get_session(session_id)
    
    # Cache for 5 minutes
    redis_client.setex(f"session:{session_id}", 300, json.dumps(session))
    
    return session
```

For additional performance optimizations and troubleshooting, see [troubleshooting.md](troubleshooting.md).