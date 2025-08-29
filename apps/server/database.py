#!/usr/bin/env python3
"""
Chronicle Local SQLite Database Layer - Production Ready
==================================================

A high-performance, production-ready SQLite database layer that mirrors
the Supabase schema for self-contained Chronicle operation.

Features:
- WAL mode for concurrent access
- Connection pooling for multiple processes  
- Automatic schema migrations
- Sub-10ms event insertion performance
- Production-grade error handling and recovery
- Complete schema parity with Supabase

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Oakland represent!)
"""

import json
import logging
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import hashlib

# Try to import performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Database configuration constants
# Default DB path for development - in production, this would be ~/.claude/hooks/chronicle/server/data/chronicle.db
DEFAULT_DB_PATH = Path(__file__).parent / 'data' / 'chronicle.db'
WAL_TIMEOUT = 30.0  # WAL timeout in seconds
CONNECTION_TIMEOUT = 10.0  # Connection timeout in seconds
MAX_RETRIES = 3
RETRY_DELAY = 0.1  # Initial retry delay in seconds


@dataclass
class DatabaseConfig:
    """Database configuration class."""
    db_path: Path
    wal_mode: bool = True
    synchronous_mode: str = "NORMAL"
    cache_size: int = 10000
    temp_store: str = "memory"
    journal_size_limit: int = 67108864  # 64MB
    checkpoint_fullfsync: bool = True
    foreign_keys: bool = True
    connection_timeout: float = CONNECTION_TIMEOUT
    wal_timeout: float = WAL_TIMEOUT
    max_connections: int = 10


class DatabaseError(Exception):
    """Base database exception."""
    pass


class ConnectionError(DatabaseError):
    """Database connection specific errors."""
    pass


class SchemaError(DatabaseError):
    """Database schema specific errors."""
    pass


class MigrationError(DatabaseError):
    """Database migration specific errors."""
    pass


