-- Check what columns actually exist in your Supabase tables

-- Check chronicle_sessions columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'chronicle_sessions' 
ORDER BY ordinal_position;

-- Check chronicle_events columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'chronicle_events' 
ORDER BY ordinal_position;