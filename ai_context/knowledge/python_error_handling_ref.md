# Python Error Handling Framework Reference

## Overview

This reference covers comprehensive error handling patterns for the Chronicle observability system, focusing on graceful degradation, retry logic, and maintaining system resilience. The framework ensures that hook failures don't impact the main Claude Code workflow.

## Core Error Handling Architecture

### 1. Exception Hierarchy

```python
from typing import Optional, Dict, Any, List
from enum import Enum
import traceback
from datetime import datetime

class ChronicleError(Exception):
    """Base exception for all Chronicle errors."""
    
    def __init__(self, message: str, error_code: str = None, 
                 context: Dict[str, Any] = None, cause: Exception = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.context = context or {}
        self.cause = cause
        self.timestamp = datetime.utcnow()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging/storage."""
        return {
            'error_type': self.__class__.__name__,
            'error_code': self.error_code,
            'message': self.message,
            'context': self.context,
            'timestamp': self.timestamp.isoformat(),
            'traceback': traceback.format_exc() if self.cause else None
        }

class DatabaseError(ChronicleError):
    """Database operation errors."""
    pass

class NetworkError(ChronicleError):
    """Network and connectivity errors."""
    pass

class ValidationError(ChronicleError):
    """Data validation errors."""
    pass

class ConfigurationError(ChronicleError):
    """Configuration and setup errors."""
    pass

class HookExecutionError(ChronicleError):
    """Hook execution errors."""
    pass

class SecurityError(ChronicleError):
    """Security and privacy violation errors."""
    pass

class ResourceError(ChronicleError):
    """Resource exhaustion or unavailability errors."""
    pass
```

### 2. Error Severity and Recovery Strategy

```python
class ErrorSeverity(Enum):
    """Error severity levels with recovery strategies."""
    
    LOW = "low"           # Log and continue
    MEDIUM = "medium"     # Retry with fallback
    HIGH = "high"         # Escalate but don't fail
    CRITICAL = "critical" # Immediate attention required

class RecoveryStrategy(Enum):
    """Recovery strategies for different error types."""
    
    IGNORE = "ignore"           # Log and continue
    RETRY = "retry"             # Retry with backoff
    FALLBACK = "fallback"       # Switch to alternative
    ESCALATE = "escalate"       # Notify administrators
    CIRCUIT_BREAK = "circuit_break"  # Temporary disable

class ErrorClassification:
    """Classify errors by severity and recovery strategy."""
    
    ERROR_MAPPING = {
        # Database errors
        'ConnectionError': (ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
        'DatabaseError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
        'TimeoutError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
        
        # Network errors
        'NetworkError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
        'SSLError': (ErrorSeverity.HIGH, RecoveryStrategy.ESCALATE),
        
        # Validation errors
        'ValidationError': (ErrorSeverity.LOW, RecoveryStrategy.IGNORE),
        'TypeError': (ErrorSeverity.MEDIUM, RecoveryStrategy.IGNORE),
        
        # Security errors
        'SecurityError': (ErrorSeverity.CRITICAL, RecoveryStrategy.ESCALATE),
        'PermissionError': (ErrorSeverity.HIGH, RecoveryStrategy.ESCALATE),
        
        # Resource errors
        'MemoryError': (ErrorSeverity.CRITICAL, RecoveryStrategy.CIRCUIT_BREAK),
        'ResourceError': (ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
    }
    
    @classmethod
    def classify(cls, error: Exception) -> tuple[ErrorSeverity, RecoveryStrategy]:
        """Classify error and determine recovery strategy."""
        error_name = error.__class__.__name__
        return cls.ERROR_MAPPING.get(error_name, 
                                   (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY))
```

### 3. Retry Logic Framework

