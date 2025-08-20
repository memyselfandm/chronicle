# SQLite Fallback Database Documentation for Chronicle MVP

## Overview

This guide covers SQLite implementation as a fallback database for the Chronicle observability system, including automatic failover logic, sync strategies, and resilient data patterns when Supabase PostgreSQL is unavailable.

## Architecture Overview

The SQLite fallback system provides:
- **Automatic failover** when Supabase is unreachable
- **Local data persistence** during network outages
- **Sync mechanisms** to replay data when connectivity returns
- **Compatible schema** with PostgreSQL for seamless operation

## SQLite Schema Implementation

### 1. Mirror Schema Design

```sql
-- Enable necessary SQLite features
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- Sessions table (mirrors PostgreSQL)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT UNIQUE NOT NULL,
    project_name TEXT,
    git_branch TEXT,
    git_commit TEXT,
    working_directory TEXT,
    environment TEXT, -- JSON stored as TEXT
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'error')),
    metadata TEXT DEFAULT '{}', -- JSON stored as TEXT
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

-- Events table (main event storage)
CREATE TABLE events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    source_app TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    data TEXT NOT NULL, -- JSON stored as TEXT
    metadata TEXT DEFAULT '{}',
    processed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt TEXT
);

-- Tool events
CREATE TABLE tool_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_type TEXT,
    phase TEXT CHECK (phase IN ('pre', 'post')),
    parameters TEXT, -- JSON
    result TEXT, -- JSON
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending'
);

-- Prompt events
CREATE TABLE prompt_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    prompt_text TEXT,
    prompt_length INTEGER,
    complexity_score REAL,
    intent_classification TEXT,
    context_data TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending'
);

-- Notification events
CREATE TABLE notification_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    notification_type TEXT,
    message TEXT,
    severity TEXT DEFAULT 'info',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending'
);

-- Lifecycle events
CREATE TABLE lifecycle_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    lifecycle_type TEXT,
    previous_state TEXT,
    new_state TEXT,
    trigger_reason TEXT,
    context_snapshot TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending'
);

-- Project context
CREATE TABLE project_context (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    last_modified TEXT,
    git_status TEXT,
    content_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'pending'
);

-- Sync tracking table
CREATE TABLE sync_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    sync_timestamp TEXT DEFAULT (datetime('now')),
    sync_result TEXT CHECK (sync_result IN ('success', 'failed', 'partial')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);
```

### 2. SQLite Optimized Indexes

```sql
-- Performance indexes for SQLite
CREATE INDEX idx_events_session_timestamp ON events(session_id, timestamp DESC);
CREATE INDEX idx_events_type_timestamp ON events(event_type, timestamp DESC);
CREATE INDEX idx_events_sync_status ON events(sync_status) WHERE sync_status = 'pending';
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_sync_status ON sessions(sync_status) WHERE sync_status = 'pending';

-- Tool-specific indexes
CREATE INDEX idx_tool_events_name_phase ON tool_events(tool_name, phase);
CREATE INDEX idx_tool_events_sync ON tool_events(sync_status) WHERE sync_status = 'pending';

-- Full-text search for prompts (SQLite FTS5)
CREATE VIRTUAL TABLE prompt_search USING fts5(prompt_text, content='prompt_events', content_rowid='rowid');

-- Triggers to maintain FTS index
CREATE TRIGGER prompt_events_ai AFTER INSERT ON prompt_events BEGIN
    INSERT INTO prompt_search(rowid, prompt_text) VALUES (new.rowid, new.prompt_text);
END;

CREATE TRIGGER prompt_events_ad AFTER DELETE ON prompt_events BEGIN
    INSERT INTO prompt_search(prompt_search, rowid, prompt_text) VALUES('delete', old.rowid, old.prompt_text);
END;
```

## Fallback Database Client

### 1. Unified Database Interface

