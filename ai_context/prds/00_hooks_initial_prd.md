# PRD: Claude Code Observability Hooks System

## Overview
Develop a comprehensive Python-based observability system that instruments all available Claude Code hooks to capture detailed agent behavior, performance metrics, and project context data.

## Requirements

### Core Architecture
- **Hook Coverage**: Implement scripts for all documented Claude Code hooks
- **Data Collection**: Capture maximum available data from each hook execution
- **Storage Strategy**: Primary storage to Supabase PostgreSQL with SQLite fallback
- **Session Management**: Track and correlate events across agent sessions
- **Error Handling**: Robust error handling to prevent hook failures from breaking agent workflows

### Hook Scripts Required (Based on Official Documentation)

#### 1. Tool Execution Hooks
- **`pre_tool_use.py`**: Capture tool calls before execution
  - Available matchers: `Task`, `Bash`, `Glob`, `Grep`, `Read`, `Edit`, `MultiEdit`, `Write`, `WebFetch`, `WebSearch`, MCP tools (`mcp__*`)
  - Log tool parameters, reasoning context, project state
- **`post_tool_use.py`**: Capture tool results after execution
  - Same matchers as PreToolUse
  - Log tool responses, success/failure, performance metrics

#### 2. User Interaction Hooks
- **`user_prompt_submit.py`**: Capture user prompts before processing
  - Log full prompt text, session context, timestamp
  - Optional prompt validation and context injection
- **`notification.py`**: Capture Claude Code notifications
  - Log permission requests, idle notifications, system messages

#### 3. Session Lifecycle Hooks
- **`session_start.py`**: Initialize session tracking
  - Matchers: `startup`, `resume`, `clear`
  - Capture project context, git state, environment setup
- **`stop.py`**: Log main agent completion
  - Capture session summary, final metrics
- **`subagent_stop.py`**: Log subagent task completion
  - Track Task tool execution patterns

#### 4. System Operation Hooks
- **`pre_compact.py`**: Log before context compression
  - Matchers: `manual`, `auto`
  - Capture conversation state before compaction

### Data Schema Design

#### Core Tables
```sql
-- Sessions table
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    source VARCHAR(20), -- startup, resume, clear
    project_path TEXT,
    git_branch TEXT,
    git_status JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table (parent table for all hook events)
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id),
    hook_event_name VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER,
    success BOOLEAN,
    raw_input JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool usage events
CREATE TABLE tool_events (
    event_id UUID PRIMARY KEY REFERENCES events(event_id),
    tool_name VARCHAR(100) NOT NULL,
    matcher_pattern VARCHAR(100),
    tool_input JSONB,
    tool_response JSONB,
    is_mcp_tool BOOLEAN DEFAULT FALSE,
    mcp_server VARCHAR(50),
    execution_time_ms INTEGER
);

-- User prompts
CREATE TABLE prompt_events (
    event_id UUID PRIMARY KEY REFERENCES events(event_id),
    prompt_text TEXT NOT NULL,
    additional_context TEXT,
    was_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT
);

-- Notifications
CREATE TABLE notification_events (
    event_id UUID PRIMARY KEY REFERENCES events(event_id),
    message TEXT NOT NULL,
    notification_type VARCHAR(50) -- permission, idle, etc.
);

-- Session lifecycle events
CREATE TABLE lifecycle_events (
    event_id UUID PRIMARY KEY REFERENCES events(event_id),
    trigger_source VARCHAR(20), -- manual, auto, startup, resume, clear
    custom_instructions TEXT,
    additional_context TEXT,
    stop_hook_active BOOLEAN
);

-- Project context snapshots
CREATE TABLE project_context (
    context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    current_directory TEXT,
    file_tree JSONB,
    git_status JSONB,
    environment_vars JSONB, -- sanitized
    transcript_path TEXT
);
```

### Data Collection Specifications

#### Hook Input Processing
- **Common Fields**: Extract `session_id`, `transcript_path`, `cwd`, `hook_event_name`
- **Tool Events**: Parse `tool_name`, `tool_input`, `tool_response` (for PostToolUse)
- **MCP Tool Detection**: Identify `mcp__<server>__<tool>` patterns
- **Timestamp Precision**: Use microsecond precision for performance analysis

