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
        ├── lib/                  # Shared library modules
        │   ├── __init__.py
        │   ├── base_hook.py      # Base hook class and logging setup
        │   ├── database.py       # Database connectivity and operations
        │   └── utils.py          # Utility functions and helpers
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
- Contains UV single-file scripts with embedded dependencies via shebang
- Each script imports from shared lib/ modules for code reuse
- Files are executable and ready for Claude Code integration
- Self-contained execution environment with shared library support

### `/lib/` - Shared Library Modules
- `base_hook.py`: Base hook class with logging, error handling, and common functionality
- `database.py`: Database connectivity, fallback mechanisms, and data operations
- `utils.py`: Utility functions for session management, error formatting, and validation
- `__init__.py`: Module initialization for proper Python package structure

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
| `apps/hooks/src/lib/*.py` | `~/.claude/hooks/chronicle/lib/*.py` |
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

## Shared Library Architecture

### How UV Scripts Import from lib/

Chronicle hooks use a clean modular architecture where UV single-file scripts import functionality from shared library modules in the `lib/` directory. This approach provides:

1. **Code Reuse**: Common functionality shared across all hooks
2. **Maintainability**: Centralized logic in dedicated modules  
3. **Self-Contained Execution**: UV scripts remain portable with embedded dependencies
4. **Clean Separation**: Business logic separate from hook-specific implementations

### Import Strategy

Each UV script uses a fallback import strategy to work both in development and installed environments:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///

# Import from shared library modules
try:
    from lib.database import DatabaseManager
    from lib.base_hook import BaseHook, setup_hook_logging
    from lib.utils import extract_session_id, format_error_message
except ImportError:
    # For UV script compatibility, try relative imports
    sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
    from database import DatabaseManager
    from base_hook import BaseHook, setup_hook_logging
    from utils import extract_session_id, format_error_message
```

### Library Module Responsibilities

#### `lib/base_hook.py`
- **BaseHook Class**: Abstract base class for all hook implementations
- **Logging Setup**: Configurable logging with environment variable support
- **Error Handling**: Standardized error handling and reporting
- **Performance Monitoring**: Execution timing and resource monitoring
- **Configuration Management**: Environment variable processing

#### `lib/database.py`
- **DatabaseManager Class**: Unified database interface for Supabase and SQLite
- **Connection Management**: Automatic failover and retry logic
- **Schema Validation**: Database schema setup and validation
- **Data Operations**: CRUD operations with proper error handling
- **Migration Support**: Schema version management

#### `lib/utils.py`
- **Session Management**: Session ID extraction and validation
- **Data Formatting**: JSON serialization and data sanitization
- **Environment Validation**: Project directory and configuration validation
- **Cross-Platform Support**: Path handling and platform compatibility
- **Security Utilities**: Data sanitization and input validation

### Benefits of This Architecture

1. **Maintainable**: Changes to core logic only require updating lib/ modules
2. **Testable**: Shared libraries can be unit tested independently
3. **Consistent**: All hooks use the same underlying implementations
4. **Portable**: UV scripts remain self-contained for distribution
5. **Flexible**: Easy to extend functionality across all hooks
6. **Clean**: Clear separation between hook-specific and shared code

## Implementation Notes

- Installation script will create the directory structure automatically
- Missing optional directories (data/, logs/) created on demand
- File permissions set appropriately during installation  
- Metadata updated during each installation/upgrade
- Settings.json paths use the new Chronicle subfolder structure
- Environment variables remain the same for backward compatibility
- lib/ modules are copied alongside hook scripts during installation

## Migration from Legacy Structure

This section provides guidance for migrating from older Chronicle installations to the new lib/ module architecture and chronicle subfolder structure.

### Legacy Structure Overview

Previous Chronicle installations used a scattered file structure:

```
~/.claude/
└── hooks/
    ├── notification.py          # Individual hook files
    ├── post_tool_use.py         # Mixed with other tools
    ├── pre_tool_use.py          # No shared modules
    ├── session_start.py         # Duplicated code
    └── stop.py                  # Hard to maintain
```

### Migration Benefits

The new structure provides significant improvements:

1. **Organized Files**: All Chronicle files in dedicated subfolder
2. **Shared Libraries**: Common code in reusable lib/ modules
3. **Clean Separation**: Chronicle vs other hook tools clearly separated
4. **Easy Uninstall**: Single folder deletion removes everything
5. **Better Imports**: Proper Python module structure
6. **Maintainable Code**: Centralized logic in lib/ modules

### Migration Process

#### Step 1: Assess Current Installation

Check what hooks are currently installed:

```bash
# List existing hooks in Claude Code directory
ls -la ~/.claude/hooks/

# Check Claude Code settings for hook references
cat ~/.claude/settings.json | grep -A 20 "hooks"
```

#### Step 2: Backup Current Configuration

Preserve your existing setup before migration:

```bash
# Backup Claude Code settings
cp ~/.claude/settings.json ~/.claude/settings.json.pre-migration

# Backup existing hooks directory
cp -r ~/.claude/hooks ~/.claude/hooks.pre-migration

# Document current hook configuration
cat ~/.claude/settings.json | jq '.hooks' > ~/chronicle-hooks-backup.json
```

#### Step 3: Install New Structure

Run the installation script to create the new structure:

```bash
cd /path/to/chronicle-project
python -m apps.hooks.scripts.install --migrate
```

This will:
- Create the `~/.claude/hooks/chronicle/` directory structure
- Install UV scripts with lib/ module support
- Copy shared library modules to `lib/` directory
- Update Claude Code settings.json with new paths
- Preserve existing non-Chronicle hooks

#### Step 4: Verify Migration

Confirm the new structure is working:

```bash
# Check new directory structure
tree ~/.claude/hooks/chronicle/

# Verify lib modules are present
ls -la ~/.claude/hooks/chronicle/lib/

# Test a hook import
python -c "
import sys
sys.path.insert(0, '~/.claude/hooks/chronicle/lib')
from database import DatabaseManager
print('Import successful')
"

# Verify Claude Code settings updated
cat ~/.claude/settings.json | grep "chronicle"
```

#### Step 5: Test Functionality

Ensure hooks work correctly with the new structure:

```bash
# Test from project root
cd /path/to/your/project
claude-code --version

# Test from subdirectory (should work with environment variables)
cd /path/to/your/project/src
claude-code --help

# Check hook execution logs
tail ~/.claude/hooks/chronicle/logs/hooks.log
```

#### Step 6: Clean Up Legacy Files

After confirming everything works, remove old files:

```bash
# Remove old scattered hook files (be careful not to remove non-Chronicle hooks)
# Only remove if you're certain they're Chronicle hooks
rm -f ~/.claude/hooks/session_start.py
rm -f ~/.claude/hooks/stop.py
rm -f ~/.claude/hooks/pre_tool_use.py
rm -f ~/.claude/hooks/post_tool_use.py
rm -f ~/.claude/hooks/notification.py
rm -f ~/.claude/hooks/user_prompt_submit.py
rm -f ~/.claude/hooks/pre_compact.py
rm -f ~/.claude/hooks/subagent_stop.py

# Remove backup files after confirming everything works
rm -rf ~/.claude/hooks.pre-migration
rm -f ~/.claude/settings.json.pre-migration
rm -f ~/chronicle-hooks-backup.json
```

### Rollback Procedure

If migration fails, you can rollback to the previous state:

```bash
# Stop any running Claude Code processes
pkill claude-code

# Remove new structure
rm -rf ~/.claude/hooks/chronicle/

# Restore previous hooks directory
mv ~/.claude/hooks.pre-migration ~/.claude/hooks

# Restore previous settings
mv ~/.claude/settings.json.pre-migration ~/.claude/settings.json

# Verify rollback
ls -la ~/.claude/hooks/
cat ~/.claude/settings.json | grep -A 20 "hooks"
```

### Migration Validation

Use these commands to validate your migration:

#### Structure Validation
```bash
# Verify directory structure exists
test -d ~/.claude/hooks/chronicle && echo "✓ Chronicle directory exists"
test -d ~/.claude/hooks/chronicle/lib && echo "✓ Lib directory exists"
test -d ~/.claude/hooks/chronicle/hooks && echo "✓ Hooks directory exists"

# Check all required lib modules
for module in base_hook database utils __init__; do
    test -f ~/.claude/hooks/chronicle/lib/${module}.py && echo "✓ ${module}.py exists"
done
```

#### Functionality Validation
```bash
# Test import structure
python -c "
import sys
sys.path.insert(0, '~/.claude/hooks/chronicle/lib')
try:
    from base_hook import BaseHook
    from database import DatabaseManager
    from utils import extract_session_id
    print('✓ All lib imports successful')
except ImportError as e:
    print('✗ Import failed:', e)
"
```

#### Settings Validation
```bash
# Check that settings.json references new paths
grep "chronicle" ~/.claude/settings.json && echo "✓ Settings updated for chronicle structure"
```

### Post-Migration Considerations

After successful migration:

1. **Update Documentation**: Update any team documentation to reference new paths
2. **Update Scripts**: Modify any custom scripts that referenced old hook paths  
3. **Environment Variables**: Ensure `CLAUDE_PROJECT_DIR` is set for all team members
4. **CI/CD Updates**: Update any automation that references hook paths
5. **Backup Strategy**: Update backup procedures to include the chronicle/ directory