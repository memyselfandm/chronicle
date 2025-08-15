#!/usr/bin/env python3
"""
Test utilities for UV single-file script testing.

Provides common fixtures, utilities, and helpers for testing Chronicle hooks.
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from unittest.mock import MagicMock, patch

import pytest

# Constants
SCRIPT_DIR = Path(__file__).parent.parent.parent / "src" / "hooks" / "uv_scripts"
MAX_EXECUTION_TIME_MS = 100.0
TEST_TIMEOUT_SECONDS = 5.0


class HookTestCase:
    """Base class for hook test cases with common utilities."""
    
    def __init__(self, hook_name: str, script_name: str):
        self.hook_name = hook_name
        self.script_name = script_name
        self.script_path = SCRIPT_DIR / script_name
        
    def create_test_input(self, **kwargs) -> Dict[str, Any]:
        """Create test input data for a hook."""
        base_input = {
            "sessionId": f"test-session-{uuid.uuid4()}",
            "transcriptPath": f"/tmp/test-transcript-{uuid.uuid4()}.jsonl",
            "cwd": str(Path.cwd()),
            "hookEventName": self.hook_name,
        }
        base_input.update(kwargs)
        return base_input
    
    def run_hook(self, input_data: Dict[str, Any], 
                 env_vars: Optional[Dict[str, str]] = None,
                 timeout: float = TEST_TIMEOUT_SECONDS) -> Tuple[int, str, str, float]:
        """
        Run a hook script with given input and return results.
        
        Returns:
            Tuple of (exit_code, stdout, stderr, execution_time_ms)
        """
        # Prepare environment
        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)
        
        # Ensure test environment variables
        env["CHRONICLE_TEST_MODE"] = "1"
        env["CLAUDE_SESSION_ID"] = input_data.get("sessionId", "test-session")
        
        # Prepare command
        cmd = ["uv", "run", str(self.script_path)]
        
        # Run the hook
        start_time = time.perf_counter()
        try:
            result = subprocess.run(
                cmd,
                input=json.dumps(input_data),
                capture_output=True,
                text=True,
                env=env,
                timeout=timeout
            )
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            
            return result.returncode, result.stdout, result.stderr, execution_time_ms
            
        except subprocess.TimeoutExpired:
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            return -1, "", f"Hook timed out after {timeout}s", execution_time_ms
        except Exception as e:
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            return -2, "", str(e), execution_time_ms
    
    def parse_hook_output(self, stdout: str) -> Optional[Dict[str, Any]]:
        """Parse JSON output from hook stdout."""
        if not stdout.strip():
            return None
        
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            # Some hooks may output plain text
            return {"raw_output": stdout}


@contextmanager
def temp_env_vars(**env_vars):
    """Temporarily set environment variables."""
    old_values = {}
    for key, value in env_vars.items():
        old_values[key] = os.environ.get(key)
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = str(value)
    
    try:
        yield
    finally:
        for key, old_value in old_values.items():
            if old_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old_value


@contextmanager
def temp_sqlite_db():
    """Create a temporary SQLite database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_chronicle.db"
        
        with temp_env_vars(
            CHRONICLE_DB_TYPE="sqlite",
            CLAUDE_HOOKS_DB_PATH=str(db_path)
        ):
            yield db_path


@contextmanager
def mock_supabase_client():
    """Mock Supabase client for testing."""
    with patch("supabase.create_client") as mock_create:
        mock_client = MagicMock()
        mock_create.return_value = mock_client
        
        # Mock table operations
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        
        # Mock chained operations
        mock_table.upsert.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])
        
        yield mock_client


def assert_performance(execution_time_ms: float, max_time_ms: float = MAX_EXECUTION_TIME_MS):
    """Assert that execution time is within acceptable limits."""
    assert execution_time_ms < max_time_ms, \
        f"Execution time {execution_time_ms:.2f}ms exceeds limit of {max_time_ms}ms"


