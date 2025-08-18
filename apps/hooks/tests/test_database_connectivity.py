#!/usr/bin/env python3
"""
Database Connectivity Test Script for Chronicle Hooks

This script tests database connectivity for all 8 hooks to ensure they can save to both
Supabase and SQLite without 400 Bad Request errors or UUID issues.

Usage:
    python test_database_connectivity.py
"""

import json
import os
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from lib.database import DatabaseManager, validate_and_fix_session_id, ensure_valid_uuid

def setup_test_environment():
    """Set up test environment with temporary database."""
    temp_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    temp_db.close()
    
    test_config = {
        'supabase_url': os.getenv('SUPABASE_URL'),
        'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
        'sqlite_path': temp_db.name,
        'db_timeout': 30,
        'retry_attempts': 3,
        'retry_delay': 1.0,
    }
    
    return test_config, temp_db.name

def test_session_creation():
    """Test session creation with various session ID formats."""
    print("🧪 Testing session creation...")
    
    config, temp_db = setup_test_environment()
    db = DatabaseManager(config)
    
    test_cases = [
        {"name": "Valid UUID", "claude_session_id": str(uuid.uuid4())},
        {"name": "String ID", "claude_session_id": "test-session-123"},
        {"name": "Complex String", "claude_session_id": "claude-session-with-dashes-and-numbers-456"},
        {"name": "Empty String", "claude_session_id": ""},
        {"name": "None Value", "claude_session_id": None},
    ]
    
    results = []
    for test_case in test_cases:
        try:
            session_data = {
                "claude_session_id": test_case["claude_session_id"],
                "start_time": datetime.now().isoformat(),
                "project_path": "/test/path",
                "git_branch": "test-branch"
            }
            
            success, session_uuid = db.save_session(session_data)
            results.append({
                "test": test_case["name"],
                "input": test_case["claude_session_id"],
                "success": success,
                "session_uuid": session_uuid,
                "error": None
            })
            
            if success:
                print(f"  ✅ {test_case['name']}: SUCCESS (UUID: {session_uuid})")
            else:
                print(f"  ❌ {test_case['name']}: FAILED")
                
        except Exception as e:
            results.append({
                "test": test_case["name"],
                "input": test_case["claude_session_id"],
                "success": False,
                "session_uuid": None,
                "error": str(e)
            })
            print(f"  ❌ {test_case['name']}: ERROR - {e}")
    
    # Cleanup
    os.unlink(temp_db)
    return results

def test_all_hook_event_types():
    """Test all hook event types used by the 8 hooks."""
    print("🧪 Testing all hook event types...")
    
    config, temp_db = setup_test_environment()
    db = DatabaseManager(config)
    
    # Create a test session first
    test_session_id = str(uuid.uuid4())
    session_data = {
        "claude_session_id": test_session_id,
        "start_time": datetime.now().isoformat(),
        "project_path": "/test/path"
    }
    success, session_uuid = db.save_session(session_data)
    
    if not success:
        print("  ❌ Failed to create test session")
        os.unlink(temp_db)
        return []
    
    # Test all event types from the 8 hooks
    hook_event_types = [
        {"hook": "pre_tool_use", "event_type": "pre_tool_use"},
        {"hook": "post_tool_use", "event_type": "tool_use"},
        {"hook": "user_prompt_submit", "event_type": "prompt"},
        {"hook": "session_start", "event_type": "session_start"},
        {"hook": "stop", "event_type": "session_end"},
        {"hook": "subagent_stop", "event_type": "subagent_termination"},
        {"hook": "notification", "event_type": "notification"},
        {"hook": "pre_compact", "event_type": "pre_compaction"},
    ]
    
    results = []
    for hook_info in hook_event_types:
        try:
            event_data = {
                "session_id": session_uuid,
                "event_type": hook_info["event_type"],
                "hook_event_name": hook_info["hook"],
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "test": True,
                    "hook_name": hook_info["hook"]
                }
            }
            
            success = db.save_event(event_data)
            results.append({
                "hook": hook_info["hook"],
                "event_type": hook_info["event_type"],
                "success": success,
                "error": None
            })
            
            if success:
                print(f"  ✅ {hook_info['hook']} ({hook_info['event_type']}): SUCCESS")
            else:
                print(f"  ❌ {hook_info['hook']} ({hook_info['event_type']}): FAILED")
                
        except Exception as e:
            results.append({
                "hook": hook_info["hook"],
                "event_type": hook_info["event_type"],
                "success": False,
                "error": str(e)
            })
            print(f"  ❌ {hook_info['hook']} ({hook_info['event_type']}): ERROR - {e}")
    
    # Cleanup
    os.unlink(temp_db)
    return results

