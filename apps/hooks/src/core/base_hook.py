"""Base hook class for Claude Code observability hooks."""

import json
import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Optional, Generator, Tuple, List, Callable
import uuid

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
    # Fallback for when running as standalone script
    from database import DatabaseManager
    from utils import (
        extract_session_context, get_git_info, sanitize_data, format_error_message,
        resolve_project_path, get_project_context_with_env_support, validate_environment_setup
    )
    from security import SecurityValidator, SecurityError, PathTraversalError, InputSizeError
    from errors import (
        ChronicleLogger, ErrorHandler, error_context, with_error_handling,
        get_log_level_from_env, DatabaseError, ValidationError, HookExecutionError
    )
    from performance import (
        measure_performance, performance_monitor, get_performance_collector,
        get_hook_cache, EarlyReturnValidator, PerformanceMetrics
    )

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
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the base hook.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        
        # Initialize enhanced error handling and logging
        self.chronicle_logger = ChronicleLogger(
            name=f"chronicle.{self.__class__.__name__.lower()}",
            log_level=get_log_level_from_env()
        )
        self.error_handler = ErrorHandler(self.chronicle_logger)
        
        # Initialize performance monitoring
        self.performance_collector = get_performance_collector()
        self.hook_cache = get_hook_cache()
        self.early_validator = EarlyReturnValidator()
        
        # Initialize database manager with error handling
        try:
            with error_context("database_manager_init"):
                self.db_manager = DatabaseManager(self.config.get("database"))
        except Exception as e:
            should_continue, exit_code, message = self.error_handler.handle_error(
                e, {"component": "database_manager"}, "database_init"
            )
            # Continue with limited functionality - database failures shouldn't break hooks
            self.db_manager = None
            self.chronicle_logger.warning("Database manager initialization failed, continuing with limited functionality")
        
        self.claude_session_id: Optional[str] = None  # Claude's session ID (text)
        self.session_uuid: Optional[str] = None  # Database session UUID
        
        # Initialize security validator with configuration and error handling
        try:
            security_config = self.config.get("security", {})
            max_input_size_mb = security_config.get("max_input_size_mb", 10.0)
            allowed_base_paths = security_config.get("allowed_base_paths")
            allowed_commands = security_config.get("allowed_commands")
            
            self.security_validator = SecurityValidator(
                max_input_size_mb=max_input_size_mb,
                allowed_base_paths=allowed_base_paths,
                allowed_commands=allowed_commands
            )
        except Exception as e:
            should_continue, exit_code, message = self.error_handler.handle_error(
                e, {"component": "security_validator"}, "security_init"
            )
            # Use default security validator on failure
            self.security_validator = SecurityValidator()
            self.chronicle_logger.warning("Security validator initialization failed, using defaults")
        
        # Legacy log file for backward compatibility
        self.log_file = os.path.expanduser("~/.claude/hooks_debug.log")
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        self.chronicle_logger.info("BaseHook initialized", {
            "hook_class": self.__class__.__name__,
            "database_available": self.db_manager is not None,
            "security_enabled": self.security_validator is not None
        })
    
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
            # Early validation of session ID format
            if not self.early_validator.is_valid_session_id(session_id):
                logger.warning(f"Invalid session ID format: {session_id}")
                return None
            logger.debug(f"Claude session ID from input: {session_id}")
            return session_id
        
        # Try environment variable
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id:
            # Early validation of session ID format
            if not self.early_validator.is_valid_session_id(session_id):
                logger.warning(f"Invalid session ID format from environment: {session_id}")
                return None
            logger.debug(f"Claude session ID from environment: {session_id}")
            return session_id
        
        logger.warning("No Claude session ID found in input or environment")
        return None
    
    def load_project_context(self, cwd: Optional[str] = None) -> Dict[str, Any]:
        """
        Capture project information and context with enhanced environment variable support.
        
        Args:
            cwd: Working directory (defaults to resolved project directory from CLAUDE_PROJECT_DIR)
            
        Returns:
            Dictionary containing project context information
        """
        # Use enhanced environment-aware project context function
        context = get_project_context_with_env_support(cwd)
        context["timestamp"] = datetime.now().isoformat()
        
        resolved_cwd = context.get("cwd", os.getcwd())
        logger.debug(f"Loaded project context for: {resolved_cwd}")
        
        # Log environment variable usage for debugging
        if context.get("resolved_from_env"):
            logger.debug(f"Project context resolved from CLAUDE_PROJECT_DIR: {context.get('claude_project_dir')}")
        
        return context
    
    def validate_environment(self) -> Dict[str, Any]:
        """
        Validate the environment setup for the hooks system.
        
        Returns:
            Dictionary containing validation results, warnings, and recommendations
        """
        return validate_environment_setup()
    
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
        except ValueError as e:
            self.chronicle_logger.warning(f"Failed to resolve project path: {e}")
            return os.getcwd()
    
    @with_error_handling(operation="save_event")
    @performance_monitor("database.save_event")
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to database with comprehensive error handling.
        Automatically ensures session exists before saving event.
        
        Args:
            event_data: Event data to save
            
        Returns:
            True if successful, False otherwise (graceful degradation)
        """
        if not self.db_manager:
            self.chronicle_logger.warning("Database manager not available, skipping event save")
            return False
            
        with error_context("save_event", {"event_type": event_data.get("event_type")}) as handler:
            # Ensure we have session UUID - create session if needed
            if not self.session_uuid and self.claude_session_id:
                self.chronicle_logger.debug("No session UUID available, attempting to create/find session")
                # Create a minimal session record
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success and session_uuid:
                    self.session_uuid = session_uuid
                    self.chronicle_logger.debug(f"Created/found session with UUID: {session_uuid}")
                else:
                    raise DatabaseError("Failed to create/find session for event")
            
            if not self.session_uuid:
                raise ValidationError("Cannot save event: no session UUID available and no claude_session_id")
            
            # Use the database session UUID for the foreign key
            if "session_id" not in event_data:
                event_data["session_id"] = self.session_uuid
            
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            
            # Add event ID if not present
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            # Sanitize the data before saving
            sanitized_data = sanitize_data(event_data)
            
            # Save to database
            success = self.db_manager.save_event(sanitized_data)
            
            if success:
                self.chronicle_logger.debug(
                    f"Event saved successfully: {event_data.get('hook_event_name', 'unknown')}",
                    {"event_id": event_data.get("event_id"), "session_id": self.session_uuid}
                )
                return True
            else:
                raise DatabaseError(f"Failed to save event: {event_data.get('hook_event_name', 'unknown')}")
                
        # This should not be reached due to error handling, but provides fallback
        return False
    
    @performance_monitor("database.save_session")
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
                self.log_error(Exception("Session save failed"), "save_session")
                return False
            
        except Exception as e:
            logger.error(f"Exception saving session: {format_error_message(e, 'save_session')}")
            self.log_error(e, "save_session")
            return False
    
    def log_error(self, error: Exception, context: Optional[str] = None) -> None:
        """
        Log error to local file for debugging.
        
        Args:
            error: Exception that occurred
            context: Optional context about where the error occurred
        """
        try:
            timestamp = datetime.now().isoformat()
            error_msg = format_error_message(error, context)
            
            log_entry = f"[{timestamp}] {error_msg}\n"
            
            # Append to log file
            with open(self.log_file, 'a') as f:
                f.write(log_entry)
                
            logger.debug(f"Error logged to {self.log_file}")
            
        except Exception as log_error:
            # Don't let logging errors break the hook
            logger.error(f"Failed to write to log file: {log_error}")
    
    def _sanitize_input(self, input_data: Any) -> Any:
        """
        Sanitize input data for safe processing.
        
        Args:
            input_data: Raw input data
            
        Returns:
            Sanitized input data
        """
        return sanitize_data(input_data)
    
    def _normalize_hook_event_name(self, hook_event_name: str) -> str:
        """
        Normalize hook event name to PascalCase format.
        
        Converts snake_case event names to PascalCase to match Claude Code documentation.
        
        Args:
            hook_event_name: Raw hook event name (may be snake_case or PascalCase)
            
        Returns:
            Normalized PascalCase event name
        """
        if not hook_event_name:
            return "Unknown"
        
        # Define the mapping from snake_case to PascalCase
        event_name_mapping = {
            "session_start": "SessionStart",
            "pre_tool_use": "PreToolUse",
            "post_tool_use": "PostToolUse", 
            "user_prompt_submit": "UserPromptSubmit",
            "pre_compact": "PreCompact",
            "notification": "Notification",
            "stop": "Stop",
            "subagent_stop": "SubagentStop"
        }
        
        # If it's already in the mapping (snake_case), convert to PascalCase
        if hook_event_name.lower() in event_name_mapping:
            return event_name_mapping[hook_event_name.lower()]
        
        # If it's already PascalCase, return as-is
        if hook_event_name in event_name_mapping.values():
            return hook_event_name
        
        # For unknown event names, attempt a generic conversion
        if "_" in hook_event_name:
            # Convert snake_case to PascalCase
            words = hook_event_name.split("_")
            return "".join(word.capitalize() for word in words)
        
        # Return as-is if no conversion needed
        return hook_event_name
    
    @contextmanager
    def _measure_execution_time(self) -> Generator[ExecutionTimer, None, None]:
        """
        Context manager for measuring execution time.
        
        Yields:
            ExecutionTimer instance for measuring duration
        """
        timer = ExecutionTimer()
        with timer:
            yield timer
    
    @performance_monitor("hook.process_data", track_memory=True)
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process hook input data with comprehensive security validation and performance optimization.
        
        Args:
            input_data: Raw hook input data
            
        Returns:
            Processed and sanitized hook data
            
        Raises:
            SecurityError: If input fails security validation
        """
        try:
            # Fast validation check with early return
            is_valid, error_message = self._fast_validation_check(input_data)
            if not is_valid:
                logger.warning(f"Fast validation failed: {error_message}")
                # Return minimal error response instead of raising exception
                return {
                    "hook_event_name": input_data.get("hookEventName", "Unknown"),
                    "claude_session_id": None,
                    "error": error_message,
                    "early_return": True,
                    "timestamp": datetime.now().isoformat(),
                }
            
            # Check cache for repeated identical requests
            cache_key = self._generate_input_cache_key(input_data)
            cached_result = self.hook_cache.get(cache_key)
            if cached_result:
                logger.debug("Returning cached result for hook data processing")
                return cached_result
            
            # Perform comprehensive security validation and sanitization
            with measure_performance("security_validation") as validation_metrics:
                validated_input = self.security_validator.comprehensive_validation(input_data)
            
            # Log security validation time
            validation_time = validation_metrics.duration_ms
            if validation_time > 5.0:  # Warn if validation takes more than 5ms
                logger.warning(f"Security validation took {validation_time:.2f}ms (target <5ms)")
            else:
                logger.debug(f"Security validation completed in {validation_time:.2f}ms")
            
            # Extract Claude session ID
            self.claude_session_id = self.get_claude_session_id(validated_input)
            
            # Additional sanitization using legacy sanitize_data for compatibility
            sanitized_input = self._sanitize_input(validated_input)
            
            # Ensure sanitized_input is always a dict (in case sanitize_data returns a string)
            if not isinstance(sanitized_input, dict):
                logger.warning(f"Sanitized input is not a dict, got {type(sanitized_input)}: {str(sanitized_input)[:100]}")
                # Try to recreate a basic dict structure
                sanitized_input = {
                    "hookEventName": validated_input.get("hookEventName", "unknown"),
                    "sanitized_content": str(sanitized_input)[:1000]  # Truncate for safety
                }
            
            # Extract common fields
            raw_hook_event_name = sanitized_input.get("hookEventName", "unknown")
            normalized_hook_event_name = self._normalize_hook_event_name(raw_hook_event_name)
            
            processed_data = {
                "hook_event_name": normalized_hook_event_name,
                "claude_session_id": self.claude_session_id,
                "transcript_path": sanitized_input.get("transcriptPath"),
                "cwd": sanitized_input.get("cwd", os.getcwd()),
                "raw_input": sanitized_input,
                "timestamp": datetime.now().isoformat(),
                "security_validation_time_ms": validation_time,
            }
            
            # Cache the processed result for potential reuse
            self.hook_cache.set(cache_key, processed_data)
            
            return processed_data
            
        except SecurityError as e:
            logger.error(f"Security validation failed: {e}")
            self.log_error(e, "security_validation")
            
            # For security violations, we still want to log the attempt but with sanitized data
            fallback_data = {
                "hook_event_name": "SecurityViolation",
                "claude_session_id": self.get_claude_session_id(input_data),
                "error_type": type(e).__name__,
                "error_message": str(e),
                "timestamp": datetime.now().isoformat(),
                "raw_input": "[BLOCKED_FOR_SECURITY]",
            }
            return fallback_data
            
        except Exception as e:
            logger.error(f"Unexpected error in hook data processing: {e}")
            self.log_error(e, "process_hook_data")
            raise
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None,
                       stop_reason: Optional[str] = None) -> Dict[str, Any]:
        """
        Create standardized hook response with new JSON format support.
        
        Args:
            continue_execution: Whether Claude should continue execution
            suppress_output: Whether to hide output from transcript
            hook_specific_data: Hook-specific response data for hookSpecificOutput
            stop_reason: Reason for stopping execution (when continue_execution=False)
            
        Returns:
            Formatted hook response with proper continue, suppressOutput, stopReason, and hookSpecificOutput fields
        """
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        # Add stopReason when execution is blocked
        if not continue_execution and stop_reason:
            response["stopReason"] = stop_reason
        
        # Add hookSpecificOutput if provided
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
    def create_hook_specific_output(self, hook_event_name: str, **kwargs) -> Dict[str, Any]:
        """
        Create hookSpecificOutput dictionary with consistent field naming.
        
        Converts snake_case parameter names to camelCase for hookSpecificOutput.
        
        Args:
            hook_event_name: Name of the hook event (e.g., "SessionStart", "PostToolUse")
            **kwargs: Additional fields to include in hookSpecificOutput
            
        Returns:
            Dictionary formatted for hookSpecificOutput with camelCase field names
        """
        output = {"hookEventName": hook_event_name}
        
        # Convert snake_case keys to camelCase for hookSpecificOutput
        for key, value in kwargs.items():
            if value is not None:  # Only include non-None values
                camel_key = self._snake_to_camel(key)
                output[camel_key] = value
        
        return output
    
    def create_permission_response(self, decision: str, reason: str, 
                                 hook_event_name: str = "PostToolUse",
                                 **kwargs) -> Dict[str, Any]:
        """
        Create permission-based response for tool execution decisions.
        
        Args:
            decision: Permission decision ("allow", "deny", "ask")
            reason: Reason for the decision
            hook_event_name: Name of the hook event
            **kwargs: Additional fields for hookSpecificOutput
            
        Returns:
            Formatted response with permission decision
        """
        # Determine continue/stop behavior based on decision
        if decision == "allow":
            continue_execution = True
            stop_reason = None
        elif decision == "deny":
            continue_execution = False
            stop_reason = reason
        elif decision == "ask":
            continue_execution = False
            stop_reason = reason
        else:
            # Unknown decision - default to allow but log warning
            logger.warning(f"Unknown permission decision: {decision}, defaulting to allow")
            continue_execution = True
            stop_reason = None
        
        # Create hookSpecificOutput with permission fields
        hook_data = self.create_hook_specific_output(
            hook_event_name=hook_event_name,
            permission_decision=decision,
            permission_decision_reason=reason,
            **kwargs
        )
        
        return self.create_response(
            continue_execution=continue_execution,
            suppress_output=False,  # Permission decisions should be visible
            hook_specific_data=hook_data,
            stop_reason=stop_reason
        )
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """
        Convert snake_case string to camelCase.
        
        Args:
            snake_str: String in snake_case format
            
        Returns:
            String in camelCase format
        """
        if not snake_str:
            return snake_str
        
        components = snake_str.split('_')
        # Keep first component lowercase, capitalize the rest
        return components[0] + ''.join(word.capitalize() for word in components[1:])
    
    def _generate_input_cache_key(self, input_data: Dict[str, Any]) -> str:
        """
        Generate a cache key for input data processing.
        
        Args:
            input_data: Raw hook input data
            
        Returns:
            String cache key based on essential input characteristics
        """
        # Create stable key from essential fields only
        key_data = {
            "hook_event": input_data.get("hookEventName", "unknown"),
            "session_id_hash": str(hash(input_data.get("sessionId", "")))[:8],  # Hash for privacy
            "tool_name": input_data.get("toolName", ""),
            "cwd_hash": str(hash(input_data.get("cwd", "")))[:8] if input_data.get("cwd") else "",
        }
        
        # Include tool input signature if present (but not content for security)
        tool_input = input_data.get("toolInput", {})
        if isinstance(tool_input, dict):
            key_data["tool_input_keys"] = sorted(tool_input.keys())
        
        return f"hook_process:{json.dumps(key_data, sort_keys=True)}"
    
    def _fast_validation_check(self, input_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Perform fast validation checks for early return scenarios.
        
        Args:
            input_data: Raw hook input data
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check basic structure
        if not isinstance(input_data, dict):
            return (False, "Input data must be a dictionary")
        
        # Check for required hook event name
        hook_event = input_data.get("hookEventName")
        if not self.early_validator.is_valid_hook_event(hook_event):
            return (False, f"Invalid or missing hookEventName: {hook_event}")
        
        # Check data size early
        if not self.early_validator.is_reasonable_data_size(input_data, max_size_mb=10.0):
            return (False, "Input data exceeds 10MB size limit")
        
        # Check session ID if present
        session_id = input_data.get("sessionId")
        if session_id and not self.early_validator.is_valid_session_id(session_id):
            return (False, f"Invalid session ID format: {session_id}")
        
        # All checks passed
        return (True, None)
    
    def _create_early_return_response(self, error_message: str, hook_event_name: str = "Unknown") -> Dict[str, Any]:
        """
        Create standardized early return response for validation failures.
        
        Args:
            error_message: Error message describing the failure
            hook_event_name: Hook event name for context
            
        Returns:
            Formatted hook response with error details
        """
        hook_data = self.create_hook_specific_output(
            hook_event_name=hook_event_name,
            validation_error=True,
            error_message=error_message,
            early_return=True
        )
        
        return self.create_response(
            continue_execution=True,  # Don't block Claude execution for validation errors
            suppress_output=True,     # Don't clutter transcript with validation failures
            hook_specific_data=hook_data
        )
    
    def get_database_status(self) -> Dict[str, Any]:
        """
        Get current database connection status.
        
        Returns:
            Dictionary with database status information
        """
        try:
            return self.db_manager.get_status()
        except Exception as e:
            logger.error(f"Failed to get database status: {format_error_message(e)}")
            return {"error": str(e)}
    
    def validate_file_path(self, file_path: str) -> bool:
        """
        Validate file path for security (path traversal prevention).
        
        Args:
            file_path: Path to validate
            
        Returns:
            True if path is valid and safe, False otherwise
        """
        try:
            result = self.security_validator.validate_file_path(file_path)
            return result is not None
        except (PathTraversalError, SecurityError) as e:
            logger.warning(f"File path validation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in file path validation: {e}")
            return False
    
    def check_input_size(self, data: Any) -> bool:
        """
        Check if input data size is within acceptable limits.
        
        Args:
            data: Data to check
            
        Returns:
            True if size is acceptable, False otherwise
        """
        try:
            return self.security_validator.validate_input_size(data)
        except InputSizeError as e:
            logger.warning(f"Input size check failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in input size check: {e}")
            return False
    
    def escape_shell_command(self, command: str, args: List[str]) -> List[str]:
        """
        Safely escape shell command and arguments.
        
        Args:
            command: Base command
            args: List of command arguments
            
        Returns:
            List of escaped command parts
        """
        try:
            allowed_commands = self.config.get("security", {}).get("allowed_commands", set())
            return self.security_validator.shell_escaper.safe_command_construction(
                command, args, allowed_commands
            )
        except Exception as e:
            logger.error(f"Shell command escaping failed: {e}")
            # Return safely quoted arguments as fallback
            return [command] + [self.security_validator.escape_shell_argument(arg) for arg in args]
    
    def detect_sensitive_data(self, data: Any) -> Dict[str, List[str]]:
        """
        Detect sensitive data patterns in input.
        
        Args:
            data: Data to analyze
            
        Returns:
            Dictionary of detected sensitive data by category
        """
        try:
            return self.security_validator.sensitive_data_detector.detect_sensitive_data(data)
        except Exception as e:
            logger.error(f"Sensitive data detection failed: {e}")
            return {}
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """
        Get security validation metrics.
        
        Returns:
            Dictionary containing security metrics
        """
        try:
            return self.security_validator.get_security_metrics()
        except Exception as e:
            logger.error(f"Failed to get security metrics: {e}")
            return {"error": str(e)}
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for this hook instance.
        
        Returns:
            Dictionary containing performance statistics and cache info
        """
        try:
            return {
                "performance_stats": self.performance_collector.get_statistics(),
                "cache_stats": self.hook_cache.stats(),
                "thresholds": self.performance_collector.thresholds,
                "hook_class": self.__class__.__name__
            }
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {"error": str(e)}
    
    def reset_performance_metrics(self) -> None:
        """Reset performance metrics and cache for clean testing."""
        try:
            self.performance_collector.reset_stats()
            self.hook_cache.clear()
            logger.debug("Performance metrics and cache reset")
        except Exception as e:
            logger.error(f"Failed to reset performance metrics: {e}")
    
    @performance_monitor("hook.execute_optimized")
    def execute_hook_optimized(self, input_data: Dict[str, Any], hook_func: Callable) -> Dict[str, Any]:
        """
        Execute hook with full performance optimization pipeline.
        
        This method provides the fastest possible hook execution path with:
        - Early validation and return
        - Caching for repeated operations  
        - Performance monitoring
        - Graceful error handling
        
        Args:
            input_data: Raw hook input data
            hook_func: Hook processing function to execute
            
        Returns:
            Hook response with performance metadata
        """
        start_time = time.perf_counter()
        
        try:
            # Step 1: Fast validation (target: <1ms)
            is_valid, error_message = self._fast_validation_check(input_data)
            if not is_valid:
                execution_time = (time.perf_counter() - start_time) * 1000
                return self._create_early_return_response(
                    error_message, 
                    input_data.get("hookEventName", "Unknown")
                ).update({"execution_time_ms": execution_time}) or self._create_early_return_response(
                    error_message, 
                    input_data.get("hookEventName", "Unknown")
                )
            
            # Step 2: Check cache (target: <1ms)
            cache_key = self._generate_input_cache_key(input_data)
            cached_result = self.hook_cache.get(cache_key)
            if cached_result:
                execution_time = (time.perf_counter() - start_time) * 1000
                cached_result["execution_time_ms"] = execution_time
                cached_result["cached"] = True
                logger.debug(f"Returning cached result for {input_data.get('hookEventName')} in {execution_time:.2f}ms")
                return cached_result
            
            # Step 3: Process data with security validation (target: <10ms)
            processed_data = self.process_hook_data(input_data)
            if processed_data.get("early_return"):
                # Early return from processing
                execution_time = (time.perf_counter() - start_time) * 1000
                processed_data["execution_time_ms"] = execution_time
                return processed_data
            
            # Step 4: Execute hook function (target: <80ms total)
            result = hook_func(processed_data)
            
            # Step 5: Add performance metadata and cache result
            execution_time = (time.perf_counter() - start_time) * 1000
            result["execution_time_ms"] = execution_time
            result["performance_optimized"] = True
            
            # Cache successful results
            if result.get("continue", True) and execution_time < 100:  # Only cache fast, successful results
                self.hook_cache.set(cache_key, result)
            
            # Log performance warning if over threshold
            if execution_time > 100:
                logger.warning(f"Hook execution exceeded 100ms threshold: {execution_time:.2f}ms for {input_data.get('hookEventName')}")
            else:
                logger.debug(f"Hook executed successfully in {execution_time:.2f}ms for {input_data.get('hookEventName')}")
            
            return result
            
        except Exception as e:
            execution_time = (time.perf_counter() - start_time) * 1000
            logger.error(f"Hook execution failed after {execution_time:.2f}ms: {e}")
            
            return self._create_early_return_response(
                f"Hook execution error: {str(e)[:100]}", 
                input_data.get("hookEventName", "Unknown")
            )