"""Configuration settings for Claude Code observability hooks."""

import os
from typing import Dict, Any

# Database configuration
DEFAULT_DATABASE_CONFIG = {
    "supabase": {
        "url": None,  # Set via SUPABASE_URL environment variable
        "anon_key": None,  # Set via SUPABASE_ANON_KEY environment variable
        "timeout": 10,
        "retry_attempts": 3,
        "retry_delay": 1.0,
    },
    "sqlite": {
        "fallback_enabled": True,
        "database_path": os.path.expanduser("~/.claude/hooks_data.db"),
        "timeout": 30.0,
    }
}

# Performance settings
PERFORMANCE_CONFIG = {
    "hook_execution_timeout_ms": 100,
    "max_memory_usage_mb": 50,
    "max_event_batch_size": 100,
    "async_operations": True,
}

# Security settings
SECURITY_CONFIG = {
    "sanitize_data": True,
    "remove_api_keys": True,
    "remove_file_paths": True,
    "max_input_size_mb": 10,
    "allowed_file_extensions": [".py", ".js", ".ts", ".json", ".md", ".txt"],
}

# Logging configuration
LOGGING_CONFIG = {
    "log_level": "INFO",
    "log_file": os.path.expanduser("~/.claude/hooks.log"),
    "max_log_file_size_mb": 10,
    "log_rotation_count": 3,
    "log_errors_only": False,
}

# Session management
SESSION_CONFIG = {
    "session_timeout_hours": 24,
    "auto_cleanup_old_sessions": True,
    "max_events_per_session": 10000,
}

def get_config() -> Dict[str, Any]:
    """Get complete configuration with environment variable overrides."""
    config = {
        "database": DEFAULT_DATABASE_CONFIG.copy(),
        "performance": PERFORMANCE_CONFIG.copy(),
        "security": SECURITY_CONFIG.copy(),
        "logging": LOGGING_CONFIG.copy(),
        "session": SESSION_CONFIG.copy(),
    }
    
    # Override with environment variables
    config["database"]["supabase"]["url"] = os.getenv("SUPABASE_URL")
    config["database"]["supabase"]["anon_key"] = os.getenv("SUPABASE_ANON_KEY")
    
    # Override logging level if set
    if os.getenv("CLAUDE_HOOKS_LOG_LEVEL"):
        config["logging"]["log_level"] = os.getenv("CLAUDE_HOOKS_LOG_LEVEL")
    
    # Override database path if set
    if os.getenv("CLAUDE_HOOKS_DB_PATH"):
        config["database"]["sqlite"]["database_path"] = os.getenv("CLAUDE_HOOKS_DB_PATH")
    
    return config