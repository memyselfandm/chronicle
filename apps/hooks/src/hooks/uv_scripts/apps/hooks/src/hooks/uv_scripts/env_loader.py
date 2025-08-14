#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Environment Variable Loader for Chronicle UV Scripts

This module provides functionality to load environment variables from multiple locations,
supporting both development and installed environments.
"""

import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


def find_env_file() -> Optional[Path]:
    """
    Find .env file in multiple locations following precedence order.
    
    Search order:
    1. Current working directory (development)
    2. Script's parent directory
    3. ~/.claude/hooks/chronicle/.env (installed location)
    4. Parent directories up to 3 levels
    5. CHRONICLE_ENV_PATH environment variable
    
    Returns:
        Path to .env file if found, None otherwise
    """
    search_paths: List[Path] = []
    
    # 1. Current working directory
    cwd = Path.cwd()
    search_paths.append(cwd / '.env')
    
    # 2. Script's parent directory
    script_path = Path(__file__).resolve()
    script_parent = script_path.parent
    search_paths.append(script_parent / '.env')
    
    # 3. Chronicle installation directory
    chronicle_dir = Path.home() / '.claude' / 'hooks' / 'chronicle'
    search_paths.append(chronicle_dir / '.env')
    
    # 4. Parent directories (up to 3 levels)
    current = script_parent
    for _ in range(3):
        current = current.parent
        search_paths.append(current / '.env')
        if current == current.parent:  # Reached root
            break
    
    # 5. Custom path from environment variable
    custom_path = os.getenv('CHRONICLE_ENV_PATH')
    if custom_path:
        search_paths.append(Path(custom_path))
    
    # Check each path
    for path in search_paths:
        if path.exists() and path.is_file():
            logger.debug(f"Found .env file at: {path}")
            return path
    
    return None


def load_chronicle_env() -> Dict[str, str]:
    """
    Load environment variables for Chronicle with fallback support.
    
    Returns:
        Dictionary of loaded environment variables
    """
    loaded_vars = {}
    
    try:
        from dotenv import load_dotenv, dotenv_values
        
        # Find .env file
        env_path = find_env_file()
        
        if env_path:
            # Load variables from file
            loaded_vars = dotenv_values(env_path)
            load_dotenv(env_path, override=True)
            logger.info(f"Loaded environment from: {env_path}")
        else:
            logger.warning("No .env file found in any search location")
            
        # Apply defaults for critical variables if not set
        defaults = {
            'CLAUDE_HOOKS_DB_PATH': str(Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data' / 'chronicle.db'),
            'CLAUDE_HOOKS_LOG_LEVEL': 'INFO',
            'CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS': '100',
            'CLAUDE_HOOKS_ENABLED': 'true',
        }
        
        for key, default_value in defaults.items():
            if not os.getenv(key):
                os.environ[key] = default_value
                loaded_vars[key] = default_value
                logger.debug(f"Set default for {key}: {default_value}")
                
    except ImportError:
        logger.error("python-dotenv not available, using system environment only")
        
    return loaded_vars


def get_database_config() -> Dict[str, Any]:
    """
    Get database configuration with proper paths for chronicle installation.
    
    Returns:
        Dictionary with database configuration
    """
    # Ensure environment is loaded
    load_chronicle_env()
    
    # Determine if we're in installed location
    script_path = Path(__file__).resolve()
    is_installed = '.claude/hooks/chronicle' in str(script_path)
    
    # Set database path based on location
    if is_installed:
        # Use chronicle data directory in installation
        data_dir = Path.home() / '.claude' / 'hooks' / 'chronicle' / 'data'
        data_dir.mkdir(parents=True, exist_ok=True)
        default_db_path = str(data_dir / 'chronicle.db')
    else:
        # Development mode - use project directory
        default_db_path = str(Path.cwd() / 'data' / 'chronicle.db')
    
    # Get configuration
    config = {
        'supabase_url': os.getenv('SUPABASE_URL'),
        'supabase_key': os.getenv('SUPABASE_ANON_KEY'),
        'sqlite_path': os.getenv('CLAUDE_HOOKS_DB_PATH', default_db_path),
        'db_timeout': int(os.getenv('CLAUDE_HOOKS_DB_TIMEOUT', '30')),
        'retry_attempts': int(os.getenv('CLAUDE_HOOKS_DB_RETRY_ATTEMPTS', '3')),
        'retry_delay': float(os.getenv('CLAUDE_HOOKS_DB_RETRY_DELAY', '1.0')),
    }
    
    # Ensure SQLite directory exists
    sqlite_path = Path(config['sqlite_path'])
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    
    return config


def validate_environment() -> bool:
    """
    Validate that required environment variables are properly set.
    
    Returns:
        True if environment is valid, False otherwise
    """
    load_chronicle_env()
    
    required_vars = []  # No strictly required vars, but we can add them if needed
    optional_but_recommended = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'CLAUDE_HOOKS_DB_PATH',
    ]
    
    all_valid = True
    
    # Check required variables
    for var in required_vars:
        if not os.getenv(var):
            logger.error(f"Required environment variable not set: {var}")
            all_valid = False
    
    # Check recommended variables
    for var in optional_but_recommended:
        if not os.getenv(var):
            logger.warning(f"Recommended environment variable not set: {var}")
    
    # Validate database connectivity
    db_config = get_database_config()
    if not db_config['supabase_url'] and not db_config['sqlite_path']:
        logger.error("No database configuration found (neither Supabase nor SQLite)")
        all_valid = False
    
    return all_valid


def main():
    """Test environment loading functionality."""
    import json
    
    print("Chronicle Environment Loader Test")
    print("-" * 50)
    
    # Load environment
    loaded_vars = load_chronicle_env()
    print(f"\nLoaded {len(loaded_vars)} environment variables")
    
    # Get database config
    db_config = get_database_config()
    print("\nDatabase Configuration:")
    print(json.dumps(db_config, indent=2))
    
    # Validate environment
    is_valid = validate_environment()
    print(f"\nEnvironment validation: {'PASSED' if is_valid else 'FAILED'}")
    
    # Show search paths
    print("\nEnvironment file search paths:")
    env_path = find_env_file()
    if env_path:
        print(f"Using: {env_path}")
    else:
        print("No .env file found")


if __name__ == "__main__":
    main()