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

The Claude Code hooks system provides comprehensive observability into agent behavior by:

- **Tool Execution Monitoring**: Captures all tool calls (Read, Edit, Bash, etc.) with parameters and results
- **User Interaction Tracking**: Logs user prompts and agent responses
- **Session Lifecycle Management**: Tracks session start/stop and context preservation
- **Performance Metrics**: Measures execution times and resource usage
- **Database Storage**: Primary storage to Supabase with SQLite fallback
- **Security & Privacy**: Configurable data sanitization and PII filtering

### Supported Hook Events

- **PreToolUse**: Fired before tool execution (can block execution)
- **PostToolUse**: Fired after tool completion
- **UserPromptSubmit**: Fired when user submits a prompt
- **Notification**: Fired for Claude Code notifications
- **SessionStart**: Fired when Claude Code starts a session
- **Stop**: Fired when main agent completes
- **SubagentStop**: Fired when subagent tasks complete
- **PreCompact**: Fired before context compression

## Prerequisites

### System Requirements

- **Python 3.8+** with pip or uv package manager
- **Claude Code** (latest version recommended)
- **Git** (for version control)
- **Supabase Account** (optional, for cloud storage)

### Supported Platforms

- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, Debian, CentOS, etc.)
- **Windows** (WSL recommended)

## Quick Installation

### 1. Automated Installation

The easiest way to install the hooks system:

```bash
# Navigate to the hooks directory
cd apps/hooks

# Run the installation script
python install.py

# Follow the prompts
```

The installer will:
- Copy hook files to the appropriate Claude Code directory
- Update Claude Code `settings.json` to register all hooks
- Create a backup of existing settings
- Validate installation and test database connection

### 2. Installation Options

```bash
# Install with custom Claude directory
python install.py --claude-dir ~/.claude

# Install without database testing
python install.py --no-test-db

# Install without backup
python install.py --no-backup

# Validate existing installation
python install.py --validate-only

# Verbose output for debugging
python install.py --verbose
```

## Manual Installation

If you prefer manual installation or need custom configuration:

### Step 1: Environment Setup

1. **Copy Environment Template**:
   ```bash
   cp .env.template .env
   ```

2. **Configure Environment Variables**:
   Edit `.env` and set your configuration:
   ```env
   # Database Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anonymous-key
   
   # Optional: Local SQLite fallback
   CLAUDE_HOOKS_DB_PATH=~/.claude/hooks_data.db
   
   # Logging
   CLAUDE_HOOKS_LOG_LEVEL=INFO
   ```

### Step 2: Install Dependencies

```bash
# Using pip
pip install -r requirements.txt

# Using uv (recommended for faster installation)
uv pip install -r requirements.txt
```

### Step 3: Copy Hook Files

```bash
# Create Claude hooks directory
mkdir -p ~/.claude/hooks

# Copy hook scripts (assuming you're in apps/hooks/)
cp *.py ~/.claude/hooks/

# Make scripts executable
chmod +x ~/.claude/hooks/*.py
```

### Step 4: Update Claude Code Settings

Add hook configurations to your Claude Code `settings.json`:

**For Project-Level Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/pre_tool_use.py",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/post_tool_use.py",
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
            "command": "$HOME/.claude/hooks/user_prompt_submit.py",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/session_start.py",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/stop.py",
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
            "command": "$HOME/.claude/hooks/subagent_stop.py",
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
            "command": "$HOME/.claude/hooks/notification.py",
            "timeout": 5
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/pre_compact.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

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
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks_data.db
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
# Validate installation
python install.py --validate-only

# Test individual hook
echo '{"session_id":"test","tool_name":"Read"}' | python ~/.claude/hooks/pre_tool_use.py

# Check database connection
python -c "from src.database import DatabaseManager; dm = DatabaseManager(); print(dm.get_status())"
```

### Verify Claude Code Integration

1. **Start Claude Code** in a project directory
2. **Check Hook Execution**: Look for hook logs in `~/.claude/hooks.log`
3. **Database Verification**: Check that events are being stored
4. **Performance Check**: Ensure hooks execute within timeout limits

### Expected Log Output

```
[2024-01-01 12:00:00] INFO - BaseHook initialized
[2024-01-01 12:00:01] INFO - PreToolUse hook executed: Read
[2024-01-01 12:00:01] DEBUG - Event saved successfully: PreToolUse
```

## Troubleshooting

### Common Issues

#### 1. Permission Denied

**Problem**: Hooks not executing due to permission issues.

**Solution**:
```bash
# Fix hook permissions
chmod +x ~/.claude/hooks/*.py

# Check file ownership
ls -la ~/.claude/hooks/
```

#### 2. Database Connection Failed

**Problem**: Cannot connect to Supabase or SQLite.

**Solutions**:
```bash
# Check environment variables
env | grep SUPABASE

# Test SQLite fallback
CLAUDE_HOOKS_DB_PATH=./test.db python -c "from src.database import DatabaseManager; dm = DatabaseManager(); print(dm.test_connection())"

# Check Supabase credentials
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

#### 3. JSON Parse Errors

**Problem**: Invalid JSON in hook responses.

**Solution**:
```bash
# Test hook JSON output
echo '{"test":"data"}' | python ~/.claude/hooks/pre_tool_use.py | jq .

# Check for hidden characters
cat -A ~/.claude/hooks/pre_tool_use.py
```

#### 4. Hooks Not Triggering

**Problem**: Claude Code not executing hooks.

**Solutions**:
```bash
# Verify settings.json syntax
jq . ~/.claude/settings.json

# Check Claude Code logs
tail -f ~/.claude/logs/claude-code.log

# Validate hook matcher patterns
```

### Debug Mode

Enable verbose logging for troubleshooting:

```env
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_VERBOSE=true
CLAUDE_HOOKS_DEBUG=true
```

### Log Files

- **Hook Logs**: `~/.claude/hooks.log`
- **Error Logs**: `~/.claude/hooks_debug.log`
- **Claude Code Logs**: `~/.claude/logs/claude-code.log`

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
# Install hooks
python install.py

# Validate installation
python install.py --validate-only

# Test database connection
python -c "from src.database import DatabaseManager; print(DatabaseManager().get_status())"

# View logs
tail -f ~/.claude/hooks.log

# Check hook permissions
ls -la ~/.claude/hooks/
```

### Important Files

- **Installation**: `install.py`
- **Configuration**: `.env` (copy from `.env.template`)
- **Claude Settings**: `~/.claude/settings.json` or `.claude/settings.json`
- **Hook Scripts**: `~/.claude/hooks/*.py`
- **Database**: `~/.claude/hooks_data.db` (SQLite fallback)

### Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
CLAUDE_HOOKS_LOG_LEVEL=INFO
CLAUDE_HOOKS_DB_PATH=~/.claude/hooks_data.db
```

The Claude Code hooks system provides powerful observability into agent behavior while maintaining security and performance standards. Follow this guide for successful installation and configuration.