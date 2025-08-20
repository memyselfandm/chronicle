# Database Migrations & Connection Pooling Reference for Chronicle MVP

## Overview

This guide covers database migration strategies, version management, and connection pooling for the Chronicle observability system, supporting both PostgreSQL (Supabase) and SQLite environments with automated migration tools and performance optimization.

## Migration Framework Architecture

### 1. Migration Management System

```python
import os
import asyncio
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import aiosqlite
import asyncpg
from pathlib import Path

@dataclass
class Migration:
    version: str
    name: str
    sql_content: str
    checksum: str
    applied_at: Optional[datetime] = None
    execution_time_ms: Optional[int] = None

class MigrationManager:
    def __init__(self, migration_dir: str, db_client):
        self.migration_dir = Path(migration_dir)
        self.db_client = db_client
        self.postgres_migrations = self.migration_dir / "postgres"
        self.sqlite_migrations = self.migration_dir / "sqlite"
        
        # Ensure directories exist
        self.postgres_migrations.mkdir(parents=True, exist_ok=True)
        self.sqlite_migrations.mkdir(parents=True, exist_ok=True)
    
    async def initialize_migration_table(self):
        """Create migration tracking table if it doesn't exist"""
        postgres_schema = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            execution_time_ms INTEGER,
            database_type VARCHAR(20) DEFAULT 'postgres'
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied 
        ON schema_migrations(applied_at DESC);
        """
        
        sqlite_schema = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            checksum TEXT NOT NULL,
            applied_at TEXT DEFAULT (datetime('now')),
            execution_time_ms INTEGER,
            database_type TEXT DEFAULT 'sqlite'
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied 
        ON schema_migrations(applied_at DESC);
        """
        
        # Apply to both database types
        await self._execute_on_primary(postgres_schema)
        await self._execute_on_sqlite(sqlite_schema)
    
    async def _execute_on_primary(self, sql: str):
        """Execute SQL on primary PostgreSQL database"""
        if hasattr(self.db_client, 'pool') and self.db_client.pool:
            async with self.db_client.get_connection() as conn:
                await conn.execute(sql)
        else:
            # Fallback to Supabase client
            # Note: Direct SQL execution through Supabase client
            pass
    
    async def _execute_on_sqlite(self, sql: str):
        """Execute SQL on SQLite database"""
        async with aiosqlite.connect(self.db_client.fallback_path) as conn:
            await conn.executescript(sql)
            await conn.commit()
    
    def discover_migrations(self, db_type: str = "postgres") -> List[Migration]:
        """Discover migration files in the specified directory"""
        migration_path = self.postgres_migrations if db_type == "postgres" else self.sqlite_migrations
        migrations = []
        
        for file_path in sorted(migration_path.glob("*.sql")):
            # Parse filename: V001__initial_schema.sql
            filename = file_path.stem
            if not filename.startswith("V"):
                continue
            
            parts = filename.split("__", 1)
            if len(parts) != 2:
                continue
            
            version = parts[0][1:]  # Remove 'V' prefix
            name = parts[1].replace("_", " ").title()
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            checksum = hashlib.sha256(content.encode('utf-8')).hexdigest()
            
            migrations.append(Migration(
                version=version,
                name=name,
                sql_content=content,
                checksum=checksum
            ))
        
        return migrations
    
    async def get_applied_migrations(self, db_type: str = "postgres") -> List[str]:
        """Get list of applied migration versions"""
        query = "SELECT version FROM schema_migrations WHERE database_type = ? ORDER BY version"
        
        if db_type == "postgres":
            async with self.db_client.get_connection() as conn:
                rows = await conn.fetch(query.replace("?", "$1"), db_type)
                return [row['version'] for row in rows]
        else:
            async with aiosqlite.connect(self.db_client.fallback_path) as conn:
                async with conn.execute(query, (db_type,)) as cursor:
                    rows = await cursor.fetchall()
                    return [row[0] for row in rows]
    
    async def apply_migration(self, migration: Migration, db_type: str = "postgres") -> bool:
        """Apply a single migration"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            if db_type == "postgres":
                await self._apply_postgres_migration(migration)
            else:
                await self._apply_sqlite_migration(migration)
            
            # Record successful migration
            execution_time = int((asyncio.get_event_loop().time() - start_time) * 1000)
            await self._record_migration(migration, db_type, execution_time)
            
            print(f"✓ Applied migration {migration.version}: {migration.name} ({execution_time}ms)")
            return True
            
        except Exception as e:
            print(f"✗ Failed to apply migration {migration.version}: {e}")
            return False
    
    async def _apply_postgres_migration(self, migration: Migration):
        """Apply migration to PostgreSQL"""
        async with self.db_client.get_connection() as conn:
            async with conn.transaction():
                await conn.execute(migration.sql_content)
    
    async def _apply_sqlite_migration(self, migration: Migration):
        """Apply migration to SQLite"""
        async with aiosqlite.connect(self.db_client.fallback_path) as conn:
            await conn.executescript(migration.sql_content)
            await conn.commit()
    
    async def _record_migration(self, migration: Migration, db_type: str, execution_time_ms: int):
        """Record successful migration in tracking table"""
        query = """
        INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, database_type)
        VALUES (?, ?, ?, ?, ?)
        """
        params = (migration.version, migration.name, migration.checksum, execution_time_ms, db_type)
        
        if db_type == "postgres":
            pg_query = query.replace("?", "$1").replace("$1", "$1").replace("$1", "$2").replace("$2", "$3").replace("$3", "$4").replace("$4", "$5")
            pg_query = "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, database_type) VALUES ($1, $2, $3, $4, $5)"
            async with self.db_client.get_connection() as conn:
                await conn.execute(pg_query, *params)
        else:
            async with aiosqlite.connect(self.db_client.fallback_path) as conn:
                await conn.execute(query, params)
                await conn.commit()
    
    async def migrate_up(self, target_version: str = None, db_type: str = "postgres") -> bool:
        """Apply pending migrations up to target version"""
        await self.initialize_migration_table()
        
        available_migrations = self.discover_migrations(db_type)
        applied_versions = set(await self.get_applied_migrations(db_type))
        
        pending_migrations = [
            m for m in available_migrations 
            if m.version not in applied_versions and (not target_version or m.version <= target_version)
        ]
        
        if not pending_migrations:
            print(f"No pending migrations for {db_type}")
            return True
        
        print(f"Applying {len(pending_migrations)} migration(s) to {db_type}...")
        
        success_count = 0
        for migration in pending_migrations:
            if await self.apply_migration(migration, db_type):
                success_count += 1
            else:
                print(f"Migration failed, stopping at {migration.version}")
                break
        
        print(f"Applied {success_count}/{len(pending_migrations)} migrations successfully")
        return success_count == len(pending_migrations)
```

