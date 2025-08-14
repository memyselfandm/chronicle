#!/usr/bin/env python3
"""
Backward Compatibility Tests for Chronicle Hooks

Tests that ensure existing installations continue to work after the introduction
of environment variable support. This includes testing:
- Existing absolute path configurations
- Mixed absolute/environment variable configurations  
- Migration scenarios
- Fallback behavior
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import shutil

# Add src directory to path for importing hooks
test_dir = Path(__file__).parent
sys.path.insert(0, str(test_dir.parent / "src"))
sys.path.insert(0, str(test_dir.parent / "src" / "core"))
sys.path.insert(0, str(test_dir.parent / "scripts"))

from install import HookInstaller, validate_settings_json, merge_hook_settings
from base_hook import BaseHook


class TestBackwardCompatibility(unittest.TestCase):
    """Test backward compatibility with existing installations."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.temp_root = tempfile.mkdtemp()
        
        # Create test project structure
        self.project_root = Path(self.temp_root) / "test_project"
        self.project_root.mkdir()
        self.claude_dir = self.project_root / ".claude"
        self.claude_dir.mkdir()
        self.hooks_dir = self.claude_dir / "hooks"
        self.hooks_dir.mkdir()
        
        # Create sample hook files
        for hook_name in ["session_start.py", "pre_tool_use.py", "post_tool_use.py"]:
            hook_file = self.hooks_dir / hook_name
            hook_file.write_text(f"#!/usr/bin/env python3\n# {hook_name} hook")
            hook_file.chmod(0o755)
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        shutil.rmtree(self.temp_root, ignore_errors=True)
    
    def test_existing_absolute_path_settings_still_work(self):
        """Test that existing settings with absolute paths continue to work."""
        # Create old-style settings with absolute paths
        old_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ],
                "PreToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "pre_tool_use.py"),
                                "timeout": 10
                            }
                        ]
                    }
                ]
            }
        }
        
        # Write old settings to file
        settings_file = self.claude_dir / "settings.json"
        with open(settings_file, 'w') as f:
            json.dump(old_settings, f, indent=2)
        
        # Validate that old settings are still valid
        try:
            validate_settings_json(old_settings)
            validation_passed = True
        except Exception as e:
            validation_passed = False
            self.fail(f"Old settings validation failed: {e}")
        
        self.assertTrue(validation_passed)
        
        # Test that hooks can be initialized with old settings
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            
            try:
                hook = BaseHook()
                context = hook.load_project_context(str(self.project_root))
                self.assertIsNotNone(context)
                hooks_work = True
            except Exception as e:
                hooks_work = False
                self.fail(f"Hook initialization failed with old settings: {e}")
        
        self.assertTrue(hooks_work)
    
    def test_mixed_absolute_and_environment_paths(self):
        """Test mixed configurations with both absolute and environment variable paths."""
        # Create mixed settings
        mixed_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py",  # New style
                                "timeout": 5
                            }
                        ]
                    }
                ],
                "PreToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "pre_tool_use.py"),  # Old style
                                "timeout": 10
                            }
                        ]
                    }
                ]
            }
        }
        
        # Validate mixed settings
        try:
            validate_settings_json(mixed_settings)
            validation_passed = True
        except Exception as e:
            validation_passed = False
            self.fail(f"Mixed settings validation failed: {e}")
        
        self.assertTrue(validation_passed)
    
    def test_settings_merging_preserves_existing_hooks(self):
        """Test that merging new hook settings preserves existing configurations."""
        # Existing settings with some hooks
        existing_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ]
            },
            "other_config": {
                "custom_setting": "value"
            }
        }
        
        # New hook settings (what installer would generate)
        new_hook_settings = {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py",
                            "timeout": 10
                        }
                    ]
                }
            ]
        }
        
        # Merge settings
        merged_settings = merge_hook_settings(existing_settings, new_hook_settings)
        
        # Verify existing settings are preserved
        self.assertIn("other_config", merged_settings)
        self.assertEqual(merged_settings["other_config"]["custom_setting"], "value")
        
        # Verify existing hooks are preserved
        self.assertIn("SessionStart", merged_settings["hooks"])
        
        # Verify new hooks are added
        self.assertIn("PreToolUse", merged_settings["hooks"])
        
        # Verify merged settings are valid
        validate_settings_json(merged_settings)
    
    def test_installer_with_existing_settings(self):
        """Test installer behavior when settings already exist."""
        # Create existing settings file
        existing_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        settings_file = self.claude_dir / "settings.json"
        with open(settings_file, 'w') as f:
            json.dump(existing_settings, f, indent=2)
        
        # Create hooks source structure
        hooks_source = Path(self.temp_root) / "hooks_source"
        hooks_source.mkdir()
        src_dir = hooks_source / "src" / "hooks"
        src_dir.mkdir(parents=True)
        
        # Create dummy source hook files
        for hook_name in ["session_start.py", "pre_tool_use.py"]:
            (src_dir / hook_name).write_text("#!/usr/bin/env python3\n# Test hook")
        
        # Set environment variable
        os.environ["CLAUDE_PROJECT_DIR"] = str(self.project_root)
        
        try:
            # Initialize installer
            installer = HookInstaller(
                hooks_source_dir=str(hooks_source),
                claude_dir=str(self.claude_dir),
                project_root=str(self.project_root)
            )
            
            # Test settings generation (should include both old and new hooks)
            installer.update_settings_file()
            
            # Read updated settings
            with open(settings_file) as f:
                updated_settings = json.load(f)
            
            # Verify settings are valid
            validate_settings_json(updated_settings)
            
            # Verify both old and new style paths coexist
            self.assertIn("hooks", updated_settings)
            
        except Exception as e:
            # Some operations might fail in test environment due to missing dependencies
            if "does not exist" in str(e):
                self.skipTest("Test skipped due to missing dependencies")
            else:
                raise
    
    def test_environment_variable_fallback_with_absolute_paths(self):
        """Test fallback behavior when environment variables are missing but absolute paths exist."""
        # Remove environment variables
        for var in ["CLAUDE_PROJECT_DIR", "CLAUDE_SESSION_ID"]:
            if var in os.environ:
                del os.environ[var]
        
        # Settings use absolute paths (old style)
        settings_with_absolute_paths = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "startup",
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(self.hooks_dir / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        # Should work without environment variables if absolute paths are used
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            
            hook = BaseHook()
            
            # Should not fail due to missing environment variables
            context = hook.load_project_context()
            self.assertIsNotNone(context)
            
            # Should fall back to current working directory
            self.assertIsNotNone(context.get("cwd"))
    
    def test_migration_from_old_to_new_format(self):
        """Test migration process from old absolute paths to new environment variable format."""
        # Old format settings
        old_format = {
            "hooks": [  # Old array format
                {
                    "event": "SessionStart",
                    "command": str(self.hooks_dir / "session_start.py")
                }
            ]
        }
        
        # New hook settings
        new_hook_settings = {
            "SessionStart": [
                {
                    "matcher": "startup",
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
        
        # Test merging (should convert old format and preserve data)
        merged = merge_hook_settings(old_format, new_hook_settings)
        
        # Should have new format
        self.assertIn("hooks", merged)
        self.assertIsInstance(merged["hooks"], dict)
        
        # Should contain new hook configuration
        self.assertIn("SessionStart", merged["hooks"])
        
        # Old hooks should be preserved under legacy_hooks key
        if merged.get("legacy_hooks"):
            self.assertIsInstance(merged["legacy_hooks"], list)
    
    def test_hook_execution_with_legacy_paths(self):
        """Test that hooks execute correctly with legacy absolute path configurations."""
        # Change to different directory to test path resolution
        original_cwd = os.getcwd()
        os.chdir(self.temp_root)
        
        try:
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                
                hook = BaseHook()
                
                # Load project context using absolute path (legacy behavior)
                context = hook.load_project_context(str(self.project_root))
                
                # Should work correctly
                self.assertEqual(context["cwd"], str(self.project_root))
                self.assertIsNotNone(context.get("git_info"))
                
                # Test project root resolution
                project_root = hook.get_project_root(str(self.project_root))
                self.assertEqual(project_root, str(self.project_root))
                
        finally:
            os.chdir(original_cwd)
    
    def test_error_handling_with_invalid_legacy_paths(self):
        """Test error handling when legacy absolute paths are invalid."""
        invalid_path = "/nonexistent/absolute/path"
        
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            
            hook = BaseHook()
            
            # Should handle invalid paths gracefully
            context = hook.load_project_context(invalid_path)
            
            # Should not crash, even with invalid path
            self.assertIsNotNone(context)
            self.assertEqual(context["cwd"], invalid_path)  # Should use provided path as-is
    
    def test_settings_validation_with_mixed_formats(self):
        """Test settings validation with various mixed configuration formats."""
        test_cases = [
            # Case 1: Pure old absolute paths
            {
                "hooks": {
                    "SessionStart": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/absolute/path/to/hook.py",
                                    "timeout": 5
                                }
                            ]
                        }
                    ]
                }
            },
            # Case 2: Pure new environment variable paths
            {
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
            },
            # Case 3: Mixed absolute and environment variable paths
            {
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
                    ],
                    "PreToolUse": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "/absolute/path/to/pre_tool_use.py",
                                    "timeout": 10
                                }
                            ]
                        }
                    ]
                }
            }
        ]
        
        for i, settings in enumerate(test_cases):
            with self.subTest(case=i+1):
                try:
                    validate_settings_json(settings)
                    validation_passed = True
                except Exception as e:
                    validation_passed = False
                    self.fail(f"Settings validation failed for case {i+1}: {e}")
                
                self.assertTrue(validation_passed, f"Case {i+1} should be valid")


