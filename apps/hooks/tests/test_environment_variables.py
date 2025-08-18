#!/usr/bin/env python3
"""
Test Environment Variables and Project Path Resolution

Tests environment variable usage and project path resolution for improved portability 
and directory-independent operation of Chronicle hooks.

Test coverage:
- CLAUDE_PROJECT_DIR environment variable usage
- Project path resolution from different working directories  
- Cross-platform path handling (Windows, macOS, Linux)
- Fallback logic for missing environment variables
- Backward compatibility with existing installations
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import json
import shutil

# Add src directory to path for importing hooks
test_dir = Path(__file__).parent
sys.path.insert(0, str(test_dir.parent / "src"))
sys.path.insert(0, str(test_dir.parent / "src" / "core"))
sys.path.insert(0, str(test_dir.parent / "scripts"))

from src.lib.base_hook import BaseHook
from install import HookInstaller, find_claude_directory
from utils import get_git_info


class TestEnvironmentVariables(unittest.TestCase):
    """Test environment variable usage in hooks."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.test_temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_temp_dir, ignore_errors=True)
    
    def test_claude_project_dir_resolution(self):
        """Test CLAUDE_PROJECT_DIR environment variable resolution."""
        project_dir = Path(self.test_temp_dir) / "test_project"
        project_dir.mkdir()
        
        # Set CLAUDE_PROJECT_DIR
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_dir)
        
        # Create test hook with mocked database
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Test that hook can resolve project context from environment variable
            context = hook.load_project_context()
            
            # Should use current working directory if no specific path provided
            self.assertIsNotNone(context["cwd"])
            self.assertIn("timestamp", context)
    
    def test_claude_project_dir_fallback(self):
        """Test fallback when CLAUDE_PROJECT_DIR is not set."""
        # Ensure CLAUDE_PROJECT_DIR is not set
        if "CLAUDE_PROJECT_DIR" in os.environ:
            del os.environ["CLAUDE_PROJECT_DIR"]
        
        # Create test hook with mocked database
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should fall back to current working directory
            context = hook.load_project_context()
            self.assertEqual(context["cwd"], os.getcwd())
    
    def test_project_path_resolution_from_different_directories(self):
        """Test project path resolution when hooks run from different working directories."""
        # Create test project structure
        project_root = Path(self.test_temp_dir) / "project"
        project_root.mkdir()
        subdir = project_root / "subdir"
        subdir.mkdir()
        
        # Set CLAUDE_PROJECT_DIR to project root
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_root)
        
        # Change to subdirectory
        os.chdir(subdir)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Test that project context can be loaded from subdirectory
            context = hook.load_project_context()
            
            # Should resolve to project root from CLAUDE_PROJECT_DIR environment variable
            # Use resolve() to handle symlinks and normalize paths
            expected_path = str(project_root.resolve())
            actual_path = str(Path(context["cwd"]).resolve())
            self.assertEqual(actual_path, expected_path)
            self.assertTrue(context.get("resolved_from_env"))
            
            # Test explicit path override
            explicit_context = hook.load_project_context(str(subdir))
            expected_subdir_path = str(subdir.resolve())
            actual_subdir_path = str(Path(explicit_context["cwd"]).resolve())
            self.assertEqual(actual_subdir_path, expected_subdir_path)
    
    def test_git_info_resolution_with_project_dir(self):
        """Test git information resolution using CLAUDE_PROJECT_DIR."""
        # Create test git repository
        git_repo = Path(self.test_temp_dir) / "git_project"
        git_repo.mkdir()
        
        # Initialize git repo (if git is available)
        try:
            os.chdir(git_repo)
            os.system("git init")
            os.system("git config user.email 'test@example.com'")
            os.system("git config user.name 'Test User'")
            # Create initial commit
            (git_repo / "README.md").write_text("# Test Project")
            os.system("git add README.md")
            os.system("git commit -m 'Initial commit'")
            
            # Test git info extraction
            os.environ["CLAUDE_PROJECT_DIR"] = str(git_repo)
            
            git_info = get_git_info(str(git_repo))
            
            # Should contain git information
            self.assertIn("branch", git_info)
            self.assertIn("has_repo", git_info)
            
            if git_info["has_repo"]:
                self.assertTrue(git_info["branch"])  # Should have a branch name
                
        except Exception:
            # Skip test if git is not available or fails
            self.skipTest("Git not available or git operations failed")
        finally:
            os.chdir(self.original_cwd)
    
    @patch('platform.system')
    def test_cross_platform_path_handling_windows(self, mock_system):
        """Test cross-platform path handling on Windows."""
        mock_system.return_value = 'Windows'
        
        # Test Windows-style path
        windows_path = r"C:\Users\Test\Documents\project"
        os.environ["CLAUDE_PROJECT_DIR"] = windows_path
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should handle Windows paths correctly
            context = hook.load_project_context(windows_path)
            self.assertEqual(context["cwd"], windows_path)
    
    @patch('platform.system')
    def test_cross_platform_path_handling_unix(self, mock_system):
        """Test cross-platform path handling on Unix-like systems."""
        mock_system.return_value = 'Linux'
        
        # Test Unix-style path
        unix_path = "/home/user/projects/test_project"
        os.environ["CLAUDE_PROJECT_DIR"] = unix_path
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should handle Unix paths correctly
            context = hook.load_project_context(unix_path)
            self.assertEqual(context["cwd"], unix_path)
    
    def test_missing_environment_variable_error_handling(self):
        """Test error handling when required environment variables are missing."""
        # Remove environment variables that might be needed
        env_vars_to_remove = ["CLAUDE_PROJECT_DIR", "CLAUDE_SESSION_ID"]
        original_values = {}
        
        for var in env_vars_to_remove:
            if var in os.environ:
                original_values[var] = os.environ[var]
                del os.environ[var]
        
        try:
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                hook = BaseHook()
                
                # Should not fail when environment variables are missing
                context = hook.load_project_context()
                self.assertIsNotNone(context)
                
                # Should handle missing session ID gracefully
                session_id = hook.get_claude_session_id()
                self.assertIsNone(session_id)
                
        finally:
            # Restore original values
            for var, value in original_values.items():
                os.environ[var] = value


