#!/usr/bin/env python3
"""Test event insert with existing session."""

import uuid
import sys

def test_with_existing_session():
    """Test event insert with existing session ID."""
    try:
        from supabase import create_client
        import os
        
        supabase_url = os.getenv('SUPABASE_URL', 'https://supabase.svc.home.hellogre.sh')
        supabase_key = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzM5MTc0NDAwLAogICJleHAiOiAxODk2OTQwODAwCn0.TyiE5xJH-eSaO4HYKj7l2z_SPAy3k78vOjGMxYUW4ek')
        
        client = create_client(supabase_url, supabase_key)
        
        # Get existing session from earlier test
        existing_session_id = "03f6c40c-0650-4ad2-9046-3ad2d29a0d1f"
        
        # Test with existing session ID
        test_event = {
            "id": str(uuid.uuid4()),
            "session_id": existing_session_id, 
            "event_type": "test_event",
            "timestamp": "2025-08-15T04:00:00Z",
            "metadata": {"test": "data", "hook_event_name": "TestEvent"}
        }
        
        print(f"Testing event with existing session: {existing_session_id}")
        
        try:
            result = client.table('chronicle_events').insert(test_event).execute()
            print("✅ Event insert successful!")
            print(f"   Result: {result.data}")
            
            # Check total events now
            count_result = client.table('chronicle_events').select('*', count='exact').execute()
            print(f"   Total events in DB: {len(count_result.data)}")
            
            return True
        except Exception as e:
            print(f"❌ Event insert failed: {e}")
            if hasattr(e, 'json'):
                print(f"   Details: {e.json()}")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_with_existing_session()
    sys.exit(0 if success else 1)