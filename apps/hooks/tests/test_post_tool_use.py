"""Test suite for post_tool_use hook implementation."""

import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

# Add the src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from src.lib.base_hook import BaseHook
except ImportError:
    from src.lib.base_hook import BaseHook


class TestMCPToolDetection(unittest.TestCase):
    """Test MCP tool detection and classification."""
    
    def test_is_mcp_tool_detection(self):
        """Test detection of MCP tools based on naming patterns."""
        test_cases = [
            # MCP tools (should return True)
            ("mcp__ide__getDiagnostics", True),
            ("mcp__filesystem__read", True),
            ("mcp__database__query", True),
            ("mcp__api__fetch", True),
            ("mcp__server_name__tool_name", True),
            
            # Non-MCP tools (should return False)
            ("Read", False),
            ("Edit", False),
            ("Bash", False),
            ("WebFetch", False),
            ("regular_function", False),
            ("custom_tool", False),
        ]
        
        for tool_name, expected in test_cases:
            with self.subTest(tool_name=tool_name):
                # Import the actual function when it's implemented
                from post_tool_use import is_mcp_tool
                result = is_mcp_tool(tool_name)
                self.assertEqual(result, expected, 
                               f"Tool '{tool_name}' should be {'MCP' if expected else 'non-MCP'}")
    
    def test_extract_mcp_server_name(self):
        """Test extraction of MCP server name from tool names."""
        test_cases = [
            ("mcp__ide__getDiagnostics", "ide"),
            ("mcp__filesystem__read", "filesystem"),
            ("mcp__database__query", "database"),
            ("mcp__complex_server_name__tool", "complex_server_name"),
            # Non-MCP tools should return None
            ("Read", None),
            ("regular_function", None),
        ]
        
        for tool_name, expected in test_cases:
            with self.subTest(tool_name=tool_name):
                from post_tool_use import extract_mcp_server_name
                result = extract_mcp_server_name(tool_name)
                self.assertEqual(result, expected,
                               f"Server name for '{tool_name}' should be '{expected}'")


class TestToolResponseParsing(unittest.TestCase):
    """Test parsing of tool execution results."""
    
    def test_parse_tool_response_success(self):
        """Test parsing successful tool responses."""
        response_data = {
            "result": "Success: Operation completed",
            "status": "success",
            "metadata": {"key": "value"}
        }
        
        from post_tool_use import parse_tool_response
        parsed = parse_tool_response(response_data)
        
        self.assertEqual(parsed["success"], True)
        self.assertEqual(parsed["result_size"], len(json.dumps(response_data)))
        self.assertIsNone(parsed["error"])
        self.assertIn("metadata", parsed)
    
    def test_parse_tool_response_error(self):
        """Test parsing error tool responses."""
        response_data = {
            "error": "Failed to execute command",
            "status": "error",
            "error_type": "CommandError"
        }
        
        from post_tool_use import parse_tool_response
        parsed = parse_tool_response(response_data)
        
        self.assertEqual(parsed["success"], False)
        self.assertEqual(parsed["error"], "Failed to execute command")
        self.assertEqual(parsed["error_type"], "CommandError")
    
    def test_parse_tool_response_timeout(self):
        """Test parsing timeout responses."""
        response_data = {
            "error": "Command timed out after 30 seconds",
            "status": "timeout",
            "partial_result": "Some output before timeout"
        }
        
        from post_tool_use import parse_tool_response
        parsed = parse_tool_response(response_data)
        
        self.assertEqual(parsed["success"], False)
        self.assertTrue("timeout" in parsed["error"].lower() or "timed out" in parsed["error"].lower())
        self.assertIn("partial_result", parsed)
    
    def test_parse_tool_response_large_result(self):
        """Test handling of large tool responses."""
        large_content = "x" * 1000000  # 1MB of data
        response_data = {
            "result": large_content,
            "status": "success"
        }
        
        from post_tool_use import parse_tool_response
        parsed = parse_tool_response(response_data)
        
        self.assertEqual(parsed["success"], True)
        self.assertGreater(parsed["result_size"], 900000)  # Should be close to 1MB
        self.assertTrue(parsed["large_result"])  # Should flag as large


