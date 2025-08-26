# Chronicle Dashboard Components Documentation

This document provides comprehensive API documentation for all components in the Chronicle Dashboard application.

## Table of Contents

1. [Layout Components](#layout-components)
2. [Header Components](#header-components)
3. [Sidebar Components](#sidebar-components)
4. [Event Feed Components](#event-feed-components)
5. [UI Components](#ui-components)
6. [Hooks](#hooks)
7. [Component Integration Patterns](#component-integration-patterns)

---

## Layout Components

### Dashboard

**File**: `src/components/Dashboard.tsx`

Main layout container with responsive grid system that serves as the root component for the entire dashboard.

#### Features
- CSS Grid responsive layout system
- Collapsible sidebar (220px expanded, 48px collapsed)
- Fixed header (40px height)
- Flexible event feed area
- Mobile/tablet/desktop responsive design
- Component communication via Zustand store
- Layout persistence in localStorage
- Keyboard shortcuts support

#### Props Interface
```typescript
export interface DashboardProps {
  /** Additional CSS classes */
  className?: string;
  /** Enable layout persistence */
  persistLayout?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Children to render in main content area */
  children?: React.ReactNode;
}
```

#### Default Props
```typescript
{
  persistLayout: true,
  enableKeyboardShortcuts: true
}
```

#### Usage Example
```typescript
import { Dashboard } from '@/components/Dashboard';

function App() {
  return (
    <Dashboard 
      persistLayout={true}
      enableKeyboardShortcuts={true}
      className="custom-dashboard"
    >
      {/* Custom content can be rendered here */}
    </Dashboard>
  );
}
```

#### Keyboard Shortcuts
- `Cmd+B` / `Ctrl+B`: Toggle sidebar
- `1`: Show all events
- `2`: Show only active sessions
- `3`: Show only awaiting sessions

#### State Management Integration
Connects to `useDashboardStore` for:
- Sidebar collapse state
- Session and event data
- Filter state
- UI loading states

---

### ResponsiveGrid

**File**: `src/components/ResponsiveGrid.tsx`

Dynamic CSS Grid layout component that handles responsive breakpoints and dynamic layout changes.

#### Features
- CSS Grid with named areas for semantic layout
- Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)
- Dynamic sidebar width handling (220px expanded, 48px collapsed)
- Fixed header height (40px)
- Touch-friendly interactions for mobile
- Mobile overlay for sidebar

#### Props Interface
```typescript
export interface ResponsiveGridProps {
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the layout is loading */
  loading?: boolean;
  /** Children components */
  children: React.ReactNode;
}
```

#### Usage Example
```typescript
import { ResponsiveGrid } from '@/components/ResponsiveGrid';

function Layout({ sidebarCollapsed, children }) {
  return (
    <ResponsiveGrid
      sidebarCollapsed={sidebarCollapsed}
      className="min-h-screen"
      loading={false}
    >
      {children}
    </ResponsiveGrid>
  );
}
```

#### Exported Hooks
```typescript
// Get current breakpoint
const breakpoint = useBreakpoint(); // 'mobile' | 'tablet' | 'desktop'

// Check if mobile
const isMobile = useIsMobile(); // boolean

// Check if tablet or smaller
const isTabletOrSmaller = useIsTabletOrSmaller(); // boolean
```

---

## Header Components

### Header

**File**: `src/components/layout/Header.tsx`

Fixed header component that displays real-time metrics and connection status.

#### Features
- Real-time connection status monitoring
- Session metrics (active, awaiting)
- Event rate with sparkline visualization
- Latency monitoring
- Auto-updating metrics every 2 seconds

#### Props
No props interface - uses store data directly.

#### Usage Example
```typescript
import { Header } from '@/components/layout/Header';

function Layout() {
  return (
    <div className="header-area">
      <Header />
    </div>
  );
}
```

#### State Management Integration
- `useDashboardStore`: Session and event data
- `supabase`: Connection monitoring

#### Metrics Displayed
- Active sessions count
- Awaiting input sessions count
- Connection latency
- Events per minute with sparkline

---

### ConnectionDot

**File**: `src/components/layout/ConnectionDot.tsx`

Small indicator component for connection status.

#### Props Interface
```typescript
interface ConnectionDotProps {
  /** Connection status */
  status: 'connected' | 'disconnected' | 'connecting';
  /** Additional CSS classes */
  className?: string;
}
```

---

### MetricsDisplay

**File**: `src/components/layout/MetricsDisplay.tsx`

Displays real-time dashboard metrics with icons and values.

#### Props Interface
```typescript
interface MetricsDisplayProps {
  /** Metrics to display */
  metrics: {
    active: number;
    awaiting: number;
    eventsPerMin: number;
  };
  /** Additional CSS classes */
  className?: string;
}
```

---

### ThroughputIndicator

**File**: `src/components/layout/ThroughputIndicator.tsx`

Visual indicator for event throughput with sparkline.

#### Props Interface
```typescript
interface ThroughputIndicatorProps {
  /** Event rate history for sparkline */
  eventRateHistory: number[];
  /** Current events per minute */
  eventsPerMin: number;
  /** Additional CSS classes */
  className?: string;
}
```

---

## Sidebar Components

### SidebarContainer

**File**: `src/components/sidebar/SidebarContainer.tsx`

Main sidebar container providing project-based session navigation and filtering.

#### Features
- Project-based grouping of sessions using project_path
- Dynamic ordering with awaiting sessions bubbling to top
- Collapsible state with localStorage persistence
- Real-time updates for session status changes
- Keyboard shortcuts for navigation

#### Props
No props interface - uses store data directly.

#### Usage Example
```typescript
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';

function Layout() {
  return (
    <div className="sidebar-area">
      <SidebarContainer />
    </div>
  );
}
```

#### State Management Integration
- `useDashboardStore`: Session data, UI state, filters
- Groups sessions by git repo or folder
- Handles session selection for filtering

---

### SessionItem

**File**: `src/components/sidebar/SessionItem.tsx`

Individual session item display component.

#### Props Interface
```typescript
interface SessionItemProps {
  /** Session data */
  session: Session;
  /** Whether session is selected */
  isSelected: boolean;
  /** Click handler */
  onClick: (session: Session) => void;
  /** Additional CSS classes */
  className?: string;
}
```

#### Features
- Status indicator (active, idle, completed, error)
- Display title and subtitle
- Last activity timestamp
- Awaiting input indicator
- Git branch and project path display

---

### ProjectFolder

**File**: `src/components/sidebar/ProjectFolder.tsx`

Collapsible folder component for grouping sessions by project.

#### Props Interface
```typescript
interface ProjectFolderProps {
  /** Unique project key */
  projectKey: string;
  /** Display name for project */
  projectName: string;
  /** Sessions in this project */
  sessions: Session[];
  /** Count of awaiting sessions */
  awaitingCount: number;
  /** Total session count */
  totalCount: number;
}
```

#### Features
- Collapsible/expandable project folders
- Session count badges
- Awaiting input indicators
- Git repo vs folder differentiation

---

### AwaitingInputSection

**File**: `src/components/sidebar/AwaitingInputSection.tsx`

Priority section for sessions awaiting user input.

#### Props Interface
```typescript
interface AwaitingInputSectionProps {
  /** Sessions awaiting input */
  sessions: Session[];
  /** Session click handler */
  onClick: (session: Session) => void;
}
```

#### Features
- Fixed at top of sidebar
- Highlights urgent sessions
- Quick access to awaiting sessions

---

## Event Feed Components

### EventFeed

**File**: `src/components/eventfeed/EventFeed.tsx`

High-performance event feed with batching and virtual scrolling.

#### Features
- EventBatcher integration for 100ms windowing
- Virtual scrolling for 1000+ events
- Dense 24px row layout
- Semantic color coding
- Auto-scroll management
- Sub-agent hierarchy support
- Real-time performance monitoring
- FIFO event management (max 1000 events)

#### Props Interface
```typescript
export interface EventFeedProps {
  /** Array of sessions for context */
  sessions: Session[];
  /** Feed height in pixels */
  height?: number;
  /** Feed width in pixels */
  width?: number;
  /** Maximum events to keep in history */
  maxEvents?: number;
  /** Enable real-time event batching */
  enableBatching?: boolean;
  /** Batch window size in milliseconds */
  batchWindowMs?: number;
  /** Auto-scroll enabled by default */
  defaultAutoScroll?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback for performance metrics */
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  /** Initial events to display */
  initialEvents?: Event[];
}
```

#### Default Props
```typescript
{
  height: 400,
  width: 800,
  maxEvents: 1000,
  enableBatching: true,
  batchWindowMs: 100,
  defaultAutoScroll: true,
  initialEvents: []
}
```

#### Usage Example
```typescript
import { EventFeed } from '@/components/eventfeed/EventFeed';

function EventFeedContainer() {
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <EventFeed
      sessions={sessions}
      initialEvents={events}
      height={600}
      width={800}
      enableBatching={true}
      maxEvents={1000}
      defaultAutoScroll={autoScroll}
      onPerformanceUpdate={(metrics) => {
        console.log('Performance:', metrics);
      }}
    />
  );
}
```

#### Performance Metrics Interface
```typescript
export interface PerformanceMetrics {
  /** Total events processed */
  totalEvents: number;
  /** Events per second throughput */
  eventsPerSecond: number;
  /** Average batch processing time */
  avgBatchTime: number;
  /** Current memory usage estimate */
  memoryUsage: number;
  /** Last update timestamp */
  lastUpdate: Date;
}
```

---

### EventTable

**File**: `src/components/eventfeed/EventTable.tsx`

Virtual scrolling table component for event display.

#### Props Interface
```typescript
interface EventTableProps {
  /** Events to display */
  events: Event[];
  /** Sessions for context */
  sessions: Session[];
  /** Table height */
  height: number;
  /** Table width */
  width: number;
  /** Auto-scroll enabled */
  autoScroll: boolean;
  /** Auto-scroll change handler */
  onAutoScrollChange: (enabled: boolean) => void;
  /** Maximum events */
  maxEvents: number;
  /** Loading state */
  loading: boolean;
  /** Additional CSS classes */
  className?: string;
}
```

#### Features
- Virtual scrolling for performance
- Dense 24px row height
- Event type color coding
- Session context lookup
- Auto-scroll to bottom

---

### EventRow

**File**: `src/components/eventfeed/EventRow.tsx`

Individual event row component with optimized rendering.

#### Props Interface
```typescript
interface EventRowProps {
  /** Event to display */
  event: Event;
  /** Session context */
  session?: Session;
  /** Row index for virtualization */
  index: number;
  /** Additional CSS classes */
  className?: string;
}
```

#### Features
- Semantic color coding by event type
- Tool name display
- Timestamp formatting
- Session context integration
- Optimized for virtual scrolling

---

### EventFeedHeader

**File**: `src/components/eventfeed/EventFeedHeader.tsx`

Header component for the event feed with controls and info.

#### Props Interface
```typescript
interface EventFeedHeaderProps {
  /** Total event count */
  eventCount: number;
  /** Auto-scroll state */
  autoScroll: boolean;
  /** Auto-scroll change handler */
  onAutoScrollChange: (enabled: boolean) => void;
  /** Whether events are filtered */
  isFiltered: boolean;
}
```

#### Features
- Event count display
- Auto-scroll toggle
- Filter status indicator
- Controls for event feed

---

## UI Components

### Modal

**File**: `src/components/ui/Modal.tsx`

Accessible modal component with portal rendering.

#### Props Interface
```typescript
interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}
```

#### Usage Example
```typescript
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Event Details"
      description="View detailed information about this event"
      size="lg"
    >
      <ModalContent>
        <p>Modal content here</p>
      </ModalContent>
      <ModalFooter>
        <Button onClick={() => setIsOpen(false)}>Close</Button>
      </ModalFooter>
    </Modal>
  );
}
```

#### Features
- Portal rendering to document.body
- Escape key handling
- Body scroll prevention
- Backdrop click to close
- Accessible ARIA attributes
- Multiple size variants

#### Size Options
- `sm`: max-w-md
- `md`: max-w-lg (default)
- `lg`: max-w-2xl
- `xl`: max-w-4xl
- `full`: max-w-[95vw] max-h-[95vh]

---

### Button

**File**: `src/components/ui/Button.tsx`

Flexible button component with multiple variants.

#### Props Interface
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Loading state */
  loading?: boolean;
  /** Icon to display */
  icon?: React.ReactNode;
}
```

#### Usage Example
```typescript
import { Button } from '@/components/ui/Button';

function MyComponent() {
  return (
    <Button
      variant="default"
      size="md"
      loading={false}
      onClick={() => console.log('clicked')}
    >
      Click me
    </Button>
  );
}
```

---

### Card

**File**: `src/components/ui/Card.tsx`

Container component for content cards.

#### Props Interface
```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: "default" | "ghost";
  /** Additional CSS classes */
  className?: string;
}
```

---

## Hooks

### useEvents

**File**: `src/hooks/useEvents.ts`

Custom hook for managing events with real-time subscriptions.

#### Interface
```typescript
interface UseEventsState {
  /** Array of events */
  events: Event[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether more events available */
  hasMore: boolean;
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Connection quality rating */
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  /** Retry function */
  retry: () => void;
  /** Load more function */
  loadMore: () => Promise<void>;
}

interface UseEventsOptions {
  /** Event limit */
  limit?: number;
  /** Filter options */
  filters?: Partial<FilterState>;
  /** Enable real-time updates */
  enableRealtime?: boolean;
}
```

#### Usage Example
```typescript
import { useEvents } from '@/hooks/useEvents';

function EventComponent() {
  const { 
    events, 
    loading, 
    error, 
    retry 
  } = useEvents({ 
    limit: 100, 
    enableRealtime: true 
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {events.map(event => (
        <div key={event.id}>{event.event_type}</div>
      ))}
    </div>
  );
}
```

---

### useSessions

**File**: `src/hooks/useSessions.ts`

Custom hook for managing session data.

#### Interface
```typescript
interface UseSessionsState {
  /** Array of sessions */
  sessions: Session[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
}
```

#### Usage Example
```typescript
import { useSessions } from '@/hooks/useSessions';

function SessionComponent() {
  const { sessions, loading, error } = useSessions();

  if (loading) return <div>Loading sessions...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id}>{session.project_path}</div>
      ))}
    </div>
  );
}
```

---

### useStore

**File**: `src/hooks/useStore.ts`

Hook for accessing the dashboard store.

#### Usage Example
```typescript
import { useStore } from '@/hooks/useStore';

function MyComponent() {
  const store = useStore();
  
  return (
    <div>
      <button onClick={() => store.setSidebarCollapsed(true)}>
        Collapse Sidebar
      </button>
    </div>
  );
}
```

---

## Component Integration Patterns

### State Management Integration

Most components integrate with the Zustand store for state management:

```typescript
import { useDashboardStore } from '@/stores/dashboardStore';

function MyComponent() {
  const {
    ui: { sidebarCollapsed, loading },
    setSidebarCollapsed,
    sessions,
    events,
    filters,
    getFilteredEvents
  } = useDashboardStore();

  // Component logic here
}
```

### Event Handling Patterns

Components use consistent patterns for event handling:

```typescript
// Session selection
const handleSessionClick = useCallback((session: Session) => {
  const store = useDashboardStore.getState();
  store.toggleSessionSelection(session.id);
}, []);

// Keyboard shortcuts
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
    event.preventDefault();
    setSidebarCollapsed(!sidebarCollapsed);
  }
}, [sidebarCollapsed, setSidebarCollapsed]);
```

### Performance Optimization Patterns

Components use React optimization patterns:

```typescript
// Memoization for expensive computations
const sortedEvents = useMemo(() => {
  return [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}, [events]);

// Memo for component optimization
export const EventFeed = memo<EventFeedProps>(({ /* props */ }) => {
  // Component implementation
});

// Callback memoization
const handleEventBatch = useCallback((batch: EventBatch) => {
  setEvents(prevEvents => {
    const newEvents = [...prevEvents, ...batch.events];
    return newEvents.length > maxEvents 
      ? newEvents.slice(-maxEvents) 
      : newEvents;
  });
}, [maxEvents]);
```

### CSS Integration Patterns

Components use consistent CSS patterns with Tailwind and custom properties:

```typescript
// Utility function usage
import { cn } from '@/lib/utils';

const className = cn(
  'base-classes',
  conditional && 'conditional-classes',
  props.className
);

// CSS custom properties for dynamic values
const style = {
  '--sidebar-width': getSidebarWidth(),
  '--header-height': '40px',
} as React.CSSProperties;
```

### Real-time Data Patterns

Components handle real-time data consistently:

```typescript
// Hook integration
const { 
  events, 
  loading, 
  error 
} = useEvents({ 
  limit: 100, 
  enableRealtime: true 
});

// Store synchronization
useEffect(() => {
  if (events) {
    setEvents(events.map(e => ({
      // Transform data for store
    })));
  }
}, [events, setEvents]);
```

---

This documentation covers all the main components, their APIs, usage patterns, and integration approaches used throughout the Chronicle Dashboard application. Each component is designed to be composable, performant, and maintainable while providing a consistent user experience across different breakpoints and usage scenarios.