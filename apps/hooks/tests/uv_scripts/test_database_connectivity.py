#!/usr/bin/env python3
"""
Test database connectivity for UV hooks.

Validates that hooks can connect to both SQLite and Supabase (if configured).
"""

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

def test_sqlite_connectivity():
    """Test SQLite database connectivity."""
    print("\n🗄️  Testing SQLite connectivity...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_chronicle.db"
        
        # Set environment for SQLite
        env = os.environ.copy()
        env["CHRONICLE_TEST_MODE"] = "1"
        env["CLAUDE_SESSION_ID"] = "db-test"
        env["CLAUDE_HOOKS_DB_PATH"] = str(db_path)
        env.pop("SUPABASE_URL", None)
        env.pop("SUPABASE_ANON_KEY", None)
        
        # Run session start hook
        script_path = Path(__file__).parent.parent.parent / "src" / "hooks" / "uv_scripts" / "session_start_uv.py"
        
        input_data = {
            "sessionId": "sqlite-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "SessionStart",
            "source": "startup"
        }
        
        cmd = ["uv", "run", str(script_path)]
        result = subprocess.run(
            cmd,
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode != 0:
            print(f"  ❌ Hook failed: {result.stderr}")
            return False
        
        # Check database was created
        if not db_path.exists():
            print("  ❌ SQLite database not created")
            return False
        
        # Verify data was written
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM sessions")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    print(f"  ✅ SQLite working - {count} session(s) recorded")
                    
                    # Check events table
                    cursor = conn.execute("SELECT COUNT(*) FROM events")
                    event_count = cursor.fetchone()[0]
                    print(f"  ✅ Events table has {event_count} record(s)")
                    
                    return True
                else:
                    print("  ❌ No sessions recorded in SQLite")
                    return False
                    
        except Exception as e:
            print(f"  ❌ SQLite query failed: {e}")
            return False

def test_supabase_connectivity():
    """Test Supabase connectivity if configured."""
    print("\n☁️  Testing Supabase connectivity...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("  ⚠️  Supabase not configured (SUPABASE_URL/SUPABASE_ANON_KEY not set)")
        return None
    
    # Test with Supabase
    env = os.environ.copy()
    env["CHRONICLE_TEST_MODE"] = "1"
    env["CLAUDE_SESSION_ID"] = "supabase-test"
    
    # Run session start hook
    script_path = Path(__file__).parent.parent.parent / "src" / "hooks" / "uv_scripts" / "session_start_uv.py"
    
    input_data = {
        "sessionId": f"supabase-test-{int(time.time())}",
        "transcriptPath": "/tmp/test.jsonl",
        "cwd": "/tmp",
        "hookEventName": "SessionStart",
        "source": "startup"
    }
    
    cmd = ["uv", "run", str(script_path)]
    result = subprocess.run(
        cmd,
        input=json.dumps(input_data),
        capture_output=True,
        text=True,
        env=env,
        timeout=10
    )
    
    if result.returncode != 0:
        print(f"  ❌ Hook failed with Supabase: {result.stderr}")
        return False
    
    # Parse response to check if session was created
    try:
        response = json.loads(result.stdout)
        if response.get("hookSpecificOutput", {}).get("sessionInitialized"):
            print("  ✅ Supabase connection successful")
            return True
        else:
            print("  ❌ Supabase session not initialized")
            return False
    except Exception as e:
        print(f"  ❌ Failed to parse response: {e}")
        return False

def test_database_fallback():
    """Test that SQLite fallback works when Supabase fails."""
    print("\n🔄 Testing database fallback mechanism...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "fallback_test.db"
        
        # Set invalid Supabase credentials to force fallback
        env = os.environ.copy()
        env["CHRONICLE_TEST_MODE"] = "1"
        env["CLAUDE_SESSION_ID"] = "fallback-test"
        env["CLAUDE_HOOKS_DB_PATH"] = str(db_path)
        env["SUPABASE_URL"] = "https://invalid.supabase.co"
        env["SUPABASE_ANON_KEY"] = "invalid-key"
        
        # Run hook
        script_path = Path(__file__).parent.parent.parent / "src" / "hooks" / "uv_scripts" / "session_start_uv.py"
        
        input_data = {
            "sessionId": "fallback-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "SessionStart",
            "source": "startup"
        }
        
        cmd = ["uv", "run", str(script_path)]
        result = subprocess.run(
            cmd,
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode != 0:
            print(f"  ❌ Hook failed during fallback: {result.stderr}")
            return False
        
        # Check SQLite was used as fallback
        if db_path.exists():
            with sqlite3.connect(db_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM sessions")
                count = cursor.fetchone()[0]
                if count > 0:
                    print("  ✅ SQLite fallback working correctly")
                    return True
        
        print("  ❌ SQLite fallback did not work")
        return False

def main():
    """Run all database connectivity tests."""
    print("🔌 Database Connectivity Test for UV Hooks")
    print("=" * 60)
    
    results = {
        "sqlite": False,
        "supabase": None,
        "fallback": False
    }
    
    # Test SQLite
    results["sqlite"] = test_sqlite_connectivity()
    
    # Test Supabase
    results["supabase"] = test_supabase_connectivity()
    
    # Test fallback
    results["fallback"] = test_database_fallback()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    print(f"\nSQLite:    {'✅ Working' if results['sqlite'] else '❌ Failed'}")
    
    if results["supabase"] is None:
        print("Supabase:  ⚠️  Not configured")
    elif results["supabase"]:
        print("Supabase:  ✅ Working")
    else:
        print("Supabase:  ❌ Failed")
    
    print(f"Fallback:  {'✅ Working' if results['fallback'] else '❌ Failed'}")
    
    # Overall result
    if not results["sqlite"]:
        print("\n❌ Critical: SQLite (primary fallback) is not working!")
        sys.exit(1)
    elif results["supabase"] is False:  # Configured but failing
        print("\n⚠️  Warning: Supabase is configured but not working")
        sys.exit(2)
    else:
        print("\n✅ Database connectivity tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()