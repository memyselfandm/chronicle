# Chronicle Installation Guide

> **Complete deployment guide for Chronicle observability system - get up and running in under 30 minutes**

## Overview

Chronicle provides real-time observability for Claude Code agent activities through:
- **Dashboard**: Next.js web interface for visualizing agent events
- **Hooks System**: Python-based event capture and data processing
- **Database**: Supabase PostgreSQL with SQLite fallback

## Prerequisites

### System Requirements

- **Node.js 18+** with npm or pnpm
- **Python 3.8+** with pip (uv recommended for faster installs)
- **Git** for version control
- **Claude Code** latest version
- **Supabase Account** (free tier sufficient)

### Platform Support

- ✅ **macOS** (Intel and Apple Silicon)
- ✅ **Linux** (Ubuntu 20.04+, Debian, RHEL, etc.)
- ✅ **Windows** (WSL2 recommended)

## Quick Install (Automated)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd chronicle

# Make installation script executable
chmod +x scripts/install.sh

# Run automated installation
./scripts/install.sh
```

The automated installer will:
- Install dependencies for both dashboard and hooks
- Configure environment variables
- Setup Supabase database schema
- Register hooks with Claude Code
- Validate installation

### 2. Follow Installation Prompts

The script will prompt for:
- **Supabase URL** and **API Key**
- **Claude Code installation path**
- **Project directory preferences**

## Manual Installation

If you prefer manual control or the automated installer fails:

### Step 1: Dashboard Setup

#### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd chronicle-dev/apps/dashboard

# Install dependencies (choose one)
npm install
# or
pnpm install
```

#### 2. Environment Configuration

Create your environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service role key for advanced features
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Environment Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_TITLE="Chronicle Observability"

# Development Features
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_SHOW_DEV_TOOLS=true
NEXT_PUBLIC_ENABLE_REALTIME=true
```

#### 3. Validate Configuration

Run the environment validation script:

```bash
npm run validate:env
```

This script will check your configuration and report any issues.

#### 4. Start Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Step 2: Hooks System Setup

```bash
# Navigate to hooks
cd apps/hooks

# Install Python dependencies (choose one)
pip install -r requirements.txt
# or (recommended - faster)
uv pip install -r requirements.txt

# Copy environment template
cp .env.template .env

# Configure environment variables
nano .env
```

**Required Hooks Environment Variables**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SQLITE_FALLBACK_PATH=~/.chronicle/fallback.db
```

### Step 3: Database Schema Setup

**Option A: Automated Schema Setup (Recommended)**

Option A automatically detects your configuration and sets up the appropriate database:

```bash
cd apps/hooks
python -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()"
```

**How Option A Works**:
- **With Supabase**: If you have `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your `.env` file, it will create the schema in your Supabase database
- **Without Supabase**: If no Supabase credentials are found, it automatically falls back to SQLite at `~/.claude/hooks_data.db`
- **Dependencies**: Ensure you've installed requirements: `pip install -r requirements.txt` (or `uv pip install -r requirements.txt`)

**Success Indicators**:
- No Python errors or exceptions thrown
- For Supabase: Tables created in your Supabase project
- For SQLite: Database file created at `~/.claude/hooks_data.db`

**Option B: Manual Schema Setup**
1. Open your Supabase dashboard
2. Go to SQL Editor  
3. Copy and execute the schema from `apps/hooks/config/schema.sql`

### Step 4: Claude Code Integration

```bash
# Run the hooks installer
cd apps/hooks
python install.py

# Or manual setup - copy hooks to Claude directory
mkdir -p ~/.claude/hooks
cp *.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.py
```

The installer updates your Claude Code `settings.json` to register all hooks.

## Dashboard Database Requirements

Chronicle Dashboard requires these Supabase tables:

### chronicle_sessions Table

```sql
CREATE TABLE chronicle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_path TEXT NOT NULL,
    git_branch TEXT,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
    event_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### chronicle_events Table

```sql
CREATE TABLE chronicle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('prompt', 'tool_use', 'session_start', 'session_end')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Required Indexes

```sql
-- Performance indexes
CREATE INDEX idx_events_session_id ON chronicle_events(session_id);
CREATE INDEX idx_events_timestamp ON chronicle_events(timestamp DESC);
CREATE INDEX idx_events_type ON chronicle_events(type);
CREATE INDEX idx_sessions_status ON chronicle_sessions(status);
CREATE INDEX idx_sessions_start_time ON chronicle_sessions(start_time DESC);
```

### Real-time Subscriptions

Enable real-time subscriptions for live updates:

```sql
-- Enable real-time for the tables
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;
```

## Configuration Templates

### Dashboard Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `development` | Environment name |
| `NEXT_PUBLIC_APP_TITLE` | `Chronicle Observability` | Application title |
| `NEXT_PUBLIC_DEBUG` | `true` (dev), `false` (prod) | Enable debug logging |
| `NEXT_PUBLIC_ENABLE_REALTIME` | `true` | Enable real-time updates |
| `NEXT_PUBLIC_MAX_EVENTS_DISPLAY` | `1000` | Maximum events to display |
| `NEXT_PUBLIC_POLLING_INTERVAL` | `5000` | Polling interval in ms |

### Hooks Environment Variables

#### Dashboard (.env.local)
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Development settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=false
```

#### Hooks (.env)
```env
# Database Configuration - Primary
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database Configuration - Fallback
SQLITE_FALLBACK_PATH=~/.chronicle/fallback.db

# Logging Configuration
LOG_LEVEL=INFO
HOOKS_DEBUG=false

# Security Configuration
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10

# Performance Configuration
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
```

## Verification

### Test Dashboard

