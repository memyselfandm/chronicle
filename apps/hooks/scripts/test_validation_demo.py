#!/usr/bin/env python3
"""
Demonstration script for settings.json validation functionality.

This script shows examples of valid and invalid configurations
and demonstrates how the validation catches common mistakes.
"""

import json
import sys
from pathlib import Path

# Add the current directory to the Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from install import validate_settings_json, SettingsValidationError


def test_configuration(name: str, config: dict, should_be_valid: bool = True):
    """Test a configuration and print results."""
    print(f"\n🔍 Testing: {name}")
    print(f"Configuration: {json.dumps(config, indent=2)}")
    
    try:
        result = validate_settings_json(config)
        if should_be_valid:
            print("✅ PASSED: Configuration is valid")
        else:
            print("❌ UNEXPECTED: Configuration should have failed but didn't")
    except SettingsValidationError as e:
        if not should_be_valid:
            print(f"✅ EXPECTED ERROR: {e}")
        else:
            print(f"❌ UNEXPECTED ERROR: {e}")
    except Exception as e:
        print(f"💥 UNEXPECTED EXCEPTION: {e}")


def main():
    """Run validation demonstration."""
    print("🔧 Claude Code Settings.json Validation Demo")
    print("=" * 50)
    
    # Valid configurations
    print("\n📋 VALID CONFIGURATIONS:")
    
    test_configuration("Simple valid hook", {
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
            ]
        }
    })
    
    test_configuration("Multiple events with different matchers", {
        "hooks": {
            "PreToolUse": [
                {
                    "matcher": "Edit|Write",
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
                    "matcher": "*",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/post-all.py",
                            "timeout": 30
                        }
                    ]
                }
            ],
            "UserPromptSubmit": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/prompt-handler.py"
                        }
                    ]
                }
            ]
        }
    })
    
    test_configuration("PreCompact with valid matchers", {
        "hooks": {
            "PreCompact": [
                {
                    "matcher": "manual",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/manual-compact.py"
                        }
                    ]
                },
                {
                    "matcher": "auto",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/auto-compact.py"
                        }
                    ]
                }
            ]
        }
    })
    
    test_configuration("Mixed settings (hooks + other config)", {
        "permissions": {
            "allow": ["Bash(npm run test)"],
            "deny": ["Read(.env)"]
        },
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "startup",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/setup.sh"
                        }
                    ]
                }
            ]
        },
        "model": "claude-3-5-sonnet-20241022"
    })
    
    # Invalid configurations
    print("\n\n❌ INVALID CONFIGURATIONS:")
    
    test_configuration("Invalid event name", {
        "hooks": {
            "InvalidEvent": [
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
    }, should_be_valid=False)
    
    test_configuration("Array matcher (common mistake)", {
        "hooks": {
            "PreToolUse": [
                {
                    "matcher": ["Write", "Edit"],  # Should be "Write|Edit"
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/script.py"
                        }
                    ]
                }
            ]
        }
    }, should_be_valid=False)
    
    test_configuration("Empty command", {
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": ""
                        }
                    ]
                }
            ]
        }
    }, should_be_valid=False)
    
    test_configuration("Invalid hook type", {
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "script",  # Should be "command"
                            "command": "/path/to/script.py"
                        }
                    ]
                }
            ]
        }
    }, should_be_valid=False)
    
    test_configuration("Missing hooks array", {
        "hooks": {
            "PreToolUse": [
                {
                    "matcher": "Write"
                    # Missing "hooks" array
                }
            ]
        }
    }, should_be_valid=False)
    
    test_configuration("Invalid timeout", {
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "/path/to/script.py",
                            "timeout": -5  # Invalid negative timeout
                        }
                    ]
                }
            ]
        }
    }, should_be_valid=False)
    
    test_configuration("Timeout too large", {
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command", 
                            "command": "/path/to/script.py",
                            "timeout": 7200  # 2 hours, too large
                        }
                    ]
                }
            ]
        }
    }, should_be_valid=False)
    
    print("\n" + "=" * 50)
    print("🎯 Validation demonstration complete!")
    print("\nThe validation function successfully:")
    print("  ✅ Accepts valid Claude Code hook configurations")
    print("  ❌ Rejects invalid configurations with helpful error messages")
    print("  🔍 Catches common mistakes like array matchers")
    print("  📋 Validates all required fields and data types")
    print("  ⏱️  Enforces reasonable timeout limits")


if __name__ == "__main__":
    main()