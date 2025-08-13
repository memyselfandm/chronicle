# Supabase PostgreSQL Setup Guide for Chronicle MVP

## Overview

This guide covers comprehensive Supabase PostgreSQL setup, configuration, and optimization for the Chronicle observability system. Supabase provides a managed PostgreSQL database with real-time capabilities, making it ideal for event streaming and observability data.

## Initial Setup & Configuration

### 1. Project Initialization

```bash
# Install Supabase CLI
npm install -g supabase

# Login and create project
supabase login
supabase projects create chronicle-observability --region us-west-1
```

### 2. Python Client Setup

```python
# requirements.txt
supabase>=2.0.0
python-dotenv>=1.0.0
asyncpg>=0.28.0
psycopg2-binary>=2.9.7

# .env configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 3. Database Client Implementation

```python
import os
import asyncio
from supabase import create_client, Client
from typing import Optional, Dict, Any, List
import asyncpg
from contextlib import asynccontextmanager

class SupabaseClient:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_ANON_KEY")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.database_url = os.getenv("DATABASE_URL")
        
        self.client: Client = create_client(self.url, self.key)
        self.admin_client: Client = create_client(self.url, self.service_key)
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize_pool(self, min_size: int = 5, max_size: int = 20):
        """Initialize async connection pool for high-performance operations"""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=min_size,
            max_size=max_size,
            command_timeout=30,
            server_settings={
                'application_name': 'chronicle_observability',
                'jit': 'off'  # Disable JIT for faster connection times
            }
        )
    
    @asynccontextmanager
    async def get_connection(self):
        """Get connection from pool with proper error handling"""
        if not self.pool:
            await self.initialize_pool()
        
        async with self.pool.acquire() as connection:
            try:
                yield connection
            except Exception as e:
                # Log error and re-raise
                print(f"Database error: {e}")
                raise
    
    async def close(self):
        """Cleanup connections"""
        if self.pool:
            await self.pool.close()
