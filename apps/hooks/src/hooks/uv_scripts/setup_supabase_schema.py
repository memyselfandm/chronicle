#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "supabase>=2.0.0",
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Setup Supabase Schema for Chronicle

This script creates the necessary tables in Supabase for the Chronicle
observability system. Run this once to set up your Supabase instance.
"""

import os
import sys
import logging
from typing import Optional

# Load environment
try:
    from env_loader import load_chronicle_env, get_database_config
    load_chronicle_env()
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()

# Supabase client
try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed. Run: pip install supabase")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_supabase_client() -> Optional[Client]:
    """Get Supabase client from environment."""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY required")
        return None
    
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {e}")
        return None


def create_chronicle_schema(client: Client) -> bool:
    """Create Chronicle schema in Supabase."""
    
    # SQL schema for PostgreSQL
    schema_sql = """
    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claude_session_id TEXT UNIQUE NOT NULL,
        start_time TIMESTAMPTZ DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        project_path TEXT,
        git_branch TEXT,
        git_commit TEXT,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        hook_event_name TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        data JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Tool events table
    CREATE TABLE IF NOT EXISTS tool_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        tool_name TEXT NOT NULL,
        tool_type TEXT,
        phase TEXT CHECK (phase IN ('pre', 'post')),
        parameters JSONB,
        result JSONB,
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Prompt events table
    CREATE TABLE IF NOT EXISTS prompt_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        prompt_text TEXT,
        prompt_length INTEGER,
        complexity_score REAL,
        intent_classification TEXT,
        context_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tool_events_session_id ON tool_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_tool_events_tool_name ON tool_events(tool_name);
    CREATE INDEX IF NOT EXISTS idx_prompt_events_session_id ON prompt_events(session_id);

    -- Create updated_at trigger for sessions
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE
        ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """
    
    try:
        # Note: Supabase Python client doesn't directly support raw SQL execution
        # You'll need to use the Supabase SQL Editor or connect directly with psycopg2
        logger.warning("Direct SQL execution not supported via Supabase Python client.")
        logger.info("Please execute the following SQL in your Supabase SQL Editor:")
        print("\n" + "="*60)
        print(schema_sql)
        print("="*60 + "\n")
        
        # Try to verify if tables exist
        try:
            # Test query to sessions table
            result = client.table('sessions').select('id').limit(1).execute()
            logger.info("✓ Sessions table exists")
        except Exception as e:
            logger.warning("✗ Sessions table does not exist")
        
        try:
            # Test query to events table
            result = client.table('events').select('id').limit(1).execute()
            logger.info("✓ Events table exists")
        except Exception as e:
            logger.warning("✗ Events table does not exist")
        
        return True
        
    except Exception as e:
        logger.error(f"Error creating schema: {e}")
        return False


def verify_schema(client: Client):
    """Verify that all required tables exist."""
    tables = ['sessions', 'events', 'tool_events', 'prompt_events']
    
    print("\nVerifying Chronicle schema...")
    all_exist = True
    
    for table in tables:
        try:
            result = client.table(table).select('id').limit(1).execute()
            print(f"✓ Table '{table}' exists")
        except Exception as e:
            print(f"✗ Table '{table}' does not exist")
            all_exist = False
    
    if all_exist:
        print("\n✓ All Chronicle tables are properly set up!")
    else:
        print("\n⚠ Some tables are missing. Please run the SQL schema above in your Supabase SQL Editor.")


def main():
    """Main setup function."""
    print("Chronicle Supabase Schema Setup")
    print("-" * 50)
    
    # Get Supabase client
    client = get_supabase_client()
    if not client:
        print("Failed to connect to Supabase. Please check your environment variables:")
        print("- SUPABASE_URL")
        print("- SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)")
        sys.exit(1)
    
    # Create schema
    create_chronicle_schema(client)
    
    # Verify schema
    verify_schema(client)
    
    print("\nSetup complete!")


if __name__ == "__main__":
    main()