```python
import sqlite3
import asyncio
import aiosqlite
import json
import os
from typing import Optional, Dict, Any, List, Union
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum

class DatabaseStatus(Enum):
    PRIMARY_CONNECTED = "primary_connected"
    FALLBACK_ACTIVE = "fallback_active"
    BOTH_FAILED = "both_failed"
    SYNCING = "syncing"

@dataclass
class DatabaseConfig:
    primary_url: str
    fallback_path: str
    health_check_interval: int = 30
    sync_batch_size: int = 100
    max_retry_attempts: int = 3
    connection_timeout: int = 10

class UnifiedDatabaseClient:
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.status = DatabaseStatus.PRIMARY_CONNECTED
        self.primary_client = None  # SupabaseClient
        self.fallback_path = config.fallback_path
        self.sync_queue = asyncio.Queue()
        self.health_check_task = None
        self.sync_task = None
        
    async def initialize(self):
        """Initialize database connections and start background tasks"""
        # Try to connect to primary database
        try:
            from supabase import create_client
            self.primary_client = create_client(
                self.config.primary_url,
                os.getenv("SUPABASE_ANON_KEY")
            )
            # Test connection
            await self._test_primary_connection()
            self.status = DatabaseStatus.PRIMARY_CONNECTED
        except Exception as e:
            print(f"Primary database unavailable, switching to fallback: {e}")
            self.status = DatabaseStatus.FALLBACK_ACTIVE
        
        # Initialize SQLite fallback
        await self._initialize_sqlite()
        
        # Start background tasks
        self.health_check_task = asyncio.create_task(self._health_check_loop())
        self.sync_task = asyncio.create_task(self._sync_loop())
    
    async def _initialize_sqlite(self):
        """Initialize SQLite database with schema"""
        os.makedirs(os.path.dirname(self.fallback_path), exist_ok=True)
        
        async with aiosqlite.connect(self.fallback_path) as db:
            # Read and execute schema
            schema_path = os.path.join(os.path.dirname(__file__), 'sqlite_schema.sql')
            if os.path.exists(schema_path):
                with open(schema_path, 'r') as f:
                    schema = f.read()
                await db.executescript(schema)
            await db.commit()
    
    async def _test_primary_connection(self) -> bool:
        """Test if primary database is accessible"""
        try:
            # Simple health check query
            result = await self.primary_client.table('sessions').select('id').limit(1).execute()
            return True
        except Exception:
            return False
    
    @asynccontextmanager
    async def get_connection(self):
        """Get appropriate database connection based on current status"""
        if self.status == DatabaseStatus.PRIMARY_CONNECTED:
            try:
                # Use primary database
                yield PrimaryDatabaseWrapper(self.primary_client)
            except Exception as e:
                print(f"Primary database error, falling back to SQLite: {e}")
                self.status = DatabaseStatus.FALLBACK_ACTIVE
                async with aiosqlite.connect(self.fallback_path) as db:
                    yield SQLiteDatabaseWrapper(db)
        else:
            # Use SQLite fallback
            async with aiosqlite.connect(self.fallback_path) as db:
                yield SQLiteDatabaseWrapper(db)
```

### 2. Database Wrapper Classes

```python
class DatabaseWrapper:
    """Abstract base for database wrappers"""
    async def insert_event(self, event_data: Dict[str, Any]) -> str:
        raise NotImplementedError
    
    async def get_events(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        raise NotImplementedError
    
    async def update_sync_status(self, table: str, record_id: str, status: str):
        raise NotImplementedError

class SQLiteDatabaseWrapper(DatabaseWrapper):
    def __init__(self, connection: aiosqlite.Connection):
        self.conn = connection
    
    async def insert_event(self, event_data: Dict[str, Any]) -> str:
        """Insert event into SQLite with fallback-specific fields"""
        query = """
        INSERT INTO events (session_id, event_type, source_app, timestamp, data, metadata, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """
        
        params = (
            event_data.get('session_id'),
            event_data.get('event_type'),
            event_data.get('source_app'),
            event_data.get('timestamp'),
            json.dumps(event_data.get('data', {})),
            json.dumps(event_data.get('metadata', {}))
        )
        
        cursor = await self.conn.execute(query, params)
        await self.conn.commit()
        return cursor.lastrowid
    
    async def get_pending_sync_records(self, table_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get records that need to be synced to primary database"""
        query = f"""
        SELECT * FROM {table_name} 
        WHERE sync_status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT ?
        """
        
        async with self.conn.execute(query, (limit,)) as cursor:
            columns = [description[0] for description in cursor.description]
            rows = await cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
    
    async def update_sync_status(self, table: str, record_id: str, status: str, error_message: str = None):
        """Update sync status for a record"""
        query = f"""
        UPDATE {table} 
        SET sync_status = ?, last_sync_attempt = datetime('now')
        WHERE id = ?
        """
        params = [status, record_id]
        
        if error_message and status == 'failed':
            query = f"""
            UPDATE {table} 
            SET sync_status = ?, last_sync_attempt = datetime('now'), sync_attempts = sync_attempts + 1
            WHERE id = ?
            """
        
        await self.conn.execute(query, params)
        await self.conn.commit()
        
        # Log sync attempt
        await self._log_sync_attempt(table, record_id, status, error_message)
    
    async def _log_sync_attempt(self, table_name: str, record_id: str, result: str, error_message: str = None):
        """Log sync attempts for monitoring"""
        query = """
        INSERT INTO sync_log (table_name, record_id, sync_result, error_message)
        VALUES (?, ?, ?, ?)
        """
        await self.conn.execute(query, (table_name, record_id, result, error_message))
        await self.conn.commit()

class PrimaryDatabaseWrapper(DatabaseWrapper):
    def __init__(self, supabase_client):
        self.client = supabase_client
    
    async def insert_event(self, event_data: Dict[str, Any]) -> str:
        """Insert event into Supabase PostgreSQL"""
        result = await self.client.table('events').insert(event_data).execute()
        return result.data[0]['id'] if result.data else None
    
    async def get_events(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get events from primary database"""
        query = self.client.table('events').select('*')
        
        if 'session_id' in filters:
            query = query.eq('session_id', filters['session_id'])
        if 'event_type' in filters:
            query = query.eq('event_type', filters['event_type'])
        if 'limit' in filters:
            query = query.limit(filters['limit'])
        
        result = await query.execute()
        return result.data
```

