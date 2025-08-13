"""
Comprehensive tests for the Claude Code hooks installation process.

This module tests all aspects of the installation functionality including:
- Hook file copying
- Claude Code settings.json registration
- Database connection validation
- Environment setup
- Cross-platform compatibility
"""

import json
import os
import platform
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, mock_open

import pytest

# Import the install module (will be created next)
try:
    from ..install import (
        HookInstaller,
        find_claude_directory,
        validate_hook_permissions,
        test_database_connection,
        backup_existing_settings,
        merge_hook_settings,
        verify_installation,
        InstallationError
    )
except ImportError:
    # Module doesn't exist yet - this is expected during TDD
    HookInstaller = None
    find_claude_directory = None
    validate_hook_permissions = None
    test_database_connection = None
    backup_existing_settings = None
    merge_hook_settings = None
    verify_installation = None
    
    class InstallationError(Exception):
        pass


class TestHookInstaller:
    """Test the main HookInstaller class functionality."""
    
    def setup_method(self):
        """Set up test fixtures for each test."""
        # Create temporary directories for testing
        self.temp_dir = tempfile.mkdtemp()
        self.hooks_source_dir = Path(self.temp_dir) / "hooks_source"
        self.claude_dir = Path(self.temp_dir) / ".claude"
        self.project_root = Path(self.temp_dir) / "project"
        
        # Create directory structure
        self.hooks_source_dir.mkdir(parents=True)
        self.claude_dir.mkdir(parents=True)
        self.project_root.mkdir(parents=True)
        
        # Create mock hook files
        self.create_mock_hook_files()
        
        # Create mock settings file
        self.create_mock_settings_file()
        
    def teardown_method(self):
        """Clean up after each test."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def create_mock_hook_files(self):
        """Create mock hook files for testing."""
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
            hook_path = self.hooks_source_dir / hook_file
            hook_path.write_text(f"""#!/usr/bin/env python3
# Mock {hook_file} for testing
import json
import sys

if __name__ == "__main__":
    data = json.load(sys.stdin)
    print(json.dumps({{"continue": True, "suppressOutput": False}}))
""")
            # Make executable
            hook_path.chmod(0o755)
    
    def create_mock_settings_file(self):
        """Create mock Claude Code settings.json for testing."""
        settings = {
            "existing_setting": "value",
            "hooks": {
                "ExistingHook": [
                    {
                        "matcher": "Test",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "echo 'existing hook'"
                            }
                        ]
                    }
                ]
            }
        }
        
        settings_path = self.claude_dir / "settings.json"
        settings_path.write_text(json.dumps(settings, indent=2))
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_installer_initialization(self):
        """Test HookInstaller initialization with various configurations."""
        # Test basic initialization
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir)
        )
        
        assert installer.hooks_source_dir == Path(self.hooks_source_dir)
        assert installer.claude_dir == Path(self.claude_dir)
        assert installer.project_root is not None
        
        # Test with custom project root
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir),
            project_root=str(self.project_root)
        )
        
        assert installer.project_root == Path(self.project_root)
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_installer_with_invalid_directories(self):
        """Test HookInstaller with invalid directory paths."""
        with pytest.raises(InstallationError):
            HookInstaller(
                hooks_source_dir="/nonexistent/directory",
                claude_dir=str(self.claude_dir)
            )
        
        with pytest.raises(InstallationError):
            HookInstaller(
                hooks_source_dir=str(self.hooks_source_dir),
                claude_dir="/nonexistent/directory"
            )
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_copy_hook_files(self):
        """Test copying hook files to Claude directory."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir)
        )
        
        # Test successful copying
        copied_files = installer.copy_hook_files()
        
        # Verify files were copied
        hooks_dir = self.claude_dir / "hooks"
        assert hooks_dir.exists()
        assert len(copied_files) == 8  # All hook files
        
        for hook_file in copied_files:
            hook_path = hooks_dir / hook_file
            assert hook_path.exists()
            assert hook_path.is_file()
            # Check permissions (should be executable)
            assert os.access(hook_path, os.X_OK)
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_update_settings_file(self):
        """Test updating Claude Code settings.json with hook configurations."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir)
        )
        
        # Copy hooks first
        installer.copy_hook_files()
        
        # Update settings
        installer.update_settings_file()
        
        # Verify settings were updated
        settings_path = self.claude_dir / "settings.json"
        with open(settings_path) as f:
            settings = json.load(f)
        
        # Check that existing settings are preserved
        assert settings["existing_setting"] == "value"
        assert "ExistingHook" in settings["hooks"]
        
        # Check that new hooks were added
        assert "PreToolUse" in settings["hooks"]
        assert "PostToolUse" in settings["hooks"]
        assert "UserPromptSubmit" in settings["hooks"]
        assert "Notification" in settings["hooks"]
        assert "SessionStart" in settings["hooks"]
        assert "Stop" in settings["hooks"]
        assert "SubagentStop" in settings["hooks"]
        assert "PreCompact" in settings["hooks"]
        
        # Verify hook configuration structure
        pre_tool_use = settings["hooks"]["PreToolUse"][0]
        assert pre_tool_use["matcher"] == "*"
        assert len(pre_tool_use["hooks"]) == 1
        assert pre_tool_use["hooks"][0]["type"] == "command"
        assert "pre_tool_use.py" in pre_tool_use["hooks"][0]["command"]
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_validate_installation(self):
        """Test validation of successful installation."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir)
        )
        
        # Perform installation
        installer.copy_hook_files()
        installer.update_settings_file()
        
        # Validate installation
        validation_result = installer.validate_installation()
        
        assert validation_result["success"] is True
        assert validation_result["hooks_copied"] == 8
        assert validation_result["settings_updated"] is True
        assert len(validation_result["errors"]) == 0
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_full_installation_process(self):
        """Test the complete installation process."""
        installer = HookInstaller(
            hooks_source_dir=str(self.hooks_source_dir),
            claude_dir=str(self.claude_dir)
        )
        
        # Run full installation
        result = installer.install()
        
        assert result["success"] is True
        assert "backup_created" in result
        assert result["hooks_installed"] == 8
        assert result["settings_updated"] is True
        
        # Verify all files exist and are executable
        hooks_dir = self.claude_dir / "hooks"
        hook_files = list(hooks_dir.glob("*.py"))
        assert len(hook_files) == 8
        
        for hook_file in hook_files:
            assert os.access(hook_file, os.X_OK)


