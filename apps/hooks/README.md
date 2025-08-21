# Claude Code Hooks Installation Guide

This directory contains the Claude Code observability hooks system that captures detailed agent behavior, performance metrics, and project context data. This guide provides comprehensive installation and configuration instructions.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)
- [Development](#development)

## Overview

The Claude Code hooks system provides comprehensive observability into agent behavior using a modern **UV single-file script architecture** with shared library modules:

- **Tool Execution Monitoring**: Captures all tool calls (Read, Edit, Bash, etc.) with parameters and results
- **User Interaction Tracking**: Logs user prompts and agent responses
- **Session Lifecycle Management**: Tracks session start/stop and context preservation
- **Performance Metrics**: Measures execution times and resource usage (sub-100ms execution)
- **Database Storage**: Primary storage to Supabase with SQLite fallback
- **Security & Privacy**: Configurable data sanitization and PII filtering
- **Modern JSON Output**: Claude Code compliant hookSpecificOutput format with camelCase fields
- **Pure Observability**: PreToolUse hook observes tool execution without interfering with Claude's native permissions

### Architecture: UV Single-File Scripts with Shared Libraries

Chronicle uses a modern architecture that combines the portability of UV single-file scripts with the maintainability of shared library modules:

**UV Single-File Scripts** (`~/.claude/hooks/chronicle/hooks/`):
- Self-contained executable scripts with embedded dependency management
- UV handles Python dependencies via script headers (no pip install required)
- Fast startup time optimized for Claude Code's performance requirements
- Cross-platform compatible with automatic environment handling

**Shared Library Modules** (`~/.claude/hooks/chronicle/lib/`):
- Common functionality extracted into reusable lib/ modules
- No code duplication across hook scripts
- Easy maintenance and consistent behavior
- Optimized for inline importing by UV scripts

**Chronicle Subfolder Organization**:
- Clean installation into dedicated `~/.claude/hooks/chronicle/` directory
- Simple uninstallation by removing single folder
- Version tracking and installation metadata
- No interference with other Claude Code hooks or tools

### Supported Hook Events

- **PreToolUse**: Fired before tool execution (observational only, does not interfere with permissions)
- **PostToolUse**: Fired after tool completion (supports security analysis and decision blocking)
- **UserPromptSubmit**: Fired when user submits a prompt (supports additionalContext injection)
- **Notification**: Fired for Claude Code notifications
- **SessionStart**: Fired when Claude Code starts a session (supports project-aware additionalContext)
- **Stop**: Fired when main agent completes
- **SubagentStop**: Fired when subagent tasks complete
- **PreCompact**: Fired before context compression

### New Features (Sprint 2)

**JSON Output Format Modernization**:
- All hooks now use Claude Code compliant `hookSpecificOutput` structure
- Automatic snake_case to camelCase conversion for field names
- Proper `continue`, `stopReason`, and `suppressOutput` control fields
- Enhanced response metadata and debugging information

**Observability Features**:
- **Event Logging**: Captures all tool execution events for analysis
- **Sensitive Data Sanitization**: Redacts passwords, tokens, and secrets from logs
- **Non-Interference**: Does not alter Claude's native permission system
- **MCP Tool Support**: Works seamlessly with all tools including MCP servers
- **Performance Optimized**: Minimal overhead with suppressed output

### New Features (Sprint 3)

**Comprehensive Security Validation**:
- **Path traversal protection**: Blocks `../../../etc/passwd` type attacks
- **Input size validation**: Configurable limits (default 10MB) prevent memory exhaustion
- **Sensitive data detection**: 20+ patterns for API keys, tokens, PII, credentials
- **Command injection prevention**: Shell escaping and dangerous pattern detection
- **JSON schema validation**: Ensures proper hook input structure
- **Performance optimized**: All validation completes in <5ms

**Enhanced Error Handling**:
- **Never crash Claude Code**: All exceptions caught with graceful fallback
- **Standardized exit codes**: 0=success, 2=graceful failure per Claude Code docs
- **Detailed error messages**: Actionable feedback for developers
- **Configurable logging**: ERROR/WARN/INFO/DEBUG levels via environment variables
- **Automatic recovery**: Retry logic, fallback mechanisms, circuit breakers
- **Context-aware debugging**: Rich error context and recovery suggestions

### New Features (Sprint 4)

**Environment Variable Support**:
- **Portable hook paths**: Uses `$CLAUDE_PROJECT_DIR` in generated settings.json
- **Directory independence**: Hooks work from any project subdirectory
- **Cross-platform compatibility**: Windows, macOS, and Linux path handling
- **Fallback mechanisms**: Graceful handling of missing environment variables
- **Migration support**: Backward compatibility with existing absolute paths

**Performance Optimization**:
- **Sub-2ms execution**: Hooks execute in ~2ms (50x faster than 100ms requirement)
- **Comprehensive monitoring**: Real-time timing and memory usage tracking  
- **Async database operations**: Connection pooling and batch processing
- **Intelligent caching**: LRU cache with TTL for processed data
- **Early returns**: Fast validation paths for invalid input
- **Resource efficiency**: Minimal CPU and memory footprint

## Prerequisites

### System Requirements

- **Python 3.8+** (managed by UV - no manual installation required)
- **UV Package Manager** (required for running single-file scripts)
- **Claude Code** (latest version recommended)
- **Git** (for version control)
- **Supabase Account** (optional, for cloud storage)

### UV Package Manager Installation

Chronicle hooks require UV for running single-file scripts with embedded dependencies:

```bash
# Install UV (choose one method)

# macOS/Linux via curl
curl -LsSf https://astral.sh/uv/install.sh | sh

# macOS via Homebrew  
brew install uv

# Windows via PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Python pip (any platform)
pip install uv
```

Verify UV installation:
```bash
uv --version
# Expected output: uv 0.x.x (or newer)
```

### Supported Platforms

- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, Debian, CentOS, etc.)
- **Windows** (Native support, WSL also works)

