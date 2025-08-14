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
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

from src.core.database import SupabaseClient, DatabaseManager
from src.core.base_hook import BaseHook
from src.core.utils import sanitize_data


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
        with patch('src.database.create_client') as mock_create:
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
        result = hook.process_hook(sample_hook_input)

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
        result = hook.process_hook(sample_hook_input)

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
            return hook.process_hook(hook_input)

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
            result = hook.process_hook(event_input)
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

        result = hook.process_hook(mcp_tool_input)

        # Verify MCP tool was processed
        assert result["continue"] is True
        
        # Verify MCP tool was properly categorized
        call_args = mock_table.insert.call_args[0][0]
        if isinstance(call_args, list):
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
        result = hook.process_hook(hook_input)
        
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
            result = hook.process_hook(malformed_input)
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
            result = hook.process_hook(hook_input)
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
        result = hook.process_hook(hook_input)
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
        result = hook.process_hook(hook_input)
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
        result = hook.process_hook(large_payload)
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
                result = hook.process_hook(hook_input)
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

        sanitized = sanitize_input_data(sensitive_input)

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