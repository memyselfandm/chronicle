# Chronicle Environment Configuration Guide

> **Comprehensive guide to configuring Chronicle's environment variables for optimal performance and security**

## Overview

Chronicle uses a standardized environment configuration system with a single source of truth at the project root. This guide covers the complete setup and configuration process.

## Configuration Architecture

Chronicle's environment configuration follows this hierarchy:

1. **Root Template** (`/.env.template`) - Master configuration with all variables
2. **App-Specific Templates** - Reference root config with app-specific overrides
3. **Environment Files** - Development, staging, and production variants

### File Structure

```
chronicle/
├── .env.template                    # Master template (CHRONICLE_ prefix)
├── .env                            # Your root configuration
├── apps/
│   ├── dashboard/
│   │   ├── .env.example            # Dashboard-specific template
│   │   ├── .env.local              # Local dashboard overrides
│   │   ├── .env.development        # Development overrides
│   │   ├── .env.staging            # Staging overrides
│   │   └── .env.production         # Production overrides
│   └── hooks/
│       ├── .env.template           # Hooks-specific template
│       └── .env                    # Hooks configuration
```

## Quick Setup

### 1. Copy Root Template

```bash
# Copy the master template
cp .env.template .env

# Edit with your configuration
nano .env
```

### 2. Configure Required Variables

Set these essential variables in your root `.env`:

```env
# Project Environment
CHRONICLE_ENVIRONMENT=development

# Supabase Configuration (Required)
CHRONICLE_SUPABASE_URL=https://your-project.supabase.co
CHRONICLE_SUPABASE_ANON_KEY=your-anon-key-here
CHRONICLE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Dashboard Configuration (Next.js requires NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_ENVIRONMENT=development
```

### 3. Set App-Specific Overrides

```bash
# Dashboard local overrides (optional)
cd apps/dashboard
cp .env.example .env.local

# Hooks configuration (if different from root)
cd ../hooks  
cp .env.template .env
```

## Variable Categories

### Project-Wide Variables (CHRONICLE_ prefix)

These variables are used across the entire Chronicle platform:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CHRONICLE_ENVIRONMENT` | Environment type | `development`, `staging`, `production` |
| `CHRONICLE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `CHRONICLE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `CHRONICLE_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHRONICLE_LOG_LEVEL` | `INFO` | Global logging level |
| `CHRONICLE_LOG_DIR` | `~/.chronicle/logs` | Log file directory |
| `CHRONICLE_DEBUG` | `false` | Enable debug mode |
| `CHRONICLE_MAX_EVENTS_DISPLAY` | `1000` | Max events in dashboard |
| `CHRONICLE_POLLING_INTERVAL` | `5000` | Polling interval (ms) |

### Dashboard Variables (NEXT_PUBLIC_ prefix)

Next.js requires `NEXT_PUBLIC_` prefix for client-side variables:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anonymous key | `eyJ...` |
| `NEXT_PUBLIC_ENVIRONMENT` | Dashboard environment | `development` |

#### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENABLE_REALTIME` | `true` | Enable real-time updates |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `true` | Enable analytics features |
| `NEXT_PUBLIC_ENABLE_EXPORT` | `true` | Enable data export |
| `NEXT_PUBLIC_ENABLE_EXPERIMENTAL_FEATURES` | `false` | Enable experimental features |

### Hooks Variables (CLAUDE_HOOKS_ prefix)

Claude Code hooks system specific variables:

#### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_ENABLED` | `true` | Enable hooks system |
| `CLAUDE_HOOKS_DB_PATH` | `~/.claude/hooks_data.db` | SQLite fallback path |
| `CLAUDE_HOOKS_LOG_LEVEL` | `INFO` | Hooks logging level |
| `CLAUDE_HOOKS_LOG_FILE` | `~/.claude/hooks.log` | Hooks log file |

#### Performance Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS` | `100` | Hook execution timeout |
| `CLAUDE_HOOKS_MAX_MEMORY_MB` | `50` | Memory limit for hooks |
| `CLAUDE_HOOKS_ASYNC_OPERATIONS` | `true` | Enable async operations |

## Environment-Specific Configuration

### Development Environment

```env
# Root .env for development
CHRONICLE_ENVIRONMENT=development
CHRONICLE_DEBUG=true
CHRONICLE_LOG_LEVEL=DEBUG
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_SHOW_DEV_TOOLS=true
CLAUDE_HOOKS_DEBUG=true
```

### Staging Environment

```env
# Root .env for staging
CHRONICLE_ENVIRONMENT=staging
CHRONICLE_DEBUG=true
CHRONICLE_LOG_LEVEL=INFO
CHRONICLE_SENTRY_ENVIRONMENT=staging
NEXT_PUBLIC_DEBUG=true
```

### Production Environment

```env
# Root .env for production
CHRONICLE_ENVIRONMENT=production
CHRONICLE_DEBUG=false
CHRONICLE_LOG_LEVEL=ERROR
CHRONICLE_ENABLE_CSP=true
CHRONICLE_ENABLE_SECURITY_HEADERS=true
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_SHOW_ENVIRONMENT_BADGE=false
```

## Security Configuration

### Required Security Settings

```env
# Data Protection
CHRONICLE_SANITIZE_DATA=true
CHRONICLE_REMOVE_API_KEYS=true
CHRONICLE_PII_FILTERING=true

# Input Validation
CHRONICLE_MAX_INPUT_SIZE_MB=10
CHRONICLE_ALLOWED_EXTENSIONS=.py,.js,.ts,.json,.md,.txt,.yml,.yaml

# Production Security
CHRONICLE_ENABLE_CSP=true
CHRONICLE_ENABLE_SECURITY_HEADERS=true
CHRONICLE_ENABLE_RATE_LIMITING=true
```

### Security Best Practices

1. **Never commit real credentials** to version control
2. **Use service role keys** only on secure servers
3. **Enable Row Level Security** in Supabase
4. **Rotate keys regularly** in production
5. **Use strong CSP policies** in production
6. **Monitor for credential leaks** in logs

## Performance Optimization

### Recommended Settings by Environment

#### Development
```env
CHRONICLE_MAX_EVENTS_DISPLAY=500
CHRONICLE_POLLING_INTERVAL=3000
CHRONICLE_BATCH_SIZE=25
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=100
```

#### Staging
```env
CHRONICLE_MAX_EVENTS_DISPLAY=800
CHRONICLE_POLLING_INTERVAL=5000
CHRONICLE_BATCH_SIZE=40
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=75
```

#### Production
```env
CHRONICLE_MAX_EVENTS_DISPLAY=1000
CHRONICLE_POLLING_INTERVAL=10000
CHRONICLE_BATCH_SIZE=50
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50
```

## Troubleshooting

### Common Issues

#### 1. Variables Not Loading
```bash
# Check file exists and format
cat .env | head -5

# Verify Next.js can read variables
npm run validate:env

# Test hooks variable loading
cd apps/hooks
python -c "import os; print('Supabase URL:', bool(os.getenv('CHRONICLE_SUPABASE_URL')))"
```

#### 2. Inconsistent Configuration
```bash
# Validate all environment files
./scripts/validate-env.sh

# Check for conflicts
grep -r "SUPABASE_URL" apps/*/env*
```

#### 3. Permission Issues
```bash
# Fix file permissions
chmod 600 .env apps/*/.env*

# Check ownership
ls -la .env apps/*/.env*
```

### Debug Commands

```bash
# Show all environment variables
env | grep CHRONICLE | sort

# Test database connection
cd apps/hooks
python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())"

# Validate configuration
npm run validate:config
```

## Migration from Old Configuration

If you have existing `.env` files with different naming:

### 1. Backup Existing Files
```bash
# Backup current configuration
mkdir -p backup/env
cp apps/*/.env* backup/env/
```

### 2. Update Variable Names

| Old Variable | New Variable |
|--------------|--------------|
| `SUPABASE_URL` | `CHRONICLE_SUPABASE_URL` |
| `LOG_LEVEL` | `CHRONICLE_LOG_LEVEL` |
| `DEBUG` | `CHRONICLE_DEBUG` |

### 3. Validate Migration
```bash
# Test all components after migration
npm run test
cd apps/hooks && python -m pytest
```

## References

- **Root Template**: `/.env.template` - Master configuration file
- **Dashboard Template**: `/apps/dashboard/.env.example` - Dashboard-specific overrides
- **Hooks Template**: `/apps/hooks/.env.template` - Hooks-specific configuration
- **Installation Guide**: `/docs/setup/installation.md` - Complete setup instructions
- **Security Guide**: `/docs/guides/security.md` - Security best practices

---

**Configuration typically takes 5-10 minutes. Always start with the root .env.template file.**