# Performance Optimization Guide for Chronicle Hooks

## Overview

This guide documents the performance optimization techniques implemented in Chronicle hooks to ensure all hooks complete within the 100ms Claude Code compatibility requirement.

## Performance Requirements

- **Primary Requirement**: All hooks must complete within 100ms
- **Security Validation**: < 5ms for input validation
- **Cache Operations**: < 1ms for cache lookup/store
- **Database Operations**: < 50ms per operation
- **Memory Growth**: < 5MB per hook execution

## Key Optimizations Implemented

### 1. Early Validation and Return Paths

**Location**: `src/core/base_hook.py` - `_fast_validation_check()`

```python
def _fast_validation_check(self, input_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Perform fast validation checks for early return scenarios."""
    # Basic structure validation
    if not isinstance(input_data, dict):
        return (False, "Input data must be a dictionary")
    
    # Hook event validation
    hook_event = input_data.get("hookEventName")
    if not self.early_validator.is_valid_hook_event(hook_event):
        return (False, f"Invalid hookEventName: {hook_event}")
    
    # Size validation
    if not self.early_validator.is_reasonable_data_size(input_data):
        return (False, "Input data exceeds size limits")
    
    return (True, None)
```

**Benefits**:
- Rejects invalid input in <1ms
- Prevents expensive processing for bad data
- Provides clear error messages

### 2. Comprehensive Caching System

**Location**: `src/core/performance.py` - `CacheManager`

```python
class CacheManager:
    """Simple caching manager for frequently accessed data."""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache = {}
        self.access_times = {}
```

**Cached Data**:
- Processed hook input data
- Project context information
- Security validation results
- Database query results (session lookups)

**Cache Strategy**:
- LRU eviction with TTL
- Thread-safe operations
- Automatic cleanup of expired entries

### 3. Async Database Operations

**Location**: `src/core/database.py`

#### Connection Pooling
```python
class SQLiteClient:
    def __init__(self):
        # Connection pool for better async performance
        self._connection_pool_size = 5
        self._connection_semaphore = None
```

#### Batch Operations
```python
async def batch_insert_events_async(self, events: List[Dict[str, Any]]) -> int:
    """Async batch insert for multiple events with better performance."""
    # Process events in batches to improve throughput
    batch_size = 10
    # Use executemany for efficient batch inserts
    await conn.executemany(insert_query, event_rows)
```

### 4. Performance Monitoring and Metrics

**Location**: `src/core/performance.py` - `PerformanceCollector`

#### Key Metrics Tracked
- Execution time per operation
- Memory usage and growth
- Cache hit/miss ratios
- Database operation latency
- Threshold violations

#### Performance Decorators
```python
@performance_monitor("hook.process_data", track_memory=True)
def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
    # Automatic performance tracking with memory monitoring
```

### 5. Optimized Execution Pipeline

**Location**: `src/core/base_hook.py` - `execute_hook_optimized()`

#### Execution Flow
1. **Fast Validation** (target: <1ms)
2. **Cache Check** (target: <1ms) 
3. **Security Validation** (target: <5ms)
4. **Hook Execution** (target: <80ms)
5. **Result Caching** (target: <1ms)

```python
@performance_monitor("hook.execute_optimized")
def execute_hook_optimized(self, input_data: Dict[str, Any], hook_func: Callable) -> Dict[str, Any]:
    """Execute hook with full performance optimization pipeline."""
    
    # Step 1: Fast validation (target: <1ms)
    is_valid, error_message = self._fast_validation_check(input_data)
    if not is_valid:
        return self._create_early_return_response(error_message)
    
    # Step 2: Check cache (target: <1ms)
    cache_key = self._generate_input_cache_key(input_data)
    cached_result = self.hook_cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Continue with processing...
```

## Performance Testing

### Test Suite Location
`tests/test_performance_optimization.py`

### Key Test Categories

1. **Individual Component Performance**
   - Fast validation timing
   - Cache operation speed
   - Database query performance

2. **End-to-End Hook Performance**
   - Complete hook execution under 100ms
   - Memory usage validation
   - Concurrent execution testing

3. **Load Testing**
   - Multiple concurrent hooks
   - Large payload handling
   - Sustained operation testing

4. **Regression Detection**
   - Performance baseline establishment
   - Automatic regression detection
   - Statistical significance testing

### Running Performance Tests

```bash
# Run all performance tests
pytest tests/test_performance_optimization.py -v

# Run specific performance test
pytest tests/test_performance_optimization.py::TestPerformanceRequirements::test_session_start_hook_performance -v

# Run with performance output
pytest tests/test_performance_optimization.py -s
```

## Performance Monitoring in Production

### Getting Performance Metrics

```python
# From a hook instance
hook = BaseHook()
metrics = hook.get_performance_metrics()

# Access global collector
from core.performance import get_performance_collector
collector = get_performance_collector()
stats = collector.get_statistics()
```

### Sample Metrics Output

