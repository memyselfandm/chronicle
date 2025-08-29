"""
Database module compatibility layer.

This module provides backward compatibility for imports that use
'src.database' instead of 'src.lib.database'. All new code should
import directly from 'src.lib.database'.

DEPRECATED: This compatibility layer will be removed in a future version.
Please update your imports to use:
    from src.lib.database import DatabaseManager, SupabaseClient
"""

import warnings

# Re-export all public APIs from the lib module
from .lib.database import (
    DatabaseManager,
    SupabaseClient,
    DatabaseError,
    ConnectionError,
    ValidationError,
)

# Issue deprecation warning when this module is imported
warnings.warn(
    "Importing from 'src.database' is deprecated. "
    "Please use 'from src.lib.database import ...' instead.",
    DeprecationWarning,
    stacklevel=2
)

__all__ = [
    "DatabaseManager",
    "SupabaseClient",
    "DatabaseError",
    "ConnectionError",
    "ValidationError",
]
