#!/usr/bin/env python3
"""
Claude Code Hooks Installation Script

This script automates the installation of Claude Code observability hooks by:
1. Copying hook files to the appropriate Claude Code directory
2. Updating Claude Code settings.json to register all hooks
3. Validating hook registration and permissions
4. Testing database connection

Usage:
    python install.py [options]
    
Options:
    --claude-dir PATH    Specify Claude Code directory (default: auto-detect)
    --project-root PATH  Specify project root directory (default: current directory)
    --hooks-dir PATH     Specify hooks source directory (default: ./hooks)
    --backup             Create backup of existing settings (default: True)
    --validate-only      Only validate existing installation
    --test-db            Test database connection after installation
    --verbose            Enable verbose output
"""

import argparse
import json
import logging
import os
import platform
import shutil
import stat
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class InstallationError(Exception):
    """Custom exception for installation-related errors."""
    pass


class HookInstaller:
    """
    Main class for installing Claude Code observability hooks.
    
    Handles the complete installation process including file copying,
    settings management, validation, and database testing.
    """
    
    def __init__(self, hooks_source_dir: str, claude_dir: str, project_root: Optional[str] = None):
        """
        Initialize the hook installer.
        
        Args:
            hooks_source_dir: Directory containing hook source files
            claude_dir: Claude Code configuration directory
            project_root: Project root directory (optional)
            
        Raises:
            InstallationError: If directories are invalid or inaccessible
        """
        self.hooks_source_dir = Path(hooks_source_dir)
        self.claude_dir = Path(claude_dir)
        self.project_root = Path(project_root) if project_root else Path.cwd()
        
        # Validate directories
        self._validate_directories()
        
        # Define hook files to install (now in src/hooks/)
        self.hook_files = [
            "pre_tool_use.py",
            "post_tool_use.py", 
            "user_prompt_submit.py",
            "notification.py",
            "session_start.py",
            "stop.py",
            "subagent_stop.py",
            "pre_compact.py"
        ]
        
        # Update hooks source directory to point to src/hooks
        self.hooks_source_dir = self.hooks_source_dir / "src" / "hooks"
        
        logger.info(f"HookInstaller initialized:")
        logger.info(f"  Hooks source: {self.hooks_source_dir}")
        logger.info(f"  Claude directory: {self.claude_dir}")
        logger.info(f"  Project root: {self.project_root}")
    
    def _validate_directories(self) -> None:
        """
        Validate that required directories exist and are accessible.
        
        Raises:
            InstallationError: If directories are invalid
        """
        if not self.hooks_source_dir.exists():
            raise InstallationError(f"Hooks source directory does not exist: {self.hooks_source_dir}")
        
        if not self.hooks_source_dir.is_dir():
            raise InstallationError(f"Hooks source path is not a directory: {self.hooks_source_dir}")
        
        # Create Claude directory if it doesn't exist
        try:
            self.claude_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            raise InstallationError(f"Permission denied creating Claude directory: {self.claude_dir}")
        
        # Test write access to Claude directory
        try:
            test_file = self.claude_dir / ".test_write"
            test_file.touch()
            test_file.unlink()
        except PermissionError:
            raise InstallationError(f"No write permission to Claude directory: {self.claude_dir}")
    
    def copy_hook_files(self) -> List[str]:
        """
        Copy hook files from source directory to Claude hooks directory.
        
        Returns:
            List of successfully copied hook file names
            
        Raises:
            InstallationError: If copying fails
        """
        hooks_dest_dir = self.claude_dir / "hooks"
        hooks_dest_dir.mkdir(exist_ok=True)
        
        copied_files = []
        errors = []
        
        for hook_file in self.hook_files:
            source_path = self.hooks_source_dir / hook_file
            dest_path = hooks_dest_dir / hook_file
            
            # Skip if source file doesn't exist
            if not source_path.exists():
                logger.warning(f"Hook file not found, skipping: {hook_file}")
                continue
            
            try:
                # Copy file
                shutil.copy2(source_path, dest_path)
                
                # Ensure executable permissions
                self._make_executable(dest_path)
                
                copied_files.append(hook_file)
                logger.info(f"Copied hook file: {hook_file}")
                
            except Exception as e:
                error_msg = f"Failed to copy {hook_file}: {e}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        if errors and not copied_files:
            raise InstallationError(f"Failed to copy any hook files: {'; '.join(errors)}")
        
        logger.info(f"Successfully copied {len(copied_files)} hook files")
        return copied_files
    
    def _make_executable(self, file_path: Path) -> None:
        """
        Make a file executable (cross-platform).
        
        Args:
            file_path: Path to the file to make executable
        """
        if platform.system() != 'Windows':
            # On Unix-like systems, set execute permission
            current_mode = file_path.stat().st_mode
            file_path.chmod(current_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        # On Windows, files are executable by default if they have appropriate extensions
    
    def update_settings_file(self) -> None:
        """
        Update Claude Code settings.json to register hooks.
        
        Raises:
            InstallationError: If settings update fails
        """
        settings_path = self.claude_dir / "settings.json"
        
        # Load existing settings or create new ones
        try:
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
            else:
                settings = {}
                
        except json.JSONDecodeError as e:
            raise InstallationError(f"Invalid JSON in existing settings file: {e}")
        
        # Generate hook configuration
        hook_settings = self._generate_hook_settings()
        
        # Merge with existing settings
        merged_settings = merge_hook_settings(settings, hook_settings)
        
        # Add backward compatibility information to the final merged settings
        merged_settings = self._add_backward_compatibility_note(merged_settings)
        
        # Validate the merged settings before writing
        try:
            logger.debug(f"Validating merged settings structure: {list(merged_settings.keys())}")
            if "hooks" in merged_settings:
                logger.debug(f"Hooks keys: {list(merged_settings['hooks'].keys())}")
            validate_settings_json(merged_settings)
            logger.info("Generated settings passed validation")
        except SettingsValidationError as e:
            logger.error(f"Validation failed. Settings structure: {json.dumps(merged_settings, indent=2)}")
            raise InstallationError(f"Generated settings failed validation: {e}")
        
        # Write updated settings
        try:
            with open(settings_path, 'w') as f:
                json.dump(merged_settings, f, indent=2)
            
            logger.info(f"Updated Claude Code settings: {settings_path}")
            
        except Exception as e:
            raise InstallationError(f"Failed to write settings file: {e}")
    
    def _generate_hook_settings(self) -> Dict[str, Any]:
        """
        Generate hook configuration for Claude Code settings.json.
        Uses $CLAUDE_PROJECT_DIR environment variable for improved portability.
        
        Returns:
            Dictionary containing hook configuration
        """
        # Use $CLAUDE_PROJECT_DIR environment variable in hook paths for portability
        # This allows hooks to work from different working directories
        project_dir_var = "$CLAUDE_PROJECT_DIR"
        
        # Determine the relative path from project root to Claude directory
        try:
            # Calculate relative path from project root to .claude directory
            claude_relative = os.path.relpath(self.claude_dir, self.project_root)
            hook_path_template = f"{project_dir_var}/{claude_relative}/hooks"
        except ValueError:
            # If paths are on different drives (Windows), fall back to absolute path with env var
            hook_path_template = f"{project_dir_var}/.claude/hooks"
        
        hook_configs = {
            "PreToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/pre_tool_use.py",
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
                            "command": f"{hook_path_template}/post_tool_use.py",
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
                            "command": f"{hook_path_template}/user_prompt_submit.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "Notification": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/notification.py", 
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
                            "command": f"{hook_path_template}/stop.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "SubagentStop": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/subagent_stop.py",
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
                            "command": f"{hook_path_template}/pre_compact.py",
                            "timeout": 10
                        }
                    ]
                },
                {
                    "matcher": "auto",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/pre_compact.py",
                            "timeout": 10
                        }
                    ]
                }
            ],
            "SessionStart": [
                {
                    "matcher": "startup",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/session_start.py",
                            "timeout": 5
                        }
                    ]
                },
                {
                    "matcher": "resume",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/session_start.py",
                            "timeout": 5
                        }
                    ]
                },
                {
                    "matcher": "clear",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hook_path_template}/session_start.py",
                            "timeout": 5
                        }
                    ]
                }
            ]
        }
        
        return hook_configs
    
    def _add_backward_compatibility_note(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add backward compatibility note for existing installations.
        
        Args:
            settings: Merged settings dictionary (full settings structure)
            
        Returns:
            Settings with backward compatibility information
        """
        # Ensure hooks section exists (should already exist from merge_hook_settings)
        if "hooks" not in settings:
            settings["hooks"] = {}
        
        # Add comment about environment variable usage at the top level of settings
        settings["_chronicle_hooks_info"] = {
            "version": "2.0",
            "environment_variables": {
                "CLAUDE_PROJECT_DIR": "Set this to your project root directory for portability",
                "example": "export CLAUDE_PROJECT_DIR=/path/to/your/project"
            },
            "backward_compatibility": "Absolute paths in existing installations will continue to work",
            "generated_at": datetime.now().isoformat()
        }
        
        return settings
    
    def validate_installation(self) -> Dict[str, Any]:
        """
        Validate the installation by checking files and permissions.
        
        Returns:
            Dictionary containing validation results
        """
        hooks_dir = self.claude_dir / "hooks"
        settings_path = self.claude_dir / "settings.json"
        
        validation_result = {
            "success": True,
            "hooks_copied": 0,
            "settings_updated": False,
            "executable_hooks": 0,
            "errors": []
        }
        
        # Check hook files
        for hook_file in self.hook_files:
            hook_path = hooks_dir / hook_file
            if hook_path.exists():
                validation_result["hooks_copied"] += 1
                
                # Check if executable
                if validate_hook_permissions(str(hook_path)):
                    validation_result["executable_hooks"] += 1
                else:
                    validation_result["errors"].append(f"Hook not executable: {hook_file}")
            
        # Check settings file
        if settings_path.exists():
            try:
                with open(settings_path) as f:
                    settings = json.load(f)
                
                if "hooks" in settings and any(hook in settings["hooks"] for hook in 
                    ["PreToolUse", "PostToolUse", "UserPromptSubmit", "SessionStart"]):
                    validation_result["settings_updated"] = True
                else:
                    validation_result["errors"].append("Settings file missing hook configurations")
                    
            except Exception as e:
                validation_result["errors"].append(f"Cannot read settings file: {e}")
        else:
            validation_result["errors"].append("Settings file does not exist")
        
        # Overall success
        if validation_result["errors"]:
            validation_result["success"] = False
        
        return validation_result
    
    def install(self, create_backup: bool = True, test_database: bool = True) -> Dict[str, Any]:
        """
        Perform the complete installation process.
        
        Args:
            create_backup: Whether to backup existing settings
            test_database: Whether to test database connection
            
        Returns:
            Dictionary containing installation results
        """
        install_result = {
            "success": False,
            "hooks_installed": 0,
            "settings_updated": False,
            "backup_created": None,
            "database_test": None,
            "errors": []
        }
        
        try:
            # Backup existing settings if requested
            if create_backup:
                settings_path = self.claude_dir / "settings.json"
                if settings_path.exists():
                    backup_path = backup_existing_settings(str(settings_path))
                    install_result["backup_created"] = backup_path
                    logger.info(f"Created backup: {backup_path}")
            
            # Copy hook files
            copied_files = self.copy_hook_files()
            install_result["hooks_installed"] = len(copied_files)
            
            # Update settings
            self.update_settings_file()
            install_result["settings_updated"] = True
            
            # Test database connection if requested
            if test_database:
                db_test_result = test_database_connection()
                install_result["database_test"] = db_test_result
                
                if not db_test_result.get("success", False):
                    logger.warning("Database connection test failed, but installation completed")
            
            # Validate installation
            validation = self.validate_installation()
            if validation["success"]:
                install_result["success"] = True
                logger.info("Installation completed successfully!")
            else:
                install_result["errors"].extend(validation["errors"])
                logger.error("Installation completed with errors")
            
        except Exception as e:
            error_msg = f"Installation failed: {e}"
            install_result["errors"].append(error_msg)
            logger.error(error_msg)
        
        return install_result


def find_claude_directory() -> str:
    """
    Find the appropriate Claude Code directory.
    
    Searches in order:
    1. CLAUDE_PROJECT_DIR/.claude (if CLAUDE_PROJECT_DIR is set)
    2. Project-level .claude directory (current working directory)
    3. User-level ~/.claude directory
    
    Returns:
        Path to Claude directory
        
    Raises:
        InstallationError: If no Claude directory found
    """
    # Check CLAUDE_PROJECT_DIR first if set
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")
    if claude_project_dir:
        project_claude = Path(claude_project_dir) / ".claude"
        if project_claude.exists():
            logger.info(f"Using Claude directory from CLAUDE_PROJECT_DIR: {project_claude}")
            return str(project_claude)
        else:
            # Create it if CLAUDE_PROJECT_DIR is set but .claude doesn't exist
            try:
                project_claude.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created Claude directory at CLAUDE_PROJECT_DIR: {project_claude}")
                return str(project_claude)
            except (PermissionError, OSError) as e:
                logger.warning(f"Cannot create Claude directory at CLAUDE_PROJECT_DIR {project_claude}: {e}")
    
    # Check project-level (current working directory)
    project_claude = Path.cwd() / ".claude"
    if project_claude.exists():
        logger.info(f"Using project-level Claude directory: {project_claude}")
        return str(project_claude)
    
    # Check user-level
    user_claude = Path.home() / ".claude"
    if user_claude.exists():
        logger.info(f"Using user-level Claude directory: {user_claude}")
        return str(user_claude)
    
    # Create project-level directory as default
    try:
        project_claude.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created project-level Claude directory: {project_claude}")
        return str(project_claude)
    except (PermissionError, OSError) as e:
        # Fall back to user directory if project directory creation fails
        try:
            user_claude.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created user-level Claude directory: {user_claude}")
            return str(user_claude)
        except (PermissionError, OSError) as e2:
            raise InstallationError(f"Cannot create Claude directory in project ({e}) or user home ({e2})")
    
    return str(project_claude)


def validate_hook_permissions(hook_path: str) -> bool:
    """
    Validate that a hook file has proper permissions.
    
    Args:
        hook_path: Path to hook file
        
    Returns:
        True if permissions are correct
    """
    path = Path(hook_path)
    
    if not path.exists():
        return False
    
    # On Windows, just check if file exists and is readable
    if platform.system() == 'Windows':
        return os.access(path, os.R_OK)
    
    # On Unix-like systems, check execute permission
    return os.access(path, os.X_OK)


def backup_existing_settings(settings_path: str) -> str:
    """
    Create a backup of existing settings file.
    
    Args:
        settings_path: Path to settings file
        
    Returns:
        Path to backup file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{settings_path}.backup_{timestamp}"
    
    shutil.copy2(settings_path, backup_path)
    return backup_path


class SettingsValidationError(Exception):
    """Custom exception for settings validation errors."""
    pass


def validate_settings_json(settings_data: Dict[str, Any]) -> bool:
    """
    Validate settings.json data according to Claude Code hook schema.
    
    Args:
        settings_data: Dictionary containing settings.json data
        
    Returns:
        True if valid
        
    Raises:
        SettingsValidationError: If validation fails with detailed error message
    """
    if not isinstance(settings_data, dict):
        raise SettingsValidationError("Settings must be a JSON object")
    
    # If no hooks configuration, that's valid (empty case)
    if "hooks" not in settings_data:
        return True
    
    hooks_config = settings_data["hooks"]
    
    # Handle None or empty hooks
    if hooks_config is None or hooks_config == {}:
        return True
    
    if not isinstance(hooks_config, dict):
        raise SettingsValidationError("'hooks' must be an object")
    
    # Valid Claude Code hook event names
    valid_events = {
        "PreToolUse", "PostToolUse", "UserPromptSubmit", 
        "Notification", "Stop", "SubagentStop", "PreCompact", "SessionStart"
    }
    
    # Events that don't typically use matchers
    events_without_matchers = {"UserPromptSubmit", "Notification", "Stop", "SubagentStop"}
    
    # Valid matchers for specific events
    precompact_matchers = {"manual", "auto"}
    sessionstart_matchers = {"startup", "resume", "clear"}
    
    for event_name, event_configs in hooks_config.items():
        # Validate event name
        if event_name not in valid_events:
            valid_events_list = ", ".join(sorted(valid_events))
            raise SettingsValidationError(
                f"Invalid hook event name: {event_name}. "
                f"Valid events are: {valid_events_list}"
            )
        
        # Validate event configuration structure
        if not isinstance(event_configs, list):
            raise SettingsValidationError(
                f"Event '{event_name}' must have an array of configurations"
            )
        
        for i, config in enumerate(event_configs):
            if not isinstance(config, dict):
                raise SettingsValidationError(
                    f"Event '{event_name}' configuration {i} must be an object"
                )
            
            # Validate matcher (if present)
            if "matcher" in config:
                matcher = config["matcher"]
                
                # Check for common mistake: using arrays instead of strings
                if isinstance(matcher, list):
                    matcher_suggestion = "|".join(matcher)
                    raise SettingsValidationError(
                        f"Event '{event_name}' matcher must be a string, not an array. "
                        f"Use '{matcher_suggestion}' instead of {matcher}"
                    )
                
                if not isinstance(matcher, str):
                    raise SettingsValidationError(
                        f"Event '{event_name}' matcher must be a string"
                    )
                
                # Validate specific event matchers
                if event_name == "PreCompact":
                    if matcher and matcher not in precompact_matchers:
                        valid_matchers = ", ".join(sorted(precompact_matchers))
                        logger.warning(
                            f"PreCompact matcher '{matcher}' may not be recognized. "
                            f"Common values are: {valid_matchers}"
                        )
                
                elif event_name == "SessionStart":
                    if matcher and matcher not in sessionstart_matchers:
                        valid_matchers = ", ".join(sorted(sessionstart_matchers))
                        logger.warning(
                            f"SessionStart matcher '{matcher}' may not be recognized. "
                            f"Common values are: {valid_matchers}"
                        )
            
            # Validate hooks array (required)
            if "hooks" not in config:
                raise SettingsValidationError(
                    f"Event '{event_name}' configuration {i} missing required 'hooks' array"
                )
            
            hooks_array = config["hooks"]
            if not isinstance(hooks_array, list):
                raise SettingsValidationError(
                    f"Event '{event_name}' configuration {i} 'hooks' must be an array"
                )
            
            if len(hooks_array) == 0:
                raise SettingsValidationError(
                    f"Event '{event_name}' configuration {i} 'hooks' array cannot be empty"
                )
            
            # Validate individual hook configurations
            for j, hook in enumerate(hooks_array):
                if not isinstance(hook, dict):
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} must be an object"
                    )
                
                # Validate hook type (required)
                if "type" not in hook:
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} missing required 'type'"
                    )
                
                hook_type = hook["type"]
                if hook_type != "command":
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} type must be 'command', got '{hook_type}'"
                    )
                
                # Validate command (required)
                if "command" not in hook:
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} missing required 'command'"
                    )
                
                command = hook["command"]
                if command is None or not isinstance(command, str):
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} 'command' must be a string"
                    )
                
                if not command or command.strip() == "":
                    raise SettingsValidationError(
                        f"Event '{event_name}' configuration {i}, hook {j} command cannot be empty"
                    )
                
                # Validate timeout (optional)
                if "timeout" in hook:
                    timeout = hook["timeout"]
                    if not isinstance(timeout, int):
                        raise SettingsValidationError(
                            f"Event '{event_name}' configuration {i}, hook {j} 'timeout' must be an integer"
                        )
                    
                    if timeout <= 0:
                        raise SettingsValidationError(
                            f"Event '{event_name}' configuration {i}, hook {j} 'timeout' must be positive"
                        )
                    
                    if timeout > 3600:  # 1 hour max
                        raise SettingsValidationError(
                            f"Event '{event_name}' configuration {i}, hook {j} 'timeout' cannot exceed 3600 seconds"
                        )
    
    logger.info("Settings validation passed successfully")
    return True


