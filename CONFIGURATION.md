# Chronicle Configuration Guide

> **Complete configuration reference for Chronicle observability system deployment**

## Overview

Chronicle uses environment variables for configuration management across both the dashboard and hooks components. This guide provides comprehensive configuration examples for different deployment scenarios.

## Quick Configuration

### Minimal Setup (Development)

**Dashboard** (.env.local):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Hooks** (.env):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
CLAUDE_HOOKS_DB_PATH=~/.chronicle/fallback.db
```

## Environment-Specific Configurations

### Development Environment

**Dashboard Configuration** (apps/dashboard/.env.local):
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key

# Development Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=true

# Feature Flags
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_EXPORT=true
```

**Hooks Configuration** (apps/hooks/.env):
```env
# Database Configuration
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/dev_fallback.db

# Development Settings
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_DEV_MODE=true
CLAUDE_HOOKS_VERBOSE=true

# Relaxed Security for Development
CLAUDE_HOOKS_SANITIZE_DATA=false
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=50

# Performance Settings
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=200
```

### Testing Environment

**Dashboard Configuration**:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key

# Testing Settings
NEXT_PUBLIC_ENVIRONMENT=testing
NEXT_PUBLIC_DEBUG=false
```

**Hooks Configuration**:
```env
# Database Configuration
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=your-test-anon-key
CLAUDE_HOOKS_DB_PATH=/tmp/chronicle_test.db

# Testing Settings
CLAUDE_HOOKS_LOG_LEVEL=ERROR
CLAUDE_HOOKS_MOCK_DB=true
CLAUDE_HOOKS_TEST_DB_PATH=./test_hooks.db

# Fast Testing Configuration
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50
CLAUDE_HOOKS_MAX_BATCH_SIZE=10
```

### Production Environment

**Dashboard Configuration**:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key

# Production Settings
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEBUG=false

# Performance Optimization
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=500
NEXT_PUBLIC_POLLING_INTERVAL=10000
```

**Hooks Configuration**:
```env
# Database Configuration
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db

# Production Security
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_REMOVE_API_KEYS=true

# Performance Optimization
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50
CLAUDE_HOOKS_ASYNC_OPERATIONS=true
CLAUDE_HOOKS_MAX_BATCH_SIZE=200

# Monitoring
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true
CLAUDE_HOOKS_ERROR_THRESHOLD=5
CLAUDE_HOOKS_MEMORY_THRESHOLD=75
```

## Supabase Configuration

### 1. Create Supabase Project

1. **Sign up** at [supabase.com](https://supabase.com)
2. **Create new project**:
   - Project name: `chronicle-observability`
   - Database password: Generate secure password
   - Region: Choose closest to your location

3. **Get API credentials**:
   - Go to Settings > API
   - Copy Project URL and Anonymous key

### 2. Database Schema Setup

**Option A: Automated Setup**
```bash
cd apps/hooks
python -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()"
```

**Option B: Manual Setup**
1. Open Supabase dashboard
2. Go to SQL Editor
3. Copy and execute schema from `apps/hooks/config/schema.sql`

### 3. Security Configuration (Production)

Enable Row Level Security:
```sql
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_events ENABLE ROW LEVEL SECURITY;

-- Create policies (example)
CREATE POLICY "Users can read their own data" ON sessions
FOR SELECT USING (true);  -- Adjust based on your auth requirements
```

## Security Configuration

### Data Sanitization

**Recommended Production Settings**:
```env
# Enable all security features
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_REMOVE_API_KEYS=true
CLAUDE_HOOKS_REMOVE_FILE_PATHS=true

# Restrict file access
CLAUDE_HOOKS_ALLOWED_EXTENSIONS=.py,.js,.ts,.json,.md,.txt
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=10

# Enable audit logging
CLAUDE_HOOKS_AUDIT_LOGGING=true
CLAUDE_HOOKS_DATA_RETENTION_DAYS=90
```

### API Key Management

**Never commit these to version control**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- Webhook URLs with embedded tokens
- SMTP passwords

**Use environment-specific files**:
- `.env.local` (dashboard - not committed)
- `.env` (hooks - not committed)
- Load from secret management in production

## Performance Tuning

### Dashboard Performance

```env
# Optimize for large datasets
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=1000
NEXT_PUBLIC_POLLING_INTERVAL=5000

# Enable performance features
NEXT_PUBLIC_ENABLE_PROFILER=false  # Only in development
```

### Hooks Performance

```env
# Optimize hook execution
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50  # Lower for production
CLAUDE_HOOKS_MAX_MEMORY_MB=30

# Database optimization
CLAUDE_HOOKS_MAX_BATCH_SIZE=200
CLAUDE_HOOKS_ASYNC_OPERATIONS=true

# Session management
CLAUDE_HOOKS_MAX_EVENTS_PER_SESSION=5000
CLAUDE_HOOKS_AUTO_CLEANUP=true
```

## Monitoring Configuration

### Health Checks

```env
# Enable monitoring
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true

# Set alert thresholds
CLAUDE_HOOKS_ERROR_THRESHOLD=10      # errors per hour
CLAUDE_HOOKS_MEMORY_THRESHOLD=80     # percentage
CLAUDE_HOOKS_DISK_THRESHOLD=90       # percentage
```

### External Integrations

**Slack Notifications**:
```env
CLAUDE_HOOKS_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**Webhook Notifications**:
```env
CLAUDE_HOOKS_WEBHOOK_URL=https://your-monitoring-system.com/webhook
```

**Email Alerts**:
```env
CLAUDE_HOOKS_ALERT_EMAIL=admin@yourcompany.com
CLAUDE_HOOKS_SMTP_SERVER=smtp.gmail.com
CLAUDE_HOOKS_SMTP_PORT=587
CLAUDE_HOOKS_SMTP_USERNAME=your-email@gmail.com
CLAUDE_HOOKS_SMTP_PASSWORD=your-app-password
```

## Deployment Configurations

### Docker Deployment

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  chronicle-dashboard:
    build: ./apps/dashboard
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    
  chronicle-hooks:
    build: ./apps/hooks
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    volumes:
      - ~/.claude:/root/.claude
      - ./data:/data
```

**Environment file** (.env):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Kubernetes Deployment

**ConfigMap**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chronicle-config
data:
  CLAUDE_HOOKS_LOG_LEVEL: "INFO"
  CLAUDE_HOOKS_PERFORMANCE_MONITORING: "true"
  CLAUDE_HOOKS_AUTO_CLEANUP: "true"
```

**Secret**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: chronicle-secrets
type: Opaque
stringData:
  SUPABASE_URL: "https://your-project.supabase.co"
  SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY: "your-service-key"
```

## Configuration Validation

### Validation Scripts

**Test Dashboard Configuration**:
```bash
cd apps/dashboard
npm run build  # Validates Next.js configuration
```

**Test Hooks Configuration**:
```bash
cd apps/hooks
python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())"
```

**Validate All Settings**:
```bash
python apps/hooks/install.py --validate-only
```

### Common Validation Errors

1. **Invalid Supabase URL**: Must match `https://xxx.supabase.co` format
2. **Missing API Key**: Required for database connection
3. **Permission Issues**: Check file permissions for SQLite fallback
4. **Network Issues**: Test Supabase connectivity

## Troubleshooting Configuration

### Environment Variables Not Loading

**Check file locations**:
```bash
# Dashboard environment
ls -la apps/dashboard/.env.local

# Hooks environment  
ls -la apps/hooks/.env

# Check syntax
cat apps/hooks/.env | grep -v '^#' | grep '='
```

### Database Connection Issues

**Test Supabase connection**:
```bash
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

**Check SQLite fallback**:
```bash
ls -la ~/.chronicle/
sqlite3 ~/.chronicle/fallback.db ".tables"
```

### Permission Problems

**Fix file permissions**:
```bash
chmod 600 apps/dashboard/.env.local
chmod 600 apps/hooks/.env
chmod -R 755 ~/.claude/
```

## Configuration Templates

### Minimal Configuration (apps/hooks/.env.minimal)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/fallback.db
```

### Development Configuration (apps/hooks/.env.development)
```env
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/dev_fallback.db
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_SANITIZE_DATA=false
```

### Production Configuration (apps/hooks/.env.production)
```env
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true
```

## Next Steps

1. **Choose Configuration**: Select appropriate template for your environment
2. **Configure Supabase**: Set up database and get API keys
3. **Test Configuration**: Validate settings before deployment
4. **Deploy**: Use configuration with deployment method
5. **Monitor**: Set up alerts and monitoring

---

**For environment-specific deployment guides, see INSTALLATION.md**