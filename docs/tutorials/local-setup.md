# Local Setup Tutorial - Chronicle

> **Complete step-by-step guide for setting up Chronicle locally with SQLite backend - no external dependencies required**

## Overview

This tutorial will walk you through setting up Chronicle on your local machine for personal development and learning. By the end of this guide, you'll have a fully functional Chronicle installation capturing your Claude Code interactions.

**What you'll accomplish:**
- ✅ Install Chronicle with one command
- ✅ Understand the local SQLite database setup
- ✅ Configure and validate your installation
- ✅ Start monitoring Claude Code activities
- ✅ Access the real-time dashboard

**Time Required**: 10-15 minutes

## Prerequisites

### System Requirements

**Required Software:**
- **Node.js**: 18.0.0+ (we recommend 20.0.0 LTS)
- **Python**: 3.8.0+ (we recommend 3.11+)
- **Claude Code**: Latest version installed
- **Git**: For cloning the repository

**Supported Platforms:**
- ✅ **macOS**: Intel and Apple Silicon
- ✅ **Linux**: Ubuntu 20.04+, Debian 11+, RHEL 8+
- ✅ **Windows**: Native or WSL2

### Pre-Installation Check

Run these commands to verify your system is ready:

```bash
# Check versions
node --version    # Should show 18.0.0 or higher
python --version  # Should show 3.8.0 or higher
pip --version     # Should be available
git --version     # Should be available

# Verify Claude Code installation
ls ~/.claude      # Should show Claude settings directory

# Check available disk space (need ~1GB free)
df -h ~           # macOS/Linux
```

**Example Output:**
```bash
$ node --version
v20.10.0

$ python --version  
Python 3.11.6

$ ls ~/.claude
hooks/    logs/    settings.json
```

## Installation Methods

### Method 1: Automated Installation (Recommended)

The fastest way to get Chronicle running is with our automated installer:

```bash
# Clone the repository
git clone https://github.com/your-org/chronicle.git
cd chronicle

# Run the automated installer
python install.py
```

**What the installer does:**
1. **Installs dependencies** for both dashboard and hooks
2. **Creates SQLite database** at `~/.chronicle/chronicle.db`
3. **Registers hooks** with Claude Code automatically
4. **Starts the server** on http://localhost:3000
5. **Validates installation** and provides health check

**Installer Options:**
```bash
python install.py --help              # Show all options
python install.py --skip-deps         # Skip dependency installation
python install.py --no-start          # Don't start server after install
python install.py --force             # Overwrite existing installation
python install.py --database-path ~/my-chronicle.db  # Custom database location
```

### Method 2: Manual Step-by-Step Installation

If you prefer more control over the installation process:

#### Step 1: Clone and Prepare

```bash
# Clone repository
git clone https://github.com/your-org/chronicle.git
cd chronicle

# Verify project structure
ls -la
# You should see: apps/ docs/ scripts/ install.py
```

#### Step 2: Install Dashboard Dependencies

```bash
cd apps/dashboard

# Install Node.js dependencies
npm install
# or use yarn if you prefer
yarn install

# Verify installation
npm list --depth=0
```

#### Step 3: Install Hooks System

```bash
cd ../hooks

# Install Python dependencies
pip install -r requirements.txt
# or use a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Step 4: Database Setup

Chronicle automatically uses SQLite by default - no configuration needed!

```bash
# Test database setup
python -c "from src.database import DatabaseManager; dm = DatabaseManager(); dm.setup_schema(); print('✅ Database ready!')"
```

**Expected Output:**
```
✅ Database ready!
Database location: /Users/yourname/.chronicle/chronicle.db
Tables created: chronicle_sessions, chronicle_events
```

#### Step 5: Hook Registration

```bash
# Register hooks with Claude Code
python scripts/install.py

# This updates your ~/.claude/settings.json
```

#### Step 6: Start the Dashboard

```bash
cd ../dashboard
npm run dev
```

**You should see:**
```
▲ Next.js 15.0.0
- Local:        http://localhost:3000
- ready in 1.2s
```

## Configuration and Validation

### Environment Configuration

Chronicle works out-of-the-box with SQLite, but you can customize behavior:

**Optional Configuration File** (`~/.chronicle/config.json`):

```json
{
  "database": {
    "type": "sqlite",
    "path": "~/.chronicle/chronicle.db",
    "backup_enabled": true,
    "backup_interval_hours": 24
  },
  "hooks": {
    "log_level": "INFO",
    "max_input_size_mb": 10,
    "sanitize_data": true
  },
  "dashboard": {
    "port": 3000,
    "auto_refresh": true,
    "max_events_display": 1000
  }
}
```

### Validation Steps

#### 1. Test Hook Installation

```bash
# Check hooks are registered
cat ~/.claude/settings.json | grep chronicle

# Test a hook manually
cd apps/hooks
echo '{"session_id":"test-123","tool_name":"Read","file_path":"test.txt"}' | python src/hooks/pre_tool_use.py
```

**Expected Output:**
```json
{"status": "success", "event_recorded": true, "database": "sqlite"}
```

#### 2. Verify Database

```bash
# Check database exists and has tables
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
print(f'Database: {dm.db_path}')
print(f'Connection: {dm.test_connection()}')
print(f'Tables: {dm.get_table_names()}')
"
```

**Expected Output:**
```
Database: /Users/yourname/.chronicle/chronicle.db
Connection: True
Tables: ['chronicle_sessions', 'chronicle_events']
```

#### 3. Test Dashboard Connection

```bash
# Check dashboard health
curl http://localhost:3000/api/health

# Or visit in browser
open http://localhost:3000  # macOS
# Browser should show Chronicle dashboard
```

### Testing Your Installation

#### Test 1: Trigger Events with Claude Code

1. **Open Claude Code** in any project directory
2. **Run some commands**:
   ```bash
   # In Claude Code, try these commands
   > Read package.json
   > Grep "version" *.json
   > Edit README.md and add a comment
   ```

3. **Check the dashboard** - you should see events appearing in real-time!

#### Test 2: Database Data Verification

```bash
cd apps/hooks

# Check session data
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
sessions = dm.get_sessions()
print(f'Sessions found: {len(sessions)}')
for session in sessions[:3]:
    print(f'  - {session[\"project_path\"]} ({session[\"event_count\"]} events)')
"
```

#### Test 3: Event Data Verification

```bash
# Check recent events
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
events = dm.get_recent_events(limit=5)
print(f'Recent events: {len(events)}')
for event in events:
    print(f'  - {event[\"type\"]} at {event[\"timestamp\"]}')
"
```

## Common Local Development Tasks

### Daily Usage

**Starting Chronicle:**
```bash
# Method 1: Use the convenience script
./scripts/quick-start.sh

# Method 2: Manual start
cd apps/dashboard && npm run dev
```

**Stopping Chronicle:**
```bash
# Stop dashboard (Ctrl+C in terminal)
# Hooks continue to work automatically

# To completely disable hooks
python apps/hooks/scripts/install.py --uninstall
```

### Data Management

**Viewing Your Data:**
```bash
# Open dashboard
open http://localhost:3000

# Or use CLI tools
cd apps/hooks
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
print(f'Total sessions: {dm.get_session_count()}')
print(f'Total events: {dm.get_event_count()}')
print(f'Database size: {dm.get_database_size_mb():.1f} MB')
"
```

**Backup and Restore:**
```bash
# Backup database
cp ~/.chronicle/chronicle.db ~/.chronicle/backup-$(date +%Y%m%d).db

# Restore from backup
cp ~/.chronicle/backup-20241215.db ~/.chronicle/chronicle.db

# Clean old data (keep last 30 days)
cd apps/hooks
python -c "
from src.database import DatabaseManager
dm = DatabaseManager()
deleted = dm.cleanup_old_data(days=30)
print(f'Deleted {deleted} old records')
"
```

### Customization

**Custom Hook Development:**
```bash
# Create a custom hook
cp apps/hooks/src/hooks/pre_tool_use.py apps/hooks/src/hooks/my_custom_hook.py
# Edit the hook logic
# Register it in ~/.claude/settings.json
```

**Dashboard Customization:**
```bash
# Customize dashboard appearance
cd apps/dashboard/src/styles
# Edit globals.css or create custom theme
```

### Troubleshooting Local Setup

#### Issue: Dashboard not starting

**Symptoms:** Port 3000 already in use, connection errors

**Solution:**
```bash
# Check what's using port 3000
sudo lsof -i :3000
# Kill the process or use a different port
PORT=3001 npm run dev
```

#### Issue: Hooks not capturing events

**Symptoms:** Empty dashboard, no events recorded

**Solution:**
```bash
# Check hook installation
cat ~/.claude/settings.json | jq '.hooks'

# Test hook manually
cd apps/hooks
echo '{"test": "data"}' | python src/hooks/pre_tool_use.py

# Check permissions
ls -la ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.py
```

#### Issue: Database errors

**Symptoms:** "Database locked", "no such table" errors

**Solution:**
```bash
# Reset database
rm ~/.chronicle/chronicle.db
cd apps/hooks
python -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()"

# Check database integrity
sqlite3 ~/.chronicle/chronicle.db ".schema"
```

#### Issue: Permission denied

**Symptoms:** Cannot write to directories, hook execution fails

**Solution:**
```bash
# Fix directory permissions
chmod 755 ~/.claude/
chmod 755 ~/.chronicle/
chmod +x ~/.claude/hooks/*.py

# Check ownership
ls -la ~/.claude/
ls -la ~/.chronicle/
```

### Performance Optimization for Local Development

**For Large Projects:**
```json
// ~/.chronicle/config.json
{
  "hooks": {
    "async_processing": true,
    "batch_size": 50,
    "max_input_size_mb": 5
  },
  "dashboard": {
    "pagination_size": 100,
    "auto_refresh_interval": 5000
  }
}
```

**For Memory-Constrained Systems:**
```json
// ~/.chronicle/config.json
{
  "database": {
    "cleanup_interval_hours": 6,
    "max_events_per_session": 500
  },
  "dashboard": {
    "max_events_display": 200
  }
}
```

## Next Steps

### Explore Chronicle Features

1. **Session Analysis**: Review your coding sessions in the dashboard
2. **Event Filtering**: Use filters to find specific tool usage patterns
3. **Data Export**: Export session data for analysis
4. **Custom Hooks**: Create hooks for specific use cases

### Advanced Local Development

- **[Advanced Configuration Tutorial](./advanced-configuration.md)** - Custom hooks, performance tuning
- **[Team Setup Guide](./team-deployment.md)** - Share Chronicle with your team
- **[Migration Tutorial](./migration-from-supabase.md)** - Switch to/from Supabase backend

### Learn More

- **[INSTALLATION.md](../INSTALLATION.md)** - Comprehensive installation guide
- **[API Documentation](../reference/api.md)** - REST API reference
- **[Hook Development Guide](../reference/hooks.md)** - Create custom hooks

## Support

### Getting Help

If you encounter issues:

1. **Check logs**: 
   ```bash
   tail -f ~/.claude/logs/hooks.log
   tail -f ~/.chronicle/dashboard.log
   ```

2. **Run diagnostics**:
   ```bash
   ./scripts/health-check.sh
   ```

3. **Validate configuration**:
   ```bash
   cd apps/hooks
   python scripts/validate_environment.py
   ```

### Common Questions

**Q: Can I use Chronicle with multiple projects?**
A: Yes! Chronicle automatically tracks different project directories as separate sessions.

**Q: How much disk space does Chronicle use?**
A: Typically 10-50MB per month of active development, depending on usage patterns.

**Q: Can I access Chronicle data programmatically?**
A: Yes! Use the Python database utilities or REST API endpoints.

**Q: Is my code data secure?**
A: Yes! By default, Chronicle sanitizes sensitive data and runs locally. See our [Security Guide](../guides/security.md).

---

**🎉 Congratulations! Chronicle is now monitoring your Claude Code activities.**

Visit **http://localhost:3000** to start exploring your development patterns and productivity insights.