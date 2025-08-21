* Align on scope, goals, and MVP versus phased roadmap

* Specify architecture, design system, and component-level behavior

* Define data model, performance targets, and optimization strategies

* Detail UX flows, keyboard shortcuts, and real-time interactions

* Outline technical implementation, tracking, security, and deployment

* Provide acceptance criteria, owners, references, and anti-patterns

# PRD: Chronicle Dashboard Redesign

### TL;DR

Chronicle Dashboard enables operators to monitor 10–30 concurrent Claude Code instances in real time and quickly identify and unblock sessions awaiting user input. The MVP provides a dense, color-semantic event feed, a collapsible sidebar with preset filters, and a compact header with key metrics and connection status. The system targets smooth updates at 100–200 events per minute, prioritizing speed, clarity, and reliability.

---

## Goals

### Business Goals

* Reduce mean time to identify sessions requiring input to under 2 seconds (p95).

* Support stable real-time monitoring at 100–200 events/minute with zero dropped events at peak.

* Decrease operator overhead by enabling monitoring of 10–30 concurrent sessions from a single view.

* 

### User Goals

* Instantly see sessions that require input without extra navigation.

* Scan and filter dense information quickly with consistent semantic color cues.

* Maintain context while monitoring multiple sessions and sub-agents.

* Trust that data is live, accurate, and resilient to network hiccups.

### Non-Goals

* Executing actions or controls from the dashboard (monitoring-only).

* Light theme or complex data visualizations (e.g., charts, heat maps).

* Pattern analysis or historical analytics beyond recent event history.

---

## User Stories

Operators (primary persona: Operator/Engineer/AI Developer overseeing Claude Code instances):

* As an operator, I want to see all sessions awaiting input at the top, so that I can unblock them immediately.

* As an operator, I want to filter by preset states (All, Active, Awaiting), so that I can focus on the most relevant sessions.

* As an operator, I want to track 2–30 sessions concurrently, so that I can manage my workload effectively.

* As an operator, I want real-time event updates with optional auto-scroll, so that I can review recent activity without losing my place.

* As an operator, I want keyboard shortcuts for navigation and filtering, so that I can work faster with minimal mouse use.

Secondary personas:

* As a designer, I want consistent semantic color usage, so that status is understandable at a glance.

* As an admin, I want clear connection indicators, so that I know the health of real-time subscriptions.

---

## Functional Requirements

* Sidebar (Priority: High)

  * Awaiting Input section (pinned, dynamic height up to 40vh) auto-populates from all projects.

  * Collapsible project folders; awaiting sessions bubble to top; multi-select sessions with Cmd/Ctrl+click.

  * Preset filters: All, Active, Awaiting, Idle (compact buttons).

* Header (Priority: High)

  * Left: title “Chronicle Dashboard”, optional version.

  * Right-aligned metrics: activeSessions (green), awaitingSessions (yellow), eventRate; connection status dot + label; throughput with optional sparkline.

* Event Feed (Priority: High)

  * Chronological table, newest on top (prepend), no grouping in MVP.

  * Columns: time (85px, HH:mm:ss), session (140px folder/branch), type (110px badge), tool (90px colored), details (flex monospace).

  * Row styling with left border + subtle background based on semantic event type; optional auto-scroll toggle; sub-agent indentation (20px).

* Filters & Selection (Priority: Medium)

  * Preset filter buttons alter feed; single click session filters feed; multi-select sessions for combined view.

* Real-time Data (Priority: High)

  * Supabase real-time subscriptions for events; batched updates for performance; resilient reconnection.

* Accessibility & Input (Priority: Medium)

  * Keyboard shortcuts: j/k, 1/2/3, / (future), Escape, Space; focus management and ARIA labels for critical UI.

## User Experience

**Entry Point & First-Time User Experience**

* Access via Chronicle Dashboard URL; dark theme loads with default “All” preset filter.

* First-time tips: short inline hints on Awaiting Input and preset filters; no modal tutorial.

**Core Experience**

* Step 1: Review header metrics and connection status.

  * Clear at-a-glance numbers for active, awaiting, and event rate.

  * Connection dot: green/yellow/red; label shows Connected/Reconnecting/Disconnected.

* Step 2: Scan the Awaiting Input section (sidebar top).

  * Sessions needing input are pinned and visually distinct; capped at 40vh to prevent overwhelm.

  * Single click a session to filter the event feed; Cmd/Ctrl+click to multi-select.

* Step 3: Navigate project folders.

  * Expand/collapse to see sessions; awaiting sessions float to top of each folder.

  * Session items show folder/branch, status dot/icon, last activity, and event count.

* Step 4: Read the Event Feed.

  * Dense table with semantic left borders and subtle backgrounds; tool names always visible with colored badges.

  * Optional auto-scroll; when disabled, position is preserved while new events accumulate above.

* Step 5: Adjust filters.

  * Use preset filters (All, Active, Awaiting, Errors, Recent) for quick pivots; keyboard 1/2/3 for quick toggles.

* Step 6: Handle high-volume updates.

  * Updates are batched for smoothness; transitions at \~300ms; no visual flooding.

**Advanced Features & Edge Cases**

* Large number of awaiting sessions: Awaiting Input section caps at 40vh with internal scroll.

* Disconnection: Header shows Disconnected (red); attempts reconnection; events backfill on restore.

* Sub-agents: Indented events (20px) share the same styling rules; no grouping in MVP.

* Duplicate sessions: Suffix the last 4 chars of session_id in the session label.

**UI/UX Highlights**

* Dense layout for scanning 100–200 events/min without distraction.

* Semantic color coding: green (success/active), yellow (awaiting), gray (idle), red (errors), blue (tool/info), purple (special).

* Consistent spacing (row height \~24px; event feed monospace 13px) and alignment across columns.

* Accessible contrast, focus states, and responsive behavior from desktop to mobile.

---

## Narrative

Michael oversees a fleet of Claude Code instances running across multiple projects. Peaks of activity make it hard to know which sessions are healthy and which are blocked waiting for user input. He needs a single, reliable dashboard that surfaces the right sessions at the right time without visual noise.

With Chronicle Dashboard, awaiting sessions are pinned to the top of the sidebar, color-coded, and instantly filterable. The header gives Michael immediate confidence about system health and throughput, while the event feed provides dense, chronological context with consistent semantic cues. Real-time subscriptions, update batching, and optional auto-scroll keep the view smooth even at 200 events per minute. Keyboard shortcuts and compact UI afford quick triage across 10–30 sessions.

The result is faster unblocking, fewer dropped balls, and a calmer monitoring workflow. For the business, the improved throughput and reliability translate into higher task completion rates and reduced operator time per issue.

---

## Success Metrics

* Time to identify an awaiting session: under 2 seconds (p95).

* 0 dropped events at 200 events/minute peak during a 10-minute test.

* 60fps scroll performance in the event feed (lab test).

* Clean reconnect with no data loss in 100% of simulated network interrupts.

### User-Centric Metrics

* % of sessions identified and unblocked within 2 minutes.

### Business Metrics

* Operator throughput: average concurrent sessions monitored (target ≥ 3).

* Reduction in time-to-unblock (baseline vs. post-launch improvement ≥ 30%).

* Uptime of real-time monitoring (99.9% monthly).

### Technical Metrics

* Initial load time < 2 seconds (p90).

* Event processing latency < 100 ms (p95).

* Memory footprint < 100 MB on typical workloads.

## Technical Considerations

### Architecture Stack

* Frontend: Next.js 15.4.6 with TypeScript and App Router (existing)

* Backend: Supabase 2.55.0 (PostgreSQL + Real-time subscriptions configured)

* Styling: Tailwind CSS v4 with custom dark theme

* State Management: Zustand for global state (to be added)

* Data Fetching: SWR for caching and revalidation (to be added)

* Icons: Material Design Icons exclusively (to be added)

* Virtual Scrolling: react-window or @tanstack/virtual (to be added)

### Visual Design System

* Dark Theme Color Palette

  * Variable | Hex | Purpose

  * \--bg-primary | #0f1419 | Main background

  * \--bg-secondary | #1a1f2e | Card/panel backgrounds

  * \--bg-tertiary | #252a3a | Elevated elements

  * \--text-primary | #ffffff | Primary text

  * \--text-secondary | #a0a9c0 | Secondary text

  * \--text-muted | #6b7280 | Muted text

  * \--status-active | #10b981 | Green - Active/Success

  * \--status-awaiting | #f59e0b | Yellow - Awaiting input

  * \--status-idle | #6b7280 | Gray - Idle

  * \--status-error | #ef4444 | Red - Errors only

  * \--status-info | #3b82f6 | Blue - Tool use/Information

  * \--status-special | #8b5cf6 | Purple - Special events

  * \--border-color | #374151 | Borders and dividers

* Typography

  * Event Feed: 13px monospace for data, 20–25px row height

  * Sidebar: 12px for session items, 14px for headers

  * Header: 14px for metrics, 16px for title

* Forbidden Patterns

  * No letter-based icons, emoji icons, bar charts/graphs, heat maps, pattern analysis visualizations, control/action buttons, light theme, or radio-button dots for status.

* Rationale

  * Dense display maximizes information throughput per pixel for operators scanning high-volume streams.

  * Semantic colors reinforce status recognition speed and reduce cognitive load.

### Technical Needs

* Major components

  * Front-end components for Sidebar, Header, Event Feed, and common UI atoms (status dot, icons).

  * Real-time event subscription layer with batching and reconnection logic (partially exists).

  * Data models for sessions and events; in-memory caches (Zustand + SWR).

* Data Model (Chronicle System)

  * Database Tables (Existing)

    * `sessions` table with columns: id, claude_session_id, project_path, git_branch, start_time, end_time

    * `events` table with columns: id, session_id, event_type, timestamp, data (JSONB), tool_name, duration_ms

  * ChronicleEvent

    * id (UUID)

    * session_id (string - references sessions.id)

    * event_type (EventType)

    * timestamp (ISO 8601 string)

    * data (JSONB): Contains event-specific metadata

    * tool_name? (string - for tool events)

    * duration_ms? (integer - for tool execution time)

  * EventType (Chronicle Hooks Captured)

    * session_start - Claude Code session begins

    * user_prompt_submit - User submits request

    * pre_tool_use - Before tool execution (includes Task for sub-agents)

    * post_tool_use - After tool execution

    * notification - User input required

    * stop - Main agent execution completes

    * subagent_stop - Sub-agent task completes

    * pre_compact - Context compaction begins

    * error (captured in hooks, not in current dashboard types)

  * SessionDisplay

    * primaryLabel (folder name from project_path)

    * secondaryLabel (git branch or "no git")

    * duplicateSuffix? (last 4 chars of session_id)

    * Examples: "chronicle / main", "dashboard / feature-ui", "api-docs / main #a3f2", "scripts / no git"

  * Status Determination (getSessionStatus)

    * Find most recent event for session.

    * If last event is notification with data.requires_response=true → awaiting.

    * Else if time since last event < 30s → active.

    * Else → idle.

### Integration Points

* Chronicle Hooks System → Supabase → Dashboard

  * Python hooks in `~/.claude/hooks/` capture Claude Code events

  * Events sent to Supabase via Python client

  * Dashboard subscribes to real-time updates via WebSocket

* Existing Supabase Configuration

  * Tables: `sessions`, `events` with proper indexes

  * Real-time subscriptions limited to 5 events/sec (production) or 10 (dev)

  * Connection heartbeat: 30s, timeout: 60s

  * Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

* Monitoring & Analytics

  * Existing logger utility for structured logging

  * Health check scripts in place

  * Optional Sentry for error tracking

  * Optional Vercel Analytics for usage metrics

### Data Storage & Privacy

* No PII in event metadata.

* Obfuscate session IDs in UI (show last 4 chars only).

* Secure WebSocket for real-time.

* Optional data retention policies configurable per environment.

### Scalability & Performance

* Targets

  * Concurrent Sessions: 3–30

  * Event Throughput: 100–200 events/minute peak

  * In-memory event history: 1,000 most recent events

  * Update Frequency: smooth animations at 60fps

  * Initial Load: under 2 seconds

* Optimization Strategies

  * Virtual Scrolling for lists

    * itemHeight \~32px; overscan \~3; scroll debounce \~16ms.

  * Event Feed Performance

    * batchSize \~50; maxVisible \~100; updateBatching \~100ms; prepend render strategy.

  * Real-time Subscriptions

    * Subscribe to INSERT (and UPDATE if needed); batch events before state mutations; handle reconnect with backfill.

### Potential Challenges

* **Performance at Scale**
  * High-frequency UI thrashing without batching (mitigation: 100ms batch window)
  * Memory leaks with unbounded event arrays (mitigation: 1000 event limit with FIFO)
  * React re-render cascades (mitigation: memo and useCallback extensively)

* **Data Integrity**
  * Misclassification of "awaiting" if event semantics drift (mitigation: validate data.requires_response field)
  * Table name mismatch between hooks (sessions/events) and dashboard types (chronicle_sessions/chronicle_events)
  * Missing event types in TypeScript definitions (error type exists in hooks but not dashboard)

* **Real-time Reliability**
  * Reconnection edge cases causing duplicate or missing events (mitigation: idempotent merge by event.id)
  * WebSocket connection drops in corporate networks (mitigation: exponential backoff reconnect)
  * Rate limiting hitting 5 events/sec in production (mitigation: client-side buffering)

* **UI Consistency**
  * Keeping typography and spacing consistent across responsive breakpoints
  * Maintaining 24px row height with variable content
  * Color contrast in dark theme meeting WCAG AA standards

### Deployment

* **Development Environment**

  * Required Environment Variables:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=your_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
    NEXT_PUBLIC_ENVIRONMENT=development
    ```

  * Existing Scripts:
    ```bash
    npm run dev              # Next.js with Turbopack
    npm run validate:env     # Validate environment setup
    npm run validate:config  # Full config validation
    npm run health:check     # Test Supabase connection
    npm run test            # Run test suite
    ```

* **Production Deployment**

  * Platform: Vercel (Edge runtime recommended)
  
  * Build Commands:
    ```bash
    npm run build:production  # Production build
    npm run deployment:verify # Pre-deployment validation
    ```
  
  * Environment-Specific Builds:
    - Production: `NODE_ENV=production NEXT_PUBLIC_ENVIRONMENT=production`
    - Staging: `NODE_ENV=production NEXT_PUBLIC_ENVIRONMENT=staging`
  
  * Monitoring:
    - Sentry for error tracking (optional)
    - Existing structured logging via logger utility
    - Health check endpoint at `/api/health`
  
  * Security:
    - Environment validation on startup
    - Data sanitization via existing security utilities
    - CSP headers configured in next.config.ts

---

## Milestones & Sequencing

* MVP

  * Sidebar with preset filters (Awaiting Input section + folders).

  * Header with metrics and connection status.

  * Chronological event feed with semantic color coding; no grouping.

* Phase 1: Comprehensive Filters

  * Collapsible filter panel; multi-select by type/tool/project; save presets; URL sharing.

* Phase 2: Search

  * Full-text event search; session/project/branch search; highlight matches; recent search history.

* Phase 3: Tool Lifecycle Grouping

  * Group pre_tool_use/post_tool_use; collapsed summary with duration and success indicator.

* Phase 4: Timeline/Swimlanes

  * 5-minute rolling window; horizontal time markers; session swimlanes; sub-agent indentation.

* Phase 5: Sub-agent Visualization

  * Tree view; execution boundaries; parent-child lines; collapsible states.

### Suggested Phases (Lean)

* MVP (2 weeks)

  * Key Deliverables: Sidebar (awaiting + folders), Header (metrics + status), Event Feed (chronological, semantic colors), real-time subscription + batching.

  * Dependencies: Supabase tables and event streams available; Material Design Icons set.

* Phase 1 (1 week)

  * Key Deliverables: Comprehensive filters (multi-select), preset saving, URL sharing.

  * Dependencies: Filter schema in URL; persistence layer.

* Phase 2 (1 week)

  * Key Deliverables: Search UI + indexing; highlighting; recent searches.

  * Dependencies: Full-text search or client index.

* Phase 3 (1 week)

  * Key Deliverables: Tool lifecycle collapse/expand; duration badges.

  * Dependencies: Event correlation logic.

* Phase 4 (1–2 weeks)

  * Key Deliverables: Timeline with swimlanes and rolling window.

  * Dependencies: Time-series rendering; virtualized horizontal scroll.

* Phase 5 (1 week)

  * Key Deliverables: Sub-agent tree and execution boundaries.

  * Dependencies: Hierarchical event metadata.

---

## Component Specifications

### Sidebar (220px, Collapsible)

* Structure

  * Top (Awaiting Input)

    * Title: “Awaiting Input”; dynamic height; maxHeight 40vh; sessions aggregated from all projects.

  * Main (Scrollable project folders)

    * Collapsible folders per project; sorting: awaiting sessions bubble to top.

    * Folder label: projectName; sessionCount; awaitingCount (e.g., “5 (2 awaiting)”).

  * Bottom (Preset Filters)

    * Options: All, Active, Awaiting, Errors, Recent; compact button layout.

* Session Item Display

  * Visual label: “folder-name / branch #a3f2”

  * Fields: folderName; branchName (nullable); sessionIdSuffix? (last 4 chars for duplicates)

  * Status: dot (green|yellow|gray); optional Material icon by activity

  * Metadata: lastActivity (relative time); eventCount

* Interactions

  * Single click: filter event feed to session; Cmd/Ctrl+click: multi-select

  * Folder click: expand/collapse

  * Sidebar toggle: slide animation with main content resizing

### Header (40px Fixed)

* Left: title “Chronicle Dashboard”; optional version

* Right (right-aligned)

  * Metrics: activeSessions (green), awaitingSessions (yellow), eventRate “150/min”

  * Connection status: dot (green/yellow/red) + label “Connected/Reconnecting/Disconnected”

  * Throughput: value “152/min”; optional sparkline

### Event Feed (Remaining Space)

* Table Structure

  * Columns

    * time: 85px, format HH:mm:ss

    * session: 140px, format “folder/branch”

    * type: 110px, badge

    * tool: 90px, colored

    * details: flex, monospace

  * Row: height \~24px; padding \~8px x 12px

  * Color Coding (left border + subtle background)

    * user_prompt → border #8b5cf6, bg rgba(139,92,246,0.1)

    * pre_tool → border #3b82f6, bg rgba(59,130,246,0.1)

    * post_tool → border #10b981, bg rgba(16,185,129,0.1)

    * notification → border #f59e0b, bg rgba(245,158,11,0.1)

    * error → border #ef4444, bg rgba(239,68,68,0.1)

    * stop → border #6b7280, bg rgba(107,114,128,0.1)

* Display Rules

  * Newest events prepend to top; no grouping in MVP.

  * Sub-agent indentation: 20px; same styling rules.

  * Tool names always visible with semantic colors.

  * Auto-scroll toggle; when off, preserve scroll position.

---

## Performance Requirements

* Scale Targets

  * Concurrent Sessions: 3–30

  * Event Throughput: 100–200 events/min peak

  * Event History: up to 1,000 most recent events in memory

  * Initial Load: under 2 seconds

  * Animations: smooth at 60fps

* Optimization

  * Virtual Scrolling for session lists

    * itemHeight \~32px; overscan \~3; debounce \~16ms.

  * Event Feed Batching

    * batchSize \~50; maxVisible \~100; update batching \~100ms; prepend strategy.

  * Real-time Subscription Pattern (Supabase)

    * Subscribe to INSERT (and UPDATE if needed); batch before state set; idempotent merge by event id.

  * Rendering

    * Minimize reflows; memoize rows; avoid heavy diffing on rapid updates.

---

## Technical Implementation

### Existing Infrastructure to Leverage

* **Dashboard Application** (`apps/dashboard/`)
  * Next.js 15.4.6 with App Router already configured
  * Supabase client with connection management (`src/lib/supabase.ts`)
  * Error boundaries and monitoring utilities in place
  * Environment validation scripts (`scripts/validate-environment.js`)
  * Health check infrastructure (`scripts/health-check.js`)

* **Reusable Components** (`src/components/`)
  * ConnectionStatus component for header
  * EventCard and AnimatedEventCard for feed
  * Modal, Button, Badge, Card UI primitives
  * ErrorBoundary for resilient error handling

* **Existing Hooks** (`src/hooks/`)
  * `useEvents` - Event fetching with real-time updates
  * `useSessions` - Session management and filtering
  * `useSupabaseConnection` - Connection state management

* **Utilities** (`src/lib/`)
  * `eventProcessor.ts` - Event batching and processing
  * `filterUtils.ts` - Filter state management
  * `monitoring.ts` - Performance tracking
  * `security.ts` - Data sanitization

### New Components to Build

* **Sidebar Components**
  ```typescript
  components/sidebar/
  ├── AwaitingInputSection.tsx  // Pinned dynamic section
  ├── ProjectFolder.tsx          // Collapsible project groups
  ├── SessionItem.tsx            // Individual session display
  ├── PresetFilters.tsx          // MVP filter buttons
  └── SidebarContainer.tsx       // Main sidebar with collapse
  ```

* **Enhanced Header**
  ```typescript
  components/layout/
  └── HeaderV2.tsx               // V4-based implementation
      ├── MetricsDisplay.tsx     // Active/awaiting/rate
      ├── ThroughputIndicator.tsx // Optional sparkline
      └── ConnectionDot.tsx      // Status indicator
  ```

* **Redesigned Event Feed**
  ```typescript
  components/eventfeed/
  ├── EventTableV2.tsx           // V3 colors + V5 typography
  ├── EventRowV2.tsx             // Dense 24px rows
  ├── SubAgentRow.tsx            // Indented sub-agent events
  └── AutoScrollToggle.tsx       // Scroll control
  ```

### State Management Architecture

```typescript
// stores/dashboardStore.ts (Zustand)
interface DashboardStore {
  // Session Management
  sessions: Map<string, Session>
  awaitingSessions: Set<string>
  selectedSessions: Set<string>
  collapsedProjects: Set<string>
  
  // Event Management
  events: Event[]
  eventBuffer: Event[]  // Batched updates
  maxEvents: 1000
  
  // UI State
  sidebarCollapsed: boolean
  autoScroll: boolean
  activeFilter: PresetFilter
  
  // Real-time State
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
  lastEventTime: Date | null
  eventRate: number
  
  // Actions
  addEvents: (events: Event[]) => void
  updateSessionStatus: (sessionId: string) => void
  toggleSessionSelection: (sessionId: string) => void
  setFilter: (filter: PresetFilter) => void
}
```

### Real-time Event Processing

```typescript
// Enhanced event subscription
const subscribeToChronicleEvents = () => {
  const channel = supabase
    .channel('chronicle-events')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'events'
    }, (payload) => {
      // Batch events for performance
      eventBatcher.add(payload.new)
    })
    .subscribe()
    
  return channel
}

// Event batching (100ms window)
class EventBatcher {
  private buffer: Event[] = []
  private timer: NodeJS.Timeout | null = null
  
  add(event: Event) {
    this.buffer.push(event)
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 100)
    }
  }
  
  flush() {
    if (this.buffer.length > 0) {
      store.addEvents(this.buffer)
      this.buffer = []
    }
    this.timer = null
  }
}
```

### Database Queries

```typescript
// Optimized session query with awaiting status
const fetchSessionsWithStatus = async () => {
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      last_event:events(
        event_type,
        data,
        timestamp
      )
    `)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(50)
    
  // Determine awaiting status
  return sessions.map(session => ({
    ...session,
    status: getSessionStatus(session.last_event)
  }))
}

// Event feed query with filters
const fetchEvents = async (filters: FilterState) => {
  let query = supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100)
    
  if (filters.sessions.length > 0) {
    query = query.in('session_id', filters.sessions)
  }
  
  if (filters.eventTypes.length > 0) {
    query = query.in('event_type', filters.eventTypes)
  }
  
  return query
}
```

### Performance Optimizations

* **Virtual Scrolling Implementation**
  ```typescript
  import { FixedSizeList } from 'react-window'
  
  // Session list virtualization
  <FixedSizeList
    height={600}
    itemCount={sessions.length}
    itemSize={32}
    overscanCount={3}
  >
    {SessionItem}
  </FixedSizeList>
  ```

* **Memoization Strategy**
  ```typescript
  // Memoize expensive computations
  const awaitingSessions = useMemo(
    () => sessions.filter(s => s.status === 'awaiting'),
    [sessions]
  )
  
  // Memoize components
  const EventRow = memo(EventRowComponent, (prev, next) => 
    prev.event.id === next.event.id
  )
  ```

### Required Package Additions

```json
{
  "dependencies": {
    "zustand": "^4.5.0",           // State management
    "swr": "^2.2.0",                // Data fetching with cache
    "react-window": "^1.8.10",      // Virtual scrolling
    "@mui/icons-material": "^5.15.0", // Material Design icons
    "clsx": "^2.1.0",               // Conditional classes (already installed)
    "date-fns": "^4.1.0"            // Date formatting (already installed)
  },
  "devDependencies": {
    "@types/react-window": "^1.8.8" // TypeScript definitions
  }
}
```

### Migration Path

1. **Phase 1: Core Components** (Sprint 1-2)
   - Install required packages
   - Build new sidebar with awaiting section
   - Implement V4-based header
   - Create V3/V5 hybrid event feed

2. **Phase 2: State Management** (Sprint 3)
   - Add Zustand store
   - Integrate SWR for data fetching
   - Connect real-time subscriptions
   - Align TypeScript types between hooks and dashboard

3. **Phase 3: Performance** (Sprint 4)
   - Add virtual scrolling
   - Implement event batching
   - Optimize re-renders with memo/useCallback
   - Profile and fix performance bottlenecks

4. **Phase 4: Polish** (Sprint 4)
   - Add keyboard navigation
   - Implement responsive design
   - Complete testing suite
   - Validate against acceptance criteria

---

## Future Features Roadmap

* Phase 1: Comprehensive Filters

  * Collapsible filter section; multi-select by event types, tools, projects.

  * Save presets; share filters via URL.

* Phase 2: Search

  * Full-text search across events; session search by project/branch.

  * Highlight matches; maintain recent searches.

* Phase 3: Tool Lifecycle Grouping

  * Pair pre_tool_use/post_tool_use; collapsed summary with duration and success state.

  * Expand for detailed steps and metadata.

* Phase 4: Timeline/Swimlanes

  * Variant 2 visual style; 5-minute rolling window; time markers; horizontal scroll.

  * Session swimlanes with event dots; sub-agent indentation.

* Phase 5: Sub-agent Visualization

  * Tree view of nested agents; execution boundaries; parent-child lines.

  * Collapsed/expanded states retained per user.

---

## Security & Privacy

* Data Protection

  * No PII in metadata.

  * Session IDs obfuscated in UI (show last 4 chars).

  * Secure WebSockets (WSS) for real-time.

  * Optional retention policies for events.

* Access Control (Future)

  * Supabase Row Level Security; Supabase Auth.

  * Role-based access to sessions.

  * Audit logging for compliance.

---

## Implementation References

Preserved reference files from design brainstorm sprints:

1. variant_4_header_reference.css

* Purpose: Complete header implementation with optimal data organization

* Key Components: Right-aligned metrics, connection status, throughput indicators

* Why Selected: “V4 header had best data organization and visual presentation”

1. variant_3_event_feed_colors.css

* Purpose: Event feed color coding and table design

* Key Components: Semantic color system, left border accents, row backgrounds

* Why Selected: “V3 color coding was comprehensive and well-executed”

1. variant_5_typography_spacing.css

* Purpose: Typography styles and column spacing for event feed

* Key Components: Font sizes, line heights, column widths, padding values

* Why Selected: “V5 typography styles and column spacing”

1. variant_6_sidebar_structure.html

* Purpose: Sidebar HTML structure with project folders and sessions

* Key Components: Project folder hierarchy, session items, collapsible structure

* Why Selected: “V6 overall structure of folders + instances/subagents”

1. variant_1_awaiting_section.css

* Purpose: Dynamic awaiting input section styling

* Key Components: Pinned section, dynamic height, visual highlighting

* Why Selected: “V1 fixed awaiting input section that flexes as new agents enter”

Usage Guidelines

* Header: Use variant_4_header_reference.css as the complete implementation.

* Event Feed: Combine color system from variant_3_event_feed_colors.css with typography from variant_5_typography_spacing.css.

* Sidebar: Use HTML structure from variant_6_sidebar_structure.html with awaiting section styles from variant_1_awaiting_section.css.

* Timeline (future): Reference Variant 2 visual style (not preserved; not in MVP).

---

## Appendix: Anti-Patterns to Avoid

* Three separate containers (awaiting/active/idle) instead of a unified feed with filters.

* Fixed, non-toggleable sidebar.

* Disconnected floating indicators not tied to sessions.

* Large, card-based session tiles that don’t scale to dozens of sessions.

* Misaligned table columns; inconsistent spacing/typography.

* Static mockups without live data considerations.

* Control buttons or actions in a monitoring-only surface.

---

## Acceptance Criteria (MVP)

* Performance

  * Initial load under 2 seconds (p90) with an empty cache.

  * Event processing latency under 100 ms (p95) at 200 events/min.

  * Smooth scrolling at 60fps in event feed with 100 visible rows.

* UX

  * Awaiting sessions visible at a glance in the sidebar’s pinned section.

  * Time to identify any awaiting session < 2 seconds in usability tests.

  * Click depth to filter to a session ≤ 2 interactions.

* Functional

  * Sidebar: preset filters (All, Active, Awaiting, Idle) alter feed as expected.

  * Header: activeSessions, awaitingSessions, eventRate; connection status dot + label; throughput value.

  * Event Feed: chronological (newest first), semantic color coding, sub-agent indentation, auto-scroll toggle with position preservation.

* Real-time & Resilience Tests

  * Reconnection: Simulate network drop; dashboard shows Reconnecting/Disconnected; upon reconnect, no duplicates or missed events; backfill applied correctly.

  * Batching: At 200 events/min, UI remains responsive; no visual flooding; batched updates apply within \~100 ms.

  * Idempotency: Replays do not duplicate events (by event id).