### 2. Migration Generation Tools

```python
class MigrationGenerator:
    def __init__(self, migration_manager: MigrationManager):
        self.migration_manager = migration_manager
    
    def generate_migration(self, name: str, sql_content: str = None) -> str:
        """Generate a new migration file"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        version = timestamp
        
        safe_name = name.lower().replace(" ", "_").replace("-", "_")
        filename = f"V{version}__{safe_name}.sql"
        
        if sql_content is None:
            sql_content = self._generate_template(name)
        
        # Create both PostgreSQL and SQLite versions
        self._write_migration_file(self.migration_manager.postgres_migrations / filename, sql_content)
        self._write_migration_file(self.migration_manager.sqlite_migrations / filename, self._adapt_for_sqlite(sql_content))
        
        print(f"Generated migration: {filename}")
        return version
    
    def _generate_template(self, name: str) -> str:
        """Generate a basic migration template"""
        return f"""-- Migration: {name}
-- Created: {datetime.now().isoformat()}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE example (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Remember to create indexes:
-- CREATE INDEX idx_example_name ON example(name);
"""
    
    def _adapt_for_sqlite(self, postgres_sql: str) -> str:
        """Adapt PostgreSQL SQL for SQLite compatibility"""
        adaptations = [
            ("UUID PRIMARY KEY DEFAULT uuid_generate_v4()", "TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))"),
            ("TIMESTAMP WITH TIME ZONE DEFAULT NOW()", "TEXT DEFAULT (datetime('now'))"),
            ("TIMESTAMP WITH TIME ZONE", "TEXT"),
            ("BOOLEAN", "INTEGER"),
            ("JSONB", "TEXT"),
            ("CREATE INDEX CONCURRENTLY", "CREATE INDEX IF NOT EXISTS"),
            ("ON DELETE CASCADE", "ON DELETE CASCADE"),
            ("SERIAL", "INTEGER"),
            ("BIGSERIAL", "INTEGER")
        ]
        
        adapted_sql = postgres_sql
        for postgres_syntax, sqlite_syntax in adaptations:
            adapted_sql = adapted_sql.replace(postgres_syntax, sqlite_syntax)
        
        return adapted_sql
    
    def _write_migration_file(self, file_path: Path, content: str):
        """Write migration content to file"""
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def generate_rollback_migration(self, version: str, rollback_sql: str) -> str:
        """Generate a rollback migration"""
        rollback_name = f"rollback_{version}"
        return self.generate_migration(rollback_name, rollback_sql)
```

