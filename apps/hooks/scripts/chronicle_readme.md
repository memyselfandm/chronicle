# Chronicle Hooks for Claude Code

This directory contains the Chronicle observability hooks for Claude Code. Chronicle tracks and stores Claude's tool usage, prompts, and session data for analysis and debugging.

## Directory Structure

```
chronicle/
├── README.md           # This file
├── .env               # Environment variables (database configuration)
├── config.json        # Chronicle-specific configuration
├── hooks/             # UV single-file hook scripts
│   ├── session_start_uv.py      # Session initialization
│   ├── user_prompt_submit_uv.py # Prompt tracking
│   ├── pre_tool_use_uv.py       # Pre-tool execution
│   ├── post_tool_use_uv.py      # Post-tool execution
│   ├── notification_uv.py       # Notification tracking
│   ├── stop_uv.py              # Session stop
│   ├── subagent_stop_uv.py     # Subagent stop
│   └── pre_compact_uv.py       # Pre-compact operation
├── data/              # Local data storage
│   └── chronicle.db   # SQLite database (when not using Supabase)
└── logs/              # Chronicle logs
    └── chronicle.log  # Execution logs
```

## Configuration

### Environment Variables (.env)

The `.env` file contains database and logging configuration:

```bash
# Database Configuration
CHRONICLE_DB_TYPE=supabase          # Options: supabase, sqlite
SUPABASE_URL=your_supabase_url     # Your Supabase project URL
SUPABASE_KEY=your_supabase_key     # Your Supabase anon key
SQLITE_DB_PATH=data/chronicle.db    # SQLite database path (relative to chronicle/)

# Logging Configuration
CHRONICLE_LOG_LEVEL=info            # Options: debug, info, warning, error
CHRONICLE_LOG_FILE=logs/chronicle.log

# Performance Settings
CHRONICLE_TIMEOUT_MS=100            # Max execution time per hook
CHRONICLE_BATCH_SIZE=10             # Batch size for DB operations
```

### Hook Scripts

All hook scripts are UV single-file scripts that include their dependencies inline. They are executed using the UV package manager with the command format:

```bash
uv run /path/to/hook_script.py
```

## Uninstallation

To uninstall Chronicle hooks:

1. Remove this chronicle directory:
   ```bash
   rm -rf ~/.claude/hooks/chronicle
   ```

2. Remove hook entries from `~/.claude/settings.json` or restore from backup

3. If using Supabase, optionally drop the Chronicle tables from your database

## Troubleshooting

### UV Not Found
If you see "UV is not installed" errors, install UV:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Permission Errors
Ensure hook scripts have execute permissions:
```bash
chmod +x ~/.claude/hooks/chronicle/hooks/*.py
```

### Database Connection Issues
- Check your `.env` file has correct database credentials
- For Supabase, ensure your project URL and anon key are valid
- For SQLite, ensure the data directory is writable

## Support

For issues or questions, visit: https://github.com/cryingpotat0/chronicle