#!/usr/bin/env python3
"""Test hook with debug environment variables."""

import json
import subprocess
import sys
import uuid
import os
from pathlib import Path

def test_hook_with_debug_env():
    """Test hook with debug logging enabled."""
    
    hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
    hook_script = hooks_dir / 'user_prompt_submit.py'
    
    # Test data
    test_data = {
        "sessionId": f"debug-test-{uuid.uuid4()}",
        "prompt": "Debug test prompt for Chronicle hooks",
        "hookEventName": "UserPromptSubmit"
    }
    
    print(f"Testing hook with debug logging")
    print(f"Hook: {hook_script}")
    print(f"Input: {json.dumps(test_data, indent=2)}")
    print("-" * 60)
    
    # Set debug environment
    env = os.environ.copy()
    env['CLAUDE_HOOKS_LOG_LEVEL'] = 'DEBUG'
    env['CLAUDE_HOOKS_DEBUG'] = 'true'
    
    try:
        result = subprocess.run(
            ["uv", "run", str(hook_script)],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(hooks_dir),
            env=env
        )
        
        print(f"Return code: {result.returncode}")
        print(f"STDOUT:\\n{result.stdout}")
        print(f"STDERR:\\n{result.stderr}")
        
        # Check if there are any error indicators in stderr
        if "error" in result.stderr.lower() or "exception" in result.stderr.lower():
            print("\\n❌ Errors detected in stderr")
        
        # Parse output
        if result.stdout.strip():
            try:
                output = json.loads(result.stdout)
                hook_output = output.get('hookSpecificOutput', {})
                
                print(f"\\n=== Hook Results ===")
                print(f"Event saved: {hook_output.get('eventSaved', 'unknown')}")
                print(f"Processing success: {hook_output.get('processingSuccess', 'unknown')}")
                print(f"Prompt blocked: {hook_output.get('promptBlocked', 'unknown')}")
                
                return hook_output.get('eventSaved', False)
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON output: {e}")
                return False
        else:
            print("❌ No output from hook")
            return False
        
    except subprocess.TimeoutExpired:
        print("❌ Hook execution timed out")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_hook_with_debug_env()
    print(f"\\nDebug hook test: {'PASSED' if success else 'FAILED'}")
    
    # Also check databases after test
    print("\\n=== Database Check ===")
    
    # Check Supabase
    try:
        result = subprocess.run(["uv", "run", "/Users/m/ai-workspace/chronicle/chronicle-dev/test_supabase_direct.py"], 
                              capture_output=True, text=True, timeout=10)
        if "chronicle_events: " in result.stdout:
            events_line = [line for line in result.stdout.split('\\n') if 'chronicle_events:' in line][0]
            print(f"Supabase: {events_line}")
    except:
        print("Supabase: Check failed")
    
    # Check SQLite  
    try:
        result = subprocess.run(["sqlite3", str(Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data' / 'chronicle.db'),
                               "SELECT COUNT(*) FROM events;"], capture_output=True, text=True)
        print(f"SQLite events: {result.stdout.strip()}")
    except:
        print("SQLite: Check failed")
    
    sys.exit(0 if success else 1)