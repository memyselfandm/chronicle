# Backend Migration Tutorial - Chronicle

> **Complete guide for migrating Chronicle data between SQLite and Supabase backends, with data integrity validation and rollback procedures**

## Overview

Chronicle supports two backend modes: **local SQLite** (self-contained) and **Supabase PostgreSQL** (cloud/team). This tutorial covers migrating data between these backends while maintaining data integrity and minimizing downtime.

**What you'll accomplish:**
- ✅ Understand when and why to migrate backends
- ✅ Export data from source backend with validation
- ✅ Transform data format between SQLite and PostgreSQL
- ✅ Import data to target backend with integrity checks
- ✅ Switch Chronicle configuration to new backend
- ✅ Validate migration success and test functionality
- ✅ Set up rollback procedures for safety

**Time Required**: 30-60 minutes (depending on data size)

## Migration Scenarios

### When to Migrate

**SQLite → Supabase (Going Cloud)**
- 🏢 **Team Expansion**: Need to share data with team members
- 🌐 **Remote Access**: Access dashboard from multiple devices  
- 📊 **Advanced Analytics**: Need real-time collaboration features
- 🔄 **Backup & Sync**: Want cloud backup and synchronization
- 📈 **Scaling**: Local database performance limitations

**Supabase → SQLite (Going Local)**
- 🔒 **Privacy**: Keep sensitive data completely local
- 💰 **Cost Control**: Reduce Supabase usage costs
- 🚀 **Performance**: Faster local database access
- 🛡️ **Security**: Avoid cloud data storage
- 🔧 **Simplicity**: Reduce external dependencies

**Supabase → Supabase (Environment Migration)**
- 🏗️ **Environment Separation**: Dev → Staging → Production
- 🏢 **Organization Change**: Moving between teams/orgs
- 🌍 **Region Migration**: Change database region for performance
- 🔄 **Account Migration**: Switch Supabase accounts

### Migration Decision Matrix

```bash
# Use this matrix to decide migration direction:

Current Setup: SQLite Local
├── Need team collaboration? → Migrate to Supabase
├── Need cloud access? → Migrate to Supabase  
├── Performance issues? → Consider Supabase
└── Happy with local? → Stay with SQLite

Current Setup: Supabase
├── Privacy concerns? → Migrate to SQLite
├── Cost concerns? → Migrate to SQLite
├── Performance issues? → Migrate to SQLite
├── Team disbanded? → Migrate to SQLite
└── Team growing? → Stay with Supabase
```

## Prerequisites and Preparation

### Pre-Migration Checklist

- [ ] **Backup current data** (automatic backups created during migration)
- [ ] **Stop Chronicle hooks** during migration to avoid data inconsistency
- [ ] **Verify target backend** is accessible and configured
- [ ] **Test migration script** on small dataset first
- [ ] **Plan downtime window** (typically 10-30 minutes)
- [ ] **Inform team members** if applicable

### Required Tools

```bash
# Install migration dependencies
pip install python-dotenv psycopg2-binary sqlite3

# Verify Python libraries
python -c "import sqlite3, psycopg2, json, datetime; print('✅ All dependencies available')"
```

## Migration Method 1: SQLite → Supabase

### Step 1: Prepare Supabase Target

#### Setup Supabase Project

1. **Create Supabase Project** (if not already exists):
   ```bash
   # Visit https://supabase.com/dashboard
   # Create new project: "chronicle-[your-name]"
   # Save project URL and keys
   ```

