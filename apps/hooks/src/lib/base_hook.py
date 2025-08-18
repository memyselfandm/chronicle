"""
Base hook class for Claude Code observability hooks - UV Compatible Library Module.

Simplified version extracted from inline hook implementations for UV script compatibility.
Removes async features and heavy dependencies not needed for single-file UV scripts.
"""

import json
import logging
import os
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Optional, Generator, Tuple, List, Callable

try:
    from .database import DatabaseManager
    from .utils import (
        extract_session_context, get_git_info, sanitize_data, format_error_message,
        resolve_project_path, get_project_context_with_env_support, validate_environment_setup
    )
    from .security import SecurityValidator, SecurityError, PathTraversalError, InputSizeError
    from .errors import (
        ChronicleLogger, ErrorHandler, error_context, with_error_handling,
        get_log_level_from_env, DatabaseError, ValidationError, HookExecutionError
    )
    from .performance import (
        measure_performance, performance_monitor, get_performance_collector,
        get_hook_cache, EarlyReturnValidator, PerformanceMetrics
    )
except ImportError:
    # For UV script compatibility - fallback to basic imports
    from .database import DatabaseManager
    from .utils import sanitize_data
    
    # Mock the advanced functionality for UV compatibility
    class SecurityValidator:
        def validate_input_size(self, data): return True
        def validate_file_path(self, path): return True
        def escape_shell_command(self, cmd, args): return [cmd] + args
        def detect_sensitive_data(self, data): return {}
    
    class PerformanceMetrics:
        def get_metrics(self): return {}
        def reset(self): pass
    
    class ChronicleLogger:
        def __init__(self, *args, **kwargs): pass
        def debug(self, msg): logging.debug(msg)
        def info(self, msg): logging.info(msg)
        def warning(self, msg): logging.warning(msg)
        def error(self, msg): logging.error(msg)
    
    class ErrorHandler:
        def __init__(self, logger): self.logger = logger
        def handle_error(self, error, context=None): self.logger.error(f"{error} - {context}")
    
    def get_log_level_from_env(): return logging.INFO
    def get_performance_collector(): return PerformanceMetrics()
    def get_hook_cache(): return {}
    
    class EarlyReturnValidator:
        def should_return_early(self, data): return False, None
    
    def extract_session_context(data): return {}
    def get_git_info(): return {}
    def format_error_message(error, context=None): return str(error)
    def resolve_project_path(path): return path
    def get_project_context_with_env_support(): return {}
    def validate_environment_setup(): return {}

# Configure logger
logger = logging.getLogger(__name__)


class ExecutionTimer:
    """Context manager for measuring execution time."""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.duration_ms = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        if self.start_time:
            self.duration_ms = (self.end_time - self.start_time) * 1000