```json
{
  "performance_stats": {
    "total_operations": 156,
    "avg_ms": 23.4,
    "operations": {
      "hook.execute_optimized": {
        "count": 45,
        "avg_ms": 18.7,
        "max_ms": 87.3
      },
      "security_validation": {
        "count": 45,
        "avg_ms": 2.1,
        "max_ms": 4.8
      }
    },
    "violations": 0,
    "recent_violations": []
  },
  "cache_stats": {
    "size": 23,
    "max_size": 100,
    "hit_ratio": 0.67
  },
  "thresholds": {
    "hook_execution_ms": 100.0,
    "security_validation_ms": 5.0
  }
}
```

## Best Practices for Hook Developers

### 1. Use Performance Decorators

```python
@performance_monitor("my_hook.custom_operation")
def my_custom_function(self, data):
    # Function automatically gets performance tracking
    return result
```

### 2. Leverage Caching

```python
# Cache expensive computations
cache_key = f"computation:{input_hash}"
result = self.hook_cache.get(cache_key)
if not result:
    result = expensive_computation(input_data)
    self.hook_cache.set(cache_key, result)
```

### 3. Use Early Returns

```python
# Validate early and return fast for invalid input
if not self.early_validator.is_valid_session_id(session_id):
    return self._create_early_return_response("Invalid session ID")
```

### 4. Monitor Performance

```python
# Use performance measurement contexts
with measure_performance("custom_operation") as metrics:
    result = do_work()
    metrics.add_metadata(items_processed=len(result))
```

### 5. Implement Async Where Beneficial

```python
# Use async database operations for non-blocking behavior
if self.db_manager:
    # Non-blocking event save
    asyncio.create_task(self.db_manager.save_event_async(event_data))
```

## Common Performance Anti-Patterns

### ❌ Don't: Synchronous Database in Critical Path

```python
# This blocks the hook execution
result = database.execute_slow_query()
return create_response(result)
```

### ✅ Do: Async or Cached Operations

```python
# Use async or cache the result
cached_result = self.cache.get("slow_query_result")
if not cached_result:
    # Run async or defer to background
    asyncio.create_task(update_cache_async())
return create_response(cached_result or default_value)
```

### ❌ Don't: Complex Processing Without Caching

```python
# Expensive operation on every call
def process_complex_data(self, data):
    # Complex parsing, validation, transformation...
    return processed_result
```

### ✅ Do: Cache Expensive Operations

```python
# Cache based on input characteristics
def process_complex_data(self, data):
    cache_key = self._generate_cache_key(data)
    result = self.hook_cache.get(cache_key)
    if not result:
        result = self._do_expensive_processing(data)
        self.hook_cache.set(cache_key, result)
    return result
```

## Troubleshooting Performance Issues

### 1. Identify Slow Operations

```python
# Check performance statistics
stats = hook.get_performance_metrics()
slow_operations = [
    name for name, op_stats in stats["performance_stats"]["operations"].items()
    if op_stats["avg_ms"] > 50
]
```

### 2. Check for Cache Misses

```python
cache_stats = hook.hook_cache.stats()
if cache_stats["hit_ratio"] < 0.5:
    print("Low cache hit ratio - consider optimizing cache keys")
```

### 3. Monitor Memory Growth

```python
# Look for memory leaks or excessive usage
if stats["performance_stats"].get("memory_growth_mb", 0) > 10:
    print("High memory growth detected")
```

### 4. Profile with Context Managers

```python
# Add temporary profiling for investigation
with measure_performance("debug.suspected_slow_operation") as metrics:
    result = suspected_slow_function()
    # Check metrics.duration_ms after execution
```

## Performance Targets Summary

| Operation | Target | Rationale |
|-----------|---------|-----------|
| Hook Execution | < 100ms | Claude Code requirement |
| Fast Validation | < 1ms | Early rejection of invalid data |
| Cache Operations | < 1ms | Should be nearly instant |
| Security Validation | < 5ms | Balance security vs performance |
| Database Operations | < 50ms | Reasonable DB latency |
| Memory Growth | < 5MB | Prevent memory leaks |

## Monitoring Dashboard

For production monitoring, consider implementing:

1. **Real-time Performance Metrics**
   - Average execution times
   - 95th percentile latency
   - Error rates

2. **Alerts**
   - Execution time > 100ms
   - Cache hit ratio < 50%
   - Memory growth > 10MB

3. **Historical Trends**
   - Performance over time
   - Regression detection
   - Usage patterns

## Future Optimizations

Potential areas for further optimization:

1. **Predictive Caching**: Pre-cache likely needed data
2. **Compression**: Compress cached data to save memory
3. **Connection Multiplexing**: Share database connections across hooks
4. **Background Processing**: Move non-critical operations to background tasks
5. **Native Extensions**: Use C extensions for performance-critical operations

---

*For questions about performance optimization or to report performance issues, please check the test suite and monitoring metrics first, then consult this documentation.*