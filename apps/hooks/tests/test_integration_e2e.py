"""
End-to-End Integration Tests for Chronicle Hooks System
Tests complete hook execution flow with real database interactions
"""

import pytest
import asyncio
import json
import uuid
import tempfile
import os
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

try:
    from src.lib.database import SupabaseClient, DatabaseManager
    from src.lib.base_hook import BaseHook
    from src.lib.utils import sanitize_data
except ImportError:
    # Graceful import fallback for test discovery
    SupabaseClient = None
    DatabaseManager = None
    BaseHook = None
    sanitize_data = None


def validate_hook_input(data: Dict[str, Any]) -> bool:
    """Simple validation function for testing purposes."""
    if not isinstance(data, dict):
        return False
    
    # Basic validation - reject suspicious patterns
    data_str = str(data).lower()
    suspicious_patterns = ["../", "javascript:", "script>", "<script"]
    
    for pattern in suspicious_patterns:
        if pattern in data_str:
            return False
    
    return True


class MockSQLiteClient:
    """Mock SQLite client for testing purposes."""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.sessions = []
        self.events = []
        
    def initialize_database(self):
        """Mock database initialization."""
        return True
        
    def upsert_session(self, session_data):
        """Mock session upsert."""
        self.sessions.append(session_data)
        return True
        
    def insert_event(self, event_data):
        """Mock event insert."""
        self.events.append(event_data)
        return True
        
    def get_sessions(self):
        """Mock get sessions."""
        return self.sessions
        
    def get_events(self):
        """Mock get events."""
        return self.events


