"""Database client wrapper for Claude Code observability hooks.

This module provides a unified database interface with automatic fallback
from Supabase (PostgreSQL) to SQLite when needed.
"""

import logging
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple
import uuid
import json

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, will use system environment variables only
    pass

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

try:
    from .utils import validate_json, format_error_message
except ImportError:
    from utils import validate_json, format_error_message

# Configure logger
logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class ConnectionError(DatabaseError):
    """Database connection error."""
    pass


class ValidationError(DatabaseError):
    """Data validation error."""
    pass


class EnvironmentValidator:
    """Validates required environment variables and configuration."""
    
    @staticmethod
    def validate_supabase_config() -> Tuple[bool, List[str]]:
        """
        Validate Supabase configuration.
        
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        if not SUPABASE_AVAILABLE:
            errors.append("Supabase library not installed. Run: pip install supabase")
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url:
            errors.append("SUPABASE_URL environment variable not set")
        elif not url.startswith(("http://", "https://")):
            errors.append("SUPABASE_URL must be a valid HTTP(S) URL")
        
        if not key:
            errors.append("SUPABASE_ANON_KEY environment variable not set")
        elif len(key) < 32:
            errors.append("SUPABASE_ANON_KEY appears to be invalid (too short)")
        
        return (len(errors) == 0, errors)
    
    @staticmethod
    def validate_sqlite_config() -> Tuple[bool, List[str]]:
        """
        Validate SQLite configuration.
        
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        db_path = os.getenv("CLAUDE_HOOKS_DB_PATH", "~/.claude/hooks_data.db")
        db_path = os.path.expanduser(db_path)
        
        try:
            # Check if parent directory can be created
            parent_dir = Path(db_path).parent
            parent_dir.mkdir(parents=True, exist_ok=True)
            
            # Test write permissions
            test_file = parent_dir / ".write_test"
            test_file.touch()
            test_file.unlink()
        except Exception as e:
            errors.append(f"Cannot write to SQLite directory: {e}")
        
        return (len(errors) == 0, errors)