2. **Configure Supabase Schema**:
   ```sql
   -- Run this in Supabase SQL Editor
   -- Enhanced schema with migration support
   
   CREATE TABLE chronicle_sessions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       original_sqlite_id TEXT, -- Track original SQLite IDs
       project_path TEXT NOT NULL,
       git_branch TEXT,
       start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       end_time TIMESTAMPTZ,
       status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
       event_count INTEGER NOT NULL DEFAULT 0,
       user_id TEXT,
       team_id TEXT DEFAULT 'personal',
       migration_batch TEXT, -- Track which migration batch
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   
   CREATE TABLE chronicle_events (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       original_sqlite_id TEXT, -- Track original SQLite IDs
       session_id UUID NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
       type TEXT NOT NULL CHECK (type IN ('prompt', 'tool_use', 'session_start', 'session_end')),
       timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       data JSONB NOT NULL DEFAULT '{}',
       user_id TEXT,
       migration_batch TEXT, -- Track which migration batch
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   
   -- Migration tracking table
   CREATE TABLE migration_history (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       migration_type TEXT NOT NULL,
       source_backend TEXT NOT NULL,
       target_backend TEXT NOT NULL,
       batch_id TEXT NOT NULL,
       records_migrated INTEGER,
       status TEXT CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
       error_message TEXT,
       started_at TIMESTAMPTZ DEFAULT NOW(),
       completed_at TIMESTAMPTZ
   );
   
   -- Performance indexes
   CREATE INDEX idx_sessions_original_id ON chronicle_sessions(original_sqlite_id);
   CREATE INDEX idx_events_original_id ON chronicle_events(original_sqlite_id);
   CREATE INDEX idx_sessions_migration_batch ON chronicle_sessions(migration_batch);
   CREATE INDEX idx_events_migration_batch ON chronicle_events(migration_batch);
   ```

### Step 2: Run Migration Script

#### Create Migration Configuration

```bash
# Create migration config
cat > migration-config.json << EOF
{
  "source": {
    "type": "sqlite",
    "database_path": "~/.chronicle/chronicle.db"
  },
  "target": {
    "type": "supabase",
    "supabase_url": "https://your-project.supabase.co",
    "supabase_service_role_key": "your-service-role-key"
  },
  "migration": {
    "batch_size": 100,
    "parallel_workers": 3,
    "validate_data": true,
    "create_backup": true,
    "dry_run": false
  },
  "user_info": {
    "user_id": "your-identifier",
    "team_id": "personal"
  }
}
EOF
```

#### Execute Migration

