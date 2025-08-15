#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "colorama>=0.4.6",
# ]
# ///
"""
Test Database Operations for Chronicle

This script tests database connectivity and operations for both
Supabase and SQLite fallback modes.
"""

import os
import sys
import uuid
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Color output support
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    # Fallback for no colors
    class Fore:
        GREEN = RED = YELLOW = BLUE = CYAN = ""
    class Style:
        BRIGHT = RESET_ALL = ""

# Load environment and database manager
try:
    from env_loader import load_chronicle_env, get_database_config
    from database_manager import DatabaseManager
    load_chronicle_env()
except ImportError:
    print(f"{Fore.RED}Error: Cannot import env_loader or database_manager")
    print("Make sure you're running from the correct directory")
    sys.exit(1)


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Fore.CYAN}{Style.BRIGHT}{'='*60}")
    print(f"{Fore.CYAN}{Style.BRIGHT}{text}")
    print(f"{Fore.CYAN}{Style.BRIGHT}{'='*60}")


def print_success(text: str):
    """Print success message."""
    print(f"{Fore.GREEN}✓ {text}")


def print_error(text: str):
    """Print error message."""
    print(f"{Fore.RED}✗ {text}")


def print_info(text: str):
    """Print info message."""
    print(f"{Fore.BLUE}ℹ {text}")


def test_environment_loading():
    """Test environment variable loading."""
    print_header("Testing Environment Loading")
    
    config = get_database_config()
    
    print(f"Database Configuration:")
    print(f"  SQLite Path: {config['sqlite_path']}")
    print(f"  Supabase URL: {config['supabase_url'] or 'Not configured'}")
    print(f"  Has Supabase Key: {'Yes' if config['supabase_key'] else 'No'}")
    
    # Check if running from installed location
    script_path = os.path.abspath(__file__)
    if '.claude/hooks/chronicle' in script_path:
        print_success("Running from Chronicle installation directory")
    else:
        print_info("Running from development directory")
    
    return config


def test_database_connectivity():
    """Test database connectivity."""
    print_header("Testing Database Connectivity")
    
    db = DatabaseManager()
    status = db.get_connection_status()
    
    print("Connection Status:")
    for key, value in status.items():
        if 'supabase' in key:
            if value:
                print_success(f"{key}: {value}")
            else:
                print_info(f"{key}: {value}")
        else:
            print(f"  {key}: {value}")
    
    return db, status


def test_session_operations(db: DatabaseManager):
    """Test session CRUD operations."""
    print_header("Testing Session Operations")
    
    # Create test session
    test_session = {
        "claude_session_id": f"test_session_{uuid.uuid4()}",
        "start_time": datetime.now().isoformat(),
        "project_path": os.getcwd(),
        "git_branch": "test_branch",
        "git_commit": "abc123",
        "source": "test_script",
    }
    
    # Save session
    success, session_id = db.save_session(test_session)
    if success:
        print_success(f"Session created with ID: {session_id}")
    else:
        print_error("Failed to create session")
        return None
    
    # Retrieve session
    retrieved = db.get_session(test_session["claude_session_id"])
    if retrieved:
        print_success("Session retrieved successfully")
        print(f"  Project Path: {retrieved.get('project_path')}")
        print(f"  Git Branch: {retrieved.get('git_branch')}")
    else:
        print_error("Failed to retrieve session")
    
    return session_id