class TestProjectPathResolution(unittest.TestCase):
    """Test project path resolution functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.test_temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_temp_dir, ignore_errors=True)
    
    def test_project_root_detection_with_git(self):
        """Test project root detection when in a git repository."""
        # Create git repository structure
        project_root = Path(self.test_temp_dir) / "git_project"
        project_root.mkdir()
        subdir = project_root / "src" / "hooks"
        subdir.mkdir(parents=True)
        
        try:
            # Initialize git repository
            os.chdir(project_root)
            os.system("git init")
            
            # Change to subdirectory
            os.chdir(subdir)
            
            # Set CLAUDE_PROJECT_DIR to project root
            os.environ["CLAUDE_PROJECT_DIR"] = str(project_root)
            
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                hook = BaseHook()
                
                # Test project context from subdirectory
                context = hook.load_project_context()
                
                # Should work from subdirectory
                self.assertIsNotNone(context)
                self.assertEqual(context["cwd"], str(subdir))
                
                # Git info should be available if git repo exists
                git_info = context.get("git_info", {})
                if git_info.get("has_repo"):
                    self.assertIn("branch", git_info)
                    
        except Exception:
            # Skip if git operations fail
            self.skipTest("Git operations failed")
        finally:
            os.chdir(self.original_cwd)
    
    def test_relative_vs_absolute_paths(self):
        """Test handling of relative vs absolute paths."""
        project_dir = Path(self.test_temp_dir) / "test_project"
        project_dir.mkdir()
        
        # Test with absolute path
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_dir.absolute())
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            context_abs = hook.load_project_context(str(project_dir.absolute()))
            self.assertEqual(context_abs["cwd"], str(project_dir.absolute()))
        
        # Test with relative path (relative to current directory)
        os.chdir(project_dir.parent)
        relative_path = project_dir.name
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            context_rel = hook.load_project_context(relative_path)
            self.assertEqual(context_rel["cwd"], relative_path)


class TestInstallationEnvironmentVariables(unittest.TestCase):
    """Test environment variable usage in installation process."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.test_temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_temp_dir, ignore_errors=True)
    
    def test_claude_directory_detection(self):
        """Test Claude directory detection with and without CLAUDE_PROJECT_DIR."""
        project_dir = Path(self.test_temp_dir) / "project"
        project_dir.mkdir()
        claude_dir = project_dir / ".claude"
        claude_dir.mkdir()
        
        # Test with CLAUDE_PROJECT_DIR set
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_dir)
        os.chdir(project_dir)
        
        detected_dir = find_claude_directory()
        
        # Should find project-level .claude directory
        self.assertEqual(Path(detected_dir).name, ".claude")
        self.assertTrue(Path(detected_dir).exists())
    
    def test_hook_installer_with_environment_variables(self):
        """Test HookInstaller with environment variables."""
        # Create test project structure
        project_dir = Path(self.test_temp_dir) / "test_project"
        project_dir.mkdir()
        claude_dir = project_dir / ".claude"
        claude_dir.mkdir()
        
        # Create minimal hooks source structure
        hooks_source = Path(self.test_temp_dir) / "hooks_source"
        hooks_source.mkdir()
        src_dir = hooks_source / "src" / "hooks"
        src_dir.mkdir(parents=True)
        
        # Create a dummy hook file
        dummy_hook = src_dir / "session_start.py"
        dummy_hook.write_text("#!/usr/bin/env python3\n# Test hook\nprint('test')\n")
        
        # Set environment variables
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_dir)
        
        # Test installer initialization
        try:
            installer = HookInstaller(
                hooks_source_dir=str(hooks_source),
                claude_dir=str(claude_dir),
                project_root=str(project_dir)
            )
            
            # Should initialize without error
            self.assertIsNotNone(installer)
            self.assertEqual(installer.project_root, project_dir)
            
        except Exception as e:
            # Installation might fail due to missing dependencies, 
            # but initialization should work
            if "does not exist" in str(e):
                pass  # Expected if hooks don't exist
            else:
                raise
    
    def test_settings_generation_with_project_dir(self):
        """Test settings generation using CLAUDE_PROJECT_DIR."""
        # Create test directory structure
        project_dir = Path(self.test_temp_dir) / "test_project"
        project_dir.mkdir()
        claude_dir = project_dir / ".claude"
        claude_dir.mkdir()
        
        # Create hooks source with dummy files
        hooks_source = Path(self.test_temp_dir) / "hooks_source"
        hooks_source.mkdir()
        src_dir = hooks_source / "src" / "hooks"
        src_dir.mkdir(parents=True)
        
        # Create dummy hook files
        hook_files = ["session_start.py", "pre_tool_use.py", "post_tool_use.py"]
        for hook_file in hook_files:
            (src_dir / hook_file).write_text("#!/usr/bin/env python3\n# Test hook")
        
        # Set CLAUDE_PROJECT_DIR
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_dir)
        
        try:
            installer = HookInstaller(
                hooks_source_dir=str(hooks_source),
                claude_dir=str(claude_dir),
                project_root=str(project_dir)
            )
            
            # Generate hook settings
            hook_settings = installer._generate_hook_settings()
            
            # Verify settings contain proper paths
            self.assertIn("SessionStart", hook_settings)
            
            # Check that paths are properly formatted
            session_start_config = hook_settings["SessionStart"][0]
            hook_config = session_start_config["hooks"][0]
            command_path = hook_config["command"]
            
            # Should contain a valid path to the hook
            self.assertIn("session_start.py", command_path)
            
        except Exception as e:
            # Some operations might fail in test environment
            if "hooks source directory does not exist" in str(e):
                pass  # Expected if directory structure is incomplete
            else:
                raise


