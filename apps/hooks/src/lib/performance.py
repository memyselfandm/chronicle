"""
Performance monitoring and optimization utilities for Chronicle hooks.

This module provides comprehensive performance measurement, profiling, and
optimization tools to ensure all hooks complete within the 100ms requirement.
"""

import time
import asyncio
import functools
import threading
from contextlib import contextmanager, asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable, Union, AsyncGenerator, Generator
import logging
import psutil
import uuid
import json
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics container with timing and resource data."""
    operation_name: str
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    memory_start_mb: Optional[float] = None
    memory_end_mb: Optional[float] = None
    memory_peak_mb: Optional[float] = None
    cpu_percent: Optional[float] = None
    thread_id: Optional[int] = None
    process_id: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialize computed fields."""
        self.thread_id = threading.get_ident()
        self.process_id = psutil.Process().pid
    
    def complete(self, end_time: Optional[float] = None) -> None:
        """Mark the operation as complete and calculate duration."""
        self.end_time = end_time or time.time()
        if self.start_time:
            self.duration_ms = (self.end_time - self.start_time) * 1000
    
    def add_metadata(self, **kwargs) -> None:
        """Add metadata to the metrics."""
        self.metadata.update(kwargs)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for logging/storage."""
        return {
            "operation_name": self.operation_name,
            "duration_ms": self.duration_ms,
            "memory_start_mb": self.memory_start_mb,
            "memory_end_mb": self.memory_end_mb,
            "memory_peak_mb": self.memory_peak_mb,
            "cpu_percent": self.cpu_percent,
            "thread_id": self.thread_id,
            "process_id": self.process_id,
            "timestamp": self.start_time,
            "metadata": self.metadata
        }


class PerformanceTimer:
    """High-precision timer with memory monitoring."""
    
    def __init__(self, operation_name: str, track_memory: bool = True):
        self.metrics = PerformanceMetrics(
            operation_name=operation_name,
            start_time=time.perf_counter()
        )
        self.track_memory = track_memory
        self.process = psutil.Process() if track_memory else None
        
        if self.track_memory:
            self.metrics.memory_start_mb = self.process.memory_info().rss / 1024 / 1024
            self.metrics.cpu_percent = self.process.cpu_percent()
    
    def __enter__(self):
        return self.metrics
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.complete()
    
    def complete(self) -> PerformanceMetrics:
        """Complete timing and return metrics."""
        end_time = time.perf_counter()
        self.metrics.complete(end_time)
        
        if self.track_memory and self.process:
            self.metrics.memory_end_mb = self.process.memory_info().rss / 1024 / 1024
            # Note: memory_peak_mb would require continuous monitoring
        
        return self.metrics


class AsyncPerformanceTimer:
    """Async version of performance timer."""
    
    def __init__(self, operation_name: str, track_memory: bool = True):
        self.metrics = PerformanceMetrics(
            operation_name=operation_name,
            start_time=time.perf_counter()
        )
        self.track_memory = track_memory
        self.process = psutil.Process() if track_memory else None
        
        if self.track_memory:
            self.metrics.memory_start_mb = self.process.memory_info().rss / 1024 / 1024
    
    async def __aenter__(self):
        return self.metrics
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.complete()
    
    async def complete(self) -> PerformanceMetrics:
        """Complete timing and return metrics."""
        end_time = time.perf_counter()
        self.metrics.complete(end_time)
        
        if self.track_memory and self.process:
            self.metrics.memory_end_mb = self.process.memory_info().rss / 1024 / 1024
        
        return self.metrics


class PerformanceCollector:
    """Centralized performance metrics collector."""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.metrics_history: deque = deque(maxlen=max_history)
        self.operation_stats: Dict[str, List[float]] = defaultdict(list)
        self.threshold_violations: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        
        # Performance thresholds
        self.thresholds = {
            "hook_execution_ms": 100.0,      # Claude Code compatibility requirement
            "database_operation_ms": 50.0,   # Database operation threshold  
            "validation_ms": 5.0,            # Security validation threshold
            "memory_growth_mb": 10.0,         # Memory growth threshold
        }
    
    def record_metrics(self, metrics: PerformanceMetrics) -> None:
        """Record performance metrics."""
        with self.lock:
            self.metrics_history.append(metrics)
            if metrics.duration_ms is not None:
                self.operation_stats[metrics.operation_name].append(metrics.duration_ms)
                
                # Check for threshold violations
                self._check_thresholds(metrics)
    
    def _check_thresholds(self, metrics: PerformanceMetrics) -> None:
        """Check if metrics violate performance thresholds."""
        violations = []
        
        if metrics.duration_ms and metrics.duration_ms > self.thresholds["hook_execution_ms"]:
            violations.append({
                "type": "duration_exceeded",
                "operation": metrics.operation_name,
                "actual_ms": metrics.duration_ms,
                "threshold_ms": self.thresholds["hook_execution_ms"],
                "timestamp": metrics.start_time
            })
        
        if (metrics.memory_start_mb and metrics.memory_end_mb and 
            (metrics.memory_end_mb - metrics.memory_start_mb) > self.thresholds["memory_growth_mb"]):
            violations.append({
                "type": "memory_growth_exceeded",
                "operation": metrics.operation_name,
                "growth_mb": metrics.memory_end_mb - metrics.memory_start_mb,
                "threshold_mb": self.thresholds["memory_growth_mb"],
                "timestamp": metrics.start_time
            })
        
        for violation in violations:
            self.threshold_violations.append(violation)
            logger.warning(f"Performance threshold violation: {violation}")
    
    def get_statistics(self, operation_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance statistics."""
        with self.lock:
            if operation_name and operation_name in self.operation_stats:
                durations = self.operation_stats[operation_name]
                stats = {
                    "operation": operation_name,
                    "count": len(durations),
                    "avg_ms": sum(durations) / len(durations) if durations else 0,
                    "min_ms": min(durations) if durations else 0,
                    "max_ms": max(durations) if durations else 0,
                    "p95_ms": self._percentile(durations, 95) if durations else 0,
                    "p99_ms": self._percentile(durations, 99) if durations else 0
                }
            else:
                all_durations = []
                for durations in self.operation_stats.values():
                    all_durations.extend(durations)
                
                stats = {
                    "total_operations": len(all_durations),
                    "avg_ms": sum(all_durations) / len(all_durations) if all_durations else 0,
                    "operations": {
                        name: {
                            "count": len(durations),
                            "avg_ms": sum(durations) / len(durations) if durations else 0,
                            "max_ms": max(durations) if durations else 0
                        }
                        for name, durations in self.operation_stats.items()
                    },
                    "violations": len(self.threshold_violations),
                    "recent_violations": self.threshold_violations[-5:] if self.threshold_violations else []
                }
            
            return stats
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of data."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int((percentile / 100.0) * len(sorted_data))
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def reset_stats(self) -> None:
        """Reset collected statistics."""
        with self.lock:
            self.operation_stats.clear()
            self.threshold_violations.clear()
            self.metrics_history.clear()