class TestUtilityFunctions:
    """Test utility functions used in the installation process."""
    
    def setup_method(self):
        """Set up test fixtures for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.claude_dir = Path(self.temp_dir) / ".claude"
        self.claude_dir.mkdir(parents=True)
    
    def teardown_method(self):
        """Clean up after each test."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.skipif(find_claude_directory is None, reason="install module not yet implemented")
    def test_find_claude_directory_project_level(self):
        """Test finding .claude directory at project level."""
        # Create project-level .claude directory
        project_claude = Path(self.temp_dir) / "project" / ".claude"
        project_claude.mkdir(parents=True)
        
        with patch('os.getcwd', return_value=str(project_claude.parent)):
            claude_dir = find_claude_directory()
            assert claude_dir == str(project_claude)
    
    @pytest.mark.skipif(find_claude_directory is None, reason="install module not yet implemented")
    def test_find_claude_directory_user_level(self):
        """Test finding .claude directory at user level when project level doesn't exist."""
        user_claude = Path.home() / ".claude"
        
        with patch('os.getcwd', return_value=str(self.temp_dir)):
            with patch.object(Path, 'exists', side_effect=lambda: str(self) == str(user_claude)):
                claude_dir = find_claude_directory()
                assert claude_dir == str(user_claude)
    
    @pytest.mark.skipif(validate_hook_permissions is None, reason="install module not yet implemented")
    def test_validate_hook_permissions(self):
        """Test validation of hook file permissions."""
        # Create test hook file
        hook_file = Path(self.temp_dir) / "test_hook.py"
        hook_file.write_text("#!/usr/bin/env python3\nprint('test')")
        
        # Test with correct permissions
        hook_file.chmod(0o755)
        assert validate_hook_permissions(str(hook_file)) is True
        
        # Test with incorrect permissions
        hook_file.chmod(0o644)
        assert validate_hook_permissions(str(hook_file)) is False
    
    @pytest.mark.skipif(backup_existing_settings is None, reason="install module not yet implemented")
    def test_backup_existing_settings(self):
        """Test backing up existing settings.json file."""
        settings_path = self.claude_dir / "settings.json"
        settings_content = {"test": "data"}
        settings_path.write_text(json.dumps(settings_content))
        
        backup_path = backup_existing_settings(str(settings_path))
        
        # Verify backup was created
        assert Path(backup_path).exists()
        
        # Verify backup content matches original
        with open(backup_path) as f:
            backup_content = json.load(f)
        assert backup_content == settings_content
    
    @pytest.mark.skipif(merge_hook_settings is None, reason="install module not yet implemented")
    def test_merge_hook_settings(self):
        """Test merging hook settings with existing settings."""
        existing_settings = {
            "existing_key": "value",
            "hooks": {
                "ExistingHook": [{"matcher": "test"}]
            }
        }
        
        new_hook_settings = {
            "PreToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "test.py"}]}]
        }
        
        merged = merge_hook_settings(existing_settings, new_hook_settings)
        
        # Verify existing settings are preserved
        assert merged["existing_key"] == "value"
        assert "ExistingHook" in merged["hooks"]
        
        # Verify new hooks are added
        assert "PreToolUse" in merged["hooks"]
        assert merged["hooks"]["PreToolUse"] == new_hook_settings["PreToolUse"]