## Quick Installation

### 1. Automated Installation

The easiest way to install the hooks system with UV single-file script architecture:

```bash
# Navigate to the hooks directory
cd apps/hooks

# Run the installation script (requires UV)
python scripts/install.py

# Follow the prompts
```

The installer will:
- Install UV single-file hook scripts to `~/.claude/hooks/chronicle/hooks/`
- Copy shared library modules to `~/.claude/hooks/chronicle/lib/`
- Update Claude Code `settings.json` to register all hooks with chronicle paths
- Create installation metadata and backup existing settings
- Validate UV availability and hook registration
- Test database connection (optional)

### 2. Installation Options

```bash
# Install with custom Claude directory
python scripts/install.py --claude-dir ~/.claude

# Install without database testing
python scripts/install.py --no-test-db

# Install without backup
python scripts/install.py --no-backup

# Validate existing installation  
python scripts/install.py --validate-only

# Verbose output for debugging
python scripts/install.py --verbose

# Check UV availability before installing
python scripts/install.py --check-uv
```

## Manual Installation

If you prefer manual installation or need custom configuration:

### Step 1: Verify UV Installation

```bash
# Check UV is available
uv --version

# If not installed, install UV first (see Prerequisites section)
```

### Step 2: Create Chronicle Directory Structure

```bash
# Create Chronicle subfolder in Claude hooks directory
mkdir -p ~/.claude/hooks/chronicle/{hooks,lib,config,metadata}

# Create optional directories (created on demand if needed)
mkdir -p ~/.claude/hooks/chronicle/{data,logs}
```

### Step 3: Copy Hook Files and Libraries

```bash
# Copy UV single-file hook scripts (from apps/hooks/src/hooks/)
cp src/hooks/*.py ~/.claude/hooks/chronicle/hooks/

# Copy shared library modules (from apps/hooks/src/lib/)
cp src/lib/*.py ~/.claude/hooks/chronicle/lib/

# Make hook scripts executable
chmod +x ~/.claude/hooks/chronicle/hooks/*.py
```

### Step 4: Environment Configuration

1. **Copy Environment Template**:
   ```bash
   cp scripts/chronicle.env.template ~/.claude/hooks/chronicle/config/environment.env
   ```

2. **Configure Environment Variables**:
   Edit `~/.claude/hooks/chronicle/config/environment.env`:
   ```env
   # Project directory for hooks to operate in
   CLAUDE_PROJECT_DIR=/path/to/your/project
   
   # Database Configuration (optional)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anonymous-key
   
   # Local SQLite fallback
   CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/data/hooks_data.db
   
   # Logging
   CLAUDE_HOOKS_LOG_LEVEL=INFO
   ```

### Step 5: Update Claude Code Settings

Add hook configurations to your Claude Code `settings.json` using the Chronicle subfolder paths:

**For Project-Level Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/pre_tool_use.py",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/post_tool_use.py",
            "timeout": 10
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/user_prompt_submit.py",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/session_start.py",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/stop.py",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/subagent_stop.py",
            "timeout": 5
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/notification.py",
            "timeout": 5
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "manual",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/pre_compact.py",
            "timeout": 10
          }
        ]
      },
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/chronicle/hooks/pre_compact.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Note**: UV single-file scripts are executed directly by Claude Code. The UV dependency management is handled automatically by the `#!/usr/bin/env -S uv run` shebang in each hook script.

