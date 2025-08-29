# Chronicle Quick Start Guide

> **From installation to first session in under 5 minutes**

This guide gets you from a fresh Chronicle installation to monitoring your first Claude Code session. If you haven't installed Chronicle yet, start with the [Installation Guide](./installation.md).

## Initial Setup

### Step 1: Verify Installation

Check that Chronicle installed correctly:

```bash
# Check installation directory exists
ls ~/.claude/hooks/chronicle/

# Should show:
# dashboard/  hooks/  server/  start.sh
```

### Step 2: Start Chronicle Dashboard

```bash
# Use the convenient startup script
~/.claude/hooks/chronicle/start.sh

# Or start manually
cd ~/.claude/hooks/chronicle/dashboard
npm start
```

The dashboard will:
- Build if needed (first run may take 30 seconds)
- Start the web server on port 3000
- Automatically open http://localhost:3000 in your browser

### Step 3: Verify Dashboard Connection

When the dashboard loads, you should see:

✅ **Green Connection Status** - Shows "Connected" in the header  
✅ **Empty Event Feed** - Ready to capture your first events  
✅ **Session Panel** - Shows "No active sessions" initially

If you see red connection status, check the [troubleshooting section](#troubleshooting) below.

## Configuration Options

Chronicle works out-of-the-box, but you can customize settings:

### Environment Configuration

Chronicle uses these config files:

**Dashboard Settings** (`~/.claude/hooks/chronicle/dashboard/.env.local`):
```env
# Production settings (default)
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEBUG=false

# For debugging, change to:
# NEXT_PUBLIC_DEBUG=true
# NEXT_PUBLIC_ENVIRONMENT=development
```

**Hooks Settings** (`~/.claude/hooks/chronicle/hooks/.env`):
```env
# Database location
CLAUDE_HOOKS_DB_TYPE=sqlite
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/server/data/chronicle.db

# Logging level (info, debug, warning, error)
LOG_LEVEL=info

# Security settings (recommended)
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10

# Performance settings
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
```

### Database Location

By default, Chronicle stores data in:
- **SQLite Database**: `~/.claude/hooks/chronicle/server/data/chronicle.db`
- **Logs**: `~/.claude/hooks/chronicle/server/logs/chronicle.log`

To change the database location, edit the `CLAUDE_HOOKS_DB_PATH` in the hooks `.env` file.

### Dashboard Port

To run the dashboard on a different port:

```bash
cd ~/.claude/hooks/chronicle/dashboard
PORT=3001 npm start
```

## Starting Your First Session

### Step 1: Open Claude Code

Start Claude Code in any project directory:

```bash
cd your-project
claude-code
```

### Step 2: Trigger Events

Use Claude Code normally. These actions create events:

```bash
# Read files (creates "tool_use" events)
# Type: "Read package.json"

# Run commands (creates "tool_use" events)  
# Type: "List files in this directory"

# Ask questions (creates "prompt" events)
# Type: "What is this project about?"
```

### Step 3: Watch Dashboard

Switch back to the Chronicle dashboard at http://localhost:3000. You should see:

1. **Session Created** - New session appears in the left sidebar
2. **Real-time Events** - Events stream in as you use Claude Code
3. **Event Details** - Click any event to see full details

## Understanding the Dashboard

### Header Bar
- **Chronicle** - Title and navigation
- **Connection Status** - Green dot = connected, Red = disconnected
- **Metrics** - Live event counts and throughput
- **Session Info** - Current session details

### Left Sidebar
- **Active Sessions** - Currently running Claude Code sessions
- **Session History** - Previous sessions (click to explore)
- **Filters** - Filter events by type, project, etc.

### Main Event Feed
- **Real-time Events** - Live stream of Claude Code activity
- **Event Types**: 
  - 🟡 **Prompt** - Your messages to Claude Code
  - 🔧 **Tool Use** - File reads, commands, searches
  - 🟢 **Session** - Session start/stop events
- **Auto-scroll** - Automatically scrolls to newest events
- **Event Details** - Click any event for full information

## Common Tasks

### View Session History
1. Look at the left sidebar under "Recent Sessions"
2. Click any previous session to explore its events
3. Use filters to find specific events or time periods

### Export Session Data
```bash
# Copy database file
cp ~/.claude/hooks/chronicle/server/data/chronicle.db ./session-backup.db

# View raw data (requires sqlite3)
sqlite3 ~/.claude/hooks/chronicle/server/data/chronicle.db
.tables
SELECT * FROM chronicle_events LIMIT 5;
```

### Filter Events
- Use the filter buttons in the sidebar
- Filter by event type (Prompt, Tool Use, Session)
- Filter by project or time range
- Search event content

### Monitor Performance
The header shows live metrics:
- **Events/min** - Current activity level  
- **Total Events** - Events in current session
- **Session Time** - How long current session has been running

## Stopping Chronicle

### Graceful Shutdown
```bash
# In the terminal where Chronicle is running:
Ctrl+C
```

### Force Stop
```bash
# Kill the dashboard process
pkill -f "npm start"

# Or find the specific process
ps aux | grep "npm start"
kill <pid>
```

## Troubleshooting

### Dashboard Shows "Disconnected"

**Cause**: Database connection issue or missing hooks

**Solutions**:
```bash
# Check database exists
ls ~/.claude/hooks/chronicle/server/data/chronicle.db

# Check hooks are registered
cat ~/.claude/settings.json | grep -A 10 '"hooks"'

# Restart Claude Code to reload hooks
```

### No Events Appearing

**Cause**: Hooks not executing or Claude Code not configured

**Solutions**:
```bash
# Test a hook manually
cd ~/.claude/hooks/chronicle/hooks
echo '{"test": "data"}' | python pre_tool_use.py

# Check hook permissions
ls -la ~/.claude/hooks/chronicle/hooks/*.py
# Should show executable permissions (x)

# Fix permissions if needed
chmod +x ~/.claude/hooks/chronicle/hooks/*.py

# Check Claude Code hook registration
cat ~/.claude/settings.json
```

### Dashboard Won't Start

**Cause**: Port conflict or missing dependencies

**Solutions**:
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill conflicting process
kill <pid>

# Or use different port
cd ~/.claude/hooks/chronicle/dashboard
PORT=3001 npm start

# Rebuild if needed
npm run build
```

### High Memory Usage

**Cause**: Large session history or memory leak

**Solutions**:
```bash
# Clear old session data
sqlite3 ~/.claude/hooks/chronicle/server/data/chronicle.db
DELETE FROM chronicle_events WHERE timestamp < datetime('now', '-30 days');
VACUUM;

# Restart dashboard
pkill -f "npm start"
cd ~/.claude/hooks/chronicle/dashboard
npm start
```

### Permission Denied Errors

**Cause**: Incorrect file permissions

**Solutions**:
```bash
# Fix Chronicle directory permissions
chmod -R 755 ~/.claude/hooks/chronicle/

# Fix hooks specifically
chmod +x ~/.claude/hooks/chronicle/hooks/*.py

# Fix database directory
chmod 755 ~/.claude/hooks/chronicle/server/data/
```

## Advanced Configuration

### Enable Debug Logging

For detailed logging during troubleshooting:

```bash
# Edit hooks environment
nano ~/.claude/hooks/chronicle/hooks/.env

# Change LOG_LEVEL to debug
LOG_LEVEL=debug

# Edit dashboard environment  
nano ~/.claude/hooks/chronicle/dashboard/.env.local

# Enable debug mode
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_ENVIRONMENT=development
```

### Custom Database Location

To store data elsewhere:

```bash
# Edit hooks environment
nano ~/.claude/hooks/chronicle/hooks/.env

# Change database path
CLAUDE_HOOKS_DB_PATH=/path/to/your/chronicle.db

# Create directory
mkdir -p /path/to/your/
```

### Performance Tuning

For high-volume usage:

```bash
# Edit hooks environment
nano ~/.claude/hooks/chronicle/hooks/.env

# Optimize settings
HOOK_TIMEOUT_MS=50          # Faster hooks
ASYNC_OPERATIONS=true       # Better concurrency  
MAX_INPUT_SIZE_MB=5         # Smaller data capture
```

## Next Steps

You're now ready to explore Chronicle's full capabilities:

1. **[First Session Guide](./first-session.md)** - Learn advanced dashboard features
2. **[Configuration Reference](../reference/configuration.md)** - Detailed settings
3. **[API Documentation](../reference/api.md)** - Integrate with Chronicle data
4. **[Troubleshooting Guide](../guides/troubleshooting.md)** - Solve advanced issues

## Need Help?

- **Check Logs**: `tail -f ~/.claude/hooks/chronicle/server/logs/chronicle.log`
- **Test Components**: Use the manual verification steps above
- **Reset Installation**: Remove `~/.claude/hooks/chronicle/` and reinstall
- **Report Issues**: Include log files and system information

Chronicle is now monitoring your Claude Code sessions. Start coding with Claude Code and watch the real-time activity in your dashboard!