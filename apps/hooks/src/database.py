"""
Database module compatibility layer.

This module provides backward compatibility for imports that use
'src.database' instead of 'src.core.database'. All new code should
import directly from 'src.core.database'.

DEPRECATED: This compatibility layer will be removed in a future version.
Please update your imports to use:
    from src.core.database import DatabaseManager, SupabaseClient
"""

import warnings

# Re-export all public APIs from the core module
from .core.database import (
    DatabaseManager,
    SupabaseClient,
    SQLiteClient,
    DatabaseError,
    ConnectionError,
    ValidationError,
    EnvironmentValidator,
    setup_schema_and_verify,
    validate_environment
)

# Issue deprecation warning when this module is imported
warnings.warn(
    "Importing from 'src.database' is deprecated. "
    "Please use 'from src.core.database import ...' instead.",
    DeprecationWarning,
    stacklevel=2
)

__all__ = [
    "DatabaseManager",
    "SupabaseClient", 
    "SQLiteClient",
    "DatabaseError",
    "ConnectionError",
    "ValidationError",
    "EnvironmentValidator",
    "setup_schema_and_verify",
    "validate_environment"
]