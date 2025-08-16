#!/usr/bin/env python3
"""
Fix SQLite events table CHECK constraint to allow all event types.

This script migrates the existing SQLite database to remove the restrictive
CHECK constraint on the event_type column that was preventing certain events
from being saved.
"""

import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

def backup_database(db_path: Path) -> Path:
    """Create a backup of the database before migration."""
    backup_path = db_path.parent / f"{db_path.stem}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    shutil.copy2(db_path, backup_path)
    print(f"✅ Created backup: {backup_path}")
    return backup_path

def migrate_database(db_path: Path):
    """Migrate the database to remove CHECK constraint."""
    print(f"📦 Migrating database: {db_path}")
    
    with sqlite3.connect(str(db_path)) as conn:
        # Check if migration is needed
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='events'")
        result = cursor.fetchone()
        
        if not result:
            print("❌ Events table not found")
            return
        
        current_schema = result[0]
        
        if "CHECK" not in current_schema:
            print("✅ Database already migrated (no CHECK constraint found)")
            return
        
        print("🔧 Removing CHECK constraint from events table...")
        
        # Begin transaction
        conn.execute("BEGIN TRANSACTION")
        
        try:
            # Save existing views
            cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='view'")
            views = cursor.fetchall()
            print(f"📋 Found {len(views)} views to preserve")
            
            # Drop views that depend on events table
            for view_name, _ in views:
                conn.execute(f"DROP VIEW IF EXISTS {view_name}")
                print(f"  - Dropped view: {view_name}")
            
            # Create new table without CHECK constraint
            conn.execute('''
                CREATE TABLE events_new (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    data TEXT NOT NULL DEFAULT '{}',
                    tool_name TEXT,
                    duration_ms INTEGER CHECK (duration_ms >= 0),
                    created_at TEXT DEFAULT (datetime('now', 'utc')),
                    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
                )
            ''')
            
            # Copy data from old table to new table
            conn.execute('''
                INSERT INTO events_new (id, session_id, event_type, timestamp, data, tool_name, duration_ms, created_at)
                SELECT id, session_id, event_type, timestamp, data, tool_name, duration_ms, created_at
                FROM events
            ''')
            
            # Get count of migrated rows
            cursor.execute("SELECT COUNT(*) FROM events_new")
            row_count = cursor.fetchone()[0]
            print(f"📊 Migrated {row_count} events")
            
            # Drop old table
            conn.execute("DROP TABLE events")
            
            # Rename new table to events
            conn.execute("ALTER TABLE events_new RENAME TO events")
            
            # Recreate indexes
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp DESC)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_tool_name ON events(tool_name) WHERE tool_name IS NOT NULL')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)')
            
            # Recreate triggers
            conn.execute('''
                CREATE TRIGGER IF NOT EXISTS trigger_update_session_end_time
                AFTER INSERT ON events
                FOR EACH ROW
                WHEN NEW.event_type = 'stop'
                BEGIN
                    UPDATE sessions 
                    SET end_time = NEW.timestamp 
                    WHERE id = NEW.session_id 
                    AND end_time IS NULL;
                END
            ''')
            
            # Note: Not recreating the validation trigger since it was part of the problem
            
            # Recreate views
            print("🔄 Recreating views...")
            for view_name, view_sql in views:
                conn.execute(view_sql)
                print(f"  - Recreated view: {view_name}")
            
            # Commit transaction
            conn.execute("COMMIT")
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            # Rollback on error
            conn.execute("ROLLBACK")
            print(f"❌ Migration failed: {e}")
            raise

def main():
    """Main migration function."""
    # Find the Chronicle SQLite database
    db_path = Path.home() / ".claude" / "hooks" / "chronicle" / "data" / "chronicle.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return
    
    print("🚀 Chronicle SQLite Migration Tool")
    print("=" * 50)
    
    # Create backup
    backup_path = backup_database(db_path)
    
    try:
        # Perform migration
        migrate_database(db_path)
        
        print("\n✅ Migration completed successfully!")
        print(f"📁 Backup saved at: {backup_path}")
        print("💡 You can delete the backup if everything works correctly")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print(f"🔄 Restoring from backup...")
        shutil.copy2(backup_path, db_path)
        print(f"✅ Database restored from backup")

if __name__ == "__main__":
    main()