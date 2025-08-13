"""
Database connection and management for Chronicle observability system.

Provides unified interface for Supabase (PostgreSQL) and SQLite backends
with automatic failover, connection pooling, and error handling.
"""

import os
import asyncio
import aiosqlite
import json
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from contextlib import asynccontextmanager
from enum import Enum
from pathlib import Path

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .models import (
    Session, Event, DATABASE_SCHEMA, SQLITE_SCHEMA,
    get_postgres_schema_sql, get_sqlite_schema_sql,
    validate_session_data, validate_event_data, sanitize_data
)


class DatabaseError(Exception):
    """Custom database error."""
    pass


class DatabaseStatus(Enum):
    """Database connection status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"


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


class SupabaseClient(DatabaseClient):
    """Supabase PostgreSQL client implementation."""
    
    def __init__(self, url: str = None, key: str = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not available. Install with: pip install supabase")
        
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
            await self._initialize_schema()
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
        
        # Test with a simple select
        result = await asyncio.to_thread(
            lambda: self.client.table('sessions').select('id').limit(1).execute()
        )
        # Connection successful if no exception raised
    
    async def _initialize_schema(self) -> None:
        """Initialize database schema if needed."""
        try:
            # Use Supabase SQL API to create schema
            schema_sql = get_postgres_schema_sql()
            await asyncio.to_thread(
                lambda: self.client.rpc('execute_sql', {'sql': schema_sql}).execute()
            )
        except Exception as e:
            # Schema might already exist, which is fine
            print(f"Schema initialization note: {e}")
    
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
            # Sanitize and validate data
            clean_data = sanitize_data(data)
            
            # Add timestamp if not present
            if 'created_at' not in clean_data:
                clean_data['created_at'] = datetime.utcnow().isoformat() + 'Z'
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).insert(clean_data).execute()
            )
            
            if result.data and len(result.data) > 0:
                return str(result.data[0].get('id'))
            return None
            
        except Exception as e:
            raise DatabaseError(f"Supabase insert failed: {e}")
    
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple records into Supabase."""
        if not self.connected:
            raise ConnectionError("Not connected to Supabase")
        
        try:
            # Sanitize and add timestamps to all records
            clean_data = []
            for record in data:
                clean_record = sanitize_data(record)
                if 'created_at' not in clean_record:
                    clean_record['created_at'] = datetime.utcnow().isoformat() + 'Z'
                clean_data.append(clean_record)
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).insert(clean_data).execute()
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
            
            # Apply ordering by created_at DESC
            query = query.order('created_at', desc=True)
            
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
            clean_data = sanitize_data(data)
            clean_data['updated_at'] = datetime.utcnow().isoformat() + 'Z'
            
            result = await asyncio.to_thread(
                lambda: self.client.table(table).update(clean_data).eq('id', record_id).execute()
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
            # Use RPC for raw SQL execution
            result = await asyncio.to_thread(
                lambda: self.client.rpc('execute_sql', {
                    'sql': query, 
                    'params': list(params) if params else []
                }).execute()
            )
            
            return result.data or []
            
        except Exception as e:
            raise DatabaseError(f"Supabase query execution failed: {e}")
    
    @property
    def client_type(self) -> str:
        return "supabase"


class SQLiteClient(DatabaseClient):
    """SQLite client implementation for local fallback."""
    
    def __init__(self, db_path: str = "chronicle.db"):
        self.db_path = Path(db_path)
        self.connection: Optional[aiosqlite.Connection] = None
        self.connected = False
        
    async def connect(self) -> bool:
        """Establish connection to SQLite database."""
        try:
            # Handle in-memory database
            if str(self.db_path) == ":memory:":
                self.connection = await aiosqlite.connect(":memory:")
            else:
                # Ensure directory exists
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
                self.connection = await aiosqlite.connect(str(self.db_path))
            
            # Enable foreign keys and WAL mode for better performance
            await self.connection.execute("PRAGMA foreign_keys = ON")
            if str(self.db_path) != ":memory:":
                await self.connection.execute("PRAGMA journal_mode = WAL")
            
            # Initialize schema
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
        # Execute PRAGMA statements first
        await self.connection.execute("PRAGMA foreign_keys = ON")
        if str(self.db_path) != ":memory:":
            await self.connection.execute("PRAGMA journal_mode = WAL")
        
        # Create tables
        for table_name, table_sql in SQLITE_SCHEMA.items():
            if table_name != 'indexes':
                await self.connection.execute(table_sql)
        
        # Create indexes
        for index_sql in SQLITE_SCHEMA['indexes']:
            await self.connection.execute(index_sql)
        
        await self.connection.commit()
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[str]:
        """Insert data into SQLite table."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            # Sanitize data
            clean_data = sanitize_data(data)
            
            # Generate ID if not present
            if 'id' not in clean_data:
                import uuid
                clean_data['id'] = str(uuid.uuid4())
            
            # Add timestamp if not present
            if 'created_at' not in clean_data:
                clean_data['created_at'] = datetime.utcnow().isoformat() + 'Z'
            
            # Convert complex objects to JSON for SQLite
            processed_data = self._serialize_data(clean_data)
            
            columns = list(processed_data.keys())
            placeholders = ['?' for _ in columns]
            values = list(processed_data.values())
            
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            
            await self.connection.execute(query, values)
            await self.connection.commit()
            
            return clean_data['id']
            
        except Exception as e:
            raise DatabaseError(f"SQLite insert failed: {e}")
    
    async def bulk_insert(self, table: str, data: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple records into SQLite."""
        if not self.connected:
            raise ConnectionError("Not connected to SQLite")
        
        try:
            ids = []
            processed_records = []
            
            for record in data:
                # Sanitize data
                clean_record = sanitize_data(record)
                
                # Generate ID if not present
                if 'id' not in clean_record:
                    import uuid
                    clean_record['id'] = str(uuid.uuid4())
                
                # Add timestamp if not present
                if 'created_at' not in clean_record:
                    clean_record['created_at'] = datetime.utcnow().isoformat() + 'Z'
                
                ids.append(clean_record['id'])
                processed_records.append(self._serialize_data(clean_record))
            
            if not processed_records:
                return []
            
            # Get column names from first record
            columns = list(processed_records[0].keys())
            placeholders = ['?' for _ in columns]
            
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            
            # Prepare values for executemany
            values_list = [list(record.values()) for record in processed_records]
            
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
            clean_data = sanitize_data(data)
            clean_data['updated_at'] = datetime.utcnow().isoformat() + 'Z'
            processed_data = self._serialize_data(clean_data)
            
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
            cursor = await self.connection.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))
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
            
            # Handle different query types
            if query.strip().upper().startswith(('SELECT', 'PRAGMA')):
                rows = await cursor.fetchall()
                
                # Convert to dictionaries
                if cursor.description:
                    columns = [description[0] for description in cursor.description]
                    results = []
                    
                    for row in rows:
                        record = dict(zip(columns, row))
                        results.append(self._deserialize_data(record))
                    
                    return results
                else:
                    return []
            else:
                # Non-SELECT queries
                await self.connection.commit()
                return []
            
        except Exception as e:
            raise DatabaseError(f"SQLite query execution failed: {e}")
    
    def _serialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize complex data types to JSON strings for SQLite."""
        serialized = {}
        
        for key, value in data.items():
            if isinstance(value, (dict, list)) and key == 'data':
                serialized[key] = json.dumps(value)
            else:
                serialized[key] = value
        
        return serialized
    
    def _deserialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Deserialize JSON strings back to Python objects."""
        deserialized = {}
        
        for key, value in data.items():
            if isinstance(value, str) and key == 'data':
                try:
                    deserialized[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    deserialized[key] = {}
            else:
                deserialized[key] = value
        
        return deserialized
    
    @property
    def client_type(self) -> str:
        return "sqlite"


class DatabaseManager:
    """Database manager with automatic failover between Supabase and SQLite."""
    
    def __init__(self, supabase_config: Dict[str, str] = None, 
                 sqlite_path: str = "chronicle.db"):
        self.primary_client = None
        if supabase_config and SUPABASE_AVAILABLE:
            try:
                self.primary_client = SupabaseClient(**supabase_config)
            except Exception as e:
                print(f"Failed to initialize Supabase client: {e}")
        
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
    
    # Convenience methods with retry and failover
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


# High-level convenience functions
async def create_session(session_data: Dict[str, Any], db_manager: DatabaseManager) -> str:
    """Create a new session with validation."""
    if not validate_session_data(session_data):
        raise ValueError("Invalid session data")
    
    session = Session.from_dict(session_data)
    return await db_manager.insert('sessions', session.to_dict())


async def create_event(event_data: Dict[str, Any], db_manager: DatabaseManager) -> str:
    """Create a new event with validation."""
    if not validate_event_data(event_data):
        raise ValueError("Invalid event data")
    
    event = Event.from_dict(event_data)
    return await db_manager.insert('events', event.to_dict())


async def get_session_events(session_id: str, db_manager: DatabaseManager,
                           event_types: List[str] = None,
                           limit: int = 100) -> List[Dict[str, Any]]:
    """Get events for a specific session."""
    filters = {'session_id': session_id}
    if event_types:
        # For multiple event types, we'll need to query each separately in SQLite
        # or use a custom query for more complex filtering
        pass
    
    return await db_manager.select('events', filters, limit=limit)


async def get_active_sessions(db_manager: DatabaseManager) -> List[Dict[str, Any]]:
    """Get all active sessions (end_time is null)."""
    # This would require a custom query for null checks
    # For now, return all sessions and filter in Python
    all_sessions = await db_manager.select('sessions')
    return [s for s in all_sessions if s.get('end_time') is None]