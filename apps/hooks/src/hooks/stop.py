#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Claude Code Hook: Session End Tracking (stop.py) - UV Single-File Script

This hook is triggered when Claude Code main agent execution completes.
It captures session end data, calculates duration, and stores final metrics.

Features:
- Updates existing session record with end_time
- Calculates total session duration from start to end
- Counts total events that occurred during session
- Stores session_end event with comprehensive metrics
"""

import json
import os
import sys
import time
import logging
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

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

# Supabase support
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

class DatabaseError(Exception):
    """Base exception for database operations."""
    pass

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
    
    def find_session(self, claude_session_id: str) -> Optional[Dict[str, Any]]:
        """Find session by Claude session ID."""
        return self.get_session(claude_session_id)
    
    def count_session_events(self, session_id: str) -> int:
        """Count total events for a session."""
        try:
            # Try Supabase first
            if self.supabase_client:
                try:
                    result = self.supabase_client.table(self.EVENTS_TABLE).select("id", count="exact").eq("session_id", session_id).execute()
                    return result.count or 0
                except Exception:
                    pass
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM events WHERE session_id = ?",
                    (session_id,)
                )
                row = cursor.fetchone()
                return row[0] if row else 0
            
        except Exception:
            return 0
    
    def update_session_end(self, session_id: str, end_time: str, event_count: int) -> bool:
        """Update session with end time and metrics."""
        try:
            # Try Supabase first
            if self.supabase_client:
                try:
                    update_data = {
                        "end_time": end_time,
                        "updated_at": datetime.now().isoformat()
                    }
                    
                    self.supabase_client.table(self.SESSIONS_TABLE).update(update_data).eq("id", session_id).execute()
                    return True
                    
                except Exception:
                    pass
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.execute('''
                    UPDATE sessions 
                    SET end_time = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (end_time, session_id))
                conn.commit()
                return conn.total_changes > 0
            
        except Exception:
            return False

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging with file output
# Set up chronicle-specific logging
chronicle_log_dir = Path.home() / ".claude" / "hooks" / "chronicle" / "logs"
chronicle_log_dir.mkdir(parents=True, exist_ok=True)
chronicle_log_file = chronicle_log_dir / "chronicle.log"

# Configure logger
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(chronicle_log_file),
        logging.StreamHandler()  # Also log to stderr for UV scripts
    ]
)
logger = logging.getLogger(__name__)

# ===========================================
# Database Manager
# ===========================================

class StopHook:
    """Hook for tracking session end and calculating final session metrics."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "session_id" in input_data:
            return input_data["session_id"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process session stop hook."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            logger.info(f"Attempting to terminate session: {self.claude_session_id}")
            
            if not self.claude_session_id:
                logger.warning("No Claude session ID found for termination")
                return self._create_response(
                    session_found=False,
                    error="No session ID available"
                )
            
            # Find existing session
            logger.info(f"Looking up session in database: {self.claude_session_id}")
            session = self.db_manager.find_session(self.claude_session_id)
            
            if not session:
                logger.warning(f"Session not found in database: {self.claude_session_id}")
                return self._create_response(
                    session_found=False,
                    error="Session not found in database"
                )
            
            session_id = session["id"]
            logger.info(f"Found session record with ID: {session_id}")
            
            # Count events in this session
            event_count = self.db_manager.count_session_events(session_id)
            logger.info(f"Total events in session: {event_count}")
            
            # Update session with end time and metrics
            end_time = datetime.now().isoformat()
            logger.info(f"Setting session end time: {end_time}")
            session_updated = self.db_manager.update_session_end(
                session_id, end_time, event_count
            )
            logger.info(f"Session update result: {session_updated}")
            
            # Calculate session metrics
            duration_minutes = None
            if session["start_time"]:
                try:
                    start_time = datetime.fromisoformat(session["start_time"].replace('Z', '+00:00'))
                    end_time_dt = datetime.fromisoformat(end_time)
                    duration_minutes = (end_time_dt - start_time).total_seconds() / 60
                    logger.info(f"Session duration calculated: {duration_minutes:.2f} minutes")
                except Exception as e:
                    logger.warning(f"Could not calculate session duration: {e}")
            
            # Create session end event
            event_data = {
                "event_type": "session_end",
                "hook_event_name": "Stop",
                "session_id": session_id,
                "timestamp": end_time,
                "data": {
                    "session_duration_minutes": duration_minutes,
                    "total_events": event_count,
                    "end_reason": input_data.get("reason", "normal_completion"),
                    "final_metrics": {
                        "start_time": session["start_time"],
                        "end_time": end_time,
                        "event_count": event_count
                    }
                }
            }
            
            # Save session end event
            logger.info("Saving session end event to database...")
            event_saved = self.db_manager.save_event(event_data)
            logger.info(f"Session end event saved: {event_saved}")
            
            return self._create_response(
                session_found=True,
                session_updated=session_updated,
                event_saved=event_saved,
                duration_minutes=duration_minutes,
                event_count=event_count
            )
            
        except Exception as e:
            logger.debug(f"Stop hook error: {e}")
            return self._create_response(
                session_found=False,
                error="Processing failed"
            )
    
    def _create_response(self, session_found: bool = False,
                        session_updated: bool = False,
                        event_saved: bool = False,
                        duration_minutes: Optional[float] = None,
                        event_count: int = 0,
                        error: Optional[str] = None) -> Dict[str, Any]:
        """Create stop hook response as per Claude Code spec."""
        
        # Stop hooks should not return hookSpecificOutput
        # They only support decision and reason fields
        response = {
            "continue": True,
            "suppressOutput": True  # Session end is internal
        }
        
        # Log the internal metrics for debugging
        logger.info(f"Session termination - Found: {session_found}, Updated: {session_updated}, Events: {event_count}")
        if duration_minutes is not None:
            logger.info(f"Session duration: {round(duration_minutes, 2)} minutes")
        if error:
            logger.error(f"Stop hook error: {error}")
        
        return response

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for stop hook."""
    try:
        logger.info("=" * 60)
        logger.info("STOP HOOK STARTED - SESSION TERMINATION")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing StopHook for session termination...")
        
        hook = StopHook()
        logger.info("Processing session stop...")
        result = hook.process_hook(input_data)
        logger.info(f"Session stop processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance and session metrics
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        if result.get("hookSpecificOutput", {}).get("sessionDurationMinutes"):
            duration = result["hookSpecificOutput"]["sessionDurationMinutes"]
            logger.info(f"Session completed - Duration: {duration} minutes")
        
        if result.get("hookSpecificOutput", {}).get("eventCount"):
            events = result["hookSpecificOutput"]["eventCount"]
            logger.info(f"Total events in session: {events}")
        
        logger.info("=" * 60)
        logger.info("STOP HOOK COMPLETED - SESSION TERMINATED")
        logger.info("=" * 60)
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Critical error in stop hook: {e}")
        logger.debug(f"Critical error details: {e}", exc_info=True)
        print(json_impl.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)

if __name__ == "__main__":
    main()