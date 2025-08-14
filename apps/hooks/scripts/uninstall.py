#!/usr/bin/env python3
"""
Chronicle Hooks Uninstallation Script

This script cleanly removes Chronicle hooks installation by:
1. Removing the chronicle subfolder from ~/.claude/hooks/
2. Cleaning up hook entries from settings.json
3. Creating a backup of settings before modification
4. Optionally preserving user data

Usage:
    python uninstall.py [options]
    
Options:
    --claude-dir PATH    Specify Claude Code directory (default: auto-detect)
    --preserve-data      Keep chronicle data and logs (only remove hooks)
    --no-backup         Skip backup of settings.json
    --force             Force uninstall without confirmation
    --verbose           Enable verbose output
"""

import argparse
import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class UninstallationError(Exception):
    """Custom exception for uninstallation-related errors."""
    pass


def find_claude_directory() -> Optional[Path]:
    """
    Find the Claude Code directory.
    
    Returns:
        Path to Claude directory or None if not found
    """
    # Check common locations
    locations = [
        Path.home() / ".claude",
        Path.cwd() / ".claude"
    ]
    
    for location in locations:
        if location.exists() and location.is_dir():
            logger.debug(f"Found Claude directory at: {location}")
            return location
    
    return None


def backup_settings(settings_path: Path) -> Optional[Path]:
    """
    Create a backup of settings.json before modification.
    
    Args:
        settings_path: Path to settings.json
        
    Returns:
        Path to backup file or None if backup failed
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = settings_path.parent / f"settings.json.backup_{timestamp}"
        shutil.copy2(settings_path, backup_path)
        logger.info(f"Created backup: {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"Failed to create backup: {e}")
        return None


def clean_settings_json(settings_path: Path) -> bool:
    """
    Remove Chronicle hook entries from settings.json.
    
    Args:
        settings_path: Path to settings.json
        
    Returns:
        True if cleaning was successful
    """
    try:
        with open(settings_path, 'r') as f:
            settings = json.load(f)
        
        # Remove chronicle-specific metadata
        if "_chronicle_hooks_info" in settings:
            del settings["_chronicle_hooks_info"]
            logger.info("Removed chronicle metadata from settings")
        
        # Clean up hook entries
        if "hooks" in settings:
            for event_name, event_configs in list(settings["hooks"].items()):
                if isinstance(event_configs, list):
                    # Filter out chronicle hooks
                    cleaned_configs = []
                    for config in event_configs:
                        if "hooks" in config and isinstance(config["hooks"], list):
                            # Keep only non-chronicle hooks
                            non_chronicle_hooks = []
                            for hook in config["hooks"]:
                                if "command" in hook and isinstance(hook["command"], str):
                                    if "/chronicle/" not in hook["command"]:
                                        non_chronicle_hooks.append(hook)
                            
                            if non_chronicle_hooks:
                                config["hooks"] = non_chronicle_hooks
                                cleaned_configs.append(config)
                    
                    # Update or remove the event configuration
                    if cleaned_configs:
                        settings["hooks"][event_name] = cleaned_configs
                    else:
                        del settings["hooks"][event_name]
            
            # Remove hooks section if empty
            if not settings["hooks"]:
                del settings["hooks"]
        
        # Write cleaned settings
        with open(settings_path, 'w') as f:
            json.dump(settings, f, indent=2)
        
        logger.info("Successfully cleaned settings.json")
        return True
        
    except Exception as e:
        logger.error(f"Failed to clean settings.json: {e}")
        return False


def uninstall_chronicle(claude_dir: Path, preserve_data: bool = False) -> Dict[str, Any]:
    """
    Perform the complete uninstallation process.
    
    Args:
        claude_dir: Path to Claude directory
        preserve_data: Whether to preserve data and logs
        
    Returns:
        Dictionary containing uninstallation results
    """
    result = {
        "success": False,
        "chronicle_removed": False,
        "settings_cleaned": False,
        "data_preserved": preserve_data,
        "errors": []
    }
    
    chronicle_dir = claude_dir / "hooks" / "chronicle"
    settings_path = claude_dir / "settings.json"
    
    # Check if chronicle is installed
    if not chronicle_dir.exists():
        result["errors"].append("Chronicle installation not found")
        logger.warning("No Chronicle installation found to uninstall")
        return result
    
    try:
        # Clean settings.json first
        if settings_path.exists():
            if clean_settings_json(settings_path):
                result["settings_cleaned"] = True
            else:
                result["errors"].append("Failed to clean settings.json")
        
        # Remove chronicle directory
        if preserve_data:
            # Only remove hooks, keep data and logs
            hooks_dir = chronicle_dir / "hooks"
            if hooks_dir.exists():
                shutil.rmtree(hooks_dir)
                logger.info("Removed hooks directory (preserved data and logs)")
            
            # Remove config files but keep data
            for file in ["README.md", "config.json", ".env", ".env.example"]:
                file_path = chronicle_dir / file
                if file_path.exists():
                    file_path.unlink()
                    logger.debug(f"Removed {file}")
        else:
            # Remove entire chronicle directory
            shutil.rmtree(chronicle_dir)
            logger.info("Removed entire chronicle directory")
        
        result["chronicle_removed"] = True
        result["success"] = not result["errors"]
        
    except Exception as e:
        error_msg = f"Uninstallation failed: {e}"
        result["errors"].append(error_msg)
        logger.error(error_msg)
    
    return result


def main():
    """Main entry point for the uninstallation script."""
    parser = argparse.ArgumentParser(
        description="Uninstall Chronicle hooks from Claude Code",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--claude-dir",
        help="Claude Code directory path (default: auto-detect)",
        type=str
    )
    parser.add_argument(
        "--preserve-data",
        action="store_true",
        help="Keep chronicle data and logs (only remove hooks)"
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup of settings.json"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force uninstall without confirmation"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Find Claude directory
    if args.claude_dir:
        claude_dir = Path(args.claude_dir)
    else:
        claude_dir = find_claude_directory()
        if not claude_dir:
            logger.error("Could not find Claude directory. Please specify with --claude-dir")
            sys.exit(1)
    
    logger.info(f"Using Claude directory: {claude_dir}")
    
    # Check chronicle installation
    chronicle_dir = claude_dir / "hooks" / "chronicle"
    if not chronicle_dir.exists():
        logger.info("No Chronicle installation found.")
        sys.exit(0)
    
    # Confirm uninstallation
    if not args.force:
        print("\n🗑️  Chronicle Hooks Uninstaller")
        print(f"   This will remove Chronicle hooks from: {claude_dir}")
        if args.preserve_data:
            print("   Data and logs will be preserved")
        else:
            print("   ⚠️  All Chronicle data will be permanently deleted")
        
        response = input("\nProceed with uninstallation? [y/N]: ")
        if response.lower() != 'y':
            print("Uninstallation cancelled.")
            sys.exit(0)
    
    # Create backup if requested
    settings_path = claude_dir / "settings.json"
    if not args.no_backup and settings_path.exists():
        backup_path = backup_settings(settings_path)
        if not backup_path:
            logger.warning("Failed to create backup, continuing anyway...")
    
    # Perform uninstallation
    print("\n🔧 Uninstalling Chronicle hooks...")
    result = uninstall_chronicle(claude_dir, args.preserve_data)
    
    # Display results
    if result["success"]:
        print("\n✅ Uninstallation completed successfully!")
        if result["chronicle_removed"]:
            print("   Chronicle directory removed")
        if result["settings_cleaned"]:
            print("   Settings.json cleaned")
        if result["data_preserved"]:
            print("   Data and logs preserved")
    else:
        print("\n❌ Uninstallation completed with errors:")
        for error in result["errors"]:
            print(f"   - {error}")
    
    print("\n👋 Chronicle hooks have been uninstalled.")
    if not args.no_backup and settings_path.exists():
        print(f"   Settings backup: {backup_path}")


if __name__ == "__main__":
    main()