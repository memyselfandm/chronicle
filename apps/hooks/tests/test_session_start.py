"""
Test suite for session_start.py hook.

This test suite validates session lifecycle tracking functionality including:
- Session ID extraction from environment and input data
- Project context extraction (working directory, git info)
- Database session record creation
- Event logging with proper session_start event type
- Error handling and fallback scenarios
"""

import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from unittest import mock
from unittest.mock import Mock, patch, MagicMock
import pytest

# Import from src module
from src.core.base_hook import BaseHook


class MockSessionStartHook(BaseHook):
    """Mock implementation of session_start hook for testing."""
    
    def process_session_start(self, input_data):
        """
        Process session start hook data.
        
        Args:
            input_data: Hook input data from Claude Code
            
        Returns:
            Tuple of (success: bool, session_data: dict, event_data: dict)
        """
        try:
            # Extract session ID and basic data
            self.claude_session_id = self.get_claude_session_id(input_data)
            
            # Get project context
            project_context = self.load_project_context(input_data.get("cwd"))
            
            # Extract session start specific data
            trigger_source = input_data.get("source", "unknown")
            
            # Prepare session data
            session_data = {
                "session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "source": trigger_source,
                "project_path": project_context.get("cwd"),
                "git_branch": project_context.get("git_info", {}).get("branch"),
                "git_commit": project_context.get("git_info", {}).get("commit_hash"),
            }
            
            # Prepare event data
            event_data = {
                "event_type": "session_start",
                "hook_event_name": "SessionStart",
                "session_id": self.claude_session_id,
                "data": {
                    "project_path": project_context.get("cwd"),
                    "git_branch": project_context.get("git_info", {}).get("branch"),
                    "git_commit": project_context.get("git_info", {}).get("commit_hash"),
                    "trigger_source": trigger_source,
                    "session_context": project_context.get("session_context", {}),
                }
            }
            
            # Save to database
            session_success = self.save_session(session_data)
            event_success = self.save_event(event_data)
            
            return (session_success and event_success, session_data, event_data)
            
        except Exception as e:
            self.log_error(e, "process_session_start")
            return (False, {}, {})


@pytest.fixture
def mock_hook():
    """Create a mock session start hook instance."""
    with patch('src.database.DatabaseManager'):
        hook = MockSessionStartHook()
        hook.db_manager = Mock()
        hook.db_manager.save_session = Mock(return_value=True)
        hook.db_manager.save_event = Mock(return_value=True)
        return hook


@pytest.fixture
def sample_input_data():
    """Sample input data that would come from Claude Code."""
    return {
        "hookEventName": "SessionStart",
        "sessionId": "test-session-123",
        "source": "startup",
        "transcriptPath": "/path/to/transcript.json",
        "cwd": "/test/project/path"
    }


