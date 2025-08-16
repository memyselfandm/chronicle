"""
Base hook class for Claude Code observability hooks - UV Compatible Library Module.

Simplified version extracted from inline hook implementations for UV script compatibility.
Removes async features and heavy dependencies not needed for single-file UV scripts.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

try:
    from .database import DatabaseManager
    from .utils import sanitize_data
except ImportError:
    # For UV script compatibility
    from database import DatabaseManager
    from utils import sanitize_data

# Configure logger
logger = logging.getLogger(__name__)


class BaseHook:
    """Simplified base hook for UV script performance and compatibility."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the base hook with minimal dependencies."""
        self.config = config or {}
        self.db_manager = DatabaseManager(self.config.get("database"))
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract Claude session ID as per Claude Code spec."""
        session_id = None
        if input_data and "session_id" in input_data:
            session_id = input_data["session_id"]
            logger.debug(f"Session ID from input data: {session_id}")
        else:
            session_id = os.getenv("CLAUDE_SESSION_ID")
            logger.debug(f"Session ID from environment: {session_id}")
        return session_id
    
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
    Set up consistent logging for hooks.
    
    Args:
        hook_name: Name of the hook for logger identification
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        
    Returns:
        Configured logger instance
    """
    # Set up chronicle-specific logging
    chronicle_log_dir = Path.home() / ".claude" / "hooks" / "chronicle" / "logs"
    chronicle_log_dir.mkdir(parents=True, exist_ok=True)
    chronicle_log_file = chronicle_log_dir / "chronicle.log"
    
    # Configure logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(chronicle_log_file),
            logging.StreamHandler()  # Also log to stderr for UV scripts
        ]
    )
    
    return logging.getLogger(hook_name)


# Compatibility imports for backward compatibility
from pathlib import Path