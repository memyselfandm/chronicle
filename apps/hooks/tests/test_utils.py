"""Tests for utility functions in hooks system."""

import json
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock

# Test data for validation
VALID_JSON_DATA = {
    "session_id": "test-session-123",
    "tool_name": "Read",
    "parameters": {"file_path": "/safe/path/file.txt"}
}

SENSITIVE_DATA = {
    "api_key": "sk-1234567890abcdef",
    "password": "secret123",
    "file_path": "/Users/john.doe/private/document.txt",
    "supabase_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "clean_data": "this should remain"
}

INVALID_JSON_DATA = {
    "malformed": "x" * (11 * 1024 * 1024),  # Too large (> 10MB)
}


def test_sanitize_data_removes_api_keys():
    """Test that sanitize_data removes API keys and secrets."""
    from src.utils import sanitize_data
    
    result = sanitize_data(SENSITIVE_DATA)
    result_str = str(result)
    
    # Should not contain sensitive values
    assert "sk-1234567890abcdef" not in result_str
    assert "secret123" not in result_str
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in result_str
    # Should contain redacted markers
    assert "[REDACTED]" in result_str
    # Should preserve clean data
    assert "this should remain" in result_str


def test_sanitize_data_removes_user_paths():
    """Test that sanitize_data removes user-specific file paths."""
    from src.utils import sanitize_data
    
    data = {"file_path": "/Users/john.doe/Documents/secret.txt"}
    result = sanitize_data(data)
    result_str = str(result)
    
    # Should replace with sanitized version
    assert "/Users/john.doe" not in result_str
    assert "/Users/[USER]" in result_str


def test_extract_session_context_from_env():
    """Test extraction of Claude session context from environment."""
    from src.utils import extract_session_context
    
    with patch.dict(os.environ, {
        "CLAUDE_SESSION_ID": "test-session-456",
        "CLAUDE_TRANSCRIPT_PATH": "/tmp/transcript.txt"
    }):
        context = extract_session_context()
        
        assert context["session_id"] == "test-session-456"
        assert context["transcript_path"] == "/tmp/transcript.txt"


def test_extract_session_context_missing_env():
    """Test behavior when session environment variables are missing."""
    from src.utils import extract_session_context
    
    with patch.dict(os.environ, {}, clear=True):
        context = extract_session_context()
        
        assert context["session_id"] is None
        assert context["transcript_path"] is None


def test_validate_json_valid_data():
    """Test JSON validation with valid data."""
    from src.utils import validate_json
    
    result = validate_json(VALID_JSON_DATA)
    assert result is True


def test_validate_json_invalid_data():
    """Test JSON validation with invalid data."""
    from src.utils import validate_json
    
    result = validate_json(INVALID_JSON_DATA)
    assert result is False


def test_validate_json_none_data():
    """Test JSON validation with None data."""
    from src.utils import validate_json
    
    result = validate_json(None)
    assert result is False


@patch('subprocess.run')
def test_get_git_info_success(mock_run):
    """Test successful git information extraction."""
    from src.utils import get_git_info
    
    # Mock successful git command
    mock_run.return_value = MagicMock(
        returncode=0,
        stdout="main\n",
        stderr=""
    )
    
    git_info = get_git_info()
    
    assert git_info["branch"] == "main"
    assert git_info["is_git_repo"] is True


@patch('subprocess.run')
def test_get_git_info_not_a_repo(mock_run):
    """Test git info extraction when not in a git repository."""
    from src.utils import get_git_info
    
    # Mock failed git command
    mock_run.return_value = MagicMock(
        returncode=128,
        stdout="",
        stderr="fatal: not a git repository"
    )
    
    git_info = get_git_info()
    
    assert git_info["branch"] is None
    assert git_info["is_git_repo"] is False
    assert git_info["error"] is not None


def test_get_git_info_with_cwd():
    """Test git info extraction with specific working directory."""
    from src.utils import get_git_info
    
    # Create a temporary directory for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        git_info = get_git_info(cwd=temp_dir)
        
        # Should handle non-git directory gracefully
        assert git_info["is_git_repo"] is False