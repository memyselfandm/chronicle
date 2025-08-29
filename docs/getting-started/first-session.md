# Your First Chronicle Session

> **Master the Chronicle dashboard interface and discover powerful observability features**

This guide walks you through your first Claude Code session with Chronicle monitoring, helping you understand what you're seeing and how to use Chronicle's powerful observability features.

## Prerequisites

Before starting, ensure:
- Chronicle is installed and running (see [Installation Guide](./installation.md))
- Dashboard is accessible at http://localhost:3000
- Connection status shows green "Connected" indicator

## Starting Your First Monitored Session

### Step 1: Launch Claude Code with Chronicle Active

```bash
# Navigate to any project directory
cd ~/your-project

# Start Claude Code (Chronicle automatically monitors)
claude-code
```

**What Happens Behind the Scenes:**
- Chronicle's `session_start.py` hook triggers
- A new session record is created in the SQLite database
- The dashboard detects the new session via real-time polling
- Session appears in the left sidebar within 1-2 seconds

### Step 2: Watch the Dashboard Come Alive

Open the Chronicle dashboard at http://localhost:3000. You should immediately see:

1. **New Session Badge** - Green indicator appears in left sidebar
2. **Session Details** - Project path, git branch (if available), start time
3. **Live Metrics** - Header shows "1 Active Session"

## Understanding the Dashboard Interface

### Header Bar Components

```
[Chronicle] [🟢 Connected] [📊 Metrics] [⚙️ Settings]
```

- **🟢 Connection Status**: 
  - Green = Connected to local database
  - Red = Database connection failed
  - Yellow = Connecting/retrying

- **📊 Live Metrics**:
  - **Events/min**: Current activity rate
  - **Total Events**: Events in current session
  - **Active Sessions**: Currently running Claude Code instances

- **⚙️ Session Info**: Click to see current session details

### Left Sidebar Deep Dive

#### Active Sessions Panel
```
🟢 Active Sessions (1)
├── 📁 your-project-name
│   ├── Branch: main (if git repo)
│   ├── Started: 2:34 PM
│   └── Events: 0 → 23 (live counter)
```

**Session Information:**
- **Project Name**: Extracted from directory path
- **Git Branch**: Current branch (if project is a git repo)
- **Start Time**: When Claude Code was launched
- **Event Count**: Live counter of captured events

#### Session History Panel
```
📚 Recent Sessions
├── 📁 previous-project (2 hours ago)
├── 📁 another-project (yesterday)
└── 📁 old-project (3 days ago)
```

**Click any historical session to:**
- Browse its event history
- Analyze past coding patterns
- Compare session productivity
- Export session data

#### Filter Controls
```
🔍 Filters
├── 🟡 Prompts (12)
├── 🔧 Tool Use (45) 
├── 🟢 Session Events (3)
└── 📁 Project: your-project ×
```

**Filter Types:**
- **Event Type**: Prompt, Tool Use, Session events
- **Project**: Focus on specific project sessions
- **Time Range**: Last hour, day, week, custom
- **Search**: Text search within event content

### Main Event Feed

The central event feed shows real-time Claude Code activity:

#### Event Types You'll See

**🟡 User Prompts**
```
2:35:14 PM | Prompt | You: "Read the package.json file"
├── Type: UserPromptSubmit
├── Content: Your message to Claude Code
└── Session: your-project-session-id
```

**🔧 Tool Use Events**
```  
2:35:15 PM | Tool Use | Read
├── Tool: Read
├── File: /path/to/package.json
├── Status: Success
└── Duration: 12ms
```

**🟢 Session Events**
```
2:35:00 PM | Session Start | your-project
├── Type: SessionStart  
├── Project: /Users/you/your-project
├── Git Branch: main
└── Environment: Local development
```

#### Event Detail Modal

Click any event to see comprehensive details:

**Prompt Event Details:**
- Full message content
- Timestamp and session context
- Associated tool uses that followed
- Performance metrics

**Tool Use Event Details:**
- Tool name and parameters
- Input/output data (sanitized for privacy)
- Execution time and status
- Error details (if failed)

## First Session Walkthrough

Let's create some typical events to see Chronicle in action:

### Generate Different Event Types

**1. File Reading (Tool Use Events)**
```
In Claude Code, type:
"Read the README.md file in this project"
```

**What you'll see:**
- `UserPromptSubmit` event for your request
- `Read` tool use event showing file access
- Response time metrics
- File content handling (sanitized)

**2. Command Execution (Tool Use Events)**
```
In Claude Code, type:
"List all Python files in this directory"
```

**What you'll see:**
- `Bash` or `Glob` tool use events
- Command execution details
- Output handling and sanitization
- Performance timing

**3. Code Writing (Multiple Events)**
```
In Claude Code, type:
"Create a simple Python script that prints 'Hello World'"
```

**What you'll see:**
- `UserPromptSubmit` for your request
- `Write` tool use for file creation
- Possible `Read` events for verification
- All timing and data flow captured

### Observing Real-Time Updates

As you interact with Claude Code:

1. **Event Stream**: New events appear instantly in the main feed
2. **Auto-Scroll**: Feed automatically scrolls to newest events (toggle available)
3. **Live Counters**: Sidebar metrics update in real-time
4. **Session Timer**: Active session shows elapsed time

## Advanced Dashboard Features

### Session Management

