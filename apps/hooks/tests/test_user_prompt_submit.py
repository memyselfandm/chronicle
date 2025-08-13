"""Tests for UserPromptSubmit hook."""

import json
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import tempfile

# Add the parent directory to the path so we can import the hook
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def mock_database_manager():
    """Mock database manager."""
    manager = Mock()
    manager.save_event.return_value = True
    manager.get_status.return_value = {"supabase": {"has_client": True}}
    return manager


@pytest.fixture
def sample_user_prompt_input():
    """Sample UserPromptSubmit hook input data."""
    return {
        "hookEventName": "UserPromptSubmit",
        "sessionId": "test-session-456",
        "transcriptPath": "/tmp/transcript.txt",
        "cwd": "/test/project",
        "prompt": "Help me create a Python function to calculate fibonacci numbers",
        "metadata": {
            "timestamp": "2024-01-15T10:30:00Z",
            "userAgent": "Claude Code CLI v1.0"
        }
    }


@pytest.fixture
def follow_up_prompt_input():
    """Follow-up prompt input data."""
    return {
        "hookEventName": "UserPromptSubmit", 
        "sessionId": "test-session-456",
        "transcriptPath": "/tmp/transcript.txt",
        "cwd": "/test/project",
        "prompt": "Can you make it more efficient?",
        "metadata": {
            "timestamp": "2024-01-15T10:35:00Z",
            "isFollowUp": True
        }
    }


@pytest.fixture
def complex_prompt_input():
    """Complex prompt with code blocks and file references."""
    return {
        "hookEventName": "UserPromptSubmit",
        "sessionId": "test-session-789", 
        "transcriptPath": "/tmp/transcript.txt",
        "cwd": "/test/project",
        "prompt": """Fix the error in my_script.py:

```python
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total
```

The function is failing with TypeError when I pass a string.""",
        "metadata": {
            "timestamp": "2024-01-15T11:00:00Z"
        }
    }


