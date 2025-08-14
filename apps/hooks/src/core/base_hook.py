"""Base hook class for Claude Code observability hooks."""

import json
import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Optional, Generator, Tuple
import uuid

try:
    from .database import DatabaseManager
    from .utils import extract_session_context, get_git_info, sanitize_data, format_error_message
except ImportError:
    # Fallback for when running as standalone script
    from database import DatabaseManager
    from utils import extract_session_context, get_git_info, sanitize_data, format_error_message

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
        self.db_manager = DatabaseManager(self.config.get("database"))
        self.claude_session_id: Optional[str] = None  # Claude's session ID (text)
        self.session_uuid: Optional[str] = None  # Database session UUID
        self.log_file = os.path.expanduser("~/.claude/hooks_debug.log")
        
        # Ensure log directory exists
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        logger.info("BaseHook initialized")
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Extract Claude session ID from input data or environment.
        
        Args:
            input_data: Hook input data (optional)
            
        Returns:
            Claude session ID string or None if not found
        """
        # Priority: input_data > environment variable
        if input_data and "sessionId" in input_data:
            session_id = input_data["sessionId"]
            logger.debug(f"Claude session ID from input: {session_id}")
            return session_id
        
        # Try environment variable
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id:
            logger.debug(f"Claude session ID from environment: {session_id}")
            return session_id
        
        logger.warning("No Claude session ID found in input or environment")
        return None
    
    def load_project_context(self, cwd: Optional[str] = None) -> Dict[str, Any]:
        """
        Capture basic project information and context.
        
        Args:
            cwd: Working directory (defaults to current directory)
            
        Returns:
            Dictionary containing project context information
        """
        if cwd is None:
            cwd = os.getcwd()
        
        context = {
            "cwd": cwd,
            "timestamp": datetime.now().isoformat(),
            "git_info": get_git_info(cwd),
            "session_context": extract_session_context(),
        }
        
        logger.debug(f"Loaded project context for: {cwd}")
        return context
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to database with error handling.
        Automatically ensures session exists before saving event.
        
        Args:
            event_data: Event data to save
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Ensure we have session UUID - create session if needed
            if not self.session_uuid and self.claude_session_id:
                logger.debug("No session UUID available, attempting to create/find session")
                # Create a minimal session record
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success and session_uuid:
                    self.session_uuid = session_uuid
                    logger.debug(f"Created/found session with UUID: {session_uuid}")
                else:
                    logger.error("Failed to create/find session for event")
                    return False
            
            if not self.session_uuid:
                logger.error("Cannot save event: no session UUID available and no claude_session_id")
                return False
            
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
                logger.debug(f"Event saved successfully: {event_data.get('hook_event_name', 'unknown')}")
            else:
                logger.error(f"Failed to save event: {event_data.get('hook_event_name', 'unknown')}")
                self.log_error(Exception("Database save failed"), "save_event")
            
            return success
            
        except Exception as e:
            logger.error(f"Exception saving event: {format_error_message(e, 'save_event')}")
            self.log_error(e, "save_event")
            return False
    
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
    
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process hook input data and extract common fields.
        
        Args:
            input_data: Raw hook input data
            
        Returns:
            Processed and sanitized hook data
        """
        # Extract Claude session ID
        self.claude_session_id = self.get_claude_session_id(input_data)
        
        # Sanitize input
        sanitized_input = self._sanitize_input(input_data)
        
        # Extract common fields
        processed_data = {
            "hook_event_name": sanitized_input.get("hookEventName", "unknown"),
            "claude_session_id": self.claude_session_id,
            "transcript_path": sanitized_input.get("transcriptPath"),
            "cwd": sanitized_input.get("cwd", os.getcwd()),
            "raw_input": sanitized_input,
            "timestamp": datetime.now().isoformat(),
        }
        
        return processed_data
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create standardized hook response.
        
        Args:
            continue_execution: Whether Claude should continue execution
            suppress_output: Whether to hide output from transcript
            hook_specific_data: Hook-specific response data
            
        Returns:
            Formatted hook response
        """
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
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