```python
#!/usr/bin/env python3
# migrate-sqlite-to-supabase.py

import json
import sqlite3
import os
import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import execute_values

@dataclass
class MigrationStats:
    sessions_migrated: int = 0
    events_migrated: int = 0
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []

class SqliteToSupabaseMigrator:
    def __init__(self, config_path: str):
        with open(config_path) as f:
            self.config = json.load(f)
        
        self.batch_id = str(uuid.uuid4())
        self.stats = MigrationStats()
        
    def connect_sqlite(self):
        """Connect to SQLite source database"""
        db_path = os.path.expanduser(self.config['source']['database_path'])
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"SQLite database not found: {db_path}")
        
        return sqlite3.connect(db_path)
    
    def connect_supabase(self):
        """Connect to Supabase target database"""
        import psycopg2
        from urllib.parse import urlparse
        
        url = self.config['target']['supabase_url']
        service_key = self.config['target']['supabase_service_role_key']
        
        # Parse Supabase URL for direct PostgreSQL connection
        parsed = urlparse(url.replace('https://', 'postgresql://'))
        host = parsed.hostname.replace('supabase.co', 'aws-0-us-east-1.pooler.supabase.com')
        
        return psycopg2.connect(
            host=host,
            port=5432,
            database='postgres',
            user='postgres',
            password=service_key
        )
    
    def create_backup(self):
        """Create backup of source database"""
        if not self.config['migration']['create_backup']:
            return
            
        source_path = os.path.expanduser(self.config['source']['database_path'])
        backup_path = f"{source_path}.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        import shutil
        shutil.copy2(source_path, backup_path)
        print(f"✅ Backup created: {backup_path}")
    
    def extract_sqlite_data(self):
        """Extract data from SQLite database"""
        print("📤 Extracting data from SQLite...")
        
        sqlite_conn = self.connect_sqlite()
        cursor = sqlite_conn.cursor()
        
        # Extract sessions
        cursor.execute("""
            SELECT id, project_path, git_branch, start_time, end_time, 
                   status, event_count, created_at, updated_at
            FROM chronicle_sessions
            ORDER BY created_at
        """)
        sessions = cursor.fetchall()
        
        # Extract events
        cursor.execute("""
            SELECT e.id, e.session_id, e.type, e.timestamp, e.data, e.created_at
            FROM chronicle_events e
            JOIN chronicle_sessions s ON e.session_id = s.id
            ORDER BY e.created_at
        """)
        events = cursor.fetchall()
        
        sqlite_conn.close()
        
        print(f"📊 Found {len(sessions)} sessions and {len(events)} events")
        return sessions, events
    
    def transform_data(self, sessions, events):
        """Transform data from SQLite format to Supabase format"""
        print("🔄 Transforming data format...")
        
        user_id = self.config['user_info']['user_id']
        team_id = self.config['user_info']['team_id']
        
        # Transform sessions
        session_mapping = {}  # SQLite ID -> Supabase UUID
        transformed_sessions = []
        
        for session in sessions:
            supabase_id = str(uuid.uuid4())
            session_mapping[session[0]] = supabase_id
            
            transformed_sessions.append({
                'id': supabase_id,
                'original_sqlite_id': str(session[0]),
                'project_path': session[1],
                'git_branch': session[2],
                'start_time': session[3],
                'end_time': session[4],
                'status': session[5],
                'event_count': session[6],
                'user_id': user_id,
                'team_id': team_id,
                'migration_batch': self.batch_id,
                'created_at': session[7],
                'updated_at': session[8]
            })
        
        # Transform events
        transformed_events = []
        for event in events:
            if event[1] in session_mapping:  # Ensure session exists
                transformed_events.append({
                    'id': str(uuid.uuid4()),
                    'original_sqlite_id': str(event[0]),
                    'session_id': session_mapping[event[1]],
                    'type': event[2],
                    'timestamp': event[3],
                    'data': json.loads(event[4]) if event[4] else {},
                    'user_id': user_id,
                    'migration_batch': self.batch_id,
                    'created_at': event[5]
                })
        
        print(f"✅ Transformed {len(transformed_sessions)} sessions and {len(transformed_events)} events")
        return transformed_sessions, transformed_events
    
    def load_to_supabase(self, sessions, events):
        """Load transformed data into Supabase"""
        print("📥 Loading data into Supabase...")
        
        supabase_conn = self.connect_supabase()
        cursor = supabase_conn.cursor()
        
        try:
            # Record migration start
            cursor.execute("""
                INSERT INTO migration_history 
                (migration_type, source_backend, target_backend, batch_id, status)
                VALUES (%s, %s, %s, %s, %s)
            """, ('full_migration', 'sqlite', 'supabase', self.batch_id, 'started'))
            
            # Insert sessions in batches
            batch_size = self.config['migration']['batch_size']
            for i in range(0, len(sessions), batch_size):
                batch = sessions[i:i+batch_size]
                
                values = [(
                    s['id'], s['original_sqlite_id'], s['project_path'], s['git_branch'],
                    s['start_time'], s['end_time'], s['status'], s['event_count'],
                    s['user_id'], s['team_id'], s['migration_batch'], 
                    s['created_at'], s['updated_at']
                ) for s in batch]
                
                execute_values(cursor, """
                    INSERT INTO chronicle_sessions 
                    (id, original_sqlite_id, project_path, git_branch, start_time, end_time, 
                     status, event_count, user_id, team_id, migration_batch, created_at, updated_at)
                    VALUES %s
                """, values)
                
                self.stats.sessions_migrated += len(batch)
                print(f"  📦 Migrated {self.stats.sessions_migrated}/{len(sessions)} sessions")
            
            # Insert events in batches
            for i in range(0, len(events), batch_size):
                batch = events[i:i+batch_size]
                
                values = [(
                    e['id'], e['original_sqlite_id'], e['session_id'], e['type'],
                    e['timestamp'], json.dumps(e['data']), e['user_id'], 
                    e['migration_batch'], e['created_at']
                ) for e in batch]
                
                execute_values(cursor, """
                    INSERT INTO chronicle_events 
                    (id, original_sqlite_id, session_id, type, timestamp, data, 
                     user_id, migration_batch, created_at)
                    VALUES %s
                """, values)
                
                self.stats.events_migrated += len(batch)
                print(f"  📦 Migrated {self.stats.events_migrated}/{len(events)} events")
            
            # Update migration record
            cursor.execute("""
                UPDATE migration_history 
                SET status = %s, records_migrated = %s, completed_at = %s
                WHERE batch_id = %s
            """, ('completed', len(sessions) + len(events), datetime.now(), self.batch_id))
            
            supabase_conn.commit()
            print("✅ Data successfully loaded into Supabase")
            
        except Exception as e:
            supabase_conn.rollback()
            cursor.execute("""
                UPDATE migration_history 
                SET status = %s, error_message = %s, completed_at = %s
                WHERE batch_id = %s
            """, ('failed', str(e), datetime.now(), self.batch_id))
            supabase_conn.commit()
            raise e
        finally:
            supabase_conn.close()
    
    def validate_migration(self):
        """Validate migration success"""
        print("🔍 Validating migration...")
        
        sqlite_conn = self.connect_sqlite()
        supabase_conn = self.connect_supabase()
        
        try:
            # Count records in source
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute("SELECT COUNT(*) FROM chronicle_sessions")
            sqlite_session_count = sqlite_cursor.fetchone()[0]
            sqlite_cursor.execute("SELECT COUNT(*) FROM chronicle_events") 
            sqlite_event_count = sqlite_cursor.fetchone()[0]
            
            # Count records in target for this migration batch
            supabase_cursor = supabase_conn.cursor()
            supabase_cursor.execute("""
                SELECT COUNT(*) FROM chronicle_sessions WHERE migration_batch = %s
            """, (self.batch_id,))
            supabase_session_count = supabase_cursor.fetchone()[0]
            
            supabase_cursor.execute("""
                SELECT COUNT(*) FROM chronicle_events WHERE migration_batch = %s
            """, (self.batch_id,))
            supabase_event_count = supabase_cursor.fetchone()[0]
            
            # Compare counts
            session_match = sqlite_session_count == supabase_session_count
            event_match = sqlite_event_count == supabase_event_count
            
            print(f"  Sessions: SQLite={sqlite_session_count}, Supabase={supabase_session_count} {'✅' if session_match else '❌'}")
            print(f"  Events: SQLite={sqlite_event_count}, Supabase={supabase_event_count} {'✅' if event_match else '❌'}")
            
            if session_match and event_match:
                print("✅ Migration validation successful!")
                return True
            else:
                print("❌ Migration validation failed!")
                return False
                
        finally:
            sqlite_conn.close()
            supabase_conn.close()
    
    def migrate(self):
        """Execute full migration process"""
        print(f"🚀 Starting SQLite → Supabase migration")
        print(f"📋 Batch ID: {self.batch_id}")
        
        if self.config['migration']['dry_run']:
            print("🧪 DRY RUN MODE - No data will be modified")
        
        try:
            # Step 1: Create backup
            self.create_backup()
            
            # Step 2: Extract data from SQLite
            sessions, events = self.extract_sqlite_data()
            
            # Step 3: Transform data
            transformed_sessions, transformed_events = self.transform_data(sessions, events)
            
            # Step 4: Load to Supabase (skip if dry run)
            if not self.config['migration']['dry_run']:
                self.load_to_supabase(transformed_sessions, transformed_events)
                
                # Step 5: Validate migration
                if self.validate_migration():
                    print("🎉 Migration completed successfully!")
                else:
                    raise Exception("Migration validation failed")
            else:
                print("🧪 Dry run completed - ready for actual migration")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            self.stats.errors.append(str(e))
            raise

if __name__ == "__main__":
    migrator = SqliteToSupabaseMigrator('migration-config.json')
    migrator.migrate()
```

