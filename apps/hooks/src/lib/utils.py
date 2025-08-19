"""
Utility functions for Claude Code observability hooks - UV Compatible Library Module.

Consolidates utilities from core/utils.py and env_loader functionality
from inline hooks, optimized for UV script compatibility.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Load environment variables
try:
    from dotenv import load_dotenv, dotenv_values
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Enhanced patterns for sensitive data detection (simplified for performance)
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
        r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',  # Generic API keys
    ],
    "passwords": [
        r'"password"\s*:\s*"[^"]*"',
        r"'password'\s*:\s*'[^']*'",
        r'password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
    ]
}


def load_chronicle_env() -> Dict[str, str]:
    """Load environment variables for Chronicle with fallback support."""
    loaded_vars = {}
    
    if DOTENV_AVAILABLE:
        try:
            # Search for .env file in common locations
            search_paths = [
                Path.cwd() / '.env',
                Path(__file__).parent / '.env',
                Path.home() / '.claude' / 'hooks' / 'chronicle' / '.env',
                Path(__file__).parent.parent / '.env',
            ]
            
            env_path = None
            for path in search_paths:
                if path.exists() and path.is_file():
                    env_path = path
                    break
            
            if env_path:
                loaded_vars = dotenv_values(env_path)
                load_dotenv(env_path, override=True)
            
        except Exception:
            pass
    
    # Apply critical defaults
    defaults = {
        'CLAUDE_HOOKS_DB_PATH': str(Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data' / 'chronicle.db'),
        'CLAUDE_HOOKS_LOG_LEVEL': 'INFO',
        'CLAUDE_HOOKS_ENABLED': 'true',
    }
    
    for key, default_value in defaults.items():
        if not os.getenv(key):
            os.environ[key] = default_value
            loaded_vars[key] = default_value
    
    return loaded_vars


def get_database_config() -> Dict[str, Any]:
    """Get database configuration with proper paths."""
    load_chronicle_env()
    
    # Determine database path based on installation
    script_path = Path(__file__).resolve()
    if '.claude/hooks/chronicle' in str(script_path):
        # Installed location
        data_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data'
        data_dir.mkdir(parents=True, exist_ok=True)
        default_db_path = str(data_dir / 'chronicle.db')
    else:
        # Development mode
        default_db_path = str(Path.cwd() / 'data' / 'chronicle.db')
    
    config = {
        'supabase_url': os.getenv('SUPABASE_URL'),
        'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
        'sqlite_path': os.getenv('CLAUDE_HOOKS_DB_PATH', default_db_path),
        'db_timeout': int(os.getenv('CLAUDE_HOOKS_DB_TIMEOUT', '30')),
        'retry_attempts': int(os.getenv('CLAUDE_HOOKS_DB_RETRY_ATTEMPTS', '3')),
        'retry_delay': float(os.getenv('CLAUDE_HOOKS_DB_RETRY_DELAY', '1.0')),
    }
    
    # Ensure SQLite directory exists
    sqlite_path = Path(config['sqlite_path'])
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    
    return config


def sanitize_data(data: Any) -> Any:
    """
    Fast sanitization for sensitive data.
    
    Args:
        data: The data structure to sanitize
        
    Returns:
        Sanitized data with sensitive information masked
    """
    if data is None:
        return None
    
    data_str = json_impl.dumps(data) if not isinstance(data, str) else data
    sanitized_str = data_str
    
    # Only sanitize most critical patterns for performance
    for pattern in SENSITIVE_PATTERNS["api_keys"]:
        sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str)
    
    for pattern in SENSITIVE_PATTERNS["user_paths"]:
        sanitized_str = re.sub(pattern, '/Users/[USER]', sanitized_str)
    
    try:
        if isinstance(data, dict):
            return json_impl.loads(sanitized_str)
        return sanitized_str
    except:
        return sanitized_str


def validate_json(data: Any) -> bool:
    """
    Validate that data can be properly JSON serialized.
    
    Args:
        data: Data to validate
        
    Returns:
        True if data is JSON serializable, False otherwise
    """
    try:
        json_impl.dumps(data)
        return True
    except (TypeError, ValueError):
        return False


def format_error_message(error: Exception, context: str = "") -> str:
    """
    Format error messages consistently.
    
    Args:
        error: The exception to format
        context: Optional context string
        
    Returns:
        Formatted error message
    """
    error_type = type(error).__name__
    error_msg = str(error)
    
    if context:
        return f"[{context}] {error_type}: {error_msg}"
    else:
        return f"{error_type}: {error_msg}"


def ensure_directory_exists(path: Path) -> bool:
    """
    Ensure a directory exists, creating it if necessary.
    
    Args:
        path: Path to the directory
        
    Returns:
        True if directory exists or was created successfully
    """
    try:
        path.mkdir(parents=True, exist_ok=True)
        return True
    except Exception:
        return False


def get_project_path() -> str:
    """Get the current project path."""
    return os.getcwd()


def is_development_mode() -> bool:
    """
    Check if running in development mode.
    
    Returns:
        True if in development mode, False if installed
    """
    script_path = Path(__file__).resolve()
    return '.claude/hooks/chronicle' not in str(script_path)


def get_chronicle_data_dir() -> Path:
    """
    Get the Chronicle data directory path.
    
    Returns:
        Path to Chronicle data directory
    """
    if is_development_mode():
        return Path.cwd() / 'data'
    else:
        return Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data'


def get_chronicle_log_dir() -> Path:
    """
    Get the Chronicle log directory path.
    
    Returns:
        Path to Chronicle log directory
    """
    if is_development_mode():
        return Path.cwd() / 'logs'
    else:
        return Path.home() / '.claude' / 'hooks' / 'chronicle' / 'logs'


def setup_chronicle_directories() -> bool:
    """
    Set up all required Chronicle directories.
    
    Returns:
        True if all directories were created successfully
    """
    try:
        data_dir = get_chronicle_data_dir()
        log_dir = get_chronicle_log_dir()
        
        data_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)
        
        return True
    except Exception:
        return False


# MCP tool detection utilities
MCP_TOOL_PATTERN = re.compile(r'^mcp__(.+?)__(.+)$')


def is_mcp_tool(tool_name: str) -> bool:
    """Determine if a tool is an MCP tool based on naming pattern."""
    if not tool_name or not isinstance(tool_name, str):
        return False
    return bool(MCP_TOOL_PATTERN.match(tool_name))


def extract_mcp_server_name(tool_name: str) -> Optional[str]:
    """Extract MCP server name from tool name."""
    if not tool_name or not isinstance(tool_name, str):
        return None
    
    match = MCP_TOOL_PATTERN.match(tool_name)
    return match.group(1) if match else None


# Performance utilities
def calculate_duration_ms(start_time: Optional[float] = None, 
                         end_time: Optional[float] = None,
                         execution_time_ms: Optional[int] = None) -> Optional[int]:
    """Calculate execution duration in milliseconds."""
    if execution_time_ms is not None:
        return execution_time_ms
    
    if start_time is not None and end_time is not None:
        duration_seconds = end_time - start_time
        if duration_seconds >= 0:
            return int(duration_seconds * 1000)
    
    return None


# Input validation utilities
def validate_input_data(input_data: Any) -> bool:
    """
    Validate hook input data structure.
    
    Args:
        input_data: Input data to validate
        
    Returns:
        True if input data is valid
    """
    if not isinstance(input_data, dict):
        return False
    
    # Must be JSON serializable
    return validate_json(input_data)


def extract_session_id(input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """
    Extract session ID from input data or environment.
    
    Args:
        input_data: Hook input data
        
    Returns:
        Session ID if found, None otherwise
    """
    if input_data and "session_id" in input_data:
        return input_data["session_id"]
    
    return os.getenv("CLAUDE_SESSION_ID")


# Constants for tool response parsing
LARGE_RESULT_THRESHOLD = 100000  # 100KB threshold for large results


def parse_tool_response(response_data: Any) -> Dict[str, Any]:
    """Parse tool response data and extract key metrics."""
    if response_data is None:
        return {
            "success": False,
            "error": "No response data",
            "result_size": 0,
            "large_result": False
        }
    
    # Calculate response size
    try:
        response_str = json_impl.dumps(response_data) if not isinstance(response_data, str) else response_data
        result_size = len(response_str.encode('utf-8'))
    except (TypeError, UnicodeEncodeError):
        result_size = 0
    
    # Extract success/failure status
    success = True
    error = None
    error_type = None
    
    if isinstance(response_data, dict):
        status = response_data.get("status", "success")
        if status in ["error", "timeout", "failed"]:
            success = False
        
        if "error" in response_data:
            success = False
            error = response_data["error"]
        
        if "error_type" in response_data:
            error_type = response_data["error_type"]
        
        if error and "timeout" in str(error).lower():
            error_type = "timeout"
    
    parsed = {
        "success": success,
        "error": error,
        "result_size": result_size,
        "large_result": result_size > LARGE_RESULT_THRESHOLD,
        "metadata": response_data if isinstance(response_data, dict) else None
    }
    
    # Only include error_type if it's not None
    if error_type is not None:
        parsed["error_type"] = error_type
    
    # Include partial results if available
    if isinstance(response_data, dict) and "partial_result" in response_data:
        parsed["partial_result"] = response_data["partial_result"]
    
    return parsed


# Additional functions merged from core/utils.py for compatibility

def extract_session_context() -> Dict[str, Optional[str]]:
    """Extract session context from environment variables."""
    return {
        "claude_session_id": os.getenv("CLAUDE_SESSION_ID"),
        "claude_project_dir": os.getenv("CLAUDE_PROJECT_DIR"),
        "timestamp": datetime.now().isoformat()
    }


def get_git_info(cwd: Optional[str] = None) -> Dict[str, Any]:
    """Get git information for the current repository."""
    try:
        import subprocess
        
        work_dir = cwd or os.getcwd()
        
        def run_git_cmd(cmd):
            try:
                result = subprocess.run(
                    ["git"] + cmd,
                    cwd=work_dir,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return result.stdout.strip()
                return None
            except:
                return None
        
        branch = run_git_cmd(["rev-parse", "--abbrev-ref", "HEAD"])
        commit = run_git_cmd(["rev-parse", "HEAD"])
        remote_url = run_git_cmd(["config", "--get", "remote.origin.url"])
        
        return {
            "git_branch": branch,
            "git_commit": commit[:8] if commit else None,
            "git_remote_url": remote_url,
            "is_git_repo": branch is not None
        }
    except:
        return {
            "git_branch": None,
            "git_commit": None,
            "git_remote_url": None,
            "is_git_repo": False
        }


def resolve_project_path(fallback_path: Optional[str] = None) -> str:
    """
    Resolve project path using CLAUDE_PROJECT_DIR or fallback.
    
    Args:
        fallback_path: Optional fallback path if environment variable is not set
        
    Returns:
        Resolved project root path
    """
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if claude_project_dir:
        expanded_path = os.path.expanduser(claude_project_dir)
        if os.path.isdir(expanded_path):
            return expanded_path
    
    return fallback_path or os.getcwd()


def get_project_context_with_env_support(cwd: Optional[str] = None) -> Dict[str, Any]:
    """
    Capture project information and context with enhanced environment variable support.
    
    Args:
        cwd: Working directory (defaults to resolved project directory from CLAUDE_PROJECT_DIR)
        
    Returns:
        Dictionary containing project context information
    """
    # Resolve the working directory
    resolved_cwd = resolve_project_path(cwd)
    
    # Get git information
    git_info = get_git_info(resolved_cwd)
    
    # Get session context
    session_context = extract_session_context()
    
    return {
        "cwd": resolved_cwd,
        "project_path": resolved_cwd,
        "git_branch": git_info.get("git_branch"),
        "git_commit": git_info.get("git_commit"),
        "git_remote_url": git_info.get("git_remote_url"),
        "is_git_repo": git_info.get("is_git_repo", False),
        "claude_session_id": session_context.get("claude_session_id"),
        "claude_project_dir": session_context.get("claude_project_dir"),
        "resolved_from_env": bool(os.getenv("CLAUDE_PROJECT_DIR")),
        "timestamp": datetime.now().isoformat()
    }


def validate_environment_setup() -> Dict[str, Any]:
    """
    Validate the environment setup for the hooks system.
    
    Returns:
        Dictionary containing validation results, warnings, and recommendations
    """
    warnings = []
    errors = []
    recommendations = []
    
    # Check for required environment variables
    claude_session_id = os.getenv("CLAUDE_SESSION_ID")
    if not claude_session_id:
        warnings.append("CLAUDE_SESSION_ID not set - session tracking may not work")
    
    # Check database configuration
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        warnings.append("Supabase configuration incomplete - falling back to SQLite")
    
    # Check project directory
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if claude_project_dir:
        expanded_path = os.path.expanduser(claude_project_dir)
        if not os.path.isdir(expanded_path):
            errors.append(f"CLAUDE_PROJECT_DIR points to non-existent directory: {expanded_path}")
    
    # Provide recommendations
    if not claude_session_id:
        recommendations.append("Set CLAUDE_SESSION_ID environment variable for session tracking")
    
    if not supabase_url or not supabase_key:
        recommendations.append("Configure Supabase for cloud database features")
    
    status = "healthy"
    if errors:
        status = "error"
    elif warnings:
        status = "warning"
    
    return {
        "status": status,
        "warnings": warnings,
        "errors": errors,
        "recommendations": recommendations,
        "timestamp": datetime.now().isoformat()
    }