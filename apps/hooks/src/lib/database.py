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

# Configure logger
logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


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


class DatabaseManager:
    """Unified database interface with Supabase/SQLite fallback - UV Compatible."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize database manager with configuration."""
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
        
        # Set table names (updated for consistency)
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
        """Save session data to BOTH databases (Supabase and SQLite)."""
        try:
            if "claude_session_id" not in session_data:
                return False, None
            
            claude_session_id = validate_and_fix_session_id(session_data.get("claude_session_id"))
            
            # Track save results
            supabase_saved = False
            sqlite_saved = False
            session_uuid = None
            
            # Try Supabase first
            if self.supabase_client:
                logger.info(f"Supabase client is available for session save")
                try:
                    # Check for existing session
                    existing = self.supabase_client.table(self.SESSIONS_TABLE).select("id").eq("claude_session_id", claude_session_id).execute()
                    
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
                    
                    self.supabase_client.table(self.SESSIONS_TABLE).upsert(supabase_data, on_conflict="claude_session_id").execute()
                    logger.info(f"Supabase session saved successfully: {session_uuid}")
                    supabase_saved = True
                    
                except Exception as e:
                    logger.warning(f"Supabase session save failed: {e}")
            else:
                logger.warning(f"Supabase client is NOT available for session save")
            
            # Always try SQLite regardless of Supabase result
            try:
                # If we don't have a session_uuid yet, check SQLite or generate one
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
                    sqlite_saved = True
            except Exception as e:
                logger.warning(f"SQLite session save failed: {e}")
            
            # Log final result
            if supabase_saved and sqlite_saved:
                logger.info(f"Session saved to BOTH databases: {session_uuid}")
            elif supabase_saved:
                logger.info(f"Session saved to Supabase only: {session_uuid}")
            elif sqlite_saved:
                logger.info(f"Session saved to SQLite only: {session_uuid}")
            else:
                logger.error(f"Session failed to save to any database")
                return False, None
            
            # Return success if at least one database saved
            return (supabase_saved or sqlite_saved), session_uuid
            
        except Exception as e:
            logger.error(f"Session save failed: {e}")
            
            # If SQLite failed but Supabase is available, try Supabase as fallback
            if self.supabase_client:
                try:
                    logger.info("Retrying with Supabase after SQLite failure...")
                    session_uuid = str(uuid.uuid4())
                    session_data_copy = session_data.copy()
                    session_data_copy["id"] = session_uuid
                    session_data_copy["claude_session_id"] = claude_session_id
                    
                    result = self.supabase_client.table(self.SESSIONS_TABLE).upsert(
                        session_data_copy,
                        on_conflict="claude_session_id"
                    ).execute()
                    
                    if result.data:
                        session_uuid = ensure_valid_uuid(result.data[0]["id"])
                        logger.info(f"Successfully saved to Supabase on retry: {session_uuid}")
                        return True, session_uuid
                except Exception as retry_error:
                    logger.error(f"Supabase retry also failed: {retry_error}")
            
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to BOTH databases (Supabase and SQLite)."""
        try:
            event_id = str(uuid.uuid4())
            
            if "session_id" not in event_data:
                logger.error("Event data missing required session_id")
                return False
            
            # Ensure session_id is a valid UUID
            session_id = ensure_valid_uuid(event_data.get("session_id"))
            
            # Track save results
            supabase_saved = False
            sqlite_saved = False
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    metadata_jsonb = event_data.get("data", {})
                    
                    if "hook_event_name" in event_data:
                        metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
                    
                    if "metadata" in event_data:
                        metadata_jsonb.update(event_data.get("metadata", {}))
                    
                    # UPDATED valid event types from inline hook analysis
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
                    
                    logger.info(f"Saving to Supabase - event_type: {event_type} (original: {event_data.get('event_type')})")
                    self.supabase_client.table(self.EVENTS_TABLE).insert(supabase_data).execute()
                    logger.info(f"Supabase event saved successfully: {event_type}")
                    supabase_saved = True
                    
                except Exception as e:
                    logger.warning(f"Supabase event save failed: {e}")
            
            # Always try SQLite regardless of Supabase result
            try:
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
                    sqlite_saved = True
            except Exception as e:
                logger.warning(f"SQLite event save failed: {e}")
            
            # Log final result
            if supabase_saved and sqlite_saved:
                logger.info(f"Event saved to BOTH databases: {event_data.get('event_type')}")
            elif supabase_saved:
                logger.info(f"Event saved to Supabase only: {event_data.get('event_type')}")
            elif sqlite_saved:
                logger.info(f"Event saved to SQLite only: {event_data.get('event_type')}")
            else:
                logger.error(f"Event failed to save to any database: {event_data.get('event_type')}")
            
            # Return success if at least one database saved
            return supabase_saved or sqlite_saved
            
        except Exception as e:
            logger.error(f"Event save failed: {e}")
            
            # If SQLite failed but Supabase is available, try Supabase as fallback
            if self.supabase_client:
                try:
                    logger.info("Retrying event save with Supabase after SQLite failure...")
                    metadata_jsonb = event_data.get("data", {})
                    
                    if "hook_event_name" in event_data:
                        metadata_jsonb["hook_event_name"] = event_data.get("hook_event_name")
                    
                    if "metadata" in event_data:
                        metadata_jsonb.update(event_data.get("metadata", {}))
                    
                    supabase_data = {
                        "id": event_id,
                        "session_id": session_id,
                        "event_type": event_data.get("event_type"),
                        "timestamp": event_data.get("timestamp"),
                        "metadata": metadata_jsonb,
                    }
                    
                    self.supabase_client.table(self.EVENTS_TABLE).insert(supabase_data).execute()
                    logger.info(f"Successfully saved event to Supabase on retry: {event_data.get('event_type')}")
                    return True
                except Exception as retry_error:
                    logger.error(f"Supabase event retry also failed: {retry_error}")
            
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID from database."""
        try:
            # Validate and fix session ID format
            validated_session_id = validate_and_fix_session_id(session_id)
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    # Try both the original and validated session ID
                    for sid in [session_id, validated_session_id]:
                        result = self.supabase_client.table(self.SESSIONS_TABLE).select("*").eq("claude_session_id", sid).execute()
                        if result.data:
                            return result.data[0]
                except Exception as e:
                    logger.debug(f"Supabase session retrieval failed: {e}")
                    pass
            
            # SQLite fallback
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
            if self.supabase_client:
                # Test Supabase connection
                self.supabase_client.table(self.SESSIONS_TABLE).select("id").limit(1).execute()
                return True
            else:
                # Test SQLite connection
                with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                    conn.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of database connections."""
        return {
            "supabase_available": self.supabase_client is not None,
            "sqlite_path": str(self.sqlite_path),
            "sqlite_exists": self.sqlite_path.exists(),
            "connection_healthy": self.test_connection(),
            "table_prefix": "chronicle_" if self.supabase_client else ""
        }


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