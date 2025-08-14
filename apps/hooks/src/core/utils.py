"""Utility functions for Claude Code observability hooks."""

import json
import os
import re
import subprocess
from typing import Any, Dict, Optional, Union
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Enhanced patterns for sensitive data detection
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'"api_key"\s*:\s*"[^"]*"',
        r"'api_key'\s*:\s*'[^']*'",
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
        r'eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*',  # JWT tokens
        r'AKIA[0-9A-Z]{16}',  # AWS access keys
        r'ghp_[a-zA-Z0-9]{36}',  # GitHub personal access tokens
        r'github_pat_[a-zA-Z0-9_]{82}',  # GitHub fine-grained tokens
        r'glpat-[a-zA-Z0-9_-]{20}',  # GitLab tokens
        r'xoxb-[0-9]{11,12}-[0-9]{11,12}-[a-zA-Z0-9]{24}',  # Slack bot tokens
        r'sk_(live|test)_[a-zA-Z0-9]{24}',  # Stripe secret keys
        r'pk_(live|test)_[a-zA-Z0-9]{24}',  # Stripe publishable keys
        r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',  # Generic API keys
        r'access[_-]?token["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',  # Access tokens
    ],
    "passwords": [
        r'"password"\s*:\s*"[^"]*"',
        r"'password'\s*:\s*'[^']*'",
        r'"supabase_key"\s*:\s*"[^"]*"',
        r"'supabase_key'\s*:\s*'[^']*'",
        r'"secret"\s*:\s*"[^"]*"',
        r"'secret'\s*:\s*'[^']*'",
        r'password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
        r'pass["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
        r'secret[_-]?key["\']?\s*[:=]\s*["\'][^"\']{8,}["\']',
        r'database[_-]?password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
    ],
    "credentials": [
        r'-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----',  # SSH private keys
        r'-----BEGIN PGP PRIVATE KEY BLOCK-----',  # PGP private keys
        r'-----BEGIN CERTIFICATE-----',  # Certificates
        r'(postgres|mysql|mongodb)://[^:]+:[^@]+@[^/]+/[^?\s]+',  # Database connection strings
    ],
    "pii": [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email addresses
        r'\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',  # Phone numbers
        r'\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b',  # SSN
        r'\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b',  # Credit card numbers
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
        r'/root/[^/\s,}]*',   # Root paths
    ]
}

# Configuration constants for security validation
DEFAULT_MAX_INPUT_SIZE_MB = 10.0
MAX_DATA_SIZE = int(DEFAULT_MAX_INPUT_SIZE_MB * 1024 * 1024)  # Legacy constant for compatibility

# Environment variable for configurable input size limit
MAX_INPUT_SIZE_MB = float(os.getenv("CHRONICLE_MAX_INPUT_SIZE_MB", DEFAULT_MAX_INPUT_SIZE_MB))


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


def validate_json(data: Any, max_size_mb: Optional[float] = None) -> bool:
    """
    Validate JSON data for safety and size constraints.
    
    Args:
        data: Data to validate
        max_size_mb: Optional custom size limit in MB (uses configured default if None)
        
    Returns:
        True if data is valid, False otherwise
    """
    if data is None:
        return False
    
    try:
        # Convert to JSON string to check size
        json_str = json.dumps(data, default=str)
        
        # Determine size limit
        if max_size_mb is None:
            size_limit_bytes = int(MAX_INPUT_SIZE_MB * 1024 * 1024)
        else:
            size_limit_bytes = int(max_size_mb * 1024 * 1024)
        
        # Check size limit
        data_size_bytes = len(json_str.encode('utf-8'))
        if data_size_bytes > size_limit_bytes:
            size_mb = data_size_bytes / (1024 * 1024)
            limit_mb = size_limit_bytes / (1024 * 1024)
            logger.warning(f"Data size {size_mb:.2f}MB exceeds limit of {limit_mb:.2f}MB")
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