#### Run the Migration

```bash
# First, do a dry run to test
python migrate-sqlite-to-supabase.py

# Check dry run results, then run actual migration
sed -i 's/"dry_run": true/"dry_run": false/' migration-config.json
python migrate-sqlite-to-supabase.py
```

### Step 3: Update Chronicle Configuration

#### Update Hooks Configuration

```bash
cd apps/hooks

# Update hooks environment
cat > .env << EOF
# Migration to Supabase backend
CHRONICLE_ENVIRONMENT=production
CHRONICLE_BACKEND_MODE=supabase

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# User Configuration
CHRONICLE_USER_ID=your-identifier
CHRONICLE_TEAM_ID=personal

# Keep SQLite as fallback
SQLITE_FALLBACK_PATH=~/.chronicle/chronicle.db
EOF

# Test new configuration
python -c "from src.database import DatabaseManager; dm = DatabaseManager(); print('✅' if dm.test_connection() else '❌', 'Connection test')"
```

#### Update Dashboard Configuration

```bash
cd apps/dashboard

# Update dashboard environment
cat > .env.local << EOF
# Supabase Backend Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# User Configuration  
NEXT_PUBLIC_USER_ID=your-identifier
NEXT_PUBLIC_TEAM_ID=personal
NEXT_PUBLIC_BACKEND_MODE=supabase

# UI Configuration
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SHOW_MIGRATION_STATUS=true
EOF

# Test dashboard connection
npm run dev
# Visit http://localhost:3000 and verify data appears
```

