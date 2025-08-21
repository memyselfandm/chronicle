# Iteration 2 Feedback Summary

## Overall Themes
- Headers are successfully condensed (good progress from iteration 1)
- Sidebar approach for session management shows promise
- Horizontal timeline/swimlane concepts need refinement
- Event feed alignment and color coding need consistency
- Connection status indicator not critical (live feed indicates connection)
- Focus should be on actionable information, not just monitoring

## Variant-Specific Feedback

### Variant 1 ⭐ (Good Foundation)
**Strengths:**
- Condensed header with useful metrics
- Dense, compact session cards
- Dropdown filters with pause button

**Concerns:**
- "Resume" buttons unclear (monitoring vs control interface)
- Activity overview bar graph not useful - needs true timeline
- Table columns misaligned in event feed
- Lacks color coding for visual scanning
- Icons unclear (FM = file manager?)

### Variant 2 ✅ (Best Overall Structure)
**Strengths:**
- **Sidebar approach excellent for session management**
- **Automatic expansion for sub-agents would be ideal**
- **Well-aligned, readable event feed**
- **Indentation showing event groupings (pre/post tool use)**
- Good drill-down into sub-agents

**Improvements Needed:**
- Sessions awaiting input should bubble to top
- Enable multi-select filtering from sidebar
- Color coding purpose unclear

### Variant 3 ⭐ (Good Concepts, Needs Polish)
**Strengths:**
- Swimlane concept for instances
- Color coding for waiting/active status
- Hover tooltips for tool abbreviations
- Potential for high scannability if refined

**Concerns:**
- Visual elements confusing (containers, colors, letters)
- Needs iconography instead of letters
- Sub-agents need indented swimlanes
- Static height may be good to prevent bouncing
- Needs to handle 30-40+ tool calls per sub-agent

### Variant 4 ❌ (Least Favorite)
**Strengths:**
- Contains event feed in bounded area

**Concerns:**
- "Agents Needing Input" too prominent/alarming (red)
- Status board takes too much space
- Pending response queue buried at bottom
- Trying to do too many things poorly
- All elements done better in other variants

### Variant 5 ⭐ (Mixed Results)
**Strengths:**
- Compact "sessions needing input" with yellow (not red)
- Nice table design with good contrast
- Session pills (S1, S2) for identification
- Git branch info shown

**Concerns:**
- Emoji icons not professional (need Material icons)
- Single line of icons won't scale
- Grouping logic unclear
- Groups should pin to top if awaiting input

### Variant 6 ✅ (Perfect for Mobile)
**Strengths:**
- Excellent for mobile view or Chrome extension
- Good information prioritization
- Clean, minimal approach

**Concerns:**
- Too minimal for main dashboard
- Better suited for constrained views

## Core Design Principles for Next Iteration

### 1. **Information Hierarchy**
```
Priority 1: Sessions awaiting input (actionable)
Priority 2: Active tool usage (current state)
Priority 3: Recent completions (context)
Priority 4: Historical data (reference)
```

### 2. **Sidebar + Main View Pattern**
- **Left sidebar**: Session/instance management with drill-down
- **Main area**: Switchable between timeline and event feed
- **Sessions awaiting input**: Bubble to top of sidebar
- **Multi-select filtering**: Click sessions/sub-agents to filter main view

### 3. **Timeline/Swimlane Requirements**
- **Horizontal streaming**: Real-time movement showing activity
- **Instance swimlanes**: One per Claude Code instance
- **Sub-agent indentation**: Nested swimlanes that expand/collapse
- **Visual condensation**: Represent 30-40 tools in compact form
- **Click interactions**: Drill down or filter event feed
- **Iconography over text**: Consistent icon set (Material/Font Awesome)

### 4. **Event Feed Standards**
- **Column alignment**: Strict table structure
- **Color coding**: Consistent semantic colors
  - Green: Success/Active
  - Yellow: Awaiting input
  - Red: Errors only
  - Blue: Information/Tool use