**Switch Between Sessions:**
- Click different sessions in sidebar to explore their events
- Each session maintains separate event history
- Quick comparison between project sessions

**Session Status Indicators:**
- 🟢 **Active**: Currently running Claude Code instance
- 🔵 **Complete**: Cleanly terminated session
- 🔴 **Error**: Session ended with errors
- ⚪ **Unknown**: Status unclear (rare)

### Event Analysis

**Performance Insights:**
- Tool execution times
- Event frequency patterns  
- Session productivity metrics
- Error rate tracking

**Content Analysis:**
- Most frequently used tools
- Project file access patterns
- Command execution history
- Error and retry patterns

### Search and Filtering

**Text Search:**
```
Search: "package.json"
Results: All events mentioning package.json
- File reads, edits, references
- Across all sessions and time periods
```

**Time Range Filtering:**
- Last 15 minutes (default for active sessions)
- Last hour, day, week
- Custom date/time ranges
- Session-specific time slicing

**Advanced Filters:**
- Combine multiple filter types
- Exclude specific event types
- Focus on error events only
- Performance-based filtering (slow operations)

## Understanding Event Data

### Data Sanitization

Chronicle protects your privacy by default:

**What's Sanitized:**
- Personal file paths → `/Users/****/project`
- API keys and tokens → `***REDACTED***`
- Large file contents → `[Content truncated: 2.1KB]`
- Sensitive command output → Filtered automatically

**What's Preserved:**
- Tool usage patterns
- Performance metrics
- Error types and frequencies
- Project structure insights

### Event Relationships

Chronicle shows relationships between events:

**Event Chains:**
1. User asks question → `UserPromptSubmit`
2. Claude reads files → Multiple `Read` events  
3. Claude executes commands → `Bash` events
4. Claude writes code → `Write` events
5. User provides feedback → Next `UserPromptSubmit`

**Session Context:**
- All events linked to originating session
- Project context preserved across events
- Git branch and commit tracking (when available)

## Common First-Time Questions

### "Why Don't I See All My Commands?"

Chronicle only captures events that go through Claude Code's tool system:
- ✅ **Captured**: File reads, writes, searches, command execution via Claude Code
- ❌ **Not Captured**: Direct terminal commands, manual file edits, browser activity

### "Can I See What Claude Code Actually Read?"

Yes, but with privacy protection:
- Small files: Full content visible (if not sensitive)
- Large files: Truncated preview with size information
- Sensitive content: Automatically redacted
- Raw data available in SQLite database if needed

### "How Much Storage Does This Use?"

Chronicle is designed to be lightweight:
- Typical session: 1-5MB of database storage
- Average event: 1-10KB depending on content
- Automatic cleanup options available
- Database grows gradually with usage

### "Is My Data Private?"

Absolutely:
- Everything stored locally in SQLite database
- No data sent to external servers
- Automatic PII filtering enabled by default
- You control all data retention and deletion

## Troubleshooting First Session Issues

### No Events Appearing

**Check Hook Integration:**
```bash
# Verify hooks are registered
cat ~/.claude/settings.json | jq .hooks

# Test hook manually
cd ~/.claude/hooks/chronicle/hooks
echo '{"session_id":"test","tool_name":"Read"}' | python pre_tool_use.py
```

### Dashboard Shows "Disconnected"

**Check Database Connection:**
```bash
# Verify database exists
ls -la ~/.claude/hooks/chronicle/server/data/chronicle.db

# Test database access
sqlite3 ~/.claude/hooks/chronicle/server/data/chronicle.db ".tables"
```

### Events Missing Details

**Check Privacy Settings:**
```bash
# View current privacy settings
grep -E "(SANITIZE|PII)" ~/.claude/hooks/chronicle/hooks/.env

# Temporarily disable for debugging (not recommended for regular use)
# SANITIZE_DATA=false
# PII_FILTERING=false
```

### Performance Issues

**Optimize Settings:**
```bash
# Edit performance settings
nano ~/.claude/hooks/chronicle/hooks/.env

# Reduce data capture for better performance
MAX_INPUT_SIZE_MB=1
HOOK_TIMEOUT_MS=50
```

## Next Steps

Now that you understand Chronicle's interface:

1. **Explore Session History** - Look at past sessions to see patterns
2. **Try Advanced Filtering** - Use search and filters to find specific events
3. **Monitor Performance** - Watch for slow operations and errors
4. **Customize Settings** - Adjust privacy and performance settings
5. **Learn Advanced Features** - Explore the [Configuration Reference](../reference/configuration.md)

## Pro Tips for Daily Use

### Efficient Session Management
- Keep Chronicle running in background
- Use multiple terminal windows - one for Claude Code, one for Chronicle
- Name your project directories clearly for better session identification

### Effective Event Monitoring
- Enable auto-scroll for live monitoring
- Use filters to focus on specific activity types
- Click events to understand Claude Code's decision process

### Performance Optimization
- Monitor tool execution times to identify slow operations
- Watch for repeated operations that could be optimized
- Use error events to identify and fix recurring issues

### Privacy Best Practices
- Keep default sanitization enabled
- Regular review sensitive project sessions
- Use custom database location for extra isolation if needed

Chronicle is now an integrated part of your Claude Code workflow, providing unprecedented visibility into your AI-assisted development process. The more you use it, the more patterns and insights you'll discover about your coding habits and Claude Code's behavior.