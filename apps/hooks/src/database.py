"""Database client wrapper for Claude Code observability hooks."""

import logging
import os
import time
from typing import Any, Dict, Optional
import uuid
from datetime import datetime

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
        """
        self.supabase_url = url or os.getenv("SUPABASE_URL")
        self.supabase_key = key or os.getenv("SUPABASE_ANON_KEY")
        self._supabase_client: Optional[Client] = None
        
        # Configuration
        self.retry_attempts = 3
        self.retry_delay = 1.0
        self.timeout = 10
        
        # Initialize client if credentials are available
        if self.supabase_url and self.supabase_key and SUPABASE_AVAILABLE:
            try:
                self._supabase_client = create_client(self.supabase_url, self.supabase_key)
                logger.info("Supabase client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {format_error_message(e, 'init')}")
                self._supabase_client = None
        else:
            if not SUPABASE_AVAILABLE:
                logger.warning("Supabase library not available")
            else:
                logger.warning("Supabase credentials not provided")
    
    def health_check(self) -> bool:
        """
        Check if the database connection is healthy.
        
        Returns:
            True if connection is healthy, False otherwise
        """
        if not self._supabase_client:
            return False
        
        try:
            # Simple query to check connection
            result = self._supabase_client.table('sessions').select('session_id').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Health check failed: {format_error_message(e, 'health_check')}")
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
            logger.error("No Supabase client available for session upsert")
            return False
        
        if not self._validate_session_data(session_data):
            logger.error("Invalid session data provided")
            return False
        
        return self._execute_with_retry(
            lambda: self._supabase_client.table('sessions').upsert(session_data).execute(),
            "upsert_session"
        )
    
    def insert_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Insert an event record.
        
        Args:
            event_data: Event data to insert
            
        Returns:
            True if successful, False otherwise
        """
        if not self._supabase_client:
            logger.error("No Supabase client available for event insert")
            return False
        
        if not self._validate_event_data(event_data):
            logger.error("Invalid event data provided")
            return False
        
        # Add event ID if not provided
        if 'event_id' not in event_data:
            event_data['event_id'] = str(uuid.uuid4())
        
        # Add timestamp if not provided
        if 'timestamp' not in event_data:
            event_data['timestamp'] = datetime.now().isoformat()
        
        return self._execute_with_retry(
            lambda: self._supabase_client.table('events').insert(event_data).execute(),
            "insert_event"
        )
    
    def _validate_session_data(self, data: Dict[str, Any]) -> bool:
        """
        Validate session data structure.
        
        Args:
            data: Session data to validate
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ['session_id']
        
        if not isinstance(data, dict):
            return False
        
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field in session data: {field}")
                return False
        
        return validate_json(data)
    
    def _validate_event_data(self, data: Dict[str, Any]) -> bool:
        """
        Validate event data structure.
        
        Args:
            data: Event data to validate
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ['session_id', 'hook_event_name']
        
        if not isinstance(data, dict):
            return False
        
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field in event data: {field}")
                return False
        
        return validate_json(data)
    
    def _execute_with_retry(self, operation, context: str) -> bool:
        """
        Execute a database operation with retry logic.
        
        Args:
            operation: Function to execute
            context: Context for error messages
            
        Returns:
            True if successful, False otherwise
        """
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                result = operation()
                if result.data is not None:
                    logger.debug(f"Operation {context} succeeded on attempt {attempt + 1}")
                    return True
                else:
                    logger.warning(f"Operation {context} returned no data on attempt {attempt + 1}")
                    
            except Exception as e:
                last_error = e
                logger.warning(f"Operation {context} failed on attempt {attempt + 1}: {format_error_message(e)}")
                
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
        
        logger.error(f"Operation {context} failed after {self.retry_attempts} attempts: {format_error_message(last_error)}")
        return False
    
    def get_connection_info(self) -> Dict[str, Any]:
        """
        Get information about the current connection.
        
        Returns:
            Dictionary with connection information
        """
        return {
            "has_client": self._supabase_client is not None,
            "has_credentials": bool(self.supabase_url and self.supabase_key),
            "url": self.supabase_url,
            "supabase_available": SUPABASE_AVAILABLE,
            "is_healthy": self.health_check() if self._supabase_client else False
        }


class DatabaseManager:
    """
    High-level database manager that handles both Supabase and SQLite fallback.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize database manager.
        
        Args:
            config: Configuration dictionary with database settings
        """
        self.config = config or {}
        self.supabase_client = SupabaseClient()
        self.sqlite_path = self.config.get("sqlite", {}).get("database_path", 
                                                            os.path.expanduser("~/.claude/hooks_data.db"))
        self.fallback_enabled = self.config.get("sqlite", {}).get("fallback_enabled", True)
        
        logger.info(f"Database manager initialized with fallback={'enabled' if self.fallback_enabled else 'disabled'}")
    
    def save_session(self, session_data: Dict[str, Any]) -> bool:
        """
        Save session data to primary or fallback storage.
        
        Args:
            session_data: Session data to save
            
        Returns:
            True if successful, False otherwise
        """
        # Try Supabase first
        if self.supabase_client.upsert_session(session_data):
            return True
        
        # Fallback to SQLite if enabled
        if self.fallback_enabled:
            logger.info("Falling back to SQLite for session storage")
            return self._save_session_sqlite(session_data)
        
        return False
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to primary or fallback storage.
        
        Args:
            event_data: Event data to save
            
        Returns:
            True if successful, False otherwise
        """
        # Try Supabase first
        if self.supabase_client.insert_event(event_data):
            return True
        
        # Fallback to SQLite if enabled
        if self.fallback_enabled:
            logger.info("Falling back to SQLite for event storage")
            return self._save_event_sqlite(event_data)
        
        return False
    
    def _save_session_sqlite(self, session_data: Dict[str, Any]) -> bool:
        """
        Save session data to SQLite (fallback implementation).
        
        Args:
            session_data: Session data to save
            
        Returns:
            True if successful, False otherwise
        """
        # TODO: Implement SQLite fallback in future iteration
        logger.warning("SQLite fallback not yet implemented")
        return False
    
    def _save_event_sqlite(self, event_data: Dict[str, Any]) -> bool:
        """
        Save event data to SQLite (fallback implementation).
        
        Args:
            event_data: Event data to save
            
        Returns:
            True if successful, False otherwise
        """
        # TODO: Implement SQLite fallback in future iteration
        logger.warning("SQLite fallback not yet implemented")
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all database connections.
        
        Returns:
            Dictionary with connection status
        """
        return {
            "supabase": self.supabase_client.get_connection_info(),
            "sqlite_fallback_enabled": self.fallback_enabled,
            "sqlite_path": self.sqlite_path
        }