## Migration Method 2: Supabase → SQLite

### Step 1: Prepare SQLite Target

```bash
# Create local SQLite database with migration tracking
cd apps/hooks
python -c "
from src.database import DatabaseManager
dm = DatabaseManager(backend_type='sqlite')
dm.setup_schema()

# Add migration tracking to SQLite
import sqlite3
conn = sqlite3.connect(dm.db_path)
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS migration_history (
    id TEXT PRIMARY KEY,
    migration_type TEXT NOT NULL,
    source_backend TEXT NOT NULL,
    target_backend TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    records_migrated INTEGER,
    status TEXT CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT
)
''')

cursor.execute('''
ALTER TABLE chronicle_sessions ADD COLUMN original_supabase_id TEXT
''')

cursor.execute('''  
ALTER TABLE chronicle_events ADD COLUMN original_supabase_id TEXT
''')

conn.commit()
conn.close()
print('✅ SQLite database prepared for migration')
"
```

### Step 2: Execute Supabase → SQLite Migration

```python
#!/usr/bin/env python3
# migrate-supabase-to-sqlite.py

import json
import sqlite3
import os
import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

class SupabaseToSqliteMigrator:
    def __init__(self, config_path: str):
        with open(config_path) as f:
            self.config = json.load(f)
        
        self.batch_id = str(uuid.uuid4())
    
    def connect_supabase(self):
        """Connect to Supabase source database"""
        # Same connection logic as previous migrator
        import psycopg2
        from urllib.parse import urlparse
        
        url = self.config['source']['supabase_url']
        service_key = self.config['source']['supabase_service_role_key']
        
        parsed = urlparse(url.replace('https://', 'postgresql://'))
        host = parsed.hostname.replace('supabase.co', 'aws-0-us-east-1.pooler.supabase.com')
        
        return psycopg2.connect(
            host=host,
            port=5432,
            database='postgres',
            user='postgres',
            password=service_key,
            cursor_factory=RealDictCursor
        )
    
    def connect_sqlite(self):
        """Connect to SQLite target database"""
        db_path = os.path.expanduser(self.config['target']['database_path'])
        return sqlite3.connect(db_path)
    
    def extract_supabase_data(self):
        """Extract data from Supabase database"""
        print("📤 Extracting data from Supabase...")
        
        supabase_conn = self.connect_supabase()
        cursor = supabase_conn.cursor()
        
        # Filter by user if specified
        user_filter = ""
        params = []
        if 'user_id' in self.config.get('filters', {}):
            user_filter = "WHERE user_id = %s"
            params.append(self.config['filters']['user_id'])
        
        # Extract sessions
        cursor.execute(f"""
            SELECT id, project_path, git_branch, start_time, end_time,
                   status, event_count, created_at, updated_at, user_id
            FROM chronicle_sessions 
            {user_filter}
            ORDER BY created_at
        """, params)
        sessions = cursor.fetchall()
        
        # Extract events for these sessions
        session_ids = [str(s['id']) for s in sessions]
        if session_ids:
            cursor.execute(f"""
                SELECT id, session_id, type, timestamp, data, created_at
                FROM chronicle_events
                WHERE session_id = ANY(%s)
                ORDER BY created_at
            """, (session_ids,))
            events = cursor.fetchall()
        else:
            events = []
        
        supabase_conn.close()
        
        print(f"📊 Found {len(sessions)} sessions and {len(events)} events")
        return sessions, events
    
    def transform_data(self, sessions, events):
        """Transform data from Supabase format to SQLite format"""
        print("🔄 Transforming data format...")
        
        # Transform sessions - create mapping for new integer IDs
        session_mapping = {}  # Supabase UUID -> SQLite integer ID
        transformed_sessions = []
        
        for i, session in enumerate(sessions, 1):
            sqlite_id = i  # Use sequential integer IDs for SQLite
            session_mapping[str(session['id'])] = sqlite_id
            
            transformed_sessions.append({
                'id': sqlite_id,
                'original_supabase_id': str(session['id']),
                'project_path': session['project_path'],
                'git_branch': session['git_branch'],
                'start_time': session['start_time'].isoformat() if session['start_time'] else None,
                'end_time': session['end_time'].isoformat() if session['end_time'] else None,
                'status': session['status'],
                'event_count': session['event_count'],
                'created_at': session['created_at'].isoformat() if session['created_at'] else None,
                'updated_at': session['updated_at'].isoformat() if session['updated_at'] else None,
            })
        
        # Transform events
        transformed_events = []
        event_id = 1
        
        for event in events:
            supabase_session_id = str(event['session_id'])
            if supabase_session_id in session_mapping:
                transformed_events.append({
                    'id': event_id,
                    'original_supabase_id': str(event['id']),
                    'session_id': session_mapping[supabase_session_id],
                    'type': event['type'],
                    'timestamp': event['timestamp'].isoformat() if event['timestamp'] else None,
                    'data': json.dumps(event['data']) if event['data'] else '{}',
                    'created_at': event['created_at'].isoformat() if event['created_at'] else None
                })
                event_id += 1
        
        print(f"✅ Transformed {len(transformed_sessions)} sessions and {len(transformed_events)} events")
        return transformed_sessions, transformed_events
    
    def load_to_sqlite(self, sessions, events):
        """Load transformed data into SQLite"""
        print("📥 Loading data into SQLite...")
        
        sqlite_conn = self.connect_sqlite()
        cursor = sqlite_conn.cursor()
        
        try:
            # Record migration start
            cursor.execute("""
                INSERT INTO migration_history 
                (id, migration_type, source_backend, target_backend, batch_id, status, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), 'full_migration', 'supabase', 'sqlite', self.batch_id, 'started', datetime.now().isoformat()))
            
            # Clear existing data if requested
            if self.config['migration'].get('clear_target', False):
                cursor.execute("DELETE FROM chronicle_events")
                cursor.execute("DELETE FROM chronicle_sessions")
                print("🧹 Cleared existing SQLite data")
            
            # Insert sessions
            for session in sessions:
                cursor.execute("""
                    INSERT OR REPLACE INTO chronicle_sessions 
                    (id, original_supabase_id, project_path, git_branch, start_time, end_time,
                     status, event_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    session['id'], session['original_supabase_id'], session['project_path'],
                    session['git_branch'], session['start_time'], session['end_time'],
                    session['status'], session['event_count'], session['created_at'], session['updated_at']
                ))
            
            # Insert events  
            for event in events:
                cursor.execute("""
                    INSERT OR REPLACE INTO chronicle_events
                    (id, original_supabase_id, session_id, type, timestamp, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    event['id'], event['original_supabase_id'], event['session_id'],
                    event['type'], event['timestamp'], event['data'], event['created_at']
                ))
            
            # Update migration record
            cursor.execute("""
                UPDATE migration_history 
                SET status = ?, records_migrated = ?, completed_at = ?
                WHERE batch_id = ?
            """, ('completed', len(sessions) + len(events), datetime.now().isoformat(), self.batch_id))
            
            sqlite_conn.commit()
            print(f"✅ Migrated {len(sessions)} sessions and {len(events)} events to SQLite")
            
        except Exception as e:
            sqlite_conn.rollback()
            cursor.execute("""
                UPDATE migration_history 
                SET status = ?, error_message = ?, completed_at = ?
                WHERE batch_id = ?
            """, ('failed', str(e), datetime.now().isoformat(), self.batch_id))
            sqlite_conn.commit()
            raise e
        finally:
            sqlite_conn.close()
    
    def migrate(self):
        """Execute full migration process"""
        print(f"🚀 Starting Supabase → SQLite migration")
        print(f"📋 Batch ID: {self.batch_id}")
        
        try:
            # Extract data from Supabase
            sessions, events = self.extract_supabase_data()
            
            # Transform data format
            transformed_sessions, transformed_events = self.transform_data(sessions, events)
            
            # Load to SQLite
            self.load_to_sqlite(transformed_sessions, transformed_events)
            
            print("🎉 Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise

# Create configuration for Supabase → SQLite migration
supabase_to_sqlite_config = {
    "source": {
        "type": "supabase",
        "supabase_url": "https://your-project.supabase.co",
        "supabase_service_role_key": "your-service-role-key"
    },
    "target": {
        "type": "sqlite",
        "database_path": "~/.chronicle/chronicle.db"
    },
    "migration": {
        "clear_target": False,  # Set to True to replace all data
        "validate_data": True
    },
    "filters": {
        "user_id": "your-user-id"  # Optional: filter by specific user
    }
}

if __name__ == "__main__":
    # Save config
    with open('migration-config-supabase-to-sqlite.json', 'w') as f:
        json.dump(supabase_to_sqlite_config, f, indent=2)
    
    migrator = SupabaseToSqliteMigrator('migration-config-supabase-to-sqlite.json')
    migrator.migrate()
```

