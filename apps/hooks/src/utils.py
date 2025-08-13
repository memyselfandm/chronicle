"""Utility functions for Claude Code observability hooks."""

import json
import os
import re
import subprocess
from typing import Any, Dict, Optional, Union
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Patterns for sensitive data detection
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'"api_key"\s*:\s*"[^"]*"',
        r"'api_key'\s*:\s*'[^']*'",
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*',  # JWT tokens
    ],
    "passwords": [
        r'"password"\s*:\s*"[^"]*"',
        r"'password'\s*:\s*'[^']*'",
        r'"supabase_key"\s*:\s*"[^"]*"',
        r"'supabase_key'\s*:\s*'[^']*'",
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
    ]
}

# Maximum data size for validation (10MB)
MAX_DATA_SIZE = 10 * 1024 * 1024


def sanitize_data(data: Any) -> Any:
    """
    Remove sensitive information from data structures.
    
    Args:
        data: The data structure to sanitize
        
    Returns:
        Sanitized data with sensitive information removed/masked
    """
    if data is None:
        return None
    
    # Convert to string for pattern matching
    data_str = json.dumps(data) if not isinstance(data, str) else data
    
    # Replace sensitive patterns
    sanitized_str = data_str
    
    # Remove API keys and tokens
    for pattern in SENSITIVE_PATTERNS["api_keys"]:
        sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str, flags=re.IGNORECASE)
    
    # Remove passwords and secrets
    for pattern in SENSITIVE_PATTERNS["passwords"]:
        sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str, flags=re.IGNORECASE)
    
    # Replace user paths with generic ones
    for pattern in SENSITIVE_PATTERNS["user_paths"]:
        sanitized_str = re.sub(pattern, '/Users/[USER]', sanitized_str)
    
    # Try to convert back to original structure
    try:
        if isinstance(data, dict):
            return json.loads(sanitized_str)
        elif isinstance(data, str):
            return sanitized_str
        else:
            return json.loads(sanitized_str)
    except json.JSONDecodeError:
        # If we can't parse it back, return the sanitized string
        return sanitized_str


def extract_session_context() -> Dict[str, Optional[str]]:
    """
    Extract Claude session information from environment variables.
    
    Returns:
        Dictionary containing session context information
    """
    return {
        "session_id": os.getenv("CLAUDE_SESSION_ID"),
        "transcript_path": os.getenv("CLAUDE_TRANSCRIPT_PATH"),
        "cwd": os.getcwd(),
        "user": os.getenv("USER", "unknown"),
        "timestamp": None,  # Will be set by caller
    }


def validate_json(data: Any) -> bool:
    """
    Validate JSON data for safety and size constraints.
    
    Args:
        data: Data to validate
        
    Returns:
        True if data is valid, False otherwise
    """
    if data is None:
        return False
    
    try:
        # Convert to JSON string to check size
        json_str = json.dumps(data)
        
        # Check size limit
        if len(json_str.encode('utf-8')) > MAX_DATA_SIZE:
            logger.warning(f"Data size exceeds limit: {len(json_str)} bytes")
            return False
        
        # Verify it's valid JSON by parsing it back
        json.loads(json_str)
        
        return True
        
    except (TypeError, json.JSONEncodeError, OverflowError) as e:
        logger.warning(f"Invalid JSON data: {e}")
        return False


def get_git_info(cwd: Optional[str] = None) -> Dict[str, Any]:
    """
    Safely extract git branch and commit information.
    
    Args:
        cwd: Working directory to check for git info (default: current directory)
        
    Returns:
        Dictionary containing git information
    """
    git_info = {
        "branch": None,
        "commit_hash": None,
        "is_git_repo": False,
        "has_changes": False,
        "error": None
    }
    
    if cwd is None:
        cwd = os.getcwd()
    
    try:
        # Check if it's a git repository
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode != 0:
            git_info["error"] = "Not a git repository"
            return git_info
        
        git_info["is_git_repo"] = True
        
        # Get current branch
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout.strip():
            git_info["branch"] = result.stdout.strip()
        
        # Get current commit hash
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout.strip():
            git_info["commit_hash"] = result.stdout.strip()[:8]  # Short hash
        
        # Check for uncommitted changes
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            git_info["has_changes"] = bool(result.stdout.strip())
        
    except subprocess.TimeoutExpired:
        git_info["error"] = "Git command timed out"
    except subprocess.CalledProcessError as e:
        git_info["error"] = f"Git command failed: {e}"
    except FileNotFoundError:
        git_info["error"] = "Git not found in PATH"
    except Exception as e:
        git_info["error"] = f"Unexpected error: {e}"
    
    return git_info


def format_error_message(error: Exception, context: Optional[str] = None) -> str:
    """
    Format error messages for consistent logging.
    
    Args:
        error: The exception that occurred
        context: Optional context about where the error occurred
        
    Returns:
        Formatted error message string
    """
    error_type = type(error).__name__
    error_msg = str(error)
    
    if context:
        return f"[{context}] {error_type}: {error_msg}"
    else:
        return f"{error_type}: {error_msg}"


def safe_json_loads(json_str: str, default: Any = None) -> Any:
    """
    Safely load JSON string with fallback.
    
    Args:
        json_str: JSON string to parse
        default: Default value to return if parsing fails
        
    Returns:
        Parsed JSON data or default value
    """
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default