class TestUserPromptSubmitHook:
    """Test cases for UserPromptSubmit hook."""
    
    def test_hook_initialization(self, mock_database_manager):
        """Test hook can be initialized properly.""" 
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            assert hook.db_manager is not None
            assert hook.session_id is None
    
    def test_process_simple_prompt(self, mock_database_manager, sample_user_prompt_input):
        """Test processing a simple user prompt."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            result = hook.process_prompt_input(sample_user_prompt_input)
            
            # Should return the original input unchanged (pass-through)
            assert result == sample_user_prompt_input
            
            # Should have captured session ID
            assert hook.session_id == "test-session-456"
    
    def test_extract_prompt_data(self, mock_database_manager, sample_user_prompt_input):
        """Test extracting prompt data from input."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            prompt_data = hook.extract_prompt_data(sample_user_prompt_input)
            
            assert prompt_data["prompt_text"] == "Help me create a Python function to calculate fibonacci numbers"
            assert prompt_data["prompt_length"] == len("Help me create a Python function to calculate fibonacci numbers")
            assert prompt_data["event_type"] == "prompt"
            assert "timestamp" in prompt_data
            assert "context" in prompt_data
    
    def test_analyze_prompt_complexity(self, mock_database_manager, complex_prompt_input):
        """Test prompt complexity analysis."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            prompt_data = hook.extract_prompt_data(complex_prompt_input)
            
            # Should detect code blocks and higher complexity
            assert prompt_data["context"]["has_code_blocks"] is True
            assert prompt_data["context"]["complexity_score"] > 2.0
            assert prompt_data["context"]["question_count"] == 0  # No question marks in this prompt
    
    def test_follow_up_detection(self, mock_database_manager, follow_up_prompt_input):
        """Test detection of follow-up prompts."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            prompt_data = hook.extract_prompt_data(follow_up_prompt_input)
            
            assert prompt_data["context"]["is_follow_up"] is True
            assert prompt_data["context"]["prompt_type"] == "followup"
    
    def test_intent_classification(self, mock_database_manager):
        """Test intent classification for different prompt types."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Test code generation intent
            code_prompt = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test",
                "prompt": "Create a function to parse JSON files",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            data = hook.extract_prompt_data(code_prompt)
            assert data["context"]["intent"] == "code_generation"
            
            # Test debugging intent
            debug_prompt = {
                "hookEventName": "UserPromptSubmit", 
                "sessionId": "test",
                "prompt": "Why is my function not working? It throws an error",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            data = hook.extract_prompt_data(debug_prompt)
            assert data["context"]["intent"] == "debugging"
    
    def test_event_saving(self, mock_database_manager, sample_user_prompt_input):
        """Test that prompt events are saved to database."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Mock the save_event method directly on the hook instance to return True
            with patch.object(hook, 'save_event', return_value=True) as mock_save:
                hook.process_prompt_input(sample_user_prompt_input)
                
                # Should have called save_event
                mock_save.assert_called_once()
                
                # Check the event data structure
                saved_event = mock_save.call_args[0][0]
                assert saved_event["event_type"] == "prompt"
                assert saved_event["session_id"] == "test-session-456"
                assert "prompt_text" in saved_event["data"]
                assert "prompt_length" in saved_event["data"]
    
    def test_sensitive_data_sanitization(self, mock_database_manager):
        """Test that sensitive data is sanitized from prompts."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            sensitive_prompt = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test-session",
                "prompt": "My API key is sk-1234567890abcdef123456789 and my password is secret123",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            hook = UserPromptSubmitHook()
            
            # Mock the save_event method to return True and capture data
            with patch.object(hook, 'save_event', return_value=True) as mock_save:
                hook.process_prompt_input(sensitive_prompt)
                
                # Check that sensitive data was sanitized in saved event
                saved_event = mock_save.call_args[0][0]
                prompt_text = saved_event["data"]["prompt_text"]
                
                assert "sk-1234567890abcdef123456789" not in prompt_text
                assert "[REDACTED]" in prompt_text
    
    def test_error_handling(self, mock_database_manager):
        """Test error handling for malformed input."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Test missing prompt field
            invalid_input = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test-session"
                # Missing prompt field
            }
            
            # Should not crash, should return input unchanged
            result = hook.process_prompt_input(invalid_input)
            assert result == invalid_input
            
            # Should not have saved an event
            mock_database_manager.save_event.assert_not_called()
    
    def test_pass_through_behavior(self, mock_database_manager, sample_user_prompt_input):
        """Test that hook returns original input unchanged."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            result = hook.process_prompt_input(sample_user_prompt_input)
            
            # Should return exactly the same object
            assert result is sample_user_prompt_input
            assert id(result) == id(sample_user_prompt_input)
    
    def test_context_extraction(self, mock_database_manager):
        """Test extraction of session context information."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            with patch.dict(os.environ, {
                "USER": "testuser",
                "CLAUDE_SESSION_ID": "env-session-123"
            }):
                from user_prompt_submit import UserPromptSubmitHook
                
                hook = UserPromptSubmitHook()
                
                input_data = {
                    "hookEventName": "UserPromptSubmit",
                    "sessionId": "input-session-456",  # Should override env
                    "prompt": "Test prompt",
                    "cwd": "/test/project",
                    "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
                }
                
                # Process the data to set session_id
                hook.process_hook_data(input_data)
                prompt_data = hook.extract_prompt_data(input_data)
                context = prompt_data["context"]
                
                assert context["cwd"] == "/test/project"
                assert context["user"] == "testuser"
                # Session ID should come from input, not environment
                assert hook.session_id == "input-session-456"
    
    def test_prompt_length_calculation(self, mock_database_manager):
        """Test accurate prompt length calculation."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Test with unicode characters
            unicode_prompt = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test",
                "prompt": "Help me with emoji handling: 🚀🎉🔥 and accents: café",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            data = hook.extract_prompt_data(unicode_prompt)
            expected_length = len("Help me with emoji handling: 🚀🎉🔥 and accents: café")
            
            assert data["prompt_length"] == expected_length
    
    def test_database_failure_handling(self, sample_user_prompt_input):
        """Test handling of database save failures.""" 
        mock_db = Mock()
        mock_db.save_event.return_value = False  # Simulate save failure
        
        with patch('src.base_hook.DatabaseManager', return_value=mock_db):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Mock the save_event method to return False (failure)
            with patch.object(hook, 'save_event', return_value=False):
                # Should not raise exception even if database save fails
                result = hook.process_prompt_input(sample_user_prompt_input)
                
                # Should still return the input unchanged
                assert result == sample_user_prompt_input


class TestUserPromptSubmitStandalone:
    """Test the standalone script functionality."""
    
    def test_stdin_processing(self, mock_database_manager):
        """Test processing input from stdin."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import main
            
            test_input = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "stdin-test",
                "prompt": "Test from stdin",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            # Mock sys.stdin to provide test input
            with patch('sys.stdin.read', return_value=json.dumps(test_input)):
                with patch('sys.stdout.write') as mock_stdout:
                    with patch('sys.exit') as mock_exit:
                        main()
                        mock_exit.assert_called_once_with(0)
                    
                    # Should have written the input back to stdout
                    mock_stdout.assert_called()
                    written_data = mock_stdout.call_args[0][0]
                    parsed_output = json.loads(written_data)
                    
                    assert parsed_output == test_input
    
    def test_executable_permissions(self):
        """Test that the script will be executable."""
        script_path = os.path.join(os.path.dirname(__file__), '..', 'user_prompt_submit.py')
        # Check if file exists and is executable
        assert os.path.exists(script_path)
        assert os.access(script_path, os.X_OK)


class TestUserPromptAnalytics:
    """Test analytical features of prompt capture."""
    
    def test_file_reference_extraction(self, mock_database_manager):
        """Test extraction of file references from prompts."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            prompt_with_files = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test",
                "prompt": "Please read config.json and update app.py with the new settings",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            data = hook.extract_prompt_data(prompt_with_files)
            context = data["context"]
            
            assert "file_references" in context
            assert len(context["file_references"]) == 2
            assert "config.json" in context["file_references"]
            assert "app.py" in context["file_references"]
    
    def test_timestamp_handling(self, mock_database_manager):
        """Test proper timestamp handling and validation."""
        with patch('src.base_hook.DatabaseManager', return_value=mock_database_manager):
            from user_prompt_submit import UserPromptSubmitHook
            
            hook = UserPromptSubmitHook()
            
            # Test with valid timestamp in metadata
            input_with_timestamp = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test", 
                "prompt": "Test prompt",
                "metadata": {"timestamp": "2024-01-15T10:30:00Z"}
            }
            
            data = hook.extract_prompt_data(input_with_timestamp)
            
            # Should use the provided timestamp
            assert data["timestamp"] == "2024-01-15T10:30:00Z"
            
            # Test without timestamp - should generate one
            input_without_timestamp = {
                "hookEventName": "UserPromptSubmit",
                "sessionId": "test",
                "prompt": "Test prompt",
                "metadata": {}
            }
            
            data = hook.extract_prompt_data(input_without_timestamp)
            
            # Should have generated a timestamp
            assert "timestamp" in data
            assert data["timestamp"] is not None