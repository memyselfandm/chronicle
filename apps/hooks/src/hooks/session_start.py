#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
# ]
# ///
"""
Claude Code Session Start Hook - UV Single-File Script

This hook captures session initialization events and tracks project context.
Implements session lifecycle tracking as specified in H3.3.

Features:
- Extract project context (working directory, git branch if available)
- Generate or retrieve session ID from Claude Code environment
- Create session record in database with start_time
- Store as event_type='session_start' with data containing: {project_path, git_branch, git_commit}

Usage:
    uv run session_start.py

Exit Codes:
    0: Success, continue execution
    2: Blocking error, show stderr to Claude
    Other: Non-blocking error, show stderr to user
"""

import json
import os
import sys
import time
import logging
import sqlite3
import subprocess
import threading
import uuid
import re
from contextlib import contextmanager

@contextmanager
def measure_performance(operation_name):
    """Simple performance measurement context manager."""
    start_time = time.perf_counter()
    metrics = {}
    yield metrics
    end_time = time.perf_counter()
    metrics['duration_ms'] = (end_time - start_time) * 1000
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple, Union, Callable, Generator
from collections import defaultdict, deque

# Load environment variables with chronicle-aware loading
# (Database manager and env loader are inlined below)
class DatabaseError(Exception):
    """Base exception for database operations."""
    pass

# Fallback to standard dotenv if needed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================================
# Inline Security Module
# ===========================================

# Security exceptions
class SecurityError(Exception):
    """Base class for security-related errors."""
    pass

class PathTraversalError(SecurityError):
    """Raised when path traversal attack is detected."""
    pass

class InputSizeError(SecurityError):
    """Raised when input exceeds size limits."""
    pass

# Enhanced patterns for sensitive data detection
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
        r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',  # Generic API keys
    ],
    "passwords": [
        r'"password"\s*:\s*"[^"]*"',
        r"'password'\s*:\s*'[^']*'",
        r'"secret"\s*:\s*"[^"]*"',
        r"'secret'\s*:\s*'[^']*'",
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
    ]
}

DEFAULT_MAX_INPUT_SIZE_MB = 10.0
MAX_INPUT_SIZE_MB = float(os.getenv("CHRONICLE_MAX_INPUT_SIZE_MB", DEFAULT_MAX_INPUT_SIZE_MB))

def sanitize_data(data: Any) -> Any:
    """Remove sensitive information from data structures."""
    if data is None:
        return None
    
    data_str = json_impl.dumps(data) if not isinstance(data, str) else data
    sanitized_str = data_str
    
    # Remove sensitive patterns
    for category, patterns in SENSITIVE_PATTERNS.items():
        for pattern in patterns:
            sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str, flags=re.IGNORECASE)
    
    try:
        if isinstance(data, dict):
            return json_impl.loads(sanitized_str)
        elif isinstance(data, str):
            return sanitized_str
        else:
            return json_impl.loads(sanitized_str)
    except:
        return sanitized_str

# ===========================================
# Inline Utils Module
# ===========================================

def validate_json(data: Any, max_size_mb: Optional[float] = None) -> bool:
    """Validate JSON data for safety and size constraints."""
    if data is None:
        return False
    
    try:
        json_str = json_impl.dumps(data, default=str)
        
        if max_size_mb is None:
            size_limit_bytes = int(MAX_INPUT_SIZE_MB * 1024 * 1024)
        else:
            size_limit_bytes = int(max_size_mb * 1024 * 1024)
        
        data_size_bytes = len(json_str.encode('utf-8'))
        if data_size_bytes > size_limit_bytes:
            logger.warning(f"Data size {data_size_bytes / (1024 * 1024):.2f}MB exceeds limit")
            return False
        
        json_impl.loads(json_str)
        return True
        
    except Exception as e:
        logger.warning(f"Invalid JSON data: {e}")
        return False

