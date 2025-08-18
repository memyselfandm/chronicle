"""Enhanced Error Handling System for Chronicle Hooks.

This module provides comprehensive error handling, logging, and recovery mechanisms
to ensure hooks never crash Claude Code execution while providing useful debugging
information for developers.

Features:
- Standardized exception hierarchy with error codes
- Configurable logging with multiple verbosity levels
- Exit code management according to Claude Code documentation
- Error recovery mechanisms and fallback strategies
- Structured error reporting with context and suggestions
"""

import json
import logging
import os
import sys
import time
import traceback
import uuid
from datetime import datetime
from enum import Enum
from functools import wraps
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union, Callable
from contextlib import contextmanager


class ErrorSeverity(Enum):
    """Error severity levels for classification and handling."""
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
    GRACEFUL_FAIL = "graceful_fail"  # Fail gracefully with useful output


class LogLevel(Enum):
    """Logging levels with Claude Code integration."""
    ERROR = logging.ERROR
    WARN = logging.WARNING
    INFO = logging.INFO
    DEBUG = logging.DEBUG


class ChronicleError(Exception):
    """Base exception for all Chronicle hook errors.
    
    Provides structured error information with recovery suggestions
    and proper exit code management for Claude Code integration.
    """
    
    def __init__(self, 
                 message: str, 
                 error_code: str = None,
                 context: Dict[str, Any] = None,
                 cause: Exception = None,
                 severity: ErrorSeverity = ErrorSeverity.MEDIUM,
                 recovery_suggestion: str = None,
                 exit_code: int = 1):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.context = context or {}
        self.cause = cause
        self.severity = severity
        self.recovery_suggestion = recovery_suggestion
        self.exit_code = exit_code
        self.timestamp = datetime.now()
        self.error_id = str(uuid.uuid4())[:8]
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to structured dictionary for logging/storage."""
        return {
            'error_id': self.error_id,
            'error_type': self.__class__.__name__,
            'error_code': self.error_code,
            'message': self.message,
            'severity': self.severity.value,
            'context': self.context,
            'recovery_suggestion': self.recovery_suggestion,
            'exit_code': self.exit_code,
            'timestamp': self.timestamp.isoformat(),
            'traceback': traceback.format_exc() if self.cause else None
        }
    
    def get_user_message(self) -> str:
        """Get user-friendly error message."""
        msg = f"Chronicle Hook Error [{self.error_id}]: {self.message}"
        if self.recovery_suggestion:
            msg += f"\n\nSuggestion: {self.recovery_suggestion}"
        return msg
    
    def get_developer_message(self) -> str:
        """Get detailed developer error message."""
        msg = f"Error {self.error_id} ({self.error_code}): {self.message}"
        if self.context:
            msg += f"\nContext: {json.dumps(self.context, indent=2)}"
        if self.recovery_suggestion:
            msg += f"\nRecovery: {self.recovery_suggestion}"
        return msg


class DatabaseError(ChronicleError):
    """Database operation errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="DB_ERROR",
            severity=ErrorSeverity.HIGH,
            recovery_suggestion="Check database connection and retry. Data will be saved locally as fallback.",
            exit_code=1,
            **kwargs
        )


class NetworkError(ChronicleError):
    """Network and connectivity errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="NETWORK_ERROR",
            severity=ErrorSeverity.MEDIUM,
            recovery_suggestion="Check network connectivity and retry.",
            exit_code=1,
            **kwargs
        )


class ValidationError(ChronicleError):
    """Data validation errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="VALIDATION_ERROR",
            severity=ErrorSeverity.LOW,
            recovery_suggestion="Check input data format and fix validation errors.",
            exit_code=1,
            **kwargs
        )


class ConfigurationError(ChronicleError):
    """Configuration and setup errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="CONFIG_ERROR",
            severity=ErrorSeverity.HIGH,
            recovery_suggestion="Check environment variables and configuration files.",
            exit_code=2,  # Blocking error
            **kwargs
        )


class HookExecutionError(ChronicleError):
    """Hook execution errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="HOOK_ERROR",
            severity=ErrorSeverity.MEDIUM,
            recovery_suggestion="Hook will continue with reduced functionality.",
            exit_code=1,
            **kwargs
        )


class SecurityError(ChronicleError):
    """Security and privacy violation errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="SECURITY_ERROR",
            severity=ErrorSeverity.CRITICAL,
            recovery_suggestion="Review security settings and permissions.",
            exit_code=2,  # Blocking error
            **kwargs
        )


class ResourceError(ChronicleError):
    """Resource exhaustion or unavailability errors."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            error_code="RESOURCE_ERROR",
            severity=ErrorSeverity.HIGH,
            recovery_suggestion="Free up system resources and retry.",
            exit_code=1,
            **kwargs
        )