## Automatic Failover Logic

### 1. Health Check System

```python
class HealthCheckManager:
    def __init__(self, db_client: UnifiedDatabaseClient):
        self.db_client = db_client
        self.failure_count = 0
        self.max_failures = 3
        self.check_interval = 30  # seconds
        
    async def _health_check_loop(self):
        """Continuous health monitoring with automatic failover"""
        while True:
            try:
                await asyncio.sleep(self.check_interval)
                
                if self.db_client.status == DatabaseStatus.PRIMARY_CONNECTED:
                    # Check if primary is still healthy
                    if not await self.db_client._test_primary_connection():
                        self.failure_count += 1
                        print(f"Primary database health check failed ({self.failure_count}/{self.max_failures})")
                        
                        if self.failure_count >= self.max_failures:
                            print("Switching to fallback database")
                            self.db_client.status = DatabaseStatus.FALLBACK_ACTIVE
                            self.failure_count = 0
                    else:
                        self.failure_count = 0
                
                elif self.db_client.status == DatabaseStatus.FALLBACK_ACTIVE:
                    # Check if primary has recovered
                    if await self.db_client._test_primary_connection():
                        print("Primary database recovered, initiating sync")
                        self.db_client.status = DatabaseStatus.SYNCING
                        await self._initiate_sync()
                        self.db_client.status = DatabaseStatus.PRIMARY_CONNECTED
                        self.failure_count = 0
                        
            except Exception as e:
                print(f"Health check error: {e}")
                await asyncio.sleep(5)  # Brief pause before retry
    
    async def _initiate_sync(self):
        """Sync fallback data to primary database"""
        print("Starting data synchronization...")
        
        tables = ['sessions', 'events', 'tool_events', 'prompt_events', 
                 'notification_events', 'lifecycle_events', 'project_context']
        
        for table in tables:
            await self._sync_table(table)
    
    async def _sync_table(self, table_name: str):
        """Sync specific table from SQLite to PostgreSQL"""
        async with aiosqlite.connect(self.db_client.fallback_path) as sqlite_conn:
            wrapper = SQLiteDatabaseWrapper(sqlite_conn)
            
            while True:
                records = await wrapper.get_pending_sync_records(table_name, self.db_client.config.sync_batch_size)
                if not records:
                    break
                
                for record in records:
                    try:
                        # Remove SQLite-specific fields
                        sync_record = {k: v for k, v in record.items() 
                                     if k not in ['sync_status', 'sync_attempts', 'last_sync_attempt']}
                        
                        # Convert JSON strings back to objects for PostgreSQL
                        for json_field in ['data', 'metadata', 'environment', 'parameters', 'result', 'context_data', 'context_snapshot']:
                            if json_field in sync_record and isinstance(sync_record[json_field], str):
                                try:
                                    sync_record[json_field] = json.loads(sync_record[json_field])
                                except json.JSONDecodeError:
                                    pass
                        
                        # Insert into primary database
                        result = await self.db_client.primary_client.table(table_name).insert(sync_record).execute()
                        
                        if result.data:
                            # Mark as synced
                            await wrapper.update_sync_status(table_name, record['id'], 'synced')
                        else:
                            await wrapper.update_sync_status(table_name, record['id'], 'failed', 'Insert failed')
                            
                    except Exception as e:
                        print(f"Sync error for {table_name} record {record['id']}: {e}")
                        await wrapper.update_sync_status(table_name, record['id'], 'failed', str(e))
```