# Global performance collector instance
_performance_collector = PerformanceCollector()


def get_performance_collector() -> PerformanceCollector:
    """Get the global performance collector instance."""
    return _performance_collector


@contextmanager
def measure_performance(operation_name: str, track_memory: bool = True) -> Generator[PerformanceMetrics, None, None]:
    """Context manager for measuring operation performance."""
    timer = PerformanceTimer(operation_name, track_memory)
    try:
        yield timer.metrics
    finally:
        metrics = timer.complete()
        _performance_collector.record_metrics(metrics)


@asynccontextmanager
async def measure_async_performance(operation_name: str, track_memory: bool = True) -> AsyncGenerator[PerformanceMetrics, None]:
    """Async context manager for measuring operation performance."""
    timer = AsyncPerformanceTimer(operation_name, track_memory)
    try:
        yield timer.metrics
    finally:
        metrics = await timer.complete()
        _performance_collector.record_metrics(metrics)


def performance_monitor(operation_name: Optional[str] = None, track_memory: bool = True):
    """Decorator for monitoring function performance."""
    def decorator(func):
        actual_operation_name = operation_name or f"{func.__module__}.{func.__name__}"
        
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                async with measure_async_performance(actual_operation_name, track_memory) as metrics:
                    result = await func(*args, **kwargs)
                    if hasattr(result, '__len__'):
                        metrics.add_metadata(result_size=len(result))
                    return result
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                with measure_performance(actual_operation_name, track_memory) as metrics:
                    result = func(*args, **kwargs)
                    if hasattr(result, '__len__'):
                        metrics.add_metadata(result_size=len(result))
                    return result
            return sync_wrapper
    return decorator


class CacheManager:
    """Simple caching manager for frequently accessed data."""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 300):
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
            
            self.access_times[key] = time.time()  # Update access time
            return self.cache[key]['value']
    
    def set(self, key: str, value: Any) -> None:
        """Set cached value with automatic eviction."""
        with self.lock:
            # Evict expired entries
            self._cleanup_expired()
            
            # Evict LRU if at capacity
            if len(self.cache) >= self.max_size and key not in self.cache:
                lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
                self._evict(lru_key)
            
            self.cache[key] = {'value': value, 'created_at': time.time()}
            self.access_times[key] = time.time()
    
    def _evict(self, key: str) -> None:
        """Evict a key from cache."""
        if key in self.cache:
            del self.cache[key]
        if key in self.access_times:
            del self.access_times[key]
    
    def _cleanup_expired(self) -> None:
        """Remove expired entries."""
        current_time = time.time()
        expired_keys = [
            key for key, access_time in self.access_times.items()
            if current_time - access_time > self.ttl_seconds
        ]
        for key in expired_keys:
            self._evict(key)
    
    def clear(self) -> None:
        """Clear all cached data."""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self.lock:
            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "ttl_seconds": self.ttl_seconds,
                "hit_ratio": 0.0  # Would need hit/miss counters for accurate calculation
            }