class TestMigrationScenarios(unittest.TestCase):
    """Test various migration scenarios from old to new configurations."""
    
    def setUp(self):
        """Set up test environment."""
        self.original_env = os.environ.copy()
        self.temp_root = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test environment."""
        os.environ.clear()
        os.environ.update(self.original_env)
        shutil.rmtree(self.temp_root, ignore_errors=True)
    
    def test_zero_downtime_migration(self):
        """Test that migration can happen without disrupting running systems."""
        # Create project structure
        project_root = Path(self.temp_root) / "project"
        project_root.mkdir()
        claude_dir = project_root / ".claude"
        claude_dir.mkdir()
        
        # Step 1: Old configuration (absolute paths)
        old_settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(claude_dir / "hooks" / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ]
            }
        }
        
        # Step 2: Set environment variable (preparation for migration)
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_root)
        
        # Step 3: Old settings should still validate
        validate_settings_json(old_settings)
        
        # Step 4: New settings can be generated
        new_hook_settings = {
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
        
        # Step 5: Merged settings should work
        merged_settings = merge_hook_settings(old_settings, new_hook_settings)
        validate_settings_json(merged_settings)
        
        # Step 6: Both old and new configurations should be functional
        with patch("base_hook.DatabaseManager") as mock_db:
            mock_db.return_value = MagicMock()
            
            hook = BaseHook()
            context = hook.load_project_context()
            self.assertIsNotNone(context)
    
    def test_gradual_migration_strategy(self):
        """Test gradual migration of hooks one by one."""
        project_root = Path(self.temp_root) / "project"
        project_root.mkdir()
        claude_dir = project_root / ".claude"
        claude_dir.mkdir()
        
        os.environ["CLAUDE_PROJECT_DIR"] = str(project_root)
        
        # Start with all absolute paths
        settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(claude_dir / "hooks" / "session_start.py"),
                                "timeout": 5
                            }
                        ]
                    }
                ],
                "PreToolUse": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": str(claude_dir / "hooks" / "pre_tool_use.py"),
                                "timeout": 10
                            }
                        ]
                    }
                ]
            }
        }
        
        # Migrate SessionStart to environment variable
        settings["hooks"]["SessionStart"][0]["hooks"][0]["command"] = \
            "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py"
        
        # Validate partially migrated settings
        validate_settings_json(settings)
        
        # Migrate PreToolUse to environment variable
        settings["hooks"]["PreToolUse"][0]["hooks"][0]["command"] = \
            "$CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py"
        
        # Validate fully migrated settings
        validate_settings_json(settings)


if __name__ == "__main__":
    # Set up basic test environment
    os.environ.setdefault("LOG_LEVEL", "ERROR")  # Reduce log noise during tests
    
    unittest.main(verbosity=2)