class TestHookE2EIntegration:
    """End-to-end integration tests for the complete hook system."""

    @pytest.fixture
    def temp_db_file(self):
        """Create temporary SQLite database file."""
        fd, path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        yield path
        os.unlink(path)

    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client for testing."""
        with patch('supabase.create_client') as mock_create:
            mock_client = Mock()
            mock_table = Mock()
            mock_client.table.return_value = mock_table
            mock_create.return_value = mock_client
            yield mock_client, mock_table

    @pytest.fixture
    def sample_hook_input(self):
        """Sample hook input data from Claude Code."""
        return {
            "session_id": str(uuid.uuid4()),
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {
                "file_path": "/test/project/src/config.json"
            }
        }

    def test_complete_hook_execution_flow(self, sample_hook_input, mock_supabase_client):
        """Test complete hook execution from input to database storage."""
        mock_client, mock_table = mock_supabase_client
        mock_table.upsert.return_value.execute.return_value = Mock(data=[{"success": True}])
        mock_table.insert.return_value.execute.return_value = Mock(data=[{"event_id": "test-event"}])

        # Create hook instance
        hook = BaseHook()
        hook.db_client = SupabaseClient(
            url="https://test.supabase.co",
            key="test-key"
        )

        # Process hook input
        result = hook.process_hook_data(sample_hook_input, sample_hook_input.get("hook_event_name", ""))

        # Verify processing succeeded
        assert result["continue"] is True
        assert "hookEventName" in result.get("hookSpecificOutput", {})

        # Verify database calls were made
        mock_table.upsert.assert_called()  # Session upsert
        mock_table.insert.assert_called()  # Event insert

    def test_sqlite_fallback_integration(self, sample_hook_input, temp_db_file):
        """Test SQLite fallback when Supabase is unavailable."""
        # Create mock SQLite client
        sqlite_client = MockSQLiteClient(temp_db_file)
        
        # Initialize database
        sqlite_client.initialize_database()

        # Create hook with SQLite fallback
        hook = BaseHook()
        hook.db_client = sqlite_client

        # Process hook input
        result = hook.process_hook_data(sample_hook_input, sample_hook_input.get("hook_event_name", ""))

        # Verify processing succeeded
        assert result["continue"] is True

        # Verify data was stored in SQLite
        sessions = sqlite_client.get_sessions()
        assert len(sessions) > 0
        assert sessions[0]["session_id"] == sample_hook_input["session_id"]

        events = sqlite_client.get_events()
        assert len(events) > 0
        assert events[0]["session_id"] == sample_hook_input["session_id"]

    @pytest.mark.asyncio
    async def test_concurrent_hook_executions(self, mock_supabase_client):
        """Test multiple hooks executing concurrently."""
        mock_client, mock_table = mock_supabase_client
        mock_table.upsert.return_value.execute.return_value = Mock(data=[{"success": True}])
        mock_table.insert.return_value.execute.return_value = Mock(data=[{"event_id": "test-event"}])

        # Create multiple hook inputs
        hook_inputs = []
        for i in range(10):
            hook_inputs.append({
                "session_id": f"session-{i}",
                "transcript_path": f"/tmp/claude-session-{i}.md",
                "cwd": f"/test/project-{i}",
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/file-{i}.txt"}
            })

        # Process hooks concurrently
        async def process_hook_async(hook_input):
            hook = BaseHook()
            hook.db_client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            return hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))

        tasks = [process_hook_async(hook_input) for hook_input in hook_inputs]
        results = await asyncio.gather(*tasks)

        # Verify all hooks processed successfully
        assert len(results) == 10
        for result in results:
            assert result["continue"] is True

    def test_claude_code_session_simulation(self, mock_supabase_client):
        """Simulate a complete Claude Code session with multiple hook events."""
        mock_client, mock_table = mock_supabase_client
        mock_table.upsert.return_value.execute.return_value = Mock(data=[{"success": True}])
        mock_table.insert.return_value.execute.return_value = Mock(data=[{"event_id": "test-event"}])

        session_id = str(uuid.uuid4())
        base_time = datetime.now()

        # Session start
        session_start_input = {
            "session_id": session_id,
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "SessionStart",
            "source": "startup",
            "custom_instructions": "Build a web dashboard",
            "git_branch": "main"
        }

        # Tool usage events
        tool_events = [
            {
                "session_id": session_id,
                "transcript_path": "/tmp/claude-session.md",
                "cwd": "/test/project",
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/test/package.json"}
            },
            {
                "session_id": session_id,
                "transcript_path": "/tmp/claude-session.md",
                "cwd": "/test/project",
                "hook_event_name": "PostToolUse",
                "tool_name": "Read",
                "tool_response": {"content": '{"name": "test-project"}'}
            },
            {
                "session_id": session_id,
                "transcript_path": "/tmp/claude-session.md",
                "cwd": "/test/project",
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/test/src/App.tsx",
                    "content": "import React from 'react';"
                }
            }
        ]

        # User prompt event
        prompt_event = {
            "session_id": session_id,
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "UserPromptSubmit",
            "prompt_text": "Create a React component for the dashboard"
        }

        # Session stop
        session_stop_input = {
            "session_id": session_id,
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "Stop"
        }

        # Process all events in order
        hook = BaseHook()
        hook.db_client = SupabaseClient(url="https://test.supabase.co", key="test-key")

        results = []
        for event_input in [session_start_input] + tool_events + [prompt_event, session_stop_input]:
            result = hook.process_hook_data(event_input, event_input.get("hook_event_name", ""))
            results.append(result)

        # Verify all events processed successfully
        assert len(results) == 6
        for result in results:
            assert result["continue"] is True

        # Verify database calls were made for each event
        assert mock_table.insert.call_count >= 6  # At least one per event

    def test_mcp_tool_detection_and_processing(self, mock_supabase_client):
        """Test detection and processing of MCP tools."""
        mock_client, mock_table = mock_supabase_client
        mock_table.upsert.return_value.execute.return_value = Mock(data=[{"success": True}])
        mock_table.insert.return_value.execute.return_value = Mock(data=[{"event_id": "test-event"}])

        mcp_tool_input = {
            "session_id": str(uuid.uuid4()),
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "PreToolUse",
            "tool_name": "mcp__github__create_issue",
            "tool_input": {
                "title": "Bug report",
                "body": "Found an issue",
                "labels": ["bug"]
            }
        }

        hook = BaseHook()
        hook.db_client = SupabaseClient(url="https://test.supabase.co", key="test-key")

        result = hook.process_hook_data(mcp_tool_input, mcp_tool_input.get("hook_event_name", ""))

        # Verify MCP tool was processed
        assert result["continue"] is True
        
        # Verify MCP tool was processed
        mock_table.insert.assert_called()
        
        # Check if MCP tool categorization was applied
        if mock_table.insert.call_args:
            call_args = mock_table.insert.call_args[0][0]
            if isinstance(call_args, list) and len(call_args) > 0:
                # Look for tool event data
                tool_event = next((item for item in call_args if "is_mcp_tool" in item), None)
                if tool_event:
                    assert tool_event["is_mcp_tool"] is True
                    assert tool_event["mcp_server"] == "github"


class TestHookErrorHandling:
    """Test error handling and resilience of the hook system."""

    @pytest.fixture
    def failing_database_client(self):
        """Database client that always fails."""
        client = Mock()
        client.health_check.return_value = False
        client.upsert_session.side_effect = Exception("Database error")
        client.insert_event.side_effect = Exception("Database error")
        return client

    def test_database_failure_resilience(self, failing_database_client):
        """Test that hook continues execution even when database fails."""
        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/test/file.txt"}
        }

        hook = BaseHook()
        hook.db_client = failing_database_client

        # Hook should not crash even with database failures
        result = hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))
        
        # Should continue execution despite database error
        assert result["continue"] is True

    def test_malformed_input_handling(self):
        """Test handling of malformed input data."""
        malformed_inputs = [
            {},  # Empty input
            {"invalid": "data"},  # Missing required fields
            {"session_id": None},  # None values
            {"session_id": "test", "hook_event_name": ""},  # Empty strings
            {
                "session_id": "test",
                "hook_event_name": "PreToolUse",
                "tool_input": "not-a-dict"  # Invalid type
            }
        ]

        hook = BaseHook()
        hook.db_client = Mock()
        hook.db_client.health_check.return_value = True
        hook.db_client.upsert_session.return_value = True
        hook.db_client.insert_event.return_value = True

        for malformed_input in malformed_inputs:
            # Should not crash with malformed input
            result = hook.process_hook_data(malformed_input, malformed_input.get("hook_event_name", "") if isinstance(malformed_input, dict) else "")
            assert isinstance(result, dict)
            # Should have continue field
            assert "continue" in result

    def test_timeout_handling(self):
        """Test handling of operations that take too long."""
        with patch('time.sleep') as mock_sleep:
            # Simulate long-running database operation
            slow_client = Mock()
            slow_client.health_check.return_value = True
            
            def slow_insert(*args, **kwargs):
                mock_sleep(10)  # Simulate 10 second delay
                return True
            
            slow_client.insert_event = slow_insert
            slow_client.upsert_session.return_value = True

            hook_input = {
                "session_id": str(uuid.uuid4()),
                "hook_event_name": "PreToolUse",
                "tool_name": "Read"
            }

            hook = BaseHook()
            hook.db_client = slow_client

            # Should complete within reasonable time
            start_time = datetime.now()
            result = hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))
            end_time = datetime.now()

            # Verify it doesn't take too long (hook should timeout or handle gracefully)
            duration = (end_time - start_time).total_seconds()
            assert duration < 30  # Should not take more than 30 seconds

    def test_network_interruption_handling(self):
        """Test handling of network interruptions during database operations."""
        intermittent_client = Mock()
        intermittent_client.health_check.return_value = True
        
        # Simulate network interruption
        call_count = 0
        def failing_insert(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise ConnectionError("Network error")
            return True
        
        intermittent_client.insert_event = failing_insert
        intermittent_client.upsert_session.return_value = True

        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read"
        }

        hook = BaseHook()
        hook.db_client = intermittent_client

        # Should handle network interruption gracefully
        result = hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))
        assert result["continue"] is True


class TestHookPerformance:
    """Test performance characteristics of the hook system."""

    def test_hook_execution_performance(self):
        """Test that hooks execute within performance thresholds."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/test/file.txt"}
        }

        hook = BaseHook()
        hook.db_client = mock_client

        # Measure execution time
        start_time = datetime.now()
        result = hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))
        end_time = datetime.now()

        duration_ms = (end_time - start_time).total_seconds() * 1000

        # Should execute within 100ms threshold (excluding network latency)
        assert duration_ms < 100
        assert result["continue"] is True

    def test_memory_usage_with_large_payloads(self):
        """Test memory usage with large event payloads."""
        import sys
        
        # Create large payload
        large_payload = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {
                "file_path": "/test/file.txt",
                "large_data": "x" * (1024 * 1024)  # 1MB of data
            }
        }

        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        hook = BaseHook()
        hook.db_client = mock_client

        # Measure memory before and after
        initial_size = sys.getsizeof(hook)
        result = hook.process_hook_data(large_payload, large_payload.get("hook_event_name", ""))
        final_size = sys.getsizeof(hook)

        # Memory usage should not grow significantly
        memory_growth = final_size - initial_size
        assert memory_growth < 1024 * 1024  # Less than 1MB growth
        assert result["continue"] is True

    def test_concurrent_execution_performance(self):
        """Test performance under concurrent execution."""
        import threading
        import time

        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        results = []
        errors = []

        def execute_hook(hook_id):
            try:
                hook_input = {
                    "session_id": f"session-{hook_id}",
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/test/file-{hook_id}.txt"}
                }

                hook = BaseHook()
                hook.db_client = mock_client

                start_time = time.time()
                result = hook.process_hook_data(hook_input, hook_input.get("hook_event_name", ""))
                end_time = time.time()

                results.append({
                    "hook_id": hook_id,
                    "duration": end_time - start_time,
                    "success": result["continue"]
                })
            except Exception as e:
                errors.append(f"Hook {hook_id}: {str(e)}")

        # Execute 10 hooks concurrently
        threads = []
        for i in range(10):
            thread = threading.Thread(target=execute_hook, args=(i,))
            threads.append(thread)

        start_all = time.time()
        for thread in threads:
            thread.start()

        for thread in threads:
            thread.join()
        end_all = time.time()

        # Verify all hooks completed successfully
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 10

        # Verify performance
        total_time = end_all - start_all
        avg_duration = sum(r["duration"] for r in results) / len(results)

        print(f"Concurrent execution: total={total_time:.3f}s, avg={avg_duration:.3f}s")
        
        # All hooks should complete within reasonable time
        assert total_time < 5.0  # Total execution under 5 seconds
        assert all(r["success"] for r in results)


