"""
Consolidated Error Handling for UV Single-File Scripts

Essential error handling and logging functionality consolidated into a minimal
module suitable for inlining into UV single-file scripts.

Key consolidations:
- Simplified logging with basic file output
- Essential error classes only
- Removed complex retry logic to reduce complexity
- Basic graceful degradation
- Minimal context tracking
"""

import logging
import os
import sys
import traceback
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any, Dict, Optional, Callable, Tuple


class ChronicleError(Exception):
    """Base error for Chronicle operations."""
    
    def __init__(self, message: str, error_code: str = None, exit_code: int = 1):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.exit_code = exit_code
        self.timestamp = datetime.now()


class DatabaseError(ChronicleError):
    """Database operation error."""
    pass


class SecurityError(ChronicleError):
    """Security validation error."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(message, error_code="SECURITY_ERROR", exit_code=2, **kwargs)


class ValidationError(ChronicleError):
    """Input validation error."""
    pass


class HookExecutionError(ChronicleError):
    """Hook execution error."""
    pass


class SimpleLogger:
    """
    Minimal logger for UV single-file scripts.
    Provides basic file logging without complex configuration.
    """
    
    def __init__(self, name: str = "chronicle", log_to_file: bool = True):
        self.name = name
        self.log_file = None
        
        if log_to_file:
            try:
                log_dir = Path.home() / ".claude"
                log_dir.mkdir(exist_ok=True)
                self.log_file = log_dir / "chronicle_hooks.log"
            except Exception:
                # If we can't create log file, continue without it
                pass
        
        # Set up basic Python logger
        self.logger = logging.getLogger(name)
        if not self.logger.handlers:
            self.logger.setLevel(logging.INFO)
            
            # Only add handler if none exists
            if self.log_file:
                try:
                    handler = logging.FileHandler(self.log_file)
                    handler.setFormatter(logging.Formatter(
                        '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
                    ))
                    self.logger.addHandler(handler)
                except Exception:
                    pass  # Continue without file logging
    
    def debug(self, message: str, context: Dict[str, Any] = None):
        """Log debug message."""
        self._log(logging.DEBUG, message, context)
    
    def info(self, message: str, context: Dict[str, Any] = None):
        """Log info message."""
        self._log(logging.INFO, message, context)
    
    def warning(self, message: str, context: Dict[str, Any] = None):
        """Log warning message."""
        self._log(logging.WARNING, message, context)
    
    def error(self, message: str, context: Dict[str, Any] = None, error: Exception = None):
        """Log error message."""
        if error:
            message += f" | Exception: {error}"
        self._log(logging.ERROR, message, context)
    
    def _log(self, level: int, message: str, context: Dict[str, Any] = None):
        """Internal logging method."""
        if context:
            message += f" | Context: {context}"
        
        try:
            self.logger.log(level, message)
        except Exception:
            # If logging fails, fall back to stderr
            timestamp = datetime.now().isoformat()
            print(f"[{timestamp}] {self.name}: {message}", file=sys.stderr)


class SimpleErrorHandler:
    """
    Minimal error handler for UV single-file scripts.
    Provides basic error handling without complex recovery strategies.
    """
    
    def __init__(self, logger: SimpleLogger = None):
        self.logger = logger or SimpleLogger()
    
    def handle_error(self, 
                    error: Exception, 
                    context: Dict[str, Any] = None,
                    operation: str = "unknown") -> Tuple[bool, int, str]:
        """
        Handle error with basic logging and recovery.
        
        Returns:
            Tuple of (should_continue, exit_code, error_message)
        """
        # Convert to Chronicle error if needed
        if isinstance(error, ChronicleError):
            chronicle_error = error
        else:
            chronicle_error = self._convert_to_chronicle_error(error, context, operation)
        
        # Log the error
        self.logger.error(
            f"Error in {operation}: {chronicle_error.message}",
            context=context,
            error=error
        )
        
        # Determine response based on error type
        if isinstance(error, SecurityError):
            # Security errors should be taken seriously but not block execution
            return True, 2, f"Security error: {chronicle_error.message}"
        elif isinstance(error, ValidationError):
            # Validation errors are usually recoverable
            return True, 1, f"Validation error: {chronicle_error.message}"
        elif isinstance(error, DatabaseError):
            # Database errors shouldn't block hook execution
            return True, 1, f"Database error: {chronicle_error.message}"
        else:
            # Generic errors - continue with warning
            return True, 1, f"Error: {chronicle_error.message}"
    
    def _convert_to_chronicle_error(self, 
                                   error: Exception, 
                                   context: Dict[str, Any] = None,
                                   operation: str = "unknown") -> ChronicleError:
        """Convert standard exception to Chronicle error."""
        error_name = error.__class__.__name__
        error_message = str(error)
        
        # Map common exceptions
        if "Connection" in error_name or "connection" in error_message.lower():
            return DatabaseError(f"Connection failed in {operation}: {error}")
        elif "Permission" in error_name or "permission" in error_message.lower():
            return SecurityError(f"Permission denied in {operation}: {error}")
        elif "JSON" in error_name or "json" in error_message.lower():
            return ValidationError(f"JSON error in {operation}: {error}")
        else:
            return HookExecutionError(f"Error in {operation}: {error}")


def with_error_handling(operation: str = None):
    """
    Simple decorator for error handling in hook functions.
    
    Args:
        operation: Name of the operation for context
    
    Returns:
        Decorated function with basic error handling
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            error_handler = SimpleErrorHandler()
            op_name = operation or func.__name__
            
            try:
                return func(*args, **kwargs)
            except Exception as e:
                should_continue, exit_code, message = error_handler.handle_error(
                    e, operation=op_name
                )
                
                # For hooks, we want to return a valid response even on error
                # to avoid breaking Claude Code execution
                return {
                    "continue": should_continue,
                    "suppressOutput": True,
                    "error": message,
                    "exit_code": exit_code
                }
        
        return wrapper
    return decorator


def safe_execute(func: Callable, *args, default_return=None, **kwargs):
    """
    Safely execute a function with error handling.
    
    Args:
        func: Function to execute
        *args: Function arguments
        default_return: Default return value on error
        **kwargs: Function keyword arguments
    
    Returns:
        Function result or default_return on error
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logger = SimpleLogger()
        logger.error(f"Safe execution failed for {func.__name__}", error=e)
        return default_return


def format_error_message(error: Exception, context: Optional[str] = None) -> str:
    """Format error message for logging."""
    error_type = type(error).__name__
    error_msg = str(error)
    
    if context:
        return f"[{context}] {error_type}: {error_msg}"
    else:
        return f"{error_type}: {error_msg}"


def get_traceback_info(error: Exception) -> str:
    """Get formatted traceback information."""
    try:
        return traceback.format_exc()
    except Exception:
        return f"Error getting traceback for: {error}"


# Global instances for easy use
default_logger = SimpleLogger()
default_error_handler = SimpleErrorHandler(default_logger)


# Factory functions
def create_logger(name: str = "chronicle") -> SimpleLogger:
    """Create and return a logger instance."""
    return SimpleLogger(name)


def create_error_handler(logger: SimpleLogger = None) -> SimpleErrorHandler:
    """Create and return an error handler instance."""
    return SimpleErrorHandler(logger)