```python
import asyncio
import random
from functools import wraps
from typing import Callable, Type, Union, Tuple

class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(self, 
                 max_attempts: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 exponential_base: float = 2.0,
                 jitter: bool = True,
                 backoff_strategy: str = "exponential"):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.backoff_strategy = backoff_strategy
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number."""
        if self.backoff_strategy == "exponential":
            delay = self.base_delay * (self.exponential_base ** attempt)
        elif self.backoff_strategy == "linear":
            delay = self.base_delay * (attempt + 1)
        else:  # constant
            delay = self.base_delay
        
        # Apply maximum delay
        delay = min(delay, self.max_delay)
        
        # Add jitter to prevent thundering herd
        if self.jitter:
            delay *= (0.5 + random.random() * 0.5)
        
        return delay

class RetryableError(ChronicleError):
    """Indicates an error that can be retried."""
    pass

class NonRetryableError(ChronicleError):
    """Indicates an error that should not be retried."""
    pass

def retry_async(config: RetryConfig = None, 
                retryable_exceptions: Tuple[Type[Exception], ...] = None,
                non_retryable_exceptions: Tuple[Type[Exception], ...] = None):
    """Decorator for async functions with retry logic."""
    
    if config is None:
        config = RetryConfig()
    
    if retryable_exceptions is None:
        retryable_exceptions = (NetworkError, DatabaseError, TimeoutError, ConnectionError)
    
    if non_retryable_exceptions is None:
        non_retryable_exceptions = (ValidationError, SecurityError, NonRetryableError)
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(config.max_attempts):
                try:
                    return await func(*args, **kwargs)
                    
                except non_retryable_exceptions as e:
                    # Don't retry these errors
                    raise e
                    
                except retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt == config.max_attempts - 1:
                        # Last attempt, raise the error
                        raise e
                    
                    # Calculate delay and wait
                    delay = config.get_delay(attempt)
                    print(f"Retry attempt {attempt + 1} for {func.__name__} in {delay:.2f}s")
                    await asyncio.sleep(delay)
                    
                except Exception as e:
                    # Unknown exception - classify it
                    severity, strategy = ErrorClassification.classify(e)
                    
                    if strategy == RecoveryStrategy.RETRY and attempt < config.max_attempts - 1:
                        last_exception = e
                        delay = config.get_delay(attempt)
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise e
            
            # Should not reach here, but just in case
            raise last_exception
        
        return wrapper
    return decorator

# Synchronous version
def retry_sync(config: RetryConfig = None, 
               retryable_exceptions: Tuple[Type[Exception], ...] = None,
               non_retryable_exceptions: Tuple[Type[Exception], ...] = None):
    """Decorator for sync functions with retry logic."""
    
    if config is None:
        config = RetryConfig()
    
    if retryable_exceptions is None:
        retryable_exceptions = (NetworkError, DatabaseError, TimeoutError, ConnectionError)
    
    if non_retryable_exceptions is None:
        non_retryable_exceptions = (ValidationError, SecurityError, NonRetryableError)
    
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            import time
            last_exception = None
            
            for attempt in range(config.max_attempts):
                try:
                    return func(*args, **kwargs)
                    
                except non_retryable_exceptions as e:
                    raise e
                    
                except retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt == config.max_attempts - 1:
                        raise e
                    
                    delay = config.get_delay(attempt)
                    time.sleep(delay)
                    
                except Exception as e:
                    severity, strategy = ErrorClassification.classify(e)
                    
                    if strategy == RecoveryStrategy.RETRY and attempt < config.max_attempts - 1:
                        last_exception = e
                        delay = config.get_delay(attempt)
                        time.sleep(delay)
                        continue
                    else:
                        raise e
            
            raise last_exception
        
        return wrapper
    return decorator
```

### 4. Circuit Breaker Pattern

```python
import time
from enum import Enum
from typing import Callable, Any
import asyncio

class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Circuit is open, failing fast
    HALF_OPEN = "half_open" # Testing if service recovered

class CircuitBreaker:
    """Circuit breaker implementation for graceful degradation."""
    
    def __init__(self,
                 failure_threshold: int = 5,
                 recovery_timeout: float = 60.0,
                 expected_exception: Type[Exception] = Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        
    async def __aenter__(self):
        """Async context manager entry."""
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerOpenError("Circuit breaker is OPEN")
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if exc_type is None:
            # Success
            self._on_success()
        elif issubclass(exc_type, self.expected_exception):
            # Expected failure
            self._on_failure()
        
        return False  # Don't suppress exceptions
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self.last_failure_time is None:
            return True
        
        return time.time() - self.last_failure_time >= self.recovery_timeout
    
    def _on_success(self):
        """Handle successful operation."""
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        """Handle failed operation."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

class CircuitBreakerOpenError(ChronicleError):
    """Raised when circuit breaker is open."""
    pass

# Decorator version
def circuit_breaker(failure_threshold: int = 5, 
                   recovery_timeout: float = 60.0,
                   expected_exception: Type[Exception] = Exception):
    """Circuit breaker decorator."""
    
    breaker = CircuitBreaker(failure_threshold, recovery_timeout, expected_exception)
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            async with breaker:
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator
```

### 5. Graceful Degradation Framework