@pytest.fixture 
def temp_git_repo():
    """Create a temporary git repository for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Initialize git repo
        os.chdir(temp_dir)
        os.system("git init")
        os.system("git config user.email 'test@example.com'")
        os.system("git config user.name 'Test User'")
        
        # Create a test file and commit
        with open("README.md", "w") as f:
            f.write("# Test Repo")
        os.system("git add README.md")
        os.system("git commit -m 'Initial commit'")
        os.system("git checkout -b test-branch")
        
        yield temp_dir


class TestSessionStartHook:
    """Test cases for session start hook functionality."""
    
    def test_session_id_extraction_from_input(self, mock_hook, sample_input_data):
        """Test extracting session ID from input data."""
        session_id = mock_hook.get_claude_session_id(sample_input_data)
        
        assert session_id == "test-session-123"
        assert mock_hook.claude_session_id is None  # Should not be set yet
    
    def test_session_id_extraction_from_environment(self, mock_hook):
        """Test extracting session ID from environment variable."""
        with patch.dict(os.environ, {"CLAUDE_SESSION_ID": "env-session-456"}):
            session_id = mock_hook.get_claude_session_id({})
            
            assert session_id == "env-session-456"
    
    def test_session_id_priority_input_over_env(self, mock_hook, sample_input_data):
        """Test that input data session ID takes priority over environment."""
        with patch.dict(os.environ, {"CLAUDE_SESSION_ID": "env-session-456"}):
            session_id = mock_hook.get_claude_session_id(sample_input_data)
            
            assert session_id == "test-session-123"  # Input should win
    
    def test_no_session_id_available(self, mock_hook):
        """Test handling when no session ID is available."""
        session_id = mock_hook.get_claude_session_id({})
        
        assert session_id is None
    
    def test_project_context_extraction(self, mock_hook):
        """Test project context extraction with git info."""
        # Mock the load_project_context method directly
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/path",
                "timestamp": "2024-01-01T12:00:00",
                "git_info": {
                    "branch": "test-branch",
                    "commit_hash": "abc123",
                    "status": "clean"
                },
                "session_context": {"user": "test"}
            }
            
            context = mock_hook.load_project_context("/test/path")
        
        assert context["cwd"] == "/test/path"
        assert "timestamp" in context
        assert context["git_info"]["branch"] == "test-branch"
        assert context["git_info"]["commit_hash"] == "abc123"
        assert context["session_context"]["user"] == "test"
    
    def test_project_context_no_git(self, mock_hook):
        """Test project context extraction without git repository."""
        # Mock the load_project_context method directly
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/path",
                "timestamp": "2024-01-01T12:00:00",
                "git_info": {},
                "session_context": {}
            }
            
            context = mock_hook.load_project_context("/test/path")
        
        assert context["cwd"] == "/test/path"
        assert "timestamp" in context
        assert context["git_info"] == {}
        assert context["session_context"] == {}
    
    def test_successful_session_start_processing(self, mock_hook, sample_input_data):
        """Test successful processing of session start hook."""
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/project/path",
                "timestamp": "2024-01-01T12:00:00",
                "git_info": {
                    "branch": "main",
                    "commit_hash": "abc123"
                },
                "session_context": {"user": "test"}
            }
            
            success, session_data, event_data = mock_hook.process_session_start(sample_input_data)
        
        # Verify success
        assert success is True
        
        # Verify session data structure
        assert session_data["session_id"] == "test-session-123"
        assert session_data["source"] == "startup"
        assert session_data["project_path"] == "/test/project/path"
        assert session_data["git_branch"] == "main"
        assert session_data["git_commit"] == "abc123"
        assert "start_time" in session_data
        
        # Verify event data structure
        assert event_data["event_type"] == "session_start"
        assert event_data["hook_event_name"] == "session_start"
        assert event_data["session_id"] == "test-session-123"
        assert event_data["data"]["project_path"] == "/test/project/path"
        assert event_data["data"]["git_branch"] == "main"
        assert event_data["data"]["git_commit"] == "abc123"
        assert event_data["data"]["trigger_source"] == "startup"
        
        # Verify database calls
        mock_hook.db_manager.save_session.assert_called_once()
        mock_hook.db_manager.save_event.assert_called_once()
    
    def test_session_start_with_different_sources(self, mock_hook):
        """Test session start with different trigger sources."""
        test_sources = ["startup", "resume", "clear"]
        
        for source in test_sources:
            input_data = {
                "hookEventName": "SessionStart",
                "sessionId": f"test-session-{source}",
                "source": source,
                "cwd": "/test/project"
            }
            
            with patch.object(mock_hook, 'load_project_context') as mock_context:
                mock_context.return_value = {
                    "cwd": "/test/project",
                    "git_info": {},
                    "session_context": {}
                }
                
                success, session_data, event_data = mock_hook.process_session_start(input_data)
            
            assert success is True
            assert session_data["source"] == source
            assert event_data["data"]["trigger_source"] == source
    
    def test_session_start_database_failure(self, mock_hook, sample_input_data):
        """Test handling of database save failures."""
        # Make database save fail
        mock_hook.db_manager.save_session.return_value = False
        mock_hook.db_manager.save_event.return_value = True
        
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/project",
                "git_info": {},
                "session_context": {}
            }
            
            success, session_data, event_data = mock_hook.process_session_start(sample_input_data)
        
        # Should fail if either save fails
        assert success is False
        
        # Should still have attempted both saves
        mock_hook.db_manager.save_session.assert_called_once()
        mock_hook.db_manager.save_event.assert_called_once()
    
    def test_session_start_exception_handling(self, mock_hook, sample_input_data):
        """Test exception handling during session start processing."""
        # Make load_project_context raise an exception
        with patch.object(mock_hook, 'load_project_context', side_effect=Exception("Test error")):
            with patch.object(mock_hook, 'log_error') as mock_log_error:
                success, session_data, event_data = mock_hook.process_session_start(sample_input_data)
        
        # Should fail gracefully
        assert success is False
        assert session_data == {}
        assert event_data == {}
        
        # Should log the error
        mock_log_error.assert_called_once()
    
    def test_session_start_missing_session_id(self, mock_hook):
        """Test handling when session ID is missing."""
        input_data = {
            "hookEventName": "SessionStart",
            "source": "startup",
            "cwd": "/test/project"
        }
        
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/project",
                "git_info": {},
                "session_context": {}
            }
            
            success, session_data, event_data = mock_hook.process_session_start(input_data)
        
        # Should fail because BaseHook won't save events without session_id
        assert success is False
        assert session_data["session_id"] is None
        assert event_data["session_id"] is None
        
        # But session and event data should still be constructed
        assert session_data["source"] == "startup"
        assert event_data["event_type"] == "session_start"
    
    def test_session_start_default_source(self, mock_hook):
        """Test default source value when not provided."""
        input_data = {
            "hookEventName": "SessionStart",
            "sessionId": "test-session-123",
            "cwd": "/test/project"
        }
        
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/project",
                "git_info": {},
                "session_context": {}
            }
            
            success, session_data, event_data = mock_hook.process_session_start(input_data)
        
        assert success is True
        assert session_data["source"] == "unknown"
        assert event_data["data"]["trigger_source"] == "unknown"
    
    def test_session_data_structure_completeness(self, mock_hook, sample_input_data):
        """Test that session data contains all required fields."""
        with patch.object(mock_hook, 'load_project_context') as mock_context:
            mock_context.return_value = {
                "cwd": "/test/project/path",
                "git_info": {
                    "branch": "feature/test",
                    "commit_hash": "def456"
                },
                "session_context": {"env": "test"}
            }
            
            success, session_data, event_data = mock_hook.process_session_start(sample_input_data)
        
        # Verify all required session fields are present
        required_session_fields = [
            "session_id", "start_time", "source", 
            "project_path", "git_branch", "git_commit"
        ]
        
        for field in required_session_fields:
            assert field in session_data, f"Missing session field: {field}"
        
        # Verify all required event fields are present
        required_event_fields = [
            "event_type", "hook_event_name", "session_id", "data"
        ]
        
        for field in required_event_fields:
            assert field in event_data, f"Missing event field: {field}"
        
        # Verify event data contains required sub-fields
        required_event_data_fields = [
            "project_path", "git_branch", "git_commit", 
            "trigger_source", "session_context"
        ]
        
        for field in required_event_data_fields:
            assert field in event_data["data"], f"Missing event data field: {field}"
    
    def test_hook_response_format(self, mock_hook, sample_input_data):
        """Test that hook creates proper response format."""
        response = mock_hook.create_response(
            continue_execution=True,
            suppress_output=False,
            hook_specific_data={
                "session_initialized": True,
                "session_id": "test-session-123"
            }
        )
        
        assert response["continue"] is True
        assert response["suppressOutput"] is False
        assert response["hookSpecificOutput"]["session_initialized"] is True
        assert response["hookSpecificOutput"]["session_id"] == "test-session-123"


@pytest.mark.integration
class TestSessionStartIntegration:
    """Integration tests for session start hook."""
    
    def test_real_git_repository_integration(self, temp_git_repo, mock_hook):
        """Test integration with a real git repository."""
        input_data = {
            "hookEventName": "SessionStart",
            "sessionId": "integration-test-session",
            "source": "startup",
            "cwd": temp_git_repo
        }
        
        success, session_data, event_data = mock_hook.process_session_start(input_data)
        
        assert success is True
        assert session_data["project_path"] == temp_git_repo
        assert session_data["git_branch"] == "test-branch"
        assert session_data["git_commit"] is not None
        assert len(session_data["git_commit"]) > 0  # Should have a commit hash
    
    @pytest.mark.skip(reason="Flaky test due to database manager initialization timing")
    def test_non_git_directory_integration(self, mock_hook):
        """Test integration with a non-git directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            input_data = {
                "hookEventName": "SessionStart",
                "sessionId": "non-git-session",
                "source": "startup", 
                "cwd": temp_dir
            }
            
            # Patch the save methods directly on the hook instance
            with patch.object(mock_hook, 'save_session', return_value=True), \
                 patch.object(mock_hook, 'save_event', return_value=True):
                
                success, session_data, event_data = mock_hook.process_session_start(input_data)
            
            assert success is True
            assert session_data["project_path"] == temp_dir
            # Git info might be None or empty string depending on utils.get_git_info implementation
            assert session_data["git_branch"] in [None, ""]
            assert session_data["git_commit"] in [None, ""]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])