# Chronicle Troubleshooting Guide

## Overview

This guide covers common issues, error messages, and debugging procedures for Chronicle. Use this systematic approach to diagnose and resolve problems quickly.

## Quick Diagnostic Checklist

When Chronicle isn't working properly, run through this checklist:

```bash
# 1. Check server status
curl -s http://localhost:8510/health | jq '.'

# 2. Verify processes are running
ps aux | grep -E "(main.py|uvicorn|chronicle)"

# 3. Check database connectivity
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db "PRAGMA integrity_check;"

# 4. Verify dashboard accessibility
curl -s http://localhost:3000 | grep -q "Chronicle"

# 5. Check logs for errors
tail -50 ~/.claude/hooks/chronicle/logs/chronicle.log
```

## Common Issues and Solutions

### Installation Issues

#### Issue: `python install.py` fails with permission errors

**Symptoms:**
```bash
PermissionError: [Errno 13] Permission denied: '/Users/username/.claude/settings.json'
```

**Solutions:**
```bash
# Fix file permissions
chmod 644 ~/.claude/settings.json
chmod 755 ~/.claude/hooks/

# If using sudo, avoid it - run as regular user
# Chronicle should NOT be installed with sudo

# If still failing, check ownership
ls -la ~/.claude/
chown -R $(whoami):$(id -gn) ~/.claude/
```

#### Issue: Dependencies installation fails

**Symptoms:**
```bash
ERROR: Could not install packages due to an EnvironmentError
pip: command not found
```

**Solutions:**
```bash
# Ensure pip is installed
python -m ensurepip --upgrade

# Use explicit Python version
python3 -m pip install -r requirements.txt

# On macOS with multiple Python versions
/usr/bin/python3 -m pip install -r requirements.txt

# Virtual environment approach
python -m venv chronicle-env
source chronicle-env/bin/activate  # On Windows: chronicle-env\Scripts\activate
pip install -r requirements.txt
```

### Server Issues

#### Issue: Server won't start - "Address already in use"

**Symptoms:**
```bash
OSError: [Errno 48] Address already in use
```

**Solutions:**
```bash
# Find process using port 8510
lsof -i :8510
netstat -an | grep 8510

# Kill existing process
kill -9 <PID>

# Or use different port
python main.py --port 8511
```

#### Issue: Server starts but dashboard can't connect

**Symptoms:**
- Server health check works: `curl http://localhost:8510/health` ✅
- Dashboard shows connection errors
- WebSocket connection fails

**Solutions:**
```bash
# Check CORS configuration
curl -H "Origin: http://localhost:3000" http://localhost:8510/health

# Verify server logs for CORS errors
tail -f chronicle.log | grep -i cors

# Check firewall settings (macOS)
sudo pfctl -sr | grep 8510

# Verify WebSocket endpoint
curl --include --no-buffer \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  --header "Sec-WebSocket-Version: 13" \
  http://localhost:8510/ws
```

#### Issue: Server crashes with database errors

**Symptoms:**
```bash
sqlite3.OperationalError: database is locked
sqlite3.DatabaseError: database disk image is malformed
```

**Solutions:**
```bash
# Check database integrity
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db "PRAGMA integrity_check;"

# If database is corrupted, restore from backup
cp ~/chronicle-backups/chronicle-latest.db.gz .
gunzip chronicle-latest.db.gz
mv chronicle-latest.db ~/.claude/hooks/chronicle/data/chronicle.db

# If database is locked, find and kill processes
fuser ~/.claude/hooks/chronicle/data/chronicle.db
lsof ~/.claude/hooks/chronicle/data/chronicle.db

# Check available disk space
df -h ~/.claude/hooks/chronicle/data/
```

### Database Issues

#### Issue: SQLite database corruption

**Symptoms:**
```bash
SQLite error: database disk image is malformed
PRAGMA integrity_check returns errors
```

**Diagnosis:**
```bash
# Check database integrity
sqlite3 chronicle.db "PRAGMA integrity_check;"

# Check database file
file chronicle.db
ls -la chronicle.db

# Attempt to dump recoverable data
sqlite3 chronicle.db ".dump" > recovered_data.sql
```

