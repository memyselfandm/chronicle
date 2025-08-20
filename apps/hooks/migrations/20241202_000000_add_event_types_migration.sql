-- Migration to add missing event types to Chronicle
-- This updates the event_type enum to support 1:1 mapping with hook events

-- First, we need to drop the existing constraint
ALTER TABLE chronicle_events 
DROP CONSTRAINT IF EXISTS chronicle_events_event_type_check;

-- Add new constraint with all event types
ALTER TABLE chronicle_events 
ADD CONSTRAINT chronicle_events_event_type_check 
CHECK (event_type IN (
    'prompt',           -- Legacy, can be removed later
    'tool_use',         -- Legacy, can be removed later
    'session_start',    -- SessionStart hook
    'session_end',      -- Legacy, not used
    'notification',     -- Notification hook
    'error',            -- Error events
    'pre_tool_use',     -- PreToolUse hook
    'post_tool_use',    -- PostToolUse hook
    'user_prompt_submit', -- UserPromptSubmit hook
    'stop',             -- Stop hook (when Claude finishes)
    'subagent_stop',    -- SubagentStop hook
    'pre_compact'       -- PreCompact hook
));

-- Note: In PostgreSQL with proper enum types, you would use:
-- ALTER TYPE event_type_enum ADD VALUE 'pre_tool_use';
-- ALTER TYPE event_type_enum ADD VALUE 'post_tool_use';
-- etc.
-- But since Supabase uses CHECK constraints, we update the constraint instead