class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(self, 
                 max_attempts: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 exponential_base: float = 2.0,
                 jitter: bool = True):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number."""
        import random
        
        delay = self.base_delay * (self.exponential_base ** attempt)
        delay = min(delay, self.max_delay)
        
        if self.jitter:
            delay *= (0.5 + random.random() * 0.5)
        
        return delay


class ChronicleLogger:
    """Enhanced logging system for Chronicle hooks.
    
    Provides structured logging with configurable verbosity levels,
    error context tracking, and integration with Claude Code output.
    """
    
    def __init__(self, 
                 name: str = "chronicle", 
                 log_level: LogLevel = LogLevel.INFO,
                 log_file: Optional[str] = None,
                 console_output: bool = True):
        self.name = name
        self.log_level = log_level
        self.console_output = console_output
        
        # Set up log file path
        if log_file is None:
            log_dir = Path.home() / ".claude"
            log_dir.mkdir(exist_ok=True)
            self.log_file = log_dir / "chronicle_hooks.log"
        else:
            self.log_file = Path(log_file)
        
        # Ensure log directory exists
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Configure logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(log_level.value)
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # File handler with structured format
        file_handler = logging.FileHandler(self.log_file)
        file_handler.setLevel(log_level.value)
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)
        
        # Console handler (optional)
        if console_output:
            console_handler = logging.StreamHandler(sys.stderr)
            console_handler.setLevel(logging.WARNING)  # Only warnings and errors to stderr
            console_formatter = logging.Formatter('[Chronicle] %(levelname)s: %(message)s')
            console_handler.setFormatter(console_formatter)
            self.logger.addHandler(console_handler)
        
        # Prevent propagation to root logger
        self.logger.propagate = False
    
    def debug(self, message: str, context: Dict[str, Any] = None, **kwargs):
        """Log debug message with optional context."""
        self._log(LogLevel.DEBUG, message, context, **kwargs)
    
    def info(self, message: str, context: Dict[str, Any] = None, **kwargs):
        """Log info message with optional context."""
        self._log(LogLevel.INFO, message, context, **kwargs)
    
    def warning(self, message: str, context: Dict[str, Any] = None, **kwargs):
        """Log warning message with optional context."""
        self._log(LogLevel.WARN, message, context, **kwargs)
    
    def error(self, message: str, context: Dict[str, Any] = None, error: Exception = None, **kwargs):
        """Log error message with optional context and exception."""
        if error:
            context = context or {}
            context['exception_type'] = error.__class__.__name__
            context['exception_message'] = str(error)
            if hasattr(error, 'error_id'):
                context['error_id'] = error.error_id
        
        self._log(LogLevel.ERROR, message, context, **kwargs)
    
    def critical(self, message: str, context: Dict[str, Any] = None, **kwargs):
        """Log critical message with optional context."""
        self._log(LogLevel.ERROR, f"CRITICAL: {message}", context, **kwargs)
    
    def _log(self, level: LogLevel, message: str, context: Dict[str, Any] = None, **kwargs):
        """Internal logging method with structured format."""
        # Build structured log entry
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'level': level.name,
            'message': message,
            'context': context or {},
            **kwargs
        }
        
        # Format message for logger
        if context:
            formatted_message = f"{message} | Context: {json.dumps(context)}"
        else:
            formatted_message = message
        
        # Log at appropriate level
        self.logger.log(level.value, formatted_message)
    
    def log_error_details(self, error: ChronicleError):
        """Log comprehensive error details."""
        self.error(
            f"Error {error.error_id}: {error.message}",
            context={
                'error_code': error.error_code,
                'severity': error.severity.value,
                'recovery_suggestion': error.recovery_suggestion,
                'exit_code': error.exit_code,
                'error_context': error.context
            },
            error=error.cause
        )
    
    def set_level(self, level: LogLevel):
        """Dynamically change log level."""
        self.log_level = level
        self.logger.setLevel(level.value)
        for handler in self.logger.handlers:
            if isinstance(handler, logging.FileHandler):
                handler.setLevel(level.value)


class ErrorHandler:
    """Comprehensive error handler for Chronicle hooks.
    
    Provides error classification, recovery strategies, retry logic,
    and graceful degradation to ensure hooks never crash Claude Code.
    """
    
    def __init__(self, logger: ChronicleLogger = None):
        self.logger = logger or ChronicleLogger()
        self.error_counts = {}
        self.last_errors = {}
        
        # Error classification mapping
        self.error_classification = {
            'ConnectionError': (ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
            'DatabaseError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
            'TimeoutError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
            'NetworkError': (ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY),
            'ValidationError': (ErrorSeverity.LOW, RecoveryStrategy.IGNORE),
            'SecurityError': (ErrorSeverity.CRITICAL, RecoveryStrategy.ESCALATE),
            'ConfigurationError': (ErrorSeverity.HIGH, RecoveryStrategy.ESCALATE),
            'ResourceError': (ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
            'PermissionError': (ErrorSeverity.HIGH, RecoveryStrategy.ESCALATE),
            'FileNotFoundError': (ErrorSeverity.MEDIUM, RecoveryStrategy.FALLBACK),
            'json.JSONDecodeError': (ErrorSeverity.MEDIUM, RecoveryStrategy.GRACEFUL_FAIL),
            'TypeError': (ErrorSeverity.MEDIUM, RecoveryStrategy.IGNORE),
            'ValueError': (ErrorSeverity.MEDIUM, RecoveryStrategy.IGNORE),
        }
    
    def handle_error(self, 
                    error: Exception, 
                    context: Dict[str, Any] = None,
                    operation: str = "unknown") -> Tuple[bool, int, str]:
        """Handle error with appropriate recovery strategy.
        
        Args:
            error: The exception that occurred
            context: Additional context about the error
            operation: The operation that failed
        
        Returns:
            Tuple of (should_continue, exit_code, error_message)
        """
        # Convert to Chronicle error if needed
        if isinstance(error, ChronicleError):
            chronicle_error = error
        else:
            chronicle_error = self._convert_to_chronicle_error(error, context, operation)
        
        # Log error details
        self.logger.log_error_details(chronicle_error)
        
        # Track error for pattern analysis
        self._track_error(chronicle_error)
        
        # Determine recovery strategy
        severity, strategy = self._classify_error(error)
        
        # Execute recovery strategy
        return self._execute_recovery_strategy(chronicle_error, strategy)
    
    def _convert_to_chronicle_error(self, 
                                   error: Exception, 
                                   context: Dict[str, Any] = None,
                                   operation: str = "unknown") -> ChronicleError:
        """Convert standard exception to Chronicle error."""
        error_name = error.__class__.__name__
        
        # Map common exceptions to Chronicle errors
        if "Connection" in error_name or "connection" in str(error).lower():
            return NetworkError(
                f"Connection failed during {operation}: {error}",
                context=context,
                cause=error
            )
        elif "Database" in error_name or "database" in str(error).lower():
            return DatabaseError(
                f"Database operation failed during {operation}: {error}",
                context=context,
                cause=error
            )
        elif "Permission" in error_name or "permission" in str(error).lower():
            return SecurityError(
                f"Permission denied during {operation}: {error}",
                context=context,
                cause=error
            )
        elif "Timeout" in error_name or "timeout" in str(error).lower():
            return NetworkError(
                f"Operation timed out during {operation}: {error}",
                context=context,
                cause=error
            )
        elif "JSON" in error_name or "json" in str(error).lower():
            return ValidationError(
                f"JSON parsing failed during {operation}: {error}",
                context=context,
                cause=error
            )
        else:
            # Generic hook execution error
            return HookExecutionError(
                f"Unexpected error during {operation}: {error}",
                context=context,
                cause=error
            )
    
    def _classify_error(self, error: Exception) -> Tuple[ErrorSeverity, RecoveryStrategy]:
        """Classify error and determine recovery strategy."""
        error_name = error.__class__.__name__
        full_error_name = f"{error.__class__.__module__}.{error_name}"
        
        # Try full name first, then just class name
        for name in [full_error_name, error_name]:
            if name in self.error_classification:
                return self.error_classification[name]
        
        # Default classification
        return ErrorSeverity.MEDIUM, RecoveryStrategy.GRACEFUL_FAIL
    
    def _execute_recovery_strategy(self, 
                                  error: ChronicleError, 
                                  strategy: RecoveryStrategy) -> Tuple[bool, int, str]:
        """Execute the determined recovery strategy."""
        if strategy == RecoveryStrategy.IGNORE:
            self.logger.info(f"Ignoring error {error.error_id}: {error.message}")
            return True, 0, error.get_user_message()
        
        elif strategy == RecoveryStrategy.GRACEFUL_FAIL:
            self.logger.warning(f"Graceful failure for error {error.error_id}: {error.message}")
            return True, error.exit_code, error.get_user_message()
        
        elif strategy == RecoveryStrategy.FALLBACK:
            self.logger.warning(f"Fallback strategy for error {error.error_id}: {error.message}")
            return True, error.exit_code, error.get_user_message()
        
        elif strategy == RecoveryStrategy.ESCALATE:
            self.logger.critical(f"Escalating error {error.error_id}: {error.message}")
            # For critical errors like security, we still continue but with higher exit code
            return True, error.exit_code, error.get_developer_message()
        
        else:  # RETRY
            self.logger.info(f"Retry recommended for error {error.error_id}: {error.message}")
            return True, error.exit_code, error.get_user_message()
    
    def _track_error(self, error: ChronicleError):
        """Track error occurrence for pattern analysis."""
        error_key = f"{error.error_code}:{error.__class__.__name__}"
        current_time = time.time()
        
        # Track error count
        if error_key not in self.error_counts:
            self.error_counts[error_key] = 0
        self.error_counts[error_key] += 1
        
        # Track last occurrence
        self.last_errors[error_key] = {
            'timestamp': current_time,
            'error_id': error.error_id,
            'message': error.message
        }
        
        # Log pattern if error is recurring
        if self.error_counts[error_key] > 3:
            self.logger.warning(
                f"Recurring error pattern detected: {error_key} "
                f"(occurred {self.error_counts[error_key]} times)"
            )


def with_error_handling(operation: str = None,
                       retry_config: RetryConfig = None,
                       fallback_func: Callable = None):
    """Decorator for comprehensive error handling in hook functions.
    
    Args:
        operation: Name of the operation for error context
        retry_config: Retry configuration for retryable errors
        fallback_func: Fallback function to call on failure
    
    Returns:
        Decorated function with error handling
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            error_handler = ErrorHandler()
            op_name = operation or func.__name__
            
            # Try primary function with retries
            max_attempts = retry_config.max_attempts if retry_config else 1
            last_error = None
            
            for attempt in range(max_attempts):
                try:
                    result = func(*args, **kwargs)
                    return result
                
                except Exception as e:
                    last_error = e
                    
                    # If this is the last attempt, break and handle below
                    if attempt == max_attempts - 1:
                        break
                    
                    # Check if error is retryable
                    severity, strategy = error_handler._classify_error(e)
                    if strategy not in [RecoveryStrategy.RETRY, RecoveryStrategy.FALLBACK]:
                        break
                    
                    # Wait before retry
                    if retry_config:
                        delay = retry_config.get_delay(attempt)
                        error_handler.logger.info(f"Retrying {op_name} in {delay:.2f}s (attempt {attempt + 2})")
                        time.sleep(delay)
            
            # All attempts failed, try fallback
            if fallback_func:
                try:
                    error_handler.logger.info(f"Trying fallback for {op_name}")
                    return fallback_func(*args, **kwargs)
                except Exception as fallback_error:
                    error_handler.handle_error(
                        fallback_error,
                        context={'fallback_for': op_name},
                        operation=f"{op_name}_fallback"
                    )
            
            # Return graceful failure response
            error_handler.handle_error(
                last_error,
                context={'final_failure': True},
                operation=op_name
            )
            
            # Return minimal success response to avoid breaking Claude
            return True
        
        return wrapper
    return decorator


