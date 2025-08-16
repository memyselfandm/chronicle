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
Pre-Compact Hook for Claude Code Observability - UV Single-File Script

Captures conversation compaction events before context compression including:
- Conversation state before compaction
- Memory usage and token count metrics  
- Content analysis and preservation strategies
- Performance impact assessment
"""

import json
import logging
import os
import sys
import time
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

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
# Hook Implementation
# ===========================================

class PreCompactHook:
    """Hook for capturing pre-compaction conversation state."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "session_id" in input_data:
            return input_data["session_id"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process pre-compact hook input."""
        try:
            logger.info("Processing pre-compact hook...")
            logger.debug(f"Input data keys: {list(input_data.keys())}")
            
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            logger.info(f"Claude session ID: {self.claude_session_id}")
            
            # Extract compaction details
            conversation_length = input_data.get("conversationLength", 0)
            token_count = input_data.get("tokenCount", 0)
            memory_usage_mb = input_data.get("memoryUsageMb", 0)
            trigger_reason = input_data.get("triggerReason", "unknown")
            
            logger.info(f"Compact details - Length: {conversation_length}, Tokens: {token_count}, Memory: {memory_usage_mb}MB")
            logger.info(f"Compact trigger: {trigger_reason} ({'manual' if 'manual' in trigger_reason.lower() else 'automatic'})")
            
            # Analyze conversation state
            analysis = {
                "conversation_length": conversation_length,
                "estimated_token_count": token_count,
                "memory_usage_mb": memory_usage_mb,
                "trigger_reason": trigger_reason,
                "compaction_needed": conversation_length > 100 or token_count > 100000,
                "preservation_strategy": self._determine_preservation_strategy(input_data)
            }
            
            # Create event data
            event_data = {
                "session_id": self.claude_session_id or "unknown",
                "event_type": "pre_compaction",
                "hook_event_name": "PreCompact",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "conversation_state": analysis,
                    "pre_compaction_metrics": {
                        "length": conversation_length,
                        "tokens": token_count,
                        "memory_mb": memory_usage_mb
                    },
                    "raw_input": {k: v for k, v in input_data.items() if k not in ["content", "messages"]}  # Exclude large content
                }
            }
            
            # Save event
            logger.info("Saving pre-compaction event to database...")
            event_saved = self.db_manager.save_event(event_data)
            logger.info(f"Event saved successfully: {event_saved}")
            
            # Create response
            return {
                "continue": True,
                "suppressOutput": True,  # Pre-compact events are internal
            }
            
        except Exception as e:
            logger.debug(f"Pre-compact hook error: {e}")
            return {
                "continue": True,
                "suppressOutput": True,
            }
    
    def _determine_preservation_strategy(self, input_data: Dict[str, Any]) -> str:
        """Determine what preservation strategy should be used."""
        conversation_length = input_data.get("conversationLength", 0)
        token_count = input_data.get("tokenCount", 0)
        
        if token_count > 200000:
            return "aggressive_compression"
        elif conversation_length > 200:
            return "selective_preservation"
        elif "important" in str(input_data).lower():
            return "conservative_compression"
        else:
            return "standard_compression"

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for pre-compact hook."""
    try:
        logger.info("=" * 60)
        logger.info("PRE-COMPACT HOOK STARTED")
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
        logger.info("Initializing PreCompactHook...")
        
        hook = PreCompactHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        logger.info(f"Hook execution completed in {execution_time:.2f}ms")
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)

if __name__ == "__main__":
    main()