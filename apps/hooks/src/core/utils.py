"""Utility functions for Claude Code observability hooks."""

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional, Union
import logging

try:
    from .cross_platform import (
        normalize_path, safe_path_join, is_absolute_path, 
        expand_environment_variables, validate_path_security,
        get_platform_info, PLATFORM
    )
except ImportError:
    from cross_platform import (
        normalize_path, safe_path_join, is_absolute_path,
        expand_environment_variables, validate_path_security,
        get_platform_info, PLATFORM
    )

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


def resolve_project_path(fallback_path: Optional[str] = None) -> str:
    """
    Resolve the project root path using CLAUDE_PROJECT_DIR environment variable
    with cross-platform compatibility.
    
    Args:
        fallback_path: Optional fallback path if environment variable is not set
        
    Returns:
        Resolved project path (absolute)
        
    Raises:
        ValueError: If no valid project path can be determined
    """
    # Check CLAUDE_PROJECT_DIR environment variable first
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if claude_project_dir:
        # Expand environment variables and normalize path
        expanded_path = expand_environment_variables(claude_project_dir)
        normalized_path = normalize_path(expanded_path)
        
        project_path = Path(normalized_path)
        if project_path.exists():
            logger.debug(f"Using project path from CLAUDE_PROJECT_DIR: {project_path}")
            return str(project_path.absolute())
        else:
            logger.warning(f"CLAUDE_PROJECT_DIR points to non-existent path: {claude_project_dir}")
    
    # Use fallback path if provided
    if fallback_path:
        expanded_fallback = expand_environment_variables(fallback_path)
        normalized_fallback = normalize_path(expanded_fallback)
        fallback = Path(normalized_fallback)
        
        if fallback.exists():
            logger.debug(f"Using fallback project path: {fallback}")
            return str(fallback.absolute())
        else:
            logger.warning(f"Fallback path does not exist: {fallback_path}")
    
    # Use current working directory as final fallback
    cwd = Path.cwd()
    normalized_cwd = normalize_path(cwd)
    logger.debug(f"Using current working directory as project path: {normalized_cwd}")
    return normalized_cwd


def resolve_project_relative_path(relative_path: str, fallback_path: Optional[str] = None) -> str:
    """
    Resolve a path relative to the project root with cross-platform safety.
    
    Args:
        relative_path: Path relative to project root (e.g., ".claude/hooks/session_start.py")
        fallback_path: Optional fallback project path if environment variable is not set
        
    Returns:
        Absolute path to the file
        
    Raises:
        ValueError: If the resolved path is invalid
    """
    project_root = resolve_project_path(fallback_path)
    
    # Use safe path joining for cross-platform compatibility
    full_path = safe_path_join(project_root, relative_path)
    normalized_path = normalize_path(full_path)
    
    # Validate path security
    security_check = validate_path_security(normalized_path)
    if not security_check["is_safe"]:
        raise ValueError(f"Path security validation failed: {security_check['errors']}")
    
    logger.debug(f"Resolved relative path '{relative_path}' to: {normalized_path}")
    return normalized_path


def get_project_context_with_env_support(cwd: Optional[str] = None) -> Dict[str, Any]:
    """
    Get project context with enhanced environment variable support.
    
    Args:
        cwd: Optional working directory (defaults to project root from environment)
        
    Returns:
        Dictionary containing enhanced project context
    """
    # Use provided cwd or resolve from environment
    if cwd is None:
        try:
            cwd = resolve_project_path()
        except ValueError:
            cwd = os.getcwd()
    
    context = {
        "cwd": cwd,
        "resolved_from_env": bool(os.getenv("CLAUDE_PROJECT_DIR")),
        "claude_project_dir": os.getenv("CLAUDE_PROJECT_DIR"),
        "git_info": get_git_info(cwd),
        "session_context": extract_session_context(),
        "environment_variables": {
            "CLAUDE_PROJECT_DIR": os.getenv("CLAUDE_PROJECT_DIR"),
            "CLAUDE_SESSION_ID": os.getenv("CLAUDE_SESSION_ID"),
            "PWD": os.getenv("PWD"),  # Current working directory from shell
        }
    }
    
    return context