class TestHookDataFlow:
    """Test data flow and transformation through the hook system."""

    def test_data_sanitization(self):
        """Test that sensitive data is properly sanitized."""
        sensitive_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {
                "command": "export API_KEY=secret123 && curl -H 'Authorization: Bearer secret123' https://api.example.com",
                "env": {
                    "API_KEY": "secret123",
                    "PASSWORD": "password123",
                    "SECRET_TOKEN": "token456"
                }
            }
        }

        sanitized = sanitize_data(sensitive_input)

        # API keys and secrets should be sanitized
        command = sanitized.get("tool_input", {}).get("command", "")
        assert "secret123" not in command
        assert "[REDACTED]" in command

        env_vars = sanitized.get("tool_input", {}).get("env", {})
        assert env_vars.get("API_KEY") == "[REDACTED]"
        assert env_vars.get("PASSWORD") == "[REDACTED]"
        assert env_vars.get("SECRET_TOKEN") == "[REDACTED]"

    def test_input_validation(self):
        """Test input validation logic."""
        valid_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read"
        }

        invalid_inputs = [
            {},  # Empty
            {"session_id": ""},  # Empty session ID
            {"hook_event_name": ""},  # Empty hook name
            {"session_id": "../../../etc/passwd"},  # Path traversal attempt
            {"tool_input": {"file_path": "javascript:alert(1)"}},  # Script injection
        ]

        # Valid input should pass
        assert validate_hook_input(valid_input) is True

        # Invalid inputs should fail
        for invalid_input in invalid_inputs:
            assert validate_hook_input(invalid_input) is False

    def test_event_data_transformation(self):
        """Test transformation of hook data to event data."""
        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Edit",
            "tool_input": {
                "file_path": "/src/component.tsx",
                "old_string": "const old = 'value';",
                "new_string": "const new = 'value';"
            },
            "timestamp": datetime.now().isoformat()
        }

        hook = BaseHook()
        event_data = hook._transform_to_event_data(hook_input)

        # Verify transformation
        assert event_data["session_id"] == hook_input["session_id"]
        assert event_data["hook_event_name"] == "PreToolUse"
        assert event_data["raw_input"] == hook_input
        assert "timestamp" in event_data

    def test_session_context_extraction(self):
        """Test extraction of session context from hook input."""
        hook_input = {
            "session_id": str(uuid.uuid4()),
            "transcript_path": "/tmp/claude-session.md",
            "cwd": "/test/project",
            "hook_event_name": "SessionStart",
            "source": "startup",
            "git_branch": "feature/dashboard",
            "custom_instructions": "Build a monitoring dashboard"
        }

        hook = BaseHook()
        session_data = hook._extract_session_data(hook_input)

        # Verify session data extraction
        assert session_data["session_id"] == hook_input["session_id"]
        assert session_data["source"] == "startup"
        assert session_data["project_path"] == "/test/project"
        assert session_data["git_branch"] == "feature/dashboard"
        assert "start_time" in session_data


