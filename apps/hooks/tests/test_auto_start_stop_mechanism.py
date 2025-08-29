#!/usr/bin/env python3
"""
Tests for CHR-41: Auto-start/stop Mechanism - Non-blocking Implementation
========================================================================

Comprehensive test suite for validating the non-blocking auto-start/stop
mechanism for Chronicle server integrated with Claude Code session lifecycle.

Key Test Areas:
- Non-blocking startup (< 100ms requirement)
- Graceful failure handling without impacting Claude Code
- Session lifecycle management
- Process cleanup and resource management
- Health check functionality
- Server status tracking

Author: C-Codey aka curl Stevens aka SWE-40
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock
import psutil

# Add src directory to path
current_dir = Path(__file__).parent
src_dir = current_dir.parent / "src"
sys.path.insert(0, str(src_dir))

from lib.server_manager import (
    ChronicleServerManager, 
    get_server_manager,
    start_chronicle_server_if_needed,
    stop_chronicle_server_session,
    get_chronicle_server_status
)
from lib.health_check import ChronicleHealthChecker, run_quick_health_check


class TestChronicleServerManager(unittest.TestCase):
    """Test the core server manager functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.manager = ChronicleServerManager()
        # Use test PID file path
        self.test_pid_file = Path(tempfile.gettempdir()) / "test_chronicle_server.pid"
        self.manager.pid_file_path = self.test_pid_file
        
    def tearDown(self):
        """Clean up after tests."""
        # Clean up test PID file
        if self.test_pid_file.exists():
            try:
                self.test_pid_file.unlink()
            except:
                pass
        
        # Force stop any test server
        try:
            self.manager.force_stop_server()
        except:
            pass
    
    def test_server_manager_initialization(self):
        """Test server manager initializes correctly."""
        self.assertIsInstance(self.manager.active_sessions, set)
        self.assertEqual(len(self.manager.active_sessions), 0)
        self.assertIsNone(self.manager.server_process)
        self.assertFalse(self.manager.startup_notified)
        self.assertTrue(self.manager.pid_file_path.name.endswith(".pid"))
    
    def test_pid_file_management(self):
        """Test PID file creation, reading, and cleanup."""
        test_pid = 12345
        
        # Test writing PID file
        self.manager._write_pid_file(test_pid)
        self.assertTrue(self.test_pid_file.exists())
        
        # Test reading PID file
        read_pid = self.manager._read_pid_file()
        self.assertEqual(read_pid, test_pid)
        
        # Test cleanup
        self.manager._cleanup_pid_file()
        self.assertFalse(self.test_pid_file.exists())
    
    def test_server_status_detection(self):
        """Test server running status detection."""
        # Test when not running
        is_running, pid = self.manager.is_server_running()
        self.assertFalse(is_running)
        self.assertIsNone(pid)
    
    def test_session_management(self):
        """Test session tracking and management."""
        session_id1 = "test-session-1"
        session_id2 = "test-session-2"
        
        # Add sessions
        with self.manager.lock:
            self.manager.active_sessions.add(session_id1)
            self.manager.active_sessions.add(session_id2)
        
        self.assertEqual(len(self.manager.active_sessions), 2)
        self.assertIn(session_id1, self.manager.active_sessions)
        self.assertIn(session_id2, self.manager.active_sessions)
        
        # Remove session
        with self.manager.lock:
            self.manager.active_sessions.discard(session_id1)
        
        self.assertEqual(len(self.manager.active_sessions), 1)
        self.assertNotIn(session_id1, self.manager.active_sessions)
    
    def test_server_status_reporting(self):
        """Test server status reporting functionality."""
        status = self.manager.get_server_status()
        
        # Check required fields
        self.assertIn("running", status)
        self.assertIn("pid", status)
        self.assertIn("active_sessions", status)
        self.assertIn("session_ids", status)
        self.assertIn("pid_file", status)
        self.assertIn("server_script", status)
        self.assertIn("health_endpoint", status)
        
        # Check types
        self.assertIsInstance(status["running"], bool)
        self.assertIsInstance(status["active_sessions"], int)
        self.assertIsInstance(status["session_ids"], list)
        self.assertEqual(status["active_sessions"], len(status["session_ids"]))


class TestNonBlockingBehavior(unittest.TestCase):
    """Test critical non-blocking behavior requirements."""
    
    def setUp(self):
        """Set up test environment."""
        self.session_id = "test-non-blocking-session"
    
    def test_start_server_non_blocking_timing(self):
        """Test that server startup doesn't block Claude Code (< 100ms)."""
        start_time = time.perf_counter()
        
        # This should return quickly regardless of actual server startup
        result = start_chronicle_server_if_needed(self.session_id)
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Critical requirement: must complete in under 100ms
        self.assertLess(execution_time_ms, 100, 
                       f"Server startup took {execution_time_ms:.2f}ms, exceeding 100ms limit")
        
        # Should return boolean result
        self.assertIsInstance(result, bool)
    
    def test_stop_server_non_blocking_timing(self):
        """Test that server session stop doesn't block Claude Code."""
        start_time = time.perf_counter()
        
        # This should return quickly
        stop_chronicle_server_session(self.session_id)
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Should be very fast since it's just tracking
        self.assertLess(execution_time_ms, 10, 
                       f"Server session stop took {execution_time_ms:.2f}ms")
    
    def test_status_check_performance(self):
        """Test that status checks are reasonably fast."""
        start_time = time.perf_counter()
        
        status = get_chronicle_server_status()
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Status check should be fast
        self.assertLess(execution_time_ms, 50, 
                       f"Status check took {execution_time_ms:.2f}ms")
        
        # Should return dict with required fields
        self.assertIsInstance(status, dict)
        self.assertIn("running", status)
    
    def test_graceful_failure_handling(self):
        """Test that failures don't raise exceptions that would block Claude Code."""
        # Test with invalid session data
        try:
            result = start_chronicle_server_if_needed("")
            # Should not raise exception
            self.assertIsInstance(result, bool)
        except Exception as e:
            self.fail(f"start_chronicle_server_if_needed raised exception: {e}")
        
        try:
            stop_chronicle_server_session("")
            # Should not raise exception
        except Exception as e:
            self.fail(f"stop_chronicle_server_session raised exception: {e}")
        
        try:
            status = get_chronicle_server_status()
            # Should not raise exception
            self.assertIsInstance(status, dict)
        except Exception as e:
            self.fail(f"get_chronicle_server_status raised exception: {e}")


class TestSessionLifecycleIntegration(unittest.TestCase):
    """Test session lifecycle integration."""
    
    def setUp(self):
        """Set up test environment."""
        self.manager = get_server_manager()
        self.test_sessions = []
    
    def tearDown(self):
        """Clean up test sessions."""
        for session_id in self.test_sessions:
            try:
                stop_chronicle_server_session(session_id)
            except:
                pass
    
    def test_single_session_lifecycle(self):
        """Test single session start and stop."""
        session_id = "test-single-session"
        self.test_sessions.append(session_id)
        
        # Start session
        start_result = start_chronicle_server_if_needed(session_id)
        self.assertTrue(start_result)
        
        # Session should be tracked
        status = self.manager.get_server_status()
        self.assertIn(session_id, status["session_ids"])
        
        # Stop session
        stop_chronicle_server_session(session_id)
        
        # Session should be removed
        status = self.manager.get_server_status()
        self.assertNotIn(session_id, status["session_ids"])
    
    def test_multiple_session_lifecycle(self):
        """Test multiple concurrent sessions."""
        session_ids = ["test-multi-1", "test-multi-2", "test-multi-3"]
        self.test_sessions.extend(session_ids)
        
        # Start all sessions
        for session_id in session_ids:
            result = start_chronicle_server_if_needed(session_id)
            self.assertTrue(result)
        
        # All sessions should be tracked
        status = self.manager.get_server_status()
        for session_id in session_ids:
            self.assertIn(session_id, status["session_ids"])
        
        # Stop sessions one by one
        for i, session_id in enumerate(session_ids):
            stop_chronicle_server_session(session_id)
            
            status = self.manager.get_server_status()
            remaining_sessions = session_ids[i+1:]
            
            # Check remaining sessions
            self.assertEqual(len(status["session_ids"]), len(remaining_sessions))
            for remaining_id in remaining_sessions:
                self.assertIn(remaining_id, status["session_ids"])
    
    def test_session_restart_after_stop(self):
        """Test starting a session after it was stopped."""
        session_id = "test-restart-session"
        self.test_sessions.append(session_id)
        
        # Start, stop, start again
        start_chronicle_server_if_needed(session_id)
        stop_chronicle_server_session(session_id)
        
        # Should be able to start again
        result = start_chronicle_server_if_needed(session_id)
        self.assertTrue(result)
        
        status = self.manager.get_server_status()
        self.assertIn(session_id, status["session_ids"])


class TestHealthCheckSystem(unittest.TestCase):
    """Test health check and monitoring functionality."""
    
    def test_health_checker_initialization(self):
        """Test health checker initializes correctly."""
        checker = ChronicleHealthChecker()
        self.assertEqual(checker.timeout, 5)  # default timeout
        self.assertEqual(len(checker.results), 0)
        
        # Test custom timeout
        custom_checker = ChronicleHealthChecker(timeout=10)
        self.assertEqual(custom_checker.timeout, 10)
    
    def test_quick_health_check_performance(self):
        """Test quick health check performance."""
        start_time = time.perf_counter()
        
        result = run_quick_health_check()
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Quick check should be fast
        self.assertLess(execution_time_ms, 5000, 
                       f"Quick health check took {execution_time_ms:.2f}ms")
        
        # Should return boolean
        self.assertIsInstance(result, bool)
    
    def test_comprehensive_health_check_structure(self):
        """Test comprehensive health check returns proper structure."""
        checker = ChronicleHealthChecker(timeout=2)  # Short timeout for tests
        results = checker.run_all_checks()
        
        # Check top-level structure
        self.assertIn("summary", results)
        self.assertIn("details", results)
        
        # Check summary structure
        summary = results["summary"]
        required_summary_fields = [
            "overall_healthy", "total_checks", "passed_checks", 
            "failed_checks", "timestamp", "execution_summary"
        ]
        for field in required_summary_fields:
            self.assertIn(field, summary)
        
        # Check details structure
        details = results["details"]
        expected_checks = [
            "server_status", "server_health", "server_endpoints",
            "database_connectivity", "process_management", 
            "network_connectivity", "hook_system"
        ]
        
        for check_name in expected_checks:
            self.assertIn(check_name, details)
            check_result = details[check_name]
            
            # Each check should have required fields
            required_fields = [
                "check_name", "success", "error", "details", 
                "execution_time_ms", "timestamp"
            ]
            for field in required_fields:
                self.assertIn(field, check_result)


class TestProcessCleanup(unittest.TestCase):
    """Test process cleanup and resource management."""
    
    def test_pid_file_cleanup_on_failure(self):
        """Test PID file gets cleaned up when process is not running."""
        manager = ChronicleServerManager()
        test_pid_file = Path(tempfile.gettempdir()) / "test_cleanup_pid.pid"
        manager.pid_file_path = test_pid_file
        
        try:
            # Create fake PID file with non-existent PID
            fake_pid = 99999
            manager._write_pid_file(fake_pid)
            self.assertTrue(test_pid_file.exists())
            
            # Check server status should clean up stale PID file
            is_running, pid = manager.is_server_running()
            
            # Should detect not running and clean up
            self.assertFalse(is_running)
            # PID file should be cleaned up automatically
            self.assertFalse(test_pid_file.exists())
            
        finally:
            # Ensure cleanup
            if test_pid_file.exists():
                test_pid_file.unlink()
    
    def test_shutdown_timer_cancellation(self):
        """Test shutdown timer gets cancelled properly."""
        manager = ChronicleServerManager()
        
        # Start a session (should cancel any existing timer)
        session_id = "test-timer-session"
        manager.start_server_async(session_id)
        
        # End session (should schedule shutdown)
        manager.stop_server_session(session_id)
        
        # Start another session quickly (should cancel timer)
        new_session_id = "test-timer-session-2"
        manager.start_server_async(new_session_id)
        
        # Verify timer was cancelled (no way to directly test this, 
        # but we can check that shutdown doesn't happen)
        time.sleep(0.1)  # Small delay
        
        # Should still have active session
        self.assertIn(new_session_id, manager.active_sessions)


class TestErrorHandling(unittest.TestCase):
    """Test error handling and graceful failure scenarios."""
    
    def test_missing_server_script_handling(self):
        """Test handling when server script is missing."""
        manager = ChronicleServerManager()
        # Set to non-existent path
        manager.server_script_path = Path("/non/existent/server.py")
        
        # Should not raise exception
        result = manager.start_server_async("test-session")
        self.assertTrue(result)  # Thread starts successfully
        
        # Wait a bit for background thread
        time.sleep(0.5)
        
        # Should handle gracefully - no server process should be created
        self.assertIsNone(manager.server_process)
    
    def test_permission_error_handling(self):
        """Test handling of permission errors."""
        manager = ChronicleServerManager()
        
        # Test with read-only directory for PID file
        try:
            import tempfile
            read_only_dir = Path(tempfile.mkdtemp())
            read_only_pid_file = read_only_dir / "test.pid"
            
            # Make directory read-only
            read_only_dir.chmod(0o444)
            
            manager.pid_file_path = read_only_pid_file
            
            # Should handle permission error gracefully
            manager._write_pid_file(12345)
            # Should not crash, may or may not succeed depending on system
            
        except Exception as e:
            # Should not propagate exceptions
            self.fail(f"Permission error not handled gracefully: {e}")
        
        finally:
            # Cleanup
            try:
                read_only_dir.chmod(0o755)  # Restore permissions
                if read_only_dir.exists():
                    read_only_dir.rmdir()
            except:
                pass


if __name__ == "__main__":
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add test cases in order of importance
    suite.addTest(unittest.makeSuite(TestNonBlockingBehavior))
    suite.addTest(unittest.makeSuite(TestChronicleServerManager))
    suite.addTest(unittest.makeSuite(TestSessionLifecycleIntegration))
    suite.addTest(unittest.makeSuite(TestHealthCheckSystem))
    suite.addTest(unittest.makeSuite(TestProcessCleanup))
    suite.addTest(unittest.makeSuite(TestErrorHandling))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n{'='*60}")
    print("CHR-41 AUTO-START/STOP MECHANISM TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success Rate: {(result.testsRun - len(result.failures) - len(result.errors))/result.testsRun*100:.1f}%")
    
    if result.failures:
        print(f"\nFailures: {len(result.failures)}")
        for test, traceback in result.failures:
            print(f"  - {test}: {traceback.split('AssertionError: ')[-1].split('\\n')[0] if 'AssertionError:' in traceback else 'See details above'}")
    
    if result.errors:
        print(f"\nErrors: {len(result.errors)}")
        for test, traceback in result.errors:
            print(f"  - {test}: {traceback.split('Exception: ')[-1].split('\\n')[0] if 'Exception:' in traceback else 'See details above'}")
    
    print(f"{'='*60}")
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)