## Data Synchronization Strategies

### 1. Event-Driven Sync

```python
class SyncManager:
    def __init__(self, db_client: UnifiedDatabaseClient):
        self.db_client = db_client
        self.sync_queue = asyncio.Queue()
        self.batch_size = 50
        self.sync_interval = 10  # seconds
    
    async def queue_for_sync(self, table_name: str, record_id: str, operation: str = 'insert'):
        """Add record to sync queue"""
        await self.sync_queue.put({
            'table': table_name,
            'record_id': record_id,
            'operation': operation,
            'timestamp': asyncio.get_event_loop().time()
        })
    
    async def _sync_loop(self):
        """Background sync process"""
        while True:
            try:
                if self.db_client.status != DatabaseStatus.PRIMARY_CONNECTED:
                    await asyncio.sleep(self.sync_interval)
                    continue
                
                # Collect batch of sync items
                sync_batch = []
                deadline = asyncio.get_event_loop().time() + 5  # 5 second collection window
                
                while len(sync_batch) < self.batch_size and asyncio.get_event_loop().time() < deadline:
                    try:
                        item = await asyncio.wait_for(self.sync_queue.get(), timeout=1.0)
                        sync_batch.append(item)
                    except asyncio.TimeoutError:
                        break
                
                if sync_batch:
                    await self._process_sync_batch(sync_batch)
                
                await asyncio.sleep(1)  # Prevent tight loop
                
            except Exception as e:
                print(f"Sync loop error: {e}")
                await asyncio.sleep(5)
    
    async def _process_sync_batch(self, batch: List[Dict[str, Any]]):
        """Process a batch of sync operations"""
        # Group by table for efficient batch operations
        by_table = {}
        for item in batch:
            table = item['table']
            if table not in by_table:
                by_table[table] = []
            by_table[table].append(item)
        
        # Process each table
        for table_name, items in by_table.items():
            await self._sync_table_batch(table_name, items)
    
    async def _sync_table_batch(self, table_name: str, items: List[Dict[str, Any]]):
        """Sync a batch of records for a specific table"""
        async with aiosqlite.connect(self.db_client.fallback_path) as sqlite_conn:
            wrapper = SQLiteDatabaseWrapper(sqlite_conn)
            
            for item in items:
                try:
                    # Get record from SQLite
                    query = f"SELECT * FROM {table_name} WHERE id = ?"
                    async with sqlite_conn.execute(query, (item['record_id'],)) as cursor:
                        row = await cursor.fetchone()
                        if not row:
                            continue
                        
                        columns = [description[0] for description in cursor.description]
                        record = dict(zip(columns, row))
                    
                    # Sync to primary
                    await self._sync_single_record(table_name, record, wrapper)
                    
                except Exception as e:
                    print(f"Batch sync error for {table_name}.{item['record_id']}: {e}")
```

### 2. Conflict Resolution

```python
class ConflictResolver:
    def __init__(self, db_client: UnifiedDatabaseClient):
        self.db_client = db_client
    
    async def resolve_conflicts(self, table_name: str, local_record: Dict, remote_record: Dict) -> Dict:
        """Resolve conflicts between local and remote records"""
        
        # Strategy 1: Last-write-wins based on timestamp
        local_time = self._parse_timestamp(local_record.get('updated_at', local_record.get('created_at')))
        remote_time = self._parse_timestamp(remote_record.get('updated_at', remote_record.get('created_at')))
        
        if local_time > remote_time:
            return local_record
        elif remote_time > local_time:
            return remote_record
        else:
            # Strategy 2: Merge non-conflicting fields
            return self._merge_records(local_record, remote_record)
    
    def _parse_timestamp(self, timestamp_str: str) -> float:
        """Parse timestamp string to comparable float"""
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return dt.timestamp()
        except:
            return 0.0
    
    def _merge_records(self, local: Dict, remote: Dict) -> Dict:
        """Merge two records, preferring non-null values"""
        merged = remote.copy()
        
        for key, value in local.items():
            if value is not None and (key not in merged or merged[key] is None):
                merged[key] = value
        
        return merged
```

## Performance Optimization for SQLite

### 1. WAL Mode and Optimization

