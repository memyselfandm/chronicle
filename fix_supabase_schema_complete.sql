-- Complete Supabase Schema for Chronicle Hooks
-- This creates/updates ALL required tables to match what the hooks expect

-- 1. Sessions table (already exists, just adding missing columns)
ALTER TABLE chronicle_sessions 
ADD COLUMN IF NOT EXISTS git_commit TEXT,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Events table (already exists, just adding missing columns)
ALTER TABLE chronicle_events 
ADD COLUMN IF NOT EXISTS hook_event_name TEXT,
ADD COLUMN IF NOT EXISTS data JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Tool events table (specialized for tool usage tracking)
CREATE TABLE IF NOT EXISTS chronicle_tool_events (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES chronicle_sessions(id),
    event_id TEXT REFERENCES chronicle_events(id),
    tool_name TEXT NOT NULL,
    tool_type TEXT,
    phase TEXT CHECK (phase IN ('pre', 'post')),
    parameters JSONB,
    result JSONB,
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Prompt events table (specialized for prompt tracking)
CREATE TABLE IF NOT EXISTS chronicle_prompt_events (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES chronicle_sessions(id),
    event_id TEXT REFERENCES chronicle_events(id),
    prompt_text TEXT,
    prompt_length INTEGER,
    complexity_score REAL,
    intent_classification TEXT,
    context_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chronicle_events_session ON chronicle_events(session_id);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_type ON chronicle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_timestamp ON chronicle_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_chronicle_tool_events_session ON chronicle_tool_events(session_id);
CREATE INDEX IF NOT EXISTS idx_chronicle_prompt_events_session ON chronicle_prompt_events(session_id);

-- 6. Enable RLS and create policies
ALTER TABLE chronicle_tool_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_prompt_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon role (adjust as needed for security)
CREATE POLICY "Allow all for chronicle_tool_events" ON chronicle_tool_events
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for chronicle_prompt_events" ON chronicle_prompt_events
FOR ALL USING (true) WITH CHECK (true);

-- 7. Verify the complete schema
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name LIKE 'chronicle_%'
GROUP BY table_name
ORDER BY table_name;