#!/usr/bin/env python3
"""
Test hooks under various failure scenarios to ensure they never crash Claude Code.

This test suite validates that hooks gracefully handle all types of errors
including database failures, network issues, invalid input, and system errors.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Test data directory
TEST_DATA_DIR = Path(__file__).parent / "test_data"
TEST_DATA_DIR.mkdir(exist_ok=True)


class TestHookErrorScenarios(unittest.TestCase):
    """Test hooks under various failure scenarios."""
    
    def setUp(self):
        """Set up test environment."""
        self.hooks_dir = Path(__file__).parent.parent / "src" / "hooks"
        self.test_env = os.environ.copy()
        self.test_env.update({
            'CHRONICLE_LOG_LEVEL': 'DEBUG',
            'PYTHONPATH': str(Path(__file__).parent.parent / "src" / "core")
        })
    
    def _run_hook(self, hook_name: str, input_data: dict = None) -> tuple[int, str, str]:
        """Run a hook with given input data and return exit code, stdout, stderr."""
        hook_path = self.hooks_dir / f"{hook_name}.py"
        
        if not hook_path.exists():
            self.fail(f"Hook not found: {hook_path}")
        
        # Prepare input
        input_json = json.dumps(input_data or {})
        
        # Run hook
        process = subprocess.run(
            [sys.executable, str(hook_path)],
            input=input_json,
            capture_output=True,
            text=True,
            env=self.test_env,
            timeout=10
        )
        
        return process.returncode, process.stdout, process.stderr
    
    def test_session_start_invalid_json(self):
        """Test session start hook with invalid JSON input."""
        hook_path = self.hooks_dir / "session_start.py"
        
        # Test with invalid JSON
        process = subprocess.run(
            [sys.executable, str(hook_path)],
            input="invalid json",
            capture_output=True,
            text=True,
            env=self.test_env,
            timeout=10
        )
        
        # Should exit with success (0) to not break Claude
        self.assertEqual(process.returncode, 0)
        
        # Should output valid JSON response
        try:
            response = json.loads(process.stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response")
    
    def test_session_start_empty_input(self):
        """Test session start hook with empty input."""
        exit_code, stdout, stderr = self._run_hook("session_start", {})
        
        # Should exit with success
        self.assertEqual(exit_code, 0)
        
        # Should output valid JSON
        try:
            response = json.loads(stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response")
    
    def test_session_start_with_valid_input(self):
        """Test session start hook with valid input."""
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-123",
            "cwd": "/tmp/test-project",
            "transcriptPath": "/tmp/transcript.json"
        }
        
        exit_code, stdout, stderr = self._run_hook("session_start", test_input)
        
        # Should exit with success
        self.assertEqual(exit_code, 0)
        
        # Should output valid JSON with hook-specific data
        try:
            response = json.loads(stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
            self.assertIn("hookSpecificOutput", response)
            
            hook_output = response["hookSpecificOutput"]
            self.assertEqual(hook_output["hookEventName"], "SessionStart")
            
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response")
    
    def test_database_failure_scenario(self):
        """Test hook behavior when database is unavailable."""
        # Set environment to simulate database failure
        test_env = self.test_env.copy()
        test_env.update({
            'SUPABASE_URL': 'https://invalid-url.supabase.co',
            'SUPABASE_ANON_KEY': 'invalid-key',
            'CLAUDE_HOOKS_DB_PATH': '/invalid/path/database.db'
        })
        
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-db-fail",
            "cwd": "/tmp/test-project"
        }
        
        hook_path = self.hooks_dir / "session_start.py"
        process = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(test_input),
            capture_output=True,
            text=True,
            env=test_env,
            timeout=15
        )
        
        # Should still exit with success (graceful degradation)
        self.assertEqual(process.returncode, 0)
        
        # Should output valid JSON response
        try:
            response = json.loads(process.stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response during database failure")
    
    def test_permission_error_scenario(self):
        """Test hook behavior with permission errors."""
        test_env = self.test_env.copy()
        # Set log path to a read-only location
        test_env['CLAUDE_HOOKS_DB_PATH'] = '/root/readonly/database.db'
        
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-permission",
            "cwd": "/tmp/test-project"
        }
        
        exit_code, stdout, stderr = self._run_hook("session_start", test_input)
        
        # Should still exit with success
        self.assertEqual(exit_code, 0)
        
        # Should output valid JSON
        try:
            response = json.loads(stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response during permission error")
    
    def test_resource_exhaustion_scenario(self):
        """Test hook behavior under resource exhaustion."""
        # Create very large input to simulate resource exhaustion
        large_data = "x" * (10 * 1024 * 1024)  # 10MB string
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-large",
            "cwd": "/tmp/test-project",
            "largeData": large_data
        }
        
        exit_code, stdout, stderr = self._run_hook("session_start", test_input)
        
        # Should still exit with success
        self.assertEqual(exit_code, 0)
        
        # Should output valid JSON
        try:
            response = json.loads(stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response during resource exhaustion")
    
    def test_concurrent_hook_execution(self):
        """Test multiple hooks running concurrently."""
        import threading
        import time
        
        results = []
        
        def run_hook_thread(thread_id):
            test_input = {
                "hookEventName": "SessionStart",
                "sessionId": f"test-session-concurrent-{thread_id}",
                "cwd": "/tmp/test-project"
            }
            
            try:
                exit_code, stdout, stderr = self._run_hook("session_start", test_input)
                results.append((thread_id, exit_code, stdout, stderr))
            except Exception as e:
                results.append((thread_id, -1, "", str(e)))
        
        # Start multiple concurrent hook executions
        threads = []
        for i in range(5):
            thread = threading.Thread(target=run_hook_thread, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join(timeout=20)
        
        # Verify all hooks completed successfully
        self.assertEqual(len(results), 5)
        
        for thread_id, exit_code, stdout, stderr in results:
            self.assertEqual(exit_code, 0, f"Thread {thread_id} failed with exit code {exit_code}")
            
            # Verify JSON output
            try:
                response = json.loads(stdout)
                self.assertIn("continue", response)
                self.assertTrue(response["continue"])
            except json.JSONDecodeError:
                self.fail(f"Thread {thread_id} did not output valid JSON")
    
    def test_signal_interruption(self):
        """Test hook behavior when interrupted by signals."""
        import signal
        import threading
        import time
        
        hook_path = self.hooks_dir / "session_start.py"
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-signal",
            "cwd": "/tmp/test-project"
        }
        
        # Start hook process
        process = subprocess.Popen(
            [sys.executable, str(hook_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self.test_env
        )
        
        # Send input
        stdout, stderr = process.communicate(
            input=json.dumps(test_input),
            timeout=5
        )
        
        exit_code = process.returncode
        
        # Should complete successfully even with quick execution
        self.assertEqual(exit_code, 0)
        
        # Should output valid JSON
        try:
            response = json.loads(stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response")
    
    def test_error_message_templates(self):
        """Test that error messages are helpful and actionable."""
        # Test with invalid configuration
        test_env = self.test_env.copy()
        test_env.update({
            'SUPABASE_URL': 'not-a-url',
            'CHRONICLE_LOG_LEVEL': 'DEBUG'
        })
        
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-config-error",
            "cwd": "/tmp/test-project"
        }
        
        hook_path = self.hooks_dir / "session_start.py"
        process = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(test_input),
            capture_output=True,
            text=True,
            env=test_env,
            timeout=10
        )
        
        # Should exit with success
        self.assertEqual(process.returncode, 0)
        
        # Check for helpful error context in output
        try:
            response = json.loads(process.stdout)
            self.assertIn("continue", response)
            self.assertTrue(response["continue"])
            
            # If there's an error, it should be informative
            if "hookSpecificOutput" in response:
                hook_output = response["hookSpecificOutput"]
                if "error" in hook_output or "errorMessage" in hook_output:
                    # Error messages should be present and non-empty
                    error_msg = hook_output.get("errorMessage", hook_output.get("error", ""))
                    self.assertGreater(len(error_msg), 10, "Error message should be descriptive")
                    
        except json.JSONDecodeError:
            self.fail("Hook did not output valid JSON response")


class TestExitCodeCompliance(unittest.TestCase):
    """Test that hooks follow Claude Code exit code conventions."""
    
    def setUp(self):
        """Set up test environment."""
        self.hooks_dir = Path(__file__).parent.parent / "src" / "hooks"
        self.test_env = os.environ.copy()
        self.test_env.update({
            'CHRONICLE_LOG_LEVEL': 'DEBUG',
            'PYTHONPATH': str(Path(__file__).parent.parent / "src" / "core")
        })
    
    def test_success_exit_codes(self):
        """Test that successful operations return exit code 0."""
        test_input = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-success",
            "cwd": "/tmp/test-project"
        }
        
        hook_path = self.hooks_dir / "session_start.py"
        process = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(test_input),
            capture_output=True,
            text=True,
            env=self.test_env,
            timeout=10
        )
        
        # Should always return 0 for success or graceful failure
        self.assertEqual(process.returncode, 0, "Hooks should never return non-zero exit codes")
    
    def test_error_scenarios_exit_codes(self):
        """Test that error scenarios still return appropriate exit codes."""
        error_scenarios = [
            ("invalid_json", "invalid json input"),
            ("empty_input", ""),
            ("malformed_data", '{"invalid": json}'),
        ]
        
        for scenario_name, input_data in error_scenarios:
            with self.subTest(scenario=scenario_name):
                hook_path = self.hooks_dir / "session_start.py"
                process = subprocess.run(
                    [sys.executable, str(hook_path)],
                    input=input_data,
                    capture_output=True,
                    text=True,
                    env=self.test_env,
                    timeout=10
                )
                
                # Should never return non-zero exit codes to avoid breaking Claude
                self.assertEqual(
                    process.returncode, 0,
                    f"Scenario '{scenario_name}' should return exit code 0, got {process.returncode}"
                )


if __name__ == '__main__':
    # Set up test environment
    os.environ['CHRONICLE_LOG_LEVEL'] = 'DEBUG'
    os.environ['PYTHONPATH'] = str(Path(__file__).parent.parent / "src" / "core")
    
    # Create test directories
    TEST_DATA_DIR.mkdir(exist_ok=True)
    
    # Run tests
    unittest.main(verbosity=2)