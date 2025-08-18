-- Chronicle Event Types Migration
-- Converts old event types to new 1:1 mapping based on metadata.hook_event_name

-- Step 1: Drop the existing constraint to allow updates
ALTER TABLE chronicle_events 
DROP CONSTRAINT IF EXISTS chronicle_events_event_type_check;

-- Step 2: Convert existing events to new event types based on metadata.hook_event_name
-- This preserves the actual hook that generated the event

-- Convert tool_use events based on hook_event_name
UPDATE chronicle_events 
SET event_type = 'pre_tool_use'
WHERE event_type = 'tool_use' 
  AND metadata->>'hook_event_name' = 'PreToolUse';

UPDATE chronicle_events 
SET event_type = 'post_tool_use'
WHERE event_type = 'tool_use' 
  AND metadata->>'hook_event_name' = 'PostToolUse';

-- Convert any remaining tool_use events (fallback to post_tool_use if no hook_event_name)
UPDATE chronicle_events 
SET event_type = 'post_tool_use'
WHERE event_type = 'tool_use';

-- Convert prompt events to user_prompt_submit
UPDATE chronicle_events 
SET event_type = 'user_prompt_submit'
WHERE event_type = 'prompt' 
  AND metadata->>'hook_event_name' = 'UserPromptSubmit';

-- Convert any remaining prompt events
UPDATE chronicle_events 
SET event_type = 'user_prompt_submit'
WHERE event_type = 'prompt';

-- Convert session_end events to stop
UPDATE chronicle_events 
SET event_type = 'stop'
WHERE event_type = 'session_end' 
  AND metadata->>'hook_event_name' = 'Stop';

-- Convert any remaining session_end events
UPDATE chronicle_events 
SET event_type = 'stop'
WHERE event_type = 'session_end';

-- Convert notification events that might be misclassified
-- Pre-compact events that were saved as notification
UPDATE chronicle_events 
SET event_type = 'pre_compact'
WHERE event_type = 'notification' 
  AND metadata->>'hook_event_name' = 'PreCompact';

-- Subagent stop events that were saved as notification
UPDATE chronicle_events 
SET event_type = 'subagent_stop'
WHERE event_type = 'notification' 
  AND metadata->>'hook_event_name' = 'SubagentStop';

-- PreToolUse events that were saved as notification (due to invalid type)
UPDATE chronicle_events 
SET event_type = 'pre_tool_use'
WHERE event_type = 'notification' 
  AND metadata->>'hook_event_name' = 'PreToolUse';

-- Step 3: Add the new constraint with only the new event types
ALTER TABLE chronicle_events 
ADD CONSTRAINT chronicle_events_event_type_check 
CHECK (event_type IN (
    'session_start',      -- SessionStart hook
    'notification',       -- Notification hook
    'error',             -- Error events
    'pre_tool_use',      -- PreToolUse hook
    'post_tool_use',     -- PostToolUse hook
    'user_prompt_submit', -- UserPromptSubmit hook
    'stop',              -- Stop hook (when Claude finishes)
    'subagent_stop',     -- SubagentStop hook
    'pre_compact'        -- PreCompact hook
));

-- Step 4: Report migration results
DO $$
DECLARE
    pre_tool_count INTEGER;
    post_tool_count INTEGER;
    prompt_count INTEGER;
    stop_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pre_tool_count FROM chronicle_events WHERE event_type = 'pre_tool_use';
    SELECT COUNT(*) INTO post_tool_count FROM chronicle_events WHERE event_type = 'post_tool_use';
    SELECT COUNT(*) INTO prompt_count FROM chronicle_events WHERE event_type = 'user_prompt_submit';
    SELECT COUNT(*) INTO stop_count FROM chronicle_events WHERE event_type = 'stop';
    SELECT COUNT(*) INTO total_count FROM chronicle_events;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Complete ===';
    RAISE NOTICE 'Total events: %', total_count;
    RAISE NOTICE 'PreToolUse events: %', pre_tool_count;
    RAISE NOTICE 'PostToolUse events: %', post_tool_count;
    RAISE NOTICE 'UserPromptSubmit events: %', prompt_count;
    RAISE NOTICE 'Stop events: %', stop_count;
    RAISE NOTICE '==========================';
END $$;