def test_uuid_validation():
    """Test UUID validation functions."""
    print("🧪 Testing UUID validation functions...")
    
    test_cases = [
        {"input": str(uuid.uuid4()), "name": "Valid UUID"},
        {"input": "test-session-123", "name": "String ID"},
        {"input": "", "name": "Empty string"},
        {"input": None, "name": "None value"},
        {"input": "claude-session-very-long-name-with-special-chars!@#", "name": "Complex string"},
    ]
    
    results = []
    for test_case in test_cases:
        try:
            # Test session ID validation
            fixed_session_id = validate_and_fix_session_id(test_case["input"])
            
            # Test UUID validation
            valid_uuid = ensure_valid_uuid(test_case["input"])
            
            # Verify both results are valid UUIDs
            uuid.UUID(fixed_session_id)
            uuid.UUID(valid_uuid)
            
            results.append({
                "test": test_case["name"],
                "input": test_case["input"],
                "fixed_session_id": fixed_session_id,
                "valid_uuid": valid_uuid,
                "success": True,
                "error": None
            })
            
            print(f"  ✅ {test_case['name']}: SUCCESS")
            
        except Exception as e:
            results.append({
                "test": test_case["name"],
                "input": test_case["input"],
                "fixed_session_id": None,
                "valid_uuid": None,
                "success": False,
                "error": str(e)
            })
            print(f"  ❌ {test_case['name']}: ERROR - {e}")
    
    return results

def test_database_status():
    """Test database status and connection."""
    print("🧪 Testing database status...")
    
    config, temp_db = setup_test_environment()
    db = DatabaseManager(config)
    
    try:
        status = db.get_status()
        connection_test = db.test_connection()
        
        print(f"  📊 Supabase available: {status['supabase_available']}")
        print(f"  📊 SQLite path: {status['sqlite_path']}")
        print(f"  📊 SQLite exists: {status['sqlite_exists']}")
        print(f"  📊 Connection healthy: {status['connection_healthy']}")
        print(f"  📊 Connection test: {connection_test}")
        
        # Cleanup
        os.unlink(temp_db)
        
        return {
            "status": status,
            "connection_test": connection_test,
            "success": True
        }
        
    except Exception as e:
        print(f"  ❌ Database status test failed: {e}")
        # Cleanup
        os.unlink(temp_db)
        return {
            "status": None,
            "connection_test": False,
            "success": False,
            "error": str(e)
        }

def main():
    """Run all database connectivity tests."""
    print("🚀 Chronicle Database Connectivity Test Suite")
    print("=" * 60)
    
    all_results = {}
    
    # Test 1: Session creation
    all_results["session_creation"] = test_session_creation()
    print()
    
    # Test 2: Event types
    all_results["event_types"] = test_all_hook_event_types()
    print()
    
    # Test 3: UUID validation
    all_results["uuid_validation"] = test_uuid_validation()
    print()
    
    # Test 4: Database status
    all_results["database_status"] = test_database_status()
    print()
    
    # Summary
    print("📋 Test Summary")
    print("=" * 60)
    
    total_tests = 0
    passed_tests = 0
    
    for category, results in all_results.items():
        if isinstance(results, list):
            category_total = len(results)
            category_passed = sum(1 for r in results if r.get("success", False))
        elif isinstance(results, dict):
            category_total = 1
            category_passed = 1 if results.get("success", False) else 0
        else:
            continue
            
        total_tests += category_total
        passed_tests += category_passed
        
        print(f"  {category}: {category_passed}/{category_total} passed")
    
    print(f"\n🎯 Overall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Database connectivity is working correctly.")
        return 0
    else:
        print("⚠️ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())