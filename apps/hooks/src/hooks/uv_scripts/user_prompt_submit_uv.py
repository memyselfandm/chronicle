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
User Prompt Capture Hook for Claude Code - UV Single-File Script

Captures user prompts before processing to track user behavior,
prompt complexity, and intent classification for observability.

Features:
- Parse prompt text and metadata
- Intent classification and analysis
- Security screening for dangerous prompts
- Context injection based on prompt analysis
"""

import json
import os
import re
import sys
import time
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

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

# Environment variables will be loaded by inline environment loader

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging with file output
import logging
from pathlib import Path

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
# Intent Classification Patterns
# ===========================================

INTENT_PATTERNS = {
    'code_generation': [
        r'\b(create|write|generate|implement|build)\b.*\b(function|class|component|file|script|code)\b',
        r'\bhelp me (write|create|build|implement)\b',
        r'\bneed (a|an|some)\b.*\b(function|class|script|component)\b'
    ],
    'code_modification': [
        r'\b(fix|update|modify|change|refactor|optimize|improve)\b',
        r'\b(add|remove|delete)\b.*\b(to|from)\b',
        r'\bmake.*\b(better|faster|cleaner|more efficient)\b'
    ],
    'debugging': [
        r'\b(debug|fix|error|issue|problem|bug|failing|broken)\b',
        r'\b(not working|doesn\'t work|isn\'t working)\b',
        r'\bwhy (is|does|doesn\'t|isn\'t)\b',
        r'\bthrows?\s+(an?\s+)?(error|exception)\b'
    ],
    'explanation': [
        r'\b(explain|what|how|why)\b',
        r'\b(tell me about|describe|clarify|understand)\b',
        r'\b(meaning|purpose|does this do)\b'
    ],
    'configuration': [
        r'\b(setup|configure|install|settings)\b',
        r'\b(environment|config|preferences)\b'
    ]
}

# Security patterns for dangerous prompts
DANGEROUS_PROMPT_PATTERNS = [
    (r"delete\s+all\s+files", "Dangerous file deletion request detected"),
    (r"rm\s+-rf\s+/", "Dangerous system deletion command detected"),
    (r"format\s+(c:|hard\s+drive)", "System formatting request detected"),
    (r"access\s+(password|credential)", "Attempt to access sensitive credentials"),
    (r"bypass\s+(security|authentication)", "Security bypass attempt detected")
]

# ===========================================
# Utility Functions for Prompt Analysis
# ===========================================

def extract_prompt_text(input_data: Dict[str, Any]) -> str:
    """Extract prompt text from various input formats."""
    # Check common prompt fields
    prompt_fields = ["prompt", "message", "text", "content", "input"]
    
    for field in prompt_fields:
        if field in input_data:
            value = input_data[field]
            if isinstance(value, str):
                return value
            elif isinstance(value, dict) and "text" in value:
                return value["text"]
            elif isinstance(value, dict) and "content" in value:
                return value["content"]
    
    # Fallback: convert entire input to string if no specific field found
    return str(input_data).strip()

def classify_intent(prompt_text: str) -> str:
    """Classify user intent based on prompt text patterns."""
    prompt_lower = prompt_text.lower()
    
    # Check each intent category
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, prompt_lower, re.IGNORECASE):
                return intent
    
    return "general"

def analyze_prompt_security(prompt_text: str) -> Tuple[bool, Optional[str]]:
    """Analyze prompt for security risks."""
    prompt_lower = prompt_text.lower()
    
    for pattern, reason in DANGEROUS_PROMPT_PATTERNS:
        if re.search(pattern, prompt_lower, re.IGNORECASE):
            return True, reason
    
    return False, None

def generate_context_injection(intent: str, prompt_text: str) -> Optional[str]:
    """Generate additional context based on intent and prompt analysis."""
    if intent == "debugging":
        return "Consider checking logs, error messages, and testing with minimal examples."
    elif intent == "code_generation":
        return "Remember to follow best practices: proper error handling, documentation, and testing."
    elif intent == "configuration":
        return "Ensure you have proper backups before making configuration changes."
    
    return None

def sanitize_prompt_data(prompt_text: str) -> str:
    """Sanitize prompt data for safe storage."""
    # Truncate extremely long prompts
    if len(prompt_text) > 5000:
        return prompt_text[:4990] + "... [truncated]"
    
    # Remove potential sensitive patterns (basic sanitization)
    sanitized = re.sub(r'\b(?:password|token|key|secret)\s*[=:]\s*\S+', '[REDACTED]', prompt_text, flags=re.IGNORECASE)
    
    return sanitized

# ===========================================
# Database Manager
# ===========================================

class UserPromptSubmitHook:
    """Hook for capturing and analyzing user prompts."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID with fallback to cached session."""
        if "session_id" in input_data:
            return input_data["session_id"]
        
        session_id = os.getenv("CLAUDE_SESSION_ID")
        if session_id:
            return session_id
        
        # Try to get cached session ID from session_start hook
        try:
            from pathlib import Path
            session_cache_file = Path.home() / ".claude" / "hooks" / "chronicle" / "tmp" / "current_session_id"
            if session_cache_file.exists():
                cached_id = session_cache_file.read_text().strip()
                logger.info(f"Using cached session ID: {cached_id}")
                return cached_id
        except Exception as e:
            logger.debug(f"Failed to load cached session ID: {e}")
        
        logger.warning("No session ID available from Claude Code or cache")
        return None
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process user prompt submission."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            
            # Validate input
            if not self._is_valid_prompt_input(input_data):
                return self._create_prompt_response(
                    prompt_blocked=False,
                    success=False,
                    error="Invalid prompt input format"
                )
            
            # Extract and analyze prompt
            prompt_text = extract_prompt_text(input_data)
            prompt_length = len(prompt_text)
            intent = classify_intent(prompt_text)
            
            # Security analysis
            should_block, block_reason = analyze_prompt_security(prompt_text)
            
            # Generate context injection if appropriate
            additional_context = generate_context_injection(intent, prompt_text)
            
            # Create event data
            event_data = {
                "event_type": "prompt",
                "hook_event_name": "UserPromptSubmit",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "prompt_text": sanitize_prompt_data(prompt_text),
                    "prompt_length": prompt_length,
                    "intent": intent,
                    "security_flagged": should_block,
                    "context_injected": additional_context is not None
                }
            }
            
            # Save event (ensure session exists first)
            self._ensure_session_exists()
            event_saved = False
            if self.session_uuid:
                event_data["session_id"] = self.session_uuid
                event_saved = self.db_manager.save_event(event_data)
            
            # Create response
            return self._create_prompt_response(
                prompt_blocked=should_block,
                block_reason=block_reason,
                success=event_saved,
                additional_context=additional_context,
                prompt_length=prompt_length,
                intent=intent
            )
            
        except Exception as e:
            logger.debug(f"Hook processing error: {e}")
            return self._create_prompt_response(
                prompt_blocked=False,
                success=False,
                error=str(e)[:100]
            )
    
    def _is_valid_prompt_input(self, input_data: Dict[str, Any]) -> bool:
        """Check if input contains valid prompt data."""
        if not isinstance(input_data, dict):
            return False
        
        # Check for common prompt fields
        prompt_fields = ["prompt", "message", "text", "content"]
        return any(field in input_data for field in prompt_fields)
    
    def _ensure_session_exists(self):
        """Ensure session exists for event logging."""
        if not self.session_uuid and self.claude_session_id:
            session_data = {
                "claude_session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "project_path": os.getcwd()
            }
            success, session_uuid = self.db_manager.save_session(session_data)
            if success:
                self.session_uuid = session_uuid
    
    def _create_prompt_response(self, prompt_blocked: bool = False,
                               block_reason: Optional[str] = None,
                               success: bool = True,
                               additional_context: Optional[str] = None,
                               error: Optional[str] = None,
                               **kwargs) -> Dict[str, Any]:
        """Create hook response for user prompt submission."""
        
        hook_output = {
            "hookEventName": "UserPromptSubmit",
            "promptBlocked": prompt_blocked,
            "processingSuccess": success,
            "eventSaved": self.session_uuid is not None
        }
        
        # Add additional fields
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                hook_output[camel_key] = value
        
        if error:
            hook_output["error"] = error
        
        if block_reason:
            hook_output["blockReason"] = block_reason
        
        response = {
            "continue": not prompt_blocked,
            "suppressOutput": False,  # User prompt responses should be visible
            "hookSpecificOutput": hook_output
        }
        
        # Add context injection
        if additional_context:
            response["hookSpecificOutput"]["additionalContext"] = additional_context
        
        # Add stop reason if blocked
        if prompt_blocked and block_reason:
            response["stopReason"] = block_reason
        
        return response
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        if not snake_str:
            return snake_str
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for user prompt submit hook."""
    try:
        logger.info("=" * 60)
        logger.info("USER PROMPT SUBMIT HOOK STARTED")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            logger.info("=" * 40)
            logger.info("FULL INPUT PAYLOAD DUMP:")
            logger.info(json_impl.dumps(input_data, indent=2))
            logger.info("=" * 40)
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing UserPromptSubmitHook...")
        
        hook = UserPromptSubmitHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Safe response for invalid JSON
        safe_response = {
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "promptBlocked": False,
                "processingSuccess": False,
                "error": "Invalid JSON input"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        # Safe default response
        safe_response = {
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "promptBlocked": False,
                "processingSuccess": False,
                "error": "Hook processing failed"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)

if __name__ == "__main__":
    main()