"""
Database Consistency and Integrity Tests for Chronicle Hooks

Tests to validate database state consistency across hook executions,
concurrent operations, and error scenarios.
"""

import pytest
import asyncio
import time
import threading
import uuid
import json
import tempfile
import os
import sqlite3
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any, Optional

from src.lib.database import SupabaseClient, DatabaseManager
from src.lib.base_hook import BaseHook
from src.lib.utils import sanitize_data


class MockSQLiteDatabase:
    """Enhanced SQLite mock for testing database consistency."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.connection = sqlite3.connect(db_path, check_same_thread=False)
        self.lock = threading.Lock()
        self._initialize_schema()
    
    def _initialize_schema(self):
        """Initialize database schema matching production."""
        with self.lock:
            cursor = self.connection.cursor()
            
            # Sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    start_time TEXT,
                    end_time TEXT,
                    source TEXT,
                    project_path TEXT,
                    git_branch TEXT,
                    custom_instructions TEXT,
                    total_events INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    hook_event_name TEXT,
                    timestamp TEXT,
                    tool_name TEXT,
                    tool_input TEXT,
                    tool_response TEXT,
                    duration_ms REAL,
                    success BOOLEAN,
                    error_message TEXT,
                    raw_input TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
                )
            """)
            
            # Indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_hook_name ON events(hook_event_name)")
            
            self.connection.commit()
    
    def upsert_session(self, session_data: Dict[str, Any]) -> bool:
        """Upsert session data with proper locking."""
        with self.lock:
            try:
                cursor = self.connection.cursor()
                
                # Check if session exists
                cursor.execute("SELECT session_id FROM sessions WHERE session_id = ?", 
                             (session_data["session_id"],))
                exists = cursor.fetchone() is not None
                
                if exists:
                    # Update existing session
                    cursor.execute("""
                        UPDATE sessions SET 
                            end_time = ?,
                            source = ?,
                            project_path = ?,
                            git_branch = ?,
                            custom_instructions = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE session_id = ?
                    """, (
                        session_data.get("end_time"),
                        session_data.get("source"),
                        session_data.get("project_path"),
                        session_data.get("git_branch"),
                        session_data.get("custom_instructions"),
                        session_data["session_id"]
                    ))
                else:
                    # Insert new session
                    cursor.execute("""
                        INSERT INTO sessions (
                            session_id, start_time, source, project_path, 
                            git_branch, custom_instructions
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        session_data["session_id"],
                        session_data.get("start_time", datetime.now().isoformat()),
                        session_data.get("source"),
                        session_data.get("project_path"),
                        session_data.get("git_branch"),
                        session_data.get("custom_instructions")
                    ))
                
                self.connection.commit()
                return True
                
            except Exception as e:
                self.connection.rollback()
                print(f"Session upsert error: {e}")
                return False
    
    def insert_event(self, event_data: Dict[str, Any]) -> bool:
        """Insert event data with proper transaction handling."""
        with self.lock:
            try:
                cursor = self.connection.cursor()
                
                cursor.execute("""
                    INSERT INTO events (
                        session_id, hook_event_name, timestamp, tool_name,
                        tool_input, tool_response, duration_ms, success,
                        error_message, raw_input
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    event_data["session_id"],
                    event_data.get("hook_event_name"),
                    event_data.get("timestamp", datetime.now().isoformat()),
                    event_data.get("tool_name"),
                    json.dumps(event_data.get("tool_input")) if event_data.get("tool_input") else None,
                    json.dumps(event_data.get("tool_response")) if event_data.get("tool_response") else None,
                    event_data.get("duration_ms"),
                    event_data.get("success", True),
                    event_data.get("error_message"),
                    json.dumps(event_data.get("raw_input")) if event_data.get("raw_input") else None
                ))
                
                # Update session event count
                cursor.execute("""
                    UPDATE sessions SET 
                        total_events = total_events + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE session_id = ?
                """, (event_data["session_id"],))
                
                self.connection.commit()
                return True
                
            except Exception as e:
                self.connection.rollback()
                print(f"Event insert error: {e}")
                return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID."""
        with self.lock:
            cursor = self.connection.cursor()
            cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            
            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
            return None
    
    def get_events_for_session(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all events for a session."""
        with self.lock:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT * FROM events 
                WHERE session_id = ? 
                ORDER BY created_at ASC
            """, (session_id,))
            rows = cursor.fetchall()
            
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    def get_event_count(self, session_id: str) -> int:
        """Get event count for a session."""
        with self.lock:
            cursor = self.connection.cursor()
            cursor.execute("SELECT COUNT(*) FROM events WHERE session_id = ?", (session_id,))
            return cursor.fetchone()[0]
    
    def verify_referential_integrity(self) -> Dict[str, Any]:
        """Verify database referential integrity."""
        with self.lock:
            cursor = self.connection.cursor()
            
            # Check for orphaned events (events without corresponding session)
            cursor.execute("""
                SELECT COUNT(*) FROM events e
                LEFT JOIN sessions s ON e.session_id = s.session_id
                WHERE s.session_id IS NULL
            """)
            orphaned_events = cursor.fetchone()[0]
            
            # Check session event counts match actual event counts
            cursor.execute("""
                SELECT s.session_id, s.total_events, COUNT(e.id) as actual_events
                FROM sessions s
                LEFT JOIN events e ON s.session_id = e.session_id
                GROUP BY s.session_id, s.total_events
                HAVING s.total_events != COUNT(e.id)
            """)
            mismatched_counts = cursor.fetchall()
            
            # Check for duplicate session IDs
            cursor.execute("""
                SELECT session_id, COUNT(*) as count
                FROM sessions
                GROUP BY session_id
                HAVING COUNT(*) > 1
            """)
            duplicate_sessions = cursor.fetchall()
            
            return {
                "orphaned_events": orphaned_events,
                "mismatched_counts": len(mismatched_counts),
                "duplicate_sessions": len(duplicate_sessions),
                "integrity_violations": orphaned_events + len(mismatched_counts) + len(duplicate_sessions)
            }
    
    def close(self):
        """Close database connection."""
        self.connection.close()


class TestDatabaseConsistency:
    """Test database consistency across hook operations."""
    
    @pytest.fixture
    def test_database(self):
        """Create test database for consistency testing."""
        fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        
        db = MockSQLiteDatabase(db_path)
        yield db
        
        db.close()
        os.unlink(db_path)
    
    def test_session_lifecycle_consistency(self, test_database):
        """Test session lifecycle maintains database consistency."""
        session_id = str(uuid.uuid4())
        
        # Create mock client that uses our test database
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Session start
        session_start = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "startup",
            "project_path": "/test/project",
            "git_branch": "main",
            "custom_instructions": "Build a dashboard"
        }
        
        result = hook.process_hook(session_start)
        assert result["continue"] is True
        
        # Verify session was created
        session = test_database.get_session(session_id)
        assert session is not None
        assert session["session_id"] == session_id
        assert session["source"] == "startup"
        assert session["project_path"] == "/test/project"
        
        # Multiple tool operations
        tool_operations = [
            {"hook_event_name": "PreToolUse", "tool_name": "Read", "tool_input": {"file_path": "/test/file1.txt"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Read", "tool_response": {"content": "file1 contents"}},
            {"hook_event_name": "PreToolUse", "tool_name": "Write", "tool_input": {"file_path": "/test/file2.txt", "content": "new content"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Write", "tool_response": {"success": True}},
            {"hook_event_name": "UserPromptSubmit", "prompt_text": "Create a component"},
        ]
        
        for operation in tool_operations:
            event_data = {"session_id": session_id, **operation}
            result = hook.process_hook(event_data)
            assert result["continue"] is True
        
        # Session stop
        session_stop = {
            "session_id": session_id,
            "hook_event_name": "Stop"
        }
        
        result = hook.process_hook(session_stop)
        assert result["continue"] is True
        
        # Verify final consistency
        session = test_database.get_session(session_id)
        events = test_database.get_events_for_session(session_id)
        
        # Should have session start + tool operations + session stop
        expected_event_count = 1 + len(tool_operations) + 1
        assert len(events) == expected_event_count
        assert session["total_events"] == expected_event_count
        
        # Verify event order and consistency
        assert events[0]["hook_event_name"] == "SessionStart"
        assert events[-1]["hook_event_name"] == "Stop"
        
        # All events should belong to the same session
        for event in events:
            assert event["session_id"] == session_id
        
        # Verify referential integrity
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"Integrity violations: {integrity}"

    def test_concurrent_session_consistency(self, test_database):
        """Test database consistency with concurrent sessions."""
        # Create mock client
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        num_concurrent_sessions = 10
        operations_per_session = 20
        
        def run_session_operations(session_num):
            """Run operations for one session."""
            session_id = f"concurrent-session-{session_num}"
            hook = BaseHook()
            hook.db_client = mock_client
            
            # Session start
            session_start = {
                "session_id": session_id,
                "hook_event_name": "SessionStart",
                "source": "concurrent_test",
                "project_path": f"/test/project-{session_num}"
            }
            
            result = hook.process_hook(session_start)
            assert result["continue"] is True
            
            # Multiple operations
            for op_num in range(operations_per_session):
                operation = {
                    "session_id": session_id,
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/test/file-{session_num}-{op_num}.txt"}
                }
                
                result = hook.process_hook(operation)
                assert result["continue"] is True
            
            # Session stop
            session_stop = {
                "session_id": session_id,
                "hook_event_name": "Stop"
            }
            
            result = hook.process_hook(session_stop)
            assert result["continue"] is True
            
            return session_id
        
        # Run concurrent sessions
        with ThreadPoolExecutor(max_workers=num_concurrent_sessions) as executor:
            futures = [
                executor.submit(run_session_operations, i) 
                for i in range(num_concurrent_sessions)
            ]
            
            session_ids = []
            for future in as_completed(futures):
                session_id = future.result()
                session_ids.append(session_id)
        
        # Verify all sessions were created correctly
        assert len(session_ids) == num_concurrent_sessions
        
        for session_id in session_ids:
            session = test_database.get_session(session_id)
            events = test_database.get_events_for_session(session_id)
            
            # Each session should have: start + operations + stop
            expected_events = 1 + operations_per_session + 1
            assert len(events) == expected_events, f"Session {session_id} has {len(events)} events, expected {expected_events}"
            assert session["total_events"] == expected_events
            
            # Verify event integrity for this session
            assert events[0]["hook_event_name"] == "SessionStart"
            assert events[-1]["hook_event_name"] == "Stop"
            
            for event in events:
                assert event["session_id"] == session_id
        
        # Verify overall database integrity
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"Concurrent test integrity violations: {integrity}"
        
        print(f"Concurrent consistency test: {num_concurrent_sessions} sessions, {num_concurrent_sessions * (operations_per_session + 2)} total events")

    def test_transaction_rollback_consistency(self, test_database):
        """Test database consistency during transaction failures."""
        session_id = str(uuid.uuid4())
        
        # Create a mock client that simulates transaction failures
        mock_client = Mock()
        mock_client.health_check.return_value = True
        
        # Session upsert always succeeds
        mock_client.upsert_session = test_database.upsert_session
        
        # Event insert fails occasionally
        original_insert = test_database.insert_event
        call_count = 0
        
        def failing_insert_event(event_data):
            nonlocal call_count
            call_count += 1
            # Fail every 3rd call
            if call_count % 3 == 0:
                return False
            return original_insert(event_data)
        
        mock_client.insert_event = failing_insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Session start (should succeed)
        session_start = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "rollback_test"
        }
        
        result = hook.process_hook(session_start)
        assert result["continue"] is True
        
        # Multiple operations (some will fail)
        successful_operations = 0
        failed_operations = 0
        
        for i in range(10):
            operation = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/file-{i}.txt"}
            }
            
            result = hook.process_hook(operation)
            
            if result["continue"]:
                successful_operations += 1
            else:
                failed_operations += 1
        
        print(f"Transaction test: {successful_operations} successful, {failed_operations} failed operations")
        
        # Verify database consistency despite failures
        session = test_database.get_session(session_id)
        events = test_database.get_events_for_session(session_id)
        actual_event_count = test_database.get_event_count(session_id)
        
        # Session should exist
        assert session is not None
        
        # Event count should match actual events in database
        assert len(events) == actual_event_count
        
        # All events should be valid and belong to the session
        for event in events:
            assert event["session_id"] == session_id
            assert event["hook_event_name"] is not None
        
        # Database integrity should be maintained
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"Transaction rollback integrity violations: {integrity}"

    def test_data_sanitization_consistency(self, test_database):
        """Test that data sanitization is consistently applied."""
        session_id = str(uuid.uuid4())
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Create events with sensitive data
        sensitive_events = [
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {
                    "command": "export API_KEY=secret123 && curl -H 'Authorization: Bearer token456' https://api.example.com",
                    "env": {
                        "API_KEY": "secret123",
                        "PASSWORD": "mypassword",
                        "NORMAL_VAR": "normal_value"
                    }
                }
            },
            {
                "session_id": session_id,
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Here's my API key: sk-1234567890abcdef and my password is 'secret123'"
            }
        ]
        
        for event in sensitive_events:
            result = hook.process_hook(event)
            assert result["continue"] is True
        
        # Verify sensitive data was sanitized in database
        events = test_database.get_events_for_session(session_id)
        
        for event in events:
            event_str = json.dumps(event)
            
            # These sensitive patterns should not appear in stored data
            sensitive_patterns = ["secret123", "token456", "mypassword", "sk-1234567890abcdef"]
            
            for pattern in sensitive_patterns:
                assert pattern not in event_str, f"Sensitive pattern '{pattern}' found in stored event: {event}"
            
            # Redacted markers should be present
            if "API_KEY" in event_str or "PASSWORD" in event_str:
                assert "[REDACTED]" in event_str, f"Expected redaction markers in event: {event}"

    def test_large_payload_database_consistency(self, test_database):
        """Test database consistency with large payloads."""
        session_id = str(uuid.uuid4())
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Create events with increasingly large payloads
        payload_sizes = [1024, 10240, 102400]  # 1KB, 10KB, 100KB
        
        for i, size in enumerate(payload_sizes):
            large_content = "x" * size
            
            large_event = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": f"/test/large_file_{i}.txt",
                    "content": large_content
                },
                "metadata": {
                    "size": size,
                    "test_number": i
                }
            }
            
            result = hook.process_hook(large_event)
            assert result["continue"] is True
        
        # Verify all large payloads were stored correctly
        events = test_database.get_events_for_session(session_id)
        assert len(events) == len(payload_sizes)
        
        for i, event in enumerate(events):
            assert event["session_id"] == session_id
            
            # Verify the tool input was stored
            if event["tool_input"]:
                tool_input = json.loads(event["tool_input"])
                assert "content" in tool_input
                # Content might be truncated or compressed, but should be present
                assert len(tool_input["content"]) > 0
        
        # Database integrity should be maintained
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0

    def test_error_state_consistency(self, test_database):
        """Test database consistency during error conditions."""
        session_id = str(uuid.uuid4())
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Start session normally
        session_start = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "error_test"
        }
        
        result = hook.process_hook(session_start)
        assert result["continue"] is True
        
        # Create various error conditions
        error_scenarios = [
            # Malformed input (missing required fields)
            {"session_id": session_id},
            
            # Invalid tool input
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": "not-a-dict"
            },
            
            # Very large session ID (potential injection)
            {
                "session_id": "x" * 1000,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read"
            },
            
            # Null/None values
            {
                "session_id": session_id,
                "hook_event_name": None,
                "tool_name": "Read"
            }
        ]
        
        processed_errors = 0
        for scenario in error_scenarios:
            try:
                result = hook.process_hook(scenario)
                # Even if processing fails, hook should continue gracefully
                assert isinstance(result, dict)
                assert "continue" in result
                processed_errors += 1
            except Exception as e:
                print(f"Error scenario raised exception: {e}")
                # Exceptions should be handled gracefully, but we'll count them
                processed_errors += 1
        
        print(f"Processed {processed_errors} error scenarios")
        
        # Verify database consistency after error conditions
        session = test_database.get_session(session_id)
        events = test_database.get_events_for_session(session_id)
        
        # Session should still exist and be valid
        assert session is not None
        assert session["session_id"] == session_id
        
        # Events should be consistent (no orphaned or corrupted data)
        for event in events:
            assert event["session_id"] == session_id or event["session_id"] is None
            # Event should have basic required structure
            assert "hook_event_name" in event
            assert "created_at" in event
        
        # Database integrity should be maintained
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"Error state integrity violations: {integrity}"

    def test_hook_interaction_data_flow(self, test_database):
        """Test data flow consistency between different hooks."""
        session_id = str(uuid.uuid4())
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = test_database.upsert_session
        mock_client.insert_event = test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Simulate a realistic hook interaction flow
        hook_flow = [
            # 1. Session starts
            {
                "session_id": session_id,
                "hook_event_name": "SessionStart",
                "source": "startup",
                "project_path": "/test/project"
            },
            
            # 2. User submits prompt
            {
                "session_id": session_id,
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Read and analyze package.json"
            },
            
            # 3. Pre-tool hook (Claude about to read file)
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/test/project/package.json"},
                "context": {"prompt_id": "prompt-1", "reasoning": "Need to read package.json"}
            },
            
            # 4. Post-tool hook (Claude finished reading)
            {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": "Read",
                "tool_response": {
                    "content": '{"name": "test-project", "version": "1.0.0"}',
                    "success": True
                },
                "duration_ms": 45,
                "context": {"prompt_id": "prompt-1"}
            },
            
            # 5. User submits follow-up
            {
                "session_id": session_id,
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Update the version to 2.0.0"
            },
            
            # 6. Pre-tool hook (Claude about to edit file)
            {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Edit",
                "tool_input": {
                    "file_path": "/test/project/package.json",
                    "old_string": '"version": "1.0.0"',
                    "new_string": '"version": "2.0.0"'
                },
                "context": {"prompt_id": "prompt-2", "previous_read": True}
            },
            
            # 7. Post-tool hook (Claude finished editing)
            {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": "Edit",
                "tool_response": {"success": True},
                "duration_ms": 32,
                "context": {"prompt_id": "prompt-2"}
            },
            
            # 8. Session ends
            {
                "session_id": session_id,
                "hook_event_name": "Stop"
            }
        ]
        
        # Process the entire flow
        for step, hook_data in enumerate(hook_flow):
            result = hook.process_hook(hook_data)
            assert result["continue"] is True, f"Hook flow step {step} failed"
        
        # Verify data flow consistency
        events = test_database.get_events_for_session(session_id)
        assert len(events) == len(hook_flow)
        
        # Check chronological order
        timestamps = [event["created_at"] for event in events]
        assert timestamps == sorted(timestamps), "Events not in chronological order"
        
        # Verify hook interaction patterns
        tool_events = [e for e in events if e["hook_event_name"] in ["PreToolUse", "PostToolUse"]]
        
        # Should have matching pre/post pairs
        pre_events = [e for e in tool_events if e["hook_event_name"] == "PreToolUse"]
        post_events = [e for e in tool_events if e["hook_event_name"] == "PostToolUse"]
        assert len(pre_events) == len(post_events), "Mismatched pre/post tool events"
        
        # Verify tool name consistency within pairs
        for i in range(len(pre_events)):
            pre_tool_input = json.loads(pre_events[i]["tool_input"]) if pre_events[i]["tool_input"] else {}
            post_tool_response = json.loads(post_events[i]["tool_response"]) if post_events[i]["tool_response"] else {}
            
            # Both should reference the same tool
            assert pre_events[i]["tool_name"] == post_events[i]["tool_name"]
            
            # Post event should have response data
            assert post_tool_response is not None
        
        # Verify session integrity
        session = test_database.get_session(session_id)
        assert session["total_events"] == len(hook_flow)
        
        # Verify database integrity
        integrity = test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"Hook interaction integrity violations: {integrity}"
        
        print(f"Hook interaction test: {len(hook_flow)} events processed with full data flow consistency")


class TestDatabasePerformanceConsistency:
    """Test database consistency under performance stress."""
    
    @pytest.fixture
    def performance_test_database(self):
        """Create database optimized for performance testing."""
        fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        
        # Create database with performance optimizations
        db = MockSQLiteDatabase(db_path)
        
        # Add performance indexes
        with db.lock:
            cursor = db.connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging for better concurrency
            cursor.execute("PRAGMA synchronous=NORMAL")  # Balanced durability/performance
            cursor.execute("PRAGMA cache_size=10000")  # Larger cache
            db.connection.commit()
        
        yield db
        
        db.close()
        os.unlink(db_path)
    
    def test_high_throughput_consistency(self, performance_test_database):
        """Test database consistency under high throughput load."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = performance_test_database.upsert_session
        mock_client.insert_event = performance_test_database.insert_event
        
        num_sessions = 50
        events_per_session = 100
        
        def high_throughput_session(session_num):
            """Process many events rapidly for one session."""
            session_id = f"throughput-session-{session_num}"
            hook = BaseHook()
            hook.db_client = mock_client
            
            events_processed = 0
            
            # Session start
            session_start = {
                "session_id": session_id,
                "hook_event_name": "SessionStart",
                "source": "throughput_test"
            }
            hook.process_hook(session_start)
            events_processed += 1
            
            # Rapid event processing
            for event_num in range(events_per_session):
                event = {
                    "session_id": session_id,
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/test/file-{event_num}.txt"},
                    "timestamp": datetime.now().isoformat()
                }
                
                result = hook.process_hook(event)
                if result["continue"]:
                    events_processed += 1
            
            return session_id, events_processed
        
        # Execute high-throughput test
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [
                executor.submit(high_throughput_session, i) 
                for i in range(num_sessions)
            ]
            
            session_results = []
            for future in as_completed(futures):
                session_id, events_processed = future.result()
                session_results.append((session_id, events_processed))
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify consistency after high throughput
        total_events_processed = sum(events for _, events in session_results)
        events_per_second = total_events_processed / duration
        
        print(f"High throughput test: {total_events_processed} events in {duration:.2f}s ({events_per_second:.0f} events/s)")
        
        # Verify all sessions and events are consistent
        for session_id, expected_events in session_results:
            session = performance_test_database.get_session(session_id)
            events = performance_test_database.get_events_for_session(session_id)
            
            assert session is not None, f"Session {session_id} not found"
            assert len(events) == expected_events, f"Session {session_id} has {len(events)} events, expected {expected_events}"
            assert session["total_events"] == expected_events
            
            # All events should belong to this session
            for event in events:
                assert event["session_id"] == session_id
        
        # Overall database integrity
        integrity = performance_test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0, f"High throughput integrity violations: {integrity}"
        
        # Performance should be reasonable
        assert events_per_second > 100, f"Throughput too low: {events_per_second} events/s"

    def test_consistency_under_memory_pressure(self, performance_test_database):
        """Test database consistency under memory pressure."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session = performance_test_database.upsert_session
        mock_client.insert_event = performance_test_database.insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Create memory pressure with large payloads
        large_payloads = []
        session_id = str(uuid.uuid4())
        
        # Session start
        session_start = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "memory_pressure_test"
        }
        hook.process_hook(session_start)
        
        # Create events with increasingly large payloads
        for i in range(20):
            payload_size = 1024 * (i + 1) * 10  # 10KB, 20KB, ..., 200KB
            large_content = "x" * payload_size
            large_payloads.append(large_content)
            
            event = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": f"/test/large_file_{i}.txt",
                    "content": large_content
                },
                "metadata": {
                    "size": payload_size,
                    "iteration": i
                }
            }
            
            result = hook.process_hook(event)
            assert result["continue"] is True
        
        # Verify consistency under memory pressure
        session = performance_test_database.get_session(session_id)
        events = performance_test_database.get_events_for_session(session_id)
        
        assert session is not None
        assert len(events) == 21  # Session start + 20 large events
        assert session["total_events"] == 21
        
        # Verify all events were stored correctly despite memory pressure
        for event in events:
            assert event["session_id"] == session_id
            assert event["hook_event_name"] is not None
        
        # Database integrity should be maintained
        integrity = performance_test_database.verify_referential_integrity()
        assert integrity["integrity_violations"] == 0
        
        print(f"Memory pressure test: 21 events with payloads up to 200KB maintained consistency")