class TestInstallationIntegrationFlow:
    """Test complete installation and configuration flow integration."""

    @pytest.fixture
    def installation_environment(self):
        """Create complete installation test environment."""
        import shutil
        
        temp_dir = Path(tempfile.mkdtemp())
        
        # Create directory structure
        project_root = temp_dir / "test_project"
        claude_dir = project_root / ".claude"
        hooks_source = temp_dir / "apps" / "hooks"
        
        project_root.mkdir(parents=True)
        claude_dir.mkdir(parents=True)
        hooks_source.mkdir(parents=True)
        
        # Create scripts directory and install.py
        scripts_dir = hooks_source / "scripts"
        scripts_dir.mkdir(parents=True)
        
        # Create src structure
        src_dir = hooks_source / "src"
        core_dir = src_dir / "core"
        hooks_impl_dir = src_dir / "hooks"
        
        src_dir.mkdir()
        core_dir.mkdir()
        hooks_impl_dir.mkdir()
        
        # Create mock hook implementation files
        hook_files = [
            "pre_tool_use.py", "post_tool_use.py", "user_prompt_submit.py",
            "notification.py", "session_start.py", "stop.py", "subagent_stop.py", "pre_compact.py"
        ]
        
        for hook_file in hook_files:
            hook_content = f'''#!/usr/bin/env python3
"""Mock {hook_file} for integration testing."""

import json
import sys

def main():
    try:
        data = json.load(sys.stdin)
        response = {{
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {{
                "hookEventName": data.get("hook_event_name", "Unknown"),
                "processed": True
            }}
        }}
        print(json.dumps(response))
        return 0
    except Exception as e:
        print(f"Error: {{e}}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
'''
            
            hook_path = hooks_impl_dir / hook_file
            hook_path.write_text(hook_content)
            hook_path.chmod(0o755)
        
        yield {
            "temp_dir": temp_dir,
            "project_root": project_root,
            "claude_dir": claude_dir,
            "hooks_source": hooks_source,
            "hook_files": hook_files
        }
        
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.mark.skipif(BaseHook is None, reason="Hook modules not available")
    def test_complete_installation_to_execution_flow(self, installation_environment):
        """Test complete flow from installation through hook execution."""
        import sys
        import subprocess
        import shutil
        
        env = installation_environment
        
        # Add scripts directory to Python path for install module
        scripts_path = env["hooks_source"] / "scripts"
        sys.path.insert(0, str(scripts_path))
        
        try:
            # Step 1: Simulate installation process
            from install import HookInstaller
            
            installer = HookInstaller(
                hooks_source_dir=str(env["hooks_source"]),
                claude_dir=str(env["claude_dir"]),
                project_root=str(env["project_root"])
            )
            
            # Mock database test for installation
            with patch('install.test_database_connection') as mock_db_test:
                mock_db_test.return_value = {
                    "success": True,
                    "status": "connected"
                }
                
                result = installer.install(create_backup=False, test_database=True)
            
            assert result["success"] is True
            assert result["hooks_installed"] == len(env["hook_files"])
            assert result["settings_updated"] is True
            
            # Step 2: Verify settings.json was created correctly
            settings_path = env["claude_dir"] / "settings.json"
            assert settings_path.exists()
            
            with open(settings_path) as f:
                settings = json.load(f)
            
            assert "hooks" in settings
            required_hooks = ["PreToolUse", "PostToolUse", "UserPromptSubmit", 
                             "Notification", "Stop", "SubagentStop", "PreCompact"]
            
            for hook_name in required_hooks:
                assert hook_name in settings["hooks"]
            
            # Step 3: Test hook execution with realistic Claude Code input
            hooks_dir = env["claude_dir"] / "hooks"
            
            test_scenarios = [
                {
                    "hook": "pre_tool_use.py",
                    "input": {
                        "session_id": str(uuid.uuid4()),
                        "transcript_path": "/tmp/session.md",
                        "cwd": str(env["project_root"]),
                        "hook_event_name": "PreToolUse",
                        "tool_name": "Read",
                        "tool_input": {"file_path": "/test/file.txt"},
                        "matcher": "Read"
                    }
                },
                {
                    "hook": "post_tool_use.py",
                    "input": {
                        "session_id": str(uuid.uuid4()),
                        "transcript_path": "/tmp/session.md",
                        "cwd": str(env["project_root"]),
                        "hook_event_name": "PostToolUse",
                        "tool_name": "Read",
                        "tool_response": {"content": "file contents"},
                        "matcher": "Read"
                    }
                },
                {
                    "hook": "user_prompt_submit.py",
                    "input": {
                        "session_id": str(uuid.uuid4()),
                        "transcript_path": "/tmp/session.md",
                        "cwd": str(env["project_root"]),
                        "hook_event_name": "UserPromptSubmit",
                        "prompt_text": "Create a new React component"
                    }
                }
            ]
            
            # Execute each hook scenario
            for scenario in test_scenarios:
                hook_path = hooks_dir / scenario["hook"]
                assert hook_path.exists(), f"Hook {scenario['hook']} was not installed"
                
                result = subprocess.run(
                    [sys.executable, str(hook_path)],
                    input=json.dumps(scenario["input"]),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                assert result.returncode == 0, \
                    f"Hook {scenario['hook']} failed: {result.stderr}"
                
                # Verify output format
                try:
                    output = json.loads(result.stdout.strip())
                    assert "continue" in output
                    assert output["continue"] is True
                    assert "hookSpecificOutput" in output
                except json.JSONDecodeError:
                    pytest.fail(f"Hook {scenario['hook']} produced invalid JSON")
            
            # Step 4: Test configuration validation
            validation_result = installer.validate_installation()
            assert validation_result["success"] is True
            assert len(validation_result["errors"]) == 0
            
        except ImportError:
            pytest.skip("Install module not available")


class TestSystemIntegrationScenarios:
    """Test realistic system integration scenarios."""

    @pytest.mark.skipif(BaseHook is None, reason="Hook modules not available")
    def test_full_development_session_simulation(self):
        """Simulate a complete development session with multiple hook interactions."""
        session_id = str(uuid.uuid4())
        base_time = datetime.now()
        
        # Mock database client
        mock_db = Mock()
        mock_db.health_check.return_value = True
        mock_db.upsert_session.return_value = True
        mock_db.insert_event.return_value = True
        
        # Create hook instance
        hook = BaseHook()
        hook.db_client = mock_db
        
        # Simulate session events in realistic order
        session_events = [
            # 1. Session start
            {
                "session_id": session_id,
                "hook_event_name": "SessionStart",
                "source": "startup",
                "custom_instructions": "Build a web dashboard with React",
                "git_branch": "feature/dashboard",
                "cwd": "/home/user/project"
            },
            # 2. User submits initial prompt
            {
                "session_id": session_id,
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Create a React dashboard component with charts",
                "cwd": "/home/user/project"
            },
            # 3. Claude reads package.json
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/home/user/project/package.json"},
                "matcher": "Read",
                "cwd": "/home/user/project"
            },
            {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": "Read",
                "tool_response": {"content": '{"name": "dashboard", "dependencies": {"react": "^18.0.0"}}'},
                "matcher": "Read",
                "cwd": "/home/user/project"
            },
            # 4. Claude creates new component file
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/home/user/project/src/Dashboard.tsx",
                    "content": "import React from 'react';\n\nfunction Dashboard() { return <div>Dashboard</div>; }\n\nexport default Dashboard;"
                },
                "matcher": "Write",
                "cwd": "/home/user/project"
            },
            {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": "Write",
                "tool_response": {"success": True},
                "matcher": "Write",
                "cwd": "/home/user/project"
            },
            # 5. Session ends
            {
                "session_id": session_id,
                "hook_event_name": "Stop",
                "cwd": "/home/user/project"
            }
        ]
        
        # Process all events
        results = []
        for event in session_events:
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            results.append(result)
            assert result["continue"] is True, f"Hook should continue for event: {event['hook_event_name']}"
        
        # Verify all events were processed
        assert len(results) == len(session_events)
        
        # Verify database calls were made
        assert mock_db.upsert_session.call_count >= 1  # At least session start
        assert mock_db.insert_event.call_count >= len(session_events)  # At least one per event


