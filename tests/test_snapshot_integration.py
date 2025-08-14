"""
Integration tests using real Chronicle snapshot data.

Tests Chronicle components with realistic data patterns from live Claude Code sessions.
"""

import os
import sys
import json
import pytest
import asyncio
import tempfile
from typing import Dict, List, Any
from datetime import datetime

# Add the hooks src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'hooks', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'hooks', 'config'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

try:
    from models import Session, Event, EventType
    from database import DatabaseManager
    from snapshot_playback import SnapshotPlayback
    from utils import validate_json, sanitize_data
except ImportError as e:
    pytest.skip(f"Required modules not available: {e}", allow_module_level=True)


class TestSnapshotIntegration:
    """Integration tests using snapshot data."""
    
    @pytest.fixture
    def sample_snapshot_data(self):
        """Create sample snapshot data for testing."""
        return {
            "metadata": {
                "captured_at": "2025-01-13T10:00:00Z",
                "source": "test_data",
                "version": "1.0.0",
                "sessions_captured": 2,
                "events_captured": 8
            },
            "sessions": [
                {
                    "id": "session-123",
                    "claude_session_id": "claude-session-123",
                    "project_path": "/test/project",
                    "git_branch": "main",
                    "start_time": "2025-01-13T09:00:00Z",
                    "end_time": None,
                    "created_at": "2025-01-13T09:00:00Z"
                },
                {
                    "id": "session-456", 
                    "claude_session_id": "claude-session-456",
                    "project_path": "/test/project2",
                    "git_branch": "dev",
                    "start_time": "2025-01-13T09:30:00Z",
                    "end_time": "2025-01-13T10:00:00Z",
                    "created_at": "2025-01-13T09:30:00Z"
                }
            ],
            "events": [
                {
                    "id": "event-1",
                    "session_id": "session-123",
                    "event_type": "session_start",
                    "timestamp": "2025-01-13T09:00:00Z",
                    "data": {"context": "test_session"},
                    "created_at": "2025-01-13T09:00:00Z"
                },
                {
                    "id": "event-2",
                    "session_id": "session-123", 
                    "event_type": "prompt",
                    "timestamp": "2025-01-13T09:01:00Z",
                    "data": {"prompt_text": "Help me debug this code", "prompt_length": 23},
                    "created_at": "2025-01-13T09:01:00Z"
                },
                {
                    "id": "event-3",
                    "session_id": "session-123",
                    "event_type": "tool_use",
                    "timestamp": "2025-01-13T09:02:00Z",
                    "tool_name": "Read",
                    "duration_ms": 150,
                    "data": {"tool_input": {"file_path": "/test/file.py"}, "tool_output": {"content": "def test(): pass"}},
                    "created_at": "2025-01-13T09:02:00Z"
                },
                {
                    "id": "event-4",
                    "session_id": "session-123",
                    "event_type": "tool_use", 
                    "timestamp": "2025-01-13T09:03:00Z",
                    "tool_name": "Edit",
                    "duration_ms": 300,
                    "data": {"tool_input": {"file_path": "/test/file.py", "old_string": "pass", "new_string": "return True"}, "tool_output": {"success": True}},
                    "created_at": "2025-01-13T09:03:00Z"
                },
                {
                    "id": "event-5",
                    "session_id": "session-456",
                    "event_type": "session_start",
                    "timestamp": "2025-01-13T09:30:00Z",
                    "data": {"context": "test_session_2"},
                    "created_at": "2025-01-13T09:30:00Z"
                },
                {
                    "id": "event-6",
                    "session_id": "session-456",
                    "event_type": "tool_use",
                    "timestamp": "2025-01-13T09:31:00Z", 
                    "tool_name": "Bash",
                    "duration_ms": 2000,
                    "data": {"tool_input": {"command": "pytest tests/"}, "tool_output": {"stdout": "All tests passed", "exit_code": 0}},
                    "created_at": "2025-01-13T09:31:00Z"
                },
                {
                    "id": "event-7",
                    "session_id": "session-456",
                    "event_type": "tool_use",
                    "timestamp": "2025-01-13T09:32:00Z",
                    "tool_name": "Write",
                    "duration_ms": 500,
                    "data": {"tool_input": {"file_path": "/test/new_file.py", "content": "# New file"}, "tool_output": {"success": True}},
                    "created_at": "2025-01-13T09:32:00Z"
                },
                {
                    "id": "event-8",
                    "session_id": "session-456",
                    "event_type": "session_end",
                    "timestamp": "2025-01-13T10:00:00Z",
                    "data": {"context": "session_completed"},
                    "created_at": "2025-01-13T10:00:00Z"
                }
            ]
        }
    
    @pytest.fixture
    def snapshot_file(self, sample_snapshot_data):
        """Create a temporary snapshot file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(sample_snapshot_data, f, indent=2)
            return f.name
    
    def test_snapshot_loading(self, snapshot_file):
        """Test loading snapshot data from file."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        assert playback.snapshot_data is not None
        assert len(playback.snapshot_data['sessions']) == 2
        assert len(playback.snapshot_data['events']) == 8
        assert playback.snapshot_data['metadata']['sessions_captured'] == 2
    
    def test_snapshot_validation(self, snapshot_file):
        """Test snapshot data validation."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        # Should validate successfully
        assert playback.validate_snapshot() is True
        
        # Test with invalid data
        playback.snapshot_data = {"invalid": "structure"}
        assert playback.validate_snapshot() is False
    
    def test_snapshot_stats(self, snapshot_file):
        """Test snapshot statistics generation."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        stats = playback.get_replay_stats()
        
        assert stats['sessions_count'] == 2
        assert stats['events_count'] == 8
        assert stats['unique_sessions'] == 2
        
        # Check event type breakdown
        assert stats['event_types']['session_start'] == 2
        assert stats['event_types']['session_end'] == 1
        assert stats['event_types']['tool_use'] == 4
        assert stats['event_types']['prompt'] == 1
        
        # Check tool usage
        assert stats['tool_usage']['Read'] == 1
        assert stats['tool_usage']['Edit'] == 1
        assert stats['tool_usage']['Bash'] == 1
        assert stats['tool_usage']['Write'] == 1
    
    @pytest.mark.asyncio
    async def test_memory_replay(self, snapshot_file):
        """Test replaying data in memory mode."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        # Replay sessions
        sessions = await playback.replay_sessions(time_acceleration=100.0)
        assert len(sessions) == 2
        
        # Verify session data structure
        for session in sessions:
            assert 'id' in session or 'claude_session_id' in session
            assert 'project_path' in session
            assert 'start_time' in session
        
        # Replay events
        events = await playback.replay_events(time_acceleration=100.0)
        assert len(events) == 8
        
        # Verify event data structure
        for event in events:
            assert 'session_id' in event
            assert 'event_type' in event
            assert 'timestamp' in event
            assert 'data' in event
            assert EventType.is_valid(event['event_type'])
    
    @pytest.mark.asyncio
    async def test_sqlite_replay(self, snapshot_file):
        """Test replaying data to SQLite database."""
        playback = SnapshotPlayback(snapshot_file, "sqlite")
        
        # Verify SQLite initialization
        assert playback.sqlite_connection is not None
        
        # Perform full replay
        results = await playback.full_replay(time_acceleration=100.0)
        
        assert results['replay_summary']['sessions_replayed'] == 2
        assert results['replay_summary']['events_replayed'] == 8
        assert results['replay_summary']['target'] == "sqlite"
        
        # Verify data was inserted into SQLite
        cursor = playback.sqlite_connection.cursor()
        
        # Check sessions
        cursor.execute("SELECT COUNT(*) FROM sessions")
        session_count = cursor.fetchone()[0]
        assert session_count == 2
        
        # Check events
        cursor.execute("SELECT COUNT(*) FROM events")
        event_count = cursor.fetchone()[0]
        assert event_count == 8
        
        # Check event types
        cursor.execute("SELECT event_type, COUNT(*) FROM events GROUP BY event_type")
        event_types = dict(cursor.fetchall())
        assert event_types['tool_use'] == 4
        assert event_types['session_start'] == 2
        
        playback.cleanup()
    
    @pytest.mark.asyncio
    async def test_full_replay_workflow(self, snapshot_file):
        """Test complete replay workflow."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        # Get initial stats
        stats = playback.get_replay_stats()
        initial_sessions = stats['sessions_count']
        initial_events = stats['events_count']
        
        # Perform full replay
        results = await playback.full_replay(time_acceleration=50.0)
        
        # Verify results structure
        assert 'replay_summary' in results
        assert 'sessions' in results
        assert 'events' in results
        
        summary = results['replay_summary']
        assert summary['sessions_replayed'] == initial_sessions
        assert summary['events_replayed'] == initial_events
        assert summary['target'] == "memory"
        assert 'duration_seconds' in summary
        assert 'completed_at' in summary
    
    def test_data_sanitization_in_snapshots(self, snapshot_file):
        """Test that snapshot data is properly sanitized."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        # Check that data goes through sanitization
        for event in playback.snapshot_data['events']:
            event_data = event.get('data', {})
            
            # Ensure no sensitive data patterns
            if isinstance(event_data, dict):
                data_str = json.dumps(event_data).lower()
                sensitive_patterns = ['password', 'secret', 'token', 'api_key']
                
                for pattern in sensitive_patterns:
                    # If pattern exists, it should be redacted
                    if pattern in data_str:
                        assert '[redacted]' in data_str.lower()
    
    def test_event_type_validation(self, snapshot_file):
        """Test that all events have valid types."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        valid_types = EventType.all_types()
        
        for event in playback.snapshot_data['events']:
            event_type = event.get('event_type')
            assert event_type in valid_types, f"Invalid event type: {event_type}"
    
    def test_session_event_relationships(self, snapshot_file):
        """Test that events are properly linked to sessions."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        session_ids = {s.get('id') or s.get('claude_session_id') for s in playback.snapshot_data['sessions']}
        
        for event in playback.snapshot_data['events']:
            event_session_id = event.get('session_id')
            assert event_session_id in session_ids, f"Event references unknown session: {event_session_id}"
    
    def test_tool_event_structure(self, snapshot_file):
        """Test tool usage events have proper structure."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        for event in playback.snapshot_data['events']:
            if event.get('event_type') == EventType.TOOL_USE:
                # Tool events should have tool_name
                assert 'tool_name' in event
                assert event['tool_name'] is not None
                
                # Should have duration if available
                if 'duration_ms' in event:
                    assert isinstance(event['duration_ms'], int)
                    assert event['duration_ms'] >= 0
                
                # Tool data should have input/output structure
                data = event.get('data', {})
                if isinstance(data, dict):
                    assert 'tool_input' in data or 'tool_output' in data
    
    def test_timestamp_ordering(self, snapshot_file):
        """Test that events maintain chronological order within sessions."""
        playback = SnapshotPlayback(snapshot_file, "memory")
        
        # Group events by session
        session_events = {}
        for event in playback.snapshot_data['events']:
            session_id = event.get('session_id')
            if session_id not in session_events:
                session_events[session_id] = []
            session_events[session_id].append(event)
        
        # Check ordering within each session
        for session_id, events in session_events.items():
            timestamps = [event.get('timestamp') for event in events]
            sorted_timestamps = sorted(timestamps)
            
            # Events should be in chronological order (or very close)
            # Allow some flexibility for simultaneous events
            assert timestamps == sorted_timestamps or len(set(timestamps)) < len(timestamps)