**Solutions:**
```bash
# Method 1: Restore from backup (recommended)
cp ~/chronicle-backups/chronicle-20241203_143000.db.gz .
gunzip chronicle-20241203_143000.db.gz
mv chronicle-20241203_143000.db chronicle.db

# Method 2: Attempt database recovery
sqlite3 corrupted.db ".recover" | sqlite3 recovered.db

# Method 3: Recreate database and import data
python apps/hooks/scripts/setup_schema.py
sqlite3 new_chronicle.db < recovered_data.sql
```

#### Issue: Supabase connection failures

**Symptoms:**
```bash
ConnectionError: Unable to connect to Supabase
psycopg2.OperationalError: connection to server failed
```

**Diagnosis:**
```bash
# Test Supabase connectivity
pg_isready -h <supabase-host> -p 5432

# Test authentication
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -c "SELECT version();"

# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

**Solutions:**
```bash
# Verify environment configuration
source .env
env | grep SUPABASE

# Test with curl
curl -X GET "$SUPABASE_URL/rest/v1/sessions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# Check Supabase project status
# Visit Supabase Dashboard → Settings → Database
# Verify connection pooler settings

# Update connection string with direct connection
SUPABASE_DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres"
```

### Dashboard Issues

#### Issue: Dashboard shows "No events" but server has data

**Symptoms:**
- Server `/health` shows events in database
- Dashboard displays empty state
- Console shows no network errors

**Diagnosis:**
```bash
# Check API endpoints directly
curl http://localhost:8510/api/sessions | jq '.'
curl http://localhost:8510/api/events | jq '.'

# Test WebSocket connection
wscat -c ws://localhost:8510/ws

# Check browser console for errors
# Open Developer Tools → Console
```

**Solutions:**
```bash
# Check time synchronization
date
# Verify event timestamps aren't in future

# Test dashboard API calls
curl -X GET "http://localhost:8510/api/sessions" \
  -H "Accept: application/json" | jq '.sessions | length'

# Restart dashboard with debug logging
cd apps/dashboard
npm run dev -- --debug

# Clear browser cache and storage
# Developer Tools → Application → Clear Storage
```

#### Issue: Dashboard performance is slow

**Symptoms:**
- Slow page loads
- Laggy event updates
- High memory usage in browser

**Solutions:**
```bash
# Check event volume
curl http://localhost:8510/api/stats | jq '.database'

# Limit event queries
# Edit dashboard configuration to reduce event batch size

# Monitor WebSocket traffic
# Developer Tools → Network → WS

# Optimize database queries
sqlite3 chronicle.db "EXPLAIN QUERY PLAN SELECT * FROM events ORDER BY timestamp DESC LIMIT 1000;"
```

### Hook System Issues

#### Issue: Hooks not triggering

**Symptoms:**
- Claude Code works but no events in Chronicle
- Hooks installed but not executing
- Missing events for certain operations

**Diagnosis:**
```bash
# Check hook installation
cat ~/.claude/settings.json | jq '.hooks'

# Verify hook files exist
ls -la ~/.claude/hooks/chronicle/src/hooks/

# Test hook execution manually
python ~/.claude/hooks/chronicle/src/hooks/session_start.py
```

**Solutions:**
```bash
# Reinstall hooks
python install.py --force

