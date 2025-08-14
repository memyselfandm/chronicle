#!/usr/bin/env python3
"""
Test suite for settings.json validation functionality.

This module tests the validation of Claude Code settings.json files,
ensuring that generated configurations conform to expected schemas
and patterns.
"""

import json
import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

# Import the validation functions we'll implement
try:
    from scripts.install import validate_settings_json, SettingsValidationError
except ImportError:
    # If not implemented yet, create placeholders for tests
    class SettingsValidationError(Exception):
        pass
    
    def validate_settings_json(settings_data):
        # Placeholder - will be implemented
        raise NotImplementedError("validate_settings_json not yet implemented")


class TestSettingsValidation:
    """Test cases for settings.json validation functionality."""
    
    def test_valid_hook_configuration(self):
        """Test validation of a properly formatted hook configuration."""
        valid_settings = {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Write",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/script.py",
                                "timeout": 10
                            }
                        ]
                    }
                ],
                "PostToolUse": [
                    {
                        "matcher": "Edit|Write",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/formatter.sh"
                            }
                        ]
                    }
                ]
            }
        }
        
        # Should not raise any exception
        result = validate_settings_json(valid_settings)
        assert result is True
    
    def test_valid_event_names(self):
        """Test that all valid Claude Code event names are accepted."""
        valid_events = [
            "PreToolUse", "PostToolUse", "UserPromptSubmit", 
            "Notification", "Stop", "SubagentStop", "PreCompact", "SessionStart"
        ]
        
        for event in valid_events:
            settings = {
                "hooks": {
                    event: [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            # Should not raise exception for valid events
            result = validate_settings_json(settings)
            assert result is True, f"Event {event} should be valid"
    
    def test_invalid_event_names(self):
        """Test that invalid event names are rejected."""
        invalid_events = [
            "InvalidEvent", "PreHook", "PostHook", "WrongEvent", 
            "pretooluse", "postToolUse", "PRETOOLUSE"  # Case sensitivity
        ]
        
        for event in invalid_events:
            settings = {
                "hooks": {
                    event: [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            with pytest.raises(SettingsValidationError) as exc_info:
                validate_settings_json(settings)
            
            assert f"Invalid hook event name: {event}" in str(exc_info.value)
    
    def test_matcher_syntax_validation(self):
        """Test validation of matcher syntax patterns."""
        # Valid matchers
        valid_matchers = [
            "Write",  # Simple string
            "Edit|Write",  # Regex OR
            "Notebook.*",  # Regex wildcard
            "*",  # Wildcard
            "",  # Empty string (matches all)
            "manual",  # PreCompact specific
            "auto",  # PreCompact specific
            "startup",  # SessionStart specific
            "resume",  # SessionStart specific
            "clear"  # SessionStart specific
        ]
        
        for matcher in valid_matchers:
            settings = {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": matcher,
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True, f"Matcher '{matcher}' should be valid"
    
    def test_invalid_matcher_array_syntax(self):
        """Test that array-style matchers are rejected with helpful message."""
        # Arrays should not be used for matchers - common mistake
        invalid_settings = {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": ["Write", "Edit"],  # Invalid: should be "Write|Edit"
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/script.py"
                            }
                        ]
                    }
                ]
            }
        }
        
        with pytest.raises(SettingsValidationError) as exc_info:
            validate_settings_json(invalid_settings)
        
        error_msg = str(exc_info.value)
        assert "matcher must be a string" in error_msg
        assert "Use 'Write|Edit' instead of ['Write', 'Edit']" in error_msg
    
    def test_hook_path_validation(self):
        """Test validation of hook command paths."""
        # Valid paths
        valid_paths = [
            "/absolute/path/to/script.py",
            "./relative/path/script.sh",
            "script.py",
            "$CLAUDE_PROJECT_DIR/.claude/hooks/script.py",
            "python -c 'print(\"hello\")'",  # Command with args
            "/usr/bin/env python3 script.py"
        ]
        
        for path in valid_paths:
            settings = {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": path
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True, f"Path '{path}' should be valid"
    
    def test_invalid_hook_paths(self):
        """Test that dangerous or invalid hook paths are rejected."""
        # Test empty/whitespace commands
        empty_commands = ["", "   "]
        
        for path in empty_commands:
            settings = {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": path
                                }
                            ]
                        }
                    ]
                }
            }
            
            with pytest.raises(SettingsValidationError) as exc_info:
                validate_settings_json(settings)
            
            assert "command cannot be empty" in str(exc_info.value)
        
        # Test None command
        settings = {
            "hooks": {
                "PreToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": None
                            }
                        ]
                    }
                ]
            }
        }
        
        with pytest.raises(SettingsValidationError) as exc_info:
            validate_settings_json(settings)
        
        # None value should trigger the "must be a string" error
        assert "command' must be a string" in str(exc_info.value)
    
    def test_json_structure_validation(self):
        """Test validation of overall JSON structure."""
        # Missing required fields
        invalid_structures = [
            # Missing hooks array
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "Write"
                            # Missing hooks array
                        }
                    ]
                }
            },
            # Missing type in hook
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "command": "/path/to/script.py"
                                    # Missing type
                                }
                            ]
                        }
                    ]
                }
            },
            # Invalid type value
            {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "invalid_type",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
        ]
        
        for invalid_structure in invalid_structures:
            with pytest.raises(SettingsValidationError):
                validate_settings_json(invalid_structure)
    
    def test_timeout_validation(self):
        """Test validation of timeout values."""
        # Valid timeouts
        valid_timeouts = [5, 10, 30, 60, 120, 300]
        
        for timeout in valid_timeouts:
            settings = {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py",
                                    "timeout": timeout
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True
        
        # Invalid timeouts
        invalid_timeouts = [-1, 0, "10", 3601, 10.5]  # Negative, zero, string, too large, float
        
        for timeout in invalid_timeouts:
            settings = {
                "hooks": {
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py",
                                    "timeout": timeout
                                }
                            ]
                        }
                    ]
                }
            }
            
            with pytest.raises(SettingsValidationError) as exc_info:
                validate_settings_json(settings)
            
            assert "timeout" in str(exc_info.value).lower()
    
    def test_no_matcher_for_specific_events(self):
        """Test that events that don't use matchers work correctly."""
        events_without_matchers = [
            "UserPromptSubmit", "Notification", "Stop", "SubagentStop"
        ]
        
        for event in events_without_matchers:
            # Should work without matcher
            settings = {
                "hooks": {
                    event: [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True
            
            # Should also work with matcher (though not used)
            settings_with_matcher = {
                "hooks": {
                    event: [
                        {
                            "matcher": "ignored",
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings_with_matcher)
            assert result is True
    
    def test_precompact_matcher_validation(self):
        """Test specific validation for PreCompact matchers."""
        # Valid PreCompact matchers
        valid_precompact_matchers = ["manual", "auto"]
        
        for matcher in valid_precompact_matchers:
            settings = {
                "hooks": {
                    "PreCompact": [
                        {
                            "matcher": matcher,
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True
    
    def test_sessionstart_matcher_validation(self):
        """Test specific validation for SessionStart matchers."""
        # Valid SessionStart matchers
        valid_sessionstart_matchers = ["startup", "resume", "clear"]
        
        for matcher in valid_sessionstart_matchers:
            settings = {
                "hooks": {
                    "SessionStart": [
                        {
                            "matcher": matcher,
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/path/to/script.py"
                                }
                            ]
                        }
                    ]
                }
            }
            
            result = validate_settings_json(settings)
            assert result is True
    
    def test_multiple_hooks_per_event(self):
        """Test validation with multiple hook configurations per event."""
        settings = {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Write",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/pre-write.py",
                                "timeout": 5
                            }
                        ]
                    },
                    {
                        "matcher": "Edit",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/pre-edit.py"
                            }
                        ]
                    }
                ],
                "PostToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/post-all.py"
                            }
                        ]
                    }
                ]
            }
        }
        
        result = validate_settings_json(settings)
        assert result is True
    
    def test_multiple_commands_per_hook(self):
        """Test validation with multiple commands in a single hook configuration."""
        settings = {
            "hooks": {
                "PostToolUse": [
                    {
                        "matcher": "Write",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/formatter.py"
                            },
                            {
                                "type": "command",
                                "command": "/path/to/linter.py",
                                "timeout": 30
                            },
                            {
                                "type": "command",
                                "command": "/path/to/backup.sh"
                            }
                        ]
                    }
                ]
            }
        }
        
        result = validate_settings_json(settings)
        assert result is True
    
    def test_mixed_settings_validation(self):
        """Test validation of settings with both hooks and other configurations."""
        mixed_settings = {
            "permissions": {
                "allow": ["Bash(npm run lint)"],
                "deny": ["Read(./.env)"]
            },
            "env": {
                "NODE_ENV": "development"
            },
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Write",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/path/to/script.py"
                            }
                        ]
                    }
                ]
            },
            "model": "claude-3-5-sonnet-20241022"
        }
        
        result = validate_settings_json(mixed_settings)
        assert result is True
    
    def test_empty_hooks_configuration(self):
        """Test validation of empty hooks configuration."""
        empty_configurations = [
            {"hooks": {}},  # Empty hooks object
            {},  # No hooks at all
            {"hooks": None},  # None value
        ]
        
        for config in empty_configurations:
            result = validate_settings_json(config)
            # Empty configurations should be valid (no hooks to validate)
            assert result is True
    
    def test_validation_error_messages(self):
        """Test that validation error messages are clear and helpful."""
        # Test specific error scenarios for clear messages
        
        # Invalid event name
        with pytest.raises(SettingsValidationError) as exc_info:
            validate_settings_json({
                "hooks": {
                    "InvalidEvent": [{"hooks": [{"type": "command", "command": "test"}]}]
                }
            })
        assert "Invalid hook event name: InvalidEvent" in str(exc_info.value)
        assert "Valid events are:" in str(exc_info.value)
        
        # Array matcher
        with pytest.raises(SettingsValidationError) as exc_info:
            validate_settings_json({
                "hooks": {
                    "PreToolUse": [{
                        "matcher": ["Write", "Edit"],
                        "hooks": [{"type": "command", "command": "test"}]
                    }]
                }
            })
        assert "Use 'Write|Edit' instead of ['Write', 'Edit']" in str(exc_info.value)
        
        # Empty command
        with pytest.raises(SettingsValidationError) as exc_info:
            validate_settings_json({
                "hooks": {
                    "PreToolUse": [{
                        "hooks": [{"type": "command", "command": ""}]
                    }]
                }
            })
        assert "command cannot be empty" in str(exc_info.value)


