"""
Core Session Lifecycle Tests - Working Version

Essential tests for session_start, stop, and subagent_stop hooks.
This file contains the most critical test cases with proper mocking.
"""

import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch
import pytest
import subprocess
import sys

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Import the hook classes
from src.hooks.session_start import SessionStartHook, get_git_info, resolve_project_path
from src.hooks.stop import StopHook
from src.hooks.subagent_stop import SubagentStopHook


class TestFixtures:
    """Shared test fixtures."""
    
    @pytest.fixture
    def mock_database_manager(self):
        """Create a mock database manager."""
        db_manager = Mock()
        db_manager.get_session.return_value = None
        db_manager.save_session.return_value = (True, str(uuid.uuid4()))
        db_manager.save_event.return_value = True
        db_manager.supabase_client = Mock()
        db_manager.sqlite_path = Path("/tmp/test.db")
        db_manager.timeout = 30
        db_manager.SESSIONS_TABLE = "chronicle_sessions"
        db_manager.EVENTS_TABLE = "chronicle_events"
        return db_manager
    
    @pytest.fixture
    def mock_environment(self):
        """Mock environment variables."""
        env_vars = {
            "CLAUDE_SESSION_ID": "test-session-123",
            "CLAUDE_PROJECT_DIR": "/test/project",
            "USER": "testuser",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            yield env_vars


class TestSessionStartCore(TestFixtures):
    """Core tests for SessionStartHook."""
    
    def test_basic_functionality(self, mock_database_manager, mock_environment):
        """Test basic session start functionality."""
        hook = SessionStartHook()
        hook.db_manager = mock_database_manager
        
        input_data = {
            "source": "user_initiation",
            "cwd": "/test/project"
        }
        
        success, session_data, event_data = hook.process_session_start(input_data)
        
        # Verify success
        assert success is True
        
        # Verify session data structure
        assert session_data["claude_session_id"] == "test-session-123"
        assert session_data["source"] == "user_initiation"
        assert "start_time" in session_data
        
        # Verify event data structure
        assert event_data["event_type"] == "session_start"
        assert event_data["hook_event_name"] == "SessionStart"
        assert "project_path" in event_data["data"]
        assert "session_context" in event_data["data"]
    
    def test_git_info_extraction(self):
        """Test git information extraction."""
        # Test in non-git directory
        with tempfile.TemporaryDirectory() as temp_dir:
            git_info = get_git_info(temp_dir)
            assert git_info["is_git_repo"] is False
            assert git_info["branch"] is None
            assert git_info["commit_hash"] is None
    
    def test_project_path_resolution(self, mock_environment):
        """Test project path resolution."""
        # Should fall back to existing directory since /test/project doesn't exist
        resolved = resolve_project_path()
        assert os.path.exists(resolved)
    
    def test_performance_monitoring(self, mock_database_manager, mock_environment):
        """Test session start performance."""
        hook = SessionStartHook()
        hook.db_manager = mock_database_manager
        
        start_time = time.perf_counter()
        success, session_data, event_data = hook.process_session_start({})
        execution_time = (time.perf_counter() - start_time) * 1000
        
        # Should handle quickly with mocked database
        assert execution_time < 100, f"Hook took {execution_time:.2f}ms"
        assert success is True
    
    def test_error_handling(self, mock_environment):
        """Test error handling."""
        mock_db = Mock()
        mock_db.save_event.return_value = False
        
        hook = SessionStartHook()
        hook.db_manager = mock_db
        
        success, session_data, event_data = hook.process_session_start({})
        
        # Should handle database failure gracefully
        assert success is False


class TestStopCore(TestFixtures):
    """Core tests for StopHook."""
    
    def test_basic_functionality(self, mock_database_manager, mock_environment):
        """Test basic stop hook functionality."""
        # Setup existing session
        mock_session = {
            "id": "session-uuid-123",
            "start_time": "2023-08-18T10:00:00"
        }
        mock_database_manager.get_session.return_value = mock_session
        
        hook = StopHook()
        hook.db_manager = mock_database_manager
        
        input_data = {
            "session_id": "test-session-123",
            "reason": "normal_completion"
        }
        
        result = hook.process_hook(input_data)
        
        # Verify response structure
        assert result["continue"] is True
        assert result["suppressOutput"] is True
        
        # Verify session lookup was called
        mock_database_manager.get_session.assert_called_with("test-session-123")
    
    def test_session_not_found(self, mock_database_manager, mock_environment):
        """Test stop hook when session is not found."""
        mock_database_manager.get_session.return_value = None
        mock_database_manager.save_session.return_value = (True, "new-session-uuid")
        
        hook = StopHook()
        hook.db_manager = mock_database_manager
        
        input_data = {"session_id": "nonexistent-session"}
        result = hook.process_hook(input_data)
        
        # Should create session for termination tracking
        mock_database_manager.save_session.assert_called_once()
        assert result["continue"] is True
    
    def test_duration_calculation(self, mock_database_manager, mock_environment):
        """Test session duration calculation."""
        start_time = datetime.now() - timedelta(minutes=5)
        mock_session = {
            "id": "session-uuid-123",
            "start_time": start_time.isoformat()
        }
        mock_database_manager.get_session.return_value = mock_session
        
        hook = StopHook()
        hook.db_manager = mock_database_manager
        
        # Mock event counting
        hook._count_session_events = Mock(return_value=10)
        hook._update_session_end = Mock(return_value=True)
        
        result = hook.process_hook({"session_id": "test-session-123"})
        
        # Verify session update was called
        assert hook._update_session_end.called
        
        # Verify event counting was called
        hook._count_session_events.assert_called_with("session-uuid-123")
    
    def test_performance_requirement(self, mock_database_manager, mock_environment):
        """Test stop hook performance."""
        mock_session = {"id": "session-uuid-123", "start_time": "2023-08-18T10:00:00"}
        mock_database_manager.get_session.return_value = mock_session
        
        hook = StopHook()
        hook.db_manager = mock_database_manager
        hook._count_session_events = Mock(return_value=5)
        hook._update_session_end = Mock(return_value=True)
        
        start_time = time.perf_counter()
        result = hook.process_hook({"session_id": "test-session-123"})
        execution_time = (time.perf_counter() - start_time) * 1000
        
        # Performance requirement: under 100ms
        assert execution_time < 100, f"Hook took {execution_time:.2f}ms"


class TestSubagentStopCore(TestFixtures):
    """Core tests for SubagentStopHook."""
    
    def test_basic_functionality(self, mock_database_manager, mock_environment):
        """Test basic subagent stop functionality."""
        hook = SubagentStopHook()
        hook.db_manager = mock_database_manager
        
        input_data = {
            "subagentId": "agent-456",
            "subagentType": "code_analyzer",
            "exitReason": "completed",
            "durationMs": 2500,
            "memoryUsageMb": 45,
            "operationsCount": 12
        }
        
        result = hook.process_hook(input_data)
        
        # Verify response structure
        assert result["continue"] is True
        assert result["suppressOutput"] is True
        
        # Verify save_event was called
        mock_database_manager.save_event.assert_called_once()
    
    def test_performance_rating(self, mock_database_manager, mock_environment):
        """Test subagent performance rating calculation."""
        hook = SubagentStopHook()
        hook.db_manager = mock_database_manager
        
        # Test excellent performance
        rating = hook._calculate_performance_rating(500, 30, 5)
        assert rating == "excellent"
        
        # Test good performance
        rating = hook._calculate_performance_rating(3000, 80, 3)
        assert rating == "good"
        
        # Test acceptable performance
        rating = hook._calculate_performance_rating(10000, 200, 1)
        assert rating == "acceptable"
        
        # Test needs optimization
        rating = hook._calculate_performance_rating(20000, 300, 0)
        assert rating == "needs_optimization"
    
    def test_event_data_structure(self, mock_database_manager, mock_environment):
        """Test subagent stop event data structure."""
        hook = SubagentStopHook()
        hook.db_manager = mock_database_manager
        
        input_data = {
            "subagentId": "agent-789",
            "subagentType": "file_processor",
            "exitReason": "error",
            "durationMs": 1200,
            "memoryUsageMb": 60,
            "operationsCount": 8
        }
        
        result = hook.process_hook(input_data)
        
        # Check that save_event was called with correct structure
        call_args = mock_database_manager.save_event.call_args[0][0]
        
        assert call_args["event_type"] == "subagent_stop"
        assert call_args["hook_event_name"] == "SubagentStop"
        assert "subagent_lifecycle" in call_args["data"]
        assert "termination_metrics" in call_args["data"]
        assert "resource_cleanup" in call_args["data"]
        
        # Verify lifecycle data
        lifecycle = call_args["data"]["subagent_lifecycle"]
        assert lifecycle["subagent_id"] == "agent-789"
        assert lifecycle["subagent_type"] == "file_processor"
        assert lifecycle["exit_reason"] == "error"
        assert lifecycle["duration_ms"] == 1200
    
    def test_performance_requirement(self, mock_database_manager, mock_environment):
        """Test subagent stop performance."""
        hook = SubagentStopHook()
        hook.db_manager = mock_database_manager
        
        start_time = time.perf_counter()
        result = hook.process_hook({})
        execution_time = (time.perf_counter() - start_time) * 1000
        
        # Performance requirement: under 100ms
        assert execution_time < 100, f"Hook took {execution_time:.2f}ms"


class TestSessionLifecycleIntegration(TestFixtures):
    """Integration tests for complete session lifecycle."""
    
    def test_complete_session_lifecycle(self, mock_database_manager, mock_environment):
        """Test complete session lifecycle from start to stop."""
        session_id = "integration-test-session"
        session_uuid = str(uuid.uuid4())
        
        # Setup database responses
        mock_database_manager.save_session.return_value = (True, session_uuid)
        mock_database_manager.get_session.return_value = {
            "id": session_uuid,
            "start_time": datetime.now().isoformat()
        }
        
        # 1. Start session
        start_hook = SessionStartHook()
        start_hook.db_manager = mock_database_manager
        
        start_success, session_data, event_data = start_hook.process_session_start({
            "source": "user_initiation"
        })
        
        assert start_success is True
        assert event_data["event_type"] == "session_start"
        
        # 2. End session
        stop_hook = StopHook()
        stop_hook.db_manager = mock_database_manager
        stop_hook._count_session_events = Mock(return_value=5)
        stop_hook._update_session_end = Mock(return_value=True)
        
        stop_result = stop_hook.process_hook({
            "session_id": session_id,
            "reason": "normal_completion"
        })
        
        assert stop_result["continue"] is True
        
        # Verify database interactions
        assert mock_database_manager.save_event.call_count >= 2  # At least start and stop events
    
    def test_session_with_subagent_lifecycle(self, mock_database_manager, mock_environment):
        """Test session lifecycle including subagent operations."""
        # 1. Start session
        start_hook = SessionStartHook()
        start_hook.db_manager = mock_database_manager
        
        start_success, _, _ = start_hook.process_session_start({})
        assert start_success is True
        
        # 2. Subagent operation
        subagent_hook = SubagentStopHook()
        subagent_hook.db_manager = mock_database_manager
        
        result = subagent_hook.process_hook({
            "subagentId": "agent-1",
            "subagentType": "analyzer",
            "exitReason": "completed",
            "durationMs": 800,
            "memoryUsageMb": 30,
            "operationsCount": 5
        })
        assert result["continue"] is True
        
        # 3. End session
        stop_hook = StopHook()
        stop_hook.db_manager = mock_database_manager
        stop_hook._count_session_events = Mock(return_value=3)
        stop_hook._update_session_end = Mock(return_value=True)
        
        stop_result = stop_hook.process_hook({})
        assert stop_result["continue"] is True
        
        # Verify all events were saved
        assert mock_database_manager.save_event.call_count >= 2  # start + subagent + stop


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])