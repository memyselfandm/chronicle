#!/usr/bin/env python3
"""Test proper UUID format for Supabase."""

import uuid
import sys

def test_uuid_insert():
    """Test event insert with proper UUID."""
    try:
        from supabase import create_client
        import os
        
        supabase_url = os.getenv('SUPABASE_URL', 'https://supabase.svc.home.hellogre.sh')
        supabase_key = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzM5MTc0NDAwLAogICJleHAiOiAxODk2OTQwODAwCn0.TyiE5xJH-eSaO4HYKj7l2z_SPAy3k78vOjGMxYUW4ek')
        
        client = create_client(supabase_url, supabase_key)
        
        # Test with proper UUID
        test_event = {
            "id": str(uuid.uuid4()),
            "session_id": str(uuid.uuid4()), 
            "event_type": "test_event",
            "timestamp": "2025-08-15T04:00:00Z",
            "metadata": {"test": "data"}
        }
        
        print(f"Testing event with UUID: {test_event['id']}")
        
        try:
            result = client.table('chronicle_events').insert(test_event).execute()
            print("✅ Event insert with UUID successful!")
            print(f"   Result: {result.data}")
            return True
        except Exception as e:
            print(f"❌ Event insert still failed: {e}")
            if hasattr(e, 'json'):
                print(f"   Details: {e.json()}")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_uuid_insert()
    sys.exit(0 if success else 1)