class SupabaseClient:
    """
    Wrapper for Supabase client with retry logic and error handling.
    """
    
    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        """
        Initialize Supabase client.
        
        Args:
            url: Supabase project URL (defaults to SUPABASE_URL env var)
            key: Supabase anon key (defaults to SUPABASE_ANON_KEY env var)
        
        Raises:
            ConnectionError: If unable to establish connection
        """
        self.supabase_url = url or os.getenv("SUPABASE_URL")
        self.supabase_key = key or os.getenv("SUPABASE_ANON_KEY")
        self._supabase_client: Optional[Client] = None
        
        # Configuration
        self.retry_attempts = int(os.getenv("CLAUDE_HOOKS_DB_RETRY_ATTEMPTS", "3"))
        self.retry_delay = float(os.getenv("CLAUDE_HOOKS_DB_RETRY_DELAY", "1.0"))
        self.timeout = int(os.getenv("CLAUDE_HOOKS_DB_TIMEOUT", "10"))
        
        # Validate configuration
        is_valid, errors = EnvironmentValidator.validate_supabase_config()
        if not is_valid:
            logger.warning(f"Supabase configuration issues: {'; '.join(errors)}")
            return
        
        # Initialize client
        try:
            self._supabase_client = create_client(self.supabase_url, self.supabase_key)
            logger.info("Supabase client initialized successfully")
            
            # Test the connection
            if not self.health_check():
                logger.warning("Supabase health check failed during initialization")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {format_error_message(e, 'init')}")
            self._supabase_client = None
    
    def health_check(self) -> bool:
        """
        Check if the database connection is healthy.
        
        Returns:
            True if connection is healthy, False otherwise
        """
        if not self._supabase_client:
            return False
        
        try:
            # Simple query to check connection using chronicle_ prefixed tables
            result = self._supabase_client.table('chronicle_sessions').select('session_id').limit(1).execute()
            return True
        except Exception as e:
            logger.debug(f"Health check failed: {format_error_message(e, 'health_check')}")
            return False
    
    def upsert_session(self, session_data: Dict[str, Any]) -> bool:
        """
        Create or update a session record.
        
        Args:
            session_data: Session data to upsert
            
        Returns:
            True if successful, False otherwise
        """
        if not self._supabase_client:
            logger.debug("No Supabase client available for session upsert")
            return False
        
        try:
            # Validate data
            if not self._validate_session_data(session_data):
                raise ValidationError("Invalid session data structure")
            
            # Transform data for Supabase
            transformed_data = self._transform_session_data(session_data)
            
            return self._execute_with_retry(
                lambda: self._supabase_client.table('chronicle_sessions').upsert(transformed_data).execute(),
                "upsert_session"
            )
        except Exception as e:
            logger.error(f"Session upsert error: {format_error_message(e, 'upsert_session')}")
            return False
    
    def insert_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Insert an event record.
        
        Args:
            event_data: Event data to insert
            
        Returns:
            True if successful, False otherwise
        """
        if not self._supabase_client:
            logger.debug("No Supabase client available for event insert")
            return False
        
        try:
            # Validate data
            if not self._validate_event_data(event_data):
                raise ValidationError("Invalid event data structure")
            
            # Transform data for Supabase
            transformed_data = self._transform_event_data(event_data)
            
            return self._execute_with_retry(
                lambda: self._supabase_client.table('chronicle_events').insert(transformed_data).execute(),
                "insert_event"
            )
        except Exception as e:
            logger.error(f"Event insert error: {format_error_message(e, 'insert_event')}")
            return False
    
    def _transform_session_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform session data for Supabase storage."""
        # Map session_id to chronicle_sessions.session_id
        transformed = data.copy()
        if 'session_id' in transformed:
            transformed['session_id'] = transformed['session_id']
        
        # Ensure timestamps are properly formatted
        for field in ['start_time', 'end_time', 'created_at']:
            if field in transformed and transformed[field]:
                # Ensure ISO format with timezone
                if not transformed[field].endswith('Z') and '+' not in transformed[field]:
                    transformed[field] = transformed[field] + 'Z'
        
        return transformed
    
    def _transform_event_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform event data for Supabase storage."""
        transformed = data.copy()
        
        # Add event ID if not provided
        if 'event_id' not in transformed:
            transformed['event_id'] = str(uuid.uuid4())
        
        # Add timestamp if not provided
        if 'timestamp' not in transformed:
            transformed['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        
        # Ensure data field is properly formatted
        if 'data' in transformed and isinstance(transformed['data'], dict):
            # Keep as dict for JSONB storage in Postgres
            pass
        elif 'data' in transformed and isinstance(transformed['data'], str):
            try:
                transformed['data'] = json.loads(transformed['data'])
            except json.JSONDecodeError:
                transformed['data'] = {"raw": transformed['data']}
        else:
            transformed['data'] = {}
        
        return transformed
    
    def _validate_session_data(self, data: Dict[str, Any]) -> bool:
        """Validate session data structure."""
        required_fields = ['session_id']
        
        if not isinstance(data, dict):
            logger.error("Session data must be a dictionary")
            return False
        
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"Missing required field in session data: {field}")
                return False
        
        return validate_json(data)
    
    def _validate_event_data(self, data: Dict[str, Any]) -> bool:
        """Validate event data structure."""
        required_fields = ['session_id', 'hook_event_name']
        
        if not isinstance(data, dict):
            logger.error("Event data must be a dictionary")
            return False
        
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"Missing required field in event data: {field}")
                return False
        
        # Validate event type if present
        if 'event_type' in data:
            valid_types = ['prompt', 'tool_use', 'session_start', 'session_end', 'notification', 'error']
            if data['event_type'] not in valid_types:
                logger.error(f"Invalid event type: {data['event_type']}")
                return False
        
        return validate_json(data)
    
    def _execute_with_retry(self, operation, context: str) -> bool:
        """Execute a database operation with retry logic."""
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                result = operation()
                if result and hasattr(result, 'data'):
                    logger.debug(f"Operation {context} succeeded on attempt {attempt + 1}")
                    return True
                else:
                    logger.warning(f"Operation {context} returned no data on attempt {attempt + 1}")
                    
            except Exception as e:
                last_error = e
                logger.debug(f"Operation {context} failed on attempt {attempt + 1}: {format_error_message(e)}")
                
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
        
        logger.error(f"Operation {context} failed after {self.retry_attempts} attempts: {format_error_message(last_error)}")
        return False
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get information about the current connection."""
        return {
            "has_client": self._supabase_client is not None,
            "has_credentials": bool(self.supabase_url and self.supabase_key),
            "url": self.supabase_url,
            "supabase_available": SUPABASE_AVAILABLE,
            "is_healthy": self.health_check() if self._supabase_client else False,
            "retry_config": {
                "attempts": self.retry_attempts,
                "delay": self.retry_delay,
                "timeout": self.timeout
            }
        }


