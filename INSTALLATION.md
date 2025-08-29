# Chronicle Installation Guide

## 🚀 Quick Start (Zero Configuration)

Chronicle can be installed with a single command - no external dependencies or configuration required!

```bash
# Clone the repository
git clone https://github.com/MeMyselfAndAI-Me/chronicle.git
cd chronicle

# One-command installation
python install.py

# That's it! Chronicle is now active and monitoring Claude Code
```

## 📁 Installation Details

### What Gets Installed

Chronicle installs to `~/.claude/hooks/chronicle/` with the following structure:

```
~/.claude/hooks/chronicle/
├── hooks/                      # Chronicle hook scripts
│   ├── session_start.py        # Session lifecycle hooks
│   ├── pre_tool_use.py         # Tool usage monitoring
│   ├── post_tool_use.py        
│   ├── user_prompt_submit.py   # User interaction tracking
│   ├── lib/                    # Shared libraries
│   │   ├── database.py         # Database operations
│   │   ├── base_hook.py        # Base hook class
│   │   └── utils.py            # Utility functions
│   └── scripts/                # Management scripts
├── server/                     # Backend API server
│   ├── data/
│   │   └── chronicle.db        # Local SQLite database
│   └── logs/
│       └── chronicle.log       # Server logs
└── dashboard/                  # Next.js dashboard application
    ├── src/
    ├── public/
    └── package.json
```

### Hook Registration

Chronicle hooks are automatically registered in `~/.claude/settings.json`:
- No wrapper scripts needed
- Direct paths to hook files
- Hooks can import from the `lib` directory

## 🛠 Installation Options

### Command Line Options

```bash
python install.py [options]

Options:
  --skip-deps       Skip dependency installation (useful for testing)
  --no-start        Don't start the server after installation
  --force           Force overwrite existing installation
  --help            Show help message
```

### Examples

```bash
# Install without starting the server
python install.py --no-start

# Reinstall over existing installation
python install.py --force

# Install without downloading dependencies (for testing)
python install.py --skip-deps --no-start
```

## 🔍 Verification

### Check Installation Success

1. **Verify hooks are registered**:
   ```bash
   grep "chronicle/hooks" ~/.claude/settings.json
   ```

2. **Test hook imports**:
   ```bash
   cd ~/.claude/hooks/chronicle/hooks
   python -c "from lib.database import DatabaseManager; print('✅ Hooks configured correctly')"
   ```

3. **Check database exists**:
   ```bash
   ls -la ~/.claude/hooks/chronicle/server/data/chronicle.db
   ```

4. **View hook logs** (after using Claude Code):
   ```bash
   tail -f ~/.claude/hooks/chronicle/server/logs/chronicle.log
   ```

## 🚦 Starting and Stopping

### Start Chronicle Dashboard

```bash
# Using the start script
~/.claude/hooks/chronicle/start.sh

# Or manually
cd ~/.claude/hooks/chronicle/dashboard
npm start
```

The dashboard will be available at http://localhost:3000

### Stop Chronicle

Simply close the terminal running the dashboard, or use Ctrl+C.

## 🔧 Troubleshooting

### Common Issues

#### Hooks Not Working

If hooks aren't capturing events:

1. Check settings.json has Chronicle hooks registered:
   ```bash
   cat ~/.claude/settings.json | grep chronicle
   ```

2. Ensure hooks have execute permissions:
   ```bash
   chmod +x ~/.claude/hooks/chronicle/hooks/*.py
   ```

3. Test a hook manually:
   ```bash
   cd ~/.claude/hooks/chronicle/hooks
   echo '{}' | CLAUDE_SESSION_ID=test python pre_tool_use.py
   ```

#### Module Import Errors

If you see `ModuleNotFoundError: No module named 'lib'`:

1. Check the lib directory exists:
   ```bash
   ls -la ~/.claude/hooks/chronicle/hooks/lib/
   ```

2. Ensure you're in the correct directory:
   ```bash
   cd ~/.claude/hooks/chronicle/hooks
   python -c "import lib"
   ```

#### Dashboard Won't Start

If the dashboard fails to start:

1. Install dependencies:
   ```bash
   cd ~/.claude/hooks/chronicle/dashboard
   npm install
   ```

2. Build the dashboard:
   ```bash
   npm run build
   ```

3. Start the dashboard:
   ```bash
   npm start
   ```

#### Server Auto-Start Issues

If you see "⚠️ Chronicle server script not found" in Claude Code:

1. Verify the server exists at the installed location:
   ```bash
   ls -la ~/.claude/hooks/chronicle/server/main.py
   ```

2. If missing, reinstall Chronicle:
   ```bash
   python install.py --force
   ```

3. Check server logs for errors:
   ```bash
   tail -f ~/.claude/hooks/chronicle/server/logs/chronicle.log
   ```

4. Manually test the server:
   ```bash
   cd ~/.claude/hooks/chronicle/server
   python main.py
   ```

The auto-start mechanism looks for the server at:
- **Installed:** `~/.claude/hooks/chronicle/server/main.py`
- **Development:** `apps/server/main.py`

## 🔄 Updating Chronicle

To update to the latest version:

```bash
# Pull latest changes
cd chronicle
git pull

# Reinstall with force flag
python install.py --force
```

## 🗑 Uninstalling

To completely remove Chronicle:

```bash
# Remove installation directory
rm -rf ~/.claude/hooks/chronicle

# Remove hooks from settings.json
# Edit ~/.claude/settings.json and remove Chronicle hook entries
```

## 🌐 Advanced: Supabase Backend

For distributed teams or cloud deployments, Chronicle supports Supabase as a backend:

1. Set up Supabase project and database
2. Configure environment variables
3. Install with Supabase mode:
   ```bash
   cd apps/hooks
   cp .env.template .env
   # Edit .env with Supabase credentials
   python scripts/install.py
   ```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

## 📚 Additional Resources

- [README.md](./README.md) - Project overview and features
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Detailed troubleshooting guide
- [apps/hooks/README.md](./apps/hooks/README.md) - Hooks system documentation
- [apps/dashboard/README.md](./apps/dashboard/README.md) - Dashboard documentation

## 💬 Support

If you encounter issues not covered here:

1. Check the [troubleshooting guide](./TROUBLESHOOTING.md)
2. Review [GitHub Issues](https://github.com/MeMyselfAndAI-Me/chronicle/issues)
3. Create a new issue with:
   - Installation method used
   - Error messages
   - System information (OS, Python version, Node.js version)