### Step 3: Update Configuration for SQLite

```bash
# Update hooks configuration
cd apps/hooks
cat > .env << EOF
# Migration to SQLite backend
CHRONICLE_ENVIRONMENT=local
CHRONICLE_BACKEND_MODE=sqlite

# SQLite Configuration
SQLITE_DATABASE_PATH=~/.chronicle/chronicle.db

# Disable Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EOF

# Update dashboard configuration
cd apps/dashboard
cat > .env.local << EOF
# SQLite Backend Configuration
NEXT_PUBLIC_BACKEND_MODE=sqlite
NEXT_PUBLIC_ENVIRONMENT=local
NEXT_PUBLIC_SQLITE_PATH=~/.chronicle/chronicle.db

# Disable Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
```

## Post-Migration Validation

### Comprehensive Validation Script

```bash
#!/bin/bash
# validate-migration.sh

echo "🔍 Chronicle Migration Validation"

# Test database connectivity
echo "Testing database connection..."
cd apps/hooks
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
if dm.test_connection():
    print('✅ Database connection successful')
    
    # Test data queries
    session_count = dm.get_session_count()
    event_count = dm.get_event_count()
    print(f'📊 Found {session_count} sessions and {event_count} events')
    
    # Test recent data
    recent_sessions = dm.get_recent_sessions(limit=5)
    print(f'📅 Recent sessions: {len(recent_sessions)}')
    
    for session in recent_sessions:
        print(f'  - {session[\"project_path\"]} ({session[\"event_count\"]} events)')
else:
    print('❌ Database connection failed')
    exit 1
"

# Test hooks functionality
echo "Testing hooks functionality..."
echo '{"session_id":"test-migration","tool_name":"Read","file_path":"test.txt"}' | python src/hooks/pre_tool_use.py

# Test dashboard
echo "Testing dashboard..."
cd ../dashboard
timeout 10 npm run dev &
DASHBOARD_PID=$!
sleep 5

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Dashboard health check passed"
else
    echo "❌ Dashboard health check failed"
fi

kill $DASHBOARD_PID 2>/dev/null

echo "🎉 Migration validation complete!"
```

