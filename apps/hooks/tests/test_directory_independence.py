#!/usr/bin/env python3
"""
Test Directory Independence for Chronicle Hooks

This test validates that Chronicle hooks work correctly when executed from 
different working directories, not just the project root. This is crucial 
for portability and ensuring hooks work regardless of where Claude Code is invoked.

Features tested:
- Hook execution from project root
- Hook execution from subdirectories
- Hook execution from parent directories
- Path resolution across different working directories
- Environment variable precedence over working directory
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import json
import subprocess
import shutil

# Add src directory to path for importing hooks
test_dir = Path(__file__).parent
sys.path.insert(0, str(test_dir.parent / "src"))
sys.path.insert(0, str(test_dir.parent / "src" / "core"))

from src.lib.base_hook import BaseHook
from utils import resolve_project_path, get_project_context_with_env_support


class TestDirectoryIndependence(unittest.TestCase):
    """Test that hooks work from different working directories."""
    
    def setUp(self):
        """Set up test environment with directory structure."""
        self.original_env = os.environ.copy()
        self.original_cwd = os.getcwd()
        
        # Create temporary directory structure
        self.temp_root = tempfile.mkdtemp()
        self.project_root = Path(self.temp_root) / "test_project"
        self.project_root.mkdir()
        
        # Create subdirectories
        self.subdir_src = self.project_root / "src"
        self.subdir_src.mkdir()
        self.subdir_hooks = self.subdir_src / "hooks"
        self.subdir_hooks.mkdir()
        self.subdir_tests = self.project_root / "tests"
        self.subdir_tests.mkdir()
        
        # Create parent directory
        self.parent_dir = self.project_root.parent
        
        # Create .claude directory in project root
        self.claude_dir = self.project_root / ".claude"
        self.claude_dir.mkdir()
        
        # Set CLAUDE_PROJECT_DIR to project root
        os.environ["CLAUDE_PROJECT_DIR"] = str(self.project_root)
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_root, ignore_errors=True)
    
    def test_hook_execution_from_project_root(self):
        """Test hook execution when working directory is project root."""
        os.chdir(self.project_root)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Test project context loading
            context = hook.load_project_context()
            
            # Should resolve to project root
            self.assertEqual(context["cwd"], str(self.project_root))
            self.assertTrue(context.get("resolved_from_env"))
            self.assertEqual(context.get("claude_project_dir"), str(self.project_root))
    
    def test_hook_execution_from_subdirectory(self):
        """Test hook execution when working directory is a subdirectory."""
        os.chdir(self.subdir_hooks)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Test project context loading
            context = hook.load_project_context()
            
            # Should still be able to resolve environment variables
            self.assertTrue(context.get("resolved_from_env"))
            self.assertEqual(context.get("claude_project_dir"), str(self.project_root))
            
            # But cwd should be the current subdirectory
            self.assertEqual(context["cwd"], str(self.project_root))  # Resolved from env
            
            # Test project root resolution
            project_root = hook.get_project_root()
            self.assertEqual(project_root, str(self.project_root))
    
    def test_hook_execution_from_parent_directory(self):
        """Test hook execution when working directory is parent of project."""
        os.chdir(self.parent_dir)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Test project context loading
            context = hook.load_project_context()
            
            # Environment variable should override working directory
            self.assertTrue(context.get("resolved_from_env"))
            self.assertEqual(context.get("claude_project_dir"), str(self.project_root))
            
            # Project root should be resolved from environment
            project_root = hook.get_project_root()
            self.assertEqual(project_root, str(self.project_root))
    
    def test_environment_variable_precedence(self):
        """Test that CLAUDE_PROJECT_DIR takes precedence over working directory."""
        # Set environment to project root
        os.environ["CLAUDE_PROJECT_DIR"] = str(self.project_root)
        
        # Change to different directory
        os.chdir(self.parent_dir)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Environment variable should take precedence
            project_root = hook.get_project_root()
            self.assertEqual(project_root, str(self.project_root))
            
            # Context should reflect environment variable usage
            context = hook.load_project_context()
            self.assertTrue(context.get("resolved_from_env"))
    
    def test_fallback_to_working_directory(self):
        """Test fallback to working directory when CLAUDE_PROJECT_DIR is not set."""
        # Remove CLAUDE_PROJECT_DIR
        if "CLAUDE_PROJECT_DIR" in os.environ:
            del os.environ["CLAUDE_PROJECT_DIR"]
        
        # Change to subdirectory
        os.chdir(self.subdir_src)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should fall back to current working directory
            project_root = hook.get_project_root()
            self.assertEqual(project_root, str(self.subdir_src))
            
            # Context should show it's not resolved from environment
            context = hook.load_project_context()
            self.assertFalse(context.get("resolved_from_env"))
    
    def test_invalid_environment_variable_fallback(self):
        """Test fallback when CLAUDE_PROJECT_DIR points to non-existent directory."""
        # Set invalid environment variable
        os.environ["CLAUDE_PROJECT_DIR"] = "/nonexistent/directory"
        os.chdir(self.subdir_src)
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            hook = BaseHook()
            
            # Should fall back to working directory
            project_root = hook.get_project_root()
            self.assertEqual(project_root, str(self.subdir_src))
    
    def test_relative_path_resolution_from_different_directories(self):
        """Test resolution of relative paths from different working directories."""
        from utils import resolve_project_relative_path
        
        test_cases = [
            (self.project_root, ".claude/hooks/session_start.py"),
            (self.subdir_src, ".claude/hooks/session_start.py"), 
            (self.parent_dir, ".claude/hooks/session_start.py"),
        ]
        
        for working_dir, relative_path in test_cases:
            os.chdir(working_dir)
            
            # Should resolve to same absolute path regardless of working directory
            resolved_path = resolve_project_relative_path(relative_path)
            expected_path = str(self.project_root / ".claude" / "hooks" / "session_start.py")
            
            self.assertEqual(resolved_path, expected_path,
                           f"Failed to resolve path from {working_dir}")
    
    def test_git_info_resolution_from_different_directories(self):
        """Test git information resolution from different working directories."""
        # Initialize git repository in project root
        try:
            os.chdir(self.project_root)
            subprocess.run(["git", "init"], check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], check=True)
            subprocess.run(["git", "config", "user.name", "Test User"], check=True)
            
            # Create and commit a test file
            test_file = self.project_root / "README.md"
            test_file.write_text("# Test Project")
            subprocess.run(["git", "add", "README.md"], check=True)
            subprocess.run(["git", "commit", "-m", "Initial commit"], check=True)
            
            # Test git info from different directories
            test_directories = [
                self.project_root,
                self.subdir_src,
                self.subdir_hooks,
            ]
            
            for test_dir in test_directories:
                os.chdir(test_dir)
                
                with patch("base_hook.DatabaseManager") as mock_db:
                    mock_db.return_value = MagicMock()
                    hook = BaseHook()
                    
                    context = hook.load_project_context()
                    git_info = context.get("git_info", {})
                    
                    # Should find git repository regardless of working directory
                    if git_info.get("has_repo"):
                        self.assertIn("branch", git_info)
                        self.assertTrue(git_info["branch"])  # Should have a branch name
                        
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.skipTest("Git not available or git operations failed")
    
    def test_hook_validation_from_different_directories(self):
        """Test environment validation from different working directories."""
        test_directories = [
            self.project_root,
            self.subdir_src,
            self.subdir_hooks,
            self.parent_dir,
        ]
        
        for test_dir in test_directories:
            os.chdir(test_dir)
            
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                hook = BaseHook()
                
                # Environment validation should work from any directory
                validation_result = hook.validate_environment()
                
                self.assertIn("is_valid", validation_result)
                self.assertIn("warnings", validation_result)
                self.assertIn("errors", validation_result)
                self.assertIn("recommendations", validation_result)
                
                # Should not have errors since CLAUDE_PROJECT_DIR is set correctly
                self.assertEqual(len(validation_result["errors"]), 0,
                               f"Validation failed from {test_dir}: {validation_result['errors']}")


class TestCrossPlatformCompatibility(unittest.TestCase):
    """Test cross-platform compatibility of path handling."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
    
    @patch('os.name', 'nt')  # Windows
    @patch('platform.system')
    def test_windows_path_handling(self, mock_system):
        """Test path handling on Windows."""
        mock_system.return_value = 'Windows'
        
        # Test Windows-style paths
        windows_paths = [
            r"C:\Users\Test\Documents\project",
            r"D:\Dev\chronicle\project",
            r"C:\Program Files\MyApp\project",
        ]
        
        for windows_path in windows_paths:
            os.environ["CLAUDE_PROJECT_DIR"] = windows_path
            
            # Should handle Windows paths without error
            try:
                from utils import resolve_project_path
                # Won't actually resolve since path doesn't exist, but should not crash
                resolved = resolve_project_path()
                self.assertIsInstance(resolved, str)
            except ValueError:
                # Expected if path doesn't exist
                pass
    
    @patch('os.name', 'posix')  # Unix-like
    @patch('platform.system')
    def test_unix_path_handling(self, mock_system):
        """Test path handling on Unix-like systems."""
        mock_system.return_value = 'Linux'
        
        # Test Unix-style paths
        unix_paths = [
            "/home/user/projects/chronicle",
            "/usr/local/src/project", 
            "/opt/apps/myproject",
        ]
        
        for unix_path in unix_paths:
            os.environ["CLAUDE_PROJECT_DIR"] = unix_path
            
            # Should handle Unix paths without error
            try:
                from utils import resolve_project_path
                # Won't actually resolve since path doesn't exist, but should not crash
                resolved = resolve_project_path()
                self.assertIsInstance(resolved, str)
            except ValueError:
                # Expected if path doesn't exist
                pass
    
    def test_mixed_path_separators(self):
        """Test handling of mixed path separators."""
        mixed_paths = [
            r"C:/mixed\separators/path",
            "/unix/style\with\backslash",
            "relative/path\mixed\style",
        ]
        
        for mixed_path in mixed_paths:
            os.environ["CLAUDE_PROJECT_DIR"] = mixed_path
            
            # Should not crash with mixed separators
            try:
                from utils import resolve_project_path
                resolved = resolve_project_path()
                self.assertIsInstance(resolved, str)
            except (ValueError, OSError):
                # Some mixed paths may cause OS errors, which is acceptable
                pass


if __name__ == "__main__":
    # Set up basic test environment
    os.environ.setdefault("LOG_LEVEL", "ERROR")  # Reduce log noise during tests
    
    unittest.main(verbosity=2)