#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "asyncpg>=0.28.0",
#     "python-dotenv>=1.0.0",
#     "typing-extensions>=4.7.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Post Tool Use Hook for Claude Code Observability - UV Single-File Script

Captures tool execution results after tool completion including:
- Tool name and execution duration
- Success/failure status and error messages  
- Result size and metadata
- MCP tool detection and server identification
- Timeout and partial result handling
"""

import json
import logging
import os
import re
import sys
import time
import sqlite3
import subprocess
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple, Union


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
# Inline Constants and Patterns
# ===========================================

# MCP tool detection patterns
MCP_TOOL_PATTERN = re.compile(r'^mcp__(.+?)__(.+)$')
LARGE_RESULT_THRESHOLD = 100000  # 100KB threshold for large results

# Security patterns (simplified for performance)
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
    ]
}

# ===========================================
# Inline Utility Functions
# ===========================================

def sanitize_data(data: Any) -> Any:
    """Fast sanitization for tool data."""
    if data is None:
        return None
    
    data_str = json_impl.dumps(data) if not isinstance(data, str) else data
    sanitized_str = data_str
    
    # Only sanitize most critical patterns for performance
    for pattern in SENSITIVE_PATTERNS["api_keys"]:
        sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str)
    
    for pattern in SENSITIVE_PATTERNS["user_paths"]:
        sanitized_str = re.sub(pattern, '/Users/[USER]', sanitized_str)
    
    try:
        if isinstance(data, dict):
            return json_impl.loads(sanitized_str)
        return sanitized_str
    except:
        return sanitized_str

def is_mcp_tool(tool_name: str) -> bool:
    """Determine if a tool is an MCP tool based on naming pattern."""
    if not tool_name or not isinstance(tool_name, str):
        return False
    return bool(MCP_TOOL_PATTERN.match(tool_name))

def extract_mcp_server_name(tool_name: str) -> Optional[str]:
    """Extract MCP server name from tool name."""
    if not tool_name or not isinstance(tool_name, str):
        return None
    
    match = MCP_TOOL_PATTERN.match(tool_name)
    return match.group(1) if match else None

def parse_tool_response(response_data: Any) -> Dict[str, Any]:
    """Parse tool response data and extract key metrics."""
    if response_data is None:
        return {
            "success": False,
            "error": "No response data",
            "result_size": 0,
            "large_result": False
        }
    
    # Calculate response size
    try:
        response_str = json_impl.dumps(response_data) if not isinstance(response_data, str) else response_data
        result_size = len(response_str.encode('utf-8'))
    except (TypeError, UnicodeEncodeError):
        result_size = 0
    
    # Extract success/failure status
    success = True
    error = None
    error_type = None
    
    if isinstance(response_data, dict):
        status = response_data.get("status", "success")
        if status in ["error", "timeout", "failed"]:
            success = False
        
        if "error" in response_data:
            success = False
            error = response_data["error"]
        
        if "error_type" in response_data:
            error_type = response_data["error_type"]
        
        if error and "timeout" in str(error).lower():
            error_type = "timeout"
    
    parsed = {
        "success": success,
        "error": error,
        "error_type": error_type,
        "result_size": result_size,
        "large_result": result_size > LARGE_RESULT_THRESHOLD,
        "metadata": response_data if isinstance(response_data, dict) else None
    }
    
    # Include partial results if available
    if isinstance(response_data, dict) and "partial_result" in response_data:
        parsed["partial_result"] = response_data["partial_result"]
    
    return parsed

def calculate_duration_ms(start_time: Optional[float] = None, 
                         end_time: Optional[float] = None,
                         execution_time_ms: Optional[int] = None) -> Optional[int]:
    """Calculate execution duration in milliseconds."""
    if execution_time_ms is not None:
        return execution_time_ms
    
    if start_time is not None and end_time is not None:
        duration_seconds = end_time - start_time
        if duration_seconds >= 0:
            return int(duration_seconds * 1000)
    
    return None

# ===========================================
# Base Hook Implementation
# ===========================================

class BaseHook:
    """Simplified base hook for performance."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract Claude session ID as per Claude Code spec."""
        session_id = None
        if input_data and "session_id" in input_data:
            session_id = input_data["session_id"]
            logger.debug(f"Session ID from input data: {session_id}")
        else:
            session_id = os.getenv("CLAUDE_SESSION_ID")
            logger.debug(f"Session ID from environment: {session_id}")
        return session_id
    
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate input data."""
        if not isinstance(input_data, dict):
            return {"hook_event_name": "Unknown", "error": "Invalid input"}
        
        self.claude_session_id = self.get_claude_session_id(input_data)
        sanitized_input = sanitize_data(input_data)
        
        return {
            "hook_event_name": "PostToolUse",
            "claude_session_id": self.claude_session_id,
            "raw_input": sanitized_input,
            "timestamp": datetime.now().isoformat(),
        }
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event with auto session creation."""
        try:
            # Ensure session exists
            if not self.session_uuid and self.claude_session_id:
                logger.debug(f"Creating new session for Claude session ID: {self.claude_session_id}")
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success:
                    self.session_uuid = session_uuid
                    logger.info(f"Created session with UUID: {session_uuid}")
                else:
                    logger.error("Failed to create session")
            
            if not self.session_uuid:
                logger.error("No session UUID available for event saving")
                return False
            
            # Add required fields
            event_data["session_id"] = self.session_uuid
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            logger.debug(f"Saving event with ID: {event_data['event_id']}")
            result = self.db_manager.save_event(event_data)
            logger.debug(f"Event save result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error saving event: {e}")
            return False
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create hook response."""
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
    def create_hook_specific_output(self, **kwargs) -> Dict[str, Any]:
        """Create hookSpecificOutput with camelCase keys."""
        output = {}
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                output[camel_key] = value
        return output
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        if not snake_str:
            return snake_str
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])

# ===========================================
# Post Tool Use Hook Implementation
# ===========================================

class PostToolUseHook(BaseHook):
    """Hook to capture tool execution results and performance metrics."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Any) -> Dict[str, Any]:
        """Process tool execution completion and capture metrics."""
        try:
            logger.debug("Starting process_hook")
            
            if input_data is None:
                logger.warning("No input data provided to process_hook")
                return self.create_response()
            
            # Process input data
            logger.debug("Processing input data")
            processed_data = self.process_hook_data(input_data)
            
            # Extract tool execution details as per Claude Code spec
            raw_input = processed_data.get("raw_input", {})
            tool_name = raw_input.get("tool_name")
            tool_input = raw_input.get("tool_input", {})
            tool_response = raw_input.get("tool_response")
            execution_time = raw_input.get("execution_time")
            start_time = raw_input.get("start_time")
            end_time = raw_input.get("end_time")
            
            logger.info(f"Processing tool: {tool_name}")
            logger.debug(f"Tool input keys: {list(tool_input.keys()) if isinstance(tool_input, dict) else 'Not a dict'}")
            
            if not tool_name:
                logger.warning("No tool name found in input data")
                return self.create_response()
            
            # Parse tool response
            logger.debug("Parsing tool response")
            response_parsed = parse_tool_response(tool_response)
            logger.info(f"Tool success: {response_parsed['success']}, Result size: {response_parsed['result_size']} bytes")
            
            if response_parsed.get("error"):
                logger.warning(f"Tool error detected: {response_parsed['error']}")
            
            # Calculate execution duration
            duration_ms = calculate_duration_ms(start_time, end_time, execution_time)
            logger.info(f"Tool execution duration: {duration_ms}ms")
            
            # Detect MCP tool information
            is_mcp = is_mcp_tool(tool_name)
            mcp_server = extract_mcp_server_name(tool_name) if is_mcp else None
            if is_mcp:
                logger.info(f"MCP tool detected - Server: {mcp_server}")
            
            # Create tool usage event data
            tool_event_data = {
                "event_type": "tool_use",
                "hook_event_name": "PostToolUse",
                "timestamp": processed_data.get("timestamp"),
                "data": {
                    "tool_name": tool_name,
                    "duration_ms": duration_ms,
                    "success": response_parsed["success"],
                    "result_size": response_parsed["result_size"],
                    "error": response_parsed["error"],
                    "error_type": response_parsed["error_type"],
                    "is_mcp_tool": is_mcp,
                    "mcp_server": mcp_server,
                    "large_result": response_parsed["large_result"],
                    "tool_input_summary": self._summarize_tool_input(tool_input),
                }
            }
            
            # Include partial results for timeout scenarios
            if "partial_result" in response_parsed:
                tool_event_data["data"]["partial_result"] = response_parsed["partial_result"]
                tool_event_data["data"]["timeout_detected"] = True
            
            # Save the event
            logger.debug("Attempting to save tool event to database")
            save_success = self.save_event(tool_event_data)
            logger.info(f"Database save result: {'Success' if save_success else 'Failed'}")
            
            # Analyze for security concerns
            logger.debug("Analyzing tool security")
            security_decision, security_reason = self.analyze_tool_security(
                tool_name, tool_input, response_parsed
            )
            logger.info(f"Security decision: {security_decision} - {security_reason}")
            
            # Create response
            if security_decision == "allow":
                return self.create_response(
                    continue_execution=True,
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        tool_success=response_parsed["success"],
                        mcp_tool=is_mcp,
                        mcp_server=mcp_server,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision
                    )
                )
            else:
                # Block or ask for permission
                return self.create_response(
                    continue_execution=security_decision != "deny",
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        mcp_tool=is_mcp,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision,
                        permission_decision_reason=security_reason
                    )
                )
            
        except Exception as e:
            logger.error(f"Hook processing error: {e}", exc_info=True)
            
            return self.create_response(
                continue_execution=True,
                suppress_output=False,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PostToolUse",
                    error=str(e)[:100],
                    event_saved=False,
                    tool_success=False
                )
            )
    
    def _summarize_tool_input(self, tool_input: Any) -> Dict[str, Any]:
        """Create a summary of tool input for logging."""
        if not tool_input:
            return {"input_provided": False}
        
        summary = {"input_provided": True}
        
        if isinstance(tool_input, dict):
            summary["param_count"] = len(tool_input)
            summary["param_names"] = list(tool_input.keys())
            
            try:
                input_str = json_impl.dumps(tool_input)
                summary["input_size"] = len(input_str.encode('utf-8'))
            except:
                summary["input_size"] = 0
            
            # Check for operations
            if any(key in tool_input for key in ["file_path", "path"]):
                summary["involves_file_operations"] = True
            
            if any(key in tool_input for key in ["url", "endpoint"]):
                summary["involves_network"] = True
            
            if "command" in tool_input:
                summary["involves_command_execution"] = True
        
        return summary
    
    def analyze_tool_security(self, tool_name: str, tool_input: Any, 
                             tool_response: Dict[str, Any]) -> Tuple[str, str]:
        """Fast security analysis for tool execution."""
        # Safe tools (fast path)
        safe_tools = {
            "Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch", 
            "mcp__ide__getDiagnostics", "mcp__ide__executeCode"
        }
        
        if tool_name in safe_tools:
            return "allow", f"Safe operation: {tool_name}"
        
        # Quick security checks for common dangerous patterns
        if tool_name == "Bash":
            return self._analyze_bash_security(tool_input)
        
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            return self._analyze_file_security(tool_input)
        
        if tool_name.startswith("mcp__"):
            return "allow", f"MCP tool allowed: {tool_name}"
        
        # Default allow
        return "allow", f"Tool {tool_name} allowed"
    
    def _analyze_bash_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick bash security analysis."""
        if not isinstance(tool_input, dict) or "command" not in tool_input:
            return "allow", "No command to analyze"
        
        command = str(tool_input["command"]).lower()
        
        # Only check most dangerous patterns for performance
        dangerous_patterns = [
            "rm -rf /",
            "sudo rm -rf",
            "mkfs.",
            "dd if=/dev/zero",
            ":(){ :|:& };:"
        ]
        
        for pattern in dangerous_patterns:
            if pattern in command:
                return "deny", f"Dangerous command blocked: {pattern}"
        
        return "allow", "Command appears safe"
    
    def _analyze_file_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick file operation security analysis."""
        if not isinstance(tool_input, dict):
            return "allow", "No file path to analyze"
        
        file_path = str(tool_input.get("file_path", "")).lower()
        
        # Check for critical system paths
        critical_paths = ["/etc/passwd", "/etc/shadow", "c:\\windows\\system32"]
        
        for critical in critical_paths:
            if critical in file_path:
                return "deny", f"Critical system file access blocked: {file_path}"
        
        return "allow", "File operation appears safe"

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for the hook script."""
    try:
        logger.info("=" * 60)
        logger.info("POST TOOL USE HOOK STARTED")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            
            # Log tool-specific details as per Claude Code spec
            tool_name = input_data.get('tool_name')
            if tool_name:
                logger.info(f"Tool name: {tool_name}")
            
            tool_input = input_data.get('tool_input')
            if tool_input:
                tool_input_size = len(str(tool_input))
                logger.info(f"Tool input size: {tool_input_size} characters")
            
            tool_response = input_data.get('tool_response')
            if tool_response:
                tool_response_size = len(str(tool_response))
                logger.info(f"Tool response size: {tool_response_size} characters")
            
            execution_time = input_data.get('execution_time')
            if execution_time:
                logger.info(f"Execution time: {execution_time}ms")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Initialize and run the hook
        start_time = time.perf_counter()
        logger.info("Initializing PostToolUseHook...")
        
        hook = PostToolUseHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        else:
            logger.info(f"Hook execution time: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Hook execution failed: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)

if __name__ == "__main__":
    main()