## Advanced Connection Pooling

### 1. PostgreSQL Connection Pool

```python
import asyncpg
from typing import Optional, Dict, Any
import asyncio
import time
from contextlib import asynccontextmanager

class PostgreSQLConnectionPool:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'connections_created': 0,
            'connections_closed': 0,
            'queries_executed': 0,
            'total_query_time': 0.0,
            'avg_query_time': 0.0,
            'last_health_check': 0
        }
    
    async def initialize(self) -> bool:
        """Initialize the connection pool with optimized settings"""
        try:
            self.pool = await asyncpg.create_pool(
                host=self.config['host'],
                port=self.config['port'],
                database=self.config['database'],
                user=self.config['user'],
                password=self.config['password'],
                min_size=self.config.get('min_connections', 5),
                max_size=self.config.get('max_connections', 20),
                max_queries=self.config.get('max_queries', 50000),
                max_inactive_connection_lifetime=self.config.get('max_inactive_lifetime', 300.0),
                timeout=self.config.get('connection_timeout', 60.0),
                command_timeout=self.config.get('command_timeout', 30.0),
                server_settings={
                    'application_name': 'chronicle_observability',
                    'search_path': 'public',
                    'timezone': 'UTC',
                    'statement_timeout': '30s',
                    'lock_timeout': '10s',
                    'idle_in_transaction_session_timeout': '60s',
                    'log_statement': 'none',  # Disable query logging for performance
                    'log_min_duration_statement': '1000',  # Log slow queries only
                    'shared_preload_libraries': 'pg_stat_statements',
                    'track_activity_query_size': '16384'
                },
                setup=self._setup_connection,
                init=self._init_connection
            )
            
            print(f"PostgreSQL pool initialized with {self.pool.get_min_size()}-{self.pool.get_max_size()} connections")
            return True
            
        except Exception as e:
            print(f"Failed to initialize PostgreSQL pool: {e}")
            return False
    
    async def _setup_connection(self, connection: asyncpg.Connection):
        """Setup callback for each new connection"""
        self.stats['connections_created'] += 1
        
        # Set connection-level optimizations
        await connection.execute("SET work_mem = '256MB'")
        await connection.execute("SET maintenance_work_mem = '512MB'")
        await connection.execute("SET random_page_cost = 1.1")
        await connection.execute("SET effective_cache_size = '4GB'")
    
    async def _init_connection(self, connection: asyncpg.Connection):
        """Initialize callback for each connection"""
        # Set up custom types if needed
        await connection.set_type_codec(
            'jsonb',
            encoder=lambda x: x,  # Use as-is
            decoder=lambda x: x   # Use as-is
        )
    
    @asynccontextmanager
    async def get_connection(self, timeout: float = 30.0):
        """Get a connection from the pool with performance tracking"""
        if not self.pool:
            raise RuntimeError("Connection pool not initialized")
        
        start_time = time.perf_counter()
        
        try:
            async with self.pool.acquire(timeout=timeout) as connection:
                yield ConnectionWrapper(connection, self.stats)
        except asyncio.TimeoutError:
            print(f"Connection acquisition timeout after {timeout}s")
            raise
        except Exception as e:
            print(f"Connection error: {e}")
            raise
        finally:
            acquisition_time = time.perf_counter() - start_time
            if acquisition_time > 1.0:  # Log slow acquisitions
                print(f"Slow connection acquisition: {acquisition_time:.2f}s")
    
    async def execute_batch(self, query: str, parameters: List[tuple], batch_size: int = 1000):
        """Execute batch operations efficiently"""
        async with self.get_connection() as conn:
            # Use executemany for better performance
            await conn.executemany(query, parameters[:batch_size])
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on the connection pool"""
        try:
            async with self.get_connection(timeout=5.0) as conn:
                result = await conn.fetchval("SELECT 1")
                
                pool_status = {
                    'status': 'healthy' if result == 1 else 'unhealthy',
                    'pool_size': self.pool.get_size(),
                    'idle_connections': self.pool.get_idle_size(),
                    'used_connections': self.pool.get_size() - self.pool.get_idle_size(),
                    'stats': self.stats.copy()
                }
                
                self.stats['last_health_check'] = time.time()
                return pool_status
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'stats': self.stats.copy()
            }
    
    async def close(self):
        """Close the connection pool"""
        if self.pool:
            await self.pool.close()
            self.stats['connections_closed'] = self.stats['connections_created']
            print("PostgreSQL connection pool closed")

class ConnectionWrapper:
    """Wrapper to track query performance"""
    def __init__(self, connection: asyncpg.Connection, stats: Dict[str, Any]):
        self.connection = connection
        self.stats = stats
    
    async def execute(self, query: str, *args, timeout: float = None):
        """Execute query with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.execute(query, *args, timeout=timeout)
            return result
        finally:
            self._update_stats(start_time)
    
    async def fetch(self, query: str, *args, timeout: float = None):
        """Fetch query with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.fetch(query, *args, timeout=timeout)
            return result
        finally:
            self._update_stats(start_time)
    
    async def fetchval(self, query: str, *args, timeout: float = None):
        """Fetch single value with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.fetchval(query, *args, timeout=timeout)
            return result
        finally:
            self._update_stats(start_time)
    
    async def fetchrow(self, query: str, *args, timeout: float = None):
        """Fetch single row with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.fetchrow(query, *args, timeout=timeout)
            return result
        finally:
            self._update_stats(start_time)
    
    async def executemany(self, query: str, args, timeout: float = None):
        """Execute many with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.executemany(query, args, timeout=timeout)
            return result
        finally:
            self._update_stats(start_time)
    
    def _update_stats(self, start_time: float):
        """Update performance statistics"""
        query_time = time.perf_counter() - start_time
        self.stats['queries_executed'] += 1
        self.stats['total_query_time'] += query_time
        self.stats['avg_query_time'] = self.stats['total_query_time'] / self.stats['queries_executed']
    
    def __getattr__(self, name):
        """Delegate other methods to the wrapped connection"""
        return getattr(self.connection, name)
```

