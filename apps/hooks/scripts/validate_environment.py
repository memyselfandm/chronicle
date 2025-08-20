#!/usr/bin/env python3
"""
Validate Chronicle hooks environment configuration.

This script checks all required environment variables and database
configurations to ensure the hooks system is properly set up.
"""

import os
import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.lib.database import validate_environment, DatabaseManager


def print_validation_results(results):
    """Pretty print validation results."""
    print("\n" + "=" * 60)
    print("Chronicle Hooks Environment Validation")
    print("=" * 60)
    
    # Overall status
    if results["overall_valid"]:
        print("\n✅ Overall Status: VALID")
    else:
        print("\n❌ Overall Status: INVALID")
    
    # Warnings
    if results["warnings"]:
        print("\n⚠️  Warnings:")
        for warning in results["warnings"]:
            print(f"   - {warning}")
    
    # Supabase Configuration
    print("\n📊 Supabase Configuration:")
    if results["supabase"]["configured"]:
        if results["supabase"]["valid"]:
            print("   ✅ Configured and valid")
        else:
            print("   ❌ Configured but has errors:")
            for error in results["supabase"]["errors"]:
                print(f"      - {error}")
    else:
        print("   ⚠️  Not configured (will use SQLite fallback)")
    
    # SQLite Configuration
    print("\n💾 SQLite Configuration:")
    if results["sqlite"]["valid"]:
        print("   ✅ Valid")
        print(f"   📁 Database path: {results['sqlite']['path']}")
    else:
        print("   ❌ Invalid:")
        for error in results["sqlite"]["errors"]:
            print(f"      - {error}")
    
    print("\n" + "=" * 60)


def test_database_connection():
    """Test actual database connections."""
    print("\n🔍 Testing Database Connections...")
    
    try:
        dm = DatabaseManager()
        status = dm.get_status()
        
        print(f"\n📊 Primary Database: {status['primary_database']}")
        
        # Test connection
        if dm.test_connection():
            print("✅ Database connection test: PASSED")
        else:
            print("❌ Database connection test: FAILED")
        
        # Show detailed status
        if status["supabase"]["has_client"]:
            print("\nSupabase Status:")
            print(f"  - Has client: {status['supabase']['has_client']}")
            print(f"  - Is healthy: {status['supabase']['is_healthy']}")
            print(f"  - URL: {status['supabase']['url']}")
        
        if status["sqlite"]["exists"]:
            print("\nSQLite Status:")
            print(f"  - Database exists: {status['sqlite']['exists']}")
            print(f"  - Is healthy: {status['sqlite']['is_healthy']}")
            print(f"  - Path: {status['sqlite']['database_path']}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error testing database: {e}")
        return False


def check_required_directories():
    """Check if required directories exist and are writable."""
    print("\n📁 Checking Required Directories...")
    
    directories = [
        ("~/.claude", "Claude configuration directory"),
        ("~/.claude/hooks", "Hooks directory"),
    ]
    
    all_good = True
    for dir_path, description in directories:
        expanded_path = os.path.expanduser(dir_path)
        path = Path(expanded_path)
        
        if path.exists():
            if os.access(expanded_path, os.W_OK):
                print(f"✅ {description}: {expanded_path} (writable)")
            else:
                print(f"❌ {description}: {expanded_path} (not writable)")
                all_good = False
        else:
            try:
                path.mkdir(parents=True, exist_ok=True)
                print(f"✅ {description}: {expanded_path} (created)")
            except Exception as e:
                print(f"❌ {description}: {expanded_path} (cannot create: {e})")
                all_good = False
    
    return all_good


def check_python_dependencies():
    """Check if required Python packages are installed."""
    print("\n📦 Checking Python Dependencies...")
    
    dependencies = [
        ("supabase", "Supabase client (optional)", False),
        ("dotenv", "Environment variable loader (optional)", False),
        ("sqlite3", "SQLite database (required)", True),
        ("json", "JSON parser (required)", True),
        ("uuid", "UUID generator (required)", True),
    ]
    
    all_required_present = True
    for module_name, description, required in dependencies:
        try:
            if module_name == "sqlite3":
                import sqlite3
            elif module_name == "dotenv":
                import dotenv
            elif module_name == "supabase":
                import supabase
            else:
                __import__(module_name)
            print(f"✅ {description}: Installed")
        except ImportError:
            if required:
                print(f"❌ {description}: Not installed")
                all_required_present = False
            else:
                print(f"⚠️  {description}: Not installed")
    
    return all_required_present


def main():
    """Run environment validation."""
    print("🚀 Chronicle Hooks Environment Validator v1.0")
    
    # Check Python version
    print(f"\n🐍 Python Version: {sys.version.split()[0]}")
    if sys.version_info < (3, 7):
        print("❌ Python 3.7+ required")
        sys.exit(1)
    else:
        print("✅ Python version OK")
    
    # Validate environment variables
    validation_results = validate_environment()
    print_validation_results(validation_results)
    
    # Check directories
    dirs_ok = check_required_directories()
    
    # Check dependencies
    deps_ok = check_python_dependencies()
    
    # Test database connection
    db_ok = test_database_connection()
    
    # Final summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    all_ok = validation_results["overall_valid"] and dirs_ok and deps_ok and db_ok
    
    if all_ok:
        print("\n✅ All checks passed! Chronicle hooks are ready to use.")
        print("\nNext steps:")
        print("1. If using Supabase, ensure schema is set up")
        print("2. Install hooks with: python scripts/install.py")
        print("3. Start using Claude Code with observability!")
        sys.exit(0)
    else:
        print("\n❌ Some checks failed. Please fix the issues above.")
        print("\nFor help, see the documentation or run:")
        print("  python scripts/setup_schema.py")
        sys.exit(1)


if __name__ == "__main__":
    main()