-- Fix Supabase Schema for Chronicle Hooks
-- This adds missing columns to match what the hooks expect

-- Add missing columns to chronicle_sessions
ALTER TABLE chronicle_sessions 
ADD COLUMN IF NOT EXISTS git_commit TEXT,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to chronicle_events
ALTER TABLE chronicle_events 
ADD COLUMN IF NOT EXISTS hook_event_name TEXT,
ADD COLUMN IF NOT EXISTS data JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chronicle_events_session ON chronicle_events(session_id);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_type ON chronicle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_timestamp ON chronicle_events(timestamp);

-- Verify the schema
-- Check chronicle_sessions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chronicle_sessions' 
ORDER BY ordinal_position;

-- Check chronicle_events columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chronicle_events' 
ORDER BY ordinal_position;