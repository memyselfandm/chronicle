# Claude Code Settings Integration Guide

## Overview

This guide provides comprehensive documentation for integrating with Claude Code's settings.json configuration system and hook registration mechanisms. Essential for developers building Claude Code extensions and observability systems.

## Settings File Locations

### User-Level Settings
```
~/.claude/settings.json
```
- Global settings applied across all projects
- Personal preferences and user-wide configurations
- Highest precedence for user-specific settings

### Project-Level Settings
```
.claude/settings.json          # Shared with team (version controlled)
.claude/settings.local.json    # Personal project settings (excluded from git)
```
- Project-specific configurations
- Local settings override shared settings
- Useful for team consistency and personal customization

### Enterprise Managed Settings
```
# macOS
/Library/Application Support/ClaudeCode/managed-settings.json

# Linux/WSL
/etc/claude-code/managed-settings.json

# Windows
C:\ProgramData\ClaudeCode\managed-settings.json
```
- Centrally managed organizational policies
- Highest precedence in the settings hierarchy

## Settings Precedence Order

1. **Enterprise managed policies** (highest)
2. **Command line arguments**
3. **Local project settings** (`.claude/settings.local.json`)
4. **Shared project settings** (`.claude/settings.json`)
5. **User settings** (`~/.claude/settings.json`) (lowest)

## Hook Configuration Structure

### Basic Hook Configuration
```json
{
  "hooks": {
    "HookEventName": [
      {
        "matcher": "ToolName|Pattern",
        "hooks": [
          {
            "type": "command",
            "command": "your-shell-command-here"
          }
        ]
      }
    ]
  }
}
```

### Available Hook Events

#### Session Lifecycle Hooks
- **SessionStart**: Fired when Claude Code starts a new session
- **Stop**: Fired when Claude Code finishes responding
- **SubagentStop**: Fired when subagent tasks complete

#### User Interaction Hooks
- **UserPromptSubmit**: Fired when user submits a prompt (before Claude processes it)
- **Notification**: Fired when Claude Code sends notifications

#### Tool Execution Hooks
- **PreToolUse**: Fired before any tool execution (can block execution)
- **PostToolUse**: Fired after tool completion

### Hook Payload Structure

All hooks receive a JSON payload via stdin with this common structure:
```json
{
  "session_id": "unique-session-identifier",
  "transcript_path": "/path/to/conversation.json",
  "cwd": "/current/working/directory",
  "hook_event_name": "PreToolUse|PostToolUse|etc",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Event-Specific Fields

**PreToolUse/PostToolUse Payload:**
```json
{
  "tool_name": "Edit|Bash|Read|etc",
  "tool_input": {
    "file_path": "/path/to/file",
    "command": "shell command",
    "pattern": "search pattern"
  },
  "tool_response": {  // PostToolUse only
    "result": "tool execution result",
    "success": true,
    "duration_ms": 150
  }
}
```

**UserPromptSubmit Payload:**
```json
{
  "prompt": "User's submitted prompt text",
  "context": {
    "files_in_context": ["/path/to/file1", "/path/to/file2"],
    "git_branch": "main",
    "project_root": "/path/to/project"
  }
}
```

### Hook Return Values

#### Basic Exit Codes
- **0**: Success, continue normal operation
- **Non-zero**: Hook failure (logged but doesn't stop Claude)

#### Structured JSON Response
For advanced control, hooks can return JSON to stdout:
```json
{
  "continue": true,              // Whether Claude should continue (default: true)
  "stopReason": "string",        // Message when continue=false
  "suppressOutput": false        // Hide stdout from transcript (default: false)
}
```

#### PreToolUse Special Response
PreToolUse hooks can control tool execution:
```json
{
  "decision": "approve",         // "approve" | "block" | undefined
  "reason": "Explanation text"   // Shown to user/Claude
}
```
- **"approve"**: Bypasses permission system
- **"block"**: Prevents tool execution
- **undefined**: Normal permission flow

## Matcher Patterns

### Tool Name Matching
```json
{
  "matcher": "Edit"                    // Single tool
}

{
  "matcher": "Edit|MultiEdit|Write"    // Multiple tools (OR logic)
}

{
  "matcher": ".*"                      // All tools (regex)
}
```

### MCP Tool Matching
MCP (Model Context Protocol) tools use special naming patterns:
```json
{
  "matcher": "mcp__.*"                 // All MCP tools
}

{
  "matcher": "mcp__server__tool"       // Specific MCP server tool
}
```

## Practical Hook Examples

### 1. Security Hook - Block Sensitive Files
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import json, sys; data=json.load(sys.stdin); path=data.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(p in path for p in ['.env', 'package-lock.json', '.git/']) else 0)\""
          }
        ]
      }
    ]
  }
}
```

### 2. Auto-Format Code on Edit
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$file_path\" == *.py ]]; then black \"$file_path\"; elif [[ \"$file_path\" == *.js ]] || [[ \"$file_path\" == *.ts ]]; then npx prettier --write \"$file_path\"; fi"
          }
        ]
      }
    ]
  }
}
```

### 3. Command Logging Hook
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"\\(.tool_input.command) - \\(.tool_input.description // \"No description\")\"' >> ~/.claude/bash-command-log.txt"
          }
        ]
      }
    ]
  }
}
```