class SQLiteClient:
    """SQLite database client for local fallback storage."""
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize SQLite client.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path or os.path.expanduser(
            os.getenv("CLAUDE_HOOKS_DB_PATH", "~/.claude/hooks_data.db")
        )
        self.timeout = float(os.getenv("CLAUDE_HOOKS_DB_TIMEOUT", "30.0"))
        
        # Ensure database directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize schema on first use
        self._ensure_schema()
        
        logger.info(f"SQLite client initialized at: {self.db_path}")
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper error handling."""
        conn = None
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=self.timeout,
                isolation_level='DEFERRED'
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            yield conn
            conn.commit()
        except sqlite3.Error as e:
            if conn:
                conn.rollback()
            logger.error(f"SQLite error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def _ensure_schema(self):
        """Ensure database schema exists."""
        try:
            schema_file = Path(__file__).parent.parent.parent / "config" / "schema_sqlite.sql"
            
            if schema_file.exists():
                with open(schema_file, 'r') as f:
                    schema_sql = f.read()
                
                with self._get_connection() as conn:
                    conn.executescript(schema_sql)
                    logger.debug("SQLite schema initialized from file")
            else:
                # Use embedded schema as fallback
                self._create_embedded_schema()
        except Exception as e:
            logger.error(f"Failed to ensure SQLite schema: {e}")
            # Continue anyway - operations will fail if schema is missing
    
    def _create_embedded_schema(self):
        """Create schema using embedded SQL."""
        with self._get_connection() as conn:
            # Create sessions table (matching schema.sql format)
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
            
            # Create events table (matching schema.sql format)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL CHECK (event_type IN ('prompt', 'tool_use', 'session_start', 'session_end', 'notification', 'error')),
                    timestamp TEXT NOT NULL,
                    data TEXT NOT NULL DEFAULT '{}',
                    tool_name TEXT,
                    duration_ms INTEGER CHECK (duration_ms >= 0),
                    created_at TEXT DEFAULT (datetime('now', 'utc')),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                )
            """)
            
            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC)")
            
            logger.debug("SQLite schema created from embedded SQL")
    
    def health_check(self) -> bool:
        """Check if the database is accessible."""
        try:
            with self._get_connection() as conn:
                conn.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"SQLite health check failed: {e}")
            return False
    
    def upsert_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Upsert a session record."""
        try:
            with self._get_connection() as conn:
                # Prepare data
                data = session_data.copy()
                
                # For SQLite, we use claude_session_id as the key
                claude_session_id = data.get('claude_session_id') or data.get('session_id')
                if not claude_session_id:
                    logger.error("Missing claude_session_id for session upsert")
                    return (False, None)
                
                # Check if session exists
                cursor = conn.execute(
                    "SELECT id FROM sessions WHERE claude_session_id = ?", 
                    (claude_session_id,)
                )
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing session
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
                    logger.debug(f"Session updated: {claude_session_id} -> {session_uuid}")
                else:
                    # Create new session
                    session_uuid = data.get('id') or str(uuid.uuid4())
                    conn.execute("""
                        INSERT INTO sessions 
                        (id, claude_session_id, project_path, git_branch, start_time, end_time, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        session_uuid,
                        claude_session_id,
                        data.get('project_path'),
                        data.get('git_branch'),
                        data.get('start_time', datetime.utcnow().isoformat()),
                        data.get('end_time'),
                        data.get('created_at', datetime.utcnow().isoformat())
                    ))
                    logger.debug(f"Session created: {claude_session_id} -> {session_uuid}")
                
                return (True, session_uuid)
        except Exception as e:
            logger.error(f"Failed to upsert session: {e}")
            return (False, None)
    
    def insert_event(self, event_data: Dict[str, Any]) -> bool:
        """Insert an event record."""
        try:
            with self._get_connection() as conn:
                # Prepare data
                data = event_data.copy()
                if 'id' not in data:
                    data['id'] = str(uuid.uuid4())
                
                # Convert data dict to JSON string
                json_data = json.dumps(data.get('data', {})) if isinstance(data.get('data'), dict) else data.get('data', '{}')
                
                conn.execute("""
                    INSERT INTO events 
                    (id, session_id, event_type, timestamp, data, tool_name, duration_ms, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    data['id'],
                    data['session_id'],
                    data.get('event_type'),
                    data.get('timestamp', datetime.utcnow().isoformat()),
                    json_data,
                    data.get('tool_name'),
                    data.get('duration_ms'),
                    data.get('created_at', datetime.utcnow().isoformat())
                ))
            
            logger.debug(f"Event inserted: {data.get('hook_event_name')} for session {data['session_id']}")
            return True
        except Exception as e:
            logger.error(f"Failed to insert event: {e}")
            return False
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information."""
        return {
            "database_path": self.db_path,
            "exists": Path(self.db_path).exists(),
            "is_healthy": self.health_check(),
            "timeout": self.timeout
        }


class DatabaseManager:
    """
    High-level database manager that handles both Supabase and SQLite.
    Automatically falls back to SQLite when Supabase is unavailable.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize database manager.
        
        Args:
            config: Configuration dictionary with database settings
        """
        self.config = config or {}
        
        # Initialize clients
        self.supabase_client = SupabaseClient()
        self.sqlite_client = SQLiteClient()
        
        # Determine fallback behavior
        self.fallback_enabled = self.config.get("sqlite", {}).get(
            "fallback_enabled", 
            os.getenv("CLAUDE_HOOKS_SQLITE_FALLBACK", "true").lower() == "true"
        )
        
        # Check which database to use
        self.use_supabase = self.supabase_client.health_check()
        
        if self.use_supabase:
            logger.info("Using Supabase as primary database")
        elif self.fallback_enabled:
            logger.info("Using SQLite as fallback database")
        else:
            logger.warning("No functional database available and fallback disabled")
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Save session data to primary or fallback storage.
        
        Args:
            session_data: Session data to save (must contain claude_session_id)
            
        Returns:
            Tuple of (success: bool, session_uuid: Optional[str])
        """
        # Try Supabase first if available
        if self.use_supabase:
            success, session_uuid = self.supabase_client.upsert_session(session_data)
            if success:
                return (True, session_uuid)
            else:
                logger.warning("Supabase session save failed, trying fallback")
        
        # Fallback to SQLite if enabled
        if self.fallback_enabled:
            return self.sqlite_client.upsert_session(session_data)
        
        logger.error("No database available for session storage")
        return (False, None)
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to primary or fallback storage.
        
        Args:
            event_data: Event data to save
            
        Returns:
            True if successful, False otherwise
        """
        # Try Supabase first if available
        if self.use_supabase:
            if self.supabase_client.insert_event(event_data):
                return True
            else:
                logger.warning("Supabase event save failed, trying fallback")
        
        # Fallback to SQLite if enabled
        if self.fallback_enabled:
            return self.sqlite_client.insert_event(event_data)
        
        logger.error("No database available for event storage")
        return False
    
    def test_connection(self) -> bool:
        """Test database connection functionality."""
        if self.use_supabase:
            return self.supabase_client.health_check()
        elif self.fallback_enabled:
            return self.sqlite_client.health_check()
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all database connections."""
        return {
            "primary_database": "supabase" if self.use_supabase else "sqlite",
            "supabase": self.supabase_client.get_connection_info(),
            "sqlite": self.sqlite_client.get_connection_info(),
            "fallback_enabled": self.fallback_enabled,
            "connection_test_passed": self.test_connection()
        }
    
    def setup_schema(self) -> bool:
        """
        Set up the database schema.
        
        Returns:
            True if schema setup successful, False otherwise
        """
        logger.info("Starting database schema setup")
        
        # For Supabase, provide instructions
        if self.use_supabase:
            logger.info("=" * 60)
            logger.info("SUPABASE SCHEMA SETUP REQUIRED")
            logger.info("=" * 60)
            logger.info("Please manually set up the schema in Supabase:")
            logger.info("1. Open your Supabase dashboard")
            logger.info("2. Go to SQL Editor")
            logger.info("3. Execute the schema from: apps/hooks/config/schema.sql")
            logger.info("=" * 60)
            
            # Still test if tables exist
            if self.supabase_client.health_check():
                logger.info("Supabase tables appear to be set up correctly")
                return True
        
        # For SQLite, we can auto-create
        if self.fallback_enabled:
            logger.info("Setting up SQLite schema...")
            # Schema is auto-created on SQLiteClient init
            if self.sqlite_client.health_check():
                logger.info("SQLite schema setup completed")
                return True
        
        logger.error("Failed to set up database schema")
        return False


def validate_environment() -> Dict[str, Any]:
    """
    Validate all database-related environment variables.
    
    Returns:
        Dictionary with validation results
    """
    results = {
        "supabase": {},
        "sqlite": {},
        "overall_valid": True
    }
    
    # Validate Supabase
    supabase_valid, supabase_errors = EnvironmentValidator.validate_supabase_config()
    results["supabase"]["valid"] = supabase_valid
    results["supabase"]["errors"] = supabase_errors
    results["supabase"]["configured"] = bool(os.getenv("SUPABASE_URL"))
    
    # Validate SQLite
    sqlite_valid, sqlite_errors = EnvironmentValidator.validate_sqlite_config()
    results["sqlite"]["valid"] = sqlite_valid
    results["sqlite"]["errors"] = sqlite_errors
    results["sqlite"]["path"] = os.path.expanduser(
        os.getenv("CLAUDE_HOOKS_DB_PATH", "~/.claude/hooks_data.db")
    )
    
    # Overall validation
    results["overall_valid"] = sqlite_valid  # At minimum, SQLite should work
    results["warnings"] = []
    
    if not supabase_valid and not os.getenv("SUPABASE_URL"):
        results["warnings"].append("Supabase not configured, will use SQLite fallback")
    elif not supabase_valid:
        results["warnings"].append("Supabase configuration has errors, will use SQLite fallback")
    
    return results


# Convenience function for schema setup
def setup_schema_and_verify() -> bool:
    """
    Convenience function to set up schema and verify it works.
    
    Returns:
        bool: True if setup and verification successful
    """
    try:
        print("🚀 Starting Chronicle database setup...")
        
        # First validate environment
        validation = validate_environment()
        
        if validation["warnings"]:
            for warning in validation["warnings"]:
                print(f"⚠️  {warning}")
        
        # Initialize database manager
        dm = DatabaseManager()
        
        # Set up schema
        result = dm.setup_schema()
        
        if result:
            status = dm.get_status()
            print("✅ Schema setup completed successfully!")
            
            # Show what type of database was set up
            print(f"📊 Using {status['primary_database']} database")
            
            if status['primary_database'] == 'sqlite':
                print(f"📁 Database location: {status['sqlite']['database_path']}")
            
            # Test the connection
            if dm.test_connection():
                print("✅ Database connection test passed")
                return True
            else:
                print("❌ Database connection test failed")
                return False
        else:
            print("❌ Schema setup failed")
            return False
            
    except Exception as e:
        print(f"❌ Setup error: {e}")
        import traceback
        traceback.print_exc()
        return False