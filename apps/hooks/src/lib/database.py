"""
Database client wrapper for Claude Code observability hooks - UV Compatible Library Module.

This module provides a unified database interface with automatic fallback
from Supabase (PostgreSQL) to SQLite when needed. Extracted from inline hooks
with updated event type mappings and UV compatibility.
"""

import json
import logging
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

# Load environment variables
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

# HTTP client for local API backend
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# Configure logger
logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class ConnectionError(DatabaseError):
    """Database connection specific errors."""
    pass


class ValidationError(DatabaseError):
    """Data validation specific errors."""
    pass


class SupabaseClient:
    """
    Simplified SupabaseClient wrapper for backward compatibility.
    
    This provides the same interface as the core SupabaseClient but with 
    simpler implementation for UV compatibility.
    """
    
    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        """Initialize Supabase client."""
        self.supabase_url = url or os.getenv("SUPABASE_URL")
        self.supabase_key = key or os.getenv("SUPABASE_ANON_KEY")
        self._supabase_client: Optional[Client] = None
        
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            try:
                self._supabase_client = create_client(self.supabase_url, self.supabase_key)
            except Exception:
                pass
    
    def health_check(self) -> bool:
        """Check if the database connection is healthy."""
        if not self._supabase_client:
            return False
        try:
            # Simple query to test connection
            result = self._supabase_client.table("chronicle_sessions").select("count").limit(1).execute()
            return True
        except:
            return False
    
    def has_client(self) -> bool:
        """Check if client is initialized."""
        return self._supabase_client is not None
    
    def get_client(self) -> Optional[Client]:
        """Get the underlying Supabase client."""
        return self._supabase_client