## Rollback Procedures

### Automatic Rollback Script

```python
#!/usr/bin/env python3
# rollback-migration.py

import json
import os
import shutil
from datetime import datetime

class MigrationRollback:
    def __init__(self, migration_batch_id: str):
        self.batch_id = migration_batch_id
    
    def rollback_sqlite_to_supabase(self):
        """Rollback SQLite → Supabase migration"""
        print(f"🔄 Rolling back migration batch: {self.batch_id}")
        
        # Connect to Supabase
        supabase_conn = self.connect_supabase()
        cursor = supabase_conn.cursor()
        
        try:
            # Delete migrated data
            cursor.execute("""
                DELETE FROM chronicle_events WHERE migration_batch = %s
            """, (self.batch_id,))
            
            cursor.execute("""
                DELETE FROM chronicle_sessions WHERE migration_batch = %s  
            """, (self.batch_id,))
            
            # Update migration record
            cursor.execute("""
                UPDATE migration_history 
                SET status = 'rolled_back', completed_at = %s
                WHERE batch_id = %s
            """, (datetime.now(), self.batch_id))
            
            supabase_conn.commit()
            print("✅ Rollback completed successfully")
            
        except Exception as e:
            supabase_conn.rollback()
            print(f"❌ Rollback failed: {e}")
            raise
        finally:
            supabase_conn.close()
    
    def restore_sqlite_backup(self, backup_path: str):
        """Restore SQLite from backup"""
        target_path = os.path.expanduser("~/.chronicle/chronicle.db")
        
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, target_path)
            print(f"✅ SQLite database restored from {backup_path}")
        else:
            print(f"❌ Backup file not found: {backup_path}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python rollback-migration.py <migration_batch_id>")
        sys.exit(1)
    
    rollback = MigrationRollback(sys.argv[1])
    # rollback.rollback_sqlite_to_supabase()
    # rollback.restore_sqlite_backup("~/.chronicle/chronicle.db.backup-20241215-143022")
```

