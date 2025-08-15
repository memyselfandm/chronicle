#!/usr/bin/env python3
"""Test hook with proper JSON input to verify stdin reading fix."""

import json
import subprocess
import os

# Test data that mimics what Claude Code would send
test_data = {
    "sessionId": "test-session-123",
    "hookEventName": "PreToolUse", 
    "toolName": "Read",
    "toolInput": {
        "file_path": "/test/file.txt"
    },
    "transcriptPath": "/tmp/test.jsonl",
    "cwd": os.getcwd()
}

# Path to the hook
hook_path = os.path.expanduser("~/.claude/hooks/chronicle/hooks/pre_tool_use_uv.py")

if not os.path.exists(hook_path):
    print(f"❌ Hook not found at: {hook_path}")
    exit(1)

print(f"Testing hook: {hook_path}")
print(f"Input data: {json.dumps(test_data, indent=2)}")
print("=" * 60)

# Run the hook with JSON input
try:
    result = subprocess.run(
        [hook_path],
        input=json.dumps(test_data),
        capture_output=True,
        text=True,
        timeout=5
    )
    
    print(f"Exit code: {result.returncode}")
    print(f"Stdout:\n{result.stdout}")
    if result.stderr:
        print(f"Stderr:\n{result.stderr}")
        
    # Try to parse the output as JSON
    if result.stdout:
        try:
            output_json = json.loads(result.stdout)
            print("\n✅ Hook returned valid JSON:")
            print(json.dumps(output_json, indent=2))
        except json.JSONDecodeError:
            print("\n⚠️  Hook output is not valid JSON")
            
except subprocess.TimeoutExpired:
    print("❌ Hook timed out after 5 seconds")
except Exception as e:
    print(f"❌ Error running hook: {e}")