class BackendInterface:
    """Abstract interface for Chronicle backend implementations."""
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data to backend."""
        raise NotImplementedError
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to backend."""
        raise NotImplementedError
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID from backend."""
        raise NotImplementedError
    
    def health_check(self) -> bool:
        """Check backend health."""
        raise NotImplementedError


class LocalAPIBackend(BackendInterface):
    """
    Local API backend that communicates with Chronicle server on localhost:8510.
    
    This backend sends HTTP requests to a local Chronicle server instead of 
    directly writing to databases.
    """
    
    def __init__(self, base_url: Optional[str] = None, timeout: int = 10):
        """Initialize Local API backend."""
        self.base_url = base_url or "http://localhost:8510"
        self.timeout = timeout
        self.session = None
        
        if REQUESTS_AVAILABLE:
            import requests
            self.session = requests.Session()
            # Set reasonable defaults for local API
            self.session.timeout = timeout
            self.session.headers.update({
                'Content-Type': 'application/json',
                'User-Agent': 'Chronicle-Hooks/1.0'
            })
        
        logger.info(f"LocalAPIBackend initialized for {self.base_url}")
    
    def health_check(self) -> bool:
        """Check if the local API server is healthy."""
        if not REQUESTS_AVAILABLE or not self.session:
            logger.warning("Requests library not available for LocalAPIBackend")
            return False
        
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"LocalAPIBackend health check failed: {e}")
            return False
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data via local API."""
        if not REQUESTS_AVAILABLE or not self.session:
            logger.error("Requests library not available for LocalAPIBackend")
            return False, None
        
        try:
            # Ensure session has required fields
            if "claude_session_id" not in session_data:
                logger.error("Session data missing claude_session_id")
                return False, None
            
            # Add UUID if not present
            if "id" not in session_data:
                session_data["id"] = str(uuid.uuid4())
            
            response = self.session.post(
                f"{self.base_url}/api/sessions",
                json=session_data,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201]:
                result_data = response.json()
                session_uuid = result_data.get("id") or session_data["id"]
                logger.info(f"LocalAPIBackend session saved successfully: {session_uuid}")
                return True, session_uuid
            else:
                logger.error(f"LocalAPIBackend session save failed: {response.status_code} - {response.text}")
                return False, None
                
        except Exception as e:
            logger.error(f"LocalAPIBackend session save exception: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data via local API."""
        if not REQUESTS_AVAILABLE or not self.session:
            logger.error("Requests library not available for LocalAPIBackend")
            return False
        
        try:
            # Ensure event has required fields
            if "session_id" not in event_data:
                logger.error("Event data missing session_id")
                return False
            
            # Add UUID if not present
            if "event_id" not in event_data and "id" not in event_data:
                event_data["id"] = str(uuid.uuid4())
            
            response = self.session.post(
                f"{self.base_url}/api/events",
                json=event_data,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"LocalAPIBackend event saved successfully: {event_data.get('event_type')}")
                return True
            else:
                logger.error(f"LocalAPIBackend event save failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"LocalAPIBackend event save exception: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID via local API."""
        if not REQUESTS_AVAILABLE or not self.session:
            logger.error("Requests library not available for LocalAPIBackend")
            return None
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/sessions/{session_id}",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.debug(f"LocalAPIBackend session not found: {session_id}")
                return None
                
        except Exception as e:
            logger.error(f"LocalAPIBackend session retrieval exception: {e}")
            return None


class SupabaseBackend(BackendInterface):
    """
    Supabase backend implementation wrapping existing SupabaseClient functionality.
    """
    
    def __init__(self, supabase_client: Client):
        """Initialize Supabase backend."""
        self.client = supabase_client
        self.SESSIONS_TABLE = "chronicle_sessions"
        self.EVENTS_TABLE = "chronicle_events"
        logger.info("SupabaseBackend initialized")
    
    def health_check(self) -> bool:
        """Check Supabase connection health."""
        try:
            self.client.table(self.SESSIONS_TABLE).select("count").limit(1).execute()
            return True
        except Exception as e:
            logger.debug(f"SupabaseBackend health check failed: {e}")
            return False
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data to Supabase."""
        try:
            if "claude_session_id" not in session_data:
                return False, None
            
            claude_session_id = validate_and_fix_session_id(session_data.get("claude_session_id"))
            
            # Check for existing session
            existing = self.client.table(self.SESSIONS_TABLE).select("id").eq("claude_session_id", claude_session_id).execute()
            
            if existing.data:
                session_uuid = ensure_valid_uuid(existing.data[0]["id"])
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
                "claude_session_id": claude_session_id,
                "start_time": session_data.get("start_time"),
                "end_time": session_data.get("end_time"),
                "project_path": session_data.get("project_path"),
                "git_branch": session_data.get("git_branch"),
                "metadata": metadata,
            }
            
            self.client.table(self.SESSIONS_TABLE).upsert(supabase_data, on_conflict="claude_session_id").execute()
            logger.info(f"SupabaseBackend session saved successfully: {session_uuid}")
            return True, session_uuid
            
        except Exception as e:
            logger.error(f"SupabaseBackend session save failed: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to Supabase."""
        try:
            if "session_id" not in event_data:
                logger.error("Event data missing required session_id")
                return False
            
            event_id = str(uuid.uuid4())
            session_id = ensure_valid_uuid(event_data.get("session_id"))
            
            metadata_jsonb = event_data.get("data", {})
            
            if "hook_event_name" in event_data:
                metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
            
            if "metadata" in event_data:
                metadata_jsonb.update(event_data.get("metadata", {}))
            
            # Validate event type
            event_type = event_data.get("event_type")
            valid_types = [
                "prompt", "tool_use", "session_start", "session_end", "notification", "error",
                "pre_tool_use", "post_tool_use", "user_prompt_submit", "stop", "subagent_stop",
                "pre_compact", "subagent_termination", "pre_compaction"
            ]
            if event_type not in valid_types:
                event_type = "notification"
            
            supabase_data = {
                "id": event_id,
                "session_id": session_id,
                "event_type": event_type,
                "timestamp": event_data.get("timestamp"),
                "metadata": metadata_jsonb,
            }
            
            self.client.table(self.EVENTS_TABLE).insert(supabase_data).execute()
            logger.info(f"SupabaseBackend event saved successfully: {event_type}")
            return True
            
        except Exception as e:
            logger.error(f"SupabaseBackend event save failed: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID from Supabase."""
        try:
            validated_session_id = validate_and_fix_session_id(session_id)
            
            # Try both the original and validated session ID
            for sid in [session_id, validated_session_id]:
                result = self.client.table(self.SESSIONS_TABLE).select("*").eq("claude_session_id", sid).execute()
                if result.data:
                    return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"SupabaseBackend session retrieval failed: {e}")
            return None


def get_database_config() -> Dict[str, Any]:
    """Get database configuration with proper paths."""
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
        'backend_mode': os.getenv('CHRONICLE_BACKEND_MODE', 'auto'),
        'local_api_url': os.getenv('CHRONICLE_LOCAL_API_URL', 'http://localhost:8510'),
        'supabase_url': os.getenv('SUPABASE_URL'),
        'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
        'sqlite_path': os.getenv('CLAUDE_HOOKS_DB_PATH', default_db_path),
        'db_timeout': int(os.getenv('CLAUDE_HOOKS_DB_TIMEOUT', '5')),
        'retry_attempts': int(os.getenv('CLAUDE_HOOKS_DB_RETRY_ATTEMPTS', '3')),
        'retry_delay': float(os.getenv('CLAUDE_HOOKS_DB_RETRY_DELAY', '1.0')),
    }
    
    # Ensure SQLite directory exists
    sqlite_path = Path(config['sqlite_path'])
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    
    return config


class DatabaseManager:
    """
    Unified database interface with configurable backends - UV Compatible.
    
    Supports three modes:
    - local: Uses LocalAPIBackend to communicate with localhost:8510
    - supabase: Uses SupabaseBackend for cloud database
    - auto: Automatically detects and chooses best available backend
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize database manager with backend mode detection."""
        self.config = config or get_database_config()
        self.mode = self.config.get('backend_mode', 'auto')
        self.backend: Optional[BackendInterface] = None
        
        # Legacy compatibility - keep these for fallback
        self.sqlite_path = Path(self.config['sqlite_path']).expanduser().resolve()
        self.timeout = self.config.get('db_timeout', 30)
        
        # Initialize backend based on mode
        if self.mode == "local":
            self.backend = self._init_local_backend()
        elif self.mode == "supabase":
            self.backend = self._init_supabase_backend()
        else:  # auto mode
            self.backend = self._detect_backend()
        
        # Ensure SQLite fallback exists if backend is not available or fails
        self._ensure_sqlite_database()
        
        # Set table names based on backend type
        if isinstance(self.backend, SupabaseBackend):
            self.SESSIONS_TABLE = "chronicle_sessions"
            self.EVENTS_TABLE = "chronicle_events"
        else:
            self.SESSIONS_TABLE = "sessions"
            self.EVENTS_TABLE = "events"
        
        logger.info(f"DatabaseManager initialized with mode '{self.mode}' using backend: {type(self.backend).__name__}")
    
    def _init_local_backend(self) -> Optional[LocalAPIBackend]:
        """Initialize LocalAPIBackend."""
        try:
            local_url = self.config.get('local_api_url', 'http://localhost:8510')
            backend = LocalAPIBackend(base_url=local_url, timeout=self.timeout)
            
            # Test the connection
            if backend.health_check():
                logger.info(f"LocalAPIBackend connected successfully to {local_url}")
                return backend
            else:
                logger.warning(f"LocalAPIBackend health check failed for {local_url}")
                return None
        except Exception as e:
            logger.warning(f"Failed to initialize LocalAPIBackend: {e}")
            return None
    
    def _init_supabase_backend(self) -> Optional[SupabaseBackend]:
        """Initialize SupabaseBackend."""
        if not SUPABASE_AVAILABLE:
            logger.warning("Supabase library not available")
            return None
        
        try:
            supabase_url = self.config.get('supabase_url')
            supabase_key = self.config.get('supabase_key')
            
            if not (supabase_url and supabase_key):
                logger.info("Supabase credentials not provided")
                return None
            
            supabase_client = create_client(supabase_url, supabase_key)
            backend = SupabaseBackend(supabase_client)
            
            # Test the connection
            if backend.health_check():
                logger.info("SupabaseBackend connected successfully")
                return backend
            else:
                logger.warning("SupabaseBackend health check failed")
                return None
        except Exception as e:
            logger.warning(f"Failed to initialize SupabaseBackend: {e}")
            return None
    
    def _detect_backend(self) -> Optional[BackendInterface]:
        """Auto-detect the best available backend."""
        logger.info("Auto-detecting best backend...")
        
        # Priority 1: Try local API backend
        local_backend = self._init_local_backend()
        if local_backend:
            logger.info("Auto-detected LocalAPIBackend")
            return local_backend
        
        # Priority 2: Try Supabase backend
        supabase_backend = self._init_supabase_backend()
        if supabase_backend:
            logger.info("Auto-detected SupabaseBackend")
            return supabase_backend
        
        # Priority 3: Fall back to SQLite (no backend wrapper needed)
        logger.info("Auto-detected SQLite fallback (no remote backend available)")
        return None
    
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
        
        # Events table - no CHECK constraint to allow all event types
        conn.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL DEFAULT '{}',
                tool_name TEXT,
                duration_ms INTEGER CHECK (duration_ms >= 0),
                created_at TEXT DEFAULT (datetime('now', 'utc')),
                FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        ''')
        
        # Create indexes
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)')
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data using configured backend with SQLite fallback."""
        try:
            if "claude_session_id" not in session_data:
                logger.error("Session data missing claude_session_id")
                return False, None
            
            # Try primary backend first
            if self.backend:
                try:
                    success, session_uuid = self.backend.save_session(session_data)
                    if success:
                        # Also save to SQLite for local caching/backup
                        self._save_session_to_sqlite(session_data, session_uuid)
                        return True, session_uuid
                    else:
                        logger.warning(f"Primary backend ({type(self.backend).__name__}) session save failed")
                except Exception as e:
                    logger.warning(f"Primary backend ({type(self.backend).__name__}) session save exception: {e}")
            
            # Fallback to SQLite
            logger.info("Falling back to SQLite for session save")
            return self._save_session_to_sqlite(session_data)
            
        except Exception as e:
            logger.error(f"Session save failed completely: {e}")
            return False, None
    
    def _save_session_to_sqlite(self, session_data: Dict[str, Any], session_uuid: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """Save session data to SQLite database."""
        try:
            claude_session_id = validate_and_fix_session_id(session_data.get("claude_session_id"))
            
            # Use provided UUID or check for existing or generate new
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
                     git_branch)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    session_uuid,
                    claude_session_id,
                    session_data.get("start_time"),
                    session_data.get("end_time"),
                    session_data.get("project_path"),
                    session_data.get("git_branch"),
                ))
                conn.commit()
                logger.info(f"SQLite session saved successfully: {session_uuid}")
                return True, session_uuid
        except Exception as e:
            logger.error(f"SQLite session save failed: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data using configured backend with SQLite fallback."""
        try:
            if "session_id" not in event_data:
                logger.error("Event data missing required session_id")
                return False
            
            # Try primary backend first
            if self.backend:
                try:
                    success = self.backend.save_event(event_data)
                    if success:
                        # Also save to SQLite for local caching/backup
                        self._save_event_to_sqlite(event_data)
                        return True
                    else:
                        logger.warning(f"Primary backend ({type(self.backend).__name__}) event save failed")
                except Exception as e:
                    logger.warning(f"Primary backend ({type(self.backend).__name__}) event save exception: {e}")
            
            # Fallback to SQLite
            logger.info("Falling back to SQLite for event save")
            return self._save_event_to_sqlite(event_data)
            
        except Exception as e:
            logger.error(f"Event save failed completely: {e}")
            return False
    
    def _save_event_to_sqlite(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to SQLite database."""
        try:
            event_id = str(uuid.uuid4())
            session_id = ensure_valid_uuid(event_data.get("session_id"))
            
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                metadata_jsonb = event_data.get("data", {})
                
                if "hook_event_name" in event_data:
                    metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
                
                if "metadata" in event_data:
                    metadata_jsonb.update(event_data.get("metadata", {}))
                
                # Extract tool_name if present in data
                tool_name = None
                if metadata_jsonb and "tool_name" in metadata_jsonb:
                    tool_name = metadata_jsonb["tool_name"]
                
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, timestamp, data, tool_name)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    event_id,
                    session_id,
                    event_data.get("event_type"),
                    event_data.get("timestamp"),
                    json.dumps(metadata_jsonb),
                    tool_name,
                ))
                conn.commit()
                logger.info(f"SQLite event saved successfully: {event_data.get('event_type')}")
                return True
        except Exception as e:
            logger.error(f"SQLite event save failed: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID using configured backend with SQLite fallback."""
        try:
            # Try primary backend first
            if self.backend:
                try:
                    result = self.backend.get_session(session_id)
                    if result:
                        return result
                except Exception as e:
                    logger.debug(f"Primary backend ({type(self.backend).__name__}) session retrieval failed: {e}")
            
            # Fallback to SQLite
            validated_session_id = validate_and_fix_session_id(session_id)
            
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.row_factory = sqlite3.Row
                # Try both the original and validated session ID
                for sid in [session_id, validated_session_id]:
                    cursor = conn.execute(
                        "SELECT * FROM sessions WHERE claude_session_id = ?",
                        (sid,)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
            
            logger.debug(f"Session not found for ID: {session_id} (validated: {validated_session_id})")
            return None
            
        except Exception as e:
            logger.error(f"Session retrieval failed: {e}")
            return None
    
    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            # Test primary backend if available
            if self.backend:
                if self.backend.health_check():
                    return True
                logger.warning(f"Primary backend ({type(self.backend).__name__}) health check failed")
            
            # Test SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of database connections and backends."""
        status = {
            "mode": self.mode,
            "primary_backend": type(self.backend).__name__ if self.backend else "None",
            "sqlite_path": str(self.sqlite_path),
            "sqlite_exists": self.sqlite_path.exists(),
            "connection_healthy": self.test_connection(),
        }
        
        # Add backend-specific status
        if self.backend:
            status["primary_backend_healthy"] = self.backend.health_check()
            if isinstance(self.backend, LocalAPIBackend):
                status["local_api_url"] = self.backend.base_url
            elif isinstance(self.backend, SupabaseBackend):
                status["table_prefix"] = "chronicle_"
        else:
            status["primary_backend_healthy"] = False
        
        return status


# Event type mapping functions for hook compatibility
def get_valid_event_types() -> list:
    """Get list of all valid event types supported by the database."""
    return [
        "prompt", "tool_use", "session_start", "session_end", "notification", "error",
        "pre_tool_use", "post_tool_use", "user_prompt_submit", "stop", "subagent_stop", 
        "pre_compact", "subagent_termination", "pre_compaction"
    ]


def normalize_event_type(hook_name: str) -> str:
    """
    Normalize hook names to proper event types.
    
    Args:
        hook_name: The hook name (e.g., "PostToolUse", "PreToolUse")
        
    Returns:
        The normalized event type for database storage
    """
    # Map hook names to their normalized event types based on inline hook analysis
    hook_mapping = {
        "PreToolUse": "pre_tool_use",
        "PostToolUse": "tool_use",  # post_tool_use hook uses "tool_use" event type
        "UserPromptSubmit": "prompt",
        "SessionStart": "session_start", 
        "Stop": "session_end",
        "SubagentStop": "subagent_termination",
        "Notification": "notification",
        "PreCompact": "pre_compaction"
    }
    
    return hook_mapping.get(hook_name, "notification")


def validate_event_type(event_type: str) -> bool:
    """
    Validate if an event type is supported.
    
    Args:
        event_type: The event type to validate
        
    Returns:
        True if valid, False otherwise
    """
    return event_type in get_valid_event_types()


def validate_and_fix_session_id(session_id: str) -> str:
    """
    Validate and fix session ID format for database compatibility.
    
    Args:
        session_id: The session ID to validate
        
    Returns:
        A properly formatted session ID
    """
    if not session_id:
        return str(uuid.uuid4())
    
    # If it's already a valid UUID, return as is
    try:
        uuid.UUID(session_id)
        return session_id
    except ValueError:
        pass
    
    # If it's not a UUID but is a valid string, create a deterministic UUID
    import hashlib
    namespace = uuid.UUID('12345678-1234-5678-1234-123456789012')
    return str(uuid.uuid5(namespace, session_id))


def ensure_valid_uuid(value: str) -> str:
    """
    Ensure a value is a valid UUID string.
    
    Args:
        value: The value to check/convert
        
    Returns:
        A valid UUID string
    """
    if not value:
        return str(uuid.uuid4())
    
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        return str(uuid.uuid4())