def validate_environment_setup() -> Dict[str, Any]:
    """
    Validate that the environment is properly set up for Chronicle hooks
    with cross-platform compatibility checks.
    
    Returns:
        Dictionary containing validation results and recommendations
    """
    validation_result = {
        "is_valid": True,
        "warnings": [],
        "errors": [],
        "recommendations": [],
        "platform_info": get_platform_info()
    }
    
    # Check CLAUDE_PROJECT_DIR
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if not claude_project_dir:
        validation_result["warnings"].append(
            "CLAUDE_PROJECT_DIR environment variable is not set. "
            "Hooks will use current working directory, which may not be portable."
        )
        validation_result["recommendations"].append(
            "Set CLAUDE_PROJECT_DIR to your project root directory: "
            "export CLAUDE_PROJECT_DIR=/path/to/your/project"
        )
    else:
        project_path = Path(claude_project_dir)
        if not project_path.exists():
            validation_result["errors"].append(
                f"CLAUDE_PROJECT_DIR points to non-existent directory: {claude_project_dir}"
            )
            validation_result["is_valid"] = False
        elif not project_path.is_dir():
            validation_result["errors"].append(
                f"CLAUDE_PROJECT_DIR is not a directory: {claude_project_dir}"
            )
            validation_result["is_valid"] = False
        else:
            # Check if .claude directory exists
            claude_dir = project_path / ".claude"
            if not claude_dir.exists():
                validation_result["warnings"].append(
                    f"No .claude directory found in project root: {claude_project_dir}"
                )
                validation_result["recommendations"].append(
                    "Run the Chronicle hooks installer to set up the .claude directory"
                )
    
    # Check for common configuration files in project root
    if claude_project_dir:
        project_path = Path(claude_project_dir)
        config_files = [
            ".gitignore", "README.md", "requirements.txt", "package.json", 
            "pyproject.toml", "Cargo.toml", "go.mod"
        ]
        found_config_files = [f for f in config_files if (project_path / f).exists()]
        
        if not found_config_files:
            validation_result["warnings"].append(
                "No common project configuration files found in CLAUDE_PROJECT_DIR. "
                "Please verify this is the correct project root."
            )
    
    # Check cross-platform path compatibility
    if claude_project_dir:
        # Validate path security and compatibility
        security_check = validate_path_security(claude_project_dir)
        
        if security_check["warnings"]:
            validation_result["warnings"].extend(security_check["warnings"])
        
        if security_check["errors"]:
            validation_result["errors"].extend(security_check["errors"])
            validation_result["is_valid"] = False
        
        # Platform-specific path checks
        if PLATFORM.is_windows:
            if "/" in claude_project_dir and "\\" not in claude_project_dir:
                validation_result["warnings"].append(
                    "Using Unix-style path separators on Windows. "
                    "This may work but Windows-style separators are recommended."
                )
            
            if len(claude_project_dir) > 260:
                validation_result["warnings"].append(
                    "Path length exceeds Windows MAX_PATH limit (260 characters). "
                    "Consider enabling long path support or using a shorter path."
                )
        
        elif PLATFORM.is_unix_like:
            if "\\" in claude_project_dir:
                validation_result["warnings"].append(
                    "Using backslash separators on Unix-like system. "
                    "Use forward slashes for better compatibility."
                )
    
    # Add platform-specific recommendations
    if PLATFORM.is_windows:
        validation_result["recommendations"].append(
            "On Windows: Consider using PowerShell or Command Prompt to set environment variables: "
            "set CLAUDE_PROJECT_DIR=C:\\path\\to\\your\\project"
        )
    else:
        validation_result["recommendations"].append(
            "On Unix-like systems: Add to your shell profile (.bashrc, .zshrc, etc.): "
            "export CLAUDE_PROJECT_DIR=/path/to/your/project"
        )
    
    return validation_result