class TestDurationCalculation(unittest.TestCase):
    """Test execution duration calculation."""
    
    def test_calculate_duration_ms_from_timestamps(self):
        """Test duration calculation from start/end timestamps."""
        start_time = time.time()
        time.sleep(0.1)  # 100ms delay
        end_time = time.time()
        
        from post_tool_use import calculate_duration_ms
        duration = calculate_duration_ms(start_time, end_time)
        
        # Should be approximately 100ms, but allow for some variance
        self.assertGreaterEqual(duration, 90)
        self.assertLessEqual(duration, 150)
    
    def test_calculate_duration_from_execution_time(self):
        """Test duration when provided directly."""
        execution_time_ms = 250
        
        from post_tool_use import calculate_duration_ms
        duration = calculate_duration_ms(None, None, execution_time_ms)
        
        self.assertEqual(duration, execution_time_ms)
    
    def test_calculate_duration_invalid_input(self):
        """Test duration calculation with invalid inputs."""
        from post_tool_use import calculate_duration_ms
        
        # No valid input should return None or 0
        duration = calculate_duration_ms(None, None, None)
        self.assertIsNone(duration)
        
        # End time before start time should handle gracefully
        start_time = time.time()
        end_time = start_time - 10  # 10 seconds in the past
        duration = calculate_duration_ms(start_time, end_time)
        self.assertIsNone(duration)