# Check hook permissions
chmod +x ~/.claude/hooks/chronicle/src/hooks/*.py

# Verify Python path in hooks
head -1 ~/.claude/hooks/chronicle/src/hooks/session_start.py
which python3

# Debug hook execution
export CHRONICLE_DEBUG=1
# Run Claude Code operation and check logs
```

#### Issue: Hook errors prevent Claude Code operations

**Symptoms:**
```bash
Hook execution failed: ModuleNotFoundError
Claude Code hangs during tool execution
Permission denied errors in hook execution
```

**Solutions:**
```bash
# Check hook error logs
cat ~/.claude/hooks/chronicle/logs/errors.log

# Test hook dependencies
python -c "import sqlite3, json, os, sys; print('Dependencies OK')"

# Verify hook configuration
python ~/.claude/hooks/chronicle/src/lib/utils.py

# Disable hooks temporarily to isolate issue
mv ~/.claude/hooks/chronicle ~/.claude/hooks/chronicle.disabled
# Test Claude Code without hooks
```

### Performance Issues

#### Issue: High memory usage

**Symptoms:**
```bash
Chronicle process using >500MB RAM
System becomes unresponsive
Out of memory errors
```

**Diagnosis:**
```bash
# Monitor memory usage
ps -o pid,rss,vsz,comm -p $(pgrep -f "main.py")
top -p $(pgrep -f "main.py")

# Check for memory leaks
valgrind --tool=massif python main.py

# Monitor database size
ls -lh ~/.claude/hooks/chronicle/data/chronicle.db
```

**Solutions:**
```bash
# Implement memory cleanup
# Add to server configuration:
CHRONICLE_MEMORY_LIMIT=200  # MB

# Database cleanup
sqlite3 chronicle.db "DELETE FROM events WHERE timestamp < datetime('now', '-30 days');"
sqlite3 chronicle.db "VACUUM;"

# Restart server periodically
# Add to crontab:
0 3 * * * /path/to/restart-chronicle.sh
```

#### Issue: Slow response times

**Symptoms:**
- API responses take >5 seconds
- Dashboard loads slowly
- WebSocket connection timeouts

**Diagnosis:**
```bash
# Test API response times
curl -w "@curl-format.txt" -s http://localhost:8510/health

# Create curl-format.txt:
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}s
        time_connect:  %{time_connect}s
     time_appconnect:  %{time_appconnect}s
    time_pretransfer:  %{time_pretransfer}s
       time_redirect:  %{time_redirect}s
  time_starttransfer:  %{time_starttransfer}s
                     ----------
          time_total:  %{time_total}s
EOF

# Profile database queries
sqlite3 chronicle.db ".timer on" "SELECT * FROM events LIMIT 1000;"
```

**Solutions:**
```bash
# Optimize database (see performance-tuning.md)
sqlite3 chronicle.db "PRAGMA optimize;"
sqlite3 chronicle.db "ANALYZE;"

# Add database indexes
sqlite3 chronicle.db "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);"

# Implement query caching
# Add Redis or in-memory cache

# Tune server workers
python main.py --workers 2  # Only for non-SQLite setups
```

## Error Messages and Solutions

### Database Errors

#### `sqlite3.OperationalError: database is locked`

**Cause:** Multiple processes accessing SQLite database simultaneously

**Solution:**
```bash
# Find processes with database open
lsof ~/.claude/hooks/chronicle/data/chronicle.db

# Kill conflicting processes
kill <PID>

# Enable WAL mode for better concurrency
sqlite3 chronicle.db "PRAGMA journal_mode=WAL;"
```

#### `sqlite3.DatabaseError: file is not a database`

**Cause:** Database file is corrupted or not a SQLite database

**Solution:**
```bash
# Check file type
file ~/.claude/hooks/chronicle/data/chronicle.db

# If corrupted, restore from backup
mv chronicle.db chronicle.db.corrupted
cp ~/chronicle-backups/chronicle-latest.db chronicle.db

# If no backup, recreate database
python apps/hooks/scripts/setup_schema.py
```

### Network Errors

#### `ConnectionRefusedError: [Errno 61] Connection refused`

**Cause:** Server not running or wrong port

**Solution:**
```bash
# Start server
python apps/server/main.py

# Check if running
curl http://localhost:8510/health

# Try different port
python main.py --port 8511
```

#### `CORS policy` errors in browser

**Cause:** Cross-origin request blocked

**Solution:**
```bash
# Check server CORS configuration
grep -n "CORS" apps/server/main.py

# Verify dashboard origin
curl -H "Origin: http://localhost:3000" http://localhost:8510/health

# Update CORS settings if needed
```

### Import Errors

#### `ModuleNotFoundError: No module named 'chronicle'`

**Cause:** Python path issues or missing installation

**Solution:**
```bash
# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Reinstall Chronicle
pip install -e .

# Use absolute paths in hooks
sed -i 's/from chronicle/from \/full\/path\/to\/chronicle/g' ~/.claude/hooks/chronicle/src/hooks/*.py
```

## Debugging Procedures

### Enable Debug Logging

```bash
# Server debug mode
python main.py --debug

# Hook debug logging
export CHRONICLE_DEBUG=1
export CHRONICLE_LOG_LEVEL=DEBUG
```

### Capture Debugging Information

```bash
#!/bin/bash
# chronicle-debug-info.sh

echo "=== Chronicle Debug Information ==="
echo "Date: $(date)"
echo

echo "=== System Info ==="
uname -a
python --version
pip --version
echo

echo "=== Process Status ==="
ps aux | grep -E "(main.py|uvicorn|chronicle)" | grep -v grep
echo

echo "=== Network Status ==="
netstat -an | grep -E "(8510|3000)"
lsof -i :8510
echo

echo "=== Database Status ==="
ls -la ~/.claude/hooks/chronicle/data/
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db "PRAGMA integrity_check;"
echo

echo "=== Recent Logs ==="
tail -50 ~/.claude/hooks/chronicle/logs/chronicle.log
echo

echo "=== Configuration ==="
cat ~/.claude/settings.json | jq '.hooks' 2>/dev/null || echo "settings.json not found or invalid"
echo

echo "=== Health Check ==="
curl -s http://localhost:8510/health | jq '.' 2>/dev/null || echo "Server not responding"
```

### Performance Profiling

```bash
# Profile server performance
python -m cProfile -o profile.stats main.py

# Analyze profile
python -c "import pstats; p = pstats.Stats('profile.stats'); p.sort_stats('cumulative').print_stats(20)"

# Memory profiling
pip install memory_profiler
python -m memory_profiler main.py
```

### Database Debugging

```sql
-- Check database schema
.schema

-- View table statistics  
SELECT name, 
       (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=t.name) as table_count,
       (SELECT COUNT(*) FROM pragma_table_info(t.name)) as column_count
FROM sqlite_master t WHERE type='table';

-- Check recent events
SELECT COUNT(*) as total_events,
       MIN(timestamp) as earliest,
       MAX(timestamp) as latest
FROM events;

-- Check session distribution
SELECT event_type, COUNT(*) as count 
FROM events 
GROUP BY event_type 
ORDER BY count DESC;
```

## Support Resources

### Health Check Scripts

Run the built-in health check:
```bash
./scripts/health-check.sh
```

### Log Analysis

```bash
# Search for errors
grep -i error ~/.claude/hooks/chronicle/logs/*.log

# Monitor logs in real-time
tail -f ~/.claude/hooks/chronicle/logs/chronicle.log | grep -E "(ERROR|WARN|CRITICAL)"

# Log rotation check
ls -la /var/log/chronicle*
```

### Configuration Validation

```bash
# Validate environment
python scripts/validate-environment.py

# Check hook configuration
python apps/hooks/scripts/validate_environment.py

# Test database connectivity
python -c "
from apps.hooks.src.database import create_local_database
db = create_local_database()
print('Database OK' if db.test_connection() else 'Database Error')
"
```

## Recovery Procedures

### Emergency Recovery

If Chronicle is completely broken:

1. **Stop all processes**:
   ```bash
   pkill -f "main.py"
   pkill -f "chronicle"
   ```

2. **Backup current state**:
   ```bash
   cp -r ~/.claude/hooks/chronicle ~/.claude/hooks/chronicle.backup.$(date +%Y%m%d)
   ```

3. **Clean installation**:
   ```bash
   rm -rf ~/.claude/hooks/chronicle
   python install.py --force
   ```

4. **Restore data if needed**:
   ```bash
   cp ~/.claude/hooks/chronicle.backup.*/data/chronicle.db ~/.claude/hooks/chronicle/data/
   ```

### Rollback Procedures

If update breaks Chronicle:

```bash
# Revert to backup
mv ~/.claude/hooks/chronicle ~/.claude/hooks/chronicle.broken
mv ~/.claude/hooks/chronicle.backup ~/.claude/hooks/chronicle

# Or reinstall previous version
git checkout previous-tag
python install.py --force
```

For additional support, check:
- [Server Management Guide](server-management.md)
- [Performance Tuning Guide](performance-tuning.md) 
- [Backup & Restore Guide](backup-restore.md)

## Getting Help

If this troubleshooting guide doesn't resolve your issue:

1. **Collect debug information**: Run `chronicle-debug-info.sh`
2. **Check logs**: Review all log files for error patterns
3. **Test minimal setup**: Try fresh installation in new directory
4. **Search existing issues**: Check project repository for similar problems
5. **Report bug**: Include debug info, logs, and reproduction steps