def test_event_operations(db: DatabaseManager, session_id: str):
    """Test event CRUD operations."""
    print_header("Testing Event Operations")
    
    if not session_id:
        print_error("No session ID available for event testing")
        return
    
    # Create different types of events
    event_types = [
        {
            "event_type": "tool_use",
            "hook_event_name": "PreToolUse",
            "data": {
                "tool_name": "Edit",
                "parameters": {"file": "test.py", "content": "print('hello')"}
            }
        },
        {
            "event_type": "user_prompt",
            "hook_event_name": "UserPromptSubmit",
            "data": {
                "prompt": "Test prompt",
                "length": 11
            }
        },
        {
            "event_type": "notification",
            "hook_event_name": "Notification",
            "data": {
                "type": "info",
                "message": "Test notification"
            }
        }
    ]
    
    success_count = 0
    for event_type in event_types:
        event_data = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            **event_type
        }
        
        if db.save_event(event_data):
            success_count += 1
            print_success(f"Created {event_type['event_type']} event")
        else:
            print_error(f"Failed to create {event_type['event_type']} event")
    
    print(f"\nCreated {success_count}/{len(event_types)} events successfully")


def test_sqlite_specific_features(db: DatabaseManager):
    """Test SQLite-specific features."""
    print_header("Testing SQLite-Specific Features")
    
    import sqlite3
    
    try:
        with sqlite3.connect(str(db.sqlite_path)) as conn:
            # Check SQLite version
            cursor = conn.execute("SELECT sqlite_version()")
            version = cursor.fetchone()[0]
            print_info(f"SQLite version: {version}")
            
            # Check database size
            cursor = conn.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
            size = cursor.fetchone()[0]
            print_info(f"Database size: {size:,} bytes")
            
            # Count records
            tables = ['sessions', 'events']
            for table in tables:
                cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table}: {count} records")
            
            print_success("SQLite database is functioning correctly")
            
    except Exception as e:
        print_error(f"SQLite test failed: {e}")


def test_data_persistence():
    """Test that data persists across database manager instances."""
    print_header("Testing Data Persistence")
    
    # Create first instance and save data
    db1 = DatabaseManager()
    test_session = {
        "claude_session_id": f"persistence_test_{uuid.uuid4()}",
        "start_time": datetime.now().isoformat(),
        "project_path": "/test/persistence",
    }
    
    success, session_id = db1.save_session(test_session)
    if not success:
        print_error("Failed to save test session")
        return
    
    # Create new instance and retrieve data
    db2 = DatabaseManager()
    retrieved = db2.get_session(test_session["claude_session_id"])
    
    if retrieved and retrieved.get('project_path') == test_session['project_path']:
        print_success("Data persists across database instances")
    else:
        print_error("Data persistence test failed")


def cleanup_test_data(db: DatabaseManager):
    """Clean up test data."""
    print_header("Cleaning Up Test Data")
    
    import sqlite3
    
    try:
        with sqlite3.connect(str(db.sqlite_path)) as conn:
            # Delete test sessions and their events
            conn.execute("""
                DELETE FROM events 
                WHERE session_id IN (
                    SELECT id FROM sessions 
                    WHERE claude_session_id LIKE 'test_%' 
                    OR claude_session_id LIKE 'persistence_test_%'
                )
            """)
            
            deleted_sessions = conn.execute("""
                DELETE FROM sessions 
                WHERE claude_session_id LIKE 'test_%' 
                OR claude_session_id LIKE 'persistence_test_%'
            """)
            
            conn.commit()
            
            print_success(f"Cleaned up test data")
            
    except Exception as e:
        print_error(f"Cleanup failed: {e}")


def main():
    """Run all database tests."""
    print(f"{Fore.YELLOW}{Style.BRIGHT}Chronicle Database Operations Test Suite")
    print(f"{Fore.YELLOW}{'='*60}\n")
    
    # Run tests
    config = test_environment_loading()
    db, status = test_database_connectivity()
    
    if status['sqlite_exists']:
        session_id = test_session_operations(db)
        if session_id:
            test_event_operations(db, session_id)
        test_sqlite_specific_features(db)
        test_data_persistence()
        
        # Cleanup
        cleanup_test_data(db)
    else:
        print_error("SQLite database not available")
    
    print(f"\n{Fore.GREEN}{Style.BRIGHT}Test suite completed!")


if __name__ == "__main__":
    main()