-- Migration to fix session termination trigger for SQLite
-- Adds check for session_termination flag to prevent premature session ending
-- 
-- Issue: Database triggers were automatically setting end_time on sessions 
-- whenever ANY "stop" event was inserted, regardless of whether it was an 
-- actual session termination. This caused active sessions to disappear from 
-- the dashboard.
--
-- Solution: Only update end_time when the stop event contains a flag 
-- indicating intentional session termination.

DROP TRIGGER IF EXISTS trigger_update_session_end_time;

CREATE TRIGGER trigger_update_session_end_time
AFTER INSERT ON events
FOR EACH ROW
WHEN NEW.event_type = 'stop' AND 
     json_extract(NEW.data, '$.session_termination') = 1
BEGIN
    UPDATE sessions 
    SET end_time = NEW.timestamp 
    WHERE id = NEW.session_id 
    AND end_time IS NULL;
END;

-- Rollback script (commented out for safety):
-- To rollback this migration, uncomment the following lines:
--
-- DROP TRIGGER IF EXISTS trigger_update_session_end_time;
-- 
-- CREATE TRIGGER IF NOT EXISTS trigger_update_session_end_time
-- AFTER INSERT ON events
-- FOR EACH ROW
-- WHEN NEW.event_type = 'stop'
-- BEGIN
--     UPDATE sessions 
--     SET end_time = NEW.timestamp 
--     WHERE id = NEW.session_id 
--     AND end_time IS NULL;
-- END;