"""
Chronicle Hooks Consolidated Dependencies

Minimal, essential functionality consolidated for UV single-file scripts.
This package contains consolidated versions of all core Chronicle hook 
dependencies optimized for inline use.

Total consolidated code footprint: ~1,500 lines (vs ~5,000+ original)

Key modules:
- database: Essential database connectivity (Supabase + SQLite)
- security: Core security validation and sanitization
- errors: Simplified error handling and logging
- performance: Basic performance monitoring and caching
- utils: Essential utilities for data processing
- base_hook: Consolidated base hook class

Usage:
    from consolidated import create_hook, consolidated_hook
    
    @consolidated_hook("SessionStart")
    def session_start_hook(processed_data):
        return {"continue": True}
"""

# Import main interfaces for easy access
from .base_hook import ConsolidatedBaseHook, create_hook, consolidated_hook
from .database import ConsolidatedDatabase, create_database
from .security import ConsolidatedSecurity, create_security_validator
from .errors import SimpleLogger, SimpleErrorHandler, create_logger, create_error_handler
from .performance import SimpleCache, PerformanceTracker, create_cache, create_performance_tracker
from .utils import (
    sanitize_data, validate_json, extract_session_context, get_git_info,
    normalize_hook_event_name, create_hook_response
)

# Version info
__version__ = "1.0.0-consolidated"

# Main exports for single-file inline use
__all__ = [
    # Main hook interface
    "ConsolidatedBaseHook", "create_hook", "consolidated_hook",
    
    # Component factories
    "create_database", "create_security_validator", 
    "create_logger", "create_error_handler",
    "create_cache", "create_performance_tracker",
    
    # Essential utilities
    "sanitize_data", "validate_json", "extract_session_context",
    "get_git_info", "normalize_hook_event_name", "create_hook_response",
    
    # Core classes for advanced use
    "ConsolidatedDatabase", "ConsolidatedSecurity", 
    "SimpleLogger", "SimpleErrorHandler",
    "SimpleCache", "PerformanceTracker"
]