def merge_hook_settings(existing_settings: Dict[str, Any], 
                       hook_settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge hook settings with existing Claude Code settings.
    
    Args:
        existing_settings: Existing settings dictionary
        hook_settings: New hook settings to merge
        
    Returns:
        Merged settings dictionary
    """
    merged = existing_settings.copy()
    
    # Handle different hooks formats
    if "hooks" not in merged:
        merged["hooks"] = {}
    elif isinstance(merged["hooks"], list):
        # Convert old list format to new dict format, preserving existing hooks
        old_hooks = merged["hooks"]
        merged["hooks"] = {}
        # Keep old hooks in their original format under a special key
        if old_hooks:
            merged["legacy_hooks"] = old_hooks
    
    # Merge hook configurations
    for hook_name, hook_config in hook_settings.items():
        merged["hooks"][hook_name] = hook_config
    
    return merged


def test_database_connection() -> Dict[str, Any]:
    """
    Test database connection for the hooks system.
    
    Returns:
        Dictionary containing test results
    """
    try:
        # Import database manager (updated path for new structure)
        sys.path.append(str(Path(__file__).parent.parent / "src" / "core"))
        from database import DatabaseManager
        
        # Test connection
        db_manager = DatabaseManager()
        connection_success = db_manager.test_connection()
        status = db_manager.get_status()
        
        return {
            "success": connection_success,
            "status": status.get("connection_test_passed", "unknown"),
            "details": status
        }
        
    except ImportError as e:
        return {
            "success": False,
            "error": f"Cannot import database module: {e}",
            "status": "import_error"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Database test failed: {e}",
            "status": "connection_error"
        }


def verify_installation(claude_dir: str) -> Dict[str, Any]:
    """
    Verify an existing installation.
    
    Args:
        claude_dir: Claude Code directory path
        
    Returns:
        Dictionary containing verification results
    """
    installer = HookInstaller(
        hooks_source_dir="",  # Not needed for validation
        claude_dir=claude_dir
    )
    
    return installer.validate_installation()


def validate_existing_settings(claude_dir: str) -> Dict[str, Any]:
    """
    Validate an existing settings.json file.
    
    Args:
        claude_dir: Claude Code directory path
        
    Returns:
        Dictionary containing validation results
    """
    settings_path = Path(claude_dir) / "settings.json"
    
    validation_result = {
        "success": False,
        "settings_found": False,
        "validation_passed": False,
        "errors": []
    }
    
    # Check if settings file exists
    if not settings_path.exists():
        validation_result["errors"].append(f"Settings file not found: {settings_path}")
        return validation_result
    
    validation_result["settings_found"] = True
    
    # Load and validate settings
    try:
        with open(settings_path, 'r') as f:
            settings = json.load(f)
        
        # Validate the settings
        validate_settings_json(settings)
        
        validation_result["validation_passed"] = True
        validation_result["success"] = True
        logger.info(f"Settings validation successful: {settings_path}")
        
    except json.JSONDecodeError as e:
        validation_result["errors"].append(f"Invalid JSON in settings file: {e}")
    except SettingsValidationError as e:
        validation_result["errors"].append(f"Settings validation failed: {e}")
    except Exception as e:
        validation_result["errors"].append(f"Unexpected error during validation: {e}")
    
    return validation_result


def main():
    """Main entry point for the installation script."""
    parser = argparse.ArgumentParser(
        description="Install Claude Code observability hooks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--claude-dir",
        help="Claude Code directory path (default: auto-detect)"
    )
    
    parser.add_argument(
        "--project-root", 
        help="Project root directory (default: current directory)"
    )
    
    parser.add_argument(
        "--hooks-dir",
        default=str(Path(__file__).parent.parent),
        help="Hooks source directory (default: parent of scripts directory)"
    )
    
    parser.add_argument(
        "--use-uv",
        action="store_true",
        help="Use UV package manager instead of pip"
    )
    
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup of existing settings"
    )
    
    parser.add_argument(
        "--validate-only",
        action="store_true", 
        help="Only validate existing installation"
    )
    
    parser.add_argument(
        "--validate-settings",
        action="store_true",
        help="Only validate existing settings.json file"
    )
    
    parser.add_argument(
        "--no-test-db",
        action="store_true",
        help="Skip database connection test"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Determine Claude directory
        claude_dir = args.claude_dir or find_claude_directory()
        logger.info(f"Using Claude directory: {claude_dir}")
        
        # Validation-only mode
        if args.validate_only:
            logger.info("Validating existing installation...")
            result = verify_installation(claude_dir)
            
            if result["success"]:
                print("✅ Installation validation successful!")
                print(f"   Hooks found: {result['hooks_copied']}")
                print(f"   Executable hooks: {result['executable_hooks']}")
                print(f"   Settings updated: {result['settings_updated']}")
            else:
                print("❌ Installation validation failed!")
                for error in result["errors"]:
                    print(f"   Error: {error}")
                sys.exit(1)
            
            return
        
        # Settings validation-only mode
        if args.validate_settings:
            logger.info("Validating existing settings.json...")
            result = validate_existing_settings(claude_dir)
            
            if result["success"]:
                print("✅ Settings validation successful!")
                print(f"   Settings found: {result['settings_found']}")
                print(f"   Validation passed: {result['validation_passed']}")
            else:
                print("❌ Settings validation failed!")
                for error in result["errors"]:
                    print(f"   Error: {error}")
                sys.exit(1)
            
            return
        
        # Full installation
        logger.info("Starting Claude Code hooks installation...")
        
        installer = HookInstaller(
            hooks_source_dir=args.hooks_dir,
            claude_dir=claude_dir,
            project_root=args.project_root
        )
        
        result = installer.install(
            create_backup=not args.no_backup,
            test_database=not args.no_test_db
        )
        
        # Display results
        if result["success"]:
            print("✅ Installation completed successfully!")
            print(f"   Hooks installed: {result['hooks_installed']}")
            print(f"   Settings updated: {result['settings_updated']}")
            
            if result.get("backup_created"):
                print(f"   Backup created: {result['backup_created']}")
            
            if result.get("database_test"):
                db_test = result["database_test"]
                if db_test.get("success"):
                    print(f"   Database test: ✅ Connected ({db_test.get('status')})")
                else:
                    print(f"   Database test: ⚠️  Failed ({db_test.get('error', 'Unknown error')})")
            
            print("\n🎉 Claude Code hooks are now active!")
            print("   You can now use Claude Code and the hooks will capture observability data.")
            
        else:
            print("❌ Installation failed!")
            for error in result["errors"]:
                print(f"   Error: {error}")
            sys.exit(1)
    
    except InstallationError as e:
        logger.error(f"Installation error: {e}")
        print(f"❌ Installation failed: {e}")
        sys.exit(1)
    
    except KeyboardInterrupt:
        logger.info("Installation cancelled by user")
        print("\n⚠️  Installation cancelled")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()