class TestInstallScriptValidation:
    """Test integration of validation with the install script."""
    
    def test_install_script_uses_validation(self):
        """Test that the install script calls validation on generated settings."""
        with patch('scripts.install.validate_settings_json') as mock_validate:
            mock_validate.return_value = True
            
            # This test will need to be updated once we implement the integration
            # For now, it's a placeholder to ensure we add the integration
            pass
    
    def test_install_script_handles_validation_errors(self):
        """Test that install script properly handles validation errors."""
        # Create a mock validation error
        with patch('scripts.install.validate_settings_json') as mock_validate:
            mock_validate.side_effect = SettingsValidationError("Test validation error")
            
            # This test will be implemented once we integrate validation
            pass
    
    def test_install_script_validates_generated_settings(self):
        """Test that generated settings from install script are valid."""
        # Import the HookInstaller class
        from scripts.install import HookInstaller
        
        # Create a temporary directory for testing
        with tempfile.TemporaryDirectory() as temp_dir:
            hooks_dir = Path(temp_dir) / "hooks" / "src"
            hooks_dir.mkdir(parents=True, exist_ok=True)
            claude_dir = Path(temp_dir) / ".claude"
            claude_dir.mkdir(parents=True, exist_ok=True)
            
            # Create some dummy hook files
            hook_files = ["pre_tool_use.py", "post_tool_use.py", "session_start.py"]
            for hook_file in hook_files:
                (hooks_dir / "hooks" / hook_file).parent.mkdir(parents=True, exist_ok=True)
                (hooks_dir / "hooks" / hook_file).write_text("#!/usr/bin/env python3\nprint('test')")
            
            # Create installer
            installer = HookInstaller(
                hooks_source_dir=str(hooks_dir.parent),
                claude_dir=str(claude_dir)
            )
            
            # Generate hook settings
            hook_settings = installer._generate_hook_settings()
            
            # Validate the generated settings
            result = validate_settings_json({"hooks": hook_settings})
            assert result is True


def test_example_chronicle_configuration():
    """Test validation of the Chronicle hooks configuration that will be generated."""
    # This is based on what the Chronicle install script should generate
    chronicle_settings = {
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/pre_tool_use.py",
                            "timeout": 10
                        }
                    ]
                }
            ],
            "PostToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command", 
                            "command": "/path/to/.claude/hooks/post_tool_use.py",
                            "timeout": 10
                        }
                    ]
                }
            ],
            "UserPromptSubmit": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/user_prompt_submit.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "SessionStart": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/session_start.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "Stop": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/stop.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "PreCompact": [
                {
                    "matcher": "manual",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/pre_compact.py",
                            "timeout": 10
                        }
                    ]
                },
                {
                    "matcher": "auto",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/.claude/hooks/pre_compact.py",
                            "timeout": 10
                        }
                    ]
                }
            ]
        }
    }
    
    result = validate_settings_json(chronicle_settings)
    assert result is True


if __name__ == "__main__":
    pytest.main([__file__])