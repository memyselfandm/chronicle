#!/usr/bin/env python3
"""
Chronicle Database Schema Setup Script

Sets up the required database schema in Supabase.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("❌ Supabase library not available. Run: uv add supabase")
    sys.exit(1)


def setup_schema():
    """Set up Chronicle database schema."""
    
    print("🗄️ Chronicle Database Schema Setup")
    print("=" * 50)
    
    # Get Supabase credentials
    url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not url or not service_key:
        print("❌ Missing Supabase credentials!")
        print("Required environment variables:")
        print("- SUPABASE_URL")
        print("- SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)")
        return False
    
    print(f"🔗 Connecting to: {url}")
    
    try:
        # Create Supabase client
        supabase = create_client(url, service_key)
        print("✅ Connected to Supabase")
        
        # Read schema SQL
        schema_file = Path(__file__).parent.parent / "config" / "schema.sql"
        if not schema_file.exists():
            print(f"❌ Schema file not found: {schema_file}")
            return False
        
        with open(schema_file, 'r') as f:
            schema_sql = f.read()
        
        print("📝 Executing schema SQL...")
        
        # Split SQL by statements and execute each one
        statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]
        
        for i, statement in enumerate(statements, 1):
            if statement.lower().startswith(('create', 'alter', 'drop', 'insert')):
                try:
                    # Use the RPC function to execute raw SQL
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"✅ Statement {i}/{len(statements)} executed successfully")
                except Exception as e:
                    # Some statements might fail if objects already exist
                    if 'already exists' in str(e).lower():
                        print(f"⚠️ Statement {i}/{len(statements)} - object already exists (skipping)")
                    else:
                        print(f"❌ Statement {i}/{len(statements)} failed: {e}")
        
        print("\n🎉 Schema setup complete!")
        
        # Test the schema by querying the sessions table
        try:
            result = supabase.table('sessions').select('count', count='exact').limit(0).execute()
            print(f"✅ Sessions table accessible (count: {result.count})")
            
            result = supabase.table('events').select('count', count='exact').limit(0).execute() 
            print(f"✅ Events table accessible (count: {result.count})")
            
        except Exception as e:
            print(f"⚠️ Schema verification failed: {e}")
            print("💡 You may need to run the SQL manually in your Supabase dashboard")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        print("\n💡 Manual Setup Instructions:")
        print(f"1. Open your Supabase dashboard: {url.replace('/rest/v1', '')}")
        print("2. Go to SQL Editor")
        print(f"3. Run the SQL from: {schema_file}")
        return False


def show_manual_instructions():
    """Show manual schema setup instructions."""
    schema_file = Path(__file__).parent.parent / "config" / "schema.sql"
    
    print("\n🔧 Manual Schema Setup:")
    print("=" * 50)
    print("1. Open your Supabase dashboard")
    print("2. Navigate to SQL Editor")
    print("3. Copy and run the following SQL:")
    print(f"\n📄 From file: {schema_file}")
    
    if schema_file.exists():
        print("\n" + "─" * 50)
        with open(schema_file, 'r') as f:
            print(f.read())
        print("─" * 50)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Set up Chronicle database schema")
    parser.add_argument("--manual", action="store_true", help="Show manual setup instructions")
    parser.add_argument("--test-only", action="store_true", help="Only test connection, don't modify schema")
    
    args = parser.parse_args()
    
    if args.manual:
        show_manual_instructions()
    elif args.test_only:
        url = os.getenv('SUPABASE_URL', 'NOT SET')
        print(f"🔗 Testing connection to: {url}")
        if url != 'NOT SET':
            try:
                from supabase import create_client
                load_dotenv()
                client = create_client(url, os.getenv('SUPABASE_ANON_KEY'))
                result = client.table('sessions').select('count').limit(0).execute()
                print("✅ Connection successful - schema already exists!")
            except Exception as e:
                print(f"❌ Connection test failed: {e}")
        else:
            print("❌ SUPABASE_URL not configured")
    else:
        success = setup_schema()
        if not success:
            show_manual_instructions()
        sys.exit(0 if success else 1)