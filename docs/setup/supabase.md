# Supabase Setup Guide for Chronicle

> **Complete guide to setting up Supabase PostgreSQL database for Chronicle observability system**

## Overview

Chronicle uses Supabase as the primary database for storing and analyzing Claude Code agent events. This guide covers everything from account creation to production optimization.

## Table of Contents

- [Account Setup](#account-setup)
- [Project Creation](#project-creation)
- [Database Schema](#database-schema)
- [API Configuration](#api-configuration)
- [Real-time Setup](#real-time-setup)
- [Security Configuration](#security-configuration)
- [Performance Optimization](#performance-optimization)
- [Backup & Monitoring](#backup--monitoring)
- [Troubleshooting](#troubleshooting)

## Account Setup

### 1. Create Supabase Account

1. **Visit Supabase**: Go to [supabase.com](https://supabase.com)
2. **Sign Up**: Create account (GitHub/Google OAuth recommended)
3. **Verify Email**: Check your email and verify account
4. **Dashboard Access**: You'll be redirected to the Supabase dashboard

### 2. Choose Plan

**Free Tier** (Recommended for MVP):
- ✅ Up to 2 projects
- ✅ 500MB database storage
- ✅ 50,000 monthly active users
- ✅ Real-time subscriptions
- ✅ Row Level Security
- ✅ Automatic backups (7 days)

**Pro Tier** ($25/month):
- ✅ Unlimited projects
- ✅ 8GB database storage included
- ✅ Priority support
- ✅ Advanced metrics

## Project Creation

### 1. Create New Project

```bash
# Using Supabase CLI (optional)
npm install -g supabase
supabase login
supabase projects create chronicle-observability --region us-west-1
```

**Or via Dashboard**:
1. Click **"New Project"**
2. **Organization**: Choose or create organization
3. **Project Name**: `chronicle-observability`
4. **Database Password**: Generate strong password (save securely!)
5. **Region**: Choose closest to your location:
   - `us-west-1` (US West)
   - `us-east-1` (US East)
   - `eu-west-1` (Europe West)
   - `ap-southeast-1` (Asia Pacific)

### 2. Wait for Project Initialization

- Project setup takes 2-3 minutes
- You'll receive email confirmation when ready
- Dashboard will show "Setting up project..." during initialization

## Database Schema

### 1. Automatic Schema Setup (Recommended)

```bash
# Navigate to hooks directory
cd apps/hooks

# Run schema setup script
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
dm.setup_schema()
print('Schema setup complete!')
"
```

### 2. Manual Schema Setup

If automatic setup fails, manually execute the schema:

1. **Open SQL Editor**:
   - Go to your Supabase dashboard
   - Navigate to **SQL Editor**
   - Click **"New Query"**

2. **Execute Schema**:
   Copy the complete schema from `apps/hooks/config/schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
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

-- Events table
CREATE TABLE IF NOT EXISTS events (
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

-- Tool events table
CREATE TABLE IF NOT EXISTS tool_events (
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

-- Prompt events table
CREATE TABLE IF NOT EXISTS prompt_events (
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

-- Notification events table
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    notification_type VARCHAR(100),
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lifecycle events table
CREATE TABLE IF NOT EXISTS lifecycle_events (
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

-- Project context table
CREATE TABLE IF NOT EXISTS project_context (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_source_timestamp ON events(source_app, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_sessions_metadata_gin ON sessions USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_tool_events_name_phase ON tool_events(tool_name, phase);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(started_at DESC) WHERE status = 'active';
```

3. **Execute Query**: Click **"Run"** to execute the schema

### 3. Verify Schema

```sql
-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

Expected tables:
- `sessions`
- `events`
- `tool_events`
- `prompt_events`
- `notification_events`
- `lifecycle_events`
- `project_context`

## API Configuration

### 1. Get API Credentials

In your Supabase dashboard:

1. **Navigate to Settings > API**
2. **Copy these values**:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Anonymous Key**: `eyJ0eXAiOiJKV1Q...` (safe for client-side)
   - **Service Role Key**: `eyJ0eXAiOiJKV1Q...` (server-side only, keep secure!)

### 2. Test API Connection

```bash
# Test anonymous key
curl -H "apikey: YOUR_ANON_KEY" \
     "https://your-project-ref.supabase.co/rest/v1/"

# Should return API information, not an error
```

### 3. Configure Environment Variables

**Dashboard** (.env.local):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Hooks** (.env):
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Real-time Setup

### 1. Enable Real-time

Real-time is enabled by default in Supabase, but you can configure it:

1. **Go to Settings > API**
2. **Real-time section**: Ensure it's enabled
3. **Configuration**: Default settings work for Chronicle

### 2. Configure Real-time Policies

```sql
-- Enable real-time for events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE tool_events;
```

### 3. Test Real-time Connection

```javascript
// Test in browser console on dashboard
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project-ref.supabase.co',
  'your-anon-key'
)

// Subscribe to events
const channel = supabase
  .channel('events')
  .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'events' },
      (payload) => console.log('New event:', payload)
  )
  .subscribe()
```

## Security Configuration

### 1. Row Level Security (RLS)

**For production deployments**, enable RLS:

```sql
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_context ENABLE ROW LEVEL SECURITY;
```

### 2. Create Security Policies

```sql
-- Example: Allow all reads for anonymous users (adjust for your needs)
CREATE POLICY "Enable read access for all users" ON sessions
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON events
FOR SELECT USING (true);

-- Example: Restrict writes to service role
CREATE POLICY "Enable insert for service role only" ON events
FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### 3. Configure CORS (if needed)

1. **Go to Settings > API**
2. **CORS Settings**: Add your domain(s)
   - `http://localhost:3000` (development)
   - `https://your-domain.com` (production)

## Performance Optimization

### 1. Database Configuration

**For production**, optimize database settings:

1. **Go to Settings > Database**
2. **Optimize for your workload**:
   - **Read-heavy**: Increase `shared_buffers`
   - **Write-heavy**: Increase `wal_buffers`

### 2. Connection Pooling

Configure connection pooling in your application:

```python
# Example for hooks system
import asyncpg

pool = await asyncpg.create_pool(
    "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres",
    min_size=5,
    max_size=20,
    command_timeout=30
)
```

### 3. Query Optimization

Monitor slow queries:

1. **Go to Reports > Performance**
2. **Identify slow queries**
3. **Add indexes as needed**:

```sql
-- Example: Add index for common query pattern
CREATE INDEX idx_events_session_type ON events(session_id, event_type, timestamp DESC);
```

## Backup & Monitoring

### 1. Automated Backups

Supabase provides automatic backups:
- **Free Tier**: 7 days of daily backups
- **Pro Tier**: 30 days of daily backups
- **Backup time**: Usually during low-traffic hours

### 2. Manual Backup

```bash
# Using pg_dump (requires direct database access)
pg_dump "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres" \
        --schema=public \
        --data-only > chronicle_backup.sql
```

### 3. Monitoring Setup

1. **Go to Reports**
2. **Monitor these metrics**:
   - Database size
   - Connection count
   - Query performance
   - Real-time connections

### 4. Set Up Alerts

1. **Go to Settings > Webhooks**
2. **Configure alerts for**:
   - High database usage
   - Connection limits
   - Backup failures

## Troubleshooting

### Common Issues

#### 1. Connection Refused

**Symptoms**: Cannot connect to database
**Solutions**:
```bash
# Check project status
curl https://your-project-ref.supabase.co/rest/v1/

# Verify credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

#### 2. Schema Creation Failed

**Symptoms**: Tables not created
**Solutions**:
1. Check SQL Editor for error messages
2. Ensure UUID extension is enabled
3. Verify permissions

#### 3. Real-time Not Working

**Symptoms**: Dashboard not updating live
**Solutions**:
```sql
-- Check real-time configuration
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Add missing tables
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

#### 4. Performance Issues

**Symptoms**: Slow queries, timeouts
**Solutions**:
1. Check query performance in Reports
2. Add missing indexes
3. Optimize connection pooling

### Debug Commands

```bash
# Test database connection
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
print('Connection test:', dm.test_connection())
"

# Check table structure
python -c "
import asyncpg
import asyncio

async def check_tables():
    conn = await asyncpg.connect('postgresql://...')
    tables = await conn.fetch('''
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
    ''')
    print('Tables:', [t['table_name'] for t in tables])
    await conn.close()

asyncio.run(check_tables())
"
```

### Getting Help

1. **Supabase Documentation**: [docs.supabase.com](https://docs.supabase.com)
2. **Community Support**: [Discord](https://discord.supabase.com)
3. **GitHub Issues**: [github.com/supabase/supabase](https://github.com/supabase/supabase)

## Production Checklist

Before going to production:

- [ ] Schema created and verified
- [ ] Indexes optimized for query patterns
- [ ] Row Level Security enabled (if needed)
- [ ] Security policies configured
- [ ] Real-time subscriptions tested
- [ ] Backup strategy confirmed
- [ ] Monitoring and alerts configured
- [ ] Connection pooling optimized
- [ ] Performance tested under load
- [ ] API keys securely stored
- [ ] CORS configured for production domains

## Next Steps

1. **Complete Setup**: Ensure schema and API access work
2. **Test Integration**: Verify Chronicle components connect
3. **Performance Test**: Load test with expected data volume
4. **Security Review**: Implement appropriate access controls
5. **Monitor**: Set up ongoing monitoring and alerts

---

**This completes your Supabase setup for Chronicle. The database is now ready for real-time observability data.**