### 2. SQLite Connection Pool

```python
import aiosqlite
import asyncio
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import threading
import time

class SQLiteConnectionPool:
    def __init__(self, db_path: str, max_connections: int = 10):
        self.db_path = db_path
        self.max_connections = max_connections
        self.pool: asyncio.Queue = asyncio.Queue(maxsize=max_connections)
        self.created_connections = 0
        self.lock = asyncio.Lock()
        self.stats = {
            'connections_created': 0,
            'connections_reused': 0,
            'queries_executed': 0,
            'total_query_time': 0.0,
            'avg_query_time': 0.0
        }
    
    async def initialize(self):
        """Initialize the connection pool"""
        # Pre-create some connections
        initial_connections = min(3, self.max_connections)
        for _ in range(initial_connections):
            conn = await self._create_connection()
            await self.pool.put(conn)
    
    async def _create_connection(self) -> aiosqlite.Connection:
        """Create an optimized SQLite connection"""
        conn = await aiosqlite.connect(
            self.db_path,
            timeout=20.0,
            isolation_level=None  # Enable autocommit mode
        )
        
        # Apply performance optimizations
        await conn.execute("PRAGMA journal_mode = WAL")
        await conn.execute("PRAGMA synchronous = NORMAL")
        await conn.execute("PRAGMA cache_size = 2000")
        await conn.execute("PRAGMA temp_store = MEMORY")
        await conn.execute("PRAGMA mmap_size = 268435456")  # 256MB
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA busy_timeout = 5000")  # 5 second timeout
        
        self.created_connections += 1
        self.stats['connections_created'] += 1
        return conn
    
    @asynccontextmanager
    async def get_connection(self, timeout: float = 30.0):
        """Get a connection from the pool"""
        conn = None
        try:
            # Try to get existing connection
            try:
                conn = await asyncio.wait_for(self.pool.get(), timeout=1.0)
                self.stats['connections_reused'] += 1
            except asyncio.TimeoutError:
                # Create new connection if pool is empty and under limit
                async with self.lock:
                    if self.created_connections < self.max_connections:
                        conn = await self._create_connection()
                    else:
                        # Wait for connection to become available
                        conn = await asyncio.wait_for(self.pool.get(), timeout=timeout)
                        self.stats['connections_reused'] += 1
            
            yield SQLiteConnectionWrapper(conn, self.stats)
            
        finally:
            if conn:
                # Return connection to pool
                try:
                    self.pool.put_nowait(conn)
                except asyncio.QueueFull:
                    # Pool is full, close connection
                    await conn.close()
                    self.created_connections -= 1
    
    async def execute_batch(self, query: str, parameters: List[tuple], batch_size: int = 1000):
        """Execute batch operations efficiently using transactions"""
        async with self.get_connection() as conn:
            await conn.execute("BEGIN TRANSACTION")
            try:
                for i in range(0, len(parameters), batch_size):
                    batch = parameters[i:i + batch_size]
                    await conn.executemany(query, batch)
                await conn.execute("COMMIT")
            except Exception:
                await conn.execute("ROLLBACK")
                raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on SQLite database"""
        try:
            async with self.get_connection(timeout=5.0) as conn:
                # Test basic query
                result = await conn.fetchval("SELECT 1")
                
                # Check database integrity
                integrity_result = await conn.fetchval("PRAGMA integrity_check")
                
                return {
                    'status': 'healthy' if result == 1 and integrity_result == 'ok' else 'unhealthy',
                    'pool_size': self.created_connections,
                    'available_connections': self.pool.qsize(),
                    'integrity_check': integrity_result,
                    'stats': self.stats.copy()
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'stats': self.stats.copy()
            }
    
    async def optimize_database(self):
        """Perform optimization operations"""
        async with self.get_connection() as conn:
            # Analyze for query optimization
            await conn.execute("ANALYZE")
            
            # Optimize database file
            await conn.execute("PRAGMA optimize")
            
            # Get database info
            page_count = await conn.fetchval("PRAGMA page_count")
            page_size = await conn.fetchval("PRAGMA page_size")
            
            print(f"SQLite database optimized: {page_count} pages, {page_size} bytes per page")
    
    async def close_all(self):
        """Close all connections in the pool"""
        while not self.pool.empty():
            try:
                conn = self.pool.get_nowait()
                await conn.close()
            except asyncio.QueueEmpty:
                break
        self.created_connections = 0

class SQLiteConnectionWrapper:
    """Wrapper for SQLite connections with performance tracking"""
    def __init__(self, connection: aiosqlite.Connection, stats: Dict[str, Any]):
        self.connection = connection
        self.stats = stats
    
    async def execute(self, query: str, parameters=None):
        """Execute query with performance tracking"""
        start_time = time.perf_counter()
        try:
            if parameters:
                result = await self.connection.execute(query, parameters)
            else:
                result = await self.connection.execute(query)
            await self.connection.commit()
            return result
        finally:
            self._update_stats(start_time)
    
    async def executemany(self, query: str, parameters):
        """Execute many with performance tracking"""
        start_time = time.perf_counter()
        try:
            result = await self.connection.executemany(query, parameters)
            await self.connection.commit()
            return result
        finally:
            self._update_stats(start_time)
    
    async def fetchval(self, query: str, parameters=None):
        """Fetch single value with performance tracking"""
        start_time = time.perf_counter()
        try:
            async with self.connection.execute(query, parameters or ()) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else None
        finally:
            self._update_stats(start_time)
    
    async def fetchone(self, query: str, parameters=None):
        """Fetch single row with performance tracking"""
        start_time = time.perf_counter()
        try:
            async with self.connection.execute(query, parameters or ()) as cursor:
                return await cursor.fetchone()
        finally:
            self._update_stats(start_time)
    
    async def fetchall(self, query: str, parameters=None):
        """Fetch all rows with performance tracking"""
        start_time = time.perf_counter()
        try:
            async with self.connection.execute(query, parameters or ()) as cursor:
                return await cursor.fetchall()
        finally:
            self._update_stats(start_time)
    
    def _update_stats(self, start_time: float):
        """Update performance statistics"""
        query_time = time.perf_counter() - start_time
        self.stats['queries_executed'] += 1
        self.stats['total_query_time'] += query_time
        self.stats['avg_query_time'] = self.stats['total_query_time'] / self.stats['queries_executed']
    
    def __getattr__(self, name):
        """Delegate other methods to the wrapped connection"""
        return getattr(self.connection, name)
```

