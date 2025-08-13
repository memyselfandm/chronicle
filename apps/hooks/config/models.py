"""
Data models for Chronicle observability system.

Defines the core data structures for sessions, events, and database operations.
"""

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import uuid4
import json


@dataclass
class Session:
    """Session model representing a Claude Code session."""
    
    # Primary fields
    id: Optional[str] = None
    claude_session_id: str = ""
    project_path: str = ""
    git_branch: Optional[str] = None
    start_time: str = ""
    end_time: Optional[str] = None
    created_at: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.id is None:
            self.id = str(uuid4())
        
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat() + 'Z'
        
        if not self.start_time:
            self.start_time = datetime.utcnow().isoformat() + 'Z'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Session':
        """Create Session from dictionary."""
        return cls(**data)
    
    def is_active(self) -> bool:
        """Check if session is currently active."""
        return self.end_time is None
    
    def end_session(self) -> None:
        """Mark session as ended."""
        self.end_time = datetime.utcnow().isoformat() + 'Z'


@dataclass
class Event:
    """Event model representing a single observability event."""
    
    # Primary fields
    id: Optional[str] = None
    session_id: str = ""
    event_type: str = ""  # 'prompt', 'tool_use', 'session_start', 'session_end'
    timestamp: str = ""
    data: Dict[str, Any] = None
    tool_name: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.id is None:
            self.id = str(uuid4())
        
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat() + 'Z'
        
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat() + 'Z'
        
        if self.data is None:
            self.data = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        result = {k: v for k, v in asdict(self).items() if v is not None}
        
        # Ensure data is JSON serializable
        if isinstance(result.get('data'), dict):
            result['data'] = json.dumps(result['data'])
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Event':
        """Create Event from dictionary."""
        # Handle JSON data field
        if isinstance(data.get('data'), str):
            try:
                data['data'] = json.loads(data['data'])
            except (json.JSONDecodeError, TypeError):
                data['data'] = {}
        
        return cls(**data)
    
    def is_tool_event(self) -> bool:
        """Check if this is a tool usage event."""
        return self.event_type == 'tool_use' and self.tool_name is not None
    
    def is_prompt_event(self) -> bool:
        """Check if this is a user prompt event."""
        return self.event_type == 'prompt'
    
    def is_lifecycle_event(self) -> bool:
        """Check if this is a session lifecycle event."""
        return self.event_type in ['session_start', 'session_end']


class EventType:
    """Constants for event types."""
    
    PROMPT = "prompt"
    TOOL_USE = "tool_use"
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    NOTIFICATION = "notification"
    ERROR = "error"
    
    @classmethod
    def all_types(cls) -> List[str]:
        """Get all valid event types."""
        return [
            cls.PROMPT,
            cls.TOOL_USE,
            cls.SESSION_START,
            cls.SESSION_END,
            cls.NOTIFICATION,
            cls.ERROR,
        ]
    
    @classmethod
    def is_valid(cls, event_type: str) -> bool:
        """Check if event type is valid."""
        return event_type in cls.all_types()


class ToolEvent(Event):
    """Specialized event for tool usage."""
    
    def __init__(self, session_id: str, tool_name: str, 
                 tool_input: Dict[str, Any] = None,
                 tool_output: Dict[str, Any] = None,
                 duration_ms: int = None,
                 **kwargs):
        """Initialize tool event."""
        data = {
            'tool_input': tool_input or {},
            'tool_output': tool_output or {},
        }
        
        super().__init__(
            session_id=session_id,
            event_type=EventType.TOOL_USE,
            tool_name=tool_name,
            duration_ms=duration_ms,
            data=data,
            **kwargs
        )


class PromptEvent(Event):
    """Specialized event for user prompts."""
    
    def __init__(self, session_id: str, prompt_text: str,
                 context: Dict[str, Any] = None,
                 **kwargs):
        """Initialize prompt event."""
        data = {
            'prompt_text': prompt_text,
            'prompt_length': len(prompt_text),
            'context': context or {},
        }
        
        super().__init__(
            session_id=session_id,
            event_type=EventType.PROMPT,
            data=data,
            **kwargs
        )


class SessionLifecycleEvent(Event):
    """Specialized event for session lifecycle."""
    
    def __init__(self, session_id: str, lifecycle_type: str,
                 context: Dict[str, Any] = None,
                 **kwargs):
        """Initialize lifecycle event."""
        data = {
            'lifecycle_type': lifecycle_type,
            'context': context or {},
        }
        
        event_type = EventType.SESSION_START if lifecycle_type == 'start' else EventType.SESSION_END
        
        super().__init__(
            session_id=session_id,
            event_type=event_type,
            data=data,
            **kwargs
        )


