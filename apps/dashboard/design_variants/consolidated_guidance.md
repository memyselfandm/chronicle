# Chronicle Dashboard - Consolidated Design Guidance

## Purpose
This document consolidates feedback from all three iterations into clear, actionable guidance for creating the penultimate Chronicle Dashboard design. It represents the evolution of requirements from initial exploration through refinement to final guidelines.

---

## Core Design Philosophy

### Primary Purpose
**This is a MONITORING tool** where efficient unblocking is an integral part of effective monitoring, not a separate concern. The dashboard must enable users to:
- Monitor what Claude Code instances are doing in real-time
- Quickly identify which instances need input to be unblocked
- Maintain awareness across 10-30 concurrent instances
- Understand temporal patterns and tool sequences

### What This Is NOT
- Not a pattern analysis tool
- Not an anomaly detection system
- Not a control interface (monitoring only)
- Not a data visualization experiment

---

## MUST HAVE - Non-Negotiable Requirements

These elements have been validated across all iterations and must be included:

### 1. Layout Architecture

#### Sidebar (200-250px, Toggleable)
- **Project-based grouping** - Sessions organized by project_path, not arbitrary containers
- **Dynamic ordering** - Sessions awaiting input automatically bubble to top
- **Visual status indicators** - Green (active), Yellow (awaiting), Gray (idle)
- **Multi-select filtering** - Click to filter main view, Ctrl/Cmd for multiple
- **Sub-agent hierarchy** - Expandable/collapsible nested structure
- **No separate containers** - Single unified list, not awaiting/active/idle buckets

#### Header (32-40px)
- **Title left** - "Chronicle Dashboard"
- **Connection status right** - Simple dot indicator (not critical but nice)
- **Key metrics** - Active sessions, awaiting count, events/min
- **Minimal height** - Maximum space for content

#### Timeline/Swimlanes (200-300px, Collapsible)
- **One swimlane per session** - Clear horizontal lanes
- **Material icons only** - Professional icon set, no letters or emojis
- **Sub-agent indentation** - Visual hierarchy for nested agents
- **Transparent icon boxes** - Handle overlaps gracefully
- **Time markers** - Every 30s with zoom controls
- **Project/branch labels** - Never raw session IDs

#### Event Feed (Remaining Space)
- **Dense rows** - 20-25px height (I1V1 standard)
- **Proper alignment** - Strict column structure
- **Tool names visible** - Critical requirement from I1
- **Icons + indentation** - I2V2's successful approach
- **Event lifecycle grouping** - Pre/post tool use pairs

### 2. Visual Design Standards

#### Color Coding (Semantic & Consistent)
- **Green** - Success, Active, Running
- **Yellow** - Awaiting input, Needs attention
- **Red** - Errors only (not warnings)
- **Blue** - Tool use, Information
- **Gray** - Idle, Inactive

#### Typography & Icons
- **Material Icons throughout** - No letters (R,E,W), no emojis
- **Monospace for data** - Event details, timestamps
- **Sans-serif for UI** - Headers, labels
- **Professional dark theme** - #0f1419 background, #1a1f2e cards

### 3. Data & Interactions

#### Filtering System
- **Multi-select dropdowns** - Events, sessions, projects
- **Sidebar click-to-filter** - Direct selection
- **Project-based organization** - Use project_path and git_branch
- **Persistent filter state** - Remember user preferences

#### Real-time Updates
- **Live data streaming** - No static mockups
- **Smooth transitions** - No jarring updates
- **Performance optimized** - Handle 100-200 events/min

#### Chronicle Data Model
- **All 9 event types** - Properly represented
- **Task tool = sub-agent** - Critical relationship
- **Notification = awaiting** - Last event determines status
- **Project context** - Always show project_path and git_branch

---

## SHOULD INCLUDE - Proven Enhancements

These features have shown value and should be refined for inclusion:

### Visual Enhancements
- **Timeline key/legend** - But compact and unobtrusive
- **Hover tooltips** - For additional context without clutter
- **Currently running indicators** - Subtle animation (I2V2 style)
- **Visual tool compression** - Better than "T×5" notation

### Interaction Patterns
- **Keyboard shortcuts** - j/k navigation, number keys for filters
- **Click-and-drag time selection** - In timeline for zoom
- **Jump to now button** - Quick navigation
- **Collapsible sections** - Timeline and sidebar both toggleable