## Migration Versioning Strategies

### 1. Semantic Versioning for Migrations

```python
import re
from typing import Tuple, List, Optional
from dataclasses import dataclass

@dataclass
class MigrationVersion:
    major: int
    minor: int
    patch: int
    timestamp: str
    
    @classmethod
    def parse(cls, version_string: str) -> 'MigrationVersion':
        """Parse version string in format: MAJOR.MINOR.PATCH_TIMESTAMP"""
        # Example: 1.0.0_20240101120000
        pattern = r'(\d+)\.(\d+)\.(\d+)_(\d{14})'
        match = re.match(pattern, version_string)
        
        if not match:
            # Fallback to timestamp-only format
            if re.match(r'\d{14}', version_string):
                return cls(0, 0, 0, version_string)
            raise ValueError(f"Invalid version format: {version_string}")
        
        return cls(
            major=int(match.group(1)),
            minor=int(match.group(2)),
            patch=int(match.group(3)),
            timestamp=match.group(4)
        )
    
    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}_{self.timestamp}"
    
    def __lt__(self, other: 'MigrationVersion') -> bool:
        if self.major != other.major:
            return self.major < other.major
        if self.minor != other.minor:
            return self.minor < other.minor
        if self.patch != other.patch:
            return self.patch < other.patch
        return self.timestamp < other.timestamp

class VersionedMigrationManager(MigrationManager):
    def __init__(self, migration_dir: str, db_client):
        super().__init__(migration_dir, db_client)
        self.current_version = MigrationVersion(1, 0, 0, "")
    
    def generate_version(self, version_type: str = "patch") -> str:
        """Generate next version number"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        if version_type == "major":
            next_version = MigrationVersion(
                self.current_version.major + 1, 0, 0, timestamp
            )
        elif version_type == "minor":
            next_version = MigrationVersion(
                self.current_version.major, self.current_version.minor + 1, 0, timestamp
            )
        else:  # patch
            next_version = MigrationVersion(
                self.current_version.major, self.current_version.minor, 
                self.current_version.patch + 1, timestamp
            )
        
        self.current_version = next_version
        return str(next_version)
    
    async def get_migration_history(self, db_type: str = "postgres") -> List[Dict[str, Any]]:
        """Get detailed migration history with performance metrics"""
        query = """
        SELECT version, name, applied_at, execution_time_ms, checksum
        FROM schema_migrations 
        WHERE database_type = ?
        ORDER BY applied_at DESC
        """
        
        if db_type == "postgres":
            async with self.db_client.get_connection() as conn:
                rows = await conn.fetch(query.replace("?", "$1"), db_type)
                return [dict(row) for row in rows]
        else:
            async with aiosqlite.connect(self.db_client.fallback_path) as conn:
                async with conn.execute(query, (db_type,)) as cursor:
                    columns = [description[0] for description in cursor.description]
                    rows = await cursor.fetchall()
                    return [dict(zip(columns, row)) for row in rows]
```

