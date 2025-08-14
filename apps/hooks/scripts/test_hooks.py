#!/usr/bin/env python3
"""
Chronicle Hooks Test Script

Tests if Chronicle hooks are properly installed and capturing data.
"""

import json
import os
import sys
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path

# Add the core directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "core"))

try:
    from database import DatabaseManager
except ImportError:
    print("⚠️ Cannot import DatabaseManager - make sure you're in the correct directory")
    sys.exit(1)


class HooksTestRunner:
    """Test runner for Chronicle hooks."""
    
    def __init__(self):
        self.test_results = []
        self.claude_hooks_dir = Path.home() / ".claude" / "hooks"
        self.db_manager = None
        
    def run_all_tests(self):
        """Run all hook tests."""
        print("🧪 Chronicle Hooks Test Suite")
        print("=" * 50)
        
        # Test 1: Check installation
        self.test_installation()
        
        # Test 2: Test database connection
        self.test_database_connection()
        
        # Test 3: Test individual hooks
        self.test_individual_hooks()
        
        # Test 4: Check data capture
        self.test_data_capture()
        
        # Summary
        self.print_summary()
    
    def test_installation(self):
        """Test if hooks are properly installed."""
        print("\n1️⃣ Testing Hook Installation...")
        
        # Check if hooks directory exists
        if not self.claude_hooks_dir.exists():
            self.add_result("Hooks directory exists", False, f"Directory not found: {self.claude_hooks_dir}")
            return
        
        self.add_result("Hooks directory exists", True)
        
        # Check for all hook files
        expected_hooks = [
            "pre_tool_use.py",
            "post_tool_use.py",
            "user_prompt_submit.py", 
            "notification.py",
            "session_start.py",
            "stop.py",
            "subagent_stop.py",
            "pre_compact.py"
        ]
        
        missing_hooks = []
        for hook in expected_hooks:
            hook_path = self.claude_hooks_dir / hook
            if not hook_path.exists():
                missing_hooks.append(hook)
        
        if missing_hooks:
            self.add_result("All hooks present", False, f"Missing hooks: {', '.join(missing_hooks)}")
        else:
            self.add_result("All hooks present", True)
            
        # Check settings.json
        settings_path = Path.home() / ".claude" / "settings.json"
        if settings_path.exists():
            with open(settings_path) as f:
                settings = json.load(f)
            
            has_hooks = "hooks" in settings
            self.add_result("Hooks registered in settings.json", has_hooks)
        else:
            self.add_result("Settings.json exists", False)
    
    def test_database_connection(self):
        """Test database connectivity."""
        print("\n2️⃣ Testing Database Connection...")
        
        try:
            self.db_manager = DatabaseManager()
            
            # Test connection
            connection_test = self.db_manager.test_connection()
            self.add_result("Database connection", connection_test)
            
            # Get detailed status
            status = self.db_manager.get_status()
            supabase_info = status.get('supabase', {})
            
            if supabase_info.get('has_client'):
                self.add_result("Supabase client available", True)
                self.add_result("Supabase healthy", supabase_info.get('is_healthy', False))
            else:
                self.add_result("Supabase client available", False, "Using SQLite fallback")
                
        except Exception as e:
            self.add_result("Database setup", False, str(e))
    
    def test_individual_hooks(self):
        """Test individual hook functionality."""
        print("\n3️⃣ Testing Individual Hooks...")
        
        test_hooks = [
            ("session_start.py", {
                "source": "start",
                "project_root": str(Path.cwd())
            }),
            ("user_prompt_submit.py", {
                "prompt": "Test prompt for Chronicle",
                "session_id": "test-session-123"
            }),
            ("post_tool_use.py", {
                "toolName": "Read",
                "toolInput": {"file_path": "/test/file.py"},
                "toolOutput": {"content": "test content"},
                "executionTimeMs": 100,
                "error": None
            })
        ]
        
        for hook_name, test_input in test_hooks:
            hook_path = self.claude_hooks_dir / hook_name
            if not hook_path.exists():
                self.add_result(f"Test {hook_name}", False, "Hook not found")
                continue
            
            try:
                # Run hook with test input
                result = subprocess.run(
                    [sys.executable, str(hook_path)],
                    input=json.dumps(test_input),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                if result.returncode == 0:
                    # Try to parse output
                    try:
                        output = json.loads(result.stdout)
                        self.add_result(f"Test {hook_name}", True)
                    except json.JSONDecodeError:
                        self.add_result(f"Test {hook_name}", False, "Invalid JSON output")
                else:
                    self.add_result(f"Test {hook_name}", False, f"Exit code: {result.returncode}")
                    if result.stderr:
                        print(f"   Error: {result.stderr.strip()}")
                        
            except subprocess.TimeoutExpired:
                self.add_result(f"Test {hook_name}", False, "Timeout")
            except Exception as e:
                self.add_result(f"Test {hook_name}", False, str(e))
    
    def test_data_capture(self):
        """Test if data is being captured to database."""
        print("\n4️⃣ Testing Data Capture...")
        
        if not self.db_manager:
            self.add_result("Data capture test", False, "Database not initialized")
            return
        
        # Create test session
        test_session_id = f"test-{int(time.time())}"
        session_data = {
            "session_id": test_session_id,
            "claude_session_id": test_session_id,
            "project_path": str(Path.cwd()),
            "start_time": datetime.utcnow().isoformat() + 'Z'
        }
        
        # Try to save session
        session_saved = self.db_manager.save_session(session_data)
        self.add_result("Save test session", session_saved)
        
        # Create test event
        event_data = {
            "session_id": test_session_id,
            "hook_event_name": "test_event",
            "event_type": "test",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "data": {"test": True, "message": "Chronicle hooks test"}
        }
        
        # Try to save event
        event_saved = self.db_manager.save_event(event_data)
        self.add_result("Save test event", event_saved)
    
    def add_result(self, test_name: str, passed: bool, message: str = ""):
        """Add a test result."""
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "message": message
        })
        
        # Print result
        status = "✅" if passed else "❌"
        print(f"{status} {test_name}", end="")
        if message:
            print(f" - {message}")
        else:
            print()
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "=" * 50)
        print("📊 Test Summary")
        print("=" * 50)
        
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = total - passed
        
        print(f"Total tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        
        if failed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        if passed == total:
            print("\n🎉 All tests passed! Chronicle hooks are working properly!")
        else:
            print("\n⚠️ Some tests failed. Check the errors above.")


def quick_test():
    """Quick test to verify hooks are capturing data."""
    print("🚀 Quick Chronicle Hooks Test")
    print("=" * 50)
    
    # Test 1: Check if hooks are installed
    hooks_dir = Path.home() / ".claude" / "hooks"
    hook_count = len(list(hooks_dir.glob("*.py"))) if hooks_dir.exists() else 0
    
    print(f"\n📁 Hooks installed: {hook_count}")
    
    # Test 2: Try to import and test database
    try:
        from database import DatabaseManager
        db = DatabaseManager()
        connection_ok = db.test_connection()
        
        print(f"🔌 Database connection: {'✅ Connected' if connection_ok else '❌ Failed'}")
        
        # Show connection details
        status = db.get_status()
        if status['supabase']['has_client']:
            print(f"   Using: Supabase ({status['supabase']['url']})")
        else:
            print(f"   Using: SQLite fallback ({status['sqlite_path']})")
            
    except Exception as e:
        print(f"🔌 Database connection: ❌ Error - {e}")
    
    print("\n💡 To run full test suite: python test_hooks.py --full")
    print("💡 To test with Claude Code: Start a new session and check the dashboard!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Chronicle hooks installation")
    parser.add_argument("--full", action="store_true", help="Run full test suite")
    parser.add_argument("--quick", action="store_true", help="Run quick test (default)")
    
    args = parser.parse_args()
    
    if args.full:
        runner = HooksTestRunner()
        runner.run_all_tests()
    else:
        quick_test()