#### Tool Usage Tracking
- **Pre-execution**: Tool parameters, user context, project state
- **Post-execution**: Results, error messages, execution time
- **Tool Classification**: Built-in vs MCP tools, tool category analysis
- **Performance Metrics**: Latency distribution, success rates by tool type

#### User Interaction Data
- **Prompt Analysis**: Length, complexity, intent classification
- **Context Injection**: Track additional context added by hooks
- **Validation Results**: Security checks, policy compliance
- **User Behavior**: Prompt patterns, session duration

#### Project State Monitoring
- **File System Changes**: Track through Read/Write/Edit tool usage
- **Git Integration**: Branch changes, commit context
- **Environment Context**: Project dependencies, configuration changes
- **Session Continuity**: Resume patterns, context preservation

### Technical Implementation

#### Hook Script Architecture
```python
# Base hook class
class BaseHook:
    def __init__(self):
        self.db_client = self._init_database()
        self.session_data = self._load_session_context()
    
    def process_hook(self, stdin_data: dict) -> dict:
        # Common processing logic
        # Event-specific processing in subclasses
        # Database persistence with fallback
        pass
    
    def _init_database(self):
        # Supabase client with SQLite fallback
        pass
```

#### Configuration Management
- **Environment Detection**: Automatically detect dev/prod/local environments
- **Database Failover**: Seamless switch to SQLite when Supabase unavailable
- **Privacy Controls**: Configurable PII filtering and data masking
- **Performance Tuning**: Async operations, connection pooling

#### Error Handling & Resilience
- **Hook Isolation**: Failures in one hook don't affect others
- **Graceful Degradation**: Continue operation when database unavailable
- **Retry Logic**: Exponential backoff for transient failures
- **Monitoring**: Hook execution metrics and alerting

#### Security & Privacy
- **Data Sanitization**: Remove API keys, passwords, personal information
- **Path Validation**: Prevent directory traversal attacks
- **Input Validation**: Sanitize all JSON inputs from Claude Code
- **Audit Logging**: Track all hook executions and data access

### Performance Requirements
- **Hook Execution**: < 100ms overhead per hook call
- **Database Operations**: Asynchronous writes, batch inserts
- **Memory Usage**: < 50MB per hook process
- **Disk I/O**: Efficient SQLite operations for local fallback

### Installation & Deployment

#### Package Structure
```
claude-code-observability/
├── hooks/
│   ├── pre_tool_use.py
│   ├── post_tool_use.py
│   ├── user_prompt_submit.py
│   ├── notification.py
│   ├── session_start.py
│   ├── stop.py
│   ├── subagent_stop.py
│   └── pre_compact.py
├── lib/
│   ├── database.py
│   ├── models.py
│   └── utils.py
├── config/
│   ├── settings.json.template
│   └── schema.sql
└── install.py
```

#### Installation Process
1. **Dependencies**: Install via `uv` for fast dependency resolution
2. **Database Setup**: Automated Supabase schema creation
3. **Hook Registration**: Automatic `.claude/settings.json` configuration
4. **Validation**: Test hook execution with sample data

#### Claude Code Settings Template
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/post_tool_use.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/user_prompt_submit.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/notification.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/subagent_stop.py",
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre_compact.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Output Specifications

#### JSON Response Format
```python
# Example hook output for advanced control
{
    "continue": True,  # Whether Claude should continue
    "suppressOutput": False,  # Hide from transcript
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",  # allow, deny, ask
        "permissionDecisionReason": "Auto-approved documentation read"
    }
}
```

#### Exit Code Standards
- **0**: Success, continue execution
- **2**: Blocking error, show stderr to Claude
- **Other**: Non-blocking error, show stderr to user

### Integration Points

#### MCP Tool Support
- **Pattern Matching**: Support `mcp__<server>__<tool>` naming
- **Server Identification**: Extract MCP server names from tool names
- **Capability Tracking**: Monitor MCP tool availability and usage

#### Git Integration
- **Branch Tracking**: Monitor git branch changes during sessions
- **Commit Context**: Capture commit messages and file changes
- **Repository State**: Track working directory status

#### File System Monitoring
- **Change Detection**: Monitor file modifications through tool usage
- **Content Analysis**: Basic file type and size tracking
- **Permission Tracking**: Monitor file access patterns

This system provides comprehensive observability into Claude Code agent behavior while maintaining performance and reliability standards.