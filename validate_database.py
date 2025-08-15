#!/usr/bin/env python3
"""
Database Validation Script for Chronicle Hooks

This script validates that Chronicle hooks are working and data is being saved.
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def test_hook_execution():
    """Test that hooks execute and report success."""
    print("🧪 Testing hook execution...")
    
    hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
    
    # Test SessionStart hook
    print("  Testing SessionStart hook...")
    test_data = {
        "sessionId": "validation-test",
        "transcriptPath": "/tmp/test.jsonl",
        "cwd": str(Path.cwd()),
        "hookEventName": "SessionStart",
        "source": "startup"
    }
    
    try:
        result = subprocess.run(
            ["uv", "run", str(hooks_dir / "session_start_uv.py")],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            output = json.loads(result.stdout)
            print(f"    ✅ SessionStart executed in {output.get('execution_time_ms', 0):.1f}ms")
            print(f"    📊 Session initialized: {output.get('hookSpecificOutput', {}).get('sessionInitialized', False)}")
            return True
        else:
            print(f"    ❌ SessionStart failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"    ❌ Error testing SessionStart: {e}")
        return False

def test_database_write():
    """Test that hooks can write to database."""
    print("🗄️  Testing database write capabilities...")
    
    hooks_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'hooks'
    
    # Test UserPromptSubmit (has eventSaved indicator)
    print("  Testing UserPromptSubmit hook...")
    test_data = {
        "sessionId": "validation-test-db",
        "prompt": "Test prompt for database validation",
        "hookEventName": "UserPromptSubmit"
    }
    
    try:
        result = subprocess.run(
            ["uv", "run", str(hooks_dir / "user_prompt_submit_uv.py")],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            output = json.loads(result.stdout)
            execution_time = output.get('execution_time_ms', 0)
            hook_output = output.get('hookSpecificOutput', {})
            event_saved = hook_output.get('eventSaved', False)
            
            print(f"    ✅ UserPromptSubmit executed in {execution_time:.1f}ms")
            print(f"    💾 Event saved to database: {event_saved}")
            print(f"    📏 Prompt length: {hook_output.get('promptLength', 0)} characters")
            
            return event_saved
        else:
            print(f"    ❌ UserPromptSubmit failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"    ❌ Error testing UserPromptSubmit: {e}")
        return False

def check_installation():
    """Check installation status."""
    print("📦 Checking installation...")
    
    chronicle_dir = Path.home() / '.claude' / 'hooks' / 'chronicle'
    hooks_dir = chronicle_dir / 'hooks'
    settings_file = Path.home() / '.claude' / 'settings.json'
    
    # Check chronicle directory
    if chronicle_dir.exists():
        print(f"    ✅ Chronicle directory exists: {chronicle_dir}")
    else:
        print(f"    ❌ Chronicle directory missing: {chronicle_dir}")
        return False
    
    # Check hooks
    hook_files = [
        "session_start_uv.py",
        "user_prompt_submit_uv.py", 
        "pre_tool_use_uv.py",
        "post_tool_use_uv.py",
        "notification_uv.py",
        "stop_uv.py",
        "subagent_stop_uv.py",
        "pre_compact_uv.py"
    ]
    
    installed_hooks = 0
    for hook_file in hook_files:
        if (hooks_dir / hook_file).exists():
            installed_hooks += 1
    
    print(f"    📋 Hooks installed: {installed_hooks}/{len(hook_files)}")
    
    # Check settings.json
    if settings_file.exists():
        try:
            with open(settings_file) as f:
                settings = json.load(f)
            
            if "hooks" in settings and "SessionStart" in settings.get("hooks", {}):
                print("    ✅ Settings.json configured with hooks")
            else:
                print("    ⚠️  Settings.json exists but may not have hook configuration")
        except:
            print("    ❌ Error reading settings.json")
    else:
        print("    ❌ Settings.json not found")
    
    return installed_hooks == len(hook_files)

def main():
    """Main validation function."""
    print("🔍 Chronicle Hooks Database Validation")
    print("=" * 50)
    
    # Check installation
    installation_ok = check_installation()
    
    if not installation_ok:
        print("\n❌ Installation issues detected. Please run the install script first.")
        return False
    
    # Test hook execution
    print()
    execution_ok = test_hook_execution()
    
    # Test database writes
    print()
    database_ok = test_database_write()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 VALIDATION SUMMARY")
    print("=" * 50)
    print(f"Installation: {'✅ OK' if installation_ok else '❌ FAILED'}")
    print(f"Execution:    {'✅ OK' if execution_ok else '❌ FAILED'}")
    print(f"Database:     {'✅ OK' if database_ok else '❌ FAILED'}")
    
    if installation_ok and execution_ok and database_ok:
        print("\n🎉 Chronicle hooks are working and writing to database!")
        print("Your hooks should now capture observability data during Claude Code usage.")
        return True
    else:
        print("\n⚠️  Some issues detected. Check the details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)