```python
class SQLiteOptimizer:
    @staticmethod
    async def optimize_database(db_path: str):
        """Apply performance optimizations to SQLite database"""
        async with aiosqlite.connect(db_path) as db:
            # Enable Write-Ahead Logging for better concurrency
            await db.execute("PRAGMA journal_mode = WAL")
            
            # Optimize synchronization for speed
            await db.execute("PRAGMA synchronous = NORMAL")
            
            # Increase cache size (pages)
            await db.execute("PRAGMA cache_size = 10000")
            
            # Store temporary tables in memory
            await db.execute("PRAGMA temp_store = MEMORY")
            
            # Optimize for frequent writes
            await db.execute("PRAGMA wal_autocheckpoint = 1000")
            
            # Analyze query optimizer statistics
            await db.execute("ANALYZE")
            
            await db.commit()
    
    @staticmethod
    async def maintenance_tasks(db_path: str):
        """Perform regular maintenance on SQLite database"""
        async with aiosqlite.connect(db_path) as db:
            # Reclaim deleted space
            await db.execute("VACUUM")
            
            # Update query optimizer statistics
            await db.execute("ANALYZE")
            
            # Check database integrity
            async with db.execute("PRAGMA integrity_check") as cursor:
                result = await cursor.fetchone()
                if result[0] != 'ok':
                    print(f"Database integrity issue: {result[0]}")
            
            await db.commit()
```

### 2. Connection Pooling for SQLite

```python
import asyncio
from contextlib import asynccontextmanager

class SQLiteConnectionPool:
    def __init__(self, db_path: str, max_connections: int = 10):
        self.db_path = db_path
        self.max_connections = max_connections
        self.pool = asyncio.Queue(maxsize=max_connections)
        self.created_connections = 0
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        """Initialize the connection pool"""
        # Pre-create some connections
        for _ in range(min(3, self.max_connections)):
            conn = await self._create_connection()
            await self.pool.put(conn)
    
    async def _create_connection(self) -> aiosqlite.Connection:
        """Create a new optimized SQLite connection"""
        conn = await aiosqlite.connect(
            self.db_path,
            timeout=20.0,
            isolation_level=None  # Enable autocommit mode
        )
        
        # Apply optimizations
        await conn.execute("PRAGMA journal_mode = WAL")
        await conn.execute("PRAGMA synchronous = NORMAL")
        await conn.execute("PRAGMA cache_size = 1000")
        await conn.execute("PRAGMA temp_store = MEMORY")
        await conn.execute("PRAGMA foreign_keys = ON")
        
        self.created_connections += 1
        return conn
    
    @asynccontextmanager
    async def get_connection(self):
        """Get a connection from the pool"""
        try:
            # Try to get existing connection
            conn = await asyncio.wait_for(self.pool.get(), timeout=1.0)
        except asyncio.TimeoutError:
            # Create new connection if pool is empty and under limit
            async with self._lock:
                if self.created_connections < self.max_connections:
                    conn = await self._create_connection()
                else:
                    # Wait for connection to become available
                    conn = await self.pool.get()
        
        try:
            yield conn
        finally:
            # Return connection to pool
            try:
                self.pool.put_nowait(conn)
            except asyncio.QueueFull:
                # Pool is full, close connection
                await conn.close()
                self.created_connections -= 1
    
    async def close_all(self):
        """Close all connections in the pool"""
        while not self.pool.empty():
            try:
                conn = self.pool.get_nowait()
                await conn.close()
            except asyncio.QueueEmpty:
                break
        self.created_connections = 0
```

## Usage Examples

### 1. Basic Failover Usage

```python
# Initialize unified database client
config = DatabaseConfig(
    primary_url=os.getenv("SUPABASE_URL"),
    fallback_path="./data/chronicle_fallback.db",
    health_check_interval=30,
    sync_batch_size=100
)

db_client = UnifiedDatabaseClient(config)
await db_client.initialize()

# Use database (automatically handles failover)
async with db_client.get_connection() as conn:
    event_id = await conn.insert_event({
        'session_id': 'session_123',
        'event_type': 'tool_pre_use',
        'source_app': 'claude_code',
        'data': {'tool_name': 'Edit', 'parameters': {'file': 'test.py'}},
        'timestamp': datetime.now().isoformat()
    })

# Cleanup
await db_client.close()
```

### 2. Manual Sync Trigger

```python
# Force immediate sync of pending records
sync_manager = SyncManager(db_client)
await sync_manager.sync_all_pending()

# Monitor sync status
sync_stats = await sync_manager.get_sync_statistics()
print(f"Pending records: {sync_stats['pending_count']}")
print(f"Failed syncs: {sync_stats['failed_count']}")
```

This comprehensive SQLite fallback system ensures data persistence and automatic recovery while maintaining compatibility with the primary Supabase PostgreSQL database.