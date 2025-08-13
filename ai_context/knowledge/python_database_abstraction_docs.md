# Python Database Abstraction Layer Documentation

## Overview

This documentation covers database abstraction patterns for supporting multiple backends with automatic failover between Supabase (PostgreSQL) and SQLite. The architecture enables seamless switching between cloud and local storage with consistent interfaces.

## Core Architecture

### 1. Database Client Interface

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union
import asyncio
from contextlib import asynccontextmanager

class DatabaseClient(ABC):
    """Abstract database client interface."""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish database connection."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close database connection."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if database is healthy and accessible."""
        pass
    
    @abstractmethod
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[str]:
        """Insert data and return record ID."""
        pass
    
    @abstractmethod
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple records and return IDs."""
        pass
    
    @abstractmethod
    async def select(self, table: str, filters: Dict[str, Any] = None,
                    limit: int = None, offset: int = None) -> List[Dict[str, Any]]:
        """Select records with optional filtering and pagination."""
        pass
    
    @abstractmethod
    async def update(self, table: str, record_id: str, 
                    data: Dict[str, Any]) -> bool:
        """Update a record by ID."""
        pass
    
    @abstractmethod
    async def delete(self, table: str, record_id: str) -> bool:
        """Delete a record by ID."""
        pass
    
    @abstractmethod
    async def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute raw query with parameters."""
        pass
    
    @property
    @abstractmethod
    def client_type(self) -> str:
        """Return the client type identifier."""
        pass
```

### 2. Supabase Client Implementation

```python
import os
from supabase import create_client, Client
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime

class SupabaseClient(DatabaseClient):
    """Supabase PostgreSQL client implementation."""
    
    def __init__(self, url: str = None, key: str = None):
        self.url = url or os.getenv('SUPABASE_URL')
        self.key = key or os.getenv('SUPABASE_ANON_KEY')
        self.client: Optional[Client] = None
        self.connected = False
        
        if not self.url or not self.key:
            raise ValueError("Supabase URL and key are required")
    
    async def connect(self) -> bool:
        """Establish connection to Supabase."""
        try:
            self.client = create_client(self.url, self.key)
            # Test connection with a simple query
            await self._test_connection()
            self.connected = True
            return True
        except Exception as e:
            print(f"Supabase connection failed: {e}")
            self.connected = False
            return False
    
    async def _test_connection(self) -> None:
        """Test connection with a lightweight query."""
        if not self.client:
            raise ConnectionError("Client not initialized")
        
        # Test with a simple select that should work on any Supabase instance
        result = await asyncio.to_thread(
            lambda: self.client.table('sessions').select('id').limit(1).execute()
        )
        # Connection successful if no exception raised
    
    async def disconnect(self) -> None:
        """Close Supabase connection."""
        if self.client:
            # Supabase client doesn't require explicit disconnection
            self.client = None
            self.connected = False
    
    async def health_check(self) -> bool:
        """Check Supabase service health."""
        if not self.connected or not self.client:
            return False
        
        try:
            await self._test_connection()
            return True
        except Exception:
            self.connected = False
            return False
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[str]:
        """Insert data into Supabase table."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            # Add timestamp if not present
            if 'created_at' not in data:
                data['created_at'] = datetime.utcnow().isoformat()
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).insert(data).execute()
            )
            
            if result.data and len(result.data) > 0:
                # Return the ID of the inserted record
                return str(result.data[0].get('id'))
            return None
            
        except Exception as e:
            raise DatabaseError(f"Supabase insert failed: {e}")
    
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple records into Supabase."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            # Add timestamps to all records
            for record in data:
                if 'created_at' not in record:
                    record['created_at'] = datetime.utcnow().isoformat()
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).insert(data).execute()
            )
            
            return [str(record.get('id')) for record in result.data or []]
            
        except Exception as e:
            raise DatabaseError(f"Supabase bulk insert failed: {e}")
    
    async def select(self, table: str, filters: Dict[str, Any] = None,
                    limit: int = None, offset: int = None) -> List[Dict[str, Any]]:
        """Select records from Supabase table."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            query = self.client.table(table).select('*')
            
            # Apply filters
            if filters:
                for key, value in filters.items():
                    if isinstance(value, list):
                        query = query.in_(key, value)
                    else:
                        query = query.eq(key, value)
            
            # Apply pagination
            if limit:
                query = query.limit(limit)
            if offset:
                query = query.offset(offset)
            
            result = await asyncio.to_thread(lambda: query.execute())
            return result.data or []
            
        except Exception as e:
            raise DatabaseError(f"Supabase select failed: {e}")
    
    async def update(self, table: str, record_id: str, data: Dict[str, Any]) -> bool:
        """Update record in Supabase table."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            data['updated_at'] = datetime.utcnow().isoformat()
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).update(data).eq('id', record_id).execute()
            )
            
            return len(result.data or []) > 0
            
        except Exception as e:
            raise DatabaseError(f"Supabase update failed: {e}")
    
    async def delete(self, table: str, record_id: str) -> bool:
        """Delete record from Supabase table."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            result = await asyncio.to_thread(
                lambda: self.client.table(table).delete().eq('id', record_id).execute()
            )
            
            return len(result.data or []) > 0
            
        except Exception as e:
            raise DatabaseError(f"Supabase delete failed: {e}")
    
    async def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute raw SQL query on Supabase."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            # Supabase uses PostgREST, so raw SQL is limited
            # This would typically use the RPC functionality
            result = await asyncio.to_thread(
                lambda: self.client.rpc('execute_sql', {'query': query, 'params': params}).execute()
            )
            
            return result.data or []
            
        except Exception as e:
            raise DatabaseError(f"Supabase query execution failed: {e}")
    
    @property
    def client_type(self) -> str:
        return "supabase"
```

### 3. SQLite Client Implementation

```python
import aiosqlite
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
import asyncio
from datetime import datetime

class SQLiteClient(DatabaseClient):
    """SQLite client implementation for local fallback."""
    
    def __init__(self, db_path: str = "chronicle.db"):
        self.db_path = Path(db_path)
        self.connection: Optional[aiosqlite.Connection] = None
        self.connected = False
        
    async def connect(self) -> bool:
        """Establish connection to SQLite database."""
        try:
            # Ensure directory exists
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            
            self.connection = await aiosqlite.connect(str(self.db_path))
            
            # Enable foreign keys and WAL mode for better performance
            await self.connection.execute("PRAGMA foreign_keys = ON")
            await self.connection.execute("PRAGMA journal_mode = WAL")
            
            # Initialize schema if needed
            await self._initialize_schema()
            
            self.connected = True
            return True
            
        except Exception as e:
            print(f"SQLite connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self) -> None:
        """Close SQLite connection."""
        if self.connection:
            await self.connection.close()
            self.connection = None
            self.connected = False
    
    async def health_check(self) -> bool:
        """Check SQLite database health."""
        if not self.connected or not self.connection:
            return False
        
        try:
            await self.connection.execute("SELECT 1")
            return True
        except Exception:
            self.connected = False
            return False
    
    async def _initialize_schema(self) -> None:
        """Initialize database schema for Chronicle tables."""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            project_path TEXT,
            git_branch TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            event_type TEXT,
            hook_name TEXT,
            data TEXT,
            timestamp TEXT,
            created_at TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        
        CREATE TABLE IF NOT EXISTS tool_events (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            tool_name TEXT,
            parameters TEXT,
            result TEXT,
            execution_time REAL,
            status TEXT,
            timestamp TEXT,
            created_at TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_tool_events_session_id ON tool_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_tool_events_tool_name ON tool_events(tool_name);
        """
        
        await self.connection.executescript(schema_sql)
        await self.connection.commit()
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[str]:
        """Insert data into SQLite table."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            # Generate ID if not present
            if 'id' not in data:
                import uuid
                data['id'] = str(uuid.uuid4())
            
            # Add timestamp if not present
            if 'created_at' not in data:
                data['created_at'] = datetime.utcnow().isoformat()
            
            # Convert complex objects to JSON
            processed_data = self._serialize_data(data)
            
            columns = list(processed_data.keys())
            placeholders = ['?' for _ in columns]
            values = list(processed_data.values())
            
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            
            await self.connection.execute(query, values)
            await self.connection.commit()
            
            return data['id']
            
        except Exception as e:
            raise DatabaseError(f"SQLite insert failed: {e}")
    
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple records into SQLite."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            ids = []
            
            for record in data:
                # Generate ID if not present
                if 'id' not in record:
                    import uuid
                    record['id'] = str(uuid.uuid4())
                
                # Add timestamp if not present
                if 'created_at' not in record:
                    record['created_at'] = datetime.utcnow().isoformat()
                
                ids.append(record['id'])
            
            # Get column names from first record
            if not data:
                return []
            
            processed_data = [self._serialize_data(record) for record in data]
            columns = list(processed_data[0].keys())
            placeholders = ['?' for _ in columns]
            
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            
            # Prepare values for executemany
            values_list = [list(record.values()) for record in processed_data]
            
            await self.connection.executemany(query, values_list)
            await self.connection.commit()
            
            return ids
            
        except Exception as e:
            raise DatabaseError(f"SQLite bulk insert failed: {e}")
    
    async def select(self, table: str, filters: Dict[str, Any] = None,
                    limit: int = None, offset: int = None) -> List[Dict[str, Any]]:
        """Select records from SQLite table."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            query = f"SELECT * FROM {table}"
            params = []
            
            # Apply filters
            if filters:
                conditions = []
                for key, value in filters.items():
                    if isinstance(value, list):
                        placeholders = ','.join(['?' for _ in value])
                        conditions.append(f"{key} IN ({placeholders})")
                        params.extend(value)
                    else:
                        conditions.append(f"{key} = ?")
                        params.append(value)
                
                if conditions:
                    query += " WHERE " + " AND ".join(conditions)
            
            # Apply ordering
            query += " ORDER BY created_at DESC"
            
            # Apply pagination
            if limit:
                query += f" LIMIT {limit}"
            if offset:
                query += f" OFFSET {offset}"
            
            cursor = await self.connection.execute(query, params)
            rows = await cursor.fetchall()
            
            # Convert rows to dictionaries and deserialize JSON fields
            columns = [description[0] for description in cursor.description]
            results = []
            
            for row in rows:
                record = dict(zip(columns, row))
                results.append(self._deserialize_data(record))
            
            return results
            
        except Exception as e:
            raise DatabaseError(f"SQLite select failed: {e}")
    
    async def update(self, table: str, record_id: str, data: Dict[str, Any]) -> bool:
        """Update record in SQLite table."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            data['updated_at'] = datetime.utcnow().isoformat()
            processed_data = self._serialize_data(data)
            
            columns = list(processed_data.keys())
            set_clause = ', '.join([f"{col} = ?" for col in columns])
            values = list(processed_data.values()) + [record_id]
            
            query = f"UPDATE {table} SET {set_clause} WHERE id = ?"
            
            cursor = await self.connection.execute(query, values)
            await self.connection.commit()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            raise DatabaseError(f"SQLite update failed: {e}")
    
    async def delete(self, table: str, record_id: str) -> bool:
        """Delete record from SQLite table."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            cursor = await self.connection.execute("DELETE FROM ? WHERE id = ?", (table, record_id))
            await self.connection.commit()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            raise DatabaseError(f"SQLite delete failed: {e}")
    
    async def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute raw SQL query on SQLite."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            cursor = await self.connection.execute(query, params or ())
            rows = await cursor.fetchall()
            
            # Convert to dictionaries
            columns = [description[0] for description in cursor.description]
            results = []
            
            for row in rows:
                record = dict(zip(columns, row))
                results.append(self._deserialize_data(record))
            
            return results
            
        except Exception as e:
            raise DatabaseError(f"SQLite query execution failed: {e}")
    
    def _serialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize complex data types to JSON strings."""
        serialized = {}
        
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                serialized[key] = json.dumps(value)
            else:
                serialized[key] = value
        
        return serialized
    
    def _deserialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Deserialize JSON strings back to Python objects."""
        deserialized = {}
        
        for key, value in data.items():
            if isinstance(value, str) and key in ['data', 'parameters', 'result']:
                try:
                    deserialized[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    deserialized[key] = value
            else:
                deserialized[key] = value
        
        return deserialized
    
    @property
    def client_type(self) -> str:
        return "sqlite"
```

### 4. Database Manager with Failover

```python
from typing import Optional, Dict, Any, List
import asyncio
from enum import Enum

class DatabaseError(Exception):
    """Custom database error."""
    pass

class DatabaseStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"

class DatabaseManager:
    """Database manager with automatic failover between Supabase and SQLite."""
    
    def __init__(self, supabase_config: Dict[str, str] = None, 
                 sqlite_path: str = "chronicle.db"):
        self.primary_client = SupabaseClient(**supabase_config) if supabase_config else None
        self.fallback_client = SQLiteClient(sqlite_path)
        self.current_client: Optional[DatabaseClient] = None
        self.status = DatabaseStatus.FAILED
        
    async def initialize(self) -> bool:
        """Initialize database connections with failover logic."""
        # Try primary client first (Supabase)
        if self.primary_client:
            try:
                if await self.primary_client.connect():
                    self.current_client = self.primary_client
                    self.status = DatabaseStatus.HEALTHY
                    print("Connected to Supabase (primary)")
                    return True
            except Exception as e:
                print(f"Primary database connection failed: {e}")
        
        # Fallback to SQLite
        try:
            if await self.fallback_client.connect():
                self.current_client = self.fallback_client
                self.status = DatabaseStatus.DEGRADED
                print("Connected to SQLite (fallback)")
                return True
        except Exception as e:
            print(f"Fallback database connection failed: {e}")
        
        self.status = DatabaseStatus.FAILED
        return False
    
    async def health_check(self) -> DatabaseStatus:
        """Check database health and potentially switch clients."""
        if not self.current_client:
            return DatabaseStatus.FAILED
        
        # Check current client health
        if await self.current_client.health_check():
            return self.status
        
        print(f"Current database client ({self.current_client.client_type}) unhealthy")
        
        # Try to switch to primary if we're on fallback
        if (self.current_client == self.fallback_client and 
            self.primary_client and 
            await self.primary_client.health_check()):
            
            await self.current_client.disconnect()
            self.current_client = self.primary_client
            self.status = DatabaseStatus.HEALTHY
            print("Switched back to primary database")
            return self.status
        
        # Try to switch to fallback if we're on primary
        if (self.current_client == self.primary_client and 
            await self.fallback_client.health_check()):
            
            await self.current_client.disconnect()
            self.current_client = self.fallback_client
            self.status = DatabaseStatus.DEGRADED
            print("Switched to fallback database")
            return self.status
        
        # Both clients failed
        self.status = DatabaseStatus.FAILED
        return self.status
    
    async def execute_with_retry(self, operation, *args, **kwargs):
        """Execute database operation with automatic retry and failover."""
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                if not self.current_client:
                    await self.initialize()
                
                if not self.current_client:
                    raise DatabaseError("No available database clients")
                
                return await operation(self.current_client, *args, **kwargs)
                
            except Exception as e:
                print(f"Database operation failed (attempt {attempt + 1}): {e}")
                
                if attempt < max_retries - 1:
                    # Try to switch clients
                    await self.health_check()
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    raise DatabaseError(f"Database operation failed after {max_retries} attempts: {e}")
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[str]:
        """Insert with retry and failover."""
        return await self.execute_with_retry(
            lambda client, t, d: client.insert(t, d), table, data
        )
    
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Bulk insert with retry and failover."""
        return await self.execute_with_retry(
            lambda client, t, d: client.bulk_insert(t, d), table, data
        )
    
    async def select(self, table: str, filters: Dict[str, Any] = None,
                    limit: int = None, offset: int = None) -> List[Dict[str, Any]]:
        """Select with retry and failover."""
        return await self.execute_with_retry(
            lambda client, t, f, l, o: client.select(t, f, l, o), 
            table, filters, limit, offset
        )
    
    async def update(self, table: str, record_id: str, data: Dict[str, Any]) -> bool:
        """Update with retry and failover."""
        return await self.execute_with_retry(
            lambda client, t, r, d: client.update(t, r, d), 
            table, record_id, data
        )
    
    async def delete(self, table: str, record_id: str) -> bool:
        """Delete with retry and failover."""
        return await self.execute_with_retry(
            lambda client, t, r: client.delete(t, r), table, record_id
        )
    
    async def get_client_info(self) -> Dict[str, Any]:
        """Get information about current database client."""
        if not self.current_client:
            return {"status": "disconnected", "client_type": None}
        
        return {
            "status": self.status.value,
            "client_type": self.current_client.client_type,
            "healthy": await self.current_client.health_check()
        }
    
    async def close(self) -> None:
        """Close all database connections."""
        if self.primary_client:
            await self.primary_client.disconnect()
        if self.fallback_client:
            await self.fallback_client.disconnect()
        
        self.current_client = None
        self.status = DatabaseStatus.FAILED
```

### 5. Usage Examples

```python
# Configuration
supabase_config = {
    'url': 'https://your-project.supabase.co',
    'key': 'your-anon-key'
}

# Initialize database manager
db_manager = DatabaseManager(
    supabase_config=supabase_config,
    sqlite_path="./data/chronicle.db"
)

# Connect with automatic failover
await db_manager.initialize()

# Use the database
session_data = {
    'user_id': 'user-123',
    'project_path': '/path/to/project',
    'git_branch': 'main',
    'start_time': datetime.utcnow().isoformat()
}

# Insert will automatically retry and failover if needed
session_id = await db_manager.insert('sessions', session_data)

# Health monitoring
async def monitor_database():
    """Background task to monitor database health."""
    while True:
        status = await db_manager.health_check()
        print(f"Database status: {status}")
        await asyncio.sleep(30)  # Check every 30 seconds

# Context manager for database operations
@asynccontextmanager
async def database_context():
    """Context manager for database operations."""
    db_manager = DatabaseManager()
    try:
        await db_manager.initialize()
        yield db_manager
    finally:
        await db_manager.close()

# Usage with context manager
async def example_usage():
    async with database_context() as db:
        # Database operations here
        records = await db.select('events', 
                                 filters={'session_id': session_id},
                                 limit=100)
        print(f"Found {len(records)} events")
```

## Best Practices

1. **Connection Pooling**: Use connection pools for production deployments
2. **Health Monitoring**: Regular health checks with automatic failover
3. **Graceful Degradation**: SQLite fallback ensures system continues working
4. **Error Handling**: Comprehensive error handling with retry logic
5. **Data Serialization**: Consistent handling of complex data types
6. **Performance**: Async operations and efficient queries
7. **Security**: Parameterized queries to prevent SQL injection
8. **Monitoring**: Logging and metrics for database operations

This architecture provides robust database abstraction with seamless failover capabilities, ensuring the Chronicle system remains operational even when cloud services are unavailable.