## Troubleshooting Migrations

### Common Issues and Solutions

#### 1. Connection Errors

**SQLite locked errors:**
```bash
# Kill all Python processes accessing SQLite
pkill -f "python.*chronicle"

# Check for file locks
lsof ~/.chronicle/chronicle.db

# Restart with journal mode
sqlite3 ~/.chronicle/chronicle.db "PRAGMA journal_mode=WAL;"
```

**Supabase connection timeout:**
```bash
# Test connection directly
curl -H "apikey: your-key" "https://your-project.supabase.co/rest/v1/"

# Check firewall/VPN issues
ping your-project.supabase.co

# Verify service role key permissions
```

#### 2. Data Integrity Issues

**Missing sessions/events:**
```bash
# Check migration logs
grep "Migration" ~/.chronicle/logs/migration.log

# Validate data counts manually
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
print('Sessions:', dm.get_session_count())  
print('Events:', dm.get_event_count())
print('Orphaned events:', dm.get_orphaned_events_count())
"
```

#### 3. Configuration Issues

**Environment variables not loading:**
```bash
# Check environment file exists and is readable
ls -la apps/hooks/.env apps/dashboard/.env.local

# Test environment loading
cd apps/hooks
python -c "import os; print('SUPABASE_URL:', bool(os.getenv('SUPABASE_URL')))"

# Source environment manually if needed
set -a; source .env; set +a
```

### Performance Optimization

For large datasets (>10,000 events):

```python
# Optimize migration performance
config_optimized = {
    "migration": {
        "batch_size": 500,     # Larger batches
        "parallel_workers": 5,  # More workers
        "validate_data": False, # Skip validation for speed
        "create_indexes": False # Create indexes after migration
    }
}
```

## Next Steps

### Post-Migration Actions

1. **Update Documentation**: Update team docs with new backend info
2. **Notify Team Members**: If applicable, inform team of backend change  
3. **Update Monitoring**: Adjust monitoring/alerts for new backend
4. **Schedule Cleanup**: Remove old backup files after validation period
5. **Performance Testing**: Test with actual workload patterns

### Advanced Migration Scenarios

- **Partial Migrations**: Migrate only specific date ranges or projects
- **Multi-Source Migrations**: Combine data from multiple Chronicle instances
- **Custom Data Transformations**: Add custom fields during migration
- **Scheduled Migrations**: Set up automated periodic data syncing

### Related Documentation

- **[Advanced Configuration](./advanced-configuration.md)** - Optimize performance post-migration  
- **[Team Deployment](./team-deployment.md)** - Set up team features after migration
- **[Security Guide](../guides/security.md)** - Secure your migrated data

---

**🎉 Migration Complete!**

Your Chronicle data has been successfully migrated. Remember to test all functionality and keep backups for at least 30 days before removing them.