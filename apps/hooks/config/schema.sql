-- Chronicle Observability Database Schema
-- PostgreSQL/Supabase implementation with Row Level Security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Sessions table - Core session tracking
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claude_session_id TEXT UNIQUE NOT NULL,
    project_path TEXT,
    git_branch TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table - All observability events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('prompt', 'tool_use', 'session_start', 'session_end', 'notification', 'error')),
    timestamp TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    tool_name TEXT,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_claude_session_id 
ON sessions(claude_session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_project_path 
ON sessions(project_path);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_start_time 
ON sessions(start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_session_timestamp 
ON events(session_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type 
ON events(event_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tool_name 
ON events(tool_name) WHERE tool_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_data_gin 
ON events USING GIN(data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp 
ON events(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for single-user deployment (allow all operations)
-- Note: In production, these would be more restrictive

-- Sessions policies
CREATE POLICY "Allow all operations on sessions" 
ON sessions FOR ALL 
USING (true) 
WITH CHECK (true);

-- Events policies  
CREATE POLICY "Allow all operations on events" 
ON events FOR ALL 
USING (true) 
WITH CHECK (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_stats(session_uuid UUID)
RETURNS TABLE (
    event_count BIGINT,
    tool_events_count BIGINT,
    prompt_events_count BIGINT,
    avg_tool_duration NUMERIC,
    session_duration_minutes NUMERIC
) 
LANGUAGE SQL
AS $$
    SELECT 
        COUNT(*) as event_count,
        COUNT(*) FILTER (WHERE event_type = 'tool_use') as tool_events_count,
        COUNT(*) FILTER (WHERE event_type = 'prompt') as prompt_events_count,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_tool_duration,
        EXTRACT(EPOCH FROM (
            COALESCE(
                (SELECT end_time FROM sessions WHERE id = session_uuid),
                NOW()
            ) - (SELECT start_time FROM sessions WHERE id = session_uuid)
        )) / 60 as session_duration_minutes
    FROM events 
    WHERE session_id = session_uuid;
$$;

-- Function to get tool usage statistics
CREATE OR REPLACE FUNCTION get_tool_usage_stats(time_window_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    tool_name TEXT,
    usage_count BIGINT,
    avg_duration_ms NUMERIC,
    p95_duration_ms NUMERIC,
    success_rate NUMERIC
) 
LANGUAGE SQL
AS $$
    SELECT 
        e.tool_name,
        COUNT(*) as usage_count,
        AVG(e.duration_ms) as avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY e.duration_ms) as p95_duration_ms,
        -- Calculate success rate based on event data
        (COUNT(*) FILTER (WHERE (e.data->>'success')::boolean = true)::NUMERIC / COUNT(*)) * 100 as success_rate
    FROM events e
    WHERE e.tool_name IS NOT NULL 
      AND e.created_at >= NOW() - INTERVAL '%s hours'
      AND e.event_type = 'tool_use'
    GROUP BY e.tool_name
    ORDER BY usage_count DESC;
$$ % time_window_hours;

-- Function to cleanup old sessions and events
CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE SQL
AS $$
    WITH deleted_sessions AS (
        DELETE FROM sessions 
        WHERE created_at < NOW() - INTERVAL '%s days'
        AND end_time IS NOT NULL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER FROM deleted_sessions;
$$ % retention_days;

-- Trigger to automatically set end_time when session is marked as ended
CREATE OR REPLACE FUNCTION update_session_end_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is a session_end event, update the session's end_time
    IF NEW.event_type = 'session_end' THEN
        UPDATE sessions 
        SET end_time = NEW.timestamp 
        WHERE id = NEW.session_id 
        AND end_time IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_session_end_time
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_session_end_time();

-- Trigger to validate event data structure
CREATE OR REPLACE FUNCTION validate_event_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ensure session exists
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = NEW.session_id) THEN
        RAISE EXCEPTION 'Session % does not exist', NEW.session_id;
    END IF;
    
    -- Validate tool events have tool_name
    IF NEW.event_type = 'tool_use' AND NEW.tool_name IS NULL THEN
        RAISE EXCEPTION 'Tool events must have a tool_name';
    END IF;
    
    -- Validate timestamp is not in future
    IF NEW.timestamp > NOW() + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'Event timestamp cannot be in the future';
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_event_data
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION validate_event_data();

-- View for active sessions with event counts
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.*,
    COUNT(e.id) as event_count,
    COUNT(e.id) FILTER (WHERE e.event_type = 'tool_use') as tool_event_count,
    COUNT(e.id) FILTER (WHERE e.event_type = 'prompt') as prompt_event_count,
    MAX(e.timestamp) as last_activity
FROM sessions s
LEFT JOIN events e ON s.id = e.session_id
WHERE s.end_time IS NULL
GROUP BY s.id, s.claude_session_id, s.project_path, s.git_branch, s.start_time, s.end_time, s.created_at
ORDER BY s.start_time DESC;

-- View for recent events with session context
CREATE OR REPLACE VIEW recent_events AS
SELECT 
    e.*,
    s.claude_session_id,
    s.project_path,
    s.git_branch
FROM events e
JOIN sessions s ON e.session_id = s.id
WHERE e.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY e.timestamp DESC;

-- Grant necessary permissions for real-time subscriptions
GRANT SELECT ON sessions TO anon;
GRANT SELECT ON events TO anon;
GRANT SELECT ON active_sessions TO anon;
GRANT SELECT ON recent_events TO anon;

-- Grant full access to authenticated users (for single-user deployment)
GRANT ALL ON sessions TO authenticated;
GRANT ALL ON events TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tool_usage_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_data(INTEGER) TO authenticated;