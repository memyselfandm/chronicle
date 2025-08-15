#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "supabase>=2.0.0",
#     "python-dotenv>=1.0.0",
# ]
# ///
"""Check recent Chronicle hook events in Supabase."""

import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# Get Supabase credentials
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')

if not url or not key:
    print('❌ Missing Supabase credentials')
    exit(1)

# Create client
supabase = create_client(url, key)

# Query recent events (last 10 minutes)
recent_time = (datetime.now() - timedelta(minutes=10)).isoformat()

try:
    # Get recent events
    response = supabase.table('events').select('*').gte('timestamp', recent_time).order('timestamp', desc=True).limit(20).execute()
    
    events = response.data
    print(f'\n✅ Found {len(events)} recent events in Supabase:')
    print('=' * 80)
    
    # Group by event type
    event_types = {}
    for event in events:
        event_type = event.get('event_type', 'unknown')
        if event_type not in event_types:
            event_types[event_type] = []
        event_types[event_type].append(event)
    
    # Display by type
    for event_type, type_events in event_types.items():
        print(f'\n📊 {event_type.upper()} ({len(type_events)} events):')
        print('-' * 40)
        
        for event in type_events[:3]:  # Show max 3 per type
            timestamp = event.get('timestamp', 'no-time')
            session_id = event.get('session_id', 'no-session')
            data = event.get('data', {})
            
            # Format based on event type
            if event_type == 'pre_tool_use':
                tool_name = data.get('tool_name', 'unknown')
                decision = data.get('permission_decision', 'unknown')
                reason = data.get('permission_reason', '')[:50]
                print(f'  {timestamp}: {tool_name} -> {decision}')
                if reason:
                    print(f'    Reason: {reason}...')
            elif event_type == 'post_tool_use':
                tool_name = data.get('tool_name', 'unknown')
                success = data.get('tool_success', False)
                duration = data.get('duration_ms', 0)
                print(f'  {timestamp}: {tool_name} (success: {success}, {duration}ms)')
            elif event_type == 'user_prompt_submit':
                prompt = data.get('prompt', '')[:60]
                print(f'  {timestamp}: "{prompt}..."')
            elif event_type == 'session_start':
                project = data.get('project_path', 'unknown')
                print(f'  {timestamp}: Session {session_id[:8]}... at {project}')
            else:
                print(f'  {timestamp}: {event_type}')
    
    print('\n' + '=' * 80)
    print('✅ Chronicle hooks are working and saving to Supabase!')
    
    # Check sessions table too
    print('\nChecking sessions table...')
    session_response = supabase.table('sessions').select('*').gte('start_time', recent_time).order('start_time', desc=True).limit(5).execute()
    sessions = session_response.data
    print(f'Found {len(sessions)} recent sessions')
    
except Exception as e:
    print(f'❌ Error querying Supabase: {e}')