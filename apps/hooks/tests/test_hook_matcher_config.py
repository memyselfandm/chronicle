#!/usr/bin/env python3
"""
Test-driven development tests for Hook Matcher Configuration fixes.

This module tests the specific fixes needed for:
1. Remove invalid "matcher": "*" from PreToolUse and PostToolUse hooks
2. Update SessionStart hook configuration to use proper matchers array
3. Ensure all hook configurations follow Claude Code reference standards

Tests are written first to drive the implementation (TDD approach).
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import pytest

# Import the install module
try:
    from ..scripts.install import HookInstaller, merge_hook_settings, InstallationError
except ImportError:
    # Module exists, but we'll test against the actual file
    import sys
    sys.path.append(str(Path(__file__).parent.parent / "scripts"))
    from install import HookInstaller, merge_hook_settings, InstallationError


class TestHookMatcherConfiguration:
    """Test Hook Matcher Configuration according to Claude Code reference."""
    
    def setup_method(self):
        """Set up test fixtures for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.claude_dir = Path(self.temp_dir) / ".claude"
        self.hooks_source_dir = Path(self.temp_dir) / "hooks_source" / "src" / "hooks"
        self.claude_dir.mkdir(parents=True)
        self.hooks_source_dir.mkdir(parents=True)
        
        # Create minimal hook files
        for hook_name in ["pre_tool_use.py", "post_tool_use.py", "session_start.py"]:
            (self.hooks_source_dir / hook_name).write_text("#!/usr/bin/env python3\nprint('{}')")
            (self.hooks_source_dir / hook_name).chmod(0o755)
    
    def teardown_method(self):
        """Clean up after each test."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_pre_tool_use_should_not_have_invalid_matcher_star(self):
        """Test that PreToolUse hook configuration does not include invalid 'matcher': '*'."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        # PreToolUse should not have any matcher configuration
        # According to Claude Code reference, matcher can be omitted or empty string for "match all"
        pre_tool_use_configs = hook_settings.get("PreToolUse", [])
        assert len(pre_tool_use_configs) > 0, "PreToolUse configuration should exist"
        
        for config in pre_tool_use_configs:
            # Should not have 'matcher' key with '*' value
            if 'matcher' in config:
                assert config['matcher'] != '*', f"Invalid matcher '*' found in PreToolUse config: {config}"
            
            # If matcher is present, it should be empty string or omitted entirely
            # According to reference: "Use `*` to match all tools. You can also use empty string (`\"\"`) or leave `matcher` blank."
            # The proper way to match all is to omit matcher or use empty string, not "*"
            assert 'hooks' in config, "PreToolUse config should have 'hooks' array"
            assert isinstance(config['hooks'], list), "PreToolUse 'hooks' should be an array"
    
    def test_post_tool_use_should_not_have_invalid_matcher_star(self):
        """Test that PostToolUse hook configuration does not include invalid 'matcher': '*'."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        # PostToolUse should not have any matcher configuration
        post_tool_use_configs = hook_settings.get("PostToolUse", [])
        assert len(post_tool_use_configs) > 0, "PostToolUse configuration should exist"
        
        for config in post_tool_use_configs:
            # Should not have 'matcher' key with '*' value
            if 'matcher' in config:
                assert config['matcher'] != '*', f"Invalid matcher '*' found in PostToolUse config: {config}"
            
            assert 'hooks' in config, "PostToolUse config should have 'hooks' array"
            assert isinstance(config['hooks'], list), "PostToolUse 'hooks' should be an array"
    
    def test_session_start_has_proper_matcher_array(self):
        """Test that SessionStart hook uses proper matchers array according to Claude Code reference."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        # SessionStart should have proper matcher configurations
        session_start_configs = hook_settings.get("SessionStart", [])
        assert len(session_start_configs) > 0, "SessionStart configuration should exist"
        
        # According to Claude Code reference, SessionStart matchers are: startup, resume, clear
        expected_matchers = {"startup", "resume", "clear"}
        found_matchers = set()
        
        for config in session_start_configs:
            assert 'matcher' in config, f"SessionStart config must have 'matcher' field: {config}"
            matcher = config['matcher']
            
            # Each matcher should be one of the valid values
            assert matcher in expected_matchers, f"Invalid SessionStart matcher '{matcher}'. Valid matchers: {expected_matchers}"
            found_matchers.add(matcher)
            
            assert 'hooks' in config, "SessionStart config should have 'hooks' array"
            assert isinstance(config['hooks'], list), "SessionStart 'hooks' should be an array"
            assert len(config['hooks']) > 0, "SessionStart 'hooks' array should not be empty"
        
        # Should have all expected matchers
        assert found_matchers == expected_matchers, f"Missing SessionStart matchers. Expected: {expected_matchers}, Found: {found_matchers}"
    
    def test_hooks_without_matchers_omit_matcher_field(self):
        """Test that hooks that don't use matchers properly omit the matcher field."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        # According to Claude Code reference, these events don't use matchers:
        # UserPromptSubmit, Notification, Stop, SubagentStop
        no_matcher_events = ["UserPromptSubmit", "Notification", "Stop", "SubagentStop"]
        
        for event_name in no_matcher_events:
            if event_name in hook_settings:
                configs = hook_settings[event_name]
                for config in configs:
                    # These should not have matcher field at all
                    assert 'matcher' not in config, f"{event_name} should not have 'matcher' field: {config}"
                    assert 'hooks' in config, f"{event_name} config should have 'hooks' array"
    
    def test_pre_compact_has_valid_matchers(self):
        """Test that PreCompact hook has valid matchers according to Claude Code reference."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        # PreCompact should have valid matchers: manual, auto
        pre_compact_configs = hook_settings.get("PreCompact", [])
        assert len(pre_compact_configs) > 0, "PreCompact configuration should exist"
        
        expected_matchers = {"manual", "auto"}
        found_matchers = set()
        
        for config in pre_compact_configs:
            assert 'matcher' in config, f"PreCompact config must have 'matcher' field: {config}"
            matcher = config['matcher']
            
            assert matcher in expected_matchers, f"Invalid PreCompact matcher '{matcher}'. Valid matchers: {expected_matchers}"
            found_matchers.add(matcher)
            
            assert 'hooks' in config, "PreCompact config should have 'hooks' array"
            assert isinstance(config['hooks'], list), "PreCompact 'hooks' should be an array"
        
        # Should have both expected matchers
        assert found_matchers == expected_matchers, f"Missing PreCompact matchers. Expected: {expected_matchers}, Found: {found_matchers}"
    
    def test_hook_command_structure_is_valid(self):
        """Test that all hook commands have proper structure."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        hook_settings = installer._generate_hook_settings()
        
        for event_name, configs in hook_settings.items():
            for config in configs:
                assert 'hooks' in config, f"{event_name} config missing 'hooks' field"
                hooks_array = config['hooks']
                assert isinstance(hooks_array, list), f"{event_name} 'hooks' should be array"
                
                for hook in hooks_array:
                    assert 'type' in hook, f"{event_name} hook missing 'type' field"
                    assert hook['type'] == 'command', f"{event_name} hook type should be 'command'"
                    
                    assert 'command' in hook, f"{event_name} hook missing 'command' field"
                    assert isinstance(hook['command'], str), f"{event_name} hook 'command' should be string"
                    assert len(hook['command']) > 0, f"{event_name} hook 'command' should not be empty"
                    
                    # Should have timeout field
                    assert 'timeout' in hook, f"{event_name} hook missing 'timeout' field"
                    assert isinstance(hook['timeout'], int), f"{event_name} hook 'timeout' should be integer"
                    assert hook['timeout'] > 0, f"{event_name} hook 'timeout' should be positive"
    
    def test_generated_settings_merge_correctly_with_existing(self):
        """Test that generated hook settings merge correctly with existing settings."""
        # Create existing settings with some hooks
        existing_settings = {
            "permissions": {"allow": ["Bash"]},
            "hooks": {
                "ExistingHook": [
                    {
                        "matcher": "Test",
                        "hooks": [{"type": "command", "command": "echo existing"}]
                    }
                ]
            }
        }
        
        # Generate new hook settings
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        new_hook_settings = installer._generate_hook_settings()
        
        # Merge them
        merged = merge_hook_settings(existing_settings, new_hook_settings)
        
        # Existing settings should be preserved
        assert merged["permissions"]["allow"] == ["Bash"]
        assert "ExistingHook" in merged["hooks"]
        
        # New hooks should be added
        assert "PreToolUse" in merged["hooks"]
        assert "PostToolUse" in merged["hooks"]
        assert "SessionStart" in merged["hooks"]
    
    def test_complete_installation_produces_valid_settings(self):
        """Integration test: complete installation should produce valid Claude Code settings."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir.parent.parent),
            claude_dir=str(self.claude_dir)
        )
        
        # Create basic hook files for installation
        for hook_file in installer.hook_files:
            hook_path = self.hooks_source_dir / hook_file
            hook_path.write_text(f"#!/usr/bin/env python3\nprint('Mock {hook_file}')")
            hook_path.chmod(0o755)
        
        # Run installation
        result = installer.install(create_backup=False, test_database=False)
        assert result["success"], f"Installation failed: {result.get('errors', [])}"
        
        # Check that generated settings file is valid
        settings_path = self.claude_dir / "settings.json"
        assert settings_path.exists(), "settings.json should be created"
        
        with open(settings_path) as f:
            settings = json.load(f)
        
        # Validate the structure
        assert "hooks" in settings
        hooks = settings["hooks"]
        
        # Check PreToolUse and PostToolUse don't have invalid matchers
        for event_name in ["PreToolUse", "PostToolUse"]:
            if event_name in hooks:
                for config in hooks[event_name]:
                    assert config.get('matcher') != '*', f"{event_name} should not have matcher '*'"
        
        # Check SessionStart has proper matchers
        if "SessionStart" in hooks:
            session_start_matchers = {config['matcher'] for config in hooks["SessionStart"]}
            expected_matchers = {"startup", "resume", "clear"}
            assert session_start_matchers == expected_matchers, f"SessionStart should have matchers {expected_matchers}, got {session_start_matchers}"


