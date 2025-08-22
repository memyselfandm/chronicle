-- Chronicle Observability Database Schema
-- PostgreSQL/Supabase implementation with prefixed table names to avoid collisions

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Sessions table - Core session tracking (prefixed to avoid collisions)
CREATE TABLE IF NOT EXISTS chronicle_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claude_session_id TEXT UNIQUE NOT NULL,
    project_path TEXT,
    git_branch TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table - All observability events (prefixed to avoid collisions)
CREATE TABLE IF NOT EXISTS chronicle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('session_start', 'notification', 'error', 'pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop', 'subagent_stop', 'pre_compact')),
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    tool_name TEXT,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_claude_session_id 
ON chronicle_sessions(claude_session_id);

CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_project_path 
ON chronicle_sessions(project_path);

CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_start_time 
ON chronicle_sessions(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_events_session_timestamp 
ON chronicle_events(session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_events_type 
ON chronicle_events(event_type);

CREATE INDEX IF NOT EXISTS idx_chronicle_events_tool_name 
ON chronicle_events(tool_name) WHERE tool_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chronicle_events_metadata_gin 
ON chronicle_events USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_chronicle_events_timestamp 
ON chronicle_events(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE chronicle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for single-user deployment (allow all operations)
-- Note: In production, these would be more restrictive

-- Sessions policies
CREATE POLICY "Allow all operations on chronicle sessions" 
ON chronicle_sessions FOR ALL 
USING (true) 
WITH CHECK (true);

-- Events policies  
CREATE POLICY "Allow all operations on chronicle events" 
ON chronicle_events FOR ALL 
USING (true) 
WITH CHECK (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION chronicle_get_session_stats(session_uuid UUID)
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
        COUNT(*) FILTER (WHERE event_type IN ('pre_tool_use', 'post_tool_use')) as tool_events_count,
        COUNT(*) FILTER (WHERE event_type = 'user_prompt_submit') as prompt_events_count,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_tool_duration,
        EXTRACT(EPOCH FROM (
            COALESCE(
                (SELECT end_time FROM chronicle_sessions WHERE id = session_uuid),
                NOW()
            ) - (SELECT start_time FROM chronicle_sessions WHERE id = session_uuid)
        )) / 60 as session_duration_minutes
    FROM chronicle_events 
    WHERE session_id = session_uuid;
$$;

-- Function to get tool usage statistics
CREATE OR REPLACE FUNCTION chronicle_get_tool_usage_stats(time_window_hours INTEGER DEFAULT 24)
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
        -- Calculate success rate based on event metadata
        (COUNT(*) FILTER (WHERE (e.metadata->>'success')::boolean = true)::NUMERIC / COUNT(*)) * 100 as success_rate
    FROM chronicle_events e
    WHERE e.tool_name IS NOT NULL 
      AND e.created_at >= NOW() - INTERVAL '1 hour' * time_window_hours
      AND e.event_type IN ('pre_tool_use', 'post_tool_use')
    GROUP BY e.tool_name
    ORDER BY usage_count DESC;
$$;

-- Function to cleanup old sessions and events
CREATE OR REPLACE FUNCTION chronicle_cleanup_old_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE SQL
AS $$
    WITH deleted_sessions AS (
        DELETE FROM chronicle_sessions 
        WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
        AND end_time IS NOT NULL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER FROM deleted_sessions;
$$;

-- Trigger to automatically set end_time when session is marked as ended
CREATE OR REPLACE FUNCTION chronicle_update_session_end_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only update end_time if this is an actual session termination stop event
    -- AND the event contains a flag indicating intentional session end
    IF NEW.event_type = 'stop' AND 
       (NEW.metadata->>'session_termination')::boolean = true THEN
        UPDATE chronicle_sessions 
        SET end_time = NEW.timestamp 
        WHERE id = NEW.session_id 
        AND end_time IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_chronicle_update_session_end_time
    AFTER INSERT ON chronicle_events
    FOR EACH ROW
    EXECUTE FUNCTION chronicle_update_session_end_time();

-- Trigger to validate event data structure
CREATE OR REPLACE FUNCTION chronicle_validate_event_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ensure session exists
    IF NOT EXISTS (SELECT 1 FROM chronicle_sessions WHERE id = NEW.session_id) THEN
        RAISE EXCEPTION 'Session % does not exist', NEW.session_id;
    END IF;
    
    -- Validate tool events have tool_name
    IF NEW.event_type IN ('pre_tool_use', 'post_tool_use') AND NEW.tool_name IS NULL THEN
        RAISE EXCEPTION 'Tool events must have a tool_name';
    END IF;
    
    -- Validate timestamp is not in future
    IF NEW.timestamp > NOW() + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'Event timestamp cannot be in the future';
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_chronicle_validate_event_data
    BEFORE INSERT ON chronicle_events
    FOR EACH ROW
    EXECUTE FUNCTION chronicle_validate_event_data();

-- View for active sessions with event counts
CREATE OR REPLACE VIEW chronicle_active_sessions AS
SELECT 
    s.*,
    COUNT(e.id) as event_count,
    COUNT(e.id) FILTER (WHERE e.event_type IN ('pre_tool_use', 'post_tool_use')) as tool_event_count,
    COUNT(e.id) FILTER (WHERE e.event_type = 'user_prompt_submit') as prompt_event_count,
    MAX(e.timestamp) as last_activity
FROM chronicle_sessions s
LEFT JOIN chronicle_events e ON s.id = e.session_id
WHERE s.end_time IS NULL
GROUP BY s.id, s.claude_session_id, s.project_path, s.git_branch, s.start_time, s.end_time, s.created_at
ORDER BY s.start_time DESC;

-- View for recent events with session context
CREATE OR REPLACE VIEW chronicle_recent_events AS
SELECT 
    e.*,
    s.claude_session_id,
    s.project_path,
    s.git_branch
FROM chronicle_events e
JOIN chronicle_sessions s ON e.session_id = s.id
WHERE e.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY e.timestamp DESC;

-- Grant necessary permissions for real-time subscriptions
GRANT SELECT ON chronicle_sessions TO anon;
GRANT SELECT ON chronicle_events TO anon;
GRANT SELECT ON chronicle_active_sessions TO anon;
GRANT SELECT ON chronicle_recent_events TO anon;

-- Grant full access to authenticated users (for single-user deployment)
GRANT ALL ON chronicle_sessions TO authenticated;
GRANT ALL ON chronicle_events TO authenticated;
GRANT EXECUTE ON FUNCTION chronicle_get_session_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chronicle_get_tool_usage_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION chronicle_cleanup_old_data(INTEGER) TO authenticated;