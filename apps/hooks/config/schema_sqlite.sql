-- Chronicle Observability Database Schema
-- SQLite implementation for fallback/local storage

-- Enable foreign keys and WAL mode for better performance
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;

-- Sessions table - Core session tracking
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT UNIQUE NOT NULL,
    project_path TEXT,
    git_branch TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    created_at TEXT DEFAULT (datetime('now', 'utc'))
);

-- Events table - All observability events
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('session_start', 'notification', 'error', 'pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop', 'subagent_stop', 'pre_compact')),
    timestamp TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    tool_name TEXT,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    created_at TEXT DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Performance indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id 
ON sessions(claude_session_id);

CREATE INDEX IF NOT EXISTS idx_sessions_project_path 
ON sessions(project_path);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time 
ON sessions(start_time DESC);

-- Performance indexes for events
CREATE INDEX IF NOT EXISTS idx_events_session_id 
ON events(session_id);

CREATE INDEX IF NOT EXISTS idx_events_timestamp 
ON events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_session_timestamp 
ON events(session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_type 
ON events(event_type);

CREATE INDEX IF NOT EXISTS idx_events_tool_name 
ON events(tool_name) WHERE tool_name IS NOT NULL;

-- View for active sessions with event counts
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT 
    s.*,
    COUNT(e.id) as event_count,
    COUNT(CASE WHEN e.event_type IN ('pre_tool_use', 'post_tool_use') THEN 1 END) as tool_event_count,
    COUNT(CASE WHEN e.event_type = 'user_prompt_submit' THEN 1 END) as prompt_event_count,
    MAX(e.timestamp) as last_activity
FROM sessions s
LEFT JOIN events e ON s.id = e.session_id
WHERE s.end_time IS NULL
GROUP BY s.id, s.claude_session_id, s.project_path, s.git_branch, s.start_time, s.end_time, s.created_at
ORDER BY s.start_time DESC;

-- View for recent events with session context
CREATE VIEW IF NOT EXISTS recent_events AS
SELECT 
    e.*,
    s.claude_session_id,
    s.project_path,
    s.git_branch
FROM events e
JOIN sessions s ON e.session_id = s.id
WHERE e.created_at >= datetime('now', '-24 hours', 'utc')
ORDER BY e.timestamp DESC;

-- Trigger to automatically set end_time when session is marked as ended
CREATE TRIGGER IF NOT EXISTS trigger_update_session_end_time
AFTER INSERT ON events
FOR EACH ROW
WHEN NEW.event_type = 'stop'
BEGIN
    UPDATE sessions 
    SET end_time = NEW.timestamp 
    WHERE id = NEW.session_id 
    AND end_time IS NULL;
END;

-- Trigger to validate event data structure
CREATE TRIGGER IF NOT EXISTS trigger_validate_event_data
BEFORE INSERT ON events
FOR EACH ROW
BEGIN
    -- Ensure session exists
    SELECT CASE 
        WHEN (SELECT COUNT(*) FROM sessions WHERE id = NEW.session_id) = 0 
        THEN RAISE(ABORT, 'Session does not exist')
    END;
    
    -- Validate tool events have tool_name
    SELECT CASE 
        WHEN NEW.event_type IN ('pre_tool_use', 'post_tool_use') AND NEW.tool_name IS NULL 
        THEN RAISE(ABORT, 'Tool events must have a tool_name')
    END;
    
    -- Validate timestamp format (basic check)
    SELECT CASE 
        WHEN NEW.timestamp = '' OR NEW.timestamp IS NULL 
        THEN RAISE(ABORT, 'Event timestamp cannot be empty')
    END;
END;