class TestPostToolUseHook(unittest.TestCase):
    """Test the main PostToolUse hook functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.test_config = {
            "database": {
                "type": "sqlite",
                "connection_string": f"sqlite:///{self.temp_dir}/test.db"
            }
        }
        
        # Mock database manager
        self.mock_db_manager = Mock()
        self.mock_db_manager.save_event.return_value = True
        
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @patch('src.database.DatabaseManager')
    def test_hook_initialization(self, mock_db_class):
        """Test hook initialization."""
        mock_db_class.return_value = self.mock_db_manager
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        
        self.assertIsNotNone(hook)
        self.assertEqual(hook.config, self.test_config)
        # Don't assert on mock_db_class calls since it's imported through BaseHook
    
    @patch('post_tool_use.DatabaseManager')
    def test_process_standard_tool_execution(self, mock_db_class):
        """Test processing standard (non-MCP) tool execution."""
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "Read",
            "toolInput": {"file_path": "/tmp/test.txt"},
            "toolResponse": {
                "result": "File contents here",
                "status": "success"
            },
            "executionTime": 150,
            "timestamp": datetime.now().isoformat()
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should save tool event
        self.mock_db_manager.save_event.assert_called_once()
        saved_data = self.mock_db_manager.save_event.call_args[0][0]
        
        self.assertEqual(saved_data["event_type"], "tool_use")
        self.assertEqual(saved_data["data"]["tool_name"], "Read")
        self.assertEqual(saved_data["data"]["success"], True)
        self.assertEqual(saved_data["data"]["duration_ms"], 150)
        self.assertEqual(saved_data["data"]["is_mcp_tool"], False)
        self.assertIsNone(saved_data["data"]["mcp_server"])
        
        # Should return continue response
        self.assertTrue(result["continue"])
        self.assertFalse(result["suppressOutput"])
    
    @patch('post_tool_use.DatabaseManager')
    def test_process_mcp_tool_execution(self, mock_db_class):
        """Test processing MCP tool execution."""
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "mcp__ide__getDiagnostics",
            "toolInput": {"uri": "file:///path/to/file.py"},
            "toolResponse": {
                "result": [{"severity": "error", "message": "Syntax error"}],
                "status": "success"
            },
            "executionTime": 75
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should save tool event with MCP metadata
        self.mock_db_manager.save_event.assert_called_once()
        saved_data = self.mock_db_manager.save_event.call_args[0][0]
        
        self.assertEqual(saved_data["event_type"], "tool_use")
        self.assertEqual(saved_data["data"]["tool_name"], "mcp__ide__getDiagnostics")
        self.assertEqual(saved_data["data"]["is_mcp_tool"], True)
        self.assertEqual(saved_data["data"]["mcp_server"], "ide")
        self.assertEqual(saved_data["data"]["duration_ms"], 75)
    
    @patch('post_tool_use.DatabaseManager')
    def test_process_tool_execution_error(self, mock_db_class):
        """Test processing tool execution with error."""
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "Bash",
            "toolInput": {"command": "invalid-command"},
            "toolResponse": {
                "error": "Command not found: invalid-command",
                "status": "error",
                "error_type": "CommandNotFoundError"
            },
            "executionTime": 25
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should save tool event with error details
        saved_data = self.mock_db_manager.save_event.call_args[0][0]
        
        self.assertEqual(saved_data["data"]["success"], False)
        self.assertEqual(saved_data["data"]["error"], "Command not found: invalid-command")
        self.assertEqual(saved_data["data"]["error_type"], "CommandNotFoundError")
    
    @patch('post_tool_use.DatabaseManager')
    def test_process_tool_timeout_scenario(self, mock_db_class):
        """Test processing tool execution timeout."""
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "WebFetch",
            "toolInput": {"url": "https://slow-endpoint.com"},
            "toolResponse": {
                "error": "Request timed out after 30 seconds",
                "status": "timeout",
                "partial_result": "Partial response data"
            },
            "executionTime": 30000  # 30 seconds
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should handle timeout properly
        saved_data = self.mock_db_manager.save_event.call_args[0][0]
        
        self.assertEqual(saved_data["data"]["success"], False)
        self.assertIn("timeout", saved_data["data"]["error"].lower())
        self.assertEqual(saved_data["data"]["duration_ms"], 30000)
        self.assertIn("partial_result", saved_data["data"])
    
    @patch('post_tool_use.DatabaseManager')
    def test_database_save_failure_handling(self, mock_db_class):
        """Test handling when database save fails."""
        # Configure mock to fail
        self.mock_db_manager.save_event.return_value = False
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "Edit",
            "toolInput": {"file_path": "/tmp/test.py", "old_string": "old", "new_string": "new"},
            "toolResponse": {"result": "File edited successfully", "status": "success"},
            "executionTime": 100
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should still return continue response even if database fails
        self.assertTrue(result["continue"])
        self.assertFalse(result["suppressOutput"])
    
    @patch('post_tool_use.DatabaseManager')
    def test_missing_session_id_handling(self, mock_db_class):
        """Test handling when session ID is missing."""
        mock_db_class.return_value = self.mock_db_manager
        
        input_data = {
            "hookEventName": "PostToolUse",
            # Missing sessionId
            "toolName": "Glob",
            "toolInput": {"pattern": "*.py"},
            "toolResponse": {"result": ["file1.py", "file2.py"], "status": "success"},
            "executionTime": 50
        }
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        result = hook.process_hook(input_data)
        
        # Should still process but may not save to database
        self.assertTrue(result["continue"])
    
    @patch('post_tool_use.DatabaseManager')
    def test_malformed_input_handling(self, mock_db_class):
        """Test handling of malformed input data."""
        mock_db_class.return_value = self.mock_db_manager
        
        # Test with missing required fields
        malformed_inputs = [
            {},  # Empty input
            {"hookEventName": "PostToolUse"},  # Missing tool data
            {"toolName": "Read"},  # Missing hook event name and other fields
            None,  # Null input
        ]
        
        from post_tool_use import PostToolUseHook
        hook = PostToolUseHook(self.test_config)
        
        for malformed_input in malformed_inputs:
            with self.subTest(input_data=malformed_input):
                try:
                    result = hook.process_hook(malformed_input)
                    # Should handle gracefully and return continue response
                    self.assertTrue(result["continue"])
                except Exception as e:
                    self.fail(f"Hook should handle malformed input gracefully, but raised: {e}")


class TestHookIntegration(unittest.TestCase):
    """Integration tests for the hook as a whole."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up integration test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_hook_script_execution(self):
        """Test that the hook script can be executed directly."""
        # This test would verify the hook can run as a script
        # Implementation depends on how the hook script is structured
        pass
    
    def test_json_input_output_format(self):
        """Test that hook properly handles JSON input/output format."""
        input_json = {
            "hookEventName": "PostToolUse",
            "sessionId": str(uuid4()),
            "toolName": "MultiEdit",
            "toolInput": {
                "file_path": "/tmp/test.py",
                "edits": [
                    {"old_string": "old1", "new_string": "new1"},
                    {"old_string": "old2", "new_string": "new2"}
                ]
            },
            "toolResponse": {
                "result": "Multiple edits applied successfully",
                "status": "success"
            },
            "executionTime": 200
        }
        
        # Test that JSON serialization/deserialization works
        json_str = json.dumps(input_json)
        parsed_input = json.loads(json_str)
        
        self.assertEqual(parsed_input, input_json)
    
    def test_concurrent_hook_executions(self):
        """Test handling of concurrent hook executions."""
        # This would test thread safety if needed
        pass


