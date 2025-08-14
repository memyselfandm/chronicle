#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
# ]
# ///
"""
Database Manager for Chronicle UV Scripts

Provides unified database interface with Supabase/SQLite fallback,
proper path handling for chronicle installation, and connection management.
"""

import os
import sqlite3
import asyncio
import aiosqlite
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple, Union
from contextlib import contextmanager, asynccontextmanager
from datetime import datetime
import uuid

# Import environment loader
try:
    from env_loader import load_chronicle_env, get_database_config
except ImportError:
    # Fallback if running standalone
    def load_chronicle_env():
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
        return {}
    
    def get_database_config():
        return {
            'supabase_url': os.getenv('SUPABASE_URL'),
            'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
            'sqlite_path': os.getenv('CLAUDE_HOOKS_DB_PATH', '~/.claude/hooks/chronicle/data/chronicle.db'),
            'db_timeout': 30,
            'retry_attempts': 3,
            'retry_delay': 1.0,
        }

# Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class DatabaseManager:
    """
    Unified database interface with Supabase/SQLite fallback.
    Handles proper path resolution for chronicle installation.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize database manager with configuration."""
        # Load environment if not already loaded
        load_chronicle_env()
        
        # Get database configuration
        self.config = config or get_database_config()
        
        # Initialize clients
        self.supabase_client = None
        self.sqlite_path = Path(self.config['sqlite_path']).expanduser().resolve()
        
        # Connection settings
        self.timeout = self.config.get('db_timeout', 30)
        self.retry_attempts = self.config.get('retry_attempts', 3)
        self.retry_delay = self.config.get('retry_delay', 1.0)
        
        # Initialize Supabase if available
        if SUPABASE_AVAILABLE:
            supabase_url = self.config.get('supabase_url')
            supabase_key = self.config.get('supabase_key')
            
            if supabase_url and supabase_key:
                try:
                    self.supabase_client = create_client(supabase_url, supabase_key)
                    logger.info("Supabase client initialized")
                except Exception as e:
                    logger.warning(f"Failed to initialize Supabase: {e}")
        
        # Ensure SQLite database and schema exist
        self._ensure_sqlite_database()
    
    def _ensure_sqlite_database(self):
        """Ensure SQLite database and directory structure exist."""
        try:
            # Create directory structure
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create database and tables
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                self._create_sqlite_schema(conn)
                conn.commit()
                
            logger.info(f"SQLite database ready at: {self.sqlite_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize SQLite database: {e}")
            raise DatabaseError(f"Cannot initialize SQLite at {self.sqlite_path}: {e}")
    
    def _create_sqlite_schema(self, conn: sqlite3.Connection):
        """Create SQLite schema matching Supabase structure."""
        # Enable foreign keys
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
                git_commit TEXT,
                source TEXT,
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
                hook_event_name TEXT,
                timestamp TIMESTAMP,
                data TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
        ''')
        
        # Tool events table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tool_events (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                event_id TEXT,
                tool_name TEXT NOT NULL,
                tool_type TEXT,
                phase TEXT CHECK (phase IN ('pre', 'post')),
                parameters TEXT,
                result TEXT,
                execution_time_ms INTEGER,
                success BOOLEAN,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id),
                FOREIGN KEY(event_id) REFERENCES events(id)
            )
        ''')
        
        # Prompt events table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS prompt_events (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                event_id TEXT,
                prompt_text TEXT,
                prompt_length INTEGER,
                complexity_score REAL,
                intent_classification TEXT,
                context_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id),
                FOREIGN KEY(event_id) REFERENCES events(id)
            )
        ''')
        
        # Create indexes for performance
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_tool_events_session ON tool_events(session_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_prompt_events_session ON prompt_events(session_id)')
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get current database connection status."""
        status = {
            'supabase_available': self.supabase_client is not None,
            'supabase_connected': False,
            'sqlite_path': str(self.sqlite_path),
            'sqlite_exists': self.sqlite_path.exists(),
            'sqlite_size': 0,
        }
        
        # Check Supabase connection
        if self.supabase_client:
            try:
                # Simple health check query
                result = self.supabase_client.table('sessions').select('id').limit(1).execute()
                status['supabase_connected'] = True
            except Exception as e:
                logger.debug(f"Supabase health check failed: {e}")
        
        # Check SQLite size
        if status['sqlite_exists']:
            status['sqlite_size'] = self.sqlite_path.stat().st_size
        
        return status
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Save session data to database.
        
        Args:
            session_data: Session information to save
            
        Returns:
            Tuple of (success, session_uuid)
        """
        try:
            session_uuid = session_data.get("id", str(uuid.uuid4()))
            
            # Ensure required fields
            if "claude_session_id" not in session_data:
                logger.error("Missing required field: claude_session_id")
                return False, None
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    supabase_data = {
                        "id": session_uuid,
                        "claude_session_id": session_data.get("claude_session_id"),
                        "start_time": session_data.get("start_time"),
                        "end_time": session_data.get("end_time"),
                        "project_path": session_data.get("project_path"),
                        "git_branch": session_data.get("git_branch"),
                        "git_commit": session_data.get("git_commit"),
                        "source": session_data.get("source"),
                    }
                    
                    # Use upsert to handle updates
                    self.supabase_client.table("sessions").upsert(supabase_data).execute()
                    logger.debug(f"Session saved to Supabase: {session_uuid}")
                    return True, session_uuid
                    
                except Exception as e:
                    logger.warning(f"Supabase save failed, falling back to SQLite: {e}")
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO sessions 
                    (id, claude_session_id, start_time, end_time, project_path, 
                     git_branch, git_commit, source, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (
                    session_uuid,
                    session_data.get("claude_session_id"),
                    session_data.get("start_time"),
                    session_data.get("end_time"),
                    session_data.get("project_path"),
                    session_data.get("git_branch"),
                    session_data.get("git_commit"),
                    session_data.get("source"),
                ))
                conn.commit()
            
            logger.debug(f"Session saved to SQLite: {session_uuid}")
            return True, session_uuid
            
        except Exception as e:
            logger.error(f"Failed to save session: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to database.
        
        Args:
            event_data: Event information to save
            
        Returns:
            Success status
        """
        try:
            event_id = event_data.get("id", str(uuid.uuid4()))
            
            # Ensure required fields
            if "session_id" not in event_data:
                logger.error("Missing required field: session_id")
                return False
            
            # Try Supabase first
            if self.supabase_client:
                try:
                    supabase_data = {
                        "id": event_id,
                        "session_id": event_data.get("session_id"),
                        "event_type": event_data.get("event_type"),
                        "hook_event_name": event_data.get("hook_event_name"),
                        "timestamp": event_data.get("timestamp"),
                        "data": event_data.get("data", {}),
                        "metadata": event_data.get("metadata", {}),
                    }
                    
                    self.supabase_client.table("events").insert(supabase_data).execute()
                    logger.debug(f"Event saved to Supabase: {event_id}")
                    return True
                    
                except Exception as e:
                    logger.warning(f"Supabase event save failed, falling back to SQLite: {e}")
            
            # SQLite fallback
            with sqlite3.connect(str(self.sqlite_path), timeout=self.timeout) as conn:
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, hook_event_name, timestamp, data, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    event_id,
                    event_data.get("session_id"),
                    event_data.get("event_type"),
                    event_data.get("hook_event_name"),
                    event_data.get("timestamp"),
                    json.dumps(event_data.get("data", {})),
                    json.dumps(event_data.get("metadata", {})),
                ))
                conn.commit()
            
            logger.debug(f"Event saved to SQLite: {event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save event: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session by ID from database."""
        try:
            # Try Supabase first
            if self.supabase_client:
                try:
                    result = self.supabase_client.table("sessions").select("*").eq("claude_session_id", session_id).execute()
                    if result.data:
                        return result.data[0]
                except Exception as e:
                    logger.warning(f"Supabase query failed: {e}")
            
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
            
        except Exception as e:
            logger.error(f"Failed to get session: {e}")
            return None
    
    def cleanup_old_data(self, days: int = 90) -> bool:
        """Clean up data older than specified days."""
        try:
            cutoff_date = datetime.now().isoformat()
            # Implementation depends on your retention policy
            logger.info(f"Cleanup not implemented yet - would remove data older than {days} days")
            return True
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
            return False


def test_database_connectivity():
    """Test database connectivity and operations."""
    print("Testing Chronicle Database Connectivity")
    print("-" * 50)
    
    # Initialize database manager
    db = DatabaseManager()
    
    # Check status
    status = db.get_connection_status()
    print("\nConnection Status:")
    for key, value in status.items():
        print(f"  {key}: {value}")
    
    # Test session save
    test_session = {
        "claude_session_id": f"test_{uuid.uuid4()}",
        "start_time": datetime.now().isoformat(),
        "project_path": os.getcwd(),
        "source": "test",
    }
    
    success, session_id = db.save_session(test_session)
    print(f"\nSession save test: {'PASSED' if success else 'FAILED'}")
    if success:
        print(f"  Session ID: {session_id}")
    
    # Test event save
    if success and session_id:
        test_event = {
            "session_id": session_id,
            "event_type": "test_event",
            "hook_event_name": "TestEvent",
            "timestamp": datetime.now().isoformat(),
            "data": {"test": "data"},
        }
        
        event_success = db.save_event(test_event)
        print(f"\nEvent save test: {'PASSED' if event_success else 'FAILED'}")
    
    # Test retrieval
    if success:
        retrieved = db.get_session(test_session["claude_session_id"])
        print(f"\nSession retrieval test: {'PASSED' if retrieved else 'FAILED'}")
        if retrieved:
            print(f"  Retrieved session: {retrieved.get('id')}")


if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    test_database_connectivity()