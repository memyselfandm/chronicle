#!/usr/bin/env python3
"""
Integration test for PreToolUse hook observability.
Demonstrates the hook logging events without interfering with Claude's permissions.
"""

import json
import subprocess
import sys
import tempfile
import os

def test_hook_integration():
    """Test the hook with realistic Claude Code scenarios."""
    
    test_cases = [
        {
            "name": "Allow documentation reading",
            "input": {
                "tool_name": "Read",
                "tool_input": {"file_path": "/project/README.md"},
                "session_id": "test-session-123",
                "hook_event_name": "PreToolUse",
                "cwd": "/project"
            },
            "should_continue": True
        },
        {
            "name": "Allow sensitive file access (Chronicle doesn't block)",
            "input": {
                "tool_name": "Read", 
                "tool_input": {"file_path": ".env"},
                "session_id": "test-session-123",
                "hook_event_name": "PreToolUse",
                "cwd": "/project"
            },
            "should_continue": True
        },
        {
            "name": "Allow critical file modification",
            "input": {
                "tool_name": "Edit",
                "tool_input": {"file_path": "package.json", "old_string": '"version": "1.0.0"', "new_string": '"version": "1.1.0"'},
                "session_id": "test-session-123", 
                "hook_event_name": "PreToolUse",
                "cwd": "/project"
            },
            "should_continue": True
        },
        {
            "name": "Allow even dangerous bash commands (Claude handles permissions)",
            "input": {
                "tool_name": "Bash",
                "tool_input": {"command": "rm -rf /tmp/test"},
                "session_id": "test-session-123",
                "hook_event_name": "PreToolUse", 
                "cwd": "/project"
            },
            "should_continue": True
        },
        {
            "name": "Allow MCP tool execution",
            "input": {
                "tool_name": "mcp__linear__list_issues",
                "tool_input": {"team": "test-team"},
                "session_id": "test-session-123",
                "hook_event_name": "PreToolUse",
                "cwd": "/project" 
            },
            "should_continue": True
        }
    ]
    
    print("🧪 Running PreToolUse Hook Observability Integration Tests")
    print("=" * 60)
    
    hook_script = os.path.join(os.path.dirname(__file__), "src", "hooks", "pre_tool_use.py")
    
    passed = 0
    failed = 0
    
    for test_case in test_cases:
        print(f"\n📋 Test: {test_case['name']}")
        
        try:
            # Run the hook script with the test input
            result = subprocess.run(
                ["python", hook_script],
                input=json.dumps(test_case["input"]),
                text=True,
                capture_output=True,
                timeout=10
            )
            
            if result.returncode != 0:
                print(f"❌ FAILED - Hook script exited with code {result.returncode}")
                if result.stderr:
                    print(f"   Error: {result.stderr}")
                failed += 1
                continue
                
            # Parse the hook response
            try:
                response = json.loads(result.stdout)
            except json.JSONDecodeError as e:
                print(f"❌ FAILED - Invalid JSON response: {e}")
                print(f"   Raw output: {result.stdout}")
                failed += 1
                continue
            
            # Validate response structure
            required_fields = ["continue", "suppressOutput", "hookSpecificOutput"]
            if not all(field in response for field in required_fields):
                print(f"❌ FAILED - Missing required response fields")
                print(f"   Response: {response}")
                failed += 1
                continue
                
            hook_output = response["hookSpecificOutput"]
            if "hookEventName" not in hook_output:
                print(f"❌ FAILED - Missing hookEventName in hookSpecificOutput")
                print(f"   Hook output: {hook_output}")
                failed += 1
                continue
            
            # Check that execution continues
            if response["continue"] != test_case["should_continue"]:
                print(f"❌ FAILED - Expected continue={test_case['should_continue']}, got {response['continue']}")
                failed += 1
                continue
            
            # Check that output is suppressed (Chronicle doesn't interfere)
            if not response["suppressOutput"]:
                print(f"❌ FAILED - Expected suppressOutput=True (no interference), got False")
                failed += 1
                continue
                
            # Success!
            print(f"✅ PASSED - Tool execution allowed")
            print(f"   Event saved: {hook_output.get('eventSaved', 'unknown')}")
            passed += 1
            
        except subprocess.TimeoutExpired:
            print(f"❌ FAILED - Hook timed out")
            failed += 1
        except Exception as e:
            print(f"❌ FAILED - Unexpected error: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All integration tests passed!")
        return True
    else:
        print("💥 Some integration tests failed!")
        return False

if __name__ == "__main__":
    success = test_hook_integration()
    sys.exit(0 if success else 1)