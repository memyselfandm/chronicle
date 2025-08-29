# Chronicle Server Performance Documentation

## Overview

This document details the performance optimizations implemented for Chronicle MVP (CHR-46) and provides guidance for performance testing and monitoring.

## Performance Targets (MVP)

Chronicle is designed to meet the following MVP performance requirements:

- **Event Processing Rate**: 100 events/second sustained
- **Memory Usage**: <100MB baseline 
- **Query Response Time**: <100ms for indexed queries
- **Database Performance**: Optimized with essential indexes

## Implementation Details

### Memory Management (CHR-46)

**Event Queue Optimization**:
- Reduced queue size from 10,000 to 1,000 events
- Implemented automatic cleanup at 800 events (80% capacity)
- Prevents unbounded memory growth during high-volume periods

**Memory Cleanup Logic**:
```python
# Triggered when queue reaches 800 events
if queue_size >= MEMORY_CLEANUP_THRESHOLD:
    # Remove oldest events to keep most recent 50%
    events_to_remove = queue_size - (EVENT_QUEUE_SIZE // 2)
    # Cleanup maintains real-time performance
```

### Database Indexes

Chronicle utilizes the following optimized indexes:

```sql
-- Essential performance indexes
CREATE INDEX idx_chronicle_events_session_id ON chronicle_events(session_id);
CREATE INDEX idx_chronicle_events_timestamp ON chronicle_events(timestamp DESC);
CREATE INDEX idx_chronicle_events_type ON chronicle_events(event_type);
CREATE INDEX idx_chronicle_events_session_timestamp ON chronicle_events(session_id, timestamp DESC);
```

## Performance Testing

### Automated Test Suite

Run the MVP performance test to validate all requirements:

```bash
cd apps/server
python test_performance_mvp.py
```

### Test Specifications

The performance test validates:

1. **Event Rate Test**: 1,000 events over 10 seconds (100 events/sec)
2. **Memory Usage Test**: Memory stays under 100MB throughout test
3. **Query Performance Test**: Indexed queries complete in <100ms
4. **Database Integrity**: All events successfully stored and retrievable

### Expected Test Results

```
Performance Results:
==================================================
Events sent: 1000
Duration: 10.00 seconds
Actual rate: 100.00 events/second
Target rate: 100 events/second
✅ Event rate test PASSED

Memory Usage:
  Average: 44.3MB
  Maximum: 51.2MB
  Limit: 100MB
✅ Memory usage test PASSED

Query Performance Test:
  Indexed query time: 2.82ms
  Events in database: 1000
✅ Query performance test PASSED

🎉 ALL MVP PERFORMANCE TESTS PASSED!
```

## Configuration

### Memory Settings

```python
# Configuration constants in websocket.py
EVENT_QUEUE_SIZE = 1000              # MVP: Reduced for memory management
MEMORY_CLEANUP_THRESHOLD = 800       # Cleanup when 80% full
LATENCY_TARGET_MS = 50.0            # Target broadcast latency
```

### Database Settings

```sql
-- SQLite performance optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

## Monitoring

### Key Metrics to Monitor

1. **Event Queue Size**: Should stay under 800 events
2. **Memory Usage**: Should remain under 100MB
3. **Query Response Times**: Should be <100ms for indexed queries
4. **Event Processing Rate**: Should sustain 100 events/second

### Performance Warnings

The system logs warnings when performance thresholds are exceeded:

```
Event queue at 825/1000, triggering cleanup
Broadcast latency exceeded target: 75.2ms > 50.0ms
```

## Troubleshooting

### High Memory Usage

If memory usage approaches 100MB:

1. Check event queue size in logs
2. Verify cleanup is triggering at 80% capacity
3. Consider reducing `EVENT_QUEUE_SIZE` if needed

### Slow Query Performance

If queries exceed 100ms:

1. Verify all indexes are created properly
2. Check SQLite PRAGMA settings
3. Consider VACUUM if database has grown large

### Low Event Processing Rate

If processing rate drops below 100 events/sec:

1. Check for performance warnings in logs
2. Monitor system resource usage (CPU, disk I/O)
3. Verify database connection is healthy

## Future Enhancements (Post-MVP)

The following optimizations are planned for future releases:

- **LRU Caching Layer**: For frequently accessed data (CHR-115)
- **Query Optimization**: Beyond basic indexes
- **Connection Pooling**: For high-concurrency scenarios
- **Support for 1000+ events/second**: Advanced performance tier

## Files

- `apps/server/websocket.py` - Main memory management implementation
- `apps/server/test_performance_mvp.py` - Automated performance validation
- `apps/server/database.py` - Database indexes and optimization