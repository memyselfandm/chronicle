"""
Test suite for event name casing consistency.

Ensures all event names follow the Claude Code documentation standard:
- Hook event names should be PascalCase (e.g., "SessionStart", "PreToolUse")
- Internal event types should match the documented format
- Database event types should be consistent
"""

import os
import sys
import unittest
from unittest.mock import patch, Mock

# Add the core directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'core'))

from src.lib.base_hook import BaseHook


class TestEventNameCasing(unittest.TestCase):
    """Test cases for event name casing consistency."""
    
    def setUp(self):
        """Set up test environment."""
        self.expected_hook_event_names = {
            "SessionStart": "SessionStart",
            "PreToolUse": "PreToolUse", 
            "PostToolUse": "PostToolUse",
            "UserPromptSubmit": "UserPromptSubmit",
            "PreCompact": "PreCompact",
            "Notification": "Notification",
            "Stop": "Stop",
            "SubagentStop": "SubagentStop"
        }
        
        # Expected internal event types (these may be different from hook event names)
        self.expected_event_types = {
            "session_start": "SessionStart",
            "tool_use": "ToolUse", 
            "prompt": "UserPromptSubmit",
            "session_end": "Stop",
            "notification": "Notification"
        }
    
    def test_session_start_hook_event_name_casing(self):
        """Test that SessionStart hook uses correct PascalCase event name."""
        # Import and test session_start hook
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))
        
        try:
            from session_start import SessionStartHook
            
            hook = SessionStartHook()
            
            # Test input data with correct PascalCase
            input_data = {
                "hookEventName": "SessionStart",
                "sessionId": "test-session-123",
                "cwd": "/test/path"
            }
            
            # Process the input
            processed_data = hook.process_hook_data(input_data)
            
            # Verify the hook event name is in PascalCase
            self.assertEqual(processed_data["hook_event_name"], "SessionStart")
            
        except ImportError:
            self.fail("Could not import session_start hook")
    
    def test_pre_tool_use_hook_event_name_casing(self):
        """Test that PreToolUse hook uses correct PascalCase event name."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))
        
        try:
            from pre_tool_use import PreToolUseHook
            
            hook = PreToolUseHook()
            
            # Test input data with correct PascalCase
            input_data = {
                "hookEventName": "PreToolUse", 
                "sessionId": "test-session-123",
                "toolName": "TestTool",
                "toolInput": {"param": "value"}
            }
            
            # Process the input
            processed_data = hook.process_hook_data(input_data)
            
            # Verify the hook event name is in PascalCase
            self.assertEqual(processed_data["hook_event_name"], "PreToolUse")
            
        except ImportError:
            self.fail("Could not import pre_tool_use hook")
    
    def test_post_tool_use_hook_event_name_casing(self):
        """Test that PostToolUse hook uses correct PascalCase event name."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))
        
        try:
            from post_tool_use import PostToolUseHook
            
            hook = PostToolUseHook()
            
            # Test input data with correct PascalCase
            input_data = {
                "hookEventName": "PostToolUse",
                "sessionId": "test-session-123", 
                "toolName": "TestTool",
                "toolOutput": {"result": "success"}
            }
            
            # Process the input
            processed_data = hook.process_hook_data(input_data)
            
            # Verify the hook event name is in PascalCase
            self.assertEqual(processed_data["hook_event_name"], "PostToolUse")
            
        except ImportError:
            self.fail("Could not import post_tool_use hook")
    
    def test_user_prompt_submit_hook_event_name_casing(self):
        """Test that UserPromptSubmit hook uses correct PascalCase event name."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))
        
        try:
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Test input data with correct PascalCase
            input_data = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test-session-123",
                "prompt": "Test prompt"
            }
            
            # Process the input
            processed_data = hook.process_hook_data(input_data)
            
            # Verify the hook event name is in PascalCase
            self.assertEqual(processed_data["hook_event_name"], "UserPromptSubmit")
            
        except ImportError:
            self.fail("Could not import user_prompt_submit hook")
    
    def test_stop_hook_event_name_casing(self):
        """Test that Stop hook uses correct PascalCase event name."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks'))
        
        try:
            from stop import StopHook
            
            hook = StopHook()
            
            # Test input data with correct PascalCase
            input_data = {
                "hookEventName": "Stop",
                "sessionId": "test-session-123"
            }
            
            # Process the input
            processed_data = hook.process_hook_data(input_data)
            
            # Verify the hook event name is in PascalCase
            self.assertEqual(processed_data["hook_event_name"], "Stop")
            
        except ImportError:
            self.fail("Could not import stop hook")
    
    def test_base_hook_event_name_extraction(self):
        """Test that BaseHook correctly extracts PascalCase event names."""
        hook = BaseHook()
        
        # Test various input formats
        test_cases = [
            {"hookEventName": "SessionStart", "expected": "SessionStart"},
            {"hookEventName": "PreToolUse", "expected": "PreToolUse"},
            {"hookEventName": "PostToolUse", "expected": "PostToolUse"},
            {"hookEventName": "UserPromptSubmit", "expected": "UserPromptSubmit"},
            {"hookEventName": "Stop", "expected": "Stop"},
        ]
        
        for test_case in test_cases:
            with self.subTest(input_event_name=test_case["hookEventName"]):
                processed_data = hook.process_hook_data(test_case)
                self.assertEqual(
                    processed_data["hook_event_name"], 
                    test_case["expected"],
                    f"Expected {test_case['expected']}, got {processed_data['hook_event_name']}"
                )
    
    def test_event_types_consistency(self):
        """Test that event types are consistent throughout the system."""
        # Import models to check event type constants
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
        
        try:
            from models import EventType
            
            # Verify expected event types exist and are properly cased
            expected_types = ["prompt", "tool_use", "session_start", "session_end", "notification", "error"]
            
            for event_type in expected_types:
                self.assertIn(
                    event_type, 
                    EventType.all_types(),
                    f"Event type '{event_type}' not found in EventType.all_types()"
                )
                
                # Verify the event type is valid
                self.assertTrue(
                    EventType.is_valid(event_type),
                    f"Event type '{event_type}' is not considered valid"
                )
                
        except ImportError:
            self.fail("Could not import EventType from models")
    
    def test_hook_file_naming_consistency(self):
        """Test that hook file names match expected patterns."""
        hooks_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'hooks')
        expected_hook_files = [
            "session_start.py",
            "pre_tool_use.py", 
            "post_tool_use.py",
            "user_prompt_submit.py",
            "pre_compact.py",
            "notification.py",
            "stop.py",
            "subagent_stop.py"
        ]
        
        for hook_file in expected_hook_files:
            hook_path = os.path.join(hooks_dir, hook_file)
            self.assertTrue(
                os.path.exists(hook_path),
                f"Hook file '{hook_file}' does not exist at {hook_path}"
            )
    
    def test_invalid_event_names_rejected(self):
        """Test that invalid or incorrectly cased event names are handled properly."""
        hook = BaseHook()
        
        # Test with snake_case (should be converted or handled)
        invalid_inputs = [
            {"hookEventName": "session_start"},  # Should be SessionStart
            {"hookEventName": "pre_tool_use"},   # Should be PreToolUse
            {"hookEventName": "post_tool_use"},  # Should be PostToolUse
            {"hookEventName": "user_prompt_submit"},  # Should be UserPromptSubmit
        ]
        
        for invalid_input in invalid_inputs:
            with self.subTest(invalid_event_name=invalid_input["hookEventName"]):
                # The hook should either convert or flag these as incorrect
                processed_data = hook.process_hook_data(invalid_input)
                
                # The hook_event_name should either be corrected to PascalCase
                # or the system should handle the conversion appropriately
                hook_event_name = processed_data.get("hook_event_name")
                
                # Verify it's not still in snake_case
                self.assertNotIn("_", hook_event_name, 
                    f"Hook event name '{hook_event_name}' should not contain underscores")
                
    def test_all_expected_hook_event_names(self):
        """Test that all expected hook event names are supported."""
        for expected_name in self.expected_hook_event_names.keys():
            with self.subTest(hook_event_name=expected_name):
                hook = BaseHook()
                input_data = {"hookEventName": expected_name}
                processed_data = hook.process_hook_data(input_data)
                
                # Should extract the event name correctly
                self.assertEqual(
                    processed_data["hook_event_name"],
                    expected_name,
                    f"Hook event name '{expected_name}' not handled correctly"
                )


if __name__ == "__main__":
    unittest.main()