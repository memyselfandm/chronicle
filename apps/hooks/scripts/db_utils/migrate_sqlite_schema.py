#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Migrate SQLite Schema for Chronicle

This script ensures the SQLite database has the complete schema
matching the Supabase/PostgreSQL structure.
"""

import sqlite3
import os
from pathlib import Path

# Load environment
try:
    from env_loader import load_chronicle_env, get_database_config
    load_chronicle_env()
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()


def get_current_schema(conn: sqlite3.Connection) -> dict:
    """Get current database schema."""
    schema = {}
    
    # Get all tables
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    for table in tables:
        # Get table info
        cursor = conn.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        schema[table] = {
            'columns': {col[1]: {'type': col[2], 'nullable': not col[3], 'default': col[4]} 
                       for col in columns},
            'indexes': []
        }
        
        # Get indexes
        cursor = conn.execute(f"PRAGMA index_list({table})")
        indexes = cursor.fetchall()
        for idx in indexes:
            schema[table]['indexes'].append(idx[1])
    
    return schema


def migrate_schema(db_path: str):
    """Migrate SQLite schema to match Supabase structure."""
    print(f"Migrating schema for: {db_path}")
    
    with sqlite3.connect(db_path) as conn:
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON")
        
        # Get current schema
        current = get_current_schema(conn)
        print(f"\nCurrent tables: {list(current.keys())}")
        
        # Check and add missing columns to sessions table
        if 'sessions' in current:
            session_cols = current['sessions']['columns']
            
            # Add updated_at if missing
            if 'updated_at' not in session_cols:
                print("Adding updated_at column to sessions table...")
                conn.execute("""
                    ALTER TABLE sessions 
                    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                """)
        
        # Create missing tables
        tables_sql = {
            'notification_events': '''
                CREATE TABLE IF NOT EXISTS notification_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
                    notification_type TEXT,
                    message TEXT,
                    severity TEXT DEFAULT 'info',
                    acknowledged BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''',
            'lifecycle_events': '''
                CREATE TABLE IF NOT EXISTS lifecycle_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
                    lifecycle_type TEXT,
                    previous_state TEXT,
                    new_state TEXT,
                    trigger_reason TEXT,
                    context_snapshot TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''',
            'project_context': '''
                CREATE TABLE IF NOT EXISTS project_context (
                    id TEXT PRIMARY KEY,
                    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                    file_path TEXT NOT NULL,
                    file_type TEXT,
                    file_size INTEGER,
                    last_modified TIMESTAMP,
                    git_status TEXT,
                    content_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            '''
        }
        
        for table_name, sql in tables_sql.items():
            if table_name not in current:
                print(f"Creating table: {table_name}")
                conn.execute(sql)
        
        # Create additional indexes
        indexes = [
            ("idx_events_session_timestamp", "CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp DESC)"),
            ("idx_events_type_timestamp", "CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp DESC)"),
            ("idx_sessions_status", "CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(source)"),
            ("idx_tool_events_name_phase", "CREATE INDEX IF NOT EXISTS idx_tool_events_name_phase ON tool_events(tool_name, phase)"),
            ("idx_notification_events_session", "CREATE INDEX IF NOT EXISTS idx_notification_events_session ON notification_events(session_id)"),
            ("idx_lifecycle_events_session", "CREATE INDEX IF NOT EXISTS idx_lifecycle_events_session ON lifecycle_events(session_id)"),
            ("idx_project_context_session", "CREATE INDEX IF NOT EXISTS idx_project_context_session ON project_context(session_id)"),
        ]
        
        for idx_name, idx_sql in indexes:
            try:
                conn.execute(idx_sql)
                print(f"Created index: {idx_name}")
            except sqlite3.OperationalError as e:
                if "already exists" not in str(e):
                    print(f"Error creating index {idx_name}: {e}")
        
        conn.commit()
        
        # Get final schema
        final = get_current_schema(conn)
        print(f"\nFinal tables: {list(final.keys())}")
        print("\nMigration complete!")


def verify_schema(db_path: str):
    """Verify the schema is complete."""
    required_tables = [
        'sessions', 'events', 'tool_events', 'prompt_events',
        'notification_events', 'lifecycle_events', 'project_context'
    ]
    
    with sqlite3.connect(db_path) as conn:
        current = get_current_schema(conn)
        
        print("\nSchema Verification:")
        all_good = True
        
        for table in required_tables:
            if table in current:
                col_count = len(current[table]['columns'])
                idx_count = len(current[table]['indexes'])
                print(f"✓ {table}: {col_count} columns, {idx_count} indexes")
            else:
                print(f"✗ {table}: MISSING")
                all_good = False
        
        if all_good:
            print("\n✓ Schema verification passed!")
        else:
            print("\n✗ Schema verification failed - some tables missing")
        
        return all_good


def main():
    """Run schema migration."""
    print("Chronicle SQLite Schema Migration")
    print("-" * 50)
    
    # Get database path
    config = get_database_config()
    db_path = Path(config['sqlite_path']).expanduser().resolve()
    
    if not db_path.exists():
        print(f"Database does not exist at: {db_path}")
        print("Run any UV script first to create the database.")
        return
    
    # Run migration
    migrate_schema(str(db_path))
    
    # Verify
    verify_schema(str(db_path))


if __name__ == "__main__":
    main()