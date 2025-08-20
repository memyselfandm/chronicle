"""
Consolidated Database Client for UV Single-File Scripts

Essential database connectivity functionality consolidated into a minimal module 
suitable for inlining into UV single-file scripts. Provides both Supabase and 
SQLite support with automatic fallback.

Key consolidations:
- Removed async functionality to reduce complexity
- Simplified error handling with basic logging
- Removed performance monitoring to reduce dependencies
- Consolidated client classes into single interface
- Removed retry logic complexity
- Essential validation only
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

# Optional imports with fallbacks
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Database operation error."""
    pass


class ConsolidatedDatabase:
    """
    Minimal database manager with Supabase and SQLite support.
    Designed for inline use in UV single-file scripts.
    """
    
    def __init__(self):
        """Initialize with automatic fallback detection."""
        self.use_supabase = False
        self.sqlite_path = os.path.expanduser(
            os.getenv("CLAUDE_HOOKS_DB_PATH", "~/.claude/hooks_data.db")
        )
        
        # Try Supabase first if available
        if SUPABASE_AVAILABLE:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if supabase_url and supabase_key:
                try:
                    self.supabase_client = create_client(supabase_url, supabase_key)
                    # Test connection
                    result = self.supabase_client.from_('chronicle_sessions').select('id').limit(1).execute()
                    self.use_supabase = True
                    logger.info("Using Supabase as primary database")
                except Exception as e:
                    logger.warning(f"Supabase connection failed: {e}")
        
        if not self.use_supabase:
            # Ensure SQLite database exists
            Path(self.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
            self._ensure_sqlite_schema()
            logger.info("Using SQLite as database")
    
    def _ensure_sqlite_schema(self):
        """Ensure SQLite schema exists."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        claude_session_id TEXT UNIQUE NOT NULL,
                        project_path TEXT,
                        git_branch TEXT,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        created_at TEXT DEFAULT (datetime('now', 'utc'))
                    )
                """)
                
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        data TEXT NOT NULL DEFAULT '{}',
                        tool_name TEXT,
                        duration_ms INTEGER,
                        created_at TEXT DEFAULT (datetime('now', 'utc')),
                        FOREIGN KEY (session_id) REFERENCES sessions(id)
                    )
                """)
                
                # Create indexes
                conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)")
                
                logger.debug("SQLite schema initialized")
        except Exception as e:
            logger.error(f"Failed to initialize SQLite schema: {e}")
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data to database."""
        if self.use_supabase:
            return self._save_session_supabase(session_data)
        else:
            return self._save_session_sqlite(session_data)
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to database."""
        if self.use_supabase:
            return self._save_event_supabase(event_data)
        else:
            return self._save_event_sqlite(event_data)
    
    def _save_session_supabase(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session to Supabase."""
        try:
            # Transform data for Supabase
            data = session_data.copy()
            
            # Ensure timestamps are properly formatted
            for field in ['start_time', 'end_time', 'created_at']:
                if field in data and data[field] and not data[field].endswith('Z'):
                    data[field] = data[field] + 'Z'
            
            result = self.supabase_client.table('chronicle_sessions').upsert(data).execute()
            if result and result.data:
                session_id = data.get('id', str(uuid.uuid4()))
                return (True, session_id)
            
            return (False, None)
            
        except Exception as e:
            logger.error(f"Supabase session save failed: {e}")
            return (False, None)
    
    def _save_session_sqlite(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session to SQLite."""
        try:
            data = session_data.copy()
            claude_session_id = data.get('claude_session_id') or data.get('session_id')
            
            if not claude_session_id:
                logger.error("Missing claude_session_id for session")
                return (False, None)
            
            with sqlite3.connect(self.sqlite_path) as conn:
                # Check if session exists
                cursor = conn.execute(
                    "SELECT id FROM sessions WHERE claude_session_id = ?", 
                    (claude_session_id,)
                )
                existing = cursor.fetchone()
                
                if existing:
                    session_uuid = existing[0]
                    conn.execute("""
                        UPDATE sessions SET 
                            project_path = ?, git_branch = ?, start_time = ?, end_time = ?
                        WHERE id = ?
                    """, (
                        data.get('project_path'),
                        data.get('git_branch'),
                        data.get('start_time', datetime.utcnow().isoformat()),
                        data.get('end_time'),
                        session_uuid
                    ))
                else:
                    session_uuid = data.get('id') or str(uuid.uuid4())
                    conn.execute("""
                        INSERT INTO sessions 
                        (id, claude_session_id, project_path, git_branch, start_time, end_time)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        session_uuid,
                        claude_session_id,
                        data.get('project_path'),
                        data.get('git_branch'),
                        data.get('start_time', datetime.utcnow().isoformat()),
                        data.get('end_time')
                    ))
                
                return (True, session_uuid)
                
        except Exception as e:
            logger.error(f"SQLite session save failed: {e}")
            return (False, None)
    
    def _save_event_supabase(self, event_data: Dict[str, Any]) -> bool:
        """Save event to Supabase."""
        try:
            data = event_data.copy()
            
            # Add event ID if not provided
            if 'event_id' not in data:
                data['event_id'] = str(uuid.uuid4())
            
            # Add timestamp if not provided
            if 'timestamp' not in data:
                data['timestamp'] = datetime.utcnow().isoformat() + 'Z'
            
            # Ensure data field is properly formatted
            if 'data' in data and isinstance(data['data'], str):
                try:
                    data['data'] = json.loads(data['data'])
                except json.JSONDecodeError:
                    data['data'] = {"raw": data['data']}
            elif 'data' not in data:
                data['data'] = {}
            
            result = self.supabase_client.table('chronicle_events').insert(data).execute()
            return bool(result and result.data)
            
        except Exception as e:
            logger.error(f"Supabase event save failed: {e}")
            return False
    
    def _save_event_sqlite(self, event_data: Dict[str, Any]) -> bool:
        """Save event to SQLite."""
        try:
            data = event_data.copy()
            if 'id' not in data:
                data['id'] = str(uuid.uuid4())
            
            # Convert data dict to JSON string
            json_data = json.dumps(data.get('data', {})) if isinstance(data.get('data'), dict) else data.get('data', '{}')
            
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute("""
                    INSERT INTO events 
                    (id, session_id, event_type, timestamp, data, tool_name, duration_ms)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    data['id'],
                    data['session_id'],
                    data.get('event_type'),
                    data.get('timestamp', datetime.utcnow().isoformat()),
                    json_data,
                    data.get('tool_name'),
                    data.get('duration_ms')
                ))
            
            return True
            
        except Exception as e:
            logger.error(f"SQLite event save failed: {e}")
            return False
    
    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            if self.use_supabase:
                result = self.supabase_client.from_('chronicle_sessions').select('id').limit(1).execute()
                return bool(result)
            else:
                with sqlite3.connect(self.sqlite_path) as conn:
                    conn.execute("SELECT 1")
                return True
        except Exception:
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get database status."""
        return {
            "type": "supabase" if self.use_supabase else "sqlite",
            "path": self.sqlite_path if not self.use_supabase else None,
            "connected": self.test_connection()
        }


# Simple validation functions
def validate_json_data(data: Any) -> bool:
    """Basic JSON validation."""
    try:
        json.dumps(data, default=str)
        return True
    except (TypeError, ValueError):
        return False


def sanitize_input_data(data: Any) -> Any:
    """Basic input sanitization."""
    if data is None:
        return None
    
    # Convert to string and back for basic sanitization
    try:
        if isinstance(data, dict):
            # Remove any keys starting with underscore (private)
            return {k: v for k, v in data.items() if not str(k).startswith('_')}
        elif isinstance(data, str):
            # Basic string sanitization
            return data[:10000]  # Limit length
        else:
            return data
    except Exception:
        return str(data)[:1000]  # Safe fallback


# Factory function for easy use
def create_database() -> ConsolidatedDatabase:
    """Create and return a database instance."""
    return ConsolidatedDatabase()