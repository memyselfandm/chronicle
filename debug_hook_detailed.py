#!/usr/bin/env python3
"""Detailed debug of hook execution."""

import json
import subprocess
import sys
import uuid
from pathlib import Path

def test_hook_with_debug():
    """Test hook with detailed debug output."""
    
    hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
    hook_script = hooks_dir / 'user_prompt_submit_uv.py'
    
    # Create a modified version of the hook with debug logging
    debug_hook_content = f'''#!/usr/bin/env -S uv run
# Debug version of user_prompt_submit_uv.py

import json
import os
import sys
from datetime import datetime
from pathlib import Path
import uuid

# Add hooks directory to path
sys.path.insert(0, "{hooks_dir}")

# Import the real modules
from database_manager import DatabaseManager  
from env_loader import load_chronicle_env

# Load environment
load_chronicle_env()

def debug_hook():
    """Debug version of the hook."""
    try:
        # Read input
        input_data = json.loads(sys.stdin.read())
        
        # Create database manager  
        db = DatabaseManager()
        
        # Get connection status
        status = db.get_connection_status()
        print(f"DEBUG: DB Status = {{status}}", file=sys.stderr)
        
        # Extract session ID
        claude_session_id = input_data.get("sessionId", "debug-session-" + str(uuid.uuid4()))
        print(f"DEBUG: Claude Session ID = {{claude_session_id}}", file=sys.stderr)
        
        # Ensure session exists
        session_data = {{
            "claude_session_id": claude_session_id,
            "start_time": datetime.now().isoformat(),
            "project_path": os.getcwd()
        }}
        
        session_success, session_uuid = db.save_session(session_data)
        print(f"DEBUG: Session save = {{session_success}}, UUID = {{session_uuid}}", file=sys.stderr)
        
        if session_success and session_uuid:
            # Create event data
            event_data = {{
                "session_id": session_uuid,
                "event_type": "prompt",
                "timestamp": datetime.now().isoformat(),
                "data": {{
                    "prompt_text": input_data.get("prompt", "Test prompt"),
                    "hook_event_name": "UserPromptSubmit",
                    "intent": "general"
                }}
            }}
            
            print(f"DEBUG: Event data = {{json.dumps(event_data)}}", file=sys.stderr)
            
            # Try to save event
            event_success = db.save_event(event_data)
            print(f"DEBUG: Event save = {{event_success}}", file=sys.stderr)
        else:
            event_success = False
            print("DEBUG: Skipping event save - no session", file=sys.stderr)
        
        # Return response
        response = {{
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {{
                "hookEventName": "UserPromptSubmit",
                "eventSaved": event_success,
                "sessionCreated": session_success,
                "debug": True
            }}
        }}
        
        print(json.dumps(response))
        
    except Exception as e:
        print(f"DEBUG: Error = {{e}}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Return error response
        response = {{
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {{
                "hookEventName": "UserPromptSubmit",
                "eventSaved": False,
                "error": str(e)
            }}
        }}
        print(json.dumps(response))

if __name__ == "__main__":
    debug_hook()
'''
    
    # Write debug hook to temp file
    debug_hook_file = Path("/tmp/debug_hook.py")
    with open(debug_hook_file, 'w') as f:
        f.write(debug_hook_content)
    
    debug_hook_file.chmod(0o755)
    
    # Test data
    test_data = {
        "sessionId": f"debug-test-{uuid.uuid4()}",
        "prompt": "Debug test prompt for Chronicle hooks",
        "hookEventName": "UserPromptSubmit"
    }
    
    print(f"Testing debug hook with: {json.dumps(test_data, indent=2)}")
    print("-" * 60)
    
    try:
        result = subprocess.run(
            ["python3", str(debug_hook_file)],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"Return code: {result.returncode}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        
        # Parse output
        if result.stdout.strip():
            try:
                output = json.loads(result.stdout)
                hook_output = output.get('hookSpecificOutput', {})
                print(f"\\nParsed Results:")
                print(f"  Event saved: {hook_output.get('eventSaved', False)}")
                print(f"  Session created: {hook_output.get('sessionCreated', False)}")
                return hook_output.get('eventSaved', False)
            except:
                print("Failed to parse output")
                return False
        
        return False
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        # Cleanup
        if debug_hook_file.exists():
            debug_hook_file.unlink()

if __name__ == "__main__":
    success = test_hook_with_debug()
    print(f"\\nDebug hook test: {'PASSED' if success else 'FAILED'}")
    sys.exit(0 if success else 1)