```python
from typing import Optional, Callable, Any, Dict
import asyncio
import logging

class GracefulDegradation:
    """Framework for graceful degradation of services."""
    
    def __init__(self):
        self.fallbacks: Dict[str, Callable] = {}
        self.service_health: Dict[str, bool] = {}
        self.logger = logging.getLogger(__name__)
    
    def register_fallback(self, service_name: str, fallback_func: Callable):
        """Register a fallback function for a service."""
        self.fallbacks[service_name] = fallback_func
        self.service_health[service_name] = True
    
    async def call_with_fallback(self, service_name: str, 
                                primary_func: Callable, 
                                *args, **kwargs) -> Any:
        """Call primary function with fallback on failure."""
        try:
            # Try primary function
            result = await primary_func(*args, **kwargs)
            
            # Mark service as healthy
            if not self.service_health.get(service_name, True):
                self.logger.info(f"Service {service_name} recovered")
                self.service_health[service_name] = True
            
            return result
            
        except Exception as e:
            # Mark service as unhealthy
            self.service_health[service_name] = False
            self.logger.warning(f"Service {service_name} failed: {e}")
            
            # Try fallback
            fallback = self.fallbacks.get(service_name)
            if fallback:
                try:
                    self.logger.info(f"Using fallback for {service_name}")
                    return await fallback(*args, **kwargs)
                except Exception as fallback_error:
                    self.logger.error(f"Fallback for {service_name} also failed: {fallback_error}")
                    raise
            else:
                self.logger.error(f"No fallback available for {service_name}")
                raise

# Global instance
degradation_manager = GracefulDegradation()

def with_fallback(service_name: str, fallback_func: Callable = None):
    """Decorator for functions with fallback support."""
    
    def decorator(func: Callable):
        if fallback_func:
            degradation_manager.register_fallback(service_name, fallback_func)
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await degradation_manager.call_with_fallback(
                service_name, func, *args, **kwargs
            )
        
        return wrapper
    return decorator
```

### 6. Error Monitoring and Alerting

```python
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict

class ErrorMonitor:
    """Monitor and track errors for alerting."""
    
    def __init__(self, alert_threshold: int = 10, time_window: int = 300):
        self.alert_threshold = alert_threshold  # errors per time window
        self.time_window = time_window  # seconds
        self.error_counts = defaultdict(list)
        self.last_alert = {}
        
    def record_error(self, error: ChronicleError, context: Dict[str, Any] = None):
        """Record an error occurrence."""
        error_key = f"{error.__class__.__name__}:{error.error_code}"
        timestamp = datetime.utcnow()
        
        # Add to error history
        self.error_counts[error_key].append({
            'timestamp': timestamp,
            'error': error.to_dict(),
            'context': context or {}
        })
        
        # Clean old entries
        self._clean_old_entries(error_key, timestamp)
        
        # Check if alert should be sent
        self._check_alert_threshold(error_key, timestamp)
    
    def _clean_old_entries(self, error_key: str, current_time: datetime):
        """Remove entries older than the time window."""
        cutoff_time = current_time - timedelta(seconds=self.time_window)
        self.error_counts[error_key] = [
            entry for entry in self.error_counts[error_key]
            if entry['timestamp'] > cutoff_time
        ]
    
    def _check_alert_threshold(self, error_key: str, current_time: datetime):
        """Check if error count exceeds threshold and send alert."""
        count = len(self.error_counts[error_key])
        
        if count >= self.alert_threshold:
            # Check if we've already alerted recently
            last_alert_time = self.last_alert.get(error_key)
            if (last_alert_time is None or 
                current_time - last_alert_time > timedelta(minutes=30)):
                
                self._send_alert(error_key, count, current_time)
                self.last_alert[error_key] = current_time
    
    def _send_alert(self, error_key: str, count: int, timestamp: datetime):
        """Send alert for high error rate."""
        # In a real implementation, this would send to monitoring system
        print(f"ALERT: {error_key} occurred {count} times in {self.time_window}s at {timestamp}")
    
    def get_error_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get error summary for the specified time period."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        summary = {}
        
        for error_key, entries in self.error_counts.items():
            recent_entries = [
                entry for entry in entries
                if entry['timestamp'] > cutoff_time
            ]
            
            if recent_entries:
                summary[error_key] = {
                    'count': len(recent_entries),
                    'first_occurrence': min(entry['timestamp'] for entry in recent_entries),
                    'last_occurrence': max(entry['timestamp'] for entry in recent_entries)
                }
        
        return summary

# Global error monitor
error_monitor = ErrorMonitor()
```

### 7. Complete Error Handler Implementation

