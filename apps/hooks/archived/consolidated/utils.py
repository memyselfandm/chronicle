"""
Consolidated Utilities for UV Single-File Scripts

Essential utility functions consolidated into a minimal module suitable
for inlining into UV single-file scripts.

Key consolidations:
- Essential JSON and data handling utilities
- Basic git information extraction 
- Simple session context extraction
- Core project path resolution
- Removed cross-platform complexity for simplicity
- Basic sanitization functions
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


def sanitize_data(data: Any) -> Any:
    """
    Basic data sanitization for safe processing.
    Removes potentially sensitive information and limits data size.
    """
    if data is None:
        return None
    
    try:
        if isinstance(data, dict):
            # Remove private keys and limit nested depth
            sanitized = {}
            for key, value in data.items():
                if not str(key).startswith('_') and not str(key).lower().startswith('password'):
                    # Recursively sanitize values but limit depth
                    if isinstance(value, dict) and len(str(value)) < 1000:
                        sanitized[key] = sanitize_data(value)
                    elif isinstance(value, str) and len(value) < 10000:
                        sanitized[key] = value
                    elif not isinstance(value, (dict, list)) and len(str(value)) < 1000:
                        sanitized[key] = value
            return sanitized
        
        elif isinstance(data, list):
            # Limit list size and sanitize elements
            if len(data) > 100:
                data = data[:100]
            return [sanitize_data(item) for item in data]
        
        elif isinstance(data, str):
            # Limit string length and remove potential sensitive patterns
            if len(data) > 10000:
                data = data[:10000]
            # Basic pattern removal
            sanitized = data
            if 'password' in data.lower() or 'secret' in data.lower() or 'key' in data.lower():
                # If it looks like it might contain secrets, truncate aggressively
                sanitized = data[:100] + '...[truncated for security]' if len(data) > 100 else data
            return sanitized
        
        else:
            # For other types, convert to string and limit length
            str_data = str(data)
            return str_data[:1000] if len(str_data) > 1000 else data
    
    except Exception:
        # If sanitization fails, return safe fallback
        return str(data)[:100] if data else None


def validate_json(data: Any, max_size_mb: float = 10.0) -> bool:
    """
    Validate JSON data for safety and size constraints.
    """
    if data is None:
        return False
    
    try:
        # Convert to JSON string to check size and validity
        json_str = json.dumps(data, default=str)
        
        # Check size limit
        size_bytes = len(json_str.encode('utf-8'))
        max_size_bytes = int(max_size_mb * 1024 * 1024)
        
        if size_bytes > max_size_bytes:
            return False
        
        # Verify it's valid JSON by parsing it back
        json.loads(json_str)
        
        return True
        
    except (TypeError, json.JSONEncodeError, OverflowError, ValueError):
        return False


def extract_session_context() -> Dict[str, Optional[str]]:
    """
    Extract Claude session information from environment variables.
    """
    return {
        "session_id": os.getenv("CLAUDE_SESSION_ID"),
        "transcript_path": os.getenv("CLAUDE_TRANSCRIPT_PATH"),
        "cwd": os.getcwd(),
        "user": os.getenv("USER") or os.getenv("USERNAME") or "unknown",
        "timestamp": datetime.now().isoformat(),
    }


def get_git_info(cwd: Optional[str] = None) -> Dict[str, Any]:
    """
    Safely extract basic git information.
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
            timeout=3  # Shorter timeout for UV scripts
        )
        
        if result.returncode != 0:
            git_info["error"] = "Not a git repository"
            return git_info
        
        git_info["is_git_repo"] = True
        
        # Get current branch
        try:
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=3
            )
            
            if result.returncode == 0 and result.stdout.strip():
                git_info["branch"] = result.stdout.strip()
        except Exception:
            pass  # Continue without branch info
        
        # Get current commit hash (short)
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=3
            )
            
            if result.returncode == 0 and result.stdout.strip():
                git_info["commit_hash"] = result.stdout.strip()
        except Exception:
            pass  # Continue without commit info
        
    except subprocess.TimeoutExpired:
        git_info["error"] = "Git command timed out"
    except FileNotFoundError:
        git_info["error"] = "Git not found"
    except Exception as e:
        git_info["error"] = f"Git error: {e}"
    
    return git_info


def resolve_project_path(fallback_path: Optional[str] = None) -> str:
    """
    Resolve project root path using CLAUDE_PROJECT_DIR or fallback.
    """
    # Check CLAUDE_PROJECT_DIR environment variable first
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if claude_project_dir:
        project_path = Path(claude_project_dir).expanduser()
        if project_path.exists() and project_path.is_dir():
            return str(project_path.absolute())
    
    # Use fallback path if provided
    if fallback_path:
        fallback = Path(fallback_path).expanduser()
        if fallback.exists() and fallback.is_dir():
            return str(fallback.absolute())
    
    # Use current working directory as final fallback
    return os.getcwd()