```

## Schema Design for Observability

### 1. Core Table Structure

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Sessions table (primary entity)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    project_name VARCHAR(255),
    git_branch VARCHAR(255),
    git_commit VARCHAR(40),
    working_directory TEXT,
    environment JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table (main event storage)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    source_app VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool events (specific to tool usage)
CREATE TABLE tool_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    tool_name VARCHAR(255) NOT NULL,
    tool_type VARCHAR(100),
    phase VARCHAR(20) CHECK (phase IN ('pre', 'post')),
    parameters JSONB,
    result JSONB,
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt events (user interactions)
CREATE TABLE prompt_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    prompt_text TEXT,
    prompt_length INTEGER,
    complexity_score REAL,
    intent_classification VARCHAR(100),
    context_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification events (system messages)
CREATE TABLE notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    notification_type VARCHAR(100),
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lifecycle events (session state changes)
CREATE TABLE lifecycle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    lifecycle_type VARCHAR(50),
    previous_state VARCHAR(50),
    new_state VARCHAR(50),
    trigger_reason TEXT,
    context_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project context (file system state)
CREATE TABLE project_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    last_modified TIMESTAMP WITH TIME ZONE,
    git_status VARCHAR(20),
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Optimized Indexing Strategy

```sql
-- Primary performance indexes
CREATE INDEX CONCURRENTLY idx_events_session_timestamp 
ON events(session_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_events_type_timestamp 
ON events(event_type, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_events_source_timestamp 
ON events(source_app, timestamp DESC);

-- JSONB indexes for fast querying
CREATE INDEX CONCURRENTLY idx_events_data_gin 
ON events USING GIN(data);

CREATE INDEX CONCURRENTLY idx_sessions_metadata_gin 
ON sessions USING GIN(metadata);

-- Tool-specific indexes
CREATE INDEX CONCURRENTLY idx_tool_events_name_phase 
ON tool_events(tool_name, phase);

CREATE INDEX CONCURRENTLY idx_tool_events_session_time 
ON tool_events(session_id, created_at DESC);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_events_session_type_time 
ON events(session_id, event_type, timestamp DESC);

-- Partial indexes for active sessions
CREATE INDEX CONCURRENTLY idx_sessions_active 
ON sessions(started_at DESC) 
WHERE status = 'active';

-- Text search index for prompts
CREATE INDEX CONCURRENTLY idx_prompt_events_text_search 
ON prompt_events USING GIN(to_tsvector('english', prompt_text));
```

### 3. Foreign Key Relationships & Constraints

```sql
-- Add performance-optimized foreign keys
ALTER TABLE events 
ADD CONSTRAINT fk_events_session 
FOREIGN KEY (session_id) REFERENCES sessions(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Ensure referential integrity with cascading deletes
ALTER TABLE tool_events 
ADD CONSTRAINT fk_tool_events_session 
FOREIGN KEY (session_id) REFERENCES sessions(id) 
ON DELETE CASCADE;

ALTER TABLE tool_events 
ADD CONSTRAINT fk_tool_events_event 
FOREIGN KEY (event_id) REFERENCES events(id) 
ON DELETE CASCADE;

-- Add check constraints for data validation
ALTER TABLE events 
ADD CONSTRAINT chk_event_type_valid 
CHECK (event_type IN (
    'tool_pre_use', 'tool_post_use', 'user_prompt', 
    'notification', 'session_start', 'session_stop', 
    'compact_pre', 'system_health'
));

ALTER TABLE sessions 
ADD CONSTRAINT chk_session_status_valid 
CHECK (status IN ('active', 'completed', 'terminated', 'error'));

-- Unique constraints for business logic
ALTER TABLE sessions 
ADD CONSTRAINT uk_sessions_session_id 
UNIQUE (session_id);
```

## Performance Optimization

### 1. Connection Pooling Configuration

```python
class OptimizedSupabasePool:
    def __init__(self):
        self.pool_config = {
            'min_size': 5,
            'max_size': 20,
            'max_queries': 50000,
            'max_inactive_connection_lifetime': 300.0,
            'timeout': 10.0,
            'command_timeout': 30.0,
            'server_settings': {
                'application_name': 'chronicle_hooks',
                'search_path': 'public',
                'timezone': 'UTC',
                'statement_timeout': '30s',
                'lock_timeout': '10s',
                'idle_in_transaction_session_timeout': '60s'
            }
        }
    
    async def create_optimized_pool(self) -> asyncpg.Pool:
        return await asyncpg.create_pool(
            os.getenv("DATABASE_URL"),
            **self.pool_config
        )
```

### 2. Batch Operations for High Throughput

```python
class BatchEventProcessor:
    def __init__(self, db_client: SupabaseClient):
        self.db_client = db_client
        self.batch_size = 100
        self.batch_timeout = 5.0  # seconds
        self.pending_events = []
        self.last_flush = asyncio.get_event_loop().time()
    
    async def add_event(self, event_data: Dict[str, Any]):
        """Add event to batch queue"""
        self.pending_events.append(event_data)
        
        # Flush if batch is full or timeout reached
        current_time = asyncio.get_event_loop().time()
        if (len(self.pending_events) >= self.batch_size or 
            current_time - self.last_flush >= self.batch_timeout):
            await self.flush_batch()
    
    async def flush_batch(self):
        """Flush pending events to database"""
        if not self.pending_events:
            return
        
        async with self.db_client.get_connection() as conn:
            # Use COPY for maximum performance
            await conn.copy_records_to_table(
                'events',
                records=self.pending_events,
                columns=['session_id', 'event_type', 'source_app', 'timestamp', 'data']
            )
        
        self.pending_events.clear()
        self.last_flush = asyncio.get_event_loop().time()
```

### 3. Query Optimization Patterns

```python
class OptimizedQueries:
    @staticmethod
    async def get_session_events(
        conn: asyncpg.Connection,
        session_id: str,
        event_types: List[str] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> List[Dict]:
        """Optimized query for session events with filtering"""
        
        base_query = """
        SELECT e.*, s.session_id, s.project_name
        FROM events e
        JOIN sessions s ON e.session_id = s.id
        WHERE s.session_id = $1
        """
        
        params = [session_id]
        param_count = 1
        
        if event_types:
            param_count += 1
            base_query += f" AND e.event_type = ANY(${param_count})"
            params.append(event_types)
        
        base_query += f"""
        ORDER BY e.timestamp DESC
        LIMIT ${param_count + 1} OFFSET ${param_count + 2}
        """
        params.extend([limit, offset])
        
        return await conn.fetch(base_query, *params)
    
    @staticmethod
    async def get_tool_usage_stats(
        conn: asyncpg.Connection,
        time_window_hours: int = 24
    ) -> List[Dict]:
        """Get tool usage statistics with performance metrics"""
        
        query = """
        SELECT 
            tool_name,
            COUNT(*) as usage_count,
            AVG(execution_time_ms) as avg_execution_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
            SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
        FROM tool_events
        WHERE created_at >= NOW() - INTERVAL '%s hours'
        GROUP BY tool_name
        ORDER BY usage_count DESC
        """ % time_window_hours
        
        return await conn.fetch(query)
```

## Real-time Subscriptions

### 1. Event Streaming Setup

```python
import asyncio
from supabase import Client
from typing import Callable, Dict, Any

class RealtimeEventStream:
    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self.subscriptions = {}
    
    def subscribe_to_events(
        self,
        callback: Callable[[Dict[str, Any]], None],
        event_types: List[str] = None,
        session_filter: str = None
    ):
        """Subscribe to real-time event updates"""
        
        channel = self.client.channel('events')
        
        # Subscribe to INSERT operations
        subscription = channel.on(
            'postgres_changes',
            event='INSERT',
            schema='public',
            table='events',
            callback=lambda payload: self._handle_event(payload, callback, event_types, session_filter)
        )
        
        subscription.subscribe()
        return subscription
    
    def _handle_event(
        self,
        payload: Dict[str, Any],
        callback: Callable,
        event_types: List[str] = None,
        session_filter: str = None
    ):
        """Filter and process incoming events"""
        
        record = payload.get('new', {})
        
        # Apply filters
        if event_types and record.get('event_type') not in event_types:
            return
        
        if session_filter and record.get('session_id') != session_filter:
            return
        
        # Execute callback
        try:
            callback(record)
        except Exception as e:
            print(f"Error processing real-time event: {e}")
```

## Security & Row Level Security (RLS)

### 1. Enable RLS and Create Policies

```sql
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_context ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Users can read their own sessions" 
ON sessions FOR SELECT 
USING (auth.uid()::text = metadata->>'user_id');

CREATE POLICY "Service role has full access" 
ON sessions FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Events policies
CREATE POLICY "Users can read events from their sessions" 
ON events FOR SELECT 
USING (
    session_id IN (
        SELECT id FROM sessions 
        WHERE auth.uid()::text = metadata->>'user_id'
    )
);

CREATE POLICY "Service role can insert events" 
ON events FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### 2. Environment-based Configuration

```python
class EnvironmentConfig:
    @staticmethod
    def get_database_config(environment: str = "development") -> Dict[str, Any]:
        """Get environment-specific database configuration"""
        
        configs = {
            "development": {
                "pool_size": 5,
                "statement_timeout": "30s",
                "log_queries": True,
                "auto_vacuum": True
            },
            "staging": {
                "pool_size": 10,
                "statement_timeout": "15s",
                "log_queries": False,
                "auto_vacuum": True
            },
            "production": {
                "pool_size": 20,
                "statement_timeout": "10s",
                "log_queries": False,
                "auto_vacuum": False,  # Managed separately
                "connection_lifetime": 3600
            }
        }
        
        return configs.get(environment, configs["development"])
```

## Monitoring & Health Checks

### 1. Database Health Monitoring

```python
class DatabaseHealthMonitor:
    def __init__(self, db_client: SupabaseClient):
        self.db_client = db_client
    
    async def check_health(self) -> Dict[str, Any]:
        """Comprehensive database health check"""
        
        health_status = {
            "status": "healthy",
            "checks": {},
            "timestamp": asyncio.get_event_loop().time()
        }
        
        try:
            async with self.db_client.get_connection() as conn:
                # Connection test
                await conn.fetch("SELECT 1")
                health_status["checks"]["connection"] = "ok"
                
                # Pool status
                pool_info = {
                    "size": self.db_client.pool.get_size(),
                    "free_connections": self.db_client.pool.get_idle_size(),
                    "used_connections": self.db_client.pool.get_size() - self.db_client.pool.get_idle_size()
                }
                health_status["checks"]["pool"] = pool_info
                
                # Query performance test
                start_time = asyncio.get_event_loop().time()
                await conn.fetch("SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '1 hour'")
                query_time = asyncio.get_event_loop().time() - start_time
                health_status["checks"]["query_performance"] = {
                    "query_time_ms": query_time * 1000,
                    "status": "ok" if query_time < 1.0 else "slow"
                }
                
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
        
        return health_status
```

This comprehensive Supabase setup guide provides the foundation for a robust, scalable observability system with optimized performance, security, and real-time capabilities.