### Session Management
- **Compact session cards** - If grid view used: 80-100px height, 5x4 grid
- **Auto-expanding sub-agents** - When activity detected
- **Session search/filter** - Quick find in sidebar

---

## MUST AVOID - Failed Patterns

These have been definitively rejected through iteration feedback:

### Visual Anti-Patterns
- **Letter-based icons** (R, E, W, B, G) - Failed in I3
- **Emoji icons** - Unprofessional
- **Bar charts/graphs** - Not useful (I1 feedback)
- **Excessive animations** - Distracting flickering
- **Random timeline animations** - Confusing movement
- **Three separate containers** - Awaiting/active/idle buckets
- **Radio button dots** - Insufficient for identification

### Layout Anti-Patterns
- **Large session cards** - Don't scale to 30 instances
- **Fixed non-toggleable sidebar** - Must be collapsible
- **Disconnected floating indicators** - Keep status attached
- **Heat maps** - Incomprehensible (I1V6)
- **Pattern analysis visualizations** - Wrong focus

### Technical Issues
- **Misaligned columns** - Must have proper table structure
- **Missing multi-select** - All filters need multiple selection
- **Static mockups** - Must have real-time data
- **Broken CSS layouts** - Professional quality required

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

---

## Evolution Through Iterations

### Iteration 1 Discoveries
- **I1V1 set the density standard** - 20-25px rows became the benchmark
- **Bar charts don't work** - Focus on timeline visualization instead
- **Dark theme preference** - Maintained throughout
- **Tool names critical** - Must always be visible

### Iteration 2 Refinements
- **I2V2 sidebar approach validated** - Best session management
- **Icons + indentation successful** - For event feed
- **Project grouping essential** - Not raw session IDs
- **Swimlanes show promise** - Need polish

### Iteration 3 Convergence
- **I3V2 best sidebar** - Project grouping with toggleability
- **I3V6 best timeline** - Swimlane structure closest to ideal
- **Material icons consensus** - Professional appearance
- **Monitoring focus clarified** - Not productivity or analysis

---

## Recommended Final Architecture

### Optimal Combination
1. **Start with I3V2's sidebar** - Project grouping, collapsible
2. **Use I3V6's swimlane timeline** - Best visual structure
3. **Apply I2V2's event feed** - Icons + indentation
4. **Maintain I1V1's density** - 20-25px rows
5. **Add transparent overlays** - From I3V4

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ Header (40px) │ Chronicle Dashboard │ Status • Stats │
├───────────────┼─────────────────────────────────────┤
│               │ Timeline/Swimlanes (200-300px)      │
│   Sidebar     │ ▶ project/branch ━━━━━━━━━━━━━━━━   │
│   (250px)     │ ▶ project/branch ━━━━━━━━━━━━━━━━   │
│   Toggleable  │ ▶ project/branch ━━━━━━━━━━━━━━━━   │
│               ├─────────────────────────────────────┤
│   Projects    │ Event Feed (Dense Table)            │
│   └Sessions   │ Time │ Type │ Tool │ Details        │
│   Filters     │ ──────────────────────────────────  │
│               │ [20-25px rows with alignment]       │
└───────────────┴─────────────────────────────────────┘
```

---

## Critical Success Metrics

The final design will be successful if it:

1. **Scales gracefully** to 30 Claude Code instances
2. **Makes awaiting input sessions immediately visible**
3. **Maintains information density** without overwhelming
4. **Uses consistent visual language** (Material icons, semantic colors)
5. **Provides efficient filtering** via sidebar and controls
6. **Shows real-time activity** with smooth updates
7. **Preserves dark theme** throughout
8. **Enables quick scanning** of system state
9. **Supports keyboard navigation** for power users
10. **Remains monitoring-focused** without control actions

---

## Summary for Designers

### The Formula
**I3V2 Sidebar + I3V6 Timeline + I2V2 Event Feed + I1V1 Density = Success**

### The Priorities
1. Sessions awaiting input (always visible)
2. Current activity (real-time timeline)
3. Event details (dense, scannable feed)
4. Historical context (filtered views)

### The Constraints
- 10-30 concurrent instances
- 100-200 events/minute peak
- Professional appearance (Material icons)
- Dark theme (#0f1419 background)
- Monitoring only (no control actions)

This represents the distilled wisdom from three iterations of design and feedback. The penultimate design should synthesize these requirements into a cohesive, professional monitoring tool for Chronicle.