class TestSpecificClaudeCodeComplianceRegression:
    """Regression tests to ensure Claude Code compliance is maintained."""
    
    def test_no_wildcard_matcher_in_hook_configs(self):
        """Regression test: ensure no hook configs use the invalid '*' matcher."""
        # This is a specific regression test for the bug reported
        temp_dir = tempfile.mkdtemp()
        try:
            claude_dir = Path(temp_dir) / ".claude"
            hooks_source_dir = Path(temp_dir) / "hooks_source"
            claude_dir.mkdir(parents=True)
            hooks_source_dir.mkdir(parents=True)
            
            installer = HookInstaller(
                hooks_source_dir=str(hooks_source_dir),
                claude_dir=str(claude_dir)
            )
            
            hook_settings = installer._generate_hook_settings()
            
            # Search through all hook configurations for invalid '*' matcher
            invalid_configs = []
            for event_name, configs in hook_settings.items():
                for config in configs:
                    if config.get('matcher') == '*':
                        invalid_configs.append(f"{event_name}: {config}")
            
            assert len(invalid_configs) == 0, f"Found hook configurations with invalid '*' matcher: {invalid_configs}"
            
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_session_start_specific_matcher_values(self):
        """Regression test: ensure SessionStart uses exact matcher values from Claude Code reference."""
        temp_dir = tempfile.mkdtemp()
        try:
            claude_dir = Path(temp_dir) / ".claude"
            hooks_source_dir = Path(temp_dir) / "hooks_source"
            claude_dir.mkdir(parents=True)
            hooks_source_dir.mkdir(parents=True)
            
            installer = HookInstaller(
                hooks_source_dir=str(hooks_source_dir),
                claude_dir=str(claude_dir)
            )
            
            hook_settings = installer._generate_hook_settings()
            
            # SessionStart must exist and have the right matchers
            assert "SessionStart" in hook_settings, "SessionStart hook configuration is missing"
            
            session_configs = hook_settings["SessionStart"]
            matchers = [config.get('matcher') for config in session_configs]
            
            # Must have exactly these matchers (as per Claude Code reference)
            expected = ["startup", "resume", "clear"]
            assert set(matchers) == set(expected), f"SessionStart matchers mismatch. Expected {expected}, got {matchers}"
        
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    pytest.main([__file__])