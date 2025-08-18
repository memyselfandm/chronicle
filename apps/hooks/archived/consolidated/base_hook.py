"""
Consolidated Base Hook for UV Single-File Scripts

Minimal base hook class using consolidated dependencies, designed for easy
inlining into UV single-file scripts.

Key consolidations:
- Uses all consolidated dependencies (database, security, errors, performance, utils)
- Simplified initialization and configuration
- Essential functionality only
- Reduced complexity for single-file use
- Performance optimized for <100ms execution
"""

import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

# Import consolidated modules
from .database import ConsolidatedDatabase, DatabaseError
from .security import ConsolidatedSecurity, SecurityError, validate_and_sanitize_hook_input
from .errors import SimpleLogger, SimpleErrorHandler, with_error_handling
from .performance import measure_performance, EarlyReturnValidator, quick_cache, check_performance_threshold
from .utils import (
    sanitize_data, extract_session_context, get_git_info, 
    normalize_hook_event_name, create_hook_response, get_project_context
)


class ConsolidatedBaseHook:
    """
    Minimal base hook class for UV single-file scripts.
    
    Provides essential functionality with minimal overhead:
    - Database connectivity with fallback
    - Basic security validation
    - Simple error handling
    - Performance monitoring
    - Session management
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize with minimal configuration."""
        self.config = config or {}
        
        # Initialize core components
        self.logger = SimpleLogger(f"chronicle.{self.__class__.__name__.lower()}")
        self.error_handler = SimpleErrorHandler(self.logger)
        self.database = ConsolidatedDatabase()
        self.security = ConsolidatedSecurity(
            max_input_size_mb=self.config.get("max_input_size_mb", 10.0)
        )
        self.validator = EarlyReturnValidator()
        
        # Session state
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
        
        # Performance tracking
        self.start_time = time.perf_counter()
        
        self.logger.info("ConsolidatedBaseHook initialized")
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract Claude session ID from input data or environment."""
        # Priority: input_data > environment variable
        if input_data and "sessionId" in input_data:
            session_id = input_data["sessionId"]
            if self.validator.is_valid_session_id(session_id):
                return session_id
        
        # Try environment variable
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id and self.validator.is_valid_session_id(session_id):
            return session_id
        
        return None
    
    def load_project_context(self, cwd: Optional[str] = None) -> Dict[str, Any]:
        """Load project context information."""
        context = get_project_context(cwd)
        self.logger.debug(f"Loaded project context for: {context.get('cwd', 'unknown')}")
        return context
    
    def save_session(self, session_data: Dict[str, Any]) -> bool:
        """Save session data with error handling."""
        try:
            # Ensure we have the claude_session_id
            if "claude_session_id" not in session_data and self.claude_session_id:
                session_data["claude_session_id"] = self.claude_session_id
            
            if "claude_session_id" not in session_data:
                self.logger.warning("Cannot save session: no claude_session_id available")
                return False
            
            # Add required fields
            if "start_time" not in session_data:
                session_data["start_time"] = datetime.now().isoformat()
            
            if "id" not in session_data:
                session_data["id"] = str(uuid.uuid4())
            
            # Sanitize data
            sanitized_data = sanitize_data(session_data)
            
            # Save to database
            success, session_uuid = self.database.save_session(sanitized_data)
            
            if success and session_uuid:
                self.session_uuid = session_uuid
                self.logger.debug(f"Session saved with UUID: {session_uuid}")
                return True
            else:
                self.logger.error("Failed to save session")
                return False
                
        except Exception as e:
            self.error_handler.handle_error(e, operation="save_session")
            return False
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data with error handling."""
        try:
            # Ensure session exists
            if not self.session_uuid and self.claude_session_id:
                self.logger.debug("Creating session for event")
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                if not self.save_session(session_data):
                    self.logger.warning("Failed to create session, saving event anyway")
            
            # Add required fields
            if "session_id" not in event_data and self.session_uuid:
                event_data["session_id"] = self.session_uuid
            
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            # Sanitize data
            sanitized_data = sanitize_data(event_data)
            
            # Save to database
            success = self.database.save_event(sanitized_data)
            
            if success:
                self.logger.debug(f"Event saved: {event_data.get('hook_event_name', 'unknown')}")
                return True
            else:
                self.logger.error("Failed to save event")
                return False
                
        except Exception as e:
            self.error_handler.handle_error(e, operation="save_event")
            return False
    
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate hook input data."""
        try:
            with measure_performance("hook_data_processing"):
                # Early validation checks
                if not self.validator.is_reasonable_data_size(input_data):
                    return {
                        "hook_event_name": input_data.get("hookEventName", "Unknown"),
                        "error": "Input data too large",
                        "early_return": True,
                        "timestamp": datetime.now().isoformat(),
                    }
                
                # Security validation and sanitization
                validated_input = validate_and_sanitize_hook_input(input_data)
                
                # Extract session ID
                self.claude_session_id = self.get_claude_session_id(validated_input)
                
                # Normalize hook event name
                raw_hook_event_name = validated_input.get("hookEventName", "unknown")
                normalized_hook_event_name = normalize_hook_event_name(raw_hook_event_name)
                
                return {
                    "hook_event_name": normalized_hook_event_name,
                    "claude_session_id": self.claude_session_id,
                    "transcript_path": validated_input.get("transcriptPath"),
                    "cwd": validated_input.get("cwd", os.getcwd()),
                    "raw_input": validated_input,
                    "timestamp": datetime.now().isoformat(),
                }
                
        except SecurityError as e:
            self.logger.error(f"Security validation failed: {e}")
            return {
                "hook_event_name": "SecurityViolation",
                "error_type": "SecurityError",
                "error_message": str(e),
                "timestamp": datetime.now().isoformat(),
            }
            
        except Exception as e:
            self.error_handler.handle_error(e, operation="process_hook_data")
            return {
                "hook_event_name": input_data.get("hookEventName", "Unknown"),
                "error": "Processing failed",
                "timestamp": datetime.now().isoformat(),
            }
    
    def create_response(self, continue_execution: bool = True,
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None,
                       stop_reason: Optional[str] = None) -> Dict[str, Any]:
        """Create standardized hook response."""
        return create_hook_response(
            continue_execution=continue_execution,
            suppress_output=suppress_output,
            hook_specific_data=hook_specific_data,
            stop_reason=stop_reason
        )
    
    @with_error_handling("execute_hook")
    def execute_hook_optimized(self, input_data: Dict[str, Any], hook_func: callable) -> Dict[str, Any]:
        """Execute hook with full optimization pipeline."""
        execution_start = time.perf_counter()
        
        try:
            # Process input data
            processed_data = self.process_hook_data(input_data)
            
            if processed_data.get("early_return") or processed_data.get("error"):
                # Return early for invalid input
                execution_time = (time.perf_counter() - execution_start) * 1000
                processed_data["execution_time_ms"] = execution_time
                return self.create_response(
                    continue_execution=True,
                    suppress_output=True,
                    hook_specific_data=processed_data
                )
            
            # Execute the hook function
            result = hook_func(processed_data)
            
            # Add execution metadata
            execution_time = (time.perf_counter() - execution_start) * 1000
            result["execution_time_ms"] = execution_time
            
            # Check performance threshold
            check_performance_threshold(execution_time, f"hook.{hook_func.__name__}")
            
            return result
            
        except Exception as e:
            execution_time = (time.perf_counter() - execution_start) * 1000
            self.logger.error(f"Hook execution failed after {execution_time:.2f}ms: {e}")
            
            return self.create_response(
                continue_execution=True,
                suppress_output=True,
                hook_specific_data={
                    "error": f"Execution failed: {str(e)[:100]}",
                    "execution_time_ms": execution_time
                }
            )
    
    def get_status(self) -> Dict[str, Any]:
        """Get hook and database status."""
        return {
            "hook_initialized": True,
            "database_status": self.database.get_status(),
            "session_id": self.claude_session_id,
            "session_uuid": self.session_uuid,
            "uptime_ms": (time.perf_counter() - self.start_time) * 1000
        }


# Factory function for easy instantiation
def create_hook(config: Optional[Dict[str, Any]] = None) -> ConsolidatedBaseHook:
    """Create and return a consolidated base hook instance."""
    return ConsolidatedBaseHook(config)


# Decorator for creating hook functions with automatic base hook functionality
def consolidated_hook(hook_name: str = None):
    """
    Decorator to create a hook function with consolidated functionality.
    
    Usage:
        @consolidated_hook("SessionStart")
        def my_hook(processed_data):
            return {"continue": True}
    """
    def decorator(func):
        def wrapper(input_data: Dict[str, Any]) -> Dict[str, Any]:
            hook = create_hook()
            
            # Set hook name from decorator or function name
            actual_hook_name = hook_name or func.__name__.replace("_", "").title()
            
            # Execute with optimization
            def hook_execution(processed_data):
                # Add hook event name to processed data
                processed_data["hook_event_name"] = actual_hook_name
                return func(processed_data)
            
            return hook.execute_hook_optimized(input_data, hook_execution)
        
        return wrapper
    return decorator