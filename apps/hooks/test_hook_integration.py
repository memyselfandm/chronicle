#!/usr/bin/env python3
"""
Hook Integration Test Script

Tests that all 8 hooks can successfully use the fixed database library
to save events without errors.

Usage:
    python test_hook_integration.py
"""

import json
import os
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from lib.database import DatabaseManager

def test_hook_with_shared_library(hook_name, event_type, sample_data=None):
    """Test a hook using the shared database library."""
    print(f"🧪 Testing {hook_name} hook...")
    
    try:
        # Create temporary database for this test
        temp_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        temp_db.close()
        
        config = {
            'supabase_url': os.getenv('SUPABASE_URL'),
            'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
            'sqlite_path': temp_db.name,
            'db_timeout': 30,
        }
        
        # Initialize database manager
        db = DatabaseManager(config)
        
        # Create test session
        test_session_id = f"test-session-{hook_name}-{uuid.uuid4()}"
        session_data = {
            "claude_session_id": test_session_id,
            "start_time": datetime.now().isoformat(),
            "project_path": f"/test/path/{hook_name}",
            "git_branch": "test-branch"
        }
        
        session_success, session_uuid = db.save_session(session_data)
        if not session_success:
            print(f"  ❌ Failed to create session for {hook_name}")
            os.unlink(temp_db.name)
            return False
        
        # Create test event
        event_data = {
            "session_id": session_uuid,
            "event_type": event_type,
            "hook_event_name": hook_name,
            "timestamp": datetime.now().isoformat(),
            "data": sample_data or {
                "test": True,
                "hook": hook_name,
                "test_timestamp": datetime.now().isoformat()
            }
        }
        
        # Add hook-specific data
        if hook_name == "PostToolUse" and event_type == "tool_use":
            event_data["data"]["tool_name"] = "TestTool"
            event_data["data"]["tool_input"] = {"test": "input"}
            event_data["data"]["tool_output"] = {"test": "output"}
        
        event_success = db.save_event(event_data)
        
        # Test retrieval
        retrieved_session = db.get_session(test_session_id)
        
        # Cleanup
        os.unlink(temp_db.name)
        
        if event_success and retrieved_session:
            print(f"  ✅ {hook_name}: SUCCESS (Session: {session_uuid[:8]}...)")
            return True
        else:
            print(f"  ❌ {hook_name}: FAILED (event_success: {event_success}, retrieved: {bool(retrieved_session)})")
            return False
            
    except Exception as e:
        print(f"  ❌ {hook_name}: ERROR - {e}")
        try:
            os.unlink(temp_db.name)
        except:
            pass
        return False

def main():
    """Test all 8 hooks with the shared database library."""
    print("🚀 Hook Integration Test Suite")
    print("Testing all 8 hooks with shared database library")
    print("=" * 60)
    
    # Define all 8 hooks with their event types
    hooks_to_test = [
        ("PreToolUse", "pre_tool_use", {
            "tool_name": "TestTool",
            "tool_input": {"file_path": "/test/file.txt"},
            "permission_decision": "allow",
            "permission_reason": "Test approved"
        }),
        ("PostToolUse", "tool_use", {
            "tool_name": "TestTool", 
            "tool_input": {"file_path": "/test/file.txt"},
            "tool_output": {"result": "success"},
            "execution_time_ms": 150
        }),
        ("UserPromptSubmit", "prompt", {
            "prompt_text": "Test user prompt",
            "character_count": 17,
            "word_count": 3
        }),
        ("SessionStart", "session_start", {
            "project_path": "/test/project",
            "git_branch": "main",
            "git_commit": "abc123",
            "trigger_source": "new"
        }),
        ("Stop", "session_end", {
            "session_duration_ms": 30000,
            "total_tools_used": 5,
            "total_prompts": 3
        }),
        ("SubagentStop", "subagent_termination", {
            "subagent_id": "test-subagent-123",
            "reason": "task_completed",
            "duration_ms": 5000
        }),
        ("Notification", "notification", {
            "notification_type": "info",
            "message": "Test notification",
            "source": "system"
        }),
        ("PreCompact", "pre_compaction", {
            "context_size_before": 50000,
            "compression_ratio": 0.7,
            "retention_policy": "recent"
        })
    ]
    
    results = []
    for hook_name, event_type, sample_data in hooks_to_test:
        success = test_hook_with_shared_library(hook_name, event_type, sample_data)
        results.append((hook_name, success))
    
    # Summary
    print("\n📋 Integration Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for hook_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {hook_name}: {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} hooks passed integration tests")
    
    if passed == total:
        print("🎉 All hooks can successfully use the shared database library!")
        print("📝 Database connectivity issues have been resolved.")
        return 0
    else:
        print("⚠️ Some hooks failed integration tests.")
        return 1

if __name__ == "__main__":
    sys.exit(main())