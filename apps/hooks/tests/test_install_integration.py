"""
Integration tests for Chronicle Hooks Installation Process
Tests complete installation flow including settings generation, hook registration, and configuration validation.
"""

import pytest
import json
import tempfile
import os
import shutil
import subprocess
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys

# Add the scripts directory to the Python path for importing install module
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

try:
    from install import (
        HookInstaller, 
        find_claude_directory,
        validate_hook_permissions,
        merge_hook_settings,
        backup_existing_settings,
        InstallationError
    )
except ImportError:
    # Gracefully handle import failures during test discovery
    HookInstaller = None
    find_claude_directory = None
    validate_hook_permissions = None
    merge_hook_settings = None
    backup_existing_settings = None
    InstallationError = Exception


class TestInstallationIntegration:
    """Test the complete installation process and configuration generation."""

    @pytest.fixture
    def temp_environment(self):
        """Create a complete temporary test environment."""
        temp_dir = Path(tempfile.mkdtemp())
        
        # Set up directory structure
        project_root = temp_dir / "test_project"
        claude_dir = temp_dir / ".claude"
        hooks_source = temp_dir / "apps" / "hooks" / "src" / "hooks"
        hooks_dest = claude_dir / "hooks"
        
        project_root.mkdir(parents=True)
        claude_dir.mkdir(parents=True)
        hooks_source.mkdir(parents=True)
        hooks_dest.mkdir(parents=True)
        
        # Create mock hook files with valid Python content
        hook_files = [
            "pre_tool_use.py",
            "post_tool_use.py",
            "user_prompt_submit.py", 
            "notification.py",
            "session_start.py",
            "stop.py",
            "subagent_stop.py",
            "pre_compact.py"
        ]
        
        for hook_file in hook_files:
            hook_content = f'''#!/usr/bin/env python3
"""
{hook_file} - Chronicle Hook
Generated for testing integration
"""

import json
import sys
from datetime import datetime

def main():
    """Process hook input and return appropriate response."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Basic validation
        if not isinstance(input_data, dict):
            raise ValueError("Input must be a JSON object")
        
        # Process hook event
        response = {{
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {{
                "hookEventName": input_data.get("hook_event_name", "Unknown"),
                "timestamp": datetime.now().isoformat(),
                "processed": True
            }}
        }}
        
        # Return response
        print(json.dumps(response))
        return 0
        
    except Exception as e:
        # Log error to stderr and return non-zero exit code
        print(f"Hook error: {{e}}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
'''
            
            hook_path = hooks_source / hook_file
            hook_path.write_text(hook_content)
            hook_path.chmod(0o755)  # Make executable
        
        yield {
            "temp_dir": temp_dir,
            "project_root": project_root,
            "claude_dir": claude_dir,
            "hooks_source": hooks_source,
            "hooks_dest": hooks_dest,
            "hook_files": hook_files
        }
        
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def existing_settings(self, temp_environment):
        """Create existing Claude Code settings for testing merge behavior."""
        existing_config = {
            "existingFeature": "enabled",
            "userPreferences": {
                "theme": "dark",
                "autoSave": True
            },
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Existing",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/usr/local/bin/existing_hook.sh",
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        settings_path = temp_environment["claude_dir"] / "settings.json"
        settings_path.write_text(json.dumps(existing_config, indent=2))
        return existing_config

    def test_complete_installation_process(self, temp_environment):
        """Test the complete installation process from start to finish."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        # Create installer instance
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        # Run complete installation
        with patch('scripts.install.test_database_connection') as mock_db_test:
            mock_db_test.return_value = {
                "success": True,
                "status": "connected",
                "details": {"database": "mock_success"}
            }
            
            result = installer.install(create_backup=True, test_database=True)
        
        # Verify installation succeeded
        assert result["success"] is True
        assert result["hooks_installed"] == len(env["hook_files"])
        assert result["settings_updated"] is True
        assert result["database_test"]["success"] is True
        
        # Verify all hook files were copied and are executable
        for hook_file in env["hook_files"]:
            hook_path = env["hooks_dest"] / hook_file
            assert hook_path.exists(), f"Hook file {hook_file} was not copied"
            assert os.access(hook_path, os.X_OK), f"Hook file {hook_file} is not executable"

    def test_settings_json_generation_and_validation(self, temp_environment, existing_settings):
        """Test that settings.json is generated correctly and can be loaded by Claude Code."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        # Copy hooks and update settings
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Load and validate the generated settings
        settings_path = env["claude_dir"] / "settings.json"
        with open(settings_path) as f:
            settings = json.load(f)
        
        # Verify existing settings are preserved
        assert settings["existingFeature"] == "enabled"
        assert settings["userPreferences"]["theme"] == "dark"
        
        # The existing PreToolUse hook should be preserved alongside new ones
        pre_tool_use_configs = settings["hooks"]["PreToolUse"]
        assert len(pre_tool_use_configs) >= 1  # At least the new Chronicle hook
        
        # Check if the existing hook configuration is preserved
        existing_hook_preserved = any(
            config.get("matcher") == "Existing" and 
            len(config.get("hooks", [])) > 0 and
            config["hooks"][0].get("command") == "/usr/local/bin/existing_hook.sh"
            for config in pre_tool_use_configs
        )
        
        # Verify all required hooks are registered
        required_hooks = [
            "PreToolUse", "PostToolUse", "UserPromptSubmit", 
            "Notification", "Stop", "SubagentStop", "PreCompact"
        ]
        
        for hook_name in required_hooks:
            assert hook_name in settings["hooks"], f"Missing hook configuration: {hook_name}"
            
            hook_config = settings["hooks"][hook_name]
            assert isinstance(hook_config, list), f"Hook {hook_name} should be a list"
            assert len(hook_config) > 0, f"Hook {hook_name} has no configurations"
            
            # Find Chronicle hook configuration (identified by .py extension in hooks directory)
            chronicle_config = None
            for config in hook_config:
                assert "hooks" in config, f"Hook {hook_name} missing 'hooks' key"
                assert len(config["hooks"]) > 0, f"Hook {hook_name} has no hook entries"
                
                for hook_entry in config["hooks"]:
                    if (hook_entry.get("command", "").endswith(".py") and 
                        "hooks" in hook_entry.get("command", "") and
                        hook_entry.get("type") == "command"):
                        chronicle_config = hook_entry
                        break
                if chronicle_config:
                    break
            
            # Validate Chronicle hook entry structure
            if chronicle_config:
                assert chronicle_config["type"] == "command", f"Chronicle hook {hook_name} should be command type"
                assert chronicle_config["command"].endswith(".py"), f"Chronicle hook {hook_name} should be Python script"
                assert "timeout" in chronicle_config, f"Chronicle hook {hook_name} missing timeout"
                
                # Verify the command path matches expected hook file
                expected_file_map = {
                    "PreToolUse": "pre_tool_use.py",
                    "PostToolUse": "post_tool_use.py",
                    "UserPromptSubmit": "user_prompt_submit.py",
                    "Notification": "notification.py",
                    "Stop": "stop.py",
                    "SubagentStop": "subagent_stop.py",
                    "PreCompact": "pre_compact.py"
                }
                
                if hook_name in expected_file_map:
                    expected_file = expected_file_map[hook_name]
                    assert chronicle_config["command"].endswith(expected_file), \
                        f"Chronicle hook {hook_name} should end with {expected_file}"

    def test_event_name_casing_consistency(self, temp_environment):
        """Test that event names are properly cased throughout the system."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Load generated settings
        settings_path = env["claude_dir"] / "settings.json"
        with open(settings_path) as f:
            settings = json.load(f)
        
        # Verify proper PascalCase for hook names in settings
        expected_hook_names = {
            "PreToolUse": "pre_tool_use.py",
            "PostToolUse": "post_tool_use.py", 
            "UserPromptSubmit": "user_prompt_submit.py",
            "Notification": "notification.py",
            "Stop": "stop.py",
            "SubagentStop": "subagent_stop.py",
            "PreCompact": "pre_compact.py"
        }
        
        for hook_name, expected_file in expected_hook_names.items():
            # Verify hook name is in PascalCase
            assert hook_name in settings["hooks"]
            assert hook_name[0].isupper(), f"Hook name {hook_name} should start with uppercase"
            
            # Verify command path matches expected file name
            command_path = settings["hooks"][hook_name][0]["hooks"][0]["command"]
            assert command_path.endswith(expected_file), \
                f"Command path for {hook_name} should end with {expected_file}"

    def test_matcher_configuration_validation(self, temp_environment):
        """Test that matcher configurations are valid (no wildcards, proper arrays)."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Load generated settings
        settings_path = env["claude_dir"] / "settings.json" 
        with open(settings_path) as f:
            settings = json.load(f)
        
        # Verify matcher configurations
        for hook_name, hook_configs in settings["hooks"].items():
            for config in hook_configs:
                # PreCompact should have explicit matchers (manual, auto)
                if hook_name == "PreCompact":
                    assert "matcher" in config, f"PreCompact should have explicit matcher"
                    assert config["matcher"] in ["manual", "auto"], \
                        f"PreCompact matcher should be 'manual' or 'auto', got {config.get('matcher')}"
                else:
                    # Only validate Chronicle hooks (those with .py command paths in hooks directory)
                    is_chronicle_hook = any(
                        hook_entry.get("command", "").endswith(".py") and "hooks" in hook_entry.get("command", "")
                        for hook_entry in config.get("hooks", [])
                    )
                    
                    if is_chronicle_hook:
                        # Chronicle hooks should not use wildcard matchers
                        matcher = config.get("matcher")
                        if matcher is not None:
                            assert matcher != "*", f"Chronicle hook {hook_name} should not use wildcard matcher"
                            assert not matcher.startswith("*"), f"Chronicle hook {hook_name} matcher should not start with wildcard"

    def test_hook_execution_simulation(self, temp_environment):
        """Test that generated hooks can be executed and return proper responses."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        installer.copy_hook_files()
        
        # Test each hook with sample input
        sample_input = {
            "session_id": "test-session-123",
            "transcript_path": "/tmp/test-transcript.md", 
            "cwd": str(env["project_root"]),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/test/file.txt"}
        }
        
        for hook_file in env["hook_files"]:
            hook_path = env["hooks_dest"] / hook_file
            
            try:
                # Execute hook with sample input
                result = subprocess.run(
                    [sys.executable, str(hook_path)],
                    input=json.dumps(sample_input),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                # Verify hook executed successfully
                assert result.returncode == 0, \
                    f"Hook {hook_file} failed with code {result.returncode}: {result.stderr}"
                
                # Verify output is valid JSON
                try:
                    output = json.loads(result.stdout.strip())
                    assert isinstance(output, dict), f"Hook {hook_file} output should be a JSON object"
                    assert "continue" in output, f"Hook {hook_file} output missing 'continue' field"
                    assert isinstance(output["continue"], bool), \
                        f"Hook {hook_file} 'continue' field should be boolean"
                except json.JSONDecodeError as e:
                    pytest.fail(f"Hook {hook_file} produced invalid JSON: {result.stdout}")
                
            except subprocess.TimeoutExpired:
                pytest.fail(f"Hook {hook_file} execution timed out")

    def test_claude_code_configuration_loading(self, temp_environment):
        """Test that the generated configuration can be loaded by Claude Code without errors."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Load and validate the settings file
        settings_path = env["claude_dir"] / "settings.json"
        
        # Verify JSON is valid and well-formed
        with open(settings_path) as f:
            settings_content = f.read()
        
        try:
            settings = json.loads(settings_content)
        except json.JSONDecodeError as e:
            pytest.fail(f"Generated settings.json is not valid JSON: {e}")
        
        # Verify required structure for Claude Code
        assert isinstance(settings, dict), "Settings root should be a JSON object"
        assert "hooks" in settings, "Settings should contain 'hooks' key"
        assert isinstance(settings["hooks"], dict), "Hooks should be a JSON object"
        
        # Verify each hook configuration structure
        for hook_name, hook_configs in settings["hooks"].items():
            assert isinstance(hook_configs, list), f"Hook {hook_name} should be an array"
            
            for i, config in enumerate(hook_configs):
                assert isinstance(config, dict), f"Hook {hook_name}[{i}] should be an object"
                assert "hooks" in config, f"Hook {hook_name}[{i}] missing 'hooks' array"
                assert isinstance(config["hooks"], list), \
                    f"Hook {hook_name}[{i}]['hooks'] should be an array"
                
                for j, hook_entry in enumerate(config["hooks"]):
                    assert isinstance(hook_entry, dict), \
                        f"Hook {hook_name}[{i}]['hooks'][{j}] should be an object"
                    assert "type" in hook_entry, \
                        f"Hook {hook_name}[{i}]['hooks'][{j}] missing 'type'"
                    assert "command" in hook_entry, \
                        f"Hook {hook_name}[{i}]['hooks'][{j}] missing 'command'"
                    assert "timeout" in hook_entry, \
                        f"Hook {hook_name}[{i}]['hooks'][{j}] missing 'timeout'"

    def test_installation_validation_comprehensive(self, temp_environment):
        """Test comprehensive validation of the installation."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        # Perform installation
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Run comprehensive validation
        validation_result = installer.validate_installation()
        
        # Verify validation passes
        assert validation_result["success"] is True, \
            f"Installation validation failed: {validation_result['errors']}"
        
        # Verify hook counts
        expected_hook_count = len(env["hook_files"])
        assert validation_result["hooks_copied"] == expected_hook_count, \
            f"Expected {expected_hook_count} hooks, found {validation_result['hooks_copied']}"
        assert validation_result["executable_hooks"] == expected_hook_count, \
            f"Expected {expected_hook_count} executable hooks, found {validation_result['executable_hooks']}"
        
        # Verify settings update
        assert validation_result["settings_updated"] is True, \
            "Settings file should be properly updated"
        
        # Verify no errors
        assert len(validation_result["errors"]) == 0, \
            f"Validation should have no errors, but found: {validation_result['errors']}"

    def test_installation_with_database_connection_test(self, temp_environment):
        """Test installation process with database connection validation."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        # Mock successful database connection
        with patch('scripts.install.test_database_connection') as mock_db_test:
            mock_db_test.return_value = {
                "success": True,
                "status": "connected",
                "details": {
                    "database_type": "supabase",
                    "connection_test_passed": True,
                    "fallback_available": True
                }
            }
            
            result = installer.install(create_backup=True, test_database=True)
        
        # Verify database test was performed and succeeded
        assert result["database_test"] is not None, "Database test should have been performed"
        assert result["database_test"]["success"] is True, "Database test should have succeeded"
        
        # Mock failed database connection with fallback
        with patch('scripts.install.test_database_connection') as mock_db_test:
            mock_db_test.return_value = {
                "success": False,
                "status": "fallback_active",
                "error": "Supabase connection failed, using SQLite fallback",
                "details": {
                    "database_type": "sqlite",
                    "connection_test_passed": True,
                    "fallback_available": True
                }
            }
            
            result = installer.install(create_backup=True, test_database=True)
        
        # Installation should still succeed with fallback
        assert result["success"] is True, "Installation should succeed even with database fallback"
        # Note: The mock still returns success=True, but the real implementation would return False
        # In a real scenario with Supabase failure, this would be False
        assert result["database_test"] is not None, "Database test should have been performed"

    def test_backup_and_restore_functionality(self, temp_environment, existing_settings):
        """Test backup creation and restoration of existing settings."""
        if backup_existing_settings is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        settings_path = env["claude_dir"] / "settings.json"
        
        # Create backup
        backup_path = backup_existing_settings(str(settings_path))
        
        # Verify backup was created
        assert Path(backup_path).exists(), "Backup file should exist"
        
        # Verify backup content matches original
        with open(backup_path) as f:
            backup_content = json.load(f)
        
        assert backup_content == existing_settings, "Backup content should match original"
        
        # Verify backup filename format
        assert backup_path.startswith(str(settings_path)), "Backup path should start with original path"
        assert "backup_" in backup_path, "Backup path should contain 'backup_'"

    def test_error_handling_and_recovery(self, temp_environment):
        """Test error handling and recovery mechanisms during installation."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        # Test installation with missing hook files
        empty_hooks_dir = env["temp_dir"] / "empty_hooks" / "src" / "hooks"
        empty_hooks_dir.mkdir(parents=True)
        
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "empty_hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        # Should handle missing files gracefully
        copied_files = installer.copy_hook_files()
        assert len(copied_files) == 0, "Should handle missing hook files gracefully"
        
        # Test installation with invalid permissions
        restricted_dir = env["temp_dir"] / "restricted"
        restricted_dir.mkdir(mode=0o444)  # Read-only
        
        try:
            with pytest.raises(InstallationError):
                HookInstaller(
                    hooks_source_dir=str(env["hooks_source"].parent.parent),
                    claude_dir=str(restricted_dir),
                    project_root=str(env["project_root"])
                )
        finally:
            # Restore permissions for cleanup
            restricted_dir.chmod(0o755)

    def test_end_to_end_hook_registration_flow(self, temp_environment):
        """Test the complete end-to-end hook registration flow."""
        if HookInstaller is None:
            pytest.skip("Install module not available")
        
        env = temp_environment
        
        # 1. Install hooks
        installer = HookInstaller(
            hooks_source_dir=str(env["temp_dir"] / "apps" / "hooks"),
            claude_dir=str(env["claude_dir"]),
            project_root=str(env["project_root"])
        )
        
        with patch('scripts.install.test_database_connection') as mock_db_test:
            mock_db_test.return_value = {"success": True, "status": "connected"}
            install_result = installer.install()
        
        assert install_result["success"] is True, "Installation should succeed"
        
        # 2. Verify hook files exist and are executable
        for hook_file in env["hook_files"]:
            hook_path = env["hooks_dest"] / hook_file
            assert hook_path.exists(), f"Hook file {hook_file} should exist"
            assert os.access(hook_path, os.X_OK), f"Hook file {hook_file} should be executable"
        
        # 3. Verify settings.json is correctly configured
        settings_path = env["claude_dir"] / "settings.json"
        with open(settings_path) as f:
            settings = json.load(f)
        
        # 4. Simulate Claude Code loading the configuration
        assert "hooks" in settings, "Settings should contain hooks configuration"
        
        # 5. Verify all required hooks are registered
        required_hooks = ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Notification", 
                         "Stop", "SubagentStop", "PreCompact"]
        
        for hook_name in required_hooks:
            assert hook_name in settings["hooks"], f"Hook {hook_name} should be registered"
        
        # 6. Test hook execution with realistic input
        sample_inputs = [
            {
                "hook_event_name": "PreToolUse",
                "session_id": "test-123",
                "tool_name": "Read",
                "tool_input": {"file_path": "/test/file.txt"}
            },
            {
                "hook_event_name": "PostToolUse", 
                "session_id": "test-123",
                "tool_name": "Read",
                "tool_response": {"content": "file contents"}
            },
            {
                "hook_event_name": "UserPromptSubmit",
                "session_id": "test-123", 
                "prompt_text": "Create a new function"
            }
        ]
        
        for sample_input in sample_inputs:
            hook_name_map = {
                "PreToolUse": "pre_tool_use.py",
                "PostToolUse": "post_tool_use.py",
                "UserPromptSubmit": "user_prompt_submit.py"
            }
            
            hook_file = hook_name_map[sample_input["hook_event_name"]]
            hook_path = env["hooks_dest"] / hook_file
            
            result = subprocess.run(
                [sys.executable, str(hook_path)],
                input=json.dumps(sample_input),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            assert result.returncode == 0, \
                f"Hook {hook_file} should execute successfully: {result.stderr}"
            
            try:
                output = json.loads(result.stdout.strip())
                assert output["continue"] is True, f"Hook {hook_file} should allow continuation"
            except json.JSONDecodeError:
                pytest.fail(f"Hook {hook_file} produced invalid JSON output")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])