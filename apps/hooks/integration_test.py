#!/usr/bin/env python3
"""
Integration test for PreToolUse permission controls.
Demonstrates the hook working with real Claude Code input/output format.
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
            "name": "Auto-approve documentation reading",
            "input": {
                "toolName": "Read",
                "toolInput": {"file_path": "/project/README.md"},
                "sessionId": "test-session-123",
                "hookEventName": "PreToolUse",
                "cwd": "/project"
            },
            "expected_decision": "allow"
        },
        {
            "name": "Deny sensitive file access",
            "input": {
                "toolName": "Read", 
                "toolInput": {"file_path": ".env"},
                "sessionId": "test-session-123",
                "hookEventName": "PreToolUse",
                "cwd": "/project"
            },
            "expected_decision": "deny"
        },
        {
            "name": "Ask for critical file modification",
            "input": {
                "toolName": "Edit",
                "toolInput": {"file_path": "package.json", "old_string": '"version": "1.0.0"', "new_string": '"version": "1.1.0"'},
                "sessionId": "test-session-123", 
                "hookEventName": "PreToolUse",
                "cwd": "/project"
            },
            "expected_decision": "ask"
        },
        {
            "name": "Deny dangerous bash command",
            "input": {
                "toolName": "Bash",
                "toolInput": {"command": "rm -rf /"},
                "sessionId": "test-session-123",
                "hookEventName": "PreToolUse", 
                "cwd": "/project"
            },
            "expected_decision": "deny"
        },
        {
            "name": "Ask for sudo command",
            "input": {
                "toolName": "Bash",
                "toolInput": {"command": "sudo apt-get update"},
                "sessionId": "test-session-123",
                "hookEventName": "PreToolUse",
                "cwd": "/project" 
            },
            "expected_decision": "ask"
        }
    ]
    
    print("🧪 Running PreToolUse Permission Controls Integration Tests")
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
            if not all(field in hook_output for field in ["hookEventName", "permissionDecision", "permissionDecisionReason"]):
                print(f"❌ FAILED - Missing required hookSpecificOutput fields")
                print(f"   Hook output: {hook_output}")
                failed += 1
                continue
            
            # Check the permission decision
            decision = hook_output["permissionDecision"]
            if decision != test_case["expected_decision"]:
                print(f"❌ FAILED - Expected decision '{test_case['expected_decision']}', got '{decision}'")
                print(f"   Reason: {hook_output['permissionDecisionReason']}")
                failed += 1
                continue
                
            # Success!
            print(f"✅ PASSED - Decision: {decision}")
            print(f"   Reason: {hook_output['permissionDecisionReason']}")
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