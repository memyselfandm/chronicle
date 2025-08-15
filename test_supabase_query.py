#!/usr/bin/env python3
"""
Test script to query Chronicle data from Supabase.
Shows last 5 sessions and events to verify data flow.
"""

import os
import sys
from pathlib import Path

# Add the hooks source directory to Python path to import modules
hooks_src = Path(__file__).parent / "apps" / "hooks" / "src" / "hooks" / "uv_scripts"
sys.path.insert(0, str(hooks_src))

try:
    from env_loader import load_chronicle_env, get_database_config
    from supabase import create_client
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you have supabase-py installed: pip install supabase")
    sys.exit(1)

def test_supabase_connection():
    """Test Supabase connection and query data."""
    print("🔍 Testing Chronicle Supabase Connection")
    print("=" * 50)
    
    # Load environment
    load_chronicle_env()
    config = get_database_config()
    
    supabase_url = config.get('supabase_url')
    supabase_key = config.get('supabase_key')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print(f"   URL: {'✓' if supabase_url else '✗'}")
        print(f"   Key: {'✓' if supabase_key else '✗'}")
        return
    
    try:
        # Create Supabase client
        supabase = create_client(supabase_url, supabase_key)
        print(f"✅ Connected to Supabase: {supabase_url}")
        
        # Test sessions table
        print("\n📊 Chronicle Sessions (Last 5)")
        print("-" * 30)
        
        try:
            sessions_result = supabase.table("chronicle_sessions").select("*").order("created_at", desc=True).limit(5).execute()
            
            if sessions_result.data:
                print(f"Found {len(sessions_result.data)} sessions:")
                for i, session in enumerate(sessions_result.data, 1):
                    print(f"  {i}. ID: {session.get('id')}")
                    print(f"     Claude Session ID: {session.get('claude_session_id')}")
                    print(f"     Project: {session.get('project_path')}")
                    print(f"     Branch: {session.get('git_branch')}")
                    print(f"     Created: {session.get('created_at')}")
                    print(f"     Metadata: {session.get('metadata', {})}")
                    print()
            else:
                print("   No sessions found")
                
        except Exception as e:
            print(f"   ❌ Error querying sessions: {e}")
        
        # Test events table
        print("\n📊 Chronicle Events (Last 5)")
        print("-" * 30)
        
        try:
            events_result = supabase.table("chronicle_events").select("*").order("created_at", desc=True).limit(5).execute()
            
            if events_result.data:
                print(f"Found {len(events_result.data)} events:")
                for i, event in enumerate(events_result.data, 1):
                    print(f"  {i}. ID: {event.get('id')}")
                    print(f"     Session ID: {event.get('session_id')}")
                    print(f"     Event Type: {event.get('event_type')}")
                    print(f"     Tool Name: {event.get('tool_name')}")
                    print(f"     Created: {event.get('created_at')}")
                    print(f"     Metadata: {event.get('metadata', {})}")
                    print()
            else:
                print("   No events found")
                
        except Exception as e:
            print(f"   ❌ Error querying events: {e}")
        
        # Summary statistics
        print("\n📈 Database Summary")
        print("-" * 20)
        
        try:
            # Count sessions
            sessions_count = supabase.table("chronicle_sessions").select("id", count="exact").execute()
            print(f"Total Sessions: {sessions_count.count}")
            
            # Count events
            events_count = supabase.table("chronicle_events").select("id", count="exact").execute()
            print(f"Total Events: {events_count.count}")
            
            # Count events by type
            events_by_type = supabase.table("chronicle_events").select("event_type", count="exact").execute()
            if events_by_type.data:
                print("\nEvents by Type:")
                event_types = {}
                for event in events_by_type.data:
                    event_type = event.get('event_type', 'unknown')
                    event_types[event_type] = event_types.get(event_type, 0) + 1
                
                for event_type, count in event_types.items():
                    print(f"  {event_type}: {count}")
            
        except Exception as e:
            print(f"   ❌ Error getting summary: {e}")
            
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")

def test_sqlite_database():
    """Test SQLite database as comparison."""
    print("\n🗄️  Testing Local SQLite Database")
    print("=" * 40)
    
    import sqlite3
    
    sqlite_path = Path.home() / ".claude" / "hooks" / "chronicle" / "data" / "chronicle.db"
    
    if not sqlite_path.exists():
        print("   No SQLite database found")
        return
    
    try:
        with sqlite3.connect(str(sqlite_path)) as conn:
            conn.row_factory = sqlite3.Row
            
            # Check sessions
            cursor = conn.execute("SELECT COUNT(*) as count FROM sessions")
            sessions_count = cursor.fetchone()['count']
            print(f"SQLite Sessions: {sessions_count}")
            
            # Check events  
            cursor = conn.execute("SELECT COUNT(*) as count FROM events")
            events_count = cursor.fetchone()['count']
            print(f"SQLite Events: {events_count}")
            
            if sessions_count > 0:
                print("\nLast SQLite Session:")
                cursor = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1")
                session = cursor.fetchone()
                if session:
                    print(f"  ID: {session['id']}")
                    print(f"  Claude Session ID: {session['claude_session_id']}")
                    print(f"  Metadata: {session['metadata']}")
            
            if events_count > 0:
                print("\nLast SQLite Event:")
                cursor = conn.execute("SELECT * FROM events ORDER BY created_at DESC LIMIT 1")
                event = cursor.fetchone()
                if event:
                    print(f"  ID: {event['id']}")
                    print(f"  Session ID: {event['session_id']}")
                    print(f"  Event Type: {event['event_type']}")
                    print(f"  Metadata: {event['metadata']}")
                    
    except Exception as e:
        print(f"   ❌ Error querying SQLite: {e}")

if __name__ == "__main__":
    test_supabase_connection()
    test_sqlite_database()
    
    print("\n🎯 Next Steps:")
    print("1. Check if sessions are being created")
    print("2. Verify session_id is being passed to events") 
    print("3. Monitor hook logs: tail -f ~/.claude/hooks/chronicle/logs/chronicle.log")
    print("4. Restart Claude Code and test with some prompts")