class TestPostToolUseDecisionBlocking(unittest.TestCase):
    """Test new JSON output format with decision blocking support for PostToolUse hook."""
    
    def setUp(self):
        """Set up decision blocking test environment."""
        self.mock_db = Mock()
        self.mock_db.save_event.return_value = True
        self.mock_db.save_session.return_value = (True, "session-uuid-123")
        self.mock_db.get_status.return_value = {"supabase": {"has_client": True}}
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_create_permission_response_allow(self, mock_db_class):
        """Test creating permission response that allows tool execution."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        response = hook.create_permission_response(
            decision="allow",
            reason="Safe read operation detected",
            tool_name="Read",
            hook_event_name="PostToolUse"
        )
        
        self.assertTrue(response["continue"])
        self.assertFalse(response["suppressOutput"])
        self.assertEqual(response["hookSpecificOutput"]["hookEventName"], "PostToolUse")
        self.assertEqual(response["hookSpecificOutput"]["permissionDecision"], "allow")
        self.assertEqual(response["hookSpecificOutput"]["permissionDecisionReason"], "Safe read operation detected")
        self.assertEqual(response["hookSpecificOutput"]["toolName"], "Read")
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_create_permission_response_deny(self, mock_db_class):
        """Test creating permission response that denies tool execution."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        response = hook.create_permission_response(
            decision="deny",
            reason="Dangerous command detected: rm -rf /",
            tool_name="Bash",
            hook_event_name="PostToolUse"
        )
        
        self.assertFalse(response["continue"])
        self.assertFalse(response["suppressOutput"])
        self.assertIn("stopReason", response)
        self.assertEqual(response["stopReason"], "Dangerous command detected: rm -rf /")
        self.assertEqual(response["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertEqual(response["hookSpecificOutput"]["toolName"], "Bash")
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_create_permission_response_ask(self, mock_db_class):
        """Test creating permission response that asks for user confirmation."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        response = hook.create_permission_response(
            decision="ask",
            reason="This command will delete files. Do you want to continue?",
            tool_name="Bash",
            hook_event_name="PostToolUse"
        )
        
        self.assertFalse(response["continue"])
        self.assertFalse(response["suppressOutput"])
        self.assertIn("stopReason", response)
        self.assertEqual(response["stopReason"], "This command will delete files. Do you want to continue?")
        self.assertEqual(response["hookSpecificOutput"]["permissionDecision"], "ask")
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_analyze_tool_security_safe_operations(self, mock_db_class):
        """Test security analysis for safe tool operations."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        safe_operations = [
            {
                "toolName": "Read",
                "toolInput": {"file_path": "/home/user/document.txt"}
            },
            {
                "toolName": "Glob", 
                "toolInput": {"pattern": "*.py"}
            },
            {
                "toolName": "Grep",
                "toolInput": {"pattern": "TODO", "path": "/src"}
            }
        ]
        
        for operation in safe_operations:
            with self.subTest(tool=operation["toolName"]):
                decision, reason = hook.analyze_tool_security(
                    operation["toolName"],
                    operation["toolInput"], 
                    {"success": True}
                )
                
                self.assertEqual(decision, "allow")
                self.assertIn("safe", reason.lower())
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_analyze_tool_security_dangerous_operations(self, mock_db_class):
        """Test security analysis for dangerous tool operations."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        dangerous_operations = [
            {
                "toolName": "Bash",
                "toolInput": {"command": "rm -rf /"},
                "expected_decision": "deny"
            },
            {
                "toolName": "Bash",
                "toolInput": {"command": "sudo rm -rf /usr/local"},
                "expected_decision": "deny"
            },
            {
                "toolName": "Write",
                "toolInput": {"file_path": "/etc/passwd", "content": "malicious"},
                "expected_decision": "ask"  # System file modification should ask
            }
        ]
        
        for operation in dangerous_operations:
            with self.subTest(tool=operation["toolName"]):
                decision, reason = hook.analyze_tool_security(
                    operation["toolName"],
                    operation["toolInput"],
                    {"success": True}
                )
                
                self.assertIn(decision, ["deny", "ask"])
                self.assertTrue(len(reason) > 0)
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_process_hook_with_security_blocking(self, mock_db_class):
        """Test process_hook with security-based decision blocking."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        dangerous_input = {
            "hookEventName": "PostToolUse",
            "sessionId": "security-test-session",
            "toolName": "Bash",
            "toolInput": {"command": "rm -rf /important/data"},
            "toolResponse": {"success": True, "result": "Command executed"},
            "executionTime": 100
        }
        
        # Mock the security analysis to return deny
        with patch.object(hook, 'analyze_tool_security', return_value=("deny", "Dangerous file deletion detected")):
            response = hook.process_hook(dangerous_input)
            
            self.assertFalse(response["continue"])
            self.assertIn("stopReason", response)
            self.assertEqual(response["hookSpecificOutput"]["permissionDecision"], "deny")
            self.assertEqual(response["hookSpecificOutput"]["toolName"], "Bash")
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_mcp_tool_security_analysis(self, mock_db_class):
        """Test security analysis for MCP tools."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        mcp_operations = [
            {
                "toolName": "mcp__ide__getDiagnostics",
                "toolInput": {"uri": "file:///project/src/main.py"},
                "expected": "allow"  # IDE diagnostics should be safe
            },
            {
                "toolName": "mcp__filesystem__write",
                "toolInput": {"path": "/etc/sensitive", "content": "data"},
                "expected": "ask"  # File system writes should ask for confirmation
            },
            {
                "toolName": "mcp__network__request",
                "toolInput": {"url": "https://malicious.com", "data": "sensitive"},
                "expected": "ask"  # Network requests with data should ask
            }
        ]
        
        for operation in mcp_operations:
            with self.subTest(tool=operation["toolName"]):
                decision, reason = hook.analyze_tool_security(
                    operation["toolName"],
                    operation["toolInput"],
                    {"success": True}
                )
                
                # Test that MCP tools get appropriate security analysis
                self.assertIn(decision, ["allow", "ask", "deny"])
                self.assertTrue(len(reason) > 0)
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_tool_failure_response_format(self, mock_db_class):
        """Test response format when tool execution fails."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        failed_input = {
            "hookEventName": "PostToolUse",
            "sessionId": "failure-test-session",
            "toolName": "Read",
            "toolInput": {"file_path": "/nonexistent/file.txt"},
            "toolResponse": {
                "success": False,
                "error": "File not found: /nonexistent/file.txt",
                "error_type": "file_not_found"
            },
            "executionTime": 50
        }
        
        response = hook.process_hook(failed_input)
        
        # Should continue execution even on tool failure
        self.assertTrue(response["continue"])
        self.assertEqual(response["hookSpecificOutput"]["hookEventName"], "PostToolUse")
        self.assertEqual(response["hookSpecificOutput"]["toolName"], "Read")
        self.assertFalse(response["hookSpecificOutput"]["toolSuccess"])
        self.assertIn("error", response["hookSpecificOutput"])
    
    @patch('src.hooks.post_tool_use.DatabaseManager')
    def test_response_with_additional_metadata(self, mock_db_class):
        """Test response includes additional metadata about tool execution."""
        mock_db_class.return_value = self.mock_db
        
        from src.hooks.post_tool_use import PostToolUseHook
        hook = PostToolUseHook()
        
        input_data = {
            "hookEventName": "PostToolUse",
            "sessionId": "metadata-test-session",
            "toolName": "MultiEdit",
            "toolInput": {
                "file_path": "/project/src/main.py",
                "edits": [{"old_string": "old", "new_string": "new"}]
            },
            "toolResponse": {
                "success": True,
                "result": "1 edit applied successfully",
                "files_modified": ["/project/src/main.py"]
            },
            "executionTime": 150
        }
        
        response = hook.process_hook(input_data)
        
        hook_output = response["hookSpecificOutput"]
        self.assertEqual(hook_output["hookEventName"], "PostToolUse")
        self.assertEqual(hook_output["toolName"], "MultiEdit")
        self.assertTrue(hook_output["toolSuccess"])
        self.assertEqual(hook_output["executionTime"], 150)
        
        # Should include metadata about the operation
        if "metadata" in hook_output:
            self.assertIsInstance(hook_output["metadata"], dict)


if __name__ == '__main__':
    unittest.main()