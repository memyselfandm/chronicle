#!/usr/bin/env python3
"""Debug hook database save operation."""

import sys
import os
import json
from pathlib import Path

# Add the hooks directory to Python path so we can import
hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
sys.path.insert(0, str(hooks_dir))

# Change to hooks directory for proper environment loading
os.chdir(str(hooks_dir))

def debug_database_save():
    """Debug the database save operation directly."""
    try:
        # Import database manager from hooks directory  
        from database_manager import DatabaseManager
        from env_loader import load_chronicle_env
        
        # Load environment
        load_chronicle_env()
        
        # Create database manager
        db = DatabaseManager()
        
        print("=== Database Manager Debug ===")
        status = db.get_connection_status()
        for key, value in status.items():
            print(f"{key}: {value}")
        
        # Create test session first
        test_session = {
            "claude_session_id": "debug-session-123",
            "start_time": "2025-08-15T04:10:00Z",
            "project_path": str(Path.cwd()),
            "source": "debug_test"
        }
        
        success, session_id = db.save_session(test_session)
        print(f"\nSession save: {'SUCCESS' if success else 'FAILED'}")
        print(f"Session ID: {session_id}")
        
        if not success:
            print("❌ Cannot test event save without session")
            return False
        
        # Now test event save with proper event type
        test_event = {
            "session_id": session_id,
            "event_type": "prompt",  # Valid event type from schema
            "timestamp": "2025-08-15T04:10:00Z",
            "data": {
                "prompt": "Test prompt for debug",
                "hook_event_name": "UserPromptSubmit",
                "intent": "general"
            }
        }
        
        print(f"\nTesting event save with data: {json.dumps(test_event, indent=2)}")
        
        event_success = db.save_event(test_event)
        print(f"Event save: {'SUCCESS' if event_success else 'FAILED'}")
        
        return event_success
        
    except Exception as e:
        print(f"❌ Debug error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = debug_database_save()
    print(f"\nDebug result: {'PASSED' if success else 'FAILED'}")
    sys.exit(0 if success else 1)