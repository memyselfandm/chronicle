# PRD: Multi-Agent Observability Dashboard

## Overview
Build a real-time web dashboard using Next.js 14+ and Supabase that provides comprehensive visibility into Claude Code agent activities across multiple projects and sessions, matching the design shown in the reference image.

## Requirements

### Core Architecture
- **Frontend**: Next.js 14+ with TypeScript and App Router
- **Backend**: Supabase (PostgreSQL + Real-time + Auth + Row Level Security)
- **Styling**: Tailwind CSS with custom dark theme
- **Charts**: Recharts for data visualization
- **Real-time**: Supabase real-time subscriptions
- **State Management**: Zustand for global state
- **Data Fetching**: SWR for caching and revalidation

### Visual Design System

#### Color Scheme (Dark Theme)
```css
:root {
  --bg-primary: #0f1419;     /* Main background */
  --bg-secondary: #1a1f2e;   /* Card backgrounds */
  --bg-tertiary: #252a3a;    /* Elevated elements */
  --text-primary: #ffffff;   /* Primary text */
  --text-secondary: #a0a9c0; /* Secondary text */
  --text-muted: #6b7280;     /* Muted text */
  --accent-green: #10b981;   /* Success states */
  --accent-blue: #3b82f6;    /* Info states */
  --accent-yellow: #f59e0b;  /* Warning states */
  --accent-red: #ef4444;     /* Error states */
  --accent-purple: #8b5cf6;  /* Special events */
  --border-color: #374151;   /* Borders and dividers */
}
```

#### Typography
- **Font Family**: Inter or system font stack
- **Sizes**: 12px (small), 14px (body), 16px (emphasis), 20px (headings)
- **Weights**: 400 (normal), 500 (medium), 600 (semibold)

### Layout Structure

#### Header Section
```typescript
interface HeaderProps {
  title: "Multi-Agent Observability"
  connectionStatus: "Connected" | "Disconnected" | "Connecting"
  eventCount: number // Live counter with animation
  timeRange: "1h" | "6h" | "24h" | "7d" | "30d"
  themeToggle: boolean // Light/dark mode
}
```

#### Filter Controls Bar
```typescript
interface FilterControlsProps {
  sourceApps: MultiSelectDropdown    // All Sources, specific apps
  sessionIds: SearchableDropdown     // All Sessions, specific sessions  
  eventTypes: MultiSelectDropdown    // All Types, hook event types
  searchQuery: string                // Free text search
  dateRange: DateRangePicker        // Custom time range
}
```

### Main Dashboard Components

#### 1. Live Activity Pulse Visualization
**Layout**: Horizontal timeline spanning full width
**Features**:
- Real-time event dots with smooth animations
- Color coding by event type:
  - 🟢 Green: Successful tool operations
  - 🔵 Blue: Tool usage events (PreToolUse/PostToolUse)
  - 🟡 Yellow: File operations, notifications
  - 🔴 Red: Errors, blocked operations
  - 🟣 Purple: Session lifecycle events
- Hover tooltips with event summary
- Zoom controls for time granularity (1min, 5min, 15min, 1hr)
- Auto-scroll with manual override

```typescript
interface ActivityPulseEvent {
  id: string
  timestamp: Date
  type: 'success' | 'tool_use' | 'file_op' | 'error' | 'lifecycle'
  sessionId: string
  summary: string
  details?: object
}
```

#### 2. Agent Event Stream (Primary Feed)
**Layout**: Scrollable list taking majority of screen space
**Features**:
- Real-time event cards with smooth insertion animations
- Event card design matching reference image:
  - Session ID badge with consistent color coding
  - Event type badge (color-coded)
  - Timestamp (relative time)
  - Brief description/summary
  - Expandable details on click
- Auto-scroll toggle with position memory
- Infinite scroll pagination
- Search highlighting

```typescript
interface EventCard {
  sessionId: string
  sessionColor: string    // Consistent per session
  eventType: string
  eventBadgeColor: string
  timestamp: Date
  title: string
  description: string
  expandedData?: object
  toolName?: string
  success?: boolean
}
```

#### 3. Session Management Sidebar
**Layout**: Right sidebar or collapsible panel
**Features**:
- Active sessions list with status indicators
- Session metrics:
  - Duration and activity level
  - Tool usage summary
  - Error count and success rate
  - Project context (path, git branch)
- Session comparison functionality
- Session filtering and search

### Detailed Views & Modals

#### Event Detail Modal
**Trigger**: Click on any event card
**Content**:
- Full JSON explorer with syntax highlighting
- Related events timeline
- Tool execution details with parameters/results
- File diff viewer (for Edit/Write tools)
- Performance metrics visualization
- Copy/export functionality

#### Session Analytics Overlay
**Trigger**: Click on session ID or dedicated analytics button
**Content**:
- Tool usage distribution (pie/donut chart)
- Response time trends with percentiles
- Error rate monitoring over time
- Token usage tracking (if available)
- File activity heatmap by directory

#### Advanced Filters Modal
**Trigger**: Advanced filter button
**Content**:
- Custom time range picker
- Complex filter combinations (AND/OR logic)
- Saved filter presets
- Filter sharing via URL

### Real-time Features

#### Live Data Streaming
```typescript
// Supabase real-time subscription
const eventSubscription = useSupabaseSubscription(
  'events',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'events'
  },
  (payload) => {
    // Add to event stream with animation
    // Update activity pulse
    // Update counters
  }
)
```

#### Real-time Updates
- **Event Counter**: Animated increment on new events
- **Activity Pulse**: New dots appear with fade-in animation
- **Event Stream**: New cards slide in from top
- **Session Status**: Live updates to active session states

#### Connection Management
- **Auto-reconnection**: Exponential backoff on connection loss
- **Offline Mode**: Clear indicators when Supabase unavailable
- **Sync on Reconnect**: Catch up on missed events

### Performance Optimization

#### Data Management
- **Virtual Scrolling**: Handle large event lists efficiently
- **Pagination**: Load events in chunks (25-50 per page)
- **Caching**: SWR cache for session data and filters
- **Debouncing**: Search and filter inputs

#### Real-time Optimization
- **Event Batching**: Group rapid events to prevent UI flooding
- **Selective Subscriptions**: Only subscribe to filtered data
- **Memory Management**: Cleanup old events from memory
- **Background Sync**: Efficient offline data synchronization

### User Experience Features

#### Keyboard Navigation
- **Arrow Keys**: Navigate event cards
- **Space/Enter**: Expand/collapse events
- **Escape**: Close modals
- **Ctrl+F**: Focus search
- **Ctrl+R**: Refresh data

#### Customization & Persistence
- **Layout Preferences**: Sidebar position, panel sizes
- **Filter Presets**: Save common filter combinations
- **View Modes**: Compact/detailed event cards
- **Data Export**: CSV/JSON export with current filters

#### Responsive Design
- **Mobile**: Stack layout, touch-friendly interactions
- **Tablet**: Adaptive sidebar, gesture support
- **Desktop**: Full multi-panel layout

### Technical Implementation

#### Component Architecture
```typescript
// Main dashboard layout
components/
├── Layout/
│   ├── Header.tsx
│   ├── FilterBar.tsx
│   └── Sidebar.tsx
├── ActivityPulse/
│   ├── TimelineChart.tsx
│   ├── EventDot.tsx
│   └── TimelineControls.tsx
├── EventStream/
│   ├── EventCard.tsx
│   ├── EventList.tsx
│   └── EventSearch.tsx
├── SessionPanel/
│   ├── SessionList.tsx
│   ├── SessionCard.tsx
│   └── SessionMetrics.tsx
└── Modals/
    ├── EventDetail.tsx
    ├── SessionAnalytics.tsx
    └── AdvancedFilters.tsx
```

#### State Management
```typescript
// Zustand store structure
interface DashboardStore {
  // Data
  events: Event[]
  sessions: Session[]
  
  // UI State
  filters: FilterState
  selectedEvent: Event | null
  selectedSession: Session | null
  
  // Real-time
  connectionStatus: ConnectionStatus
  isAutoScrolling: boolean
  
  // Actions
  addEvent: (event: Event) => void
  updateFilters: (filters: Partial<FilterState>) => void
  setSelectedEvent: (event: Event | null) => void
}
```

#### API Integration
```typescript
// Supabase client configuration
const supabase = createClient(url, key, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Query patterns
const fetchEvents = (filters: FilterState) => 
  supabase
    .from('events')
    .select(`
      *,
      sessions(*),
      tool_events(*),
      prompt_events(*),
      notification_events(*),
      lifecycle_events(*)
    `)
    .order('timestamp', { ascending: false })
    .limit(50)
```

#### Performance Monitoring
- **React DevTools Profiler**: Component render optimization
- **Supabase Metrics**: Query performance and connection health
- **Custom Metrics**: Event processing latency, UI responsiveness
- **Error Tracking**: Sentry or similar for production monitoring

### Data Visualization

#### Charts & Graphs
- **Activity Timeline**: Horizontal scatter plot with zoom
- **Tool Usage**: Pie charts with drill-down capability
- **Performance Trends**: Line charts with multiple series
- **Error Rates**: Area charts with threshold indicators

#### Interactive Elements
- **Hover States**: Smooth transitions, informative tooltips
- **Click Actions**: Drill-down to detailed views
- **Drag Selection**: Select time ranges on timeline
- **Zoom Controls**: Pinch-to-zoom support on mobile

### Security & Privacy

#### Data Protection
- **Row Level Security**: Supabase RLS for multi-tenant access
- **API Key Management**: Secure client-side key handling
- **Data Masking**: Optional PII filtering in UI
- **Audit Logging**: Track dashboard access and actions

#### Authentication (Future)
- **Supabase Auth**: Optional user authentication
- **Role-based Access**: Different permission levels
- **Session Management**: Secure session handling

### Deployment & Operations

#### Development Setup
```bash
# Install dependencies
npm install

# Environment variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Development server
npm run dev
```

#### Production Deployment
- **Vercel**: Recommended hosting platform
- **Edge Functions**: Real-time processing if needed
- **CDN**: Static asset optimization
- **Monitoring**: Uptime and performance monitoring

#### Configuration Management
```typescript
// Environment-based configuration
const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  },
  features: {
    realtime: true,
    analytics: true,
    export: true
  },
  performance: {
    eventBatchSize: 10,
    maxCachedEvents: 1000,
    reconnectAttempts: 5
  }
}
```

This dashboard provides a comprehensive, real-time view into Claude Code agent behavior with the visual design and functionality shown in the reference image, optimized for both development and production use cases.