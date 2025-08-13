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

```bash
# Navigate to dashboard
cd apps/dashboard

# Install dependencies (choose one)
npm install
# or
pnpm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables
nano .env.local
```

**Required Dashboard Environment Variables**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

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

**Option A: Automated Schema Setup**
```bash
cd apps/hooks
python -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()"
```

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

## Configuration

### Environment Templates

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

### Supabase Configuration

#### 1. Create Supabase Project
1. Visit [supabase.com](https://supabase.com) and create account
2. Create new project (free tier is sufficient)
3. Note your project URL and keys from Settings > API

#### 2. Database Schema
Run the schema setup script or manually execute:
```sql
-- Copy the complete schema from apps/hooks/config/schema.sql
-- This includes tables for sessions, events, tool_events, etc.
```

#### 3. Security Settings (Optional)
For production deployments, consider enabling Row Level Security:
```sql
-- Enable RLS on main tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
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

# Check environment variables
env | grep SUPABASE

# Test SQLite fallback
ls -la ~/.chronicle/
```

#### 4. Permission Denied Errors
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