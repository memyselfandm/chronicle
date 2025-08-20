"""
Chronicle Hooks Library - UV Compatible Shared Modules

This library provides shared functionality for Claude Code observability hooks
that can be imported by UV single-file scripts. Extracted from inline hook
implementations with updated event type mappings and optimized for performance.

Main Components:
- DatabaseManager: Unified Supabase/SQLite database interface
- BaseHook: Simplified base class for hook implementations  
- Utilities: Environment loading, data sanitization, and tool detection
"""

from .database import (
    DatabaseManager,
    DatabaseError,
    get_database_config,
    get_valid_event_types,
    normalize_event_type,
    validate_event_type
)

from .base_hook import (
    BaseHook,
    create_event_data,
    setup_hook_logging
)

from .utils import (
    load_chronicle_env,
    sanitize_data,
    validate_json,
    format_error_message,
    is_mcp_tool,
    extract_mcp_server_name,
    parse_tool_response,
    calculate_duration_ms,
    extract_session_id,
    validate_input_data,
    get_project_path,
    is_development_mode,
    setup_chronicle_directories
)

__version__ = "1.0.0"
__author__ = "Chronicle Team"

# Library-wide constants
SUPPORTED_EVENT_TYPES = [
    "prompt", "tool_use", "session_start", "session_end", "notification", "error",
    "pre_tool_use", "post_tool_use", "user_prompt_submit", "stop", "subagent_stop",
    "pre_compact", "subagent_termination", "pre_compaction"
]

# UV script compatibility note
UV_COMPATIBLE = True

__all__ = [
    # Database components
    "DatabaseManager",
    "DatabaseError", 
    "get_database_config",
    "get_valid_event_types",
    "normalize_event_type",
    "validate_event_type",
    
    # Base hook components
    "BaseHook",
    "create_event_data",
    "setup_hook_logging",
    
    # Utility functions
    "load_chronicle_env",
    "sanitize_data",
    "validate_json",
    "format_error_message",
    "is_mcp_tool",
    "extract_mcp_server_name", 
    "parse_tool_response",
    "calculate_duration_ms",
    "extract_session_id",
    "validate_input_data",
    "get_project_path",
    "is_development_mode",
    "setup_chronicle_directories",
    
    # Constants
    "SUPPORTED_EVENT_TYPES",
    "UV_COMPATIBLE"
]


def get_library_info() -> dict:
    """Get information about the Chronicle hooks library."""
    return {
        "version": __version__,
        "uv_compatible": UV_COMPATIBLE,
        "supported_event_types": SUPPORTED_EVENT_TYPES,
        "modules": ["database", "base_hook", "utils"],
        "description": "UV-compatible shared library for Claude Code observability hooks"
    }


def quick_setup() -> bool:
    """
    Quick setup function for new hook implementations.
    
    Returns:
        True if setup successful, False otherwise
    """
    try:
        # Set up directories
        if not setup_chronicle_directories():
            return False
        
        # Load environment
        load_chronicle_env()
        
        # Test database connection
        db_manager = DatabaseManager()
        if not db_manager.test_connection():
            return False
        
        return True
    except Exception:
        return False