## Performance Monitoring

### 1. Database Performance Monitor

```python
import psutil
import asyncio
from typing import Dict, Any, List
import time

class DatabasePerformanceMonitor:
    def __init__(self, postgres_pool: PostgreSQLConnectionPool, sqlite_pool: SQLiteConnectionPool):
        self.postgres_pool = postgres_pool
        self.sqlite_pool = sqlite_pool
        self.monitoring_active = False
        self.metrics_history: List[Dict[str, Any]] = []
        self.max_history = 1000
    
    async def start_monitoring(self, interval: int = 60):
        """Start continuous performance monitoring"""
        self.monitoring_active = True
        
        while self.monitoring_active:
            try:
                metrics = await self.collect_metrics()
                self.metrics_history.append(metrics)
                
                # Keep history size manageable
                if len(self.metrics_history) > self.max_history:
                    self.metrics_history = self.metrics_history[-self.max_history:]
                
                # Log warning for poor performance
                if metrics['postgres']['avg_query_time'] > 1000:  # > 1 second
                    print(f"WARNING: High PostgreSQL query time: {metrics['postgres']['avg_query_time']:.2f}ms")
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                print(f"Monitoring error: {e}")
                await asyncio.sleep(10)
    
    async def collect_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive performance metrics"""
        timestamp = time.time()
        
        # System metrics
        system_metrics = {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_usage': psutil.disk_usage('/').percent
        }
        
        # Database-specific metrics
        postgres_health = await self.postgres_pool.health_check()
        sqlite_health = await self.sqlite_pool.health_check()
        
        return {
            'timestamp': timestamp,
            'system': system_metrics,
            'postgres': postgres_health,
            'sqlite': sqlite_health
        }
    
    def get_performance_summary(self, time_window: int = 3600) -> Dict[str, Any]:
        """Get performance summary for the specified time window (seconds)"""
        cutoff_time = time.time() - time_window
        recent_metrics = [m for m in self.metrics_history if m['timestamp'] > cutoff_time]
        
        if not recent_metrics:
            return {'error': 'No metrics available for the specified time window'}
        
        # Calculate averages
        avg_postgres_query_time = sum(m['postgres']['stats']['avg_query_time'] for m in recent_metrics) / len(recent_metrics)
        avg_sqlite_query_time = sum(m['sqlite']['stats']['avg_query_time'] for m in recent_metrics) / len(recent_metrics)
        
        total_postgres_queries = sum(m['postgres']['stats']['queries_executed'] for m in recent_metrics)
        total_sqlite_queries = sum(m['sqlite']['stats']['queries_executed'] for m in recent_metrics)
        
        return {
            'time_window_hours': time_window / 3600,
            'postgres': {
                'avg_query_time_ms': avg_postgres_query_time * 1000,
                'total_queries': total_postgres_queries,
                'queries_per_second': total_postgres_queries / time_window
            },
            'sqlite': {
                'avg_query_time_ms': avg_sqlite_query_time * 1000,
                'total_queries': total_sqlite_queries,
                'queries_per_second': total_sqlite_queries / time_window
            }
        }
    
    def stop_monitoring(self):
        """Stop performance monitoring"""
        self.monitoring_active = False
```