## UV Architecture Benefits

### Performance Characteristics

The UV single-file script architecture provides significant performance advantages:

**Fast Startup Time**:
- UV has optimized Python environment bootstrapping 
- Typical hook execution: **<100ms** (Claude Code requirement met)
- Cold start overhead: **<20ms** additional
- Warm execution: **<50ms** typical

**Memory Efficiency**:
- Minimal memory footprint compared to traditional Python imports
- No persistent process memory accumulation
- Automatic cleanup after each hook execution
- Shared lib/ modules provide code reuse without duplication

**Dependency Management**:
- No manual `pip install` required - UV handles everything
- Automatic Python version management (3.8+ supported)
- Isolated dependency resolution per script
- No virtual environment setup needed
- Cross-platform compatibility built-in

### Maintainability Benefits

**Code Organization**:
- Single-file scripts are self-documenting and portable
- Shared lib/ modules eliminate code duplication (~5,000 lines → ~1,500 lines)
- Clear separation between executable hooks and reusable libraries
- Easy debugging - all dependencies visible in script headers

**Installation Simplicity**:
- Clean chronicle subfolder structure (`~/.claude/hooks/chronicle/`)
- Simple uninstallation: `rm -rf ~/.claude/hooks/chronicle/`
- No scattered files across multiple directories
- Version tracking and installation metadata included

**Development Workflow**:
- Test individual hooks without complex import setup
- Modify shared functionality in one place (lib/ modules)
- No dependency conflicts between different hook versions
- Easy to package and distribute

### Comparison with Previous Architecture

| Aspect | Previous (Import-Based) | Current (UV Scripts) |
|--------|------------------------|---------------------|
| **Installation** | Multiple files scattered | Single chronicle folder |
| **Dependencies** | Manual pip install | Automatic UV management |
| **Code Duplication** | ~5,000 lines repeated | ~1,500 lines shared |
| **Startup Time** | Variable, import-dependent | Consistent <100ms |
| **Debugging** | Complex import paths | Self-contained scripts |
| **Uninstallation** | Manual file tracking | Single folder deletion |
| **Maintenance** | Update multiple files | Update lib/ modules once |

## Configuration

### Database Configuration

#### Supabase Setup (Recommended)