@contextmanager
def error_context(operation: str, context: Dict[str, Any] = None):
    """Context manager for error handling with structured logging."""
    error_handler = ErrorHandler()
    start_time = time.time()
    
    try:
        error_handler.logger.debug(f"Starting operation: {operation}", context)
        yield error_handler
        
        duration = time.time() - start_time
        error_handler.logger.debug(
            f"Completed operation: {operation}",
            context={'duration_ms': int(duration * 1000)}
        )
        
    except Exception as e:
        duration = time.time() - start_time
        
        should_continue, exit_code, message = error_handler.handle_error(
            e,
            context={
                **(context or {}),
                'duration_ms': int(duration * 1000),
                'operation_failed': True
            },
            operation=operation
        )
        
        # Always re-raise to maintain original behavior in tests
        # In actual hook usage, this would be caught by the main error handler
        raise


def get_log_level_from_env() -> LogLevel:
    """Get log level from environment variable."""
    level_str = os.getenv('CHRONICLE_LOG_LEVEL', 'INFO').upper()
    level_map = {
        'DEBUG': LogLevel.DEBUG,
        'INFO': LogLevel.INFO,
        'WARNING': LogLevel.WARN,
        'WARN': LogLevel.WARN,
        'ERROR': LogLevel.ERROR
    }
    return level_map.get(level_str, LogLevel.INFO)


# Global instances for easy access
default_logger = ChronicleLogger(log_level=get_log_level_from_env())
default_error_handler = ErrorHandler(default_logger)