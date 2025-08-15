#!/usr/bin/env python3
"""
Direct Supabase Query Script

This script directly queries your Supabase database to check what data is there.
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Add the chronicle modules to Python path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "hooks" / "src" / "hooks" / "uv_scripts"))

# Import the database manager
from database_manager import DatabaseManager

def check_supabase_tables():
    """Check what's in the Supabase tables."""
    print("🔍 Checking Supabase Database")
    print("=" * 60)
    
    # Initialize database manager
    db = DatabaseManager()
    
    # Get database status
    status = db.get_connection_status()
    print(f"\n📊 Database Status:")
    print(f"  Supabase Available: {status.get('supabase_available', False)}")
    print(f"  Supabase Connected: {status.get('supabase_connected', False)}")
    print(f"  SQLite Path: {status.get('sqlite_path', 'unknown')}")
    print(f"  SQLite Exists: {status.get('sqlite_exists', False)}")
    
    # Check chronicle_sessions table 
    print("\n📋 Checking chronicle_sessions table:")
    try:
        if db.supabase_client:
            # First check table structure
            try:
                result = db.supabase_client.table('chronicle_sessions').select('*').limit(1).execute()
                if result.data and len(result.data) > 0:
                    print("  Table columns:", list(result.data[0].keys()))
            except Exception as e:
                print(f"  Could not get table structure: {e}")
            
            result = db.supabase_client.table('chronicle_sessions').select('*').limit(5).order('created_at', desc=True).execute()
            sessions = result.data if hasattr(result, 'data') else []
        else:
            # SQLite fallback
            import sqlite3
            with sqlite3.connect(str(db.sqlite_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5")
                sessions = [dict(row) for row in cursor.fetchall()]
        
        if sessions:
            print(f"  Found {len(sessions)} recent sessions:")
            for session in sessions:
                print(f"    - Session {session.get('id', 'unknown')[:8]}... "
                      f"created at {session.get('created_at', 'unknown')}")
        else:
            print("  ❌ No sessions found in database")
            
    except Exception as e:
        print(f"  ❌ Error querying sessions: {e}")
    
    # Check chronicle_events table
    print("\n📋 Checking chronicle_events table:")
    try:
        if db.supabase_client:
            # First check table structure
            try:
                result = db.supabase_client.table('chronicle_events').select('*').limit(1).execute()
                if result.data and len(result.data) > 0:
                    print("  Table columns:", list(result.data[0].keys()))
            except Exception as e:
                print(f"  Could not get table structure: {e}")
            
            # Supabase doesn't support GROUP BY in the same way, so get all events
            result = db.supabase_client.table('chronicle_events').select('event_type').execute()
            all_events = result.data if hasattr(result, 'data') else []
            # Count manually
            event_counts = {}
            for event in all_events:
                event_type = event.get('event_type', 'unknown')
                event_counts[event_type] = event_counts.get(event_type, 0) + 1
            events = [{'event_type': k, 'count': v} for k, v in sorted(event_counts.items(), key=lambda x: x[1], reverse=True)]
        else:
            # SQLite fallback
            import sqlite3
            with sqlite3.connect(str(db.sqlite_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type ORDER BY count DESC")
                events = [dict(row) for row in cursor.fetchall()]
        
        if events:
            print(f"  Event type distribution:")
            for event in events:
                print(f"    - {event.get('event_type', 'unknown')}: "
                      f"{event.get('count', 0)} events")
        else:
            print("  ❌ No events found in database")
            
    except Exception as e:
        print(f"  ❌ Error querying events: {e}")
    
    # Check recent events
    print("\n📋 Recent events (last 5):")
    try:
        if db.supabase_client:
            result = db.supabase_client.table('chronicle_events').select('*').limit(5).order('created_at', desc=True).execute()
            recent_events = result.data if hasattr(result, 'data') else []
        else:
            # SQLite fallback
            import sqlite3
            with sqlite3.connect(str(db.sqlite_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT event_type, hook_event_name, created_at FROM events ORDER BY created_at DESC LIMIT 5")
                recent_events = [dict(row) for row in cursor.fetchall()]
        
        if recent_events:
            for event in recent_events:
                print(f"    - {event.get('event_type', 'unknown')} "
                      f"({event.get('hook_event_name', 'unknown')}) "
                      f"at {event.get('created_at', 'unknown')}")
        else:
            print("  ❌ No recent events found")
            
    except Exception as e:
        print(f"  ❌ Error querying recent events: {e}")
    
    # Try to save a test event
    print("\n🧪 Testing database write:")
    try:
        test_event = {
            "event_type": "test",
            "hook_event_name": "DirectTest",
            "session_id": "test-direct-query",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {"test": True, "source": "check_supabase_data.py"}
        }
        
        success = db.save_event(test_event)
        if success:
            print("  ✅ Successfully wrote test event to database")
        else:
            print("  ❌ Failed to write test event")
            
    except Exception as e:
        print(f"  ❌ Error writing test event: {e}")
    
    # Check if using fallback
    print("\n🔄 Database fallback status:")
    if db.supabase_client:
        print("  ✅ Using primary Supabase database")
    else:
        print("  ⚠️  Using SQLite fallback database")
        print(f"  📁 SQLite path: {db.sqlite_path}")

def check_environment():
    """Check environment variables."""
    print("\n🔧 Environment Configuration:")
    print("=" * 60)
    
    env_vars = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "CLAUDE_PROJECT_DIR",
        "CLAUDE_SESSION_ID",
        "CHRONICLE_DB_TYPE"
    ]
    
    for var in env_vars:
        value = os.environ.get(var)
        if value:
            if "KEY" in var or "key" in var:
                # Mask sensitive values
                masked = value[:10] + "..." + value[-4:] if len(value) > 14 else "***"
                print(f"  {var}: {masked}")
            else:
                print(f"  {var}: {value}")
        else:
            print(f"  {var}: (not set)")

def check_sqlite_fallback():
    """Check if SQLite fallback has data."""
    print("\n💾 Checking SQLite fallback:")
    print("=" * 60)
    
    sqlite_path = Path.home() / ".claude" / "hooks" / "chronicle" / "data" / "chronicle.db"
    
    if sqlite_path.exists():
        print(f"  ✅ SQLite database exists: {sqlite_path}")
        
        # Try to query it directly
        try:
            import sqlite3
            conn = sqlite3.connect(str(sqlite_path))
            cursor = conn.cursor()
            
            # Check tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            print(f"  📋 Tables: {[t[0] for t in tables]}")
            
            # Count events
            try:
                cursor.execute("SELECT COUNT(*) FROM chronicle_events")
                count = cursor.fetchone()[0]
                print(f"  📊 Total events in SQLite: {count}")
            except:
                print("  ❌ Could not count events in SQLite")
            
            conn.close()
        except Exception as e:
            print(f"  ❌ Error querying SQLite: {e}")
    else:
        print(f"  ❌ SQLite database not found: {sqlite_path}")

def main():
    """Main function."""
    # Load environment from chronicle .env
    chronicle_env = Path.home() / ".claude" / "hooks" / "chronicle" / ".env"
    if chronicle_env.exists():
        from dotenv import load_dotenv
        load_dotenv(chronicle_env)
        print(f"✅ Loaded environment from: {chronicle_env}")
    else:
        print(f"⚠️  No .env file found at: {chronicle_env}")
    
    check_environment()
    check_supabase_tables()
    check_sqlite_fallback()
    
    print("\n" + "=" * 60)
    print("🏁 Check complete!")

if __name__ == "__main__":
    main()