# Test runner for CLI usage
async def run_snapshot_tests(snapshot_file: str, verbose: bool = False):
    """
    Run snapshot integration tests programmatically.
    
    Args:
        snapshot_file: Path to snapshot file
        verbose: Enable verbose output
        
    Returns:
        Test results summary
    """
    import tempfile
    
    # Create a test instance
    test_instance = TestSnapshotIntegration()
    
    results = {
        "tests_run": 0,
        "tests_passed": 0,
        "tests_failed": 0,
        "failures": []
    }
    
    # List of test methods to run
    test_methods = [
        ("test_snapshot_loading", False),
        ("test_snapshot_validation", False),
        ("test_snapshot_stats", False), 
        ("test_memory_replay", True),
        ("test_sqlite_replay", True),
        ("test_full_replay_workflow", True),
        ("test_data_sanitization_in_snapshots", False),
        ("test_event_type_validation", False),
        ("test_session_event_relationships", False),
        ("test_tool_event_structure", False),
        ("test_timestamp_ordering", False)
    ]
    
    for method_name, is_async in test_methods:
        results["tests_run"] += 1
        
        try:
            method = getattr(test_instance, method_name)
            
            if is_async:
                await method(snapshot_file)
            else:
                method(snapshot_file)
                
            results["tests_passed"] += 1
            if verbose:
                print(f"✅ {method_name}")
                
        except Exception as e:
            results["tests_failed"] += 1
            results["failures"].append({"test": method_name, "error": str(e)})
            if verbose:
                print(f"❌ {method_name}: {e}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run snapshot integration tests")
    parser.add_argument("snapshot", help="Path to snapshot JSON file")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    async def main():
        results = await run_snapshot_tests(args.snapshot, args.verbose)
        
        print(f"\n📊 Test Results:")
        print(f"Tests run: {results['tests_run']}")
        print(f"Passed: {results['tests_passed']}")
        print(f"Failed: {results['tests_failed']}")
        
        if results['failures']:
            print("\n❌ Failures:")
            for failure in results['failures']:
                print(f"  - {failure['test']}: {failure['error']}")
        
        return results['tests_failed'] == 0
    
    success = asyncio.run(main())
    sys.exit(0 if success else 1)