#!/usr/bin/env python3
"""
Tests for session_start.py hook.

Tests session initialization, project context extraction, and git info capture.
"""

import json
import os
import pytest
import tempfile
from pathlib import Path

from test_utils import (
    HookTestCase, assert_performance, assert_valid_hook_response,
    create_test_git_repo, temp_env_vars, temp_sqlite_db,
    mock_supabase_client
)


class TestSessionStartHook:
    """Test cases for SessionStart hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("SessionStart", "session_start.py")
    
    def test_basic_session_start(self, test_env):
        """Test basic session start functionality."""
        # Create test input
        input_data = self.hook.create_test_input(source="startup")
        
        # Run hook
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Assertions
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        # Parse response
        response = self.hook.parse_hook_output(stdout)
        assert response is not None
        assert_valid_hook_response(response)
        
        # Check hook-specific output
        assert "hookSpecificOutput" in response
        hook_output = response["hookSpecificOutput"]
        assert hook_output["hookEventName"] == "SessionStart"
        assert hook_output["sessionInitialized"] is True
        assert "sessionUuid" in hook_output
        assert "claudeSessionId" in hook_output
    
    def test_session_start_with_git_repo(self, test_env, git_repo):
        """Test session start in a git repository."""
        # Create input with git repo as cwd
        input_data = self.hook.create_test_input(
            source="startup",
            cwd=git_repo["path"]
        )
        
        # Set CLAUDE_PROJECT_DIR to test project context resolution
        with temp_env_vars(CLAUDE_PROJECT_DIR=git_repo["path"]):
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Assertions
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        # Parse response
        response = self.hook.parse_hook_output(stdout)
        hook_output = response["hookSpecificOutput"]
        
        # Check git info
        assert hook_output["gitBranch"] == git_repo["branch"]
        assert hook_output["gitCommit"] == git_repo["commit"]
        assert hook_output["projectPath"] == git_repo["path"]
    
    def test_session_resume(self, test_env):
        """Test session resume functionality."""
        input_data = self.hook.create_test_input(source="resume")
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert response["hookSpecificOutput"]["triggerSource"] == "resume"
        
        # Check for resume context
        if "additionalContext" in response["hookSpecificOutput"]:
            assert "Resuming previous session" in response["hookSpecificOutput"]["additionalContext"]
    
    def test_session_clear(self, test_env):
        """Test session clear functionality."""
        input_data = self.hook.create_test_input(source="clear")
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert response["hookSpecificOutput"]["triggerSource"] == "clear"
        
        # Check for clear context
        if "additionalContext" in response["hookSpecificOutput"]:
            assert "context cleared" in response["hookSpecificOutput"]["additionalContext"]
    
    def test_invalid_json_input(self, test_env):
        """Test handling of invalid JSON input."""
        # Run with invalid JSON
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(
            {"invalid": "json"}, 
            env_vars={"INVALID_JSON": "true"}  # Force invalid JSON
        )
        
        # Should still return success with minimal response
        assert exit_code == 0
        response = self.hook.parse_hook_output(stdout)
        assert response is not None
        assert response["continue"] is True
    
    def test_missing_session_id(self, test_env):
        """Test handling when session ID is missing."""
        input_data = self.hook.create_test_input()
        del input_data["sessionId"]
        
        with temp_env_vars(CLAUDE_SESSION_ID=None):
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should handle gracefully
        assert exit_code == 0
        assert_performance(exec_time)
    
    @pytest.mark.integration
    def test_database_write_sqlite(self, test_env, sqlite_db):
        """Test writing session data to SQLite database."""
        input_data = self.hook.create_test_input(source="startup")
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        # Verify database file was created
        assert sqlite_db.exists()
        
        # Check session was saved
        import sqlite3
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM sessions")
            count = cursor.fetchone()[0]
            assert count > 0
    
    @pytest.mark.integration
    def test_database_write_supabase(self, test_env, mock_supabase):
        """Test writing session data to Supabase."""
        with temp_env_vars(
            SUPABASE_URL="https://test.supabase.co",
            SUPABASE_ANON_KEY="test-key"
        ):
            input_data = self.hook.create_test_input(source="startup")
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        # Verify Supabase was called
        mock_supabase.table.assert_called()
    
    @pytest.mark.performance
    def test_performance_under_load(self, test_env):
        """Test performance with multiple rapid executions."""
        execution_times = []
        
        for i in range(20):
            input_data = self.hook.create_test_input(
                source="startup",
                sessionId=f"perf-test-{i}"
            )
            
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            
            assert exit_code == 0
            execution_times.append(exec_time)
        
        # Check all executions were under limit
        for exec_time in execution_times:
            assert_performance(exec_time)
        
        # Check average
        avg_time = sum(execution_times) / len(execution_times)
        assert avg_time < 100, f"Average execution time {avg_time:.2f}ms exceeds limit"
    
    @pytest.mark.security
    def test_path_traversal_prevention(self, test_env):
        """Test that path traversal attempts are handled safely."""
        malicious_inputs = [
            {"cwd": "/tmp/../../../etc"},
            {"cwd": "/Users/../../root"},
            {"transcriptPath": "../../../etc/passwd"}
        ]
        
        for malicious_data in malicious_inputs:
            input_data = self.hook.create_test_input(source="startup")
            input_data.update(malicious_data)
            
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            
            # Should still succeed but sanitize paths
            assert exit_code == 0
            response = self.hook.parse_hook_output(stdout)
            
            # Check paths don't contain traversal
            if "projectPath" in response["hookSpecificOutput"]:
                assert ".." not in response["hookSpecificOutput"]["projectPath"]
    
    @pytest.mark.security  
    def test_sensitive_data_sanitization(self, test_env):
        """Test that sensitive data is sanitized from output."""
        sensitive_input = self.hook.create_test_input(
            source="startup",
            cwd="/Users/testuser/secret-project",
            extraData={
                "api_key": "sk-ant-api03-secret-key",
                "password": "my-password",
                "token": "secret-token"
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(sensitive_input)
        
        assert exit_code == 0
        
        # Check output doesn't contain sensitive data
        output_str = stdout + stderr
        assert "sk-ant-api03-secret-key" not in output_str
        assert "my-password" not in output_str
        assert "secret-token" not in output_str
        
        # User paths should be sanitized
        response = self.hook.parse_hook_output(stdout)
        if "projectPath" in response["hookSpecificOutput"]:
            project_path = response["hookSpecificOutput"]["projectPath"]
            # Should either be redacted or not contain username
            assert "/Users/testuser" not in project_path or "[REDACTED]" in project_path
    
    def test_project_type_detection(self, test_env):
        """Test project type detection for various project structures."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir)
            
            # Test Python project
            (project_dir / "requirements.txt").touch()
            input_data = self.hook.create_test_input(source="startup", cwd=str(project_dir))
            
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            assert exit_code == 0
            
            response = self.hook.parse_hook_output(stdout)
            if "additionalContext" in response["hookSpecificOutput"]:
                assert "Python project" in response["hookSpecificOutput"]["additionalContext"]
            
            # Test Node.js project
            (project_dir / "package.json").write_text('{"name": "test"}')
            exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
            assert exit_code == 0
    
    def test_error_handling(self, test_env):
        """Test graceful error handling."""
        # Test with non-existent directory
        input_data = self.hook.create_test_input(
            source="startup",
            cwd="/this/path/does/not/exist"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should still succeed
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert response["continue"] is True