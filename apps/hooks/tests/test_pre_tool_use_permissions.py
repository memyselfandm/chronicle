#!/usr/bin/env python3
"""
Test suite for PreToolUse Hook observability feature.

Tests that the hook properly logs events and sanitizes sensitive data
without interfering with Claude's native permission system.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
from typing import Dict, Any

# Add the src directory to the path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))

from pre_tool_use import PreToolUseHook, check_sensitive_parameters


class TestPreToolUseObservability(unittest.TestCase):
    """Test cases for PreToolUse observability without permission interference."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.hook = PreToolUseHook()
        
    def tearDown(self):
        """Clean up after tests."""
        pass
    
    # Tests for Non-Interference with Tool Execution
    
    def test_allows_all_tool_execution(self):
        """Test that all tools are allowed to execute without interference."""
        test_cases = [
            {"tool_name": "Read", "tool_input": {"file_path": "/path/to/README.md"}},
            {"tool_name": "Write", "tool_input": {"file_path": "/path/to/file.txt", "content": "test"}}, 
            {"tool_name": "Edit", "tool_input": {"file_path": "/path/to/file.py", "old_string": "old", "new_string": "new"}},
            {"tool_name": "Bash", "tool_input": {"command": "ls -la"}},
            {"tool_name": "Glob", "tool_input": {"pattern": "*.md"}},
            {"tool_name": "mcp__linear__list_issues", "tool_input": {"team": "test"}},
            {"tool_name": "UnknownTool", "tool_input": {"param": "value"}},
        ]
        
        for case in test_cases:
            with self.subTest(tool_name=case["tool_name"]):
                hook_input = {
                    "tool_name": case["tool_name"],
                    "tool_input": case["tool_input"],
                    "session_id": "test-session-123",
                    "hook_event_name": "PreToolUse"
                }
                
                response = self.hook.process_hook(hook_input)
                
                # Should always continue execution
                self.assertTrue(response["continue"])
                # Should suppress output to not interfere with UI
                self.assertTrue(response["suppressOutput"])
    
    def test_mcp_tools_allowed(self):
        """Test that MCP tools are allowed without interference."""
        mcp_tools = [
            "mcp__memory__create_entities",
            "mcp__filesystem__read_file", 
            "mcp__github__search_repositories",
            "mcp__linear__list_issues"
        ]
        
        for tool_name in mcp_tools:
            with self.subTest(tool_name=tool_name):
                hook_input = {
                    "tool_name": tool_name,
                    "tool_input": {"query": "test"},
                    "session_id": "test-session-123",
                    "hook_event_name": "PreToolUse"
                }
                
                response = self.hook.process_hook(hook_input)
                
                # MCP tools should execute without interference
                self.assertTrue(response["continue"])
                self.assertTrue(response["suppressOutput"])
    
    def test_sensitive_file_operations_still_allowed(self):
        """Test that even sensitive file operations are allowed (Chronicle is observational only)."""
        sensitive_operations = [
            {"tool_name": "Read", "tool_input": {"file_path": ".env"}},
            {"tool_name": "Edit", "tool_input": {"file_path": "package.json", "old_string": "old", "new_string": "new"}},
            {"tool_name": "Bash", "tool_input": {"command": "sudo apt-get update"}},
            {"tool_name": "Write", "tool_input": {"file_path": "/etc/hosts", "content": "test"}}
        ]
        
        for operation in sensitive_operations:
            with self.subTest(tool_name=operation["tool_name"], tool_input=operation["tool_input"]):
                hook_input = {
                    "tool_name": operation["tool_name"],
                    "tool_input": operation["tool_input"],
                    "session_id": "test-session-123",
                    "hook_event_name": "PreToolUse"
                }
                
                response = self.hook.process_hook(hook_input)
                
                # Should allow even sensitive operations (Claude handles permissions)
                self.assertTrue(response["continue"])
                self.assertTrue(response["suppressOutput"])
    
    # Tests for Sensitive Data Sanitization
    
    def test_sanitizes_sensitive_data_in_logs(self):
        """Test that sensitive data is sanitized before logging."""
        hook_input = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "curl -H 'Authorization: Bearer sk-1234567890abcdef' https://api.example.com",
                "password": "super_secret_password",
                "api_key": "sk-proj-abcdef123456",
                "token": "ghp_1234567890abcdef"
            },
            "session_id": "test-session-123",
            "hook_event_name": "PreToolUse"
        }
        
        # Intercept the event data that would be saved
        with patch.object(self.hook, 'save_event', return_value=True) as mock_save:
            response = self.hook.process_hook(hook_input)
            
            # Get the event data that was passed to save_event
            if mock_save.called:
                event_data = mock_save.call_args[0][0]
                tool_input_logged = event_data['data']['tool_input']
                
                # Check that sensitive values are redacted
                self.assertEqual(tool_input_logged.get('password'), '[REDACTED]')
                self.assertEqual(tool_input_logged.get('api_key'), '[REDACTED]')
                self.assertEqual(tool_input_logged.get('token'), '[REDACTED]')
    
    def test_detects_sensitive_parameters(self):
        """Test that sensitive parameters are detected for logging."""
        test_cases = [
            ({"password": "secret123"}, ["password"]),
            ({"api_token": "token456"}, ["token"]),
            ({"secret_key": "key789"}, ["secret"]),
            ({"auth_header": "Bearer token"}, ["auth"]),
            ({"url": "https://api.example.com?token=abc123"}, ["url_with_credentials"]),
            ({"normal_param": "value"}, [])
        ]
        
        for tool_input, expected_sensitive in test_cases:
            with self.subTest(tool_input=tool_input):
                sensitive_types = check_sensitive_parameters(tool_input)
                
                for expected_type in expected_sensitive:
                    self.assertIn(expected_type, sensitive_types)
    
    
    
    
    
    # Tests for Hook Response Format
    
    def test_hook_response_format_compliance(self):
        """Test that hook responses follow the required format."""
        hook_input = {
            "tool_name": "Read",
            "tool_input": {"file_path": "README.md"},
            "session_id": "test-session-123",
            "hook_event_name": "PreToolUse"
        }
        
        response = self.hook.process_hook(hook_input)
        
        # Check response structure
        self.assertIn("continue", response)
        self.assertIn("suppressOutput", response)
        self.assertIn("hookSpecificOutput", response)
        
        # Should always continue
        self.assertTrue(response["continue"])
        # Should suppress output to not interfere
        self.assertTrue(response["suppressOutput"])
        
        hook_output = response["hookSpecificOutput"]
        self.assertEqual(hook_output["hookEventName"], "PreToolUse")
    
    def test_hook_always_continues_execution(self):
        """Test that hook always continues execution regardless of tool type."""
        test_inputs = [
            {"tool_name": "Read", "tool_input": {"file_path": "README.md"}},
            {"tool_name": "Edit", "tool_input": {"file_path": "package.json", "old_string": "old", "new_string": "new"}},
            {"tool_name": "Read", "tool_input": {"file_path": ".env"}},
            {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}},
            {"tool_name": "mcp__unknown__tool", "tool_input": {}}
        ]
        
        for hook_input_data in test_inputs:
            with self.subTest(tool_name=hook_input_data["tool_name"]):
                hook_input = {
                    "tool_name": hook_input_data["tool_name"],
                    "tool_input": hook_input_data["tool_input"],
                    "session_id": "test-session-123", 
                    "hook_event_name": "PreToolUse"
                }
                
                response = self.hook.process_hook(hook_input)
                
                # Hook should always continue
                self.assertTrue(response["continue"])
                # Should suppress output to not interfere
                self.assertTrue(response["suppressOutput"])
    
    
    # Tests for Error Handling
    
    def test_handles_malformed_input_gracefully(self):
        """Test that hook handles malformed input gracefully."""
        malformed_inputs = [
            {},  # Empty input
            {"tool_input": {"file_path": "test.txt"}},  # Missing tool_name
            {"tool_name": "Read", "tool_input": None},  # Null tool_input
            {"tool_name": "", "tool_input": {"file_path": "test.txt"}},  # Empty tool_name
        ]
        
        for malformed_input in malformed_inputs:
            with self.subTest(input_data=malformed_input):
                response = self.hook.process_hook(malformed_input)
                
                # Should still allow execution even with malformed input
                self.assertTrue(response["continue"])
                self.assertTrue(response["suppressOutput"])
                self.assertIn("hookSpecificOutput", response)
    
    # Integration Tests
    
    def test_full_hook_execution_with_event_logging(self):
        """Test complete hook execution including event logging."""
        with patch.object(self.hook, 'save_event', return_value=True) as mock_save:
            hook_input = {
                "tool_name": "Read",
                "tool_input": {"file_path": "README.md"},
                "session_id": "test-session-123",
                "hook_event_name": "PreToolUse",
                "cwd": "/test/project"
            }
            
            response = self.hook.process_hook(hook_input)
            
            # Verify event was saved
            mock_save.assert_called_once()
            
            # Verify response allows execution
            self.assertTrue(response["continue"])
            self.assertTrue(response["suppressOutput"])
            
            # Verify event saved status is in output
            hook_output = response["hookSpecificOutput"]
            self.assertTrue(hook_output.get("eventSaved", False))


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)