class TestDatabaseConnection:
    """Test database connection validation during installation."""
    
    @pytest.mark.skipif(test_database_connection is None, reason="install module not yet implemented")
    def test_database_connection_success(self):
        """Test successful database connection."""
        # Mock successful database connection
        with patch('apps.hooks.src.database.DatabaseManager') as mock_db:
            mock_db.return_value.test_connection.return_value = True
            mock_db.return_value.get_status.return_value = {"status": "connected"}
            
            result = test_database_connection()
            
            assert result["success"] is True
            assert result["status"] == "connected"
    
    @pytest.mark.skipif(test_database_connection is None, reason="install module not yet implemented")
    def test_database_connection_failure(self):
        """Test failed database connection with fallback."""
        # Mock failed database connection
        with patch('apps.hooks.src.database.DatabaseManager') as mock_db:
            mock_db.return_value.test_connection.return_value = False
            mock_db.return_value.get_status.return_value = {"status": "error", "error": "Connection failed"}
            
            result = test_database_connection()
            
            assert result["success"] is False
            assert "error" in result


class TestCrossPlatformCompatibility:
    """Test cross-platform compatibility of installation process."""
    
    def test_path_handling_windows(self):
        """Test proper path handling on Windows."""
        with patch('platform.system', return_value='Windows'):
            # Test that paths are handled correctly on Windows
            test_path = r"C:\Users\test\.claude"
            normalized = Path(test_path)
            assert str(normalized).replace('\\', '/') == "C:/Users/test/.claude"
    
    def test_path_handling_unix(self):
        """Test proper path handling on Unix-like systems."""
        with patch('platform.system', return_value='Linux'):
            # Test that paths are handled correctly on Unix
            test_path = "/home/test/.claude"
            normalized = Path(test_path)
            assert str(normalized) == "/home/test/.claude"
    
    def test_executable_permissions_cross_platform(self):
        """Test that executable permissions are set correctly across platforms."""
        # This test will verify that the installer properly handles
        # executable permissions on different platforms
        
        if platform.system() == 'Windows':
            # On Windows, we don't need to set execute permissions
            # but we should verify files are accessible
            assert True  # Placeholder for Windows-specific tests
        else:
            # On Unix-like systems, verify execute permissions
            temp_file = Path(tempfile.mktemp(suffix='.py'))
            temp_file.write_text("#!/usr/bin/env python3\nprint('test')")
            temp_file.chmod(0o755)
            
            assert os.access(temp_file, os.X_OK)
            temp_file.unlink()


class TestErrorHandling:
    """Test error handling in installation process."""
    
    def setup_method(self):
        """Set up test fixtures for each test."""
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        """Clean up after each test."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_permission_denied_error(self):
        """Test handling of permission denied errors."""
        # Create a directory with restricted permissions
        restricted_dir = Path(self.temp_dir) / "restricted"
        restricted_dir.mkdir()
        restricted_dir.chmod(0o444)  # Read-only
        
        try:
            with pytest.raises(InstallationError):
                installer = HookInstaller(
                    hooks_source_dir=str(restricted_dir),
                    claude_dir=str(restricted_dir)
                )
                installer.install()
        finally:
            # Restore permissions for cleanup
            restricted_dir.chmod(0o755)
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_invalid_json_settings(self):
        """Test handling of invalid JSON in settings file."""
        claude_dir = Path(self.temp_dir) / ".claude"
        claude_dir.mkdir()
        
        # Create invalid JSON settings file
        settings_path = claude_dir / "settings.json"
        settings_path.write_text("{ invalid json")
        
        hooks_dir = Path(self.temp_dir) / "hooks"
        hooks_dir.mkdir()
        
        installer = HookInstaller(
            hooks_source_dir=str(hooks_dir),
            claude_dir=str(claude_dir)
        )
        
        # Should handle invalid JSON gracefully
        with pytest.raises(InstallationError):
            installer.update_settings_file()
    
    @pytest.mark.skipif(HookInstaller is None, reason="install module not yet implemented")
    def test_missing_hook_files(self):
        """Test handling of missing hook files."""
        claude_dir = Path(self.temp_dir) / ".claude"
        claude_dir.mkdir()
        
        empty_hooks_dir = Path(self.temp_dir) / "empty_hooks"
        empty_hooks_dir.mkdir()
        
        installer = HookInstaller(
            hooks_source_dir=str(empty_hooks_dir),
            claude_dir=str(claude_dir)
        )
        
        # Should handle missing hook files gracefully
        result = installer.copy_hook_files()
        assert len(result) == 0


if __name__ == "__main__":
    pytest.main([__file__])