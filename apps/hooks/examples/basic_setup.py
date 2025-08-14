#!/usr/bin/env python3
"""
Basic Chronicle Hooks Setup Example

Demonstrates how to set up Chronicle hooks for a typical project.
"""

import os
import sys
from pathlib import Path

# Add the core directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "core"))

from database import DatabaseManager


def setup_chronicle_hooks():
    """Example function showing how to configure Chronicle hooks."""
    
    print("🚀 Chronicle Hooks Basic Setup Example")
    print("=" * 50)
    
    # 1. Set up environment variables
    print("\n1. Setting up environment variables...")
    
    # Example Supabase configuration
    # In real usage, you'd set these in your shell profile or .env file
    os.environ["SUPABASE_URL"] = "https://your-project.supabase.co"
    os.environ["SUPABASE_ANON_KEY"] = "your-anon-key-here"
    
    # Optional: Set custom database path for SQLite fallback
    os.environ["CLAUDE_HOOKS_DB_PATH"] = "~/.claude/my_project_hooks.db"
    
    print("✅ Environment variables configured")
    
    # 2. Test database connection
    print("\n2. Testing database connection...")
    
    try:
        db_manager = DatabaseManager()
        connection_test = db_manager.test_connection()
        
        if connection_test:
            print("✅ Database connection successful")
            
            # Show connection status
            status = db_manager.get_status()
            print(f"   Supabase available: {status['supabase']['has_client']}")
            print(f"   SQLite fallback: {status['sqlite_fallback_enabled']}")
            
        else:
            print("⚠️ Database connection failed - hooks will use fallback")
            
    except Exception as e:
        print(f"❌ Database setup error: {e}")
    
    # 3. Installation instructions
    print("\n3. Next steps for installation:")
    print("   Run the installation script:")
    print("   python scripts/install.py")
    print()
    print("   Or with custom options:")
    print("   python scripts/install.py --claude-dir ~/.claude --verbose")
    
    print("\n🎉 Basic setup complete!")
    print("After running install.py, your Claude Code sessions will")
    print("automatically capture observability data to Chronicle.")


if __name__ == "__main__":
    setup_chronicle_hooks()