def get_project_context(cwd: Optional[str] = None) -> Dict[str, Any]:
    """
    Get basic project context information.
    """
    if cwd is None:
        try:
            cwd = resolve_project_path()
        except Exception:
            cwd = os.getcwd()
    
    return {
        "cwd": cwd,
        "git_info": get_git_info(cwd),
        "session_context": extract_session_context(),
        "has_claude_project_dir": bool(os.getenv("CLAUDE_PROJECT_DIR")),
        "timestamp": datetime.now().isoformat()
    }


def format_error_message(error: Exception, context: Optional[str] = None) -> str:
    """
    Format error messages consistently.
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
    """
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


def safe_json_dumps(data: Any, default: Any = "null") -> str:
    """
    Safely dump data to JSON string with fallback.
    """
    try:
        return json.dumps(data, default=str, separators=(',', ':'))
    except (TypeError, ValueError):
        return default


def normalize_hook_event_name(hook_event_name: str) -> str:
    """
    Normalize hook event name to standard format.
    """
    if not hook_event_name:
        return "Unknown"
    
    # Mapping from snake_case to PascalCase
    event_mapping = {
        "session_start": "SessionStart",
        "pre_tool_use": "PreToolUse", 
        "post_tool_use": "PostToolUse",
        "user_prompt_submit": "UserPromptSubmit",
        "pre_compact": "PreCompact",
        "notification": "Notification",
        "stop": "Stop",
        "subagent_stop": "SubagentStop"
    }
    
    # If it's already in PascalCase, return as-is
    if hook_event_name in event_mapping.values():
        return hook_event_name
    
    # If it's snake_case, convert
    if hook_event_name.lower() in event_mapping:
        return event_mapping[hook_event_name.lower()]
    
    # Generic conversion for unknown events
    if "_" in hook_event_name:
        words = hook_event_name.split("_")
        return "".join(word.capitalize() for word in words)
    
    return hook_event_name


def snake_to_camel(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    if not snake_str:
        return snake_str
    
    components = snake_str.split('_')
    return components[0] + ''.join(word.capitalize() for word in components[1:])


def is_reasonable_data_size(data: Any, max_size_mb: float = 10.0) -> bool:
    """
    Quick check for reasonable data size.
    """
    try:
        if isinstance(data, str):
            size_mb = len(data.encode('utf-8')) / 1024 / 1024
        else:
            data_str = json.dumps(data, default=str)
            size_mb = len(data_str.encode('utf-8')) / 1024 / 1024
        return size_mb <= max_size_mb
    except (TypeError, ValueError):
        return False


def generate_cache_key(prefix: str, data: Dict[str, Any]) -> str:
    """Generate a cache key from hook input data."""
    key_data = {
        "prefix": prefix,
        "hook_event": data.get("hookEventName", "unknown"),
        "session_hash": hash(str(data.get("sessionId", "")))
    }
    
    # Add tool-specific info if present
    if "toolName" in data:
        key_data["tool"] = data["toolName"]
    
    return f"{prefix}:{json.dumps(key_data, sort_keys=True)}"


def create_hook_response(continue_execution: bool = True,
                        suppress_output: bool = False,
                        hook_specific_data: Optional[Dict[str, Any]] = None,
                        stop_reason: Optional[str] = None) -> Dict[str, Any]:
    """
    Create standardized hook response.
    """
    response = {
        "continue": continue_execution,
        "suppressOutput": suppress_output,
    }
    
    if not continue_execution and stop_reason:
        response["stopReason"] = stop_reason
    
    if hook_specific_data:
        response["hookSpecificOutput"] = hook_specific_data
    
    return response


def validate_environment_basic() -> Dict[str, Any]:
    """
    Basic environment validation for UV scripts.
    """
    result = {
        "is_valid": True,
        "warnings": [],
        "claude_project_dir": os.getenv("CLAUDE_PROJECT_DIR"),
        "session_id": os.getenv("CLAUDE_SESSION_ID")
    }
    
    # Check CLAUDE_PROJECT_DIR
    if not result["claude_project_dir"]:
        result["warnings"].append("CLAUDE_PROJECT_DIR not set")
    elif not Path(result["claude_project_dir"]).exists():
        result["warnings"].append("CLAUDE_PROJECT_DIR path does not exist")
    
    return result