class EarlyReturnValidator:
    """Validator that enables early returns for common failure cases."""
    
    @staticmethod
    def is_valid_session_id(session_id: Optional[str]) -> bool:
        """Quick validation for session ID format."""
        if not session_id or not isinstance(session_id, str):
            return False
        # Basic format checks - UUID or reasonable session ID format
        if len(session_id) < 8 or len(session_id) > 100:
            return False
        return True
    
    @staticmethod
    def is_valid_hook_event(event_name: Optional[str]) -> bool:
        """Quick validation for hook event name."""
        if not event_name or not isinstance(event_name, str):
            return False
        valid_events = {
            'SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
            'PreCompact', 'Notification', 'Stop', 'SubagentStop',
            'session_start', 'pre_tool_use', 'post_tool_use', 'user_prompt_submit',
            'pre_compact', 'notification', 'stop', 'subagent_stop'
        }
        return event_name in valid_events
    
    @staticmethod
    def has_required_fields(data: Dict[str, Any], required_fields: List[str]) -> bool:
        """Quick check for required fields presence."""
        if not isinstance(data, dict):
            return False
        return all(field in data and data[field] is not None for field in required_fields)
    
    @staticmethod
    def is_reasonable_data_size(data: Any, max_size_mb: float = 10.0) -> bool:
        """Quick check for reasonable data size."""
        try:
            data_str = json.dumps(data) if not isinstance(data, str) else data
            size_mb = len(data_str.encode('utf-8')) / 1024 / 1024
            return size_mb <= max_size_mb
        except (TypeError, ValueError):
            # If we can't serialize it, it might be too complex
            return False


# Global cache instance for hook operations
_hook_cache = CacheManager(max_size=200, ttl_seconds=300)


def get_hook_cache() -> CacheManager:
    """Get the global hook cache instance."""
    return _hook_cache


class PerformanceOptimizer:
    """Main performance optimization coordinator."""
    
    def __init__(self):
        self.collector = get_performance_collector()
        self.cache = get_hook_cache()
        self.validator = EarlyReturnValidator()
    
    def optimize_hook_execution(self, hook_func: Callable) -> Callable:
        """Apply performance optimizations to hook execution."""
        @functools.wraps(hook_func)
        def optimized_wrapper(*args, **kwargs):
            with measure_performance(f"hook.{hook_func.__name__}") as metrics:
                # Quick validation checks for early returns
                if args and isinstance(args[0], dict):
                    input_data = args[0]
                    
                    # Early return for invalid data
                    if not self.validator.is_reasonable_data_size(input_data):
                        logger.warning("Hook input data size exceeds limits - early return")
                        metrics.add_metadata(early_return=True, reason="data_size_exceeded")
                        return {"continue": True, "suppressOutput": True, "error": "Input too large"}
                    
                    # Cache check for repeated operations
                    cache_key = self._generate_cache_key(hook_func.__name__, input_data)
                    cached_result = self.cache.get(cache_key)
                    if cached_result:
                        metrics.add_metadata(cache_hit=True)
                        return cached_result
                
                # Execute actual function
                result = hook_func(*args, **kwargs)
                
                # Cache successful results
                if args and isinstance(args[0], dict) and isinstance(result, dict):
                    if result.get("continue", True):  # Only cache successful results
                        cache_key = self._generate_cache_key(hook_func.__name__, args[0])
                        self.cache.set(cache_key, result)
                        metrics.add_metadata(cached=True)
                
                return result
        
        return optimized_wrapper
    
    def _generate_cache_key(self, func_name: str, input_data: Dict[str, Any]) -> str:
        """Generate cache key for hook input."""
        # Create stable key from essential fields only
        key_data = {
            "func": func_name,
            "hook_event": input_data.get("hookEventName", "unknown"),
            "session_id": input_data.get("sessionId", "")[:8],  # First 8 chars only
        }
        
        # Add tool-specific info if present
        if "toolName" in input_data:
            key_data["tool"] = input_data["toolName"]
        
        return f"hook:{json.dumps(key_data, sort_keys=True)}"
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        stats = self.collector.get_statistics()
        cache_stats = self.cache.stats()
        
        return {
            "performance_stats": stats,
            "cache_stats": cache_stats,
            "thresholds": self.collector.thresholds,
            "optimization_recommendations": self._generate_recommendations(stats)
        }
    
    def _generate_recommendations(self, stats: Dict[str, Any]) -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []
        
        if stats.get("avg_ms", 0) > 50:
            recommendations.append("Consider enabling caching for frequently called operations")
        
        if stats.get("violations", 0) > 0:
            recommendations.append("Review operations that exceed performance thresholds")
        
        operations = stats.get("operations", {})
        slow_ops = [name for name, op_stats in operations.items() if op_stats.get("avg_ms", 0) > 75]
        if slow_ops:
            recommendations.append(f"Optimize slow operations: {', '.join(slow_ops)}")
        
        return recommendations


# Global performance optimizer
_performance_optimizer = PerformanceOptimizer()


def get_performance_optimizer() -> PerformanceOptimizer:
    """Get the global performance optimizer instance."""
    return _performance_optimizer