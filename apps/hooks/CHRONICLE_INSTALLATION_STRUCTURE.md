# Chronicle Subfolder Installation Structure

## Overview

This document defines the installation structure for Chronicle hooks using a dedicated `chronicle` subfolder under `.claude/hooks/` to provide clean organization and simple uninstallation.

## Installation Directory Structure

```
~/.claude/
└── hooks/
    └── chronicle/
        ├── hooks/                 # Hook executable files
        │   ├── notification.py
        │   ├── post_tool_use.py
        │   ├── pre_compact.py
        │   ├── pre_tool_use.py
        │   ├── session_start.py
        │   ├── stop.py
        │   ├── subagent_stop.py
        │   └── user_prompt_submit.py
        ├── uv_scripts/           # UV single-file scripts
        │   ├── notification.py
        │   ├── post_tool_use.py
        │   ├── pre_compact.py
        │   ├── pre_tool_use.py
        │   ├── session_start.py
        │   ├── stop.py
        │   ├── subagent_stop.py
        │   └── user_prompt_submit.py
        ├── config/               # Configuration files
        │   ├── settings.json     # Hook-specific settings
        │   └── environment.env   # Environment variables template
        ├── data/                 # Data storage (optional)
        │   └── hooks_data.db     # SQLite fallback database
        ├── logs/                 # Log files (optional)
        │   └── hooks.log         # Hook execution logs
        └── metadata/             # Installation metadata
            ├── version.txt       # Installed version
            ├── installation.json # Installation details
            └── files.list        # List of installed files
```

## Directory Purposes

### `/hooks/` - Hook Executable Files
- Contains the main Python hook files for traditional installations
- Files are executable and ready for Claude Code integration
- Used when UV is not available or preferred

### `/uv_scripts/` - UV Single-File Scripts  
- Contains UV single-file scripts for modern installations
- Self-contained with embedded dependencies
- Preferred installation method for better isolation

### `/config/` - Configuration Files
- `settings.json`: Hook-specific configuration overrides
- `environment.env`: Environment variable template for project setup

### `/data/` - Data Storage (Optional)
- `hooks_data.db`: SQLite fallback database when Supabase unavailable
- Only created when needed, not part of base installation

### `/logs/` - Log Files (Optional)  
- `hooks.log`: Hook execution logs
- Only created when logging is enabled, not part of base installation

### `/metadata/` - Installation Metadata
- `version.txt`: Tracks installed Chronicle version
- `installation.json`: Installation timestamp, options, and source
- `files.list`: Complete list of installed files for clean uninstallation

## Installation Path Mapping

### Source to Target Mapping

| Source File | Installation Target |
|-------------|-------------------|
| `apps/hooks/src/hooks/*.py` | `~/.claude/hooks/chronicle/hooks/*.py` |
| `apps/hooks/src/hooks/uv_scripts/*.py` | `~/.claude/hooks/chronicle/uv_scripts/*.py` | (utility scripts only)
| Generated settings | `~/.claude/hooks/chronicle/config/settings.json` |
| Environment template | `~/.claude/hooks/chronicle/config/environment.env` |

### Settings.json Path Updates

Claude Code settings.json will reference hooks using the new paths:

```json
{
  "hooks": {
    "pre_tool_use": "~/.claude/hooks/chronicle/hooks/pre_tool_use.py",
    "post_tool_use": "~/.claude/hooks/chronicle/hooks/post_tool_use.py",
    "user_prompt_submit": "~/.claude/hooks/chronicle/hooks/user_prompt_submit.py",
    "notification": "~/.claude/hooks/chronicle/hooks/notification.py",
    "session_start": "~/.claude/hooks/chronicle/hooks/session_start.py",
    "stop": "~/.claude/hooks/chronicle/hooks/stop.py",
    "subagent_stop": "~/.claude/hooks/chronicle/hooks/subagent_stop.py",
    "pre_compact": "~/.claude/hooks/chronicle/hooks/pre_compact.py"
  }
}
```

## Configuration File Organization

### Chronicle Settings (`~/.claude/hooks/chronicle/config/settings.json`)

Local configuration overrides specific to Chronicle installation:

```json
{
  "chronicle": {
    "version": "1.0.0",
    "installation_type": "uv_scripts",
    "database": {
      "fallback_path": "~/.claude/hooks/chronicle/data/hooks_data.db"
    },
    "logging": {
      "log_file": "~/.claude/hooks/chronicle/logs/hooks.log"
    }
  }
}
```

### Environment Template (`~/.claude/hooks/chronicle/config/environment.env`)

Template file for users to customize:

```bash
# Chronicle Hook Configuration
# Copy this file to your project root or shell configuration

# Project directory for hooks to operate in
# CLAUDE_PROJECT_DIR=/path/to/your/project

# Supabase configuration (optional)
# SUPABASE_URL=your_supabase_url
# SUPABASE_ANON_KEY=your_supabase_key

# Logging configuration
# CHRONICLE_LOG_LEVEL=INFO
# CHRONICLE_LOG_FILE=~/.claude/hooks/chronicle/logs/hooks.log
```

## Uninstallation Strategy

### Simple Folder Deletion
The Chronicle subfolder approach enables clean uninstallation:

```bash
# Complete uninstallation
rm -rf ~/.claude/hooks/chronicle/

# Restore Claude Code settings.json (remove hook references)
# This requires parsing and updating the settings file
```

### Metadata-Driven Uninstallation
The `metadata/files.list` enables selective cleanup:

```bash
# Read metadata/files.list and remove only Chronicle files
# Update settings.json to remove Chronicle hook entries
# Preserve other hooks and Claude Code configuration
```

### Installation Script Integration
The installation script will support uninstallation:

```bash
# Uninstall Chronicle hooks
python install.py --uninstall

# Validate uninstallation
python install.py --validate-clean
```

## Benefits of This Structure

1. **Clean Organization**: All Chronicle files in one location
2. **Simple Uninstallation**: Delete one folder to remove everything
3. **No File Scattering**: No mixed Chronicle/other hooks in base directories  
4. **Version Management**: Clear version tracking and upgrade paths
5. **Development Friendly**: Easy to identify Chronicle vs other tools
6. **Backup Friendly**: Single directory to backup/restore
7. **Multi-Installation**: Could support multiple Chronicle versions
8. **Clear Ownership**: Obvious which files belong to Chronicle

## Implementation Notes

- Installation script will create the directory structure automatically
- Missing optional directories (data/, logs/) created on demand
- File permissions set appropriately during installation  
- Metadata updated during each installation/upgrade
- Settings.json paths use the new Chronicle subfolder structure
- Environment variables remain the same for backward compatibility