### 4. Session Analytics Hook
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/session_tracker.py --event=start --session-id=\"$session_id\" --project=\"$PWD\""
          }
        ]
      }
    ]
  }
}
```

## Configuration Management

### Environment Variables
Configure hooks with environment-specific settings:
```json
{
  "environmentVariables": {
    "CLAUDE_HOOK_LOG_LEVEL": "debug",
    "CLAUDE_HOOK_DB_URL": "postgresql://localhost/claude_hooks",
    "CLAUDE_HOOK_FALLBACK_DB": "/tmp/claude_hooks.sqlite"
  }
}
```

### Permission Controls
```json
{
  "allow": {
    "tools": ["Read", "Edit", "Bash"],
    "paths": ["/home/user/projects", "/tmp"]
  },
  "deny": {
    "tools": ["Write"],
    "paths": ["/etc", "/usr/bin"]
  }
}
```

## Security Considerations

### Input Validation
Always validate and sanitize hook inputs:
```python
import json
import sys
import os
from pathlib import Path

def validate_file_path(path):
    """Validate file path to prevent directory traversal"""
    if not path:
        return False
    
    # Check for directory traversal
    if '..' in path or path.startswith('/'):
        return False
    
    # Ensure path is within project directory
    try:
        resolved = Path(path).resolve()
        project_root = Path(os.getcwd()).resolve()
        resolved.relative_to(project_root)
        return True
    except ValueError:
        return False

# Hook implementation
data = json.load(sys.stdin)
file_path = data.get('tool_input', {}).get('file_path', '')

if not validate_file_path(file_path):
    print(json.dumps({"decision": "block", "reason": "Invalid file path"}))
    sys.exit(0)
```

### Shell Command Safety
Always quote variables and use absolute paths:
```bash
# Good
python3 "$CLAUDE_PROJECT_DIR/hooks/validator.py" --file="$file_path"

# Bad
python3 $CLAUDE_PROJECT_DIR/hooks/validator.py --file=$file_path
```

### Sensitive Data Handling
```python
import re

def sanitize_payload(data):
    """Remove sensitive information from hook payload"""
    sensitive_patterns = [
        r'password["\s]*[:=]["\s]*[^"\s]+',
        r'api[_-]?key["\s]*[:=]["\s]*[^"\s]+',
        r'secret["\s]*[:=]["\s]*[^"\s]+',
        r'token["\s]*[:=]["\s]*[^"\s]+',
    ]
    
    data_str = json.dumps(data)
    for pattern in sensitive_patterns:
        data_str = re.sub(pattern, '[REDACTED]', data_str, flags=re.IGNORECASE)
    
    return json.loads(data_str)
```

## Installation Automation

### Settings Template Generation
```python
import json
import os
from pathlib import Path

def generate_settings_template(project_root, hooks_config):
    """Generate Claude Code settings.json template"""
    settings_dir = Path(project_root) / '.claude'
    settings_dir.mkdir(exist_ok=True)
    
    settings = {
        "hooks": hooks_config,
        "environmentVariables": {
            "CLAUDE_PROJECT_ROOT": str(project_root),
            "CLAUDE_HOOKS_ENABLED": "true"
        },
        "permissions": {
            "allow": {
                "tools": ["Read", "Edit", "MultiEdit", "Write", "Bash", "Glob", "Grep"],
                "paths": [str(project_root)]
            }
        }
    }
    
    settings_file = settings_dir / 'settings.json'
    with open(settings_file, 'w') as f:
        json.dump(settings, f, indent=2)
    
    print(f"Generated Claude Code settings: {settings_file}")
    return settings_file
```

### Hook Registration Script
```bash
#!/bin/bash
# register_hooks.sh - Automated hook registration

CLAUDE_DIR="$HOME/.claude"
PROJECT_CLAUDE_DIR=".claude"
HOOKS_DIR="hooks"

# Ensure directories exist
mkdir -p "$CLAUDE_DIR"
mkdir -p "$PROJECT_CLAUDE_DIR"

# Copy hook scripts
if [ -d "$HOOKS_DIR" ]; then
    cp -r "$HOOKS_DIR" "$PROJECT_CLAUDE_DIR/"
    chmod +x "$PROJECT_CLAUDE_DIR/hooks"/*.py
    echo "Copied hook scripts to $PROJECT_CLAUDE_DIR/hooks/"
fi

# Generate settings if not exists
if [ ! -f "$PROJECT_CLAUDE_DIR/settings.json" ]; then
    python3 setup_hooks.py --generate-settings
    echo "Generated settings.json"
fi

echo "Hook registration complete!"
```

## Troubleshooting

### Common Issues

1. **Hook not executing**: Check matcher patterns and file permissions
2. **Permission denied**: Ensure hook scripts have execute permissions
3. **JSON parse errors**: Validate hook output JSON format
4. **Path issues**: Use absolute paths and proper quoting

### Debug Mode
Enable verbose logging in settings:
```json
{
  "verbose": true,
  "environmentVariables": {
    "CLAUDE_DEBUG": "true"
  }
}
```

### Hook Testing
Test hooks manually:
```bash
# Test hook with sample payload
echo '{"session_id":"test","tool_name":"Edit","tool_input":{"file_path":"test.py"}}' | python3 your_hook.py
```

## Best Practices

1. **Error Handling**: Always handle errors gracefully
2. **Performance**: Keep hooks fast (<100ms execution time)
3. **Logging**: Log hook execution for debugging
4. **Security**: Validate all inputs and sanitize outputs
5. **Testing**: Test hooks with various input scenarios
6. **Documentation**: Document hook behavior and requirements

This guide provides the foundation for building robust Claude Code integrations with proper settings management and hook registration.