def get_git_info(cwd: Optional[str] = None) -> Dict[str, Any]:
    """Safely extract git branch and commit information."""
    git_info = {
        "branch": None,
        "commit_hash": None,
        "is_git_repo": False,
        "has_changes": False,
        "untracked_files": 0,
        "modified_files": 0
    }
    
    work_dir = cwd or os.getcwd()
    
    try:
        # Check if git repo
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=2
        )
        
        if result.returncode == 0:
            git_info["is_git_repo"] = True
            
            # Get branch name
            branch_result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if branch_result.returncode == 0 and branch_result.stdout.strip():
                git_info["branch"] = branch_result.stdout.strip()
            
            # Get commit hash
            commit_result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if commit_result.returncode == 0 and commit_result.stdout.strip():
                git_info["commit_hash"] = commit_result.stdout.strip()[:12]  # Short hash
            
            # Check for changes
            status_result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if status_result.returncode == 0:
                status_lines = status_result.stdout.strip().split('\n')
                git_info["has_changes"] = bool(status_lines[0]) if status_lines else False
                
                # Count untracked and modified files
                for line in status_lines:
                    if line.startswith('??'):
                        git_info["untracked_files"] += 1
                    elif line.startswith(('M ', ' M', 'A ', ' A')):
                        git_info["modified_files"] += 1
            
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        logger.debug("Git command failed or timed out")
    except Exception as e:
        logger.debug(f"Error getting git info: {e}")
    
    return git_info

def resolve_project_path(fallback_path: Optional[str] = None) -> str:
    """Get the project root path using CLAUDE_PROJECT_DIR or fallback."""
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    
    if claude_project_dir:
        expanded = os.path.expanduser(claude_project_dir)
        if os.path.isdir(expanded):
            return os.path.abspath(expanded)
        else:
            logger.warning(f"CLAUDE_PROJECT_DIR points to non-existent directory: {claude_project_dir}")
    
    if fallback_path and os.path.isdir(fallback_path):
        return os.path.abspath(fallback_path)
    
    return os.getcwd()

def get_cached_session_id() -> Optional[str]:
    """Get session ID from cache if available."""
    try:
        session_cache_file = Path.home() / ".claude" / "hooks" / "chronicle" / "tmp" / "current_session_id"
        if session_cache_file.exists():
            return session_cache_file.read_text().strip()
    except Exception:
        pass
    return None