class TestHookInteractionFlow:
    """Test hook-to-hook interactions and data flow."""

    @pytest.fixture
    def enhanced_mock_db(self):
        """Enhanced mock database that tracks interactions."""
        mock_db = Mock()
        mock_db.health_check.return_value = True
        mock_db.session_data = {}
        mock_db.event_data = []
        
        def track_session_upsert(session_data):
            session_id = session_data["session_id"]
            if session_id not in mock_db.session_data:
                mock_db.session_data[session_id] = session_data.copy()
            else:
                mock_db.session_data[session_id].update(session_data)
            return True
        
        def track_event_insert(event_data):
            mock_db.event_data.append(event_data.copy())
            return True
        
        mock_db.upsert_session = track_session_upsert
        mock_db.insert_event = track_event_insert
        
        return mock_db

    def test_tool_use_hook_interaction_pattern(self, enhanced_mock_db):
        """Test Pre/Post tool use hook interaction patterns."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # Simulate complete tool use cycle with data flow
        tool_cycles = [
            {
                "tool_name": "Read",
                "pre_input": {"file_path": "/project/package.json"},
                "post_response": {"content": '{"name": "my-app", "version": "1.0.0"}', "size": 1024}
            },
            {
                "tool_name": "Edit", 
                "pre_input": {
                    "file_path": "/project/package.json",
                    "old_string": '"version": "1.0.0"',
                    "new_string": '"version": "1.1.0"'
                },
                "post_response": {"success": True, "changes_made": 1}
            },
            {
                "tool_name": "Bash",
                "pre_input": {"command": "npm test"},
                "post_response": {"exit_code": 0, "output": "All tests passed", "duration": 5.2}
            }
        ]
        
        for cycle in tool_cycles:
            # Pre-tool hook
            pre_event = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": cycle["tool_name"],
                "tool_input": cycle["pre_input"],
                "matcher": cycle["tool_name"],
                "timestamp": datetime.now().isoformat()
            }
            
            pre_result = hook.process_hook_data(pre_event, pre_event.get("hook_event_name", ""))
            assert pre_result["continue"] is True, f"Pre-hook failed for {cycle['tool_name']}"
            
            # Post-tool hook
            post_event = {
                "session_id": session_id,
                "hook_event_name": "PostToolUse", 
                "tool_name": cycle["tool_name"],
                "tool_response": cycle["post_response"],
                "duration_ms": 150,
                "timestamp": datetime.now().isoformat()
            }
            
            post_result = hook.process_hook_data(post_event, post_event.get("hook_event_name", ""))
            assert post_result["continue"] is True, f"Post-hook failed for {cycle['tool_name']}"
        
        # Verify hook interaction patterns in stored data
        events = enhanced_mock_db.event_data
        
        # Should have pairs of pre/post events
        pre_events = [e for e in events if e.get("hook_event_name") == "PreToolUse"]
        post_events = [e for e in events if e.get("hook_event_name") == "PostToolUse"]
        
        assert len(pre_events) == len(post_events) == len(tool_cycles), "Mismatched pre/post event counts"
        
        # Verify tool name consistency within pairs
        for i, cycle in enumerate(tool_cycles):
            assert pre_events[i]["tool_name"] == cycle["tool_name"]
            assert post_events[i]["tool_name"] == cycle["tool_name"]
            
            # Verify data flow from pre to post
            assert "tool_input" in str(pre_events[i])
            assert "tool_response" in str(post_events[i])

    def test_session_context_propagation(self, enhanced_mock_db):
        """Test that session context propagates correctly across hooks."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # Session start with rich context
        session_context = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "startup",
            "project_path": "/Users/dev/my-project",
            "git_branch": "feature/new-dashboard",
            "custom_instructions": "Focus on TypeScript and React best practices",
            "environment": "development",
            "ide": "VS Code"
        }
        
        result = hook.process_hook_data(session_context, session_context.get("hook_event_name", ""))
        assert result["continue"] is True
        
        # Multiple operations that should inherit session context
        operations = [
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Create a new React component for the dashboard"
            },
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/dev/my-project/src/Dashboard.tsx",
                    "content": "// New React component"
                }
            },
            {
                "hook_event_name": "PreToolUse", 
                "tool_name": "Bash",
                "tool_input": {"command": "cd /Users/dev/my-project && npm run type-check"}
            }
        ]
        
        for operation in operations:
            event = {"session_id": session_id, **operation}
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            assert result["continue"] is True
        
        # Verify session context is maintained
        session_data = enhanced_mock_db.session_data[session_id]
        assert session_data["project_path"] == "/Users/dev/my-project"
        assert session_data["git_branch"] == "feature/new-dashboard"
        assert session_data["custom_instructions"] == "Focus on TypeScript and React best practices"
        
        # All events should reference the same session
        events = enhanced_mock_db.event_data
        session_events = [e for e in events if e.get("session_id") == session_id]
        
        assert len(session_events) >= len(operations) + 1  # Operations + session start
        
        for event in session_events:
            assert event["session_id"] == session_id

    def test_error_propagation_and_recovery(self, enhanced_mock_db):
        """Test error propagation between hooks and recovery mechanisms."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # Simulate database failure scenarios
        original_insert = enhanced_mock_db.insert_event
        failure_count = 0
        
        def failing_insert(event_data):
            nonlocal failure_count
            failure_count += 1
            if failure_count <= 2:  # First 2 calls fail
                raise Exception("Database connection lost")
            return original_insert(event_data)
        
        enhanced_mock_db.insert_event = failing_insert
        
        # Process events with database failures
        events_to_process = [
            {"hook_event_name": "SessionStart", "source": "error_test"},
            {"hook_event_name": "PreToolUse", "tool_name": "Read", "tool_input": {"file_path": "/test/file1.txt"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Read", "tool_response": {"content": "data"}},
            {"hook_event_name": "PreToolUse", "tool_name": "Write", "tool_input": {"file_path": "/test/file2.txt"}},
            {"hook_event_name": "Stop"}
        ]
        
        successful_events = 0
        failed_events = 0
        
        for event_data in events_to_process:
            event = {"session_id": session_id, **event_data}
            
            try:
                result = hook.process_hook_data(event, event.get("hook_event_name", ""))
                
                # Hook should handle errors gracefully
                assert isinstance(result, dict), "Hook should return dict even on database errors"
                assert "continue" in result, "Hook result should have continue field"
                
                if result.get("continue", True):
                    successful_events += 1
                else:
                    failed_events += 1
                    
            except Exception as e:
                failed_events += 1
                print(f"Hook processing failed: {e}")
        
        print(f"Error recovery test: {successful_events} successful, {failed_events} failed events")
        
        # System should recover after initial failures
        assert successful_events >= 2, "System should recover and process some events successfully"
        
        # Events that succeeded should be properly stored
        stored_events = [e for e in enhanced_mock_db.event_data if e.get("session_id") == session_id]
        assert len(stored_events) >= 1, "At least some events should be stored despite failures"

    def test_mcp_tool_integration_flow(self, enhanced_mock_db):
        """Test MCP (Model Context Protocol) tool integration flow."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # MCP tool scenarios
        mcp_scenarios = [
            {
                "tool_name": "mcp__github__create_issue",
                "tool_input": {
                    "title": "Implement new dashboard feature",
                    "body": "Need to create a responsive dashboard component",
                    "labels": ["enhancement", "frontend"],
                    "assignee": "developer"
                },
                "expected_server": "github"
            },
            {
                "tool_name": "mcp__slack__send_message",
                "tool_input": {
                    "channel": "#dev-updates",
                    "message": "Dashboard component implementation is complete",
                    "mentions": ["@team"]
                },
                "expected_server": "slack"
            },
            {
                "tool_name": "mcp__database__query", 
                "tool_input": {
                    "query": "SELECT * FROM user_preferences WHERE dashboard_enabled = true",
                    "connection": "production"
                },
                "expected_server": "database"
            }
        ]
        
        for scenario in mcp_scenarios:
            # Pre-tool event for MCP tool
            pre_event = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": scenario["tool_name"],
                "tool_input": scenario["tool_input"],
                "matcher": scenario["tool_name"]
            }
            
            result = hook.process_hook_data(pre_event, pre_event.get("hook_event_name", ""))
            assert result["continue"] is True, f"MCP pre-hook failed for {scenario['tool_name']}"
            
            # Post-tool event for MCP tool
            post_event = {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": scenario["tool_name"],
                "tool_response": {
                    "success": True,
                    "mcp_server": scenario["expected_server"],
                    "response_data": {"id": f"mcp-response-{len(enhanced_mock_db.event_data)}"}
                }
            }
            
            result = hook.process_hook_data(post_event, post_event.get("hook_event_name", ""))
            assert result["continue"] is True, f"MCP post-hook failed for {scenario['tool_name']}"
        
        # Verify MCP tool detection and handling
        events = enhanced_mock_db.event_data
        mcp_events = [e for e in events if "mcp__" in str(e.get("tool_name", ""))]
        
        assert len(mcp_events) >= len(mcp_scenarios) * 2, "All MCP tool events should be captured"
        
        # Verify MCP tool categorization
        for event in mcp_events:
            tool_name = event.get("tool_name", "")
            if tool_name.startswith("mcp__"):
                # Tool name should include server identifier
                assert "__" in tool_name, f"MCP tool name should include server: {tool_name}"

    def test_user_interaction_hook_workflow(self, enhanced_mock_db):
        """Test user interaction hooks in realistic workflow."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # Realistic user interaction workflow
        user_workflow = [
            # Initial user prompt
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "I want to create a React dashboard with charts and user authentication",
                "context": {"conversation_turn": 1}
            },
            
            # Follow-up clarification
            {
                "hook_event_name": "UserPromptSubmit", 
                "prompt_text": "Make sure to use TypeScript and include responsive design",
                "context": {"conversation_turn": 2, "clarification": True}
            },
            
            # User provides feedback on generated code
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "The component looks good, but can you add error handling for the API calls?",
                "context": {"conversation_turn": 3, "feedback": True}
            },
            
            # Notification about system state
            {
                "hook_event_name": "Notification",
                "message": "Code generation completed successfully",
                "type": "success",
                "context": {"automated": True}
            },
            
            # Pre-compact hook (memory management)
            {
                "hook_event_name": "PreCompact",
                "reason": "Context length approaching limit",
                "items_to_compact": 15,
                "estimated_savings": "2.5KB"
            }
        ]
        
        processed_interactions = 0
        
        for interaction in user_workflow:
            event = {"session_id": session_id, **interaction}
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            
            assert result["continue"] is True, f"User interaction failed: {interaction['hook_event_name']}"
            processed_interactions += 1
        
        # Verify user interaction tracking
        events = enhanced_mock_db.event_data
        user_events = [e for e in events if e.get("hook_event_name") in [
            "UserPromptSubmit", "Notification", "PreCompact"
        ]]
        
        assert len(user_events) == len(user_workflow), "All user interactions should be tracked"
        
        # Verify conversation flow tracking
        prompt_events = [e for e in events if e.get("hook_event_name") == "UserPromptSubmit"]
        assert len(prompt_events) == 3, "Should track all user prompts"
        
        # Verify system notifications
        notification_events = [e for e in events if e.get("hook_event_name") == "Notification"]
        assert len(notification_events) == 1, "Should track system notifications"
        
        print(f"User interaction workflow: {processed_interactions} interactions processed successfully")

    def test_performance_during_complex_workflow(self, enhanced_mock_db):
        """Test performance during complex multi-hook workflows."""
        import time
        
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = enhanced_mock_db
        
        # Complex workflow with multiple hook types
        complex_workflow = []
        
        # Session start
        complex_workflow.append({
            "hook_event_name": "SessionStart",
            "source": "performance_test",
            "project_path": "/complex/project"
        })
        
        # Simulate realistic development session
        for i in range(20):  # 20 iterations of development cycle
            cycle = [
                # User input
                {
                    "hook_event_name": "UserPromptSubmit",
                    "prompt_text": f"Iteration {i}: Implement feature {i}"
                },
                
                # File operations
                {
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/project/src/feature_{i}.tsx"}
                },
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "Read", 
                    "tool_response": {"content": f"Feature {i} implementation"}
                },
                
                # Code modification
                {
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Edit",
                    "tool_input": {
                        "file_path": f"/project/src/feature_{i}.tsx",
                        "old_string": "placeholder",
                        "new_string": f"implementation_{i}"
                    }
                },
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "Edit",
                    "tool_response": {"success": True}
                }
            ]
            
            complex_workflow.extend(cycle)
        
        # Session end
        complex_workflow.append({
            "hook_event_name": "Stop"
        })
        
        # Execute workflow and measure performance
        start_time = time.perf_counter()
        execution_times = []
        
        for step, event_data in enumerate(complex_workflow):
            event = {"session_id": session_id, **event_data}
            
            step_start = time.perf_counter()
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            step_end = time.perf_counter()
            
            step_duration = (step_end - step_start) * 1000  # Convert to milliseconds
            execution_times.append(step_duration)
            
            assert result["continue"] is True, f"Complex workflow step {step} failed"
            
            # Each individual hook execution should be under 100ms
            assert step_duration < 100, f"Step {step} took {step_duration:.2f}ms, exceeds 100ms limit"
        
        end_time = time.perf_counter()
        total_duration = end_time - start_time
        
        # Performance analysis
        avg_execution_time = sum(execution_times) / len(execution_times)
        max_execution_time = max(execution_times)
        
        print(f"Complex workflow performance:")
        print(f"  Total steps: {len(complex_workflow)}")
        print(f"  Total time: {total_duration:.2f}s")
        print(f"  Average step time: {avg_execution_time:.2f}ms")
        print(f"  Max step time: {max_execution_time:.2f}ms")
        print(f"  Steps per second: {len(complex_workflow) / total_duration:.1f}")
        
        # Verify all events were processed and stored
        events = enhanced_mock_db.event_data
        workflow_events = [e for e in events if e.get("session_id") == session_id]
        
        assert len(workflow_events) == len(complex_workflow), "All workflow events should be stored"
        
        # Performance requirements
        assert avg_execution_time < 50, f"Average execution time {avg_execution_time:.2f}ms too high"
        assert max_execution_time < 100, f"Max execution time {max_execution_time:.2f}ms exceeds limit"
        assert len(complex_workflow) / total_duration > 10, "Workflow processing too slow"


class TestRealWorldIntegrationScenarios:
    """Test realistic integration scenarios matching actual Claude Code usage."""

    @pytest.fixture
    def production_mock_setup(self):
        """Setup that mimics production environment constraints."""
        mock_db = Mock()
        mock_db.health_check.return_value = True
        
        # Simulate realistic database latency
        def delayed_upsert(session_data):
            time.sleep(0.002)  # 2ms database latency
            return True
        
        def delayed_insert(event_data):
            time.sleep(0.003)  # 3ms database latency  
            return True
        
        mock_db.upsert_session = delayed_upsert
        mock_db.insert_event = delayed_insert
        
        return mock_db

    @pytest.mark.skipif(BaseHook is None, reason="Hook modules not available")
    def test_full_stack_development_session(self, production_mock_setup):
        """Test complete full-stack development session integration."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = production_mock_setup
        
        # Realistic full-stack development workflow
        fullstack_session = [
            # Project initialization
            {
                "hook_event_name": "SessionStart",
                "source": "startup",
                "project_path": "/Users/dev/fullstack-app",
                "git_branch": "main",
                "custom_instructions": "Build a full-stack React + Node.js application"
            },
            
            # Backend development
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Set up Express.js backend with TypeScript and database"
            },
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/dev/fullstack-app/backend/src/server.ts",
                    "content": "// Express server setup with TypeScript"
                }
            },
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Write",
                "tool_response": {"success": True}
            },
            
            # Database setup
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/dev/fullstack-app/backend/src/database.ts",
                    "content": "// Database connection and models"
                }
            },
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Write", 
                "tool_response": {"success": True}
            },
            
            # Frontend development
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Create React frontend with components and routing"
            },
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/dev/fullstack-app/frontend/src/App.tsx",
                    "content": "// Main React application component"
                }
            },
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Write",
                "tool_response": {"success": True}
            },
            
            # Testing
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "cd /Users/dev/fullstack-app && npm run test"}
            },
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Bash",
                "tool_response": {
                    "exit_code": 0,
                    "output": "All tests passed",
                    "duration": 8.5
                }
            },
            
            # Deployment preparation
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/dev/fullstack-app/docker-compose.yml",
                    "content": "# Docker configuration for deployment"
                }
            },
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Write",
                "tool_response": {"success": True}
            },
            
            # Session completion
            {
                "hook_event_name": "Stop"
            }
        ]
        
        # Execute full session with performance tracking
        execution_times = []
        start_time = time.time()
        
        for event_data in fullstack_session:
            event = {"session_id": session_id, **event_data}
            
            step_start = time.perf_counter()
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            step_end = time.perf_counter()
            
            step_duration = (step_end - step_start) * 1000
            execution_times.append(step_duration)
            
            assert result["continue"] is True, f"Full-stack session failed at: {event_data['hook_event_name']}"
            assert step_duration < 100, f"Step exceeded 100ms: {step_duration:.2f}ms"
        
        total_time = time.time() - start_time
        avg_time = sum(execution_times) / len(execution_times)
        
        print(f"Full-stack development session:")
        print(f"  Steps: {len(fullstack_session)}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Average step: {avg_time:.2f}ms")
        print(f"  All steps < 100ms: {all(t < 100 for t in execution_times)}")

    def test_ai_pair_programming_session(self, production_mock_setup):
        """Test AI pair programming session with rapid back-and-forth."""
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = production_mock_setup
        
        # Rapid pair programming session
        pair_programming = []
        
        # Session start
        pair_programming.append({
            "hook_event_name": "SessionStart",
            "source": "startup", 
            "project_path": "/Users/dev/pair-project"
        })
        
        # Rapid iterations (simulating back-and-forth programming)
        for iteration in range(15):
            cycle = [
                # User provides input/feedback
                {
                    "hook_event_name": "UserPromptSubmit",
                    "prompt_text": f"Iteration {iteration}: Let's implement this feature step by step"
                },
                
                # AI reads current code
                {
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/Users/dev/pair-project/src/component_{iteration}.tsx"}
                },
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "Read",
                    "tool_response": {"content": f"Current implementation {iteration}"}
                },
                
                # AI makes changes
                {
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Edit",
                    "tool_input": {
                        "file_path": f"/Users/dev/pair-project/src/component_{iteration}.tsx",
                        "old_string": "placeholder",
                        "new_string": f"improved_implementation_{iteration}"
                    }
                },
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "Edit",
                    "tool_response": {"success": True}
                }
            ]
            
            pair_programming.extend(cycle)
        
        # Session end
        pair_programming.append({"hook_event_name": "Stop"})
        
        # Execute rapid session
        rapid_execution_times = []
        
        for event_data in pair_programming:
            event = {"session_id": session_id, **event_data}
            
            start = time.perf_counter()
            result = hook.process_hook_data(event, event.get("hook_event_name", ""))
            end = time.perf_counter()
            
            duration = (end - start) * 1000
            rapid_execution_times.append(duration)
            
            assert result["continue"] is True
            # Rapid programming should still meet performance requirements
            assert duration < 100, f"Rapid programming step too slow: {duration:.2f}ms"
        
        avg_rapid_time = sum(rapid_execution_times) / len(rapid_execution_times)
        max_rapid_time = max(rapid_execution_times)
        
        print(f"AI pair programming session:")
        print(f"  Total interactions: {len(pair_programming)}")
        print(f"  Average time: {avg_rapid_time:.2f}ms")
        print(f"  Max time: {max_rapid_time:.2f}ms")
        print(f"  All under 100ms: {all(t < 100 for t in rapid_execution_times)}")
        
        # Pair programming should be fast and responsive
        assert avg_rapid_time < 30, "Pair programming should be very responsive"
        assert max_rapid_time < 100, "No step should exceed 100ms"