class BaseHook:
    """
    Base class for all Claude Code observability hooks.
    
    Provides common functionality for:
    - Database client initialization
    - Session ID extraction and management
    - Project context loading
    - Event saving with error handling
    - Error logging and debugging
    - Performance monitoring and security validation
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the base hook.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        
        # Initialize enhanced error handling and logging (with fallback)
        try:
            self.chronicle_logger = ChronicleLogger(
                name=f"chronicle.{self.__class__.__name__.lower()}",
                log_level=get_log_level_from_env()
            )
            self.error_handler = ErrorHandler(self.chronicle_logger)
        except:
            # Fallback for UV compatibility
            self.chronicle_logger = ChronicleLogger()
            self.error_handler = ErrorHandler(self.chronicle_logger)
        
        # Initialize performance monitoring (with fallback)
        try:
            self.performance_collector = get_performance_collector()
            self.hook_cache = get_hook_cache()
            self.early_validator = EarlyReturnValidator()
        except:
            # Fallback for UV compatibility
            self.performance_collector = PerformanceMetrics()
            self.hook_cache = {}
            self.early_validator = EarlyReturnValidator()
        
        # Initialize security validator (with fallback)
        try:
            self.security_validator = SecurityValidator()
        except:
            # Fallback for UV compatibility
            self.security_validator = SecurityValidator()
        
        # Initialize database manager with error handling
        try:
            self.db_manager = DatabaseManager(self.config.get("database"))
        except Exception as e:
            logger.error(f"Failed to initialize database manager: {e}")
            self.db_manager = None
        
        # Session tracking
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Extract Claude session ID from input data or environment with early validation.
        
        Args:
            input_data: Hook input data (optional)
            
        Returns:
            Claude session ID string or None if not found
        """
        # Early return for empty input
        if not input_data and not os.getenv("CLAUDE_SESSION_ID"):
            logger.warning("No Claude session ID available - no input data or environment variable")
            return None
        
        # Priority: input_data > environment variable
        if input_data and "sessionId" in input_data:
            session_id = input_data["sessionId"]
            logger.debug(f"Claude session ID from input: {session_id}")
            return session_id
        elif input_data and "session_id" in input_data:
            session_id = input_data["session_id"]
            logger.debug(f"Claude session ID from input (legacy key): {session_id}")
            return session_id
        
        # Try environment variable
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id:
            logger.debug(f"Claude session ID from environment: {session_id}")
            return session_id
        
        logger.warning("No Claude session ID found in input or environment")
        return None
    
    def process_hook_data(self, input_data: Dict[str, Any], hook_event_name: str) -> Dict[str, Any]:
        """Process and validate input data for any hook type."""
        if not isinstance(input_data, dict):
            return {"hook_event_name": hook_event_name, "error": "Invalid input"}
        
        self.claude_session_id = self.get_claude_session_id(input_data)
        sanitized_input = sanitize_data(input_data)
        
        return {
            "hook_event_name": hook_event_name,
            "claude_session_id": self.claude_session_id,
            "raw_input": sanitized_input,
            "timestamp": datetime.now().isoformat(),
        }
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event with auto session creation."""
        try:
            logger.info(f"save_event called with event_type: {event_data.get('event_type')}")
            # Ensure session exists
            if not self.session_uuid and self.claude_session_id:
                logger.info(f"No session_uuid, creating new session for Claude session ID: {self.claude_session_id}")
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success:
                    self.session_uuid = session_uuid
                    logger.info(f"Created session with UUID: {session_uuid}")
                else:
                    logger.error("Failed to create session")
            
            if not self.session_uuid:
                logger.error("No session UUID available for event saving")
                return False
            
            # Add required fields
            event_data["session_id"] = self.session_uuid
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            logger.info(f"Saving event with ID: {event_data['event_id']}, event_type: {event_data.get('event_type')}")
            result = self.db_manager.save_event(event_data)
            logger.info(f"Database save_event returned: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error saving event: {e}")
            return False
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create hook response following Claude Code spec."""
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
    def create_hook_specific_output(self, **kwargs) -> Dict[str, Any]:
        """Create hookSpecificOutput with camelCase keys."""
        output = {}
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                output[camel_key] = value
        return output
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        if not snake_str:
            return snake_str
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])
    
    def log_debug(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Debug logging helper."""
        if extra_data:
            logger.debug(f"{message} - {extra_data}")
        else:
            logger.debug(message)
    
    def log_info(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Info logging helper."""
        if extra_data:
            logger.info(f"{message} - {extra_data}")
        else:
            logger.info(message)
    
    def log_warning(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Warning logging helper."""
        if extra_data:
            logger.warning(f"{message} - {extra_data}")
        else:
            logger.warning(message)
    
    def log_error(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Error logging helper."""
        if extra_data:
            logger.error(f"{message} - {extra_data}")
        else:
            logger.error(message)

    def load_project_context(self, cwd: Optional[str] = None) -> Dict[str, Any]:
        """
        Capture project information and context with enhanced environment variable support.
        
        Args:
            cwd: Working directory (defaults to resolved project directory from CLAUDE_PROJECT_DIR)
            
        Returns:
            Dictionary containing project context information
        """
        try:
            # Use enhanced environment-aware project context function
            context = get_project_context_with_env_support(cwd)
            context["timestamp"] = datetime.now().isoformat()
            
            resolved_cwd = context.get("cwd", os.getcwd())
            logger.debug(f"Loaded project context for: {resolved_cwd}")
            
            # Log environment variable usage for debugging
            if context.get("resolved_from_env"):
                logger.debug(f"Project context resolved from CLAUDE_PROJECT_DIR: {context.get('claude_project_dir')}")
            
            return context
        except:
            # Fallback for UV compatibility
            return {
                "cwd": cwd or os.getcwd(),
                "timestamp": datetime.now().isoformat(),
                "git_info": {},
                "project_path": cwd or os.getcwd()
            }
    
    def validate_environment(self) -> Dict[str, Any]:
        """
        Validate the environment setup for the hooks system.
        
        Returns:
            Dictionary containing validation results, warnings, and recommendations
        """
        try:
            return validate_environment_setup()
        except:
            # Fallback for UV compatibility
            return {"status": "unknown", "warnings": [], "errors": []}
    
    def get_project_root(self, fallback_path: Optional[str] = None) -> str:
        """
        Get the project root path using CLAUDE_PROJECT_DIR or fallback.
        
        Args:
            fallback_path: Optional fallback path if environment variable is not set
            
        Returns:
            Resolved project root path
        """
        try:
            return resolve_project_path(fallback_path)
        except:
            # Fallback for UV compatibility
            return fallback_path or os.getcwd()
    
    def save_session(self, session_data: Dict[str, Any]) -> bool:
        """
        Save session data to database with error handling.
        Creates or retrieves a session record and sets the session UUID.
        
        Args:
            session_data: Session data to save (should contain claude_session_id)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.db_manager:
                logger.warning("Database manager not available, skipping session save")
                return False
                
            # Ensure we have the claude_session_id
            if "claude_session_id" not in session_data and self.claude_session_id:
                session_data["claude_session_id"] = self.claude_session_id
            
            if "claude_session_id" not in session_data:
                logger.error("Cannot save session: no claude_session_id available")
                return False
            
            # Add timestamp if not present
            if "start_time" not in session_data:
                session_data["start_time"] = datetime.now().isoformat()
            
            # Generate a UUID for this session if not present
            if "id" not in session_data:
                session_data["id"] = str(uuid.uuid4())
            
            # Sanitize the data before saving
            sanitized_data = sanitize_data(session_data)
            
            # Save to database
            success, session_uuid = self.db_manager.save_session(sanitized_data)
            
            if success and session_uuid:
                logger.debug(f"Session saved successfully with UUID: {session_uuid}")
                # Store the session UUID for use in events
                self.session_uuid = session_uuid
                return True
            else:
                logger.error("Failed to save session")
                return False
            
        except Exception as e:
            logger.error(f"Exception saving session: {e}")
            return False
    
    def get_database_status(self) -> Dict[str, Any]:
        """Get current database connection status."""
        if not self.db_manager:
            return {"status": "unavailable", "error": "Database manager not initialized"}
        
        try:
            return self.db_manager.health_check()
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def validate_file_path(self, file_path: str) -> bool:
        """Validate that a file path is safe and accessible."""
        try:
            return self.security_validator.validate_file_path(file_path)
        except:
            # Fallback validation for UV compatibility
            import os
            return os.path.exists(file_path) and os.path.isfile(file_path)
    
    def check_input_size(self, data: Any) -> bool:
        """Check if input data size is within acceptable limits."""
        try:
            return self.security_validator.validate_input_size(data)
        except:
            # Fallback for UV compatibility
            import sys
            try:
                size = sys.getsizeof(data)
                return size < 10 * 1024 * 1024  # 10MB limit
            except:
                return True
    
    def detect_sensitive_data(self, data: Any) -> Dict[str, List[str]]:
        """Detect potentially sensitive data in input."""
        try:
            return self.security_validator.detect_sensitive_data(data)
        except:
            # Fallback for UV compatibility
            return {}
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get security-related metrics and alerts."""
        try:
            return {
                "validation_calls": getattr(self.security_validator, 'validation_calls', 0),
                "blocked_operations": getattr(self.security_validator, 'blocked_operations', 0),
                "last_validation": datetime.now().isoformat()
            }
        except:
            return {}
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for this hook instance."""
        try:
            return self.performance_collector.get_metrics()
        except:
            return {}
    
    def reset_performance_metrics(self) -> None:
        """Reset performance metrics for this hook instance."""
        try:
            self.performance_collector.reset()
        except:
            pass


# Helper functions for creating event data
def create_event_data(event_type: str, hook_event_name: str, 
                     data: Optional[Dict[str, Any]] = None,
                     metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create standardized event data structure.
    
    Args:
        event_type: The database event type
        hook_event_name: The hook name for identification
        data: Event-specific data
        metadata: Additional metadata
        
    Returns:
        Properly structured event data dictionary
    """
    event_data = {
        "event_type": event_type,
        "hook_event_name": hook_event_name,
        "timestamp": datetime.now().isoformat(),
        "data": data or {},
    }
    
    if metadata:
        event_data["metadata"] = metadata
    
    return event_data


def setup_hook_logging(hook_name: str, log_level: str = "INFO") -> logging.Logger:
    """
    Set up consistent logging for hooks with configurable options.
    
    Args:
        hook_name: Name of the hook for logger identification
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        
    Returns:
        Configured logger instance
        
    Environment Variables:
        CLAUDE_HOOKS_LOG_LEVEL: Override log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        CLAUDE_HOOKS_SILENT_MODE: Set to 'true' to suppress all non-error output
        CLAUDE_HOOKS_LOG_TO_FILE: Set to 'false' to disable file logging
    """
    # Get configuration from environment
    env_log_level = os.getenv("CLAUDE_HOOKS_LOG_LEVEL", log_level).upper()
    silent_mode = os.getenv("CLAUDE_HOOKS_SILENT_MODE", "false").lower() == "true"
    log_to_file = os.getenv("CLAUDE_HOOKS_LOG_TO_FILE", "true").lower() == "true"
    
    # Validate log level
    valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    if env_log_level not in valid_levels:
        env_log_level = "INFO"
    
    # In silent mode, only show errors
    if silent_mode:
        env_log_level = "ERROR"
    
    # Set up handlers
    handlers = []
    
    # File handler (optional)
    if log_to_file:
        chronicle_log_dir = Path.home() / ".claude" / "hooks" / "chronicle" / "logs"
        chronicle_log_dir.mkdir(parents=True, exist_ok=True)
        chronicle_log_file = chronicle_log_dir / "chronicle.log"
        file_handler = logging.FileHandler(chronicle_log_file)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        handlers.append(file_handler)
    
    # Console handler (stderr for UV scripts)
    if not silent_mode:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(logging.Formatter(
            '%(name)s - %(levelname)s - %(message)s'
        ))
        handlers.append(console_handler)
    
    # Configure logger
    logger = logging.getLogger(hook_name)
    logger.setLevel(getattr(logging, env_log_level, logging.INFO))
    
    # Clear existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Add configured handlers
    for handler in handlers:
        logger.addHandler(handler)
    
    return logger


# Compatibility imports for backward compatibility
from pathlib import Path