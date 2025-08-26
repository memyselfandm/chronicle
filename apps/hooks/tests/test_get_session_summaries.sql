-- Test for get_session_summaries RPC function (CHR-83)
-- This test validates that the function returns correct aggregated data

-- Create test session
INSERT INTO chronicle_sessions (id, claude_session_id, project_path, git_branch, start_time)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'test_session_123',
    '/test/project',
    'test-branch',
    NOW() - INTERVAL '1 hour'
);

-- Create test events with different types
INSERT INTO chronicle_events (id, session_id, event_type, timestamp, metadata, duration_ms) VALUES
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'session_start', NOW() - INTERVAL '1 hour', '{}', NULL),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'user_prompt_submit', NOW() - INTERVAL '50 minutes', '{}', NULL),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'pre_tool_use', NOW() - INTERVAL '45 minutes', '{"tool": "bash"}', NULL),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'post_tool_use', NOW() - INTERVAL '44 minutes', '{"success": true}', 150),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'pre_tool_use', NOW() - INTERVAL '30 minutes', '{"tool": "read"}', NULL),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'post_tool_use', NOW() - INTERVAL '29 minutes', '{"success": true}', 200),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'error', NOW() - INTERVAL '20 minutes', '{"error": "test error"}', NULL),
    (uuid_generate_v4(), 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'post_tool_use', NOW() - INTERVAL '10 minutes', '{"success": false}', 300);

-- Test the function
SELECT * FROM get_session_summaries(ARRAY['f47ac10b-58cc-4372-a567-0e02b2c3d479']::UUID[]);

-- Expected results:
-- session_id: f47ac10b-58cc-4372-a567-0e02b2c3d479  
-- total_events: 8
-- tool_usage_count: 5 (3 pre_tool_use + 2 post_tool_use that have duration data)
-- error_count: 2 (1 error event + 1 post_tool_use with success=false)  
-- avg_response_time: 216.67 (average of 150, 200, 300 from post_tool_use events)

-- Cleanup test data
DELETE FROM chronicle_events WHERE session_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
DELETE FROM chronicle_sessions WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';