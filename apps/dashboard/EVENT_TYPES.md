# Chronicle Event Types Reference

This document provides comprehensive documentation for all event types tracked by the Chronicle Dashboard, including their structure, when they're triggered, and example payloads.

## Overview

Chronicle tracks events throughout the lifecycle of Claude Code sessions, providing detailed observability into tool usage, user interactions, and system behavior. Events are stored in the `chronicle_events` table with real-time updates available through Supabase subscriptions.

## Event Schema

All events follow a common base structure with event-specific extensions:

```typescript
interface BaseEvent {
  /** Unique event identifier (UUID) */
  id: string;
  /** Session ID this event belongs to (UUID) */
  session_id: string;
  /** Event type category */
  event_type: EventType;
  /** Event timestamp (TIMESTAMPTZ) */
  timestamp: string;
  /** Event metadata (JSONB) */
  metadata: Record<string, any>;
  /** Tool name for tool-related events */
  tool_name?: string;
  /** Duration in milliseconds for tool events */
  duration_ms?: number;
  /** When record was created */
  created_at: string;
}
```

## Event Types

### session_start

Triggered when a new Claude Code session begins.

**When it occurs:**
- User starts a new Claude Code session
- Session is resumed after interruption
- Project context is initialized

**Fields:**
- `event_type`: `"session_start"`
- `metadata`: Session initialization details

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "session_start",
  "timestamp": "2025-08-18T10:30:00Z",
  "metadata": {
    "source": "startup",
    "project_path": "/Users/dev/chronicle-dashboard",
    "git_branch": "dev",
    "user_agent": "Claude Code v1.0",
    "platform": "darwin"
  },
  "created_at": "2025-08-18T10:30:00Z"
}
```

### pre_tool_use

Triggered immediately before a tool is executed.

**When it occurs:**
- Claude Code is about to execute any tool (Read, Write, Edit, Bash, etc.)
- Before tool parameters are processed
- Before any file system or external operations

**Fields:**
- `event_type`: `"pre_tool_use"`
- `tool_name`: Name of the tool being used
- `metadata`: Tool input parameters and context

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "pre_tool_use",
  "tool_name": "Read",
  "timestamp": "2025-08-18T10:31:15Z",
  "metadata": {
    "tool_input": {
      "file_path": "/src/components/EventCard.tsx",
      "parameters": {}
    },
    "transcript_path": "~/.claude/projects/chronicle/session.jsonl",
    "cwd": "/Users/dev/chronicle-dashboard"
  },
  "created_at": "2025-08-18T10:31:15Z"
}
```

### post_tool_use

Triggered after a tool execution completes.

**When it occurs:**
- Tool execution has finished (successfully or with errors)
- Response has been generated
- Results are available for processing

**Fields:**
- `event_type`: `"post_tool_use"`
- `tool_name`: Name of the tool that was used
- `duration_ms`: Tool execution time in milliseconds
- `metadata`: Tool response and results

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "post_tool_use",
  "tool_name": "Read",
  "duration_ms": 245,
  "timestamp": "2025-08-18T10:31:15.245Z",
  "metadata": {
    "tool_input": {
      "file_path": "/src/components/EventCard.tsx"
    },
    "tool_response": {
      "success": true,
      "result": "File read successfully",
      "content_length": 2543
    }
  },
  "created_at": "2025-08-18T10:31:15.245Z"
}
```

### user_prompt_submit

Triggered when a user submits a new prompt or request.

**When it occurs:**
- User types and submits a message in Claude Code
- New conversation turn begins
- Request is received for processing

**Fields:**
- `event_type`: `"user_prompt_submit"`
- `metadata`: Prompt content and session context

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "user_prompt_submit",
  "timestamp": "2025-08-18T10:30:30Z",
  "metadata": {
    "prompt": "Update the dashboard to show real-time events",
    "transcript_path": "~/.claude/projects/chronicle/session.jsonl",
    "cwd": "/Users/dev/chronicle-dashboard",
    "prompt_length": 45
  },
  "created_at": "2025-08-18T10:30:30Z"
}
```

