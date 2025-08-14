"""
Database module compatibility layer.

This module provides backward compatibility for imports that expect
'src.database' instead of 'src.core.database'.
"""

# Re-export DatabaseManager and SupabaseClient from the core module
from .core.database import DatabaseManager, SupabaseClient

def setup_schema_and_verify():
    """
    Convenience function to set up schema and verify it works.
    
    Returns:
        bool: True if setup and verification successful
    """
    try:
        print("🚀 Starting Chronicle database schema setup...")
        dm = DatabaseManager()
        result = dm.setup_schema()
        
        if result:
            status = dm.get_status()
            print("✅ Schema setup completed successfully!")
            
            # Show what type of database was set up
            if status['supabase']['has_client']:
                print("📊 Using Supabase (PostgreSQL) database")
            elif status['sqlite_fallback_enabled'] and status['connection_test_passed']:
                print("📊 Using SQLite fallback database")
                print(f"📁 Database location: {status['sqlite_path']}")
            
            # Test the connection
            if dm.test_connection():
                print("✅ Database connection test passed")
            else:
                print("⚠️  Database connection test failed")
            
            return True
        else:
            print("❌ Schema setup failed")
            return False
            
    except Exception as e:
        print(f"❌ Schema setup error: {e}")
        return False

__all__ = ["DatabaseManager", "SupabaseClient", "setup_schema_and_verify"]