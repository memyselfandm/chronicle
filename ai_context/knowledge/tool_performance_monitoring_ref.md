# Tool Performance Monitoring Reference

## Overview

This reference guide covers comprehensive performance monitoring for tool operations, including execution time tracking, success rate monitoring, and analytics collection for AI tool observability systems.

## Core Performance Metrics

### Essential Metrics for Tool Monitoring

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import time
import statistics
from enum import Enum

class MetricType(Enum):
    EXECUTION_TIME = "execution_time"
    SUCCESS_RATE = "success_rate"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    MEMORY_USAGE = "memory_usage"
    CPU_USAGE = "cpu_usage"

@dataclass
class PerformanceMetrics:
    """Core performance metrics for tool execution"""
    tool_name: str
    execution_count: int = 0
    total_execution_time: float = 0.0
    successful_executions: int = 0
    failed_executions: int = 0
    execution_times: List[float] = field(default_factory=list)
    error_types: Dict[str, int] = field(default_factory=dict)
    memory_usage_mb: List[float] = field(default_factory=list)
    cpu_usage_percent: List[float] = field(default_factory=list)
    first_execution: Optional[datetime] = None
    last_execution: Optional[datetime] = None
    
    @property
    def average_execution_time(self) -> float:
        """Calculate average execution time"""
        return self.total_execution_time / self.execution_count if self.execution_count > 0 else 0.0
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage"""
        return (self.successful_executions / self.execution_count * 100) if self.execution_count > 0 else 0.0
    
    @property
    def error_rate(self) -> float:
        """Calculate error rate as percentage"""
        return (self.failed_executions / self.execution_count * 100) if self.execution_count > 0 else 0.0
    
    @property
    def p95_execution_time(self) -> float:
        """Calculate 95th percentile execution time"""
        if len(self.execution_times) == 0:
            return 0.0
        return statistics.quantiles(self.execution_times, n=20)[18]  # 95th percentile
    
    @property
    def p99_execution_time(self) -> float:
        """Calculate 99th percentile execution time"""
        if len(self.execution_times) == 0:
            return 0.0
        return statistics.quantiles(self.execution_times, n=100)[98]  # 99th percentile
```

## Execution Time Tracking

### High-Precision Timing

```python
import time
import threading
from contextlib import contextmanager
from typing import Generator, Dict, Callable, Any
import psutil
import os

class PerformanceTracker:
    """High-precision performance tracking for tool execution"""
    
    def __init__(self):
        self.metrics: Dict[str, PerformanceMetrics] = {}
        self._lock = threading.Lock()
        
    @contextmanager
    def track_execution(self, tool_name: str) -> Generator[Dict[str, Any], None, None]:
        """Context manager for tracking tool execution performance"""
        
        # Start timing and resource monitoring
        start_time = time.perf_counter()
        start_cpu_time = time.process_time()
        process = psutil.Process(os.getpid())
        start_memory = process.memory_info().rss / 1024 / 1024  # MB
        start_cpu_percent = process.cpu_percent()
        
        execution_context = {
            'tool_name': tool_name,
            'start_time': start_time,
            'start_memory_mb': start_memory
        }
        
        try:
            yield execution_context
            
            # Success metrics
            end_time = time.perf_counter()
            end_cpu_time = time.process_time()
            end_memory = process.memory_info().rss / 1024 / 1024  # MB
            end_cpu_percent = process.cpu_percent()
            
            execution_time = end_time - start_time
            cpu_time = end_cpu_time - start_cpu_time
            memory_delta = end_memory - start_memory
            
            self._record_success(tool_name, execution_time, end_memory, end_cpu_percent)
            
        except Exception as e:
            # Error metrics
            end_time = time.perf_counter()
            execution_time = end_time - start_time
            
            self._record_failure(tool_name, execution_time, str(e), type(e).__name__)
            raise
    
    def _record_success(self, tool_name: str, execution_time: float, memory_mb: float, cpu_percent: float):
        """Record successful execution metrics"""
        with self._lock:
            if tool_name not in self.metrics:
                self.metrics[tool_name] = PerformanceMetrics(tool_name=tool_name)
            
            metrics = self.metrics[tool_name]
            metrics.execution_count += 1
            metrics.successful_executions += 1
            metrics.total_execution_time += execution_time
            metrics.execution_times.append(execution_time)
            metrics.memory_usage_mb.append(memory_mb)
            metrics.cpu_usage_percent.append(cpu_percent)
            metrics.last_execution = datetime.now()
            
            if metrics.first_execution is None:
                metrics.first_execution = datetime.now()
            
            # Limit stored execution times to prevent memory growth
            if len(metrics.execution_times) > 1000:
                metrics.execution_times = metrics.execution_times[-500:]
            if len(metrics.memory_usage_mb) > 1000:
                metrics.memory_usage_mb = metrics.memory_usage_mb[-500:]
            if len(metrics.cpu_usage_percent) > 1000:
                metrics.cpu_usage_percent = metrics.cpu_usage_percent[-500:]
    
    def _record_failure(self, tool_name: str, execution_time: float, error_message: str, error_type: str):
        """Record failed execution metrics"""
        with self._lock:
            if tool_name not in self.metrics:
                self.metrics[tool_name] = PerformanceMetrics(tool_name=tool_name)
            
            metrics = self.metrics[tool_name]
            metrics.execution_count += 1
            metrics.failed_executions += 1
            metrics.total_execution_time += execution_time
            metrics.execution_times.append(execution_time)
            metrics.error_types[error_type] = metrics.error_types.get(error_type, 0) + 1
            metrics.last_execution = datetime.now()
            
            if metrics.first_execution is None:
                metrics.first_execution = datetime.now()
```

### Asynchronous Performance Tracking

```python
import asyncio
import aiofiles
from typing import AsyncGenerator
import json

class AsyncPerformanceTracker:
    """Asynchronous performance tracking for async tool execution"""
    
    def __init__(self):
        self.metrics: Dict[str, PerformanceMetrics] = {}
        self._lock = asyncio.Lock()
        
    async def track_async_execution(self, tool_name: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Async context manager for tracking tool execution performance"""
        
        start_time = time.perf_counter()
        loop = asyncio.get_event_loop()
        start_cpu_time = time.process_time()
        
        execution_context = {
            'tool_name': tool_name,
            'start_time': start_time,
            'loop': loop
        }
        
        try:
            yield execution_context
            
            end_time = time.perf_counter()
            execution_time = end_time - start_time
            
            await self._record_success_async(tool_name, execution_time)
            
        except Exception as e:
            end_time = time.perf_counter()
            execution_time = end_time - start_time
            
            await self._record_failure_async(tool_name, execution_time, str(e), type(e).__name__)
            raise
    
    async def _record_success_async(self, tool_name: str, execution_time: float):
        """Async version of success recording"""
        async with self._lock:
            if tool_name not in self.metrics:
                self.metrics[tool_name] = PerformanceMetrics(tool_name=tool_name)
            
            metrics = self.metrics[tool_name]
            metrics.execution_count += 1
            metrics.successful_executions += 1
            metrics.total_execution_time += execution_time
            metrics.execution_times.append(execution_time)
            metrics.last_execution = datetime.now()
    
    async def _record_failure_async(self, tool_name: str, execution_time: float, error_message: str, error_type: str):
        """Async version of failure recording"""
        async with self._lock:
            if tool_name not in self.metrics:
                self.metrics[tool_name] = PerformanceMetrics(tool_name=tool_name)
            
            metrics = self.metrics[tool_name]
            metrics.execution_count += 1
            metrics.failed_executions += 1
            metrics.total_execution_time += execution_time
            metrics.execution_times.append(execution_time)
            metrics.error_types[error_type] = metrics.error_types.get(error_type, 0) + 1
            metrics.last_execution = datetime.now()
