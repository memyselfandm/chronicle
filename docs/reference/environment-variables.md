# Environment Variables Guide

This guide explains how to use environment variables with Chronicle hooks for improved portability and directory-independent operation.

## Overview

Chronicle hooks now support environment variables to make installations more portable and to allow hooks to work correctly regardless of the current working directory. The main benefit is that you can run Claude Code from any directory within your project and the hooks will still function properly.

## Key Environment Variables

### `CLAUDE_PROJECT_DIR`

**Purpose**: Specifies the root directory of your project where Chronicle hooks should operate.

**Benefits**:
- Hooks work from any subdirectory
- Portable across different machines and environments
- Consistent behavior regardless of where Claude Code is invoked
- Easier collaboration with team members

**Example Usage**:

```bash
# Unix-like systems (macOS, Linux)
export CLAUDE_PROJECT_DIR=/path/to/your/project
claude-code

# Windows Command Prompt
set CLAUDE_PROJECT_DIR=C:\path\to\your\project
claude-code

# Windows PowerShell
$env:CLAUDE_PROJECT_DIR = "C:\path\to\your\project"
claude-code
```

### `CLAUDE_SESSION_ID`

**Purpose**: Identifies the Claude Code session for tracking and correlation.

**Usage**: This is typically set automatically by Claude Code, but can be manually specified for testing or debugging.

### `CLAUDE_HOOKS_LOG_LEVEL`

**Purpose**: Controls the logging verbosity level for Chronicle hooks.

**Values**: DEBUG, INFO, WARNING, ERROR, CRITICAL

**Default**: INFO

**Example Usage**:
```bash
# Set detailed logging for troubleshooting
export CLAUDE_HOOKS_LOG_LEVEL=DEBUG

# Set minimal logging for production
export CLAUDE_HOOKS_LOG_LEVEL=ERROR
```

### `CLAUDE_HOOKS_SILENT_MODE`

**Purpose**: Suppresses all non-error output from hooks when enabled.

**Values**: true, false

**Default**: false

**Example Usage**:
```bash
# Enable silent mode for clean output
export CLAUDE_HOOKS_SILENT_MODE=true

# Disable silent mode for verbose output
export CLAUDE_HOOKS_SILENT_MODE=false
```

### `CLAUDE_HOOKS_LOG_TO_FILE`

**Purpose**: Controls whether hooks log to files or only to console.

**Values**: true, false

**Default**: true

**Example Usage**:
```bash
# Disable file logging (console only)
export CLAUDE_HOOKS_LOG_TO_FILE=false

# Enable file logging (default)
export CLAUDE_HOOKS_LOG_TO_FILE=true
```

## Installation with Environment Variables

### Automatic Setup

When you run the Chronicle hooks installer, it now generates settings that use `$CLAUDE_PROJECT_DIR` for improved portability:

```bash
cd /path/to/your/project
python -m apps.hooks.scripts.install
```

The generated `.claude/settings.json` will contain paths like:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Manual Setup

To manually set up environment variables:

#### macOS and Linux

Add to your shell profile (`.bashrc`, `.zshrc`, `.profile`, etc.):

```bash
# Set Chronicle project directory
export CLAUDE_PROJECT_DIR="$HOME/projects/my-project"

# Optional: Add to PATH for easier access
export PATH="$CLAUDE_PROJECT_DIR/scripts:$PATH"
```

#### Windows

**Command Prompt:**
```cmd
:: Set for current session
set CLAUDE_PROJECT_DIR=C:\Users\YourName\projects\my-project

:: Set permanently (requires restart)
setx CLAUDE_PROJECT_DIR "C:\Users\YourName\projects\my-project"
```

**PowerShell:**
```powershell
# Set for current session
$env:CLAUDE_PROJECT_DIR = "C:\Users\YourName\projects\my-project"

# Set permanently in user profile
[Environment]::SetEnvironmentVariable("CLAUDE_PROJECT_DIR", "C:\Users\YourName\projects\my-project", "User")
```

## Directory-Independent Operation

### Before Environment Variables

Previously, hooks only worked when Claude Code was run from the project root:

```bash
cd /path/to/project
claude-code  # ✅ Works
cd /path/to/project/src
claude-code  # ❌ Hooks might fail
```

### After Environment Variables

With `CLAUDE_PROJECT_DIR` set, hooks work from anywhere in your project:

```bash
export CLAUDE_PROJECT_DIR=/path/to/project

cd /path/to/project
claude-code  # ✅ Works

cd /path/to/project/src
claude-code  # ✅ Also works

cd /path/to/project/tests
claude-code  # ✅ Also works
```

## Best Practices

### 1. Set Environment Variables in Your Shell Profile

Add environment variable exports to your shell profile for persistence:

**Bash/Zsh:**
```bash
# ~/.bashrc or ~/.zshrc
export CLAUDE_PROJECT_DIR="$HOME/projects/chronicle"
```

**Fish:**
```fish
# ~/.config/fish/config.fish
set -gx CLAUDE_PROJECT_DIR "$HOME/projects/chronicle"
```

### 2. Use Project-Relative Paths

When possible, use paths relative to the project root rather than absolute paths:

**Good:**
```bash
export CLAUDE_PROJECT_DIR="$HOME/projects/chronicle"
# Hooks will resolve: $CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py
```

**Also Good (absolute path):**
```bash
export CLAUDE_PROJECT_DIR="/Users/alice/work/chronicle-project"
```

### 3. Verify Your Setup

Use the environment validation script to check your configuration:

```bash
cd /path/to/project
python -m apps.hooks.scripts.test_environment_fallback --test-all
```

### 4. Team Collaboration

For team projects, document the expected environment variables in your project README:

```markdown
## Environment Setup

Before using Chronicle hooks, set the project directory:

```bash
# Replace with your actual project path
export CLAUDE_PROJECT_DIR=/path/to/your/chronicle-project
```

Add this to your shell profile for persistence.
```

### 5. Cross-Platform Compatibility

Use forward slashes even on Windows for better compatibility:

```bash
# Preferred (works everywhere)
export CLAUDE_PROJECT_DIR=/c/projects/chronicle

# Windows-specific (also works)
export CLAUDE_PROJECT_DIR=C:\projects\chronicle
```

## Troubleshooting

### Environment Variable Not Set

**Symptom**: Hooks work from project root but fail from subdirectories.

**Solution**: Set `CLAUDE_PROJECT_DIR` environment variable:

```bash
export CLAUDE_PROJECT_DIR=/path/to/your/project
```

### Invalid Project Directory

**Symptom**: Error messages about non-existent directories.

**Solution**: Verify the path exists and is correct:

```bash
# Check if directory exists
ls -la "$CLAUDE_PROJECT_DIR"

# Verify it contains a .claude directory
ls -la "$CLAUDE_PROJECT_DIR/.claude"
```

### Permission Issues

**Symptom**: Permission denied errors when accessing hooks.

**Solution**: Ensure hooks are executable and directories are accessible:

```bash
# Make hooks executable
chmod +x "$CLAUDE_PROJECT_DIR/.claude/hooks/"*.py

# Check directory permissions
ls -la "$CLAUDE_PROJECT_DIR/.claude/"
```

### Path Length Issues (Windows)

**Symptom**: Path too long errors on Windows.

**Solution**: Use shorter paths or enable long path support:

```bash
# Use shorter path
export CLAUDE_PROJECT_DIR=C:\proj\chronicle

# Or enable Windows long path support (requires admin privileges)
```

## Testing Your Setup

### Quick Test

```bash
# Set environment variable
export CLAUDE_PROJECT_DIR=/path/to/your/project

# Test from project root
cd "$CLAUDE_PROJECT_DIR"
python -c "from apps.hooks.src.core.utils import validate_environment_setup; import json; print(json.dumps(validate_environment_setup(), indent=2))"

# Test from subdirectory
cd "$CLAUDE_PROJECT_DIR/src"
python -c "from apps.hooks.src.core.utils import validate_environment_setup; import json; print(json.dumps(validate_environment_setup(), indent=2))"
```

### Comprehensive Test

```bash
# Run comprehensive environment fallback tests
python -m apps.hooks.scripts.test_environment_fallback --test-all --verbose
```

### Directory Independence Test

```bash
# Run directory independence tests
cd /path/to/project
python -m pytest apps/hooks/tests/test_directory_independence.py -v
```

## Migration from Absolute Paths

### Backward Compatibility

Existing installations with absolute paths in `settings.json` continue to work. No immediate action is required.

### Migrating to Environment Variables

To migrate to the new environment variable approach:

1. **Backup existing settings**:
   ```bash
   cp .claude/settings.json .claude/settings.json.backup
   ```

2. **Set environment variable**:
   ```bash
   export CLAUDE_PROJECT_DIR=/path/to/your/project
   ```

3. **Reinstall hooks** to generate new settings:
   ```bash
   python -m apps.hooks.scripts.install
   ```

4. **Verify the new setup**:
   ```bash
   python -m apps.hooks.scripts.test_environment_fallback --test-all
   ```

## Integration Examples

### Docker

```dockerfile
# Dockerfile
ENV CLAUDE_PROJECT_DIR=/app
WORKDIR /app
COPY . .
```

### CI/CD

```yaml
# GitHub Actions
- name: Set up Chronicle environment
  run: echo "CLAUDE_PROJECT_DIR=$GITHUB_WORKSPACE" >> $GITHUB_ENV

# GitLab CI
variables:
  CLAUDE_PROJECT_DIR: $CI_PROJECT_DIR
```

### Development Containers

```json
{
  "containerEnv": {
    "CLAUDE_PROJECT_DIR": "/workspace"
  }
}
```

## Advanced Usage

### Multiple Projects

For working with multiple projects, consider using shell functions or aliases:

```bash
# ~/.bashrc
chronicle_dev() {
    export CLAUDE_PROJECT_DIR="$HOME/projects/chronicle-dev"
    cd "$CLAUDE_PROJECT_DIR"
}

chronicle_prod() {
    export CLAUDE_PROJECT_DIR="$HOME/projects/chronicle-prod"
    cd "$CLAUDE_PROJECT_DIR"
}
```

### Dynamic Path Resolution

You can also use dynamic path resolution in scripts:

```bash
#!/bin/bash
# Find project root dynamically
if [ -z "$CLAUDE_PROJECT_DIR" ]; then
    # Look for .claude directory in current or parent directories
    current_dir="$(pwd)"
    while [ "$current_dir" != "/" ]; do
        if [ -d "$current_dir/.claude" ]; then
            export CLAUDE_PROJECT_DIR="$current_dir"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done
fi

echo "Using project directory: $CLAUDE_PROJECT_DIR"
```

This approach provides maximum flexibility while maintaining the benefits of environment variable configuration.

## Complete Environment Variables Reference

Chronicle hooks support a comprehensive set of environment variables for configuration. They are organized by category for easy reference.

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_PROJECT_DIR` | Current directory | Root directory of your project |
| `CLAUDE_SESSION_ID` | Auto-generated | Claude Code session identifier |
| `CLAUDE_HOOKS_ENABLED` | true | Enable/disable the entire hooks system |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | None | Supabase project URL (primary database) |
| `SUPABASE_ANON_KEY` | None | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | None | Supabase service role key (admin operations) |
| `CLAUDE_HOOKS_DB_PATH` | ~/.claude/hooks_data.db | SQLite fallback database path |
| `CLAUDE_HOOKS_DB_TIMEOUT` | 30 | Database connection timeout (seconds) |
| `CLAUDE_HOOKS_DB_RETRY_ATTEMPTS` | 3 | Number of retry attempts for failed connections |
| `CLAUDE_HOOKS_DB_RETRY_DELAY` | 1.0 | Delay between retry attempts (seconds) |
| `CLAUDE_HOOKS_SQLITE_FALLBACK` | true | Enable SQLite fallback when Supabase unavailable |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_LOG_LEVEL` | INFO | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| `CLAUDE_HOOKS_SILENT_MODE` | false | Suppress all non-error output |
| `CLAUDE_HOOKS_LOG_TO_FILE` | true | Enable/disable file logging |
| `CLAUDE_HOOKS_LOG_FILE` | ~/.claude/hooks.log | Log file path |
| `CLAUDE_HOOKS_MAX_LOG_SIZE_MB` | 10 | Maximum log file size before rotation |
| `CLAUDE_HOOKS_LOG_ROTATION_COUNT` | 3 | Number of rotated log files to keep |
| `CLAUDE_HOOKS_LOG_ERRORS_ONLY` | false | Log only errors (ignore info/debug) |
| `CLAUDE_HOOKS_VERBOSE` | false | Enable verbose output for debugging |

### Performance Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS` | 100 | Hook execution timeout (milliseconds) |
| `CLAUDE_HOOKS_MAX_MEMORY_MB` | 50 | Maximum memory usage per hook |
| `CLAUDE_HOOKS_MAX_BATCH_SIZE` | 100 | Maximum batch size for database operations |
| `CLAUDE_HOOKS_ASYNC_OPERATIONS` | true | Enable asynchronous operations |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_SANITIZE_DATA` | true | Enable data sanitization |
| `CLAUDE_HOOKS_REMOVE_API_KEYS` | true | Remove API keys from logged data |
| `CLAUDE_HOOKS_REMOVE_FILE_PATHS` | false | Remove file paths from logged data |
| `CLAUDE_HOOKS_PII_FILTERING` | true | Enable PII detection and filtering |
| `CLAUDE_HOOKS_MAX_INPUT_SIZE_MB` | 10 | Maximum input size for processing |
| `CLAUDE_HOOKS_ALLOWED_EXTENSIONS` | .py,.js,.ts,.json,.md,.txt,.yml,.yaml | Allowed file extensions (comma-separated) |

### Session Management

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_SESSION_TIMEOUT_HOURS` | 24 | Session timeout duration |
| `CLAUDE_HOOKS_AUTO_CLEANUP` | true | Enable automatic cleanup of old sessions |
| `CLAUDE_HOOKS_MAX_EVENTS_PER_SESSION` | 10000 | Maximum events per session |
| `CLAUDE_HOOKS_DATA_RETENTION_DAYS` | 90 | Data retention period in days |

### Development and Testing

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_DEV_MODE` | false | Enable development mode features |
| `CLAUDE_HOOKS_DEBUG` | false | Enable debug mode |
| `CLAUDE_HOOKS_TEST_DB_PATH` | ./test_hooks.db | Test database path |
| `CLAUDE_HOOKS_MOCK_DB` | false | Use mock database for testing |

### Monitoring and Alerting

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_PERFORMANCE_MONITORING` | true | Enable performance monitoring |
| `CLAUDE_HOOKS_ERROR_THRESHOLD` | 10 | Error alert threshold (errors per hour) |
| `CLAUDE_HOOKS_MEMORY_THRESHOLD` | 80 | Memory usage alert threshold (percentage) |
| `CLAUDE_HOOKS_DISK_THRESHOLD` | 90 | Disk usage alert threshold (percentage) |
| `CLAUDE_HOOKS_WEBHOOK_URL` | None | Webhook URL for notifications |
| `CLAUDE_HOOKS_SLACK_WEBHOOK` | None | Slack webhook URL for alerts |

### Advanced Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_CONFIG_PATH` | None | Custom configuration file path |
| `CLAUDE_HOOKS_DIRECTORY` | None | Override hooks directory |
| `CLAUDE_HOOKS_SCHEMA_PATH` | None | Custom database schema file |
| `CLAUDE_HOOKS_AUTO_MIGRATE` | true | Enable automatic schema migration |
| `CLAUDE_HOOKS_TIMEZONE` | UTC | Timezone for timestamps |

## Common Configuration Patterns

### Development Environment
```bash
# Local development with detailed logging
export CLAUDE_PROJECT_DIR="$HOME/projects/my-project"
export CLAUDE_HOOKS_LOG_LEVEL=DEBUG
export CLAUDE_HOOKS_DEV_MODE=true
export CLAUDE_HOOKS_DB_PATH="./local_hooks.db"
export CLAUDE_HOOKS_LOG_TO_FILE=true
export CLAUDE_HOOKS_VERBOSE=true
```

### Production Environment
```bash
# Production with Supabase and minimal logging
export CLAUDE_PROJECT_DIR="/app"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-production-key"
export CLAUDE_HOOKS_LOG_LEVEL=WARNING
export CLAUDE_HOOKS_SANITIZE_DATA=true
export CLAUDE_HOOKS_PII_FILTERING=true
export CLAUDE_HOOKS_SILENT_MODE=true
```

### Testing Environment
```bash
# Testing with mock database and debug output
export CLAUDE_PROJECT_DIR="$PWD"
export CLAUDE_HOOKS_MOCK_DB=true
export CLAUDE_HOOKS_TEST_DB_PATH="./test.db"
export CLAUDE_HOOKS_LOG_LEVEL=DEBUG
export CLAUDE_HOOKS_VERBOSE=true
export CLAUDE_HOOKS_DEV_MODE=true
```

### CI/CD Environment
```bash
# Continuous integration with minimal output
export CLAUDE_PROJECT_DIR="$CI_PROJECT_DIR"
export CLAUDE_HOOKS_SILENT_MODE=true
export CLAUDE_HOOKS_LOG_LEVEL=ERROR
export CLAUDE_HOOKS_LOG_TO_FILE=false
export CLAUDE_HOOKS_SQLITE_FALLBACK=true
export CLAUDE_HOOKS_DB_PATH="./ci_hooks.db"
```

## Migration from Old Structure

If you're upgrading from an older Chronicle installation, follow these steps to migrate to the new environment variable configuration and lib/ architecture.

### Step 1: Backup Existing Configuration

Before making changes, backup your current settings:

```bash
# Backup Claude Code settings
cp ~/.claude/settings.json ~/.claude/settings.json.backup

# Backup any existing Chronicle hooks
cp -r ~/.claude/hooks ~/.claude/hooks.backup
```

### Step 2: Update Environment Variables

Set the new environment variables in your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
export CLAUDE_PROJECT_DIR="/path/to/your/project"
export CLAUDE_HOOKS_LOG_LEVEL=INFO
export CLAUDE_HOOKS_SILENT_MODE=false
export CLAUDE_HOOKS_LOG_TO_FILE=true
```

### Step 3: Reinstall Chronicle Hooks

Use the latest installation script to set up the new structure:

```bash
cd /path/to/chronicle-project
python -m apps.hooks.scripts.install
```

This will:
- Create the new chronicle/ subfolder structure
- Install hooks with lib/ module support
- Generate updated settings.json with environment variable paths
- Copy shared library modules

### Step 4: Verify Migration

Test that the migration was successful:

```bash
# Test environment variable setup
python -c "import os; print('Project Dir:', os.getenv('CLAUDE_PROJECT_DIR'))"

# Test hook installation
ls -la ~/.claude/hooks/chronicle/

# Verify hooks work from subdirectories
cd /path/to/your/project/subdirectory
claude-code --help
```

### Step 5: Clean Up Old Files

Once you've verified the new installation works, you can remove old files:

```bash
# Remove old hook files (if they exist outside chronicle/ folder)
rm -f ~/.claude/hooks/*.py

# Remove backup files (after verifying everything works)
rm -rf ~/.claude/hooks.backup
rm -f ~/.claude/settings.json.backup
```

### Benefits of Migration

After migration, you'll gain:

1. **Directory Independence**: Run Claude Code from any project subdirectory
2. **Improved Logging**: New logging configuration options for better debugging
3. **Modular Architecture**: Shared lib/ modules for better maintainability
4. **Clean Organization**: All Chronicle files in one subfolder
5. **Environment Portability**: Configuration via environment variables
6. **Easy Uninstall**: Simple folder deletion removes everything

### Troubleshooting Migration

#### Issue: Hooks not working after migration
**Solution**: Verify environment variables are set correctly:
```bash
echo $CLAUDE_PROJECT_DIR
echo $CLAUDE_HOOKS_LOG_LEVEL
```

#### Issue: Missing lib/ modules error
**Solution**: Ensure the lib/ directory was copied during installation:
```bash
ls -la ~/.claude/hooks/chronicle/lib/
```

#### Issue: Settings.json not updated
**Solution**: Manually run the installation script with force flag:
```bash
python -m apps.hooks.scripts.install --force
```