"""Tests for BaseHook class."""

import json
import os
import tempfile
import pytest
from unittest.mock import Mock, patch, MagicMock, mock_open
from datetime import datetime


@pytest.fixture
def mock_database_manager():
    """Mock database manager."""
    manager = Mock()
    manager.save_session.return_value = True
    manager.save_event.return_value = True
    manager.get_status.return_value = {"supabase": {"has_client": True}}
    return manager


@pytest.fixture
def sample_hook_input():
    """Sample hook input data."""
    return {
        "hookEventName": "PreToolUse",
        "sessionId": "test-session-123",
        "transcriptPath": "/tmp/transcript.txt",
        "cwd": "/test/project",
        "toolName": "Read",
        "toolInput": {"file_path": "/test/file.txt"}
    }


def test_base_hook_init():
    """Test BaseHook initialization."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager') as mock_db:
        mock_db.return_value = Mock()
        
        hook = BaseHook()
        
        assert hook.db_manager is not None
        assert hook.session_id is None  # Will be set when processing
        mock_db.assert_called_once()


def test_get_session_id_from_env():
    """Test extracting session ID from environment."""
    from src.core.base_hook import BaseHook
    
    with patch.dict(os.environ, {"CLAUDE_SESSION_ID": "env-session-456"}):
        with patch('src.core.base_hook.DatabaseManager'):
            hook = BaseHook()
            
            session_id = hook.get_claude_session_id()
            
            assert session_id == "env-session-456"


def test_get_session_id_from_input():
    """Test extracting session ID from input data."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager'):
        hook = BaseHook()
        
        input_data = {"sessionId": "input-session-789"}
        session_id = hook.get_claude_session_id(input_data)
        
        assert session_id == "input-session-789"


def test_get_session_id_priority():
    """Test session ID extraction priority (input > env)."""
    from src.core.base_hook import BaseHook
    
    with patch.dict(os.environ, {"CLAUDE_SESSION_ID": "env-session"}):
        with patch('src.core.base_hook.DatabaseManager'):
            hook = BaseHook()
            
            input_data = {"sessionId": "input-session"}
            session_id = hook.get_claude_session_id(input_data)
            
            # Input should take priority over environment
            assert session_id == "input-session"


@patch('src.base_hook.get_git_info')
def test_load_project_context(mock_git_info):
    """Test loading project context."""
    from src.core.base_hook import BaseHook
    
    mock_git_info.return_value = {
        "branch": "main",
        "commit_hash": "abc123",
        "is_git_repo": True,
        "has_changes": False
    }
    
    with patch('src.core.base_hook.DatabaseManager'):
        hook = BaseHook()
        
        context = hook.load_project_context()
        
        assert context["cwd"] == os.getcwd()
        assert context["git_info"]["branch"] == "main"
        assert "timestamp" in context


def test_save_event_success(mock_database_manager):
    """Test successful event saving."""
    from src.core.base_hook import BaseHook
    
    with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
        hook = BaseHook()
        hook.session_id = "test-session"
        
        event_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "success": True
        }
        
        result = hook.save_event(event_data)
        
        assert result is True
        mock_database_manager.save_event.assert_called_once()
        
        # Check that session_id was added
        called_args = mock_database_manager.save_event.call_args[0][0]
        assert called_args["session_id"] == "test-session"


def test_save_event_failure(mock_database_manager):
    """Test event saving failure."""
    from src.core.base_hook import BaseHook
    
    mock_database_manager.save_event.return_value = False
    
    with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
        hook = BaseHook()
        hook.session_id = "test-session"
        
        event_data = {"hook_event_name": "PreToolUse"}
        
        result = hook.save_event(event_data)
        
        assert result is False


def test_save_event_without_session_id():
    """Test event saving without session ID."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager'):
        hook = BaseHook()
        # Don't set session_id
        
        event_data = {"hook_event_name": "PreToolUse"}
        
        result = hook.save_event(event_data)
        
        assert result is False


def test_log_error_creates_file():
    """Test error logging creates log file."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager'):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = os.path.join(temp_dir, "test.log")
            
            with patch.object(BaseHook, 'log_file', log_file):
                hook = BaseHook()
                
                test_error = Exception("Test error message")
                hook.log_error(test_error, "test_context")
                
                # Check that log file was created and contains error
                assert os.path.exists(log_file)
                with open(log_file, 'r') as f:
                    content = f.read()
                    assert "Test error message" in content
                    assert "test_context" in content


def test_log_error_appends_to_existing():
    """Test error logging appends to existing log file."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager'):
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
            temp_file.write("Existing log content\n")
            temp_file.flush()
            
            try:
                with patch.object(BaseHook, 'log_file', temp_file.name):
                    hook = BaseHook()
                    
                    test_error = Exception("New error")
                    hook.log_error(test_error)
                    
                    with open(temp_file.name, 'r') as f:
                        content = f.read()
                        assert "Existing log content" in content
                        assert "New error" in content
            finally:
                os.unlink(temp_file.name)


@patch('src.base_hook.sanitize_data')
def test_process_hook_input_sanitization(mock_sanitize):
    """Test that hook input is sanitized."""
    from src.core.base_hook import BaseHook
    
    mock_sanitize.return_value = {"clean": "data"}
    
    with patch('src.core.base_hook.DatabaseManager'):
        hook = BaseHook()
        
        input_data = {"sensitive": "api_key_12345"}
        result = hook._sanitize_input(input_data)
        
        mock_sanitize.assert_called_once_with(input_data)
        assert result == {"clean": "data"}


def test_hook_timing_measurement():
    """Test that hook execution time is measured."""
    from src.core.base_hook import BaseHook
    
    with patch('src.core.base_hook.DatabaseManager'):
        hook = BaseHook()
        
        with hook._measure_execution_time() as timer:
            # Simulate some work
            import time
            time.sleep(0.01)  # 10ms
        
        # Should have measured some time
        assert timer.duration_ms > 0
        assert timer.duration_ms < 100  # Should be less than 100ms


def test_error_handling_in_save_event():
    """Test error handling when saving events."""
    from src.core.base_hook import BaseHook
    
    mock_db = Mock()
    mock_db.save_event.side_effect = Exception("Database error")
    
    with patch('apps.hooks.src.core.base_hook.DatabaseManager', return_value=mock_db):
        hook = BaseHook()
        hook.session_id = "test-session"
        
        # Should not raise exception, should return False
        result = hook.save_event({"hook_event_name": "test"})
        
        assert result is False