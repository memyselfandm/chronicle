#!/usr/bin/env python3
"""
Tests for post_tool_use.py hook.

Tests tool execution tracking, result validation, and error detection.
"""

import json
import pytest
from pathlib import Path

from test_utils import (
    HookTestCase, assert_performance, assert_valid_hook_response,
    temp_env_vars, temp_sqlite_db
)


class TestPostToolUseHook:
    """Test cases for PostToolUse hook."""
    
    def setup_method(self):
        """Set up test case."""
        self.hook = HookTestCase("PostToolUse", "post_tool_use.py")
    
    def test_successful_tool_execution(self, test_env):
        """Test handling of successful tool execution."""
        input_data = self.hook.create_test_input(
            toolName="Write",
            toolInput={
                "file_path": "/tmp/test.txt",
                "content": "Test content"
            },
            toolResponse={
                "filePath": "/tmp/test.txt",
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0, f"Hook failed: {stderr}"
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        assert_valid_hook_response(response)
        assert response["continue"] is True
    
    def test_failed_tool_execution(self, test_env):
        """Test handling of failed tool execution."""
        input_data = self.hook.create_test_input(
            toolName="Write",
            toolInput={
                "file_path": "/invalid/path/test.txt",
                "content": "Test content"
            },
            toolResponse={
                "error": "Permission denied",
                "success": False
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        
        # Hook might decide to block or provide feedback
        if "decision" in response:
            assert response["decision"] in ["block", None]
            if response["decision"] == "block":
                assert "reason" in response
    
    def test_bash_command_results(self, test_env):
        """Test tracking of bash command results."""
        input_data = self.hook.create_test_input(
            toolName="Bash",
            toolInput={
                "command": "ls -la /tmp"
            },
            toolResponse={
                "output": "total 24\ndrwxrwxrwt  5 root root 4096 Jan 1 00:00 .",
                "exitCode": 0,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Test with failed command
        failed_input = self.hook.create_test_input(
            toolName="Bash",
            toolInput={
                "command": "cat /nonexistent/file"
            },
            toolResponse={
                "output": "",
                "error": "cat: /nonexistent/file: No such file or directory",
                "exitCode": 1,
                "success": False
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(failed_input)
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_file_operation_tracking(self, test_env):
        """Test tracking of various file operations."""
        # Test Read operation
        read_input = self.hook.create_test_input(
            toolName="Read",
            toolInput={
                "file_path": "/tmp/test.py"
            },
            toolResponse={
                "content": "print('Hello, World!')",
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(read_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Test Edit operation
        edit_input = self.hook.create_test_input(
            toolName="Edit",
            toolInput={
                "file_path": "/tmp/test.py",
                "old_string": "Hello",
                "new_string": "Hi"
            },
            toolResponse={
                "filePath": "/tmp/test.py",
                "changes": 1,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(edit_input)
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_web_operation_results(self, test_env):
        """Test tracking of web operation results."""
        # WebFetch result
        fetch_input = self.hook.create_test_input(
            toolName="WebFetch",
            toolInput={
                "url": "https://example.com",
                "prompt": "Extract title"
            },
            toolResponse={
                "content": "Example Domain",
                "success": True,
                "metadata": {
                    "statusCode": 200,
                    "contentType": "text/html"
                }
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(fetch_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # WebSearch result
        search_input = self.hook.create_test_input(
            toolName="WebSearch",
            toolInput={
                "query": "Python tutorials"
            },
            toolResponse={
                "results": [
                    {"title": "Python Tutorial", "url": "https://python.org/tutorial"},
                    {"title": "Learn Python", "url": "https://learnpython.org"}
                ],
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(search_input)
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_decision_output_format(self, test_env):
        """Test decision output format for blocking operations."""
        # Simulate a potentially problematic result
        input_data = self.hook.create_test_input(
            toolName="Write",
            toolInput={
                "file_path": "/etc/sensitive.conf",
                "content": "modified content"
            },
            toolResponse={
                "filePath": "/etc/sensitive.conf",
                "success": True,
                "warning": "Modified system configuration file"
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        response = self.hook.parse_hook_output(stdout)
        
        # Check if hook implements decision logic
        if "decision" in response:
            assert response["decision"] in ["block", None]
            if response["decision"] == "block":
                assert "reason" in response
                assert isinstance(response["reason"], str)
                assert len(response["reason"]) > 0
    
    @pytest.mark.integration
    def test_event_logging_with_results(self, test_env, sqlite_db):
        """Test that tool results are logged to database."""
        input_data = self.hook.create_test_input(
            toolName="Bash",
            toolInput={
                "command": "echo 'Database test'"
            },
            toolResponse={
                "output": "Database test",
                "exitCode": 0,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Verify event was logged
        import sqlite3
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute(
                "SELECT data FROM events WHERE event_type = 'post_tool_use' ORDER BY created_at DESC LIMIT 1"
            )
            row = cursor.fetchone()
            assert row is not None
            
            # Parse stored data
            event_data = json.loads(row[0])
            assert "tool_response" in event_data
            assert event_data["tool_response"]["success"] is True
    
    @pytest.mark.performance
    def test_performance_with_large_output(self, test_env):
        """Test performance with large tool outputs."""
        # Simulate large command output
        large_output = "\n".join([f"Line {i}: " + "x" * 100 for i in range(1000)])
        
        input_data = self.hook.create_test_input(
            toolName="Bash",
            toolInput={
                "command": "find / -name '*.txt'"
            },
            toolResponse={
                "output": large_output,
                "exitCode": 0,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        # Allow more time for large output processing
        assert_performance(exec_time, max_time_ms=150)
    
    def test_task_subagent_results(self, test_env):
        """Test handling of Task (subagent) results."""
        input_data = self.hook.create_test_input(
            toolName="Task",
            toolInput={
                "task": "Analyze code for security issues"
            },
            toolResponse={
                "result": "Found 3 potential security issues:\n1. SQL injection risk\n2. Hardcoded credentials\n3. Insecure random number generation",
                "success": True,
                "metadata": {
                    "duration": "5.2s",
                    "toolsUsed": ["Read", "Grep", "Bash"]
                }
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        assert_performance(exec_time)
        
        response = self.hook.parse_hook_output(stdout)
        # Subagent results might trigger special handling
        assert response["continue"] is True
    
    def test_missing_tool_response(self, test_env):
        """Test handling when tool response is missing."""
        input_data = self.hook.create_test_input(
            toolName="Write",
            toolInput={
                "file_path": "/tmp/test.txt",
                "content": "Test"
            }
            # No toolResponse provided
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should handle gracefully
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_malformed_tool_response(self, test_env):
        """Test handling of malformed tool responses."""
        input_data = self.hook.create_test_input(
            toolName="Read",
            toolInput={
                "file_path": "/tmp/test.txt"
            },
            toolResponse="This should be a dict, not a string"
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        # Should handle gracefully
        assert exit_code == 0
        assert_performance(exec_time)
    
    @pytest.mark.security
    def test_sensitive_output_sanitization(self, test_env):
        """Test that sensitive data in tool output is sanitized."""
        input_data = self.hook.create_test_input(
            toolName="Read",
            toolInput={
                "file_path": "/tmp/.env"
            },
            toolResponse={
                "content": "API_KEY=sk-ant-api03-secret-key-123\nDATABASE_PASSWORD=mysecretpass\nSECRET_TOKEN=abc123",
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(input_data)
        
        assert exit_code == 0
        
        # Check that sensitive data is not exposed in output
        output_str = stdout + stderr
        assert "sk-ant-api03-secret-key-123" not in output_str
        assert "mysecretpass" not in output_str
        
        # If the hook stores data, it should be sanitized
        response = self.hook.parse_hook_output(stdout)
        response_str = json.dumps(response)
        assert "sk-ant-api03-secret-key-123" not in response_str
    
    def test_glob_and_grep_results(self, test_env):
        """Test handling of Glob and Grep tool results."""
        # Glob results
        glob_input = self.hook.create_test_input(
            toolName="Glob",
            toolInput={
                "pattern": "**/*.py",
                "path": "/tmp"
            },
            toolResponse={
                "files": [
                    "/tmp/test1.py",
                    "/tmp/src/test2.py",
                    "/tmp/tests/test3.py"
                ],
                "count": 3,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(glob_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Grep results
        grep_input = self.hook.create_test_input(
            toolName="Grep",
            toolInput={
                "pattern": "TODO",
                "path": "/tmp"
            },
            toolResponse={
                "matches": [
                    {"file": "/tmp/main.py", "line": 42, "content": "# TODO: Fix this"},
                    {"file": "/tmp/test.py", "line": 10, "content": "// TODO: Add tests"}
                ],
                "filesMatched": 2,
                "totalMatches": 2,
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = self.hook.run_hook(grep_input)
        assert exit_code == 0
        assert_performance(exec_time)