#!/usr/bin/env python3
"""Manual test of hook execution with debug output."""

import json
import subprocess
import sys
from pathlib import Path

def test_manual_hook():
    """Test hook execution manually with detailed output."""
    
    hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
    hook_script = hooks_dir / 'user_prompt_submit_uv.py'
    
    if not hook_script.exists():
        print(f"❌ Hook script not found: {hook_script}")
        return False
    
    # Test data that mimics what Claude Code sends
    test_data = {
        "sessionId": "debug-test-session-123",
        "prompt": "This is a test prompt for debugging",
        "hookEventName": "UserPromptSubmit",
        "transcriptPath": "/tmp/test-transcript.jsonl",
        "cwd": str(Path.cwd())
    }
    
    print(f"Testing hook: {hook_script}")
    print(f"Input data: {json.dumps(test_data, indent=2)}")
    print("-" * 50)
    
    try:
        # Run the hook with input data
        result = subprocess.run(
            ["uv", "run", str(hook_script)],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(hooks_dir)
        )
        
        print(f"Return code: {result.returncode}")
        print(f"STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")
        
        # Try to parse output
        if result.stdout.strip():
            try:
                output = json.loads(result.stdout)
                print(f"Parsed output: {json.dumps(output, indent=2)}")
                
                # Check if it reports success
                hook_output = output.get('hookSpecificOutput', {})
                event_saved = hook_output.get('eventSaved', False)
                print(f"\nEvent saved to database: {event_saved}")
                
                return result.returncode == 0 and event_saved
            except json.JSONDecodeError as e:
                print(f"❌ Could not parse JSON output: {e}")
                return False
        else:
            print("❌ No output from hook")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Hook execution timed out")
        return False
    except Exception as e:
        print(f"❌ Error running hook: {e}")
        return False

if __name__ == "__main__":
    success = test_manual_hook()
    print(f"\nManual hook test: {'PASSED' if success else 'FAILED'}")
    sys.exit(0 if success else 1)