```

## Success Rate Analytics

### Success Rate Calculation and Trending

```python
from collections import deque
from typing import Tuple, List
import numpy as np

class SuccessRateAnalyzer:
    """Analyze success rates with trending and anomaly detection"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.execution_history: Dict[str, deque] = {}
        
    def record_execution(self, tool_name: str, success: bool, timestamp: datetime):
        """Record a tool execution result"""
        if tool_name not in self.execution_history:
            self.execution_history[tool_name] = deque(maxlen=self.window_size)
        
        self.execution_history[tool_name].append({
            'success': success,
            'timestamp': timestamp
        })
    
    def get_success_rate(self, tool_name: str, time_window: Optional[timedelta] = None) -> float:
        """Calculate success rate for a tool within optional time window"""
        if tool_name not in self.execution_history:
            return 0.0
        
        executions = list(self.execution_history[tool_name])
        
        if time_window:
            cutoff_time = datetime.now() - time_window
            executions = [e for e in executions if e['timestamp'] >= cutoff_time]
        
        if not executions:
            return 0.0
        
        successful = sum(1 for e in executions if e['success'])
        return successful / len(executions) * 100
    
    def get_success_rate_trend(self, tool_name: str, bucket_size: int = 10) -> List[float]:
        """Calculate success rate trend over time buckets"""
        if tool_name not in self.execution_history:
            return []
        
        executions = list(self.execution_history[tool_name])
        trends = []
        
        for i in range(0, len(executions), bucket_size):
            bucket = executions[i:i + bucket_size]
            if bucket:
                successful = sum(1 for e in bucket if e['success'])
                rate = successful / len(bucket) * 100
                trends.append(rate)
        
        return trends
    
    def detect_success_rate_anomaly(self, tool_name: str, threshold: float = 10.0) -> bool:
        """Detect if current success rate is anomalous compared to historical average"""
        if tool_name not in self.execution_history:
            return False
        
        # Get recent success rate (last 10 executions)
        recent_rate = self.get_success_rate_with_count(tool_name, count=10)
        
        # Get historical average (excluding recent executions)
        historical_rate = self.get_historical_success_rate(tool_name, exclude_recent=10)
        
        if historical_rate is None:
            return False
        
        # Check if current rate deviates significantly from historical average
        return abs(recent_rate - historical_rate) > threshold
    
    def get_success_rate_with_count(self, tool_name: str, count: int) -> float:
        """Get success rate for the last N executions"""
        if tool_name not in self.execution_history:
            return 0.0
        
        executions = list(self.execution_history[tool_name])[-count:]
        if not executions:
            return 0.0
        
        successful = sum(1 for e in executions if e['success'])
        return successful / len(executions) * 100
    
    def get_historical_success_rate(self, tool_name: str, exclude_recent: int = 0) -> Optional[float]:
        """Get historical success rate excluding recent executions"""
        if tool_name not in self.execution_history:
            return None
        
        executions = list(self.execution_history[tool_name])
        if exclude_recent > 0:
            executions = executions[:-exclude_recent]
        
        if not executions:
            return None
        
        successful = sum(1 for e in executions if e['success'])
        return successful / len(executions) * 100
```

## Performance Analytics and Reporting

### Analytics Dashboard Data

```python
from dataclasses import asdict
import json
from typing import Any

class PerformanceAnalytics:
    """Generate analytics reports and dashboard data"""
    
    def __init__(self, tracker: PerformanceTracker):
        self.tracker = tracker
        
    def generate_summary_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance summary"""
        summary = {
            'total_tools': len(self.tracker.metrics),
            'overall_stats': self._calculate_overall_stats(),
            'top_performers': self._get_top_performers(),
            'performance_issues': self._identify_performance_issues(),
            'resource_usage': self._analyze_resource_usage(),
            'error_analysis': self._analyze_errors(),
            'generated_at': datetime.now().isoformat()
        }
        
        return summary
    
    def _calculate_overall_stats(self) -> Dict[str, Any]:
        """Calculate overall performance statistics"""
        all_metrics = list(self.tracker.metrics.values())
        
        if not all_metrics:
            return {}
        
        total_executions = sum(m.execution_count for m in all_metrics)
        total_successful = sum(m.successful_executions for m in all_metrics)
        total_failures = sum(m.failed_executions for m in all_metrics)
        all_execution_times = []
        
        for m in all_metrics:
            all_execution_times.extend(m.execution_times)
        
        return {
            'total_executions': total_executions,
            'overall_success_rate': (total_successful / total_executions * 100) if total_executions > 0 else 0,
            'overall_error_rate': (total_failures / total_executions * 100) if total_executions > 0 else 0,
            'average_execution_time': statistics.mean(all_execution_times) if all_execution_times else 0,
            'p95_execution_time': statistics.quantiles(all_execution_times, n=20)[18] if len(all_execution_times) > 1 else 0,
            'p99_execution_time': statistics.quantiles(all_execution_times, n=100)[98] if len(all_execution_times) > 1 else 0
        }
    
    def _get_top_performers(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get top performing tools by various metrics"""
        metrics_list = list(self.tracker.metrics.values())
        
        # Sort by success rate (high to low)
        by_success_rate = sorted(metrics_list, key=lambda m: m.success_rate, reverse=True)[:limit]
        
        # Sort by average execution time (low to high)
        by_speed = sorted(metrics_list, key=lambda m: m.average_execution_time)[:limit]
        
        # Sort by execution count (high to low)
        by_usage = sorted(metrics_list, key=lambda m: m.execution_count, reverse=True)[:limit]
        
        return {
            'highest_success_rate': [self._serialize_metrics(m) for m in by_success_rate],
            'fastest_execution': [self._serialize_metrics(m) for m in by_speed],
            'most_used': [self._serialize_metrics(m) for m in by_usage]
        }
    
    def _identify_performance_issues(self) -> List[Dict[str, Any]]:
        """Identify tools with performance issues"""
        issues = []
        
        for tool_name, metrics in self.tracker.metrics.items():
            tool_issues = []
            
            # Check for low success rate
            if metrics.success_rate < 80:
                tool_issues.append({
                    'type': 'low_success_rate',
                    'value': metrics.success_rate,
                    'severity': 'high' if metrics.success_rate < 50 else 'medium'
                })
            
            # Check for slow execution
            if metrics.average_execution_time > 5.0:  # 5 seconds
                tool_issues.append({
                    'type': 'slow_execution',
                    'value': metrics.average_execution_time,
                    'severity': 'high' if metrics.average_execution_time > 10.0 else 'medium'
                })
            
            # Check for high error rate
            if metrics.error_rate > 20:
                tool_issues.append({
                    'type': 'high_error_rate',
                    'value': metrics.error_rate,
                    'severity': 'high' if metrics.error_rate > 50 else 'medium'
                })
            
            if tool_issues:
                issues.append({
                    'tool_name': tool_name,
                    'issues': tool_issues,
                    'execution_count': metrics.execution_count
                })
        
        return sorted(issues, key=lambda x: len(x['issues']), reverse=True)
    
    def _analyze_resource_usage(self) -> Dict[str, Any]:
        """Analyze resource usage patterns"""
        all_memory = []
        all_cpu = []
        
        for metrics in self.tracker.metrics.values():
            all_memory.extend(metrics.memory_usage_mb)
            all_cpu.extend(metrics.cpu_usage_percent)
        
        if not all_memory or not all_cpu:
            return {}
        
        return {
            'memory_usage': {
                'average_mb': statistics.mean(all_memory),
                'peak_mb': max(all_memory),
                'p95_mb': statistics.quantiles(all_memory, n=20)[18] if len(all_memory) > 1 else 0
            },
            'cpu_usage': {
                'average_percent': statistics.mean(all_cpu),
                'peak_percent': max(all_cpu),
                'p95_percent': statistics.quantiles(all_cpu, n=20)[18] if len(all_cpu) > 1 else 0
            }
        }
    
    def _analyze_errors(self) -> Dict[str, Any]:
        """Analyze error patterns across all tools"""
        error_types = {}
        total_errors = 0
        
        for metrics in self.tracker.metrics.values():
            for error_type, count in metrics.error_types.items():
                error_types[error_type] = error_types.get(error_type, 0) + count
                total_errors += count
        
        if not error_types:
            return {}
        
        # Calculate percentages
        error_percentages = {
            error_type: (count / total_errors * 100)
            for error_type, count in error_types.items()
        }
        
        return {
            'total_errors': total_errors,
            'most_common_errors': sorted(error_types.items(), key=lambda x: x[1], reverse=True)[:5],
            'error_distribution': error_percentages
        }
    
    def _serialize_metrics(self, metrics: PerformanceMetrics) -> Dict[str, Any]:
        """Convert metrics to serializable format"""
        return {
            'tool_name': metrics.tool_name,
            'execution_count': metrics.execution_count,
            'success_rate': metrics.success_rate,
            'average_execution_time': metrics.average_execution_time,
            'p95_execution_time': metrics.p95_execution_time,
            'error_rate': metrics.error_rate
        }
    
    def export_metrics_csv(self, filename: str):
        """Export metrics to CSV format"""
        import csv
        
        with open(filename, 'w', newline='') as csvfile:
            fieldnames = [
                'tool_name', 'execution_count', 'successful_executions', 
                'failed_executions', 'average_execution_time', 'success_rate',
                'error_rate', 'p95_execution_time', 'p99_execution_time'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for metrics in self.tracker.metrics.values():
                writer.writerow({
                    'tool_name': metrics.tool_name,
                    'execution_count': metrics.execution_count,
                    'successful_executions': metrics.successful_executions,
                    'failed_executions': metrics.failed_executions,
                    'average_execution_time': metrics.average_execution_time,
                    'success_rate': metrics.success_rate,
                    'error_rate': metrics.error_rate,
                    'p95_execution_time': metrics.p95_execution_time,
                    'p99_execution_time': metrics.p99_execution_time
                })
```

## Real-Time Monitoring Integration

### Streaming Metrics

```python
import asyncio
from typing import AsyncIterator
import json

class RealTimeMonitor:
    """Real-time performance monitoring with streaming capabilities"""
    
    def __init__(self, tracker: PerformanceTracker):
        self.tracker = tracker
        self.subscribers: List[Callable] = []
        self.monitoring_active = False
        
    def subscribe(self, callback: Callable[[Dict[str, Any]], None]):
        """Subscribe to real-time performance updates"""
        self.subscribers.append(callback)
    
    async def start_monitoring(self, interval: float = 1.0):
        """Start real-time monitoring with specified interval"""
        self.monitoring_active = True
        
        while self.monitoring_active:
            try:
                # Collect current metrics snapshot
                snapshot = self._create_metrics_snapshot()
                
                # Send to all subscribers
                for callback in self.subscribers:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(snapshot)
                        else:
                            callback(snapshot)
                    except Exception as e:
                        print(f"Error in subscriber callback: {e}")
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                print(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """Stop real-time monitoring"""
        self.monitoring_active = False
    
    def _create_metrics_snapshot(self) -> Dict[str, Any]:
        """Create a snapshot of current metrics"""
        return {
            'timestamp': datetime.now().isoformat(),
            'tools': {
                tool_name: {
                    'execution_count': metrics.execution_count,
                    'success_rate': metrics.success_rate,
                    'average_execution_time': metrics.average_execution_time,
                    'recent_executions': len([
                        t for t in metrics.execution_times[-10:] 
                        if t is not None
                    ])
                }
                for tool_name, metrics in self.tracker.metrics.items()
            },
            'system_stats': self._get_system_stats()
        }
    
    def _get_system_stats(self) -> Dict[str, Any]:
        """Get current system performance stats"""
        process = psutil.Process(os.getpid())
        
        return {
            'memory_usage_mb': process.memory_info().rss / 1024 / 1024,
            'cpu_percent': process.cpu_percent(),
            'active_tools': len(self.tracker.metrics),
            'total_executions': sum(m.execution_count for m in self.tracker.metrics.values())
        }
```

## Integration Example

### Complete Monitoring Setup

```python
# Complete setup for tool performance monitoring
class ToolMonitoringSystem:
    """Complete tool monitoring system"""
    
    def __init__(self):
        self.tracker = PerformanceTracker()
        self.async_tracker = AsyncPerformanceTracker()
        self.success_analyzer = SuccessRateAnalyzer()
        self.analytics = PerformanceAnalytics(self.tracker)
        self.real_time_monitor = RealTimeMonitor(self.tracker)
        
    def monitor_tool(self, tool_name: str):
        """Decorator for monitoring tool performance"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                with self.tracker.track_execution(tool_name) as context:
                    try:
                        result = func(*args, **kwargs)
                        self.success_analyzer.record_execution(tool_name, True, datetime.now())
                        return result
                    except Exception as e:
                        self.success_analyzer.record_execution(tool_name, False, datetime.now())
                        raise
            return wrapper
        return decorator
    
    def monitor_async_tool(self, tool_name: str):
        """Decorator for monitoring async tool performance"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                async with self.async_tracker.track_async_execution(tool_name) as context:
                    try:
                        result = await func(*args, **kwargs)
                        self.success_analyzer.record_execution(tool_name, True, datetime.now())
                        return result
                    except Exception as e:
                        self.success_analyzer.record_execution(tool_name, False, datetime.now())
                        raise
            return wrapper
        return decorator
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get complete dashboard data"""
        return self.analytics.generate_summary_report()
    
    def start_real_time_monitoring(self, interval: float = 1.0):
        """Start real-time monitoring"""
        return asyncio.create_task(self.real_time_monitor.start_monitoring(interval))

# Usage example
monitoring_system = ToolMonitoringSystem()

@monitoring_system.monitor_tool("file_reader")
def read_file(filepath: str) -> str:
    with open(filepath, 'r') as f:
        return f.read()

@monitoring_system.monitor_async_tool("api_client")
async def fetch_data(url: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

This comprehensive reference provides all the necessary components for implementing robust tool performance monitoring with execution time tracking, success rate analytics, and real-time monitoring capabilities.