```bash
# Start dashboard development server
cd apps/dashboard
npm run dev

# Visit http://localhost:3000
# You should see the Chronicle dashboard
```

### Test Hooks System

```bash
# Test individual hook
cd apps/hooks
echo '{"session_id":"test","tool_name":"Read"}' | python pre_tool_use.py

# Test database connection
python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())"

# Run all tests
pytest
```

### Test Claude Code Integration

1. **Start Claude Code** in any project directory
2. **Trigger some activity** (read files, run commands)
3. **Check dashboard** for live events appearing
4. **Check logs** at `~/.claude/hooks.log` for hook execution

## Development Scripts

### Available Commands

```bash
# Development
npm run dev                    # Start development server with Turbopack
npm run build                 # Build for production
npm run start                 # Start production server
npm run lint                  # Run ESLint

# Testing
npm run test                  # Run all tests
npm run test:watch           # Run tests in watch mode

# Validation and Health Checks
npm run validate:env         # Validate environment configuration
npm run validate:config      # Full configuration validation
npm run security:check       # Security audit
npm run health:check         # Health check script

# Build Variants
npm run build:production     # Production build with optimizations
npm run build:staging        # Staging build
npm run build:analyze        # Build with bundle analyzer
```

## Troubleshooting

### Common Issues

#### 1. Dashboard Not Loading
**Symptoms**: Blank page, console errors
**Solutions**:
```bash
# Check environment variables
cat apps/dashboard/.env.local

# Verify Supabase URL and key
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"

# Check Node.js version
node --version  # Should be 18+
```

#### 2. Hooks Not Executing
**Symptoms**: No events in dashboard, empty logs
**Solutions**:
```bash
# Check hook permissions
ls -la ~/.claude/hooks/

# Fix permissions if needed
chmod +x ~/.claude/hooks/*.py

# Verify Claude Code settings
cat ~/.claude/settings.json | jq .hooks

# Test hook manually
echo '{"test":"data"}' | python ~/.claude/hooks/pre_tool_use.py
```

#### 3. Database Connection Failed
**Symptoms**: Connection errors, fallback to SQLite
**Solutions**:
```bash
# Test Supabase connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Check environment variables are loaded
env | grep SUPABASE

# Test SQLite fallback
ls -la ~/.chronicle/
```

#### 4. Option A Schema Setup Issues
**Symptoms**: "Supabase credentials not provided" during installation
**Solutions**:
```bash
# Check .env file exists and has correct format
cat apps/hooks/.env | grep SUPABASE

# Verify python-dotenv is installed
pip list | grep python-dotenv

# Test credential loading
cd apps/hooks
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print('URL:', bool(os.getenv('SUPABASE_URL'))); print('KEY:', bool(os.getenv('SUPABASE_ANON_KEY')))"

# Alternative: Use setup_schema_and_verify for better feedback
python -c "from src.database import setup_schema_and_verify; setup_schema_and_verify()"
```

#### 5. Permission Denied Errors
**Solutions**:
```bash
# Fix Claude directory permissions
chmod -R 755 ~/.claude/

# Fix hooks permissions
chmod +x ~/.claude/hooks/*.py

# Check file ownership
ls -la ~/.claude/
```

### Debug Mode

Enable verbose logging for troubleshooting:

```env
# In apps/hooks/.env
LOG_LEVEL=DEBUG
HOOKS_DEBUG=true
VERBOSE_LOGGING=true
```

### Log Files

- **Dashboard**: Browser console and terminal output
- **Hooks**: `~/.claude/hooks.log`
- **Claude Code**: `~/.claude/logs/claude-code.log`
- **Database**: `~/.chronicle/database.log`

## Development Setup

### Running in Development Mode

```bash
# Dashboard (in apps/dashboard/)
npm run dev          # Starts on http://localhost:3000

# Hooks testing (in apps/hooks/)
pytest              # Run test suite
python install.py --validate-only  # Validate installation
```

### Environment Variables for Development

```env
# Dashboard development
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=true

# Hooks development  
LOG_LEVEL=DEBUG
HOOKS_DEBUG=true
TEST_MODE=true
```

## Production Deployment

### Security Checklist

- [ ] Use service role key only on secure server
- [ ] Enable Row Level Security in Supabase
- [ ] Set appropriate CORS policies
- [ ] Use environment variables for all secrets
- [ ] Enable data sanitization and PII filtering
- [ ] Set up proper logging and monitoring

### Performance Optimization

```env
# Production hooks configuration
HOOK_TIMEOUT_MS=50
ASYNC_OPERATIONS=true
BATCH_INSERT_SIZE=100
CONNECTION_POOL_SIZE=20
```

### Monitoring

Monitor these metrics in production:
- Hook execution time (should be <100ms)
- Database connection health
- Event processing rate
- Error rates and types

## Next Steps

1. **Customize Configuration**: Adjust settings for your environment
2. **Setup Monitoring**: Configure alerts for hook failures
3. **Security Review**: Enable RLS and audit access patterns
4. **Performance Tuning**: Optimize based on your usage patterns
5. **Backup Strategy**: Setup regular database backups

## Support

### Getting Help

1. **Check Logs**: Review all log files for error messages
2. **Run Validation**: Use `python install.py --validate-only`
3. **Test Components**: Verify each component individually
4. **Review Configuration**: Double-check all environment variables

### Reporting Issues

Include this information when reporting issues:
- **Error messages** (complete stack traces)
- **Configuration** (environment variables, redacted)
- **System info** (OS, Python/Node.js versions)
- **Steps to reproduce** the issue

---

**Installation typically takes 15-25 minutes following this guide. For fastest setup, use the automated installer.**