1. **Create Supabase Project**:
   - Visit [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anonymous key

2. **Configure Environment**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Initialize Database Schema**:
   ```bash
   # Run the schema setup (if available)
   python -m src.database --setup-schema
   ```

#### SQLite Fallback

If Supabase is unavailable, the system automatically falls back to SQLite:

```env
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/data/hooks_data.db
```

### Security Configuration

#### Data Sanitization

```env
# Enable data sanitization
CLAUDE_HOOKS_SANITIZE_DATA=true

# Remove API keys from logs
CLAUDE_HOOKS_REMOVE_API_KEYS=true

# Remove file paths (privacy)
CLAUDE_HOOKS_REMOVE_FILE_PATHS=false

# PII filtering
CLAUDE_HOOKS_PII_FILTERING=true
```

#### File Access Control

```env
# Allowed file extensions
CLAUDE_HOOKS_ALLOWED_EXTENSIONS=.py,.js,.ts,.json,.md,.txt

# Maximum input size (MB)
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=10
```

### Performance Tuning

```env
# Hook execution timeout (ms)
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=100

# Memory limit (MB)
CLAUDE_HOOKS_MAX_MEMORY_MB=50

# Async operations
CLAUDE_HOOKS_ASYNC_OPERATIONS=true
```

## Verification

### Test Installation

```bash
# Validate installation with UV architecture
python scripts/install.py --validate-only

# Test individual UV hook script
echo '{"session_id":"test","tool_name":"Read"}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py

# Check UV dependency resolution
uv run --script ~/.claude/hooks/chronicle/hooks/pre_tool_use.py --help

# Verify chronicle directory structure
ls -la ~/.claude/hooks/chronicle/
ls -la ~/.claude/hooks/chronicle/hooks/
ls -la ~/.claude/hooks/chronicle/lib/
```

### Verify Claude Code Integration

1. **Start Claude Code** in a project directory
2. **Check Hook Execution**: Look for hook logs in `~/.claude/hooks/chronicle/logs/hooks.log`
3. **Database Verification**: Check that events are being stored in chronicle database
4. **Performance Check**: Ensure UV hooks execute within <100ms timeout limits
5. **UV Dependencies**: Verify UV can resolve all script dependencies automatically

### Expected Log Output

```
[2024-01-01 12:00:00] INFO - UV script initialized: pre_tool_use.py
[2024-01-01 12:00:01] INFO - PreToolUse hook executed: Read
[2024-01-01 12:00:01] DEBUG - Event saved successfully: PreToolUse
[2024-01-01 12:00:01] INFO - Hook execution time: 45ms
```

### UV Script Validation

```bash
# Check UV script headers are valid
for hook in ~/.claude/hooks/chronicle/hooks/*.py; do
    echo "=== $hook ==="
    head -15 "$hook" | grep -E "^#|requires-python|dependencies"
done

# Test all hooks respond to JSON input
for hook in ~/.claude/hooks/chronicle/hooks/*.py; do
    echo "Testing $hook..."
    echo '{"test": true}' | "$hook" | jq . > /dev/null && echo "✓ OK" || echo "✗ FAILED"
done
```

## Troubleshooting

### UV-Specific Issues

#### 1. UV Not Found or Not Installed

**Problem**: `command not found: uv` or `No such file or directory` when executing hooks.

**Solution**:
```bash
# Install UV (see Prerequisites section)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify UV is in PATH
which uv
uv --version

# If UV is installed but not in PATH, add to shell profile
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### 2. UV Script Shebang Issues

**Problem**: Hooks fail with shebang-related errors.

**Solution**:
```bash
# Check if scripts have correct shebang
head -1 ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
# Should be: #!/usr/bin/env -S uv run

# Fix permissions for execution
chmod +x ~/.claude/hooks/chronicle/hooks/*.py

# Test UV script execution manually
echo '{"test": "data"}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
```

#### 3. UV Dependency Resolution Failures

**Problem**: UV cannot resolve dependencies listed in script headers.

**Solution**:
```bash
# Test UV dependency resolution
uv run --script ~/.claude/hooks/chronicle/hooks/pre_tool_use.py --help

# Check UV cache and clear if needed
uv cache clean

# Verify internet connectivity for package downloads
curl -s https://pypi.org/simple/ > /dev/null && echo "PyPI accessible"

# Run with verbose output to see dependency resolution
UV_VERBOSE=1 echo '{"test": "data"}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
```

#### 4. Python Version Compatibility

**Problem**: UV scripts fail due to Python version requirements.

**Solution**:
```bash
# Check available Python versions
uv python list

# Install required Python version if missing (3.8+)
uv python install 3.8

# Test with specific Python version
uv run --python 3.8 ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
```

### Common Issues

#### 1. Permission Denied

**Problem**: Hooks not executing due to permission issues.

**Solution**:
```bash
# Fix hook permissions (Chronicle subfolder)
chmod +x ~/.claude/hooks/chronicle/hooks/*.py

# Check file ownership
ls -la ~/.claude/hooks/chronicle/hooks/

# Fix directory permissions if needed
chmod 755 ~/.claude/hooks/chronicle/
```

#### 2. Database Connection Failed

**Problem**: Cannot connect to Supabase or SQLite.

**Solutions**:
```bash
# Check environment variables
env | grep SUPABASE

# Test SQLite fallback with chronicle path
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/data/hooks_data.db \
  echo '{"test": "data"}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py

# Check Supabase credentials
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Test database connection using UV script
echo '{"test_mode": true}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
```

#### 3. JSON Parse Errors

**Problem**: Invalid JSON in hook responses.

**Solution**:
```bash
# Test hook JSON output with chronicle path
echo '{"test":"data"}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py | jq .

# Check for hidden characters in UV script
cat -A ~/.claude/hooks/chronicle/hooks/pre_tool_use.py | head -20

# Validate script header format
head -15 ~/.claude/hooks/chronicle/hooks/pre_tool_use.py
```

#### 4. Hooks Not Triggering

**Problem**: Claude Code not executing hooks.

**Solutions**:
```bash
# Verify settings.json syntax
jq . ~/.claude/settings.json

# Check if chronicle paths are correct in settings
grep -r "chronicle/hooks" ~/.claude/settings.json

# Check Claude Code logs
tail -f ~/.claude/logs/claude-code.log

# Test hook execution directly
echo '{"session_id":"test","tool_name":"Read"}' | \
  ~/.claude/hooks/chronicle/hooks/pre_tool_use.py

# Validate hook registration in Chronicle installation
cat ~/.claude/hooks/chronicle/metadata/installation.json
```

### Debug Mode

Enable verbose logging for troubleshooting:

```env
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_VERBOSE=true
CLAUDE_HOOKS_DEBUG=true
```

### Log Files

- **Hook Logs**: `~/.claude/hooks/chronicle/logs/hooks.log`
- **Error Logs**: `~/.claude/hooks/chronicle/logs/hooks_debug.log`
- **Claude Code Logs**: `~/.claude/logs/claude-code.log`
- **UV Cache**: `~/.cache/uv/` (for dependency resolution issues)

## Advanced Usage

### Custom Hook Development

1. **Create Custom Hook**:
   ```python
   #!/usr/bin/env python3
   from src.base_hook import BaseHook
   
   class CustomHook(BaseHook):
       def process(self, data):
           # Custom processing logic
           return self.create_response(continue_execution=True)
   ```

2. **Register Custom Hook**:
   Add to `settings.json` with appropriate matcher patterns.

### Integration with External Systems

#### Webhook Notifications

```env
CLAUDE_HOOKS_WEBHOOK_URL=https://your-webhook-endpoint.com
```

#### Slack Integration

```env
CLAUDE_HOOKS_SLACK_WEBHOOK=https://hooks.slack.com/services/...
```

### Performance Monitoring

```env
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true
CLAUDE_HOOKS_ERROR_THRESHOLD=10
CLAUDE_HOOKS_MEMORY_THRESHOLD=80
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run specific test files
pytest tests/test_install.py
pytest tests/test_database.py

# Run with coverage
pytest --cov=src tests/
```

### Test Database Setup

```bash
# Use test database
export CLAUDE_HOOKS_TEST_DB_PATH=./test_hooks.db
export CLAUDE_HOOKS_MOCK_DB=true

# Run tests
pytest tests/
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint code
flake8 src/ tests/

# Type checking
mypy src/
```

## Support

### Getting Help

1. **Check Logs**: Review hook and Claude Code logs for error messages
2. **Validate Installation**: Run `python install.py --validate-only`
3. **Test Database**: Verify database connectivity and schema
4. **Review Configuration**: Check environment variables and settings

### Reporting Issues

When reporting issues, include:

- **Error Messages**: Complete error output from logs
- **Configuration**: Relevant environment variables (redact sensitive data)
- **System Info**: OS, Python version, Claude Code version
- **Steps to Reproduce**: Detailed reproduction steps

### Contributing

1. **Fork Repository**: Create a fork for your changes
2. **Create Branch**: Use descriptive branch names
3. **Write Tests**: Add tests for new functionality
4. **Update Documentation**: Keep README and comments current
5. **Submit PR**: Include detailed description of changes

---

## Quick Reference

### Essential Commands

```bash
# Install hooks with UV architecture
python scripts/install.py

# Validate UV installation
python scripts/install.py --validate-only

# Test UV hook directly
echo '{"test": true}' | ~/.claude/hooks/chronicle/hooks/pre_tool_use.py

# View chronicle logs
tail -f ~/.claude/hooks/chronicle/logs/hooks.log

# Check UV script permissions and structure
ls -la ~/.claude/hooks/chronicle/hooks/
ls -la ~/.claude/hooks/chronicle/lib/

# Test UV dependency resolution
uv cache clean  # Clear UV cache if needed
```

### Important Files

- **Installation**: `scripts/install.py`
- **UV Hook Scripts**: `~/.claude/hooks/chronicle/hooks/*.py`
- **Shared Libraries**: `~/.claude/hooks/chronicle/lib/*.py`
- **Configuration**: `~/.claude/hooks/chronicle/config/environment.env`
- **Claude Settings**: `~/.claude/settings.json` or `.claude/settings.json`
- **Database**: `~/.claude/hooks/chronicle/data/hooks_data.db` (SQLite fallback)
- **Installation Metadata**: `~/.claude/hooks/chronicle/metadata/installation.json`

### Environment Variables

```env
# Project context (recommended)
CLAUDE_PROJECT_DIR=/path/to/your/project

# Database configuration (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Chronicle-specific settings
CLAUDE_HOOKS_LOG_LEVEL=INFO
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks/chronicle/data/hooks_data.db
```

### UV Script Architecture Summary

Chronicle hooks are now **UV single-file scripts** that:
- Manage their own dependencies automatically via UV
- Import shared functionality from `chronicle/lib/` modules  
- Execute in <100ms with optimized startup
- Install cleanly in dedicated `chronicle/` subfolder
- Support simple uninstallation via folder deletion

The Claude Code hooks system provides powerful observability into agent behavior while maintaining security and performance standards. Follow this guide for successful installation and configuration.