### stop

Triggered when the main agent execution stops.

**When it occurs:**
- Request processing is complete
- Agent reaches a natural stopping point
- User interrupts execution
- Task completion

**Fields:**
- `event_type`: `"stop"`
- `metadata`: Stop reason and final status

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "stop",
  "timestamp": "2025-08-18T10:35:45Z",
  "metadata": {
    "stop_reason": "completion",
    "final_status": "completed",
    "execution_time_ms": 315000
  },
  "created_at": "2025-08-18T10:35:45Z"
}
```

### subagent_stop

Triggered when a subagent or background task completes.

**When it occurs:**
- Parallel task finishes execution
- Background process completes
- Subtask within larger workflow ends
- Worker agent finishes assigned work

**Fields:**
- `event_type`: `"subagent_stop"`
- `metadata`: Subagent task details and results

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "subagent_stop",
  "timestamp": "2025-08-18T10:33:20Z",
  "metadata": {
    "subagent_task": "code_review",
    "stop_reason": "task_completed",
    "task_result": "success",
    "execution_time_ms": 8500
  },
  "created_at": "2025-08-18T10:33:20Z"
}
```

### pre_compact

Triggered before conversation context compaction begins.

**When it occurs:**
- Context size reaches threshold requiring compaction
- Manual compaction is initiated
- Memory optimization is triggered
- Conversation history needs summarization

**Fields:**
- `event_type`: `"pre_compact"`
- `metadata`: Compaction trigger and context details

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "pre_compact",
  "timestamp": "2025-08-18T10:32:10Z",
  "metadata": {
    "trigger": "auto",
    "context_size": 45000,
    "custom_instructions": "",
    "threshold_reached": true
  },
  "created_at": "2025-08-18T10:32:10Z"
}
```

### notification

Triggered when user interaction or attention is required.

**When it occurs:**
- Permission needed for tool execution
- User confirmation required
- Session idle warnings
- Interactive prompts displayed

**Fields:**
- `event_type`: `"notification"`
- `metadata`: Notification message and type

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440007",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "notification",
  "timestamp": "2025-08-18T10:31:45Z",
  "metadata": {
    "message": "Claude needs your permission to use Bash",
    "notification_type": "permission_request",
    "requires_response": true,
    "priority": "high"
  },
  "created_at": "2025-08-18T10:31:45Z"
}
```

### error

Triggered when errors occur during execution.

**When it occurs:**
- Tool execution fails
- File system errors
- Network timeouts
- Validation failures
- Permission denied errors

**Fields:**
- `event_type`: `"error"`
- `metadata`: Error details and context

**Example payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440008",
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "error",
  "timestamp": "2025-08-18T10:31:50Z",
  "metadata": {
    "error_code": "ENOENT",
    "error_message": "File not found",
    "stack_trace": "Error: ENOENT: no such file or directory\\n  at Read.execute\\n  at process.nextTick",
    "context": {
      "tool_name": "Read",
      "file_path": "/src/missing-file.tsx"
    },
    "recoverable": false
  },
  "created_at": "2025-08-18T10:31:50Z"
}
```

## Database Schema

Events are stored in the `chronicle_events` table with the following structure:

```sql
CREATE TABLE chronicle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    tool_name VARCHAR(100),
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Event Relationships

- All events are associated with a session via `session_id`
- Tool events (`pre_tool_use`, `post_tool_use`) are paired by `tool_name` and timing
- Sessions begin with `session_start` and end with `stop` events
- Error events can occur at any point and include context for debugging
- Notification events require user interaction before processing can continue

## Usage Notes

1. **Real-time Updates**: Events are available immediately through Supabase real-time subscriptions
2. **Filtering**: Events can be filtered by type, session, date range, and tool name
3. **Analytics**: Duration and success metrics are available for tool events
4. **Debugging**: Error events include full stack traces and context for troubleshooting
5. **Performance**: Consider pagination when displaying large numbers of events