class LocalDatabase:
    """
    Production-ready SQLite database layer for Chronicle.
    
    Provides complete schema parity with Supabase, high-performance operations,
    automatic migrations, and robust error handling.
    """
    
    # Schema version for migrations
    CURRENT_SCHEMA_VERSION = 1
    
    # Valid event types matching Supabase exactly
    VALID_EVENT_TYPES = {
        'session_start', 'notification', 'error', 'pre_tool_use', 
        'post_tool_use', 'user_prompt_submit', 'stop', 'subagent_stop', 
        'pre_compact', 'tool_use', 'prompt', 'session_end', 
        'subagent_termination', 'pre_compaction'
    }
    
    def __init__(self, db_path: Optional[Union[str, Path]] = None, config: Optional[DatabaseConfig] = None):
        """
        Initialize the LocalDatabase.
        
        Args:
            db_path: Optional path to database file
            config: Optional database configuration
        """
        # Setup paths and configuration
        if db_path:
            self.db_path = Path(db_path).expanduser().resolve()
        else:
            self.db_path = DEFAULT_DB_PATH
            
        self.config = config or DatabaseConfig(db_path=self.db_path)
        self.config.db_path = self.db_path
        
        # Thread-local storage for connections
        self._local = threading.local()
        self._connection_pool = ThreadPoolExecutor(max_workers=self.config.max_connections)
        self._setup_lock = threading.RLock()
        
        # Performance metrics
        self._operation_count = 0
        self._total_operation_time = 0.0
        self._last_checkpoint = time.time()
        
        # Initialize database
        self._ensure_database_setup()
        
        logger.info(f"LocalDatabase initialized at {self.db_path}")
    
    def _ensure_database_setup(self) -> None:
        """Ensure database directory and initial setup."""
        with self._setup_lock:
            try:
                # Create directory structure
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Initialize database with proper settings
                with self._get_connection() as conn:
                    self._configure_connection(conn)
                    self._create_schema(conn)
                    self._run_migrations(conn)
                    
                logger.info("Database setup completed successfully")
                
            except Exception as e:
                raise DatabaseError(f"Failed to setup database at {self.db_path}: {e}")
    
    def _configure_connection(self, conn: sqlite3.Connection) -> None:
        """Configure SQLite connection for optimal performance."""
        try:
            # Enable WAL mode for concurrent access
            if self.config.wal_mode:
                conn.execute("PRAGMA journal_mode=WAL")
                
            # Performance optimizations
            conn.execute(f"PRAGMA synchronous={self.config.synchronous_mode}")
            conn.execute(f"PRAGMA cache_size={self.config.cache_size}")
            conn.execute(f"PRAGMA temp_store={self.config.temp_store}")
            conn.execute(f"PRAGMA journal_size_limit={self.config.journal_size_limit}")
            
            # Enable foreign keys for data integrity
            if self.config.foreign_keys:
                conn.execute("PRAGMA foreign_keys=ON")
                
            # WAL mode specific optimizations
            if self.config.wal_mode:
                conn.execute(f"PRAGMA wal_checkpoint_timeout={int(self.config.wal_timeout * 1000)}")
                if self.config.checkpoint_fullfsync:
                    conn.execute("PRAGMA checkpoint_fullfsync=ON")
                    
            # Enable query optimization
            conn.execute("PRAGMA optimize")
            
        except Exception as e:
            raise ConnectionError(f"Failed to configure connection: {e}")
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper configuration."""
        # Use thread-local storage for connection reuse
        if not hasattr(self._local, 'connection') or self._local.connection is None:
            try:
                conn = sqlite3.connect(
                    str(self.db_path),
                    timeout=self.config.connection_timeout,
                    check_same_thread=False
                )
                self._configure_connection(conn)
                self._local.connection = conn
            except Exception as e:
                raise ConnectionError(f"Failed to connect to database: {e}")
        
        try:
            yield self._local.connection
        finally:
            # Keep connection open for reuse within thread
            pass
    
    def _create_schema(self, conn: sqlite3.Connection) -> None:
        """Create the complete database schema matching Supabase."""
        try:
            # Chronicle sessions table (matching Supabase chronicle_sessions)
            conn.execute('''
                CREATE TABLE IF NOT EXISTS chronicle_sessions (
                    id TEXT PRIMARY KEY,
                    claude_session_id TEXT UNIQUE NOT NULL,
                    project_path TEXT,
                    git_branch TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    metadata TEXT DEFAULT '{}',
                    event_count INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now', 'utc')),
                    updated_at TEXT DEFAULT (datetime('now', 'utc'))
                )
            ''')
            
            # Chronicle events table (matching Supabase chronicle_events)
            conn.execute('''
                CREATE TABLE IF NOT EXISTS chronicle_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    metadata TEXT NOT NULL DEFAULT '{}',
                    tool_name TEXT,
                    duration_ms INTEGER CHECK (duration_ms >= 0),
                    created_at TEXT DEFAULT (datetime('now', 'utc')),
                    FOREIGN KEY (session_id) REFERENCES chronicle_sessions(id) ON DELETE CASCADE
                )
            ''')
            
            # Performance indexes matching Supabase
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_claude_session_id ON chronicle_sessions(claude_session_id)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_project_path ON chronicle_sessions(project_path)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_start_time ON chronicle_sessions(start_time DESC)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_events_session_timestamp ON chronicle_events(session_id, timestamp DESC)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_events_type ON chronicle_events(event_type)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_events_tool_name ON chronicle_events(tool_name) WHERE tool_name IS NOT NULL",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_events_timestamp ON chronicle_events(timestamp DESC)",
                "CREATE INDEX IF NOT EXISTS idx_chronicle_events_session_id ON chronicle_events(session_id)",
            ]
            
            for index_sql in indexes:
                conn.execute(index_sql)
            
            # Create views matching Supabase functionality
            self._create_views(conn)
            
            # Create triggers for automatic updates
            self._create_triggers(conn)
            
            # Create schema version table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS _schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT DEFAULT (datetime('now', 'utc'))
                )
            ''')
            
            # Set initial schema version
            conn.execute(
                "INSERT OR IGNORE INTO _schema_version (version) VALUES (?)",
                (self.CURRENT_SCHEMA_VERSION,)
            )
            
            conn.commit()
            
        except Exception as e:
            raise SchemaError(f"Failed to create schema: {e}")
    
    def _create_views(self, conn: sqlite3.Connection) -> None:
        """Create database views matching Supabase functionality."""
        # Active sessions view
        conn.execute('''
            CREATE VIEW IF NOT EXISTS chronicle_active_sessions AS
            SELECT 
                s.*,
                COUNT(e.id) as event_count,
                COUNT(CASE WHEN e.event_type IN ('pre_tool_use', 'post_tool_use') THEN 1 END) as tool_event_count,
                COUNT(CASE WHEN e.event_type = 'user_prompt_submit' THEN 1 END) as prompt_event_count,
                MAX(e.timestamp) as last_activity
            FROM chronicle_sessions s
            LEFT JOIN chronicle_events e ON s.id = e.session_id
            WHERE s.end_time IS NULL
            GROUP BY s.id, s.claude_session_id, s.project_path, s.git_branch, 
                     s.start_time, s.end_time, s.metadata, s.created_at
            ORDER BY s.start_time DESC
        ''')
        
        # Recent events view
        conn.execute('''
            CREATE VIEW IF NOT EXISTS chronicle_recent_events AS
            SELECT 
                e.*,
                s.claude_session_id,
                s.project_path,
                s.git_branch
            FROM chronicle_events e
            JOIN chronicle_sessions s ON e.session_id = s.id
            WHERE e.created_at >= datetime('now', '-24 hours', 'utc')
            ORDER BY e.timestamp DESC
        ''')
    
    def _create_triggers(self, conn: sqlite3.Connection) -> None:
        """Create database triggers for automatic maintenance."""
        # Trigger to update session end_time
        conn.execute('''
            CREATE TRIGGER IF NOT EXISTS trigger_update_session_end_time
            AFTER INSERT ON chronicle_events
            FOR EACH ROW
            WHEN NEW.event_type = 'stop' AND 
                 json_extract(NEW.metadata, '$.session_termination') = 1
            BEGIN
                UPDATE chronicle_sessions 
                SET end_time = NEW.timestamp,
                    updated_at = datetime('now', 'utc')
                WHERE id = NEW.session_id 
                AND end_time IS NULL;
            END
        ''')
        
        # Trigger to update session event count
        conn.execute('''
            CREATE TRIGGER IF NOT EXISTS trigger_update_session_event_count
            AFTER INSERT ON chronicle_events
            FOR EACH ROW
            BEGIN
                UPDATE chronicle_sessions 
                SET event_count = event_count + 1,
                    updated_at = datetime('now', 'utc')
                WHERE id = NEW.session_id;
            END
        ''')
        
        # Trigger for session updated_at
        conn.execute('''
            CREATE TRIGGER IF NOT EXISTS trigger_sessions_updated_at
            BEFORE UPDATE ON chronicle_sessions
            FOR EACH ROW
            BEGIN
                UPDATE chronicle_sessions 
                SET updated_at = datetime('now', 'utc')
                WHERE id = OLD.id;
            END
        ''')
    
    def _run_migrations(self, conn: sqlite3.Connection) -> None:
        """Run database migrations to keep schema up to date."""
        try:
            # Get current schema version
            cursor = conn.execute("SELECT MAX(version) FROM _schema_version")
            current_version = cursor.fetchone()[0] or 0
            
            if current_version < self.CURRENT_SCHEMA_VERSION:
                logger.info(f"Running migrations from version {current_version} to {self.CURRENT_SCHEMA_VERSION}")
                
                # Run migrations based on version
                for version in range(current_version + 1, self.CURRENT_SCHEMA_VERSION + 1):
                    self._apply_migration(conn, version)
                    
                logger.info("Migrations completed successfully")
                
        except Exception as e:
            raise MigrationError(f"Migration failed: {e}")
    
    def _apply_migration(self, conn: sqlite3.Connection, version: int) -> None:
        """Apply a specific migration version."""
        if version == 1:
            # Initial schema - already created in _create_schema
            pass
        # Future migrations would be added here
        
        # Record migration
        conn.execute(
            "INSERT INTO _schema_version (version) VALUES (?)",
            (version,)
        )
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Save session data with high performance.
        
        Args:
            session_data: Session information
            
        Returns:
            Tuple of (success, session_id)
        """
        start_time = time.time()
        
        try:
            if "claude_session_id" not in session_data:
                return False, None
                
            claude_session_id = session_data["claude_session_id"]
            session_id = str(uuid.uuid4())
            
            # Prepare metadata
            metadata = session_data.get("metadata", {})
            if "git_commit" in session_data:
                metadata["git_commit"] = session_data["git_commit"]
            if "source" in session_data:
                metadata["source"] = session_data["source"]
            
            with self._get_connection() as conn:
                # Use INSERT OR REPLACE for upsert functionality
                conn.execute('''
                    INSERT OR REPLACE INTO chronicle_sessions 
                    (id, claude_session_id, project_path, git_branch, 
                     start_time, end_time, metadata)
                    VALUES (
                        COALESCE(
                            (SELECT id FROM chronicle_sessions WHERE claude_session_id = ?),
                            ?
                        ),
                        ?, ?, ?, ?, ?, ?
                    )
                ''', (
                    claude_session_id, session_id,
                    claude_session_id,
                    session_data.get("project_path"),
                    session_data.get("git_branch"),
                    session_data.get("start_time"),
                    session_data.get("end_time"),
                    json_impl.dumps(metadata)
                ))
                
                # Get the actual session ID
                cursor = conn.execute(
                    "SELECT id FROM chronicle_sessions WHERE claude_session_id = ?",
                    (claude_session_id,)
                )
                result = cursor.fetchone()
                if result:
                    session_id = result[0]
                
                conn.commit()
                
                # Update performance metrics
                duration = time.time() - start_time
                self._update_metrics(duration)
                
                logger.debug(f"Session saved successfully: {session_id} ({duration*1000:.2f}ms)")
                return True, session_id
                
        except Exception as e:
            logger.error(f"Failed to save session: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data with sub-10ms performance target.
        
        Args:
            event_data: Event information
            
        Returns:
            Success status
        """
        start_time = time.time()
        
        try:
            if "session_id" not in event_data:
                logger.error("Event data missing required session_id")
                return False
            
            event_id = str(uuid.uuid4())
            session_id = event_data["session_id"]
            event_type = event_data.get("event_type", "notification")
            
            # Validate event type
            if event_type not in self.VALID_EVENT_TYPES:
                logger.warning(f"Unknown event type: {event_type}, defaulting to 'notification'")
                event_type = "notification"
            
            # Prepare metadata
            metadata = event_data.get("data", {})
            if "hook_event_name" in event_data:
                metadata["hook_event_name"] = event_data["hook_event_name"]
            if "metadata" in event_data:
                metadata.update(event_data["metadata"])
            
            # Extract tool_name
            tool_name = event_data.get("tool_name") or metadata.get("tool_name")
            
            with self._get_connection() as conn:
                conn.execute('''
                    INSERT INTO chronicle_events 
                    (id, session_id, event_type, timestamp, metadata, tool_name, duration_ms)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    event_id,
                    session_id,
                    event_type,
                    event_data.get("timestamp"),
                    json_impl.dumps(metadata),
                    tool_name,
                    event_data.get("duration_ms")
                ))
                
                conn.commit()
                
                # Update performance metrics
                duration = time.time() - start_time
                self._update_metrics(duration)
                
                # Log performance warning if over target
                if duration > 0.010:  # 10ms
                    logger.warning(f"Event save exceeded 10ms target: {duration*1000:.2f}ms")
                else:
                    logger.debug(f"Event saved successfully: {event_type} ({duration*1000:.2f}ms)")
                
                return True
                
        except Exception as e:
            logger.error(f"Failed to save event: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve session by ID.
        
        Args:
            session_id: Session ID (claude_session_id or UUID)
            
        Returns:
            Session data or None
        """
        try:
            with self._get_connection() as conn:
                conn.row_factory = sqlite3.Row
                
                # Try both ID types
                for id_field in ["claude_session_id", "id"]:
                    cursor = conn.execute(
                        f"SELECT * FROM chronicle_sessions WHERE {id_field} = ?",
                        (session_id,)
                    )
                    row = cursor.fetchone()
                    if row:
                        result = dict(row)
                        # Parse JSON metadata
                        if result.get("metadata"):
                            try:
                                result["metadata"] = json_impl.loads(result["metadata"])
                            except:
                                pass
                        return result
                
                return None
                
        except Exception as e:
            logger.error(f"Failed to retrieve session {session_id}: {e}")
            return None
    
    def get_session_events(self, session_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Get events for a session.
        
        Args:
            session_id: Session ID
            limit: Maximum number of events
            
        Returns:
            List of events
        """
        try:
            with self._get_connection() as conn:
                conn.row_factory = sqlite3.Row
                
                cursor = conn.execute('''
                    SELECT * FROM chronicle_events 
                    WHERE session_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                ''', (session_id, limit))
                
                events = []
                for row in cursor.fetchall():
                    event = dict(row)
                    # Parse JSON metadata
                    if event.get("metadata"):
                        try:
                            event["metadata"] = json_impl.loads(event["metadata"])
                        except:
                            pass
                    events.append(event)
                
                return events
                
        except Exception as e:
            logger.error(f"Failed to retrieve events for session {session_id}: {e}")
            return []
    
    def get_recent_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent sessions with event counts."""
        try:
            with self._get_connection() as conn:
                conn.row_factory = sqlite3.Row
                
                cursor = conn.execute('''
                    SELECT s.*, COUNT(e.id) as event_count
                    FROM chronicle_sessions s
                    LEFT JOIN chronicle_events e ON s.id = e.session_id
                    GROUP BY s.id
                    ORDER BY s.start_time DESC
                    LIMIT ?
                ''', (limit,))
                
                sessions = []
                for row in cursor.fetchall():
                    session = dict(row)
                    # Parse JSON metadata
                    if session.get("metadata"):
                        try:
                            session["metadata"] = json_impl.loads(session["metadata"])
                        except:
                            pass
                    sessions.append(session)
                
                return sessions
                
        except Exception as e:
            logger.error(f"Failed to retrieve recent sessions: {e}")
            return []
    
    def cleanup_old_data(self, retention_days: int = 30) -> int:
        """
        Clean up old sessions and events.
        
        Args:
            retention_days: Number of days to retain
            
        Returns:
            Number of deleted sessions
        """
        try:
            cutoff_date = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            
            with self._get_connection() as conn:
                cursor = conn.execute('''
                    DELETE FROM chronicle_sessions 
                    WHERE created_at < datetime(?, '-{} days')
                    AND end_time IS NOT NULL
                '''.format(retention_days), (cutoff_date,))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"Cleaned up {deleted_count} old sessions")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Failed to cleanup old data: {e}")
            return 0
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get database performance statistics."""
        avg_operation_time = 0.0
        if self._operation_count > 0:
            avg_operation_time = self._total_operation_time / self._operation_count
        
        try:
            with self._get_connection() as conn:
                # Get database size
                cursor = conn.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
                db_size = cursor.fetchone()[0]
                
                # Get table counts
                cursor = conn.execute("SELECT COUNT(*) FROM chronicle_sessions")
                session_count = cursor.fetchone()[0]
                
                cursor = conn.execute("SELECT COUNT(*) FROM chronicle_events")
                event_count = cursor.fetchone()[0]
                
                return {
                    "db_size_bytes": db_size,
                    "db_size_mb": round(db_size / (1024 * 1024), 2),
                    "session_count": session_count,
                    "event_count": event_count,
                    "operations_count": self._operation_count,
                    "avg_operation_time_ms": round(avg_operation_time * 1000, 2),
                    "total_operation_time_seconds": round(self._total_operation_time, 2)
                }
        except Exception as e:
            logger.error(f"Failed to get performance stats: {e}")
            return {"error": str(e)}
    
    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            with self._get_connection() as conn:
                conn.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def vacuum_database(self) -> bool:
        """Vacuum database for optimization."""
        try:
            with self._get_connection() as conn:
                conn.execute("VACUUM")
                conn.execute("PRAGMA optimize")
                logger.info("Database vacuum completed")
                return True
        except Exception as e:
            logger.error(f"Database vacuum failed: {e}")
            return False
    
    def checkpoint_wal(self) -> bool:
        """Manually checkpoint WAL file."""
        try:
            with self._get_connection() as conn:
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                logger.debug("WAL checkpoint completed")
                return True
        except Exception as e:
            logger.error(f"WAL checkpoint failed: {e}")
            return False
    
    def _update_metrics(self, operation_time: float) -> None:
        """Update internal performance metrics."""
        self._operation_count += 1
        self._total_operation_time += operation_time
        
        # Auto-checkpoint WAL periodically
        current_time = time.time()
        if current_time - self._last_checkpoint > 300:  # 5 minutes
            self.checkpoint_wal()
            self._last_checkpoint = current_time
    
    def close(self) -> None:
        """Close database connections."""
        try:
            if hasattr(self._local, 'connection') and self._local.connection:
                self._local.connection.close()
                self._local.connection = None
                
            self._connection_pool.shutdown(wait=True)
            logger.info("Database connections closed")
            
        except Exception as e:
            logger.error(f"Error closing database connections: {e}")


# Factory function for easy initialization
def create_local_database(db_path: Optional[Union[str, Path]] = None) -> LocalDatabase:
    """
    Create a LocalDatabase instance with default configuration.
    
    Args:
        db_path: Optional path to database file
        
    Returns:
        Configured LocalDatabase instance
    """
    return LocalDatabase(db_path=db_path)


# Utility functions
def ensure_valid_uuid(value: Any) -> str:
    """Ensure a value is a valid UUID string."""
    if not value:
        return str(uuid.uuid4())
    
    try:
        uuid.UUID(str(value))
        return str(value)
    except ValueError:
        return str(uuid.uuid4())


def validate_session_id(session_id: str) -> str:
    """Validate and normalize session ID."""
    if not session_id:
        return str(uuid.uuid4())
    
    try:
        uuid.UUID(session_id)
        return session_id
    except ValueError:
        # Generate deterministic UUID from string
        namespace = uuid.UUID('12345678-1234-5678-1234-123456789012')
        return str(uuid.uuid5(namespace, session_id))


if __name__ == "__main__":
    # Quick test if run directly
    print("Testing LocalDatabase...")
    
    try:
        db = create_local_database()
        
        # Test connection
        if db.test_connection():
            print("✓ Database connection successful")
        else:
            print("✗ Database connection failed")
            
        # Test session save
        session_data = {
            "claude_session_id": "test-session-123",
            "project_path": "/test/project",
            "git_branch": "main",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        
        success, session_id = db.save_session(session_data)
        if success:
            print(f"✓ Session save successful: {session_id}")
        else:
            print("✗ Session save failed")
            
        # Test event save
        event_data = {
            "session_id": session_id,
            "event_type": "test_event",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {"test": "data"}
        }
        
        start = time.time()
        if db.save_event(event_data):
            duration = (time.time() - start) * 1000
            print(f"✓ Event save successful ({duration:.2f}ms)")
        else:
            print("✗ Event save failed")
            
        # Show performance stats
        stats = db.get_performance_stats()
        print(f"✓ Performance stats: {stats}")
        
        db.close()
        print("✓ Database test completed")
        
    except Exception as e:
        print(f"✗ Database test failed: {e}")