def get_project_context_with_env_support(cwd: Optional[str] = None) -> Dict[str, Any]:
    """Capture project information with environment variable support."""
    resolved_cwd = resolve_project_path(cwd)
    
    context = {
        "cwd": resolved_cwd,
        "claude_project_dir": os.getenv("CLAUDE_PROJECT_DIR"),
        "resolved_from_env": bool(os.getenv("CLAUDE_PROJECT_DIR")),
        "git_info": get_git_info(resolved_cwd),
        "session_context": {
            "session_id": os.getenv("CLAUDE_SESSION_ID"),
            "transcript_path": os.getenv("CLAUDE_TRANSCRIPT_PATH"),
            "user": os.getenv("USER", "unknown"),
        }
    }
    
    # Add project type detection
    try:
        files = os.listdir(resolved_cwd)
        file_set = set(files)
        
        project_files = {}
        project_type = None
        
        # Detect project type
        if any(f in file_set for f in ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"]):
            project_type = "python"
            for f in ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"]:
                if f in file_set:
                    project_files[f] = True
        elif "package.json" in file_set:
            project_type = "node"
            project_files["package.json"] = True
        elif "Cargo.toml" in file_set:
            project_type = "rust"
            project_files["Cargo.toml"] = True
        elif "go.mod" in file_set:
            project_type = "go"
            project_files["go.mod"] = True
        
        context["session_context"]["project_type"] = project_type
        context["session_context"]["project_files"] = project_files
        
    except OSError:
        logger.debug("Could not read project directory for type detection")
    
    return context

def format_error_message(error: Exception, context: Optional[str] = None) -> str:
    """Format error message for logging."""
    error_msg = f"{type(error).__name__}: {str(error)}"
    if context:
        error_msg = f"[{context}] {error_msg}"
    return error_msg

# ===========================================
# Inline Environment Loader (Minimal)
# ===========================================

def load_chronicle_env() -> Dict[str, str]:
    """Load environment variables for Chronicle with fallback support."""
    loaded_vars = {}
    
    try:
        from dotenv import load_dotenv, dotenv_values
        
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
                
    except ImportError:
        pass
        
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

# ===========================================
# Inline Database Manager (Essential)
# ===========================================

class DatabaseManager:
    """Unified database interface with Supabase/SQLite fallback."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize database manager with configuration."""
        load_chronicle_env()
        self.config = config or get_database_config()
        
        # Initialize clients
        self.supabase_client = None
        self.sqlite_path = Path(self.config['sqlite_path']).expanduser().resolve()
        self.timeout = self.config.get('db_timeout', 30)
        
        # Initialize Supabase if available
        if SUPABASE_AVAILABLE:
            supabase_url = self.config.get('supabase_url')
            supabase_key = self.config.get('supabase_key')
            
            if supabase_url and supabase_key:
                try:
                    self.supabase_client = create_client(supabase_url, supabase_key)
                except Exception:
                    pass
        
        # Ensure SQLite database exists
        self._ensure_sqlite_database()
        
        # Set table names
        if self.supabase_client:
            self.SESSIONS_TABLE = "chronicle_sessions"
            self.EVENTS_TABLE = "chronicle_events"
        else:
            self.SESSIONS_TABLE = "sessions"
            self.EVENTS_TABLE = "events"
    
    def _ensure_sqlite_database(self):
        """Ensure SQLite database and directory structure exist."""
        try:
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                self._create_sqlite_schema(conn)
                conn.commit()
                
        except Exception as e:
            raise DatabaseError(f"Cannot initialize SQLite at {self.sqlite_path}: {e}")
    
    def _create_sqlite_schema(self, conn: sqlite3.Connection):
        """Create SQLite schema matching Supabase structure."""
        conn.execute("PRAGMA foreign_keys = ON")
        
        # Sessions table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                claude_session_id TEXT UNIQUE,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                project_path TEXT,
                git_branch TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Events table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                event_type TEXT NOT NULL,
                timestamp TIMESTAMP,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
        ''')
        
        # Create indexes
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)')
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data to database."""
        try:
            if "claude_session_id" not in session_data:
                return False, None
            
            claude_session_id = session_data.get("claude_session_id")
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    # Check for existing session
                    existing = self.supabase_client.table(self.SESSIONS_TABLE).select("id").eq("claude_session_id", claude_session_id).execute()
                    
                    if existing.data:
                        session_uuid = existing.data[0]["id"]
                    else:
                        session_uuid = str(uuid.uuid4())
                    
                    # Build metadata
                    metadata = {}
                    if "git_commit" in session_data:
                        metadata["git_commit"] = session_data.get("git_commit")
                    if "source" in session_data:
                        metadata["source"] = session_data.get("source")
                    
                    supabase_data = {
                        "id": session_uuid,
                        "claude_session_id": session_data.get("claude_session_id"),
                        "start_time": session_data.get("start_time"),
                        "end_time": session_data.get("end_time"),
                        "project_path": session_data.get("project_path"),
                        "git_branch": session_data.get("git_branch"),
                        "metadata": metadata,
                    }
                    
                    self.supabase_client.table(self.SESSIONS_TABLE).upsert(supabase_data, on_conflict="claude_session_id").execute()
                    return True, session_uuid
                    
                except Exception:
                    pass
            
            # SQLite fallback
            session_uuid = session_data.get("id")
            if not session_uuid:
                with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM sessions WHERE claude_session_id = ?", (claude_session_id,))
                    row = cursor.fetchone()
                    if row:
                        session_uuid = row[0]
                    else:
                        session_uuid = str(uuid.uuid4())
            
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO sessions 
                    (id, claude_session_id, start_time, end_time, project_path, 
                     git_branch, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (
                    session_uuid,
                    session_data.get("claude_session_id"),
                    session_data.get("start_time"),
                    session_data.get("end_time"),
                    session_data.get("project_path"),
                    session_data.get("git_branch"),
                ))
                conn.commit()
            
            return True, session_uuid
            
        except Exception:
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to database."""
        try:
            event_id = str(uuid.uuid4())
            
            if "session_id" not in event_data:
                return False
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    metadata_jsonb = event_data.get("data", {})
                    
                    if "hook_event_name" in event_data:
                        metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
                    
                    if "metadata" in event_data:
                        metadata_jsonb.update(event_data.get("metadata", {}))
                    
                    # Ensure valid event_type
                    event_type = event_data.get("event_type")
                    valid_types = ["prompt", "tool_use", "session_start", "session_end", "notification", "error"]
                    if event_type not in valid_types:
                        event_type = "notification"
                    
                    supabase_data = {
                        "id": event_id,
                        "session_id": event_data.get("session_id"),
                        "event_type": event_type,
                        "timestamp": event_data.get("timestamp"),
                        "metadata": metadata_jsonb,
                    }
                    
                    self.supabase_client.table(self.EVENTS_TABLE).insert(supabase_data).execute()
                    return True
                    
                except Exception:
                    pass
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                metadata_jsonb = event_data.get("data", {})
                
                if "hook_event_name" in event_data:
                    metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
                
                if "metadata" in event_data:
                    metadata_jsonb.update(event_data.get("metadata", {}))
                
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, timestamp, metadata)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    event_id,
                    event_data.get("session_id"),
                    event_data.get("event_type"),
                    event_data.get("timestamp"),
                    json.dumps(metadata_jsonb),
                ))
                conn.commit()
            
            return True
            
        except Exception:
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID from database."""
        try:
            # Try Supabase first
            if self.supabase_client:
                try:
                    result = self.supabase_client.table(self.SESSIONS_TABLE).select("*").eq("claude_session_id", session_id).execute()
                    if result.data:
                        return result.data[0]
                except Exception:
                    pass
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM sessions WHERE claude_session_id = ?",
                    (session_id,)
                )
                row = cursor.fetchone()
                if row:
                    return dict(row)
            
            return None
            
        except Exception:
            return None

# ===========================================
# Inline Database Module
# ===========================================

class SimpleCache:
    """Simple in-memory cache for hook operations."""
    
    def __init__(self, max_size: int = 100):
        self.cache: Dict[str, Any] = {}
        self.max_size = max_size
    
    def get(self, key: str) -> Any:
        return self.cache.get(key)
    
    def set(self, key: str, value: Any) -> None:
        if len(self.cache) >= self.max_size:
            # Remove oldest item
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        self.cache[key] = value
    
    def clear(self) -> None:
        self.cache.clear()

# ===========================================
# Base Hook Implementation (Inlined)
# ===========================================

class BaseHook:
    """Base class for Claude Code observability hooks."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.db_manager = DatabaseManager(self.config.get("database"))
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
        self.hook_cache = SimpleCache()
        
        # Legacy log file for backward compatibility
        self.log_file = os.path.expanduser("~/.claude/hooks_debug.log")
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract Claude session ID from input data or environment."""
        if input_data and "session_id" in input_data:
            session_id = input_data["session_id"]
            logger.debug(f"Claude session ID from input: {session_id}")
            # Store session ID for other hooks to use
            self._store_session_id(session_id)
            return session_id
        
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id:
            logger.debug(f"Claude session ID from environment: {session_id}")
            # Store even valid session IDs for other hooks to use
            self._store_session_id(session_id)
            return session_id
        
        # Generate fallback session ID when Claude Code doesn't provide one
        fallback_id = f"chronicle-fallback-{uuid.uuid4()}"
        logger.warning(f"No Claude session ID found, generated fallback: {fallback_id}")
        
        # Store fallback session ID for other hooks to use
        self._store_session_id(fallback_id)
        return fallback_id
    
    def _store_session_id(self, session_id: str):
        """Store session ID in a temporary file for other hooks to access."""
        try:
            session_cache_dir = Path.home() / ".claude" / "hooks" / "chronicle" / "tmp"
            session_cache_dir.mkdir(parents=True, exist_ok=True)
            session_cache_file = session_cache_dir / "current_session_id"
            with open(session_cache_file, 'w') as f:
                f.write(session_id)
            logger.debug(f"Stored session ID to cache: {session_id}")
        except Exception as e:
            logger.warning(f"Failed to store session ID: {e}")
    
    def load_project_context(self, cwd: Optional[str] = None) -> Dict[str, Any]:
        """Load project context with environment support."""
        context = get_project_context_with_env_support(cwd)
        context["timestamp"] = datetime.now().isoformat()
        return context
    
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate hook input data."""
        # Fast validation
        if not isinstance(input_data, dict):
            return {
                "hook_event_name": "Unknown",
                "error": "Invalid input data",
                "early_return": True
            }
        
        # Extract session ID
        self.claude_session_id = self.get_claude_session_id(input_data)
        
        # Sanitize input
        sanitized_input = sanitize_data(input_data)
        
        raw_hook_event_name = sanitized_input.get("hookEventName", "unknown")
        normalized_hook_event_name = self._normalize_hook_event_name(raw_hook_event_name)
        
        return {
            "hook_event_name": normalized_hook_event_name,
            "claude_session_id": self.claude_session_id,
            "transcript_path": sanitized_input.get("transcriptPath"),
            "cwd": sanitized_input.get("cwd", os.getcwd()),
            "raw_input": sanitized_input,
            "timestamp": datetime.now().isoformat(),
        }
    
    def _normalize_hook_event_name(self, hook_event_name: str) -> str:
        """Normalize hook event name to PascalCase format."""
        if not hook_event_name:
            return "Unknown"
        
        event_name_mapping = {
            "session_start": "SessionStart",
            "pre_tool_use": "PreToolUse",
            "post_tool_use": "PostToolUse", 
            "user_prompt_submit": "UserPromptSubmit",
            "pre_compact": "PreCompact",
            "notification": "Notification",
            "stop": "Stop",
            "subagent_stop": "SubagentStop"
        }
        
        if hook_event_name.lower() in event_name_mapping:
            return event_name_mapping[hook_event_name.lower()]
        
        if hook_event_name in event_name_mapping.values():
            return hook_event_name
        
        if "_" in hook_event_name:
            words = hook_event_name.split("_")
            return "".join(word.capitalize() for word in words)
        
        return hook_event_name
    
    def save_session(self, session_data: Dict[str, Any]) -> bool:
        """Save session data to database."""
        try:
            if "claude_session_id" not in session_data and self.claude_session_id:
                session_data["claude_session_id"] = self.claude_session_id
            
            if "claude_session_id" not in session_data:
                logger.error("Cannot save session: no claude_session_id available")
                return False
            
            if "start_time" not in session_data:
                session_data["start_time"] = datetime.now().isoformat()
            
            if "id" not in session_data:
                session_data["id"] = str(uuid.uuid4())
            
            sanitized_data = sanitize_data(session_data)
            success, session_uuid = self.db_manager.save_session(sanitized_data)
            
            if success and session_uuid:
                self.session_uuid = session_uuid
                logger.debug(f"Session saved successfully with UUID: {session_uuid}")
                return True
            else:
                logger.error("Failed to save session")
                return False
                
        except Exception as e:
            logger.error(f"Exception saving session: {format_error_message(e, 'save_session')}")
            return False
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to database."""
        try:
            # Ensure session exists
            if not self.session_uuid and self.claude_session_id:
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success and session_uuid:
                    self.session_uuid = session_uuid
                else:
                    raise DatabaseError("Failed to create session for event")
            
            if not self.session_uuid:
                raise DatabaseError("Cannot save event: no session UUID available")
            
            if "session_id" not in event_data:
                event_data["session_id"] = self.session_uuid
            
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            sanitized_data = sanitize_data(event_data)
            success = self.db_manager.save_event(sanitized_data)
            
            if success:
                logger.debug(f"Event saved successfully: {event_data.get('hook_event_name', 'unknown')}")
                return True
            else:
                raise DatabaseError(f"Failed to save event: {event_data.get('hook_event_name', 'unknown')}")
                
        except Exception as e:
            logger.error(f"Exception saving event: {format_error_message(e, 'save_event')}")
            return False
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None,
                       stop_reason: Optional[str] = None) -> Dict[str, Any]:
        """Create standardized hook response."""
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        if not continue_execution and stop_reason:
            response["stopReason"] = stop_reason
        
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
    def create_hook_specific_output(self, hook_event_name: str, **kwargs) -> Dict[str, Any]:
        """Create hookSpecificOutput dictionary with camelCase field names."""
        output = {"hookEventName": hook_event_name}
        
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                output[camel_key] = value
        
        return output
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case string to camelCase."""
        if not snake_str:
            return snake_str
        
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])
    
    def log_error(self, error: Exception, context: Optional[str] = None) -> None:
        """Log error to local file for debugging."""
        try:
            timestamp = datetime.now().isoformat()
            error_msg = format_error_message(error, context)
            
            log_entry = f"[{timestamp}] {error_msg}\n"
            
            with open(self.log_file, 'a') as f:
                f.write(log_entry)
        except:
            pass  # Don't let logging errors break the hook

# ===========================================
# Session Start Hook Implementation
# ===========================================

class SessionStartHook(BaseHook):
    """Hook for processing Claude Code session start events."""
    
    def __init__(self, config=None):
        super().__init__(config)
        self.hook_name = "SessionStart"
    
    def process_session_start(self, input_data):
        """Process session start hook data with performance optimization."""
        try:
            with measure_performance("session_start.data_processing") as metrics:
                processed_data = self.process_hook_data(input_data)
                
                if processed_data.get("early_return"):
                    return (False, {}, {"error": processed_data.get("error", "Processing failed")})
            
            # Get project context with caching
            with measure_performance("session_start.project_context") as metrics:
                cwd = processed_data.get("cwd")
                cache_key = f"project_context:{cwd}" if cwd else "project_context:default"
                
                project_context = self.hook_cache.get(cache_key)
                if not project_context:
                    project_context = self.load_project_context(cwd)
                    self.hook_cache.set(cache_key, project_context)
            
            # Extract session start specific data
            trigger_source = input_data.get("source", "unknown")
            
            # Prepare session data
            session_data = {
                "claude_session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "source": trigger_source,
                "project_path": project_context.get("cwd"),
                "git_branch": project_context.get("git_info", {}).get("branch"),
                "git_commit": project_context.get("git_info", {}).get("commit_hash"),
            }
            
            # Prepare event data
            event_data = {
                "event_type": "session_start",
                "hook_event_name": processed_data.get("hook_event_name", "SessionStart"),
                "data": {
                    "project_path": project_context.get("cwd"),
                    "git_branch": project_context.get("git_info", {}).get("branch"),
                    "git_commit": project_context.get("git_info", {}).get("commit_hash"),
                    "trigger_source": trigger_source,
                    "session_context": project_context.get("session_context", {}),
                }
            }
            
            # Save session and event
            with measure_performance("session_start.database_operations"):
                session_success = self.save_session(session_data)
                event_success = False
                
                if session_success and self.session_uuid:
                    event_success = self.save_event(event_data)
                else:
                    logger.warning("Cannot save event: session save failed")
            
            return (session_success and event_success, session_data, event_data)
            
        except Exception as e:
            logger.error(f"Exception in process_session_start: {e}")
            return (False, {}, {})
    
    def create_session_start_response(self, success, session_data, event_data, 
                                      additional_context: Optional[str] = None):
        """Create hook response for session start."""
        hook_data = self.create_hook_specific_output(
            hook_event_name="SessionStart",
            session_initialized=success,
            claude_session_id=session_data.get("claude_session_id"),
            session_uuid=getattr(self, "session_uuid", None),
            project_path=session_data.get("project_path"),
            git_branch=session_data.get("git_branch"),
            git_commit=session_data.get("git_commit"),
            trigger_source=session_data.get("source")
        )
        
        if additional_context:
            hook_data["additionalContext"] = additional_context
        
        return self.create_response(
            continue_execution=True,
            suppress_output=True,
            hook_specific_data=hook_data
        )
    
    def generate_session_context(self, session_data: Dict[str, Any], 
                                event_data: Dict[str, Any]) -> Optional[str]:
        """Generate contextual information for the session start."""
        context_parts = []
        
        # Git branch context
        git_branch = session_data.get("git_branch")
        if git_branch and git_branch not in ["main", "master"]:
            context_parts.append(f"You're working on branch '{git_branch}'")
        
        # Project type detection
        project_path = session_data.get("project_path", "")
        project_type = self._detect_project_type(project_path)
        if project_type:
            context_parts.append(f"Detected {project_type} project")
        
        # Session resumption context
        trigger_source = session_data.get("source")
        if trigger_source == "resume":
            context_parts.append("Resuming previous session")
        elif trigger_source == "clear":
            context_parts.append("Starting fresh session (context cleared)")
        
        return " | ".join(context_parts) if context_parts else None
    
    def _detect_project_type(self, project_path: str) -> Optional[str]:
        """Detect project type based on directory contents."""
        if not project_path or not os.path.isdir(project_path):
            return None
        
        try:
            files = os.listdir(project_path)
            file_set = set(files)
            
            if any(f in file_set for f in ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"]):
                return "Python"
            elif "package.json" in file_set:
                return "Node.js"
            elif "Cargo.toml" in file_set:
                return "Rust"
            elif "go.mod" in file_set:
                return "Go"
            elif "pom.xml" in file_set or "build.gradle" in file_set:
                return "Java"
            elif "composer.json" in file_set:
                return "PHP"
            elif "Gemfile" in file_set:
                return "Ruby"
                
        except OSError:
            pass
        
        return None

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for session start hook."""
    try:
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Initialize hook
        hook = SessionStartHook()
        
        # Process session start
        start_time = time.perf_counter()
        
        success, session_data, event_data = hook.process_session_start(input_data)
        additional_context = hook.generate_session_context(session_data, event_data)
        response = hook.create_session_start_response(success, session_data, event_data, additional_context)
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        response["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        else:
            logger.debug(f"Hook completed in {execution_time:.2f}ms")
        
        # Output response
        print(json_impl.dumps(response, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Invalid JSON input
        minimal_response = {
            "continue": True, 
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "error": "Invalid JSON input",
                "sessionInitialized": False
            }
        }
        print(json_impl.dumps(minimal_response))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Critical error in session start hook: {e}")
        # Output minimal response
        try:
            minimal_response = {"continue": True, "suppressOutput": True}
            print(json_impl.dumps(minimal_response))
        except:
            print("{}")
        sys.exit(0)

if __name__ == "__main__":
    main()