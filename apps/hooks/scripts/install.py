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
        
        Returns:
            Dictionary containing hook configuration
        """
        hooks_dir = self.claude_dir / "hooks"
        
        # Use $CLAUDE_PROJECT_DIR environment variable in hook paths for portability
        hook_configs = {
            "PreToolUse": [
                {
                    "matcher": "*",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hooks_dir}/pre_tool_use.py",
                            "timeout": 10
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
                            "command": f"{hooks_dir}/post_tool_use.py",
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
                            "command": f"{hooks_dir}/user_prompt_submit.py",
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
                            "command": f"{hooks_dir}/notification.py", 
                            "timeout": 5
                        }
                    ]
                }
            ],
            "SessionStart": [
                {
                    "matcher": "*",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hooks_dir}/session_start.py",
                            "timeout": 10
                        }
                    ]
                }
            ],
            "Stop": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hooks_dir}/stop.py",
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
                            "command": f"{hooks_dir}/subagent_stop.py",
                            "timeout": 5
                        }
                    ]
                }
            ],
            "PreCompact": [
                {
                    "matcher": "*",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{hooks_dir}/pre_compact.py",
                            "timeout": 10
                        }
                    ]
                }
            ]
        }
        
        return hook_configs
    
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
    1. Project-level .claude directory
    2. User-level ~/.claude directory
    
    Returns:
        Path to Claude directory
        
    Raises:
        InstallationError: If no Claude directory found
    """
    # Check project-level first
    project_claude = Path.cwd() / ".claude"
    if project_claude.exists():
        return str(project_claude)
    
    # Check user-level
    user_claude = Path.home() / ".claude"
    if user_claude.exists():
        return str(user_claude)
    
    # Create project-level directory as default
    project_claude.mkdir(parents=True, exist_ok=True)
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