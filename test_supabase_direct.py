#!/usr/bin/env python3
"""Direct test of Supabase connection and schema."""

import sys
import json

def test_supabase():
    """Test Supabase connectivity and schema directly."""
    try:
        from supabase import create_client
        
        # Use environment values
        import os
        supabase_url = os.getenv('SUPABASE_URL', 'https://supabase.svc.home.hellogre.sh')
        supabase_key = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzM5MTc0NDAwLAogICJleHAiOiAxODk2OTQwODAwCn0.TyiE5xJH-eSaO4HYKj7l2z_SPAy3k78vOjGMxYUW4ek')
        
        print(f"Testing Supabase at: {supabase_url}")
        
        client = create_client(supabase_url, supabase_key)
        print("✅ Client created successfully")
        
        # Check if chronicle tables exist
        print("\n=== Testing Table Access ===")
        
        # Test chronicle_sessions
        try:
            result = client.table('chronicle_sessions').select('*').limit(1).execute()
            print(f"✅ chronicle_sessions: {len(result.data)} rows found")
            if result.data:
                print(f"   Sample: {result.data[0]}")
        except Exception as e:
            print(f"❌ chronicle_sessions error: {e}")
        
        # Test chronicle_events 
        try:
            result = client.table('chronicle_events').select('*').limit(1).execute()
            print(f"✅ chronicle_events: {len(result.data)} rows found")
            if result.data:
                print(f"   Sample: {result.data[0]}")
        except Exception as e:
            print(f"❌ chronicle_events error: {e}")
        
        # Test inserting a simple event
        print("\n=== Testing Event Insert ===")
        test_event = {
            "id": "test-event-123",
            "session_id": "test-session-123", 
            "event_type": "test_event",
            "timestamp": "2025-08-15T04:00:00Z",
            "metadata": {"test": "data"}
        }
        
        try:
            result = client.table('chronicle_events').insert(test_event).execute()
            print("✅ Event insert successful")
            print(f"   Result: {result.data}")
        except Exception as e:
            print(f"❌ Event insert failed: {e}")
            # Try to get more details
            print(f"   Error type: {type(e)}")
            if hasattr(e, 'response'):
                print(f"   Response: {e.response}")
        
        return True
        
    except ImportError:
        print("❌ Supabase module not available")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_supabase()
    sys.exit(0 if success else 1)