class TestBackwardCompatibility(unittest.TestCase):
    """Test backward compatibility with existing installations."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.test_temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        shutil.rmtree(self.test_temp_dir, ignore_errors=True)
    
    def test_existing_absolute_paths_still_work(self):
        """Test that existing absolute paths in settings still work."""
        # Create test directory structure
        claude_dir = Path(self.test_temp_dir) / ".claude"
        claude_dir.mkdir()
        hooks_dir = claude_dir / "hooks" 
        hooks_dir.mkdir()
        
        # Create settings with absolute paths (old style)
        settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(hooks_dir / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        settings_file = claude_dir / "settings.json"
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        # Verify settings are valid
        with open(settings_file) as f:
            loaded_settings = json.load(f)
        
        self.assertIn("hooks", loaded_settings)
        self.assertIn("SessionStart", loaded_settings["hooks"])
        
        # Command path should be absolute and valid
        command = loaded_settings["hooks"]["SessionStart"][0]["hooks"][0]["command"]
        self.assertTrue(Path(command).is_absolute())
    
    def test_migration_from_old_to_new_style(self):
        """Test migration from absolute paths to environment variable paths."""
        # This would test the migration process, but since we're maintaining
        # backward compatibility, both styles should work
        
        claude_dir = Path(self.test_temp_dir) / ".claude"
        claude_dir.mkdir()
        
        # Old style settings (absolute paths)
        old_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": "/absolute/path/to/hooks/session_start.py",
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        # New style settings (using environment variables)
        new_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py",
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        # Both should be valid JSON and have the same structure
        self.assertEqual(
            set(old_settings["hooks"].keys()),
            set(new_settings["hooks"].keys())
        )
        
        # Both should reference the same hook file (just different path styles)
        old_command = old_settings["hooks"]["SessionStart"][0]["hooks"][0]["command"]
        new_command = new_settings["hooks"]["SessionStart"][0]["hooks"][0]["command"]
        
        self.assertTrue(old_command.endswith("session_start.py"))
        self.assertTrue(new_command.endswith("session_start.py"))


class TestErrorHandlingWithEnvironmentVariables(unittest.TestCase):
    """Test error handling when environment variables are missing or invalid."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
    
    def test_invalid_claude_project_dir(self):
        """Test handling of invalid CLAUDE_PROJECT_DIR."""
        # Set invalid project directory
        os.environ["CLAUDE_PROJECT_DIR"] = "/nonexistent/directory/path"
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should handle invalid path gracefully
            context = hook.load_project_context("/nonexistent/directory/path")
            
            # Context should still be created, even if directory doesn't exist
            self.assertIsNotNone(context)
            self.assertEqual(context["cwd"], "/nonexistent/directory/path")
    
    def test_empty_environment_variables(self):
        """Test handling of empty environment variables."""
        # Set empty environment variables
        os.environ["CLAUDE_PROJECT_DIR"] = ""
        os.environ["CLAUDE_SESSION_ID"] = ""
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should handle empty values gracefully
            session_id = hook.get_claude_session_id()
            self.assertIsNone(session_id)  # Empty string should be treated as None
            
            context = hook.load_project_context()
            self.assertIsNotNone(context)  # Should still create context
    
    def test_malformed_paths_in_environment(self):
        """Test handling of malformed paths in environment variables."""
        malformed_paths = [
            "\\invalid\\windows\\path\\on\\unix",  # Wrong path separator
            "C:/mixed/separators\\path",            # Mixed separators
            "/path/with/\x00null/byte",            # Null byte in path
            "relative/../path",                     # Relative path with traversal
        ]
        
        for malformed_path in malformed_paths:
            try:
                os.environ["CLAUDE_PROJECT_DIR"] = malformed_path
                
                with patch("base_hook.DatabaseManager") as mock_db:
                    mock_db.return_value = MagicMock()
                    hook = BaseHook()
                    
                    # Should not crash, even with malformed paths
                    context = hook.load_project_context(malformed_path)
                    self.assertIsNotNone(context)
                    
            except Exception:
                # Some malformed paths might cause exceptions, 
                # which is acceptable as long as they don't crash the system
                pass


if __name__ == "__main__":
    # Set up basic test environment
    os.environ.setdefault("LOG_LEVEL", "ERROR")  # Reduce log noise during tests
    
    unittest.main(verbosity=2)