## Usage Examples

### 1. Complete Migration Workflow

```python
async def setup_database_with_migrations():
    """Complete database setup with migrations"""
    
    # Configuration
    postgres_config = {
        'host': 'localhost',
        'port': 5432,
        'database': 'chronicle',
        'user': 'postgres',
        'password': 'password',
        'min_connections': 5,
        'max_connections': 20
    }
    
    # Initialize connection pools
    postgres_pool = PostgreSQLConnectionPool(postgres_config)
    await postgres_pool.initialize()
    
    sqlite_pool = SQLiteConnectionPool('./data/chronicle.db')
    await sqlite_pool.initialize()
    
    # Create unified database client
    class MockDatabaseClient:
        def __init__(self):
            self.pool = postgres_pool.pool
            self.fallback_path = './data/chronicle.db'
        
        async def get_connection(self):
            return postgres_pool.get_connection()
    
    db_client = MockDatabaseClient()
    
    # Initialize migration manager
    migration_manager = VersionedMigrationManager('./migrations', db_client)
    
    # Run migrations
    print("Running PostgreSQL migrations...")
    await migration_manager.migrate_up(db_type="postgres")
    
    print("Running SQLite migrations...")
    await migration_manager.migrate_up(db_type="sqlite")
    
    # Start performance monitoring
    monitor = DatabasePerformanceMonitor(postgres_pool, sqlite_pool)
    asyncio.create_task(monitor.start_monitoring(interval=30))
    
    return db_client, migration_manager, monitor

# Generate new migration
async def create_new_migration():
    """Example of creating a new migration"""
    migration_manager = VersionedMigrationManager('./migrations', None)
    generator = MigrationGenerator(migration_manager)
    
    sql_content = """
    -- Add performance monitoring table
    CREATE TABLE performance_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(10,4),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
    );
    
    CREATE INDEX idx_performance_metrics_name_time 
    ON performance_metrics(metric_name, recorded_at DESC);
    """
    
    version = generator.generate_migration("add_performance_metrics", sql_content)
    print(f"Created migration version: {version}")
```

This comprehensive migration and connection pooling system provides enterprise-grade database management with automated failover, performance monitoring, and version control for the Chronicle observability system.