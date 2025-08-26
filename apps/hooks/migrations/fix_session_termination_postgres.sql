-- Migration to fix session termination trigger
-- Adds check for session_termination flag to prevent premature session ending
-- 
-- Issue: Database triggers were automatically setting end_time on sessions 
-- whenever ANY "stop" event was inserted, regardless of whether it was an 
-- actual session termination. This caused active sessions to disappear from 
-- the dashboard.
--
-- Solution: Only update end_time when the stop event contains a flag 
-- indicating intentional session termination.

DROP TRIGGER IF EXISTS trigger_chronicle_update_session_end_time ON chronicle_events;

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

-- Rollback script (commented out for safety):
-- To rollback this migration, uncomment the following lines:
--
-- DROP TRIGGER IF EXISTS trigger_chronicle_update_session_end_time ON chronicle_events;
-- 
-- CREATE OR REPLACE FUNCTION chronicle_update_session_end_time()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     -- If this is a stop event (session ends), update the session's end_time
--     IF NEW.event_type = 'stop' THEN
--         UPDATE chronicle_sessions 
--         SET end_time = NEW.timestamp 
--         WHERE id = NEW.session_id 
--         AND end_time IS NULL;
--     END IF;
--     
--     RETURN NEW;
-- END;
-- $$;
-- 
-- CREATE TRIGGER trigger_chronicle_update_session_end_time
--     AFTER INSERT ON chronicle_events
--     FOR EACH ROW
--     EXECUTE FUNCTION chronicle_update_session_end_time();