```python
class ChronicleErrorHandler:
    """Complete error handling system for Chronicle hooks."""
    
    def __init__(self):
        self.monitor = ErrorMonitor()
        self.degradation = GracefulDegradation()
        self.logger = logging.getLogger('chronicle.errors')
        
        # Configure circuit breakers for critical services
        self.circuit_breakers = {
            'database': CircuitBreaker(failure_threshold=3, recovery_timeout=30),
            'network': CircuitBreaker(failure_threshold=5, recovery_timeout=60)
        }
    
    async def handle_error(self, error: Exception, context: Dict[str, Any] = None) -> bool:
        """Handle an error with appropriate strategy."""
        # Convert to Chronicle error if needed
        if not isinstance(error, ChronicleError):
            chronicle_error = ChronicleError(
                message=str(error),
                context=context,
                cause=error
            )
        else:
            chronicle_error = error
        
        # Record error for monitoring
        self.monitor.record_error(chronicle_error, context)
        
        # Classify error and determine strategy
        severity, strategy = ErrorClassification.classify(error)
        
        # Log error
        self.logger.error(f"Error handled: {chronicle_error.to_dict()}")
        
        # Execute recovery strategy
        return await self._execute_recovery_strategy(strategy, chronicle_error, context)
    
    async def _execute_recovery_strategy(self, strategy: RecoveryStrategy, 
                                       error: ChronicleError, 
                                       context: Dict[str, Any]) -> bool:
        """Execute the determined recovery strategy."""
        if strategy == RecoveryStrategy.IGNORE:
            self.logger.info(f"Ignoring error: {error.message}")
            return True
            
        elif strategy == RecoveryStrategy.RETRY:
            # Error should be handled by retry decorator
            return False
            
        elif strategy == RecoveryStrategy.FALLBACK:
            # Error should be handled by fallback mechanism
            return False
            
        elif strategy == RecoveryStrategy.ESCALATE:
            self.logger.critical(f"Escalating error: {error.message}")
            # Send to monitoring/alerting system
            return False
            
        elif strategy == RecoveryStrategy.CIRCUIT_BREAK:
            # Circuit breaker should handle this
            return False
        
        return False
    
    @asynccontextmanager
    async def error_context(self, operation_name: str, context: Dict[str, Any] = None):
        """Context manager for error handling."""
        try:
            yield
        except Exception as e:
            handled = await self.handle_error(e, context)
            if not handled:
                raise

# Global error handler
error_handler = ChronicleErrorHandler()
```

### 8. Usage Examples

```python
# Example hook with comprehensive error handling
class RobustHook:
    """Example hook with comprehensive error handling."""
    
    def __init__(self):
        self.error_handler = error_handler
    
    @retry_async(RetryConfig(max_attempts=3, base_delay=1.0))
    @circuit_breaker(failure_threshold=5, recovery_timeout=60)
    @with_fallback('database_write', fallback_func=self._write_to_local_file)
    async def save_data(self, data: Dict[str, Any]) -> bool:
        """Save data with full error handling."""
        async with self.error_handler.error_context('save_data', {'data_size': len(str(data))}):
            # Validate data
            if not self._validate_data(data):
                raise ValidationError("Invalid data format")
            
            # Save to database
            await self._save_to_database(data)
            return True
    
    def _validate_data(self, data: Dict[str, Any]) -> bool:
        """Validate data structure."""
        required_fields = ['timestamp', 'event_type']
        return all(field in data for field in required_fields)
    
    async def _save_to_database(self, data: Dict[str, Any]):
        """Save to primary database."""
        # Database operation that might fail
        pass
    
    async def _write_to_local_file(self, data: Dict[str, Any]):
        """Fallback: write to local file."""
        import json
        with open('fallback_data.jsonl', 'a') as f:
            f.write(json.dumps(data) + '\n')

# Usage in hook execution
async def execute_hook():
    hook = RobustHook()
    
    try:
        success = await hook.save_data({
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': 'tool_execution',
            'data': {'tool': 'Read', 'file': 'example.py'}
        })
        
        if success:
            print("Data saved successfully")
        
    except Exception as e:
        print(f"Hook execution failed: {e}")
        # Error was already handled by the error handling framework
```

## Best Practices

1. **Fail Fast**: Validate inputs early and fail with clear messages
2. **Graceful Degradation**: Always have fallback mechanisms
3. **Idempotency**: Design operations to be safely retried
4. **Error Classification**: Classify errors by severity and recovery strategy
5. **Monitoring**: Comprehensive error tracking and alerting
6. **Circuit Breaking**: Prevent cascading failures
7. **Structured Logging**: Use structured logging for error analysis
8. **Documentation**: Document error scenarios and recovery procedures

This error handling framework ensures that the Chronicle system remains resilient and continues operating even when individual components fail, providing a robust foundation for the observability infrastructure.