def assert_valid_hook_response(response: Dict[str, Any]):
    """Assert that a hook response has valid structure."""
    assert isinstance(response, dict), "Response must be a dictionary"
    
    # Check required fields
    assert "continue" in response, "Response must have 'continue' field"
    assert isinstance(response["continue"], bool), "'continue' must be boolean"
    
    # Check optional fields
    if "suppressOutput" in response:
        assert isinstance(response["suppressOutput"], bool), "'suppressOutput' must be boolean"
    
    if "stopReason" in response:
        assert isinstance(response["stopReason"], str), "'stopReason' must be string"
        assert not response["continue"], "'stopReason' should only be present when continue=False"
    
    if "hookSpecificOutput" in response:
        assert isinstance(response["hookSpecificOutput"], dict), "'hookSpecificOutput' must be dict"
        assert "hookEventName" in response["hookSpecificOutput"], \
            "'hookSpecificOutput' must contain 'hookEventName'"


def create_test_git_repo(repo_dir: Path) -> Dict[str, str]:
    """Create a test git repository with some commits."""
    repo_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize repo
    subprocess.run(["git", "init"], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo_dir, capture_output=True)
    
    # Create initial commit
    test_file = repo_dir / "test.txt"
    test_file.write_text("Initial content")
    subprocess.run(["git", "add", "."], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=repo_dir, capture_output=True)
    
    # Get commit info
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_dir,
        capture_output=True,
        text=True
    )
    commit_hash = result.stdout.strip()[:12] if result.returncode == 0 else None
    
    # Create a branch
    subprocess.run(["git", "checkout", "-b", "test-branch"], cwd=repo_dir, capture_output=True)
    
    return {
        "path": str(repo_dir),
        "branch": "test-branch",
        "commit": commit_hash
    }


def generate_large_input(size_mb: float) -> Dict[str, Any]:
    """Generate a large input payload for testing size limits."""
    # Calculate approximate string size needed
    target_bytes = int(size_mb * 1024 * 1024)
    
    # Create a large string
    large_string = "x" * (target_bytes // 2)  # Divide by 2 to account for JSON overhead
    
    return {
        "sessionId": "test-large-input",
        "transcriptPath": "/tmp/test.jsonl",
        "cwd": "/tmp",
        "hookEventName": "TestEvent",
        "largeData": large_string
    }


def generate_malicious_input() -> List[Dict[str, Any]]:
    """Generate various malicious inputs for security testing."""
    return [
        # Path traversal attempts
        {
            "sessionId": "test-malicious",
            "transcriptPath": "../../etc/passwd",
            "cwd": "/tmp/../../../etc",
            "hookEventName": "TestEvent"
        },
        # Command injection attempts
        {
            "sessionId": "test-injection",
            "transcriptPath": "/tmp/test.jsonl; rm -rf /",
            "cwd": "/tmp",
            "hookEventName": "TestEvent",
            "command": "echo 'safe' && rm -rf /"
        },
        # SQL injection attempts
        {
            "sessionId": "'; DROP TABLE sessions; --",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "TestEvent"
        },
        # Sensitive data patterns
        {
            "sessionId": "test-sensitive",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/Users/testuser/project",
            "hookEventName": "TestEvent",
            "data": {
                "api_key": "sk-ant-api03-12345",
                "password": "secretpassword123",
                "secret": "my-secret-token"
            }
        }
    ]


# Pytest fixtures

@pytest.fixture
def test_session_id():
    """Generate a unique test session ID."""
    return f"test-session-{uuid.uuid4()}"


@pytest.fixture
def test_env():
    """Set up test environment variables."""
    with temp_env_vars(
        CHRONICLE_TEST_MODE="1",
        CHRONICLE_LOG_LEVEL="DEBUG",
        CHRONICLE_MAX_INPUT_SIZE_MB="10.0"
    ):
        yield


@pytest.fixture
def sqlite_db():
    """Provide a temporary SQLite database."""
    with temp_sqlite_db() as db_path:
        yield db_path


@pytest.fixture
def mock_supabase():
    """Provide a mocked Supabase client."""
    with mock_supabase_client() as client:
        yield client


@pytest.fixture
def git_repo():
    """Create a temporary git repository."""
    with tempfile.TemporaryDirectory() as tmpdir:
        repo_info = create_test_git_repo(Path(tmpdir))
        yield repo_info