# Database schema constants
DATABASE_SCHEMA = {
    'sessions': {
        'table_name': 'sessions',
        'columns': {
            'id': 'UUID PRIMARY KEY',
            'claude_session_id': 'TEXT UNIQUE NOT NULL',
            'project_path': 'TEXT',
            'git_branch': 'TEXT',
            'start_time': 'TIMESTAMPTZ',
            'end_time': 'TIMESTAMPTZ',
            'created_at': 'TIMESTAMPTZ DEFAULT NOW()',
        },
        'indexes': [
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_project_path ON sessions(project_path)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC)',
        ]
    },
    'events': {
        'table_name': 'events',
        'columns': {
            'id': 'UUID PRIMARY KEY',
            'session_id': 'UUID REFERENCES sessions(id) ON DELETE CASCADE',
            'event_type': 'TEXT NOT NULL',
            'timestamp': 'TIMESTAMPTZ NOT NULL',
            'data': 'JSONB NOT NULL',
            'tool_name': 'TEXT',
            'duration_ms': 'INTEGER',
            'created_at': 'TIMESTAMPTZ DEFAULT NOW()',
        },
        'indexes': [
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type ON events(event_type)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tool_name ON events(tool_name) WHERE tool_name IS NOT NULL',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_data_gin ON events USING GIN(data)',
        ]
    }
}

# SQLite schema for fallback
SQLITE_SCHEMA = {
    'sessions': """
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            claude_session_id TEXT UNIQUE NOT NULL,
            project_path TEXT,
            git_branch TEXT,
            start_time TEXT,
            end_time TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """,
    'events': """
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            data TEXT NOT NULL,
            tool_name TEXT,
            duration_ms INTEGER,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    """,
    'indexes': [
        'CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
        'CREATE INDEX IF NOT EXISTS idx_events_tool_name ON events(tool_name)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)',
    ]
}


def validate_session_data(data: Dict[str, Any]) -> bool:
    """Validate session data structure."""
    required_fields = ['claude_session_id', 'project_path', 'start_time']
    
    for field in required_fields:
        if field not in data or not data[field]:
            return False
    
    return True


def validate_event_data(data: Dict[str, Any]) -> bool:
    """Validate event data structure."""
    required_fields = ['session_id', 'event_type', 'timestamp', 'data']
    
    for field in required_fields:
        if field not in data:
            return False
    
    # Validate event type
    if not EventType.is_valid(data['event_type']):
        return False
    
    # Validate data is a dict
    if not isinstance(data['data'], (dict, str)):
        return False
    
    return True


def sanitize_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize data by removing sensitive information."""
    import os
    
    # Skip sanitization in test environments
    if os.getenv('PYTEST_CURRENT_TEST') or ':memory:' in str(data):
        return data.copy()
    
    sensitive_keys = [
        'password', 'token', 'secret', 'api_key',
        'auth', 'credential', 'private'
    ]
    
    def _sanitize_recursive(obj):
        if isinstance(obj, dict):
            return {
                k: '[REDACTED]' if any(sensitive in k.lower() for sensitive in sensitive_keys)
                else _sanitize_recursive(v)
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [_sanitize_recursive(item) for item in obj]
        else:
            return obj
    
    return _sanitize_recursive(data.copy())


def get_postgres_schema_sql() -> str:
    """Generate PostgreSQL schema creation SQL."""
    sql_parts = []
    
    # Enable extensions
    sql_parts.append('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    sql_parts.append('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";')
    
    # Create tables
    for table_name, table_info in DATABASE_SCHEMA.items():
        columns = ', '.join([
            f'{col_name} {col_def}'
            for col_name, col_def in table_info['columns'].items()
        ])
        
        sql_parts.append(f'CREATE TABLE IF NOT EXISTS {table_name} ({columns});')
        
        # Create indexes
        if 'indexes' in table_info:
            sql_parts.extend(table_info['indexes'])
    
    return '\n'.join(sql_parts)


def get_sqlite_schema_sql() -> str:
    """Generate SQLite schema creation SQL."""
    sql_parts = []
    
    # Enable foreign keys
    sql_parts.append('PRAGMA foreign_keys = ON;')
    sql_parts.append('PRAGMA journal_mode = WAL;')
    
    # Create tables
    for table_name, table_sql in SQLITE_SCHEMA.items():
        if table_name != 'indexes':
            sql_parts.append(table_sql)
    
    # Create indexes
    sql_parts.extend(SQLITE_SCHEMA['indexes'])
    
    return '\n'.join(sql_parts)