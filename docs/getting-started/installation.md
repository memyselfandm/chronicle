# Chronicle Installation Guide

> **Get Chronicle running in 5 minutes with one command**

Chronicle is a self-contained observability system for Claude Code that requires zero external dependencies. It provides real-time monitoring of your AI coding sessions through a clean web dashboard.

## What You Get

Chronicle installs as a complete system:
- **Local SQLite Database** - No cloud dependencies, all data stays on your machine
- **Web Dashboard** - Real-time view of Claude Code activity at http://localhost:3000  
- **Python Hooks** - Automatically captures events as you use Claude Code
- **Zero Configuration** - Works out of the box with sensible defaults

## Prerequisites

Chronicle requires these tools on your system:

### Required
- **Python 3.8+** - For the event capture system
- **Node.js 18+** - For the web dashboard
- **Claude Code** - Latest version from Anthropic

### Platform Support
- ✅ **macOS** (Intel and Apple Silicon)
- ✅ **Linux** (Ubuntu 20.04+, Debian, RHEL, etc.)
- ✅ **Windows** (with WSL2 recommended)

## One-Command Installation

### Step 1: Get Chronicle

```bash
# Download Chronicle
git clone <repository-url>
cd chronicle
```

### Step 2: Install Everything

```bash
# One command to install everything
python install.py
```

That's it! The installer will:

1. **Check Dependencies** - Verify Python and Node.js versions
2. **Install UV** (optional) - For 10x faster Python package installs
3. **Setup Directory Structure** - Create `~/.claude/hooks/chronicle/`
4. **Install Python Dependencies** - All required packages
5. **Install Node.js Dependencies** - Dashboard requirements
6. **Initialize SQLite Database** - Ready-to-use local database
7. **Register Claude Hooks** - Automatically configure Claude Code integration
8. **Build Dashboard** - Production-optimized web interface
9. **Start Services** - Launch dashboard at http://localhost:3000

## Installation Options

### Quick Install (Recommended)
```bash
python install.py
```

### Advanced Options
```bash
# Skip dependency installation (if already installed)
python install.py --skip-deps

# Don't start services automatically
python install.py --no-start

# Force overwrite existing installation
python install.py --force

# See all options
python install.py --help
```

## What Gets Installed

Chronicle creates this structure in your system:

```
~/.claude/hooks/chronicle/
├── dashboard/          # Next.js web interface
│   ├── .next/         # Built application
│   └── .env.local     # Local configuration
├── hooks/             # Python event capture
│   ├── *.py           # Hook scripts
│   ├── lib/           # Shared libraries
│   └── .env           # Hook configuration
└── server/            # Local data storage
    ├── data/          # SQLite database
    │   └── chronicle.db
    ├── logs/          # Application logs
    └── config.json    # Server configuration
```

## Verification

### Check Installation
After installation completes, verify everything is working:

1. **Dashboard Access** - Visit http://localhost:3000
   - Should show "Chronicle Observability" interface
   - Connection indicator should be green

2. **Claude Integration** - Open Claude Code in any project
   - Use Claude Code normally (read files, run commands)
   - Check dashboard for live events appearing

3. **Database** - Verify SQLite database exists
   ```bash
   ls -la ~/.claude/hooks/chronicle/server/data/chronicle.db
   ```

### Test Hook System
```bash
# Test a hook manually
cd ~/.claude/hooks/chronicle/hooks
echo '{"session_id":"test","tool_name":"Read"}' | python pre_tool_use.py

# Check logs for activity
tail -f ~/.claude/hooks/chronicle/server/logs/chronicle.log
```

## Starting and Stopping Chronicle

### Start Chronicle
```bash
# Use the convenient startup script
~/.claude/hooks/chronicle/start.sh

# Or start manually
cd ~/.claude/hooks/chronicle/dashboard
npm start
```

### Stop Chronicle
```bash
# Stop with Ctrl+C in the terminal where it's running

# Or find and kill the process
pkill -f "npm start"
```

## System Requirements

### Minimum Requirements
- **RAM**: 512MB available
- **Storage**: 100MB for installation + data growth
- **CPU**: Any modern processor (ARM64 and x86_64 supported)

### Recommended
- **RAM**: 1GB+ available (for smooth dashboard performance)
- **Storage**: 1GB+ (allows for extensive session history)
- **Network**: None required (everything runs locally)

## Troubleshooting Installation

### Python Issues
```bash
# Check Python version
python3 --version

# If Python is too old or missing
# macOS with Homebrew:
brew install python@3.11

# Ubuntu/Debian:
sudo apt update && sudo apt install python3 python3-pip

# Windows: Download from https://python.org/
```

### Node.js Issues  
```bash
# Check Node.js version
node --version

# If Node.js is too old or missing
# macOS with Homebrew:
brew install node

# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows: Download from https://nodejs.org/
```

### Installation Fails
```bash
# Clean up and retry
rm -rf ~/.claude/hooks/chronicle
python install.py --force

# Check detailed logs
python install.py 2>&1 | tee install.log
```

### Permission Issues
```bash
# Fix Claude directory permissions
chmod -R 755 ~/.claude/

# Fix hooks permissions specifically
chmod +x ~/.claude/hooks/chronicle/hooks/*.py
```

### Dashboard Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Try building again
cd ~/.claude/hooks/chronicle/dashboard
npm run build
npm start
```

## Manual Installation (Advanced)

If the automated installer doesn't work for your setup, you can install manually:

### 1. Install Dependencies
```bash
# Python dependencies
pip install -r apps/hooks/requirements.txt

# Node.js dependencies  
cd apps/dashboard
npm install
```

### 2. Copy Files
```bash
# Create structure
mkdir -p ~/.claude/hooks/chronicle/{dashboard,hooks,server/data,server/logs}

# Copy dashboard
cp -r apps/dashboard/* ~/.claude/hooks/chronicle/dashboard/

# Copy hooks
cp apps/hooks/src/hooks/* ~/.claude/hooks/chronicle/hooks/
cp -r apps/hooks/src/lib ~/.claude/hooks/chronicle/hooks/
```

### 3. Configure Environment
```bash
# Create hook environment
cat > ~/.claude/hooks/chronicle/hooks/.env << EOF
CLAUDE_HOOKS_DB_TYPE=sqlite
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/server/data/chronicle.db
LOG_LEVEL=info
CHRONICLE_LOG_FILE=~/.claude/hooks/chronicle/server/logs/chronicle.log
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
EOF

# Create dashboard environment
cat > ~/.claude/hooks/chronicle/dashboard/.env.local << EOF
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_DATABASE_TYPE=sqlite
NEXT_PUBLIC_DEBUG=false
DATABASE_URL=file:../server/data/chronicle.db
EOF
```

### 4. Initialize Database
```bash
cd ~/.claude/hooks/chronicle/hooks
python -c "
import sqlite3
import os
from pathlib import Path

db_path = Path.home() / '.claude/hooks/chronicle/server/data/chronicle.db'
db_path.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(db_path)
conn.execute('CREATE TABLE IF NOT EXISTS chronicle_sessions (id TEXT PRIMARY KEY, created_at TIMESTAMP)')
conn.execute('CREATE TABLE IF NOT EXISTS chronicle_events (id TEXT PRIMARY KEY, session_id TEXT, event_type TEXT, timestamp TIMESTAMP)')
conn.commit()
conn.close()
print('Database initialized')
"
```

### 5. Register Hooks
Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "~/.claude/hooks/chronicle/hooks/session_start.py"}]}],
    "PreToolUse": [{"hooks": [{"type": "command", "command": "~/.claude/hooks/chronicle/hooks/pre_tool_use.py"}]}],
    "PostToolUse": [{"hooks": [{"type": "command", "command": "~/.claude/hooks/chronicle/hooks/post_tool_use.py"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "~/.claude/hooks/chronicle/hooks/stop.py"}]}]
  }
}
```

## Next Steps

Once installation is complete:

1. **[Quick Start Guide](./quick-start.md)** - Configure and start using Chronicle
2. **[First Session Guide](./first-session.md)** - Learn the dashboard interface  
3. **[Configuration Reference](../reference/configuration.md)** - Customize Chronicle settings
4. **[Troubleshooting Guide](../guides/troubleshooting.md)** - Solve common issues

## Uninstallation

To completely remove Chronicle:

```bash
# Stop any running services
pkill -f "npm start"

# Remove installation
rm -rf ~/.claude/hooks/chronicle/

# Remove hooks from Claude settings.json (manual edit)
# Remove the "hooks" section related to Chronicle
```

Chronicle is now ready to monitor your Claude Code sessions! The dashboard will automatically capture and display all your AI coding activity in real-time.