- **Event grouping**: Visual indentation for related events
- **Dense rows**: Maintain iteration 1 variant 1 density
- **Tool names**: Always visible

### 5. **Session Identification**
Instead of raw session IDs, show:
- Project/folder name
- Git repo and branch
- Instance nickname/number
- Current status icon

### 6. **Filtering Philosophy**
- **Multi-select dropdowns**: Events, sessions, instances
- **Project-based filtering**: By folder/repo
- **Sidebar selection**: Click to filter main view
- **Persistent filters**: Remember user preferences

### 7. **Actionable vs Monitoring**
- **Actionable elements**: Prominent, yellow indicators
- **Monitoring elements**: Subdued, informational
- **No control actions**: This is monitoring, not control
- **Focus on unblocking**: What needs human intervention?

### 8. **Visual Design Rules**
- **Dark theme**: Maintain consistency
- **Professional icons**: No emojis, use icon fonts
- **Semantic colors**: Consistent meaning across all elements
- **Bounded areas**: Contain scrolling regions
- **Right-aligned data**: Numbers and metrics right-aligned in headers

## Recommended Approach for Iteration 3

### Primary View: "Sidebar + Timeline + Feed"
1. **Left Sidebar** (200-250px)
   - Sessions list with status
   - Awaiting input bubbled to top
   - Click to filter/focus
   - Sub-agent drill-down

2. **Center Timeline** (collapsible, 200-300px height)
   - Horizontal swimlanes per instance
   - Real-time streaming
   - Sub-agent indentation
   - Icon-based tool representation
   - Click for details/filtering

3. **Bottom Event Feed** (remaining space)
   - Dense, aligned table
   - Color-coded rows
   - Filtered by sidebar selection
   - Grouping via indentation

### Secondary Views (for different use cases)
- **Mobile/Extension**: Variant 6 approach
- **Multi-instance Scale**: Enhanced variant 2 sidebar
- **Quick Glance**: Compressed timeline only

### Key Innovations to Explore
1. **Auto-expanding sub-agents** in sidebar
2. **Pinned notifications** for awaiting input
3. **Visual tool sequence compression** (e.g., "R→E→W×5" for Read→Edit→Write×5)
4. **Project-based organization** over session IDs
5. **Keyboard shortcuts** for power users

## Critical Success Factors
- Must handle 10-30 instances without overwhelming
- Sessions awaiting input must be immediately visible
- Timeline must show real-time activity flow
- Event feed must remain dense but scannable
- All interactions should filter/focus, not control

The sweet spot appears to be combining Variant 2's sidebar structure with Variant 3's swimlane concept, while maintaining Variant 1's density and adding proper visual hierarchy and actionable element prioritization.

---

## Chronicle Data Model Reference

### Event Data Structure

Every Chronicle event contains these fields:

```typescript
interface BaseEvent {
  id: string;                    // UUID unique identifier
  session_id: string;             // UUID linking to session
  event_type: string;             // One of 9 event types (see below)
  timestamp: string;              // ISO 8601 timestamp
  metadata: Record<string, any>; // Event-specific data (JSONB)
  tool_name?: string;             // For tool-related events only
  duration_ms?: number;           // Execution time for tools
  created_at: string;             // Database timestamp
}
```

### Session Data Structure

Sessions represent Claude Code instances:

```typescript
interface Session {
  id: string;                     // UUID unique identifier
  claude_session_id: string;      // Original Claude session ID
  project_path?: string;          // e.g., "/Users/dev/chronicle-dashboard"
  git_branch?: string;            // e.g., "main", "feature/new-ui"
  start_time: string;             // Session start timestamp
  end_time?: string;              // null if still active
  metadata: Record<string, any>;  // Additional session data
  created_at: string;             // Database timestamp
}
```

### Event Types (9 Total)

1. **session_start** - New Claude Code session begins
   - Includes: project_path, git_branch, platform, user_agent

2. **user_prompt_submit** - User submits a request
   - Includes: prompt text, prompt_length, cwd

3. **pre_tool_use** - Before tool execution
   - Includes: tool_name, tool_input parameters
   - **Special**: When tool_name="Task", this launches a sub-agent

4. **post_tool_use** - After tool execution
   - Includes: tool_name, duration_ms, success/error status, result

5. **notification** - User input required
   - Includes: message, notification_type, requires_response, priority
   - **Important**: Sessions with last event as notification are "awaiting input"

6. **stop** - Main agent execution completes
   - Includes: stop_reason, final_status, execution_time_ms

7. **subagent_stop** - Sub-agent task completes
   - Includes: subagent_task, task_result, execution_time_ms

8. **pre_compact** - Context compaction begins
   - Includes: trigger, context_size, threshold_reached

9. **error** - Execution errors
   - Includes: error_code, error_message, stack_trace, recoverable

### Claude Code Tools

Common tools that appear in tool_name field:

**File Operations:**
- `Read` - Read file contents
- `Write` - Write new file
- `Edit` - Edit existing file
- `MultiEdit` - Multiple edits in one operation

**Search & Navigation:**
- `Glob` - File pattern matching
- `Grep` - Search file contents
- `LS` - List directory contents

**Execution:**
- `Bash` - Run shell commands
- `Task` - **Launch sub-agent** (critical for hierarchy)

**Web Operations:**
- `WebFetch` - Fetch web content
- `WebSearch` - Search the web

**Notebook Operations:**
- `NotebookRead` - Read Jupyter notebooks
- `NotebookEdit` - Edit notebook cells

**Task Management:**
- `TodoRead` - Read task list
- `TodoWrite` - Update task list

### Event Lifecycle Patterns

**1. Tool Execution Lifecycle:**
```
pre_tool_use (tool_name="Read") 
  → post_tool_use (tool_name="Read", duration_ms=245)
```

**2. User Request Lifecycle:**
```
user_prompt_submit 
  → pre_tool_use/post_tool_use pairs 
  → stop
```

**3. Sub-agent Lifecycle:**
```
pre_tool_use (tool_name="Task") 
  → [sub-agent's own events] 
  → subagent_stop
```

**4. Session Awaiting Input:**
```
[any events] 
  → notification (requires_response=true)
  [no further events until user responds]
```

### Key Relationships for UI

1. **Paired Events**: pre_tool_use and post_tool_use with same tool_name are paired
2. **Sub-agent Hierarchy**: Events between Task tool and subagent_stop belong to sub-agent
3. **Session Status**: 
   - Active: Has recent events, no end_time
   - Awaiting Input: Last event is notification
   - Completed: Has end_time or stop event
4. **Project Context**: Use project_path and git_branch for meaningful session names, not session_id

### Important Metadata Fields

**user_prompt_submit metadata:**
- `prompt`: The actual user request text
- `cwd`: Current working directory
- `transcript_path`: Session history location

**pre_tool_use metadata:**
- `tool_input`: Parameters passed to tool
- `cwd`: Execution directory

**post_tool_use metadata:**
- `tool_response.success`: Boolean success indicator
- `tool_response.result`: Execution result summary
- `tool_response.content_length`: For file operations

**notification metadata:**
- `message`: What the user needs to know
- `notification_type`: "permission_request", "confirmation", etc.
- `requires_response`: If true, session is blocked

**error metadata:**
- `error_code`: System error code
- `error_message`: Human-readable error
- `context.tool_name`: Which tool failed

### Data Volume Expectations

- **High-frequency tools**: Read, Edit, Bash can generate 30-50+ events per minute
- **Sub-agents**: Can spawn 2-3 levels deep, each generating dozens of events
- **Sessions**: 10-30 concurrent instances in enterprise settings
- **Event rate**: Peak of 100-200 events/minute across all instances
- **Notification frequency**: 1-5 per session requiring user intervention

This data model information should help designers create accurate, realistic mockups that align with actual Chronicle data structures.