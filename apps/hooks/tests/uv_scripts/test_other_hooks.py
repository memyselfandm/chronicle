#!/usr/bin/env python3
"""
Tests for remaining UV hooks: notification, stop, subagent_stop, and pre_compact.

Tests notification handling, session lifecycle, and compaction triggers.
"""

import json
import pytest
from test_utils import (
    HookTestCase, assert_performance, assert_valid_hook_response,
    temp_env_vars, temp_sqlite_db
)


class TestNotificationHook:
    """Test cases for Notification hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("Notification", "notification.py")
    
    def test_basic_notification(self, test_env):
        """Test basic notification handling."""
        input_data = self.hook.create_test_input(
            message="Claude needs your permission to use Bash"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert_valid_hook_response(response)
    
    def test_idle_notification(self, test_env):
        """Test idle notification."""
        input_data = self.hook.create_test_input(
            message="Claude is waiting for your input"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_permission_request_notification(self, test_env):
        """Test tool permission request notifications."""
        permission_messages = [
            "Claude needs your permission to use Bash",
            "Claude needs your permission to use Write",
            "Claude needs your permission to use WebFetch"
        ]
        
        for message in permission_messages:
            input_data = self.hook.create_test_input(message=message)
            
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            
            assert exit_code == 0
            assert_performance(exec_time)
    
    def test_empty_notification(self, test_env):
        """Test handling of empty notification."""
        input_data = self.hook.create_test_input(message="")
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should handle gracefully
        assert exit_code == 0
        assert_performance(exec_time)
    
    @pytest.mark.integration
    def test_notification_logging(self, test_env, sqlite_db):
        """Test that notifications are logged."""
        input_data = self.hook.create_test_input(
            message="Test notification for logging"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        
        # Verify notification was logged
        import sqlite3
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM events WHERE event_type = 'notification'"
            )
            count = cursor.fetchone()[0]
            assert count > 0


class TestStopHook:
    """Test cases for Stop hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("Stop", "stop.py")
    
    def test_basic_stop(self, test_env):
        """Test basic stop functionality."""
        input_data = self.hook.create_test_input(
            stopHookActive=False
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert_valid_hook_response(response)
    
    def test_stop_with_continuation(self, test_env):
        """Test stop hook that requests continuation."""
        input_data = self.hook.create_test_input(
            stopHookActive=False
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        
        # Check if hook decides to block stopping
        if "decision" in response:
            assert response["decision"] in ["block", None]
            if response["decision"] == "block":
                assert "reason" in response
                assert isinstance(response["reason"], str)
    
    def test_stop_hook_active_flag(self, test_env):
        """Test behavior when stop hook is already active."""
        input_data = self.hook.create_test_input(
            stopHookActive=True
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        
        # Should not block when already active (prevent infinite loop)
        if "decision" in response:
            assert response["decision"] != "block"
    
    @pytest.mark.integration
    def test_session_end_logging(self, test_env, sqlite_db):
        """Test that session end is logged."""
        input_data = self.hook.create_test_input(
            stopHookActive=False
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        
        # Check for stop event
        import sqlite3
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM events WHERE event_type = 'stop'"
            )
            count = cursor.fetchone()[0]
            assert count > 0


class TestSubagentStopHook:
    """Test cases for SubagentStop hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("SubagentStop", "subagent_stop.py")
    
    def test_basic_subagent_stop(self, test_env):
        """Test basic subagent stop functionality."""
        input_data = self.hook.create_test_input(
            taskId="task-123",
            taskDescription="Analyze code for bugs"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert_valid_hook_response(response)
    
    def test_subagent_continuation_decision(self, test_env):
        """Test subagent stop with continuation decision."""
        input_data = self.hook.create_test_input(
            taskId="task-456",
            taskDescription="Complex analysis task",
            stopHookActive=False
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        
        # Check decision logic
        if "decision" in response:
            assert response["decision"] in ["block", None]
            if response["decision"] == "block":
                assert "reason" in response


class TestPreCompactHook:
    """Test cases for PreCompact hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("PreCompact", "pre_compact.py")
    
    def test_manual_compact(self, test_env):
        """Test manual compaction trigger."""
        input_data = self.hook.create_test_input(
            trigger="manual",
            customInstructions="Keep recent conversation context"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert_valid_hook_response(response)
    
    def test_auto_compact(self, test_env):
        """Test automatic compaction trigger."""
        input_data = self.hook.create_test_input(
            trigger="auto",
            customInstructions=""
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_compact_with_custom_instructions(self, test_env):
        """Test compaction with custom instructions."""
        input_data = self.hook.create_test_input(
            trigger="manual",
            customInstructions="Focus on keeping error messages and debugging context"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        
        # Hook might add additional context or modify behavior
        if "hookSpecificOutput" in response:
            assert response["hookSpecificOutput"]["hookEventName"] == "PreCompact"
    
    def test_invalid_trigger(self, test_env):
        """Test handling of invalid trigger type."""
        input_data = self.hook.create_test_input(
            trigger="invalid_trigger",
            customInstructions=""
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should handle gracefully
        assert exit_code == 0
        assert_performance(exec_time)
    
    @pytest.mark.integration
    def test_compact_event_logging(self, test_env, sqlite_db):
        """Test that compaction events are logged."""
        for trigger in ["manual", "auto"]:
            input_data = self.hook.create_test_input(
                trigger=trigger,
                customInstructions="Test compaction"
            )
            
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            
            assert exit_code == 0
        
        # Verify events were logged
        import sqlite3
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute(
                "SELECT data FROM events WHERE event_type = 'pre_compact'"
            )
            rows = cursor.fetchall()
            assert len(rows) >= 2
            
            # Check trigger types were captured
            triggers_found = set()
            for row in rows:
                event_data = json.loads(row[0])
                if "trigger" in event_data:
                    triggers_found.add(event_data["trigger"])
            
            assert "manual" in triggers_found
            assert "auto" in triggers_found


@pytest.mark.performance
class TestAllHooksPerformance:
    """Performance tests across all hooks."""
    
    def test_all_hooks_under_100ms(self, test_env):
        """Test that all hooks execute under 100ms."""
        hooks = [
            ("SessionStart", "session_start.py", {"source": "startup"}),
            ("PreToolUse", "pre_tool_use.py", {"toolName": "Read", "toolInput": {}}),
            ("PostToolUse", "post_tool_use.py", {"toolName": "Read", "toolInput": {}, "toolResponse": {}}),
            ("UserPromptSubmit", "user_prompt_submit.py", {"prompt": "test"}),
            ("Notification", "notification.py", {"message": "test"}),
            ("Stop", "stop.py", {"stopHookActive": False}),
            ("SubagentStop", "subagent_stop.py", {"taskId": "test"}),
            ("PreCompact", "pre_compact.py", {"trigger": "manual"})
        ]
        
        for hook_name, script_name, extra_data in hooks:
            hook = HookTestCase(hook_name, script_name)
            input_data = hook.create_test_input(**extra_data)
            
            # Run multiple times to get average
            times = []
            for _ in range(5):
                exit_code, stdout, stderr, exec_time = hook.run_hook(input_data)
                assert exit_code == 0, f"{hook_name} failed: {stderr}"
                times.append(exec_time)
            
            avg_time = sum(times) / len(times)
            assert avg_time < 100, f"{hook_name} average time {avg_time:.2f}ms exceeds 100ms"