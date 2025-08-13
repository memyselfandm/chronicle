# Chronicle Troubleshooting Guide

> **Comprehensive troubleshooting guide for Chronicle observability system - resolve common issues quickly**

## Quick Diagnosis

Start here for rapid issue identification:

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Test individual components
cd apps/dashboard && npm run dev  # Should start on port 3000
cd apps/hooks && python install.py --validate-only  # Should pass all checks
```

## Common Issues by Component

### Dashboard Issues

#### 1. Dashboard Won't Start

**Symptoms**: 
- `npm run dev` fails
- Port 3000 not accessible
- Build errors

**Diagnosis**:
```bash
# Check Node.js version
node --version  # Should be 18+

# Check port availability
lsof -i :3000
netstat -tulpn | grep 3000

# Check environment file
ls -la apps/dashboard/.env.local
cat apps/dashboard/.env.local
```

**Solutions**:
```bash
# Fix Node.js version
nvm install 18
nvm use 18

# Kill conflicting process
kill $(lsof -t -i:3000)

# Fix environment file
cp apps/dashboard/.env.example apps/dashboard/.env.local
# Edit with correct Supabase credentials

# Clear cache and reinstall
rm -rf apps/dashboard/.next apps/dashboard/node_modules
cd apps/dashboard && npm install

# Check for syntax errors
npm run build
```

#### 2. Dashboard Loads But No Data

**Symptoms**:
- Dashboard interface appears
- No events displayed
- Loading states persist

**Diagnosis**:
```bash
# Test Supabase connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"

# Check browser console for errors
# Open Developer Tools > Console

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Solutions**:
```bash
# Fix Supabase URL format
# Should be: https://your-project.supabase.co
# Not: https://your-project.supabase.co/

# Test database schema
python -c "
from apps.hooks.src.database import DatabaseManager
dm = DatabaseManager()
print('Tables:', dm.list_tables())
"

# Enable mock data for testing
# In .env.local:
NEXT_PUBLIC_MOCK_DATA=true
```

#### 3. Real-time Updates Not Working

**Symptoms**:
- Dashboard shows old data
- New events don't appear automatically
- WebSocket connection fails

**Diagnosis**:
```bash
# Check real-time configuration in Supabase
# Go to Settings > API > Real-time section

# Test WebSocket connection
# In browser console:
const ws = new WebSocket('wss://your-project.supabase.co/realtime/v1/websocket')
ws.onopen = () => console.log('Connected')
ws.onerror = (e) => console.log('Error:', e)
```

**Solutions**:
```sql
-- Enable real-time for tables
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
```

```bash
# Update Supabase client
cd apps/dashboard
npm update @supabase/supabase-js
```

### Hooks System Issues

#### 1. Hooks Not Executing

**Symptoms**:
- No events in dashboard
- Hook logs empty
- Claude Code continues normally

**Diagnosis**:
```bash
# Check hook permissions
ls -la ~/.claude/hooks/

# Verify Claude Code settings
cat ~/.claude/settings.json | jq .hooks

# Test hook manually
echo '{"session_id":"test","tool_name":"Read"}' | python ~/.claude/hooks/pre_tool_use.py

# Check Claude Code logs
tail -f ~/.claude/logs/claude-code.log
```

**Solutions**:
```bash
# Fix hook permissions
chmod +x ~/.claude/hooks/*.py

# Reinstall hooks
cd apps/hooks
python install.py --force

# Validate settings.json syntax
jq . ~/.claude/settings.json

# Check Python path in hooks
head -1 ~/.claude/hooks/pre_tool_use.py
which python3
```

#### 2. Database Connection Failed

**Symptoms**:
- "Connection refused" errors
- Fallback to SQLite
- Database timeout errors

**Diagnosis**:
```bash
# Test Supabase connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Check environment variables
env | grep SUPABASE

# Test database credentials
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
print('Connection test:', dm.test_connection())
"

# Check network connectivity
ping $(echo $SUPABASE_URL | sed 's|https://||' | sed 's|/.*||')
```

**Solutions**:
```bash
# Fix environment variables
cd apps/hooks
cp .env.template .env
# Edit .env with correct credentials

# Test SQLite fallback
mkdir -p ~/.chronicle
sqlite3 ~/.chronicle/fallback.db ".tables"

# Check firewall/proxy settings
# Ensure HTTPS traffic allowed

# Verify API key format
# Should start with: eyJ0eXAiOiJKV1Q...
```

#### 3. Hook Execution Timeout

**Symptoms**:
- "Hook timeout" in logs
- Slow hook execution
- Claude Code becomes unresponsive

**Diagnosis**:
```bash
# Check hook execution time
time echo '{"test":"data"}' | python ~/.claude/hooks/pre_tool_use.py

# Monitor system resources
htop
iostat 1

# Check hook timeout setting
grep TIMEOUT ~/.claude/settings.json
```

**Solutions**:
```bash
# Increase timeout in settings.json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "timeout": 30  // Increase from 10
      }]
    }]
  }
}

# Optimize hook performance
# In .env:
CLAUDE_HOOKS_ASYNC_OPERATIONS=true
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=200

# Disable expensive operations
CLAUDE_HOOKS_SANITIZE_DATA=false
CLAUDE_HOOKS_PII_FILTERING=false
```

### Database Issues

#### 1. Schema Not Created

**Symptoms**:
- "Table doesn't exist" errors
- Empty Supabase database
- Schema setup fails

**Diagnosis**:
```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check permissions
SELECT current_user, session_user;
```

**Solutions**:
```bash
# Manual schema creation
cd apps/hooks
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
dm.setup_schema()
"

# Or via Supabase dashboard
# Go to SQL Editor
# Copy and execute schema from apps/hooks/config/schema.sql
```

#### 2. Permission Denied

**Symptoms**:
- "Permission denied" on database operations
- RLS policy violations
- Anonymous access blocked

**Solutions**:
```sql
-- Temporarily disable RLS for testing
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Or create permissive policies
CREATE POLICY "Allow all" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all" ON events FOR ALL USING (true);
```

#### 3. Database Performance Issues

**Symptoms**:
- Slow query responses
- Connection timeouts
- High memory usage

**Diagnosis**:
```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables
WHERE schemaname = 'public';
```

**Solutions**:
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX CONCURRENTLY idx_events_session_id ON events(session_id);

-- Vacuum and analyze
VACUUM ANALYZE events;
VACUUM ANALYZE sessions;
```

## Environment-Specific Issues

### Development Environment

#### 1. Hot Reload Not Working

**Solutions**:
```bash
# Clear Next.js cache
rm -rf apps/dashboard/.next

# Check file watchers limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 2. SSL Certificate Issues

**Solutions**:
```bash
# For development, disable SSL verification
# In .env:
NODE_TLS_REJECT_UNAUTHORIZED=0

# Or use mkcert for local SSL
brew install mkcert
mkcert localhost
```

### Production Environment

#### 1. Memory Leaks

**Diagnosis**:
```bash
# Monitor memory usage
free -h
ps aux | grep node

# PM2 memory monitoring
pm2 monit
```

**Solutions**:
```bash
# Set memory limits in PM2
pm2 start ecosystem.config.js --max-memory-restart 1G

# Enable garbage collection
NODE_OPTIONS="--max-old-space-size=1024" pm2 restart all
```

#### 2. SSL/TLS Issues

**Solutions**:
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/domain.com/cert.pem -text -noout

# Renew certificates
sudo certbot renew
sudo nginx -t && sudo nginx -s reload
```

## Platform-Specific Issues

### macOS Issues

#### 1. Python Path Issues

**Solutions**:
```bash
# Use specific Python version
/usr/bin/python3 -m pip install -r requirements.txt

# Fix PATH
export PATH="/usr/local/bin:$PATH"
```

#### 2. Permission Issues

**Solutions**:
```bash
# Fix ~/.claude permissions
sudo chown -R $(whoami) ~/.claude
chmod -R 755 ~/.claude
```

### Linux Issues

#### 1. systemd Service Issues

**Solutions**:
```bash
# Check service status
sudo systemctl status chronicle

# View service logs
sudo journalctl -u chronicle -f

# Fix service file
sudo systemctl daemon-reload
sudo systemctl restart chronicle
```

### Windows (WSL) Issues

#### 1. File Permission Issues

**Solutions**:
```bash
# Fix WSL file permissions
sudo chmod +x ~/.claude/hooks/*.py

# Use WSL Python
/usr/bin/python3 instead of python
```

#### 2. Path Issues

**Solutions**:
```bash
# Use Unix-style paths
export CLAUDE_HOOKS_DB_PATH=/home/user/.chronicle/fallback.db
```

## Advanced Debugging

### Enable Debug Mode

```bash
# Dashboard debug mode
# In .env.local:
NEXT_PUBLIC_DEBUG=true
NODE_ENV=development

# Hooks debug mode
# In .env:
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_VERBOSE=true
```

### Comprehensive Logging

```bash
# Enable all logging
mkdir -p ~/.chronicle/logs

# In .env:
LOG_FILE_PATH=~/.chronicle/logs/hooks.log
CLAUDE_HOOKS_LOG_LEVEL=DEBUG

# Monitor logs in real-time
tail -f ~/.chronicle/logs/*.log
```

### Network Debugging

```bash
# Trace network calls
# Install mitmproxy
pip install mitmproxy

# Run proxy
mitmproxy -s debug_script.py

# Configure environment to use proxy
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080
```

### Performance Profiling

```bash
# Profile Python hooks
python -m cProfile -o profile.out ~/.claude/hooks/pre_tool_use.py

# Profile Node.js dashboard
npm install -g clinic
clinic doctor -- npm start
```

## Diagnostic Scripts

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

echo "🏥 Chronicle Health Check"
echo "========================"

# Check Node.js
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js not found"
fi

# Check Python
PYTHON_VERSION=$(python3 --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Python: $PYTHON_VERSION"
else
    echo "❌ Python not found"
fi

# Check dashboard
if [ -f "apps/dashboard/.env.local" ]; then
    echo "✅ Dashboard environment configured"
else
    echo "❌ Dashboard environment missing"
fi

# Check hooks
if [ -f "apps/hooks/.env" ]; then
    echo "✅ Hooks environment configured"
else
    echo "❌ Hooks environment missing"
fi

# Test database connection
cd apps/hooks
if python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())" 2>/dev/null | grep -q "True"; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
fi

echo "========================"
```

### Log Analyzer Script

```python
#!/usr/bin/env python3
# scripts/analyze-logs.py

import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

def analyze_hooks_log(log_file):
    """Analyze hooks log for common patterns"""
    
    errors = Counter()
    warnings = Counter()
    hook_calls = Counter()
    execution_times = []
    
    with open(log_file, 'r') as f:
        for line in f:
            # Parse log level
            if 'ERROR' in line:
                errors[line.strip()] += 1
            elif 'WARNING' in line:
                warnings[line.strip()] += 1
            
            # Parse hook calls
            if 'Hook executed:' in line:
                hook_match = re.search(r'Hook executed: (\w+)', line)
                if hook_match:
                    hook_calls[hook_match.group(1)] += 1
            
            # Parse execution times
            time_match = re.search(r'Execution time: (\d+)ms', line)
            if time_match:
                execution_times.append(int(time_match.group(1)))
    
    print("📊 Hooks Log Analysis")
    print("====================")
    
    if errors:
        print(f"\n❌ Top Errors ({sum(errors.values())} total):")
        for error, count in errors.most_common(5):
            print(f"  {count}x: {error[:100]}...")
    
    if warnings:
        print(f"\n⚠️  Top Warnings ({sum(warnings.values())} total):")
        for warning, count in warnings.most_common(5):
            print(f"  {count}x: {warning[:100]}...")
    
    if hook_calls:
        print(f"\n🔧 Hook Usage ({sum(hook_calls.values())} total calls):")
        for hook, count in hook_calls.most_common():
            print(f"  {hook}: {count} calls")
    
    if execution_times:
        avg_time = sum(execution_times) / len(execution_times)
        max_time = max(execution_times)
        print(f"\n⏱️  Execution Times:")
        print(f"  Average: {avg_time:.1f}ms")
        print(f"  Maximum: {max_time}ms")
        print(f"  Samples: {len(execution_times)}")

if __name__ == "__main__":
    log_file = sys.argv[1] if len(sys.argv) > 1 else "~/.claude/hooks.log"
    try:
        analyze_hooks_log(log_file)
    except FileNotFoundError:
        print(f"❌ Log file not found: {log_file}")
    except Exception as e:
        print(f"❌ Error analyzing log: {e}")
```

## Getting Help

### Before Asking for Help

1. **Run health check**: `./scripts/health-check.sh`
2. **Check logs**: Review all relevant log files
3. **Test individually**: Isolate the problematic component
4. **Gather information**: System specs, error messages, configuration

### Information to Include

When reporting issues, include:

- **Operating System**: Version and architecture
- **Software Versions**: Node.js, Python, Claude Code
- **Error Messages**: Complete stack traces
- **Configuration**: Environment variables (redacted)
- **Steps to Reproduce**: Detailed reproduction steps
- **Expected vs Actual**: What you expected vs what happened

### Support Channels

1. **Documentation**: Check all `.md` files in project
2. **GitHub Issues**: Create detailed issue report
3. **Community**: Discord/Slack channels if available
4. **Logs**: Always include relevant log excerpts

---

**Most issues can be resolved by following this guide systematically. Start with the health check and work through each component.**