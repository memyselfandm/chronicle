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