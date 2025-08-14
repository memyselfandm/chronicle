"""
Consolidated Performance Monitoring for UV Single-File Scripts

Essential performance monitoring functionality consolidated into a minimal
module suitable for inlining into UV single-file scripts.

Key consolidations:
- Simplified timing measurement without complex metrics collection
- Removed memory monitoring to reduce psutil dependency 
- Basic caching functionality
- Essential performance decorators
- Minimal overhead tracking
"""

import time
import functools
import threading
from contextlib import contextmanager
from typing import Dict, Any, Optional, Callable, Generator
import json


class PerformanceTimer:
    """Simple timer for measuring execution time."""
    
    def __init__(self, operation_name: str = "operation"):
        self.operation_name = operation_name
        self.start_time = None
        self.end_time = None
        self.duration_ms = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration_ms = (self.end_time - self.start_time) * 1000
    
    def get_duration_ms(self) -> Optional[float]:
        """Get duration in milliseconds."""
        return self.duration_ms


class SimpleCache:
    """
    Basic caching for frequently accessed data.
    Designed for minimal overhead in single-file scripts.
    """
    
    def __init__(self, max_size: int = 50, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.access_times: Dict[str, float] = {}
        self.lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        with self.lock:
            if key not in self.cache:
                return None
            
            # Check TTL
            if time.time() - self.access_times[key] > self.ttl_seconds:
                self._evict(key)
                return None
            
            self.access_times[key] = time.time()
            return self.cache[key]['value']
    
    def set(self, key: str, value: Any) -> None:
        """Set cached value with automatic eviction."""
        with self.lock:
            # Simple LRU eviction if at capacity
            if len(self.cache) >= self.max_size and key not in self.cache:
                oldest_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
                self._evict(oldest_key)
            
            self.cache[key] = {'value': value, 'created_at': time.time()}
            self.access_times[key] = time.time()
    
    def _evict(self, key: str) -> None:
        """Remove key from cache."""
        self.cache.pop(key, None)
        self.access_times.pop(key, None)
    
    def clear(self) -> None:
        """Clear all cached data."""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
    
    def size(self) -> int:
        """Get current cache size."""
        return len(self.cache)


class PerformanceTracker:
    """
    Simple performance tracking for operations.
    Tracks timing without complex metrics collection.
    """
    
    def __init__(self):
        self.operation_times: Dict[str, list] = {}
        self.lock = threading.Lock()
        self.warning_threshold_ms = 100.0  # Claude Code compatibility requirement
    
    def record_operation(self, operation_name: str, duration_ms: float):
        """Record operation timing."""
        with self.lock:
            if operation_name not in self.operation_times:
                self.operation_times[operation_name] = []
            
            self.operation_times[operation_name].append(duration_ms)
            
            # Keep only last 10 measurements per operation to limit memory
            if len(self.operation_times[operation_name]) > 10:
                self.operation_times[operation_name] = self.operation_times[operation_name][-10:]
            
            # Log warning if over threshold
            if duration_ms > self.warning_threshold_ms:
                print(f"Warning: {operation_name} took {duration_ms:.2f}ms (exceeds {self.warning_threshold_ms}ms threshold)")
    
    def get_average_time(self, operation_name: str) -> float:
        """Get average time for operation."""
        with self.lock:
            times = self.operation_times.get(operation_name, [])
            return sum(times) / len(times) if times else 0.0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get basic performance statistics."""
        with self.lock:
            stats = {}
            for operation, times in self.operation_times.items():
                if times:
                    stats[operation] = {
                        "count": len(times),
                        "avg_ms": sum(times) / len(times),
                        "max_ms": max(times),
                        "min_ms": min(times),
                        "last_ms": times[-1]
                    }
            return stats
    
    def reset(self):
        """Reset all statistics."""
        with self.lock:
            self.operation_times.clear()


# Global instances
_global_cache = SimpleCache()
_global_tracker = PerformanceTracker()


@contextmanager
def measure_performance(operation_name: str) -> Generator[PerformanceTimer, None, None]:
    """Context manager for measuring operation performance."""
    timer = PerformanceTimer(operation_name)
    try:
        yield timer
    finally:
        if timer.duration_ms is not None:
            _global_tracker.record_operation(operation_name, timer.duration_ms)


def performance_monitor(operation_name: Optional[str] = None):
    """Decorator for monitoring function performance."""
    def decorator(func):
        actual_operation_name = operation_name or func.__name__
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000
                _global_tracker.record_operation(actual_operation_name, duration_ms)
        
        return wrapper
    return decorator


def quick_cache(key_func: Callable = None, ttl_seconds: int = 300):
    """
    Simple caching decorator.
    
    Args:
        key_func: Function to generate cache key from args
        ttl_seconds: Time to live for cached values
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Simple key based on function name and args
                cache_key = f"{func.__name__}:{hash(str(args)[:100])}"
            
            # Try cache first
            cached_result = _global_cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            _global_cache.set(cache_key, result)
            
            return result
        
        return wrapper
    return decorator


class EarlyReturnValidator:
    """Quick validation for early returns in performance-critical code."""
    
    @staticmethod
    def is_valid_session_id(session_id: Optional[str]) -> bool:
        """Quick session ID validation."""
        if not session_id or not isinstance(session_id, str):
            return False
        return 8 <= len(session_id) <= 100
    
    @staticmethod
    def is_valid_hook_event(event_name: Optional[str]) -> bool:
        """Quick hook event validation."""
        valid_events = {
            'SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
            'PreCompact', 'Notification', 'Stop', 'SubagentStop'
        }
        return event_name in valid_events if event_name else False
    
    @staticmethod
    def is_reasonable_data_size(data: Any, max_size_mb: float = 10.0) -> bool:
        """Quick data size check."""
        try:
            if isinstance(data, str):
                size_mb = len(data.encode('utf-8')) / 1024 / 1024
            else:
                data_str = json.dumps(data, default=str)
                size_mb = len(data_str.encode('utf-8')) / 1024 / 1024
            return size_mb <= max_size_mb
        except (TypeError, ValueError):
            return False


def check_performance_threshold(duration_ms: float, operation: str = "operation") -> bool:
    """Check if operation duration exceeds performance threshold."""
    threshold = 100.0  # Claude Code compatibility requirement
    if duration_ms > threshold:
        print(f"Performance warning: {operation} took {duration_ms:.2f}ms (threshold: {threshold}ms)")
        return False
    return True


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return {
        "size": _global_cache.size(),
        "max_size": _global_cache.max_size,
        "ttl_seconds": _global_cache.ttl_seconds
    }


def get_performance_stats() -> Dict[str, Any]:
    """Get performance statistics."""
    return _global_tracker.get_stats()


def reset_performance_tracking():
    """Reset all performance tracking."""
    _global_cache.clear()
    _global_tracker.reset()


# Factory functions
def create_cache(max_size: int = 50, ttl_seconds: int = 300) -> SimpleCache:
    """Create a new cache instance."""
    return SimpleCache(max_size, ttl_seconds)


def create_performance_tracker() -> PerformanceTracker:
    """Create a new performance tracker instance."""
    return PerformanceTracker()


# Utility function for inline timing
def time_it(func: Callable, *args, **kwargs) -> tuple:
    """
    Time a function execution and return (result, duration_ms).
    
    Returns:
        Tuple of (function_result, duration_in_milliseconds)
    """
    start_time = time.perf_counter()
    result = func(*args, **kwargs)
    duration_ms = (time.perf_counter() - start_time) * 1000
    return result, duration_ms