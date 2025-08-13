# Responsive Dashboard Design Reference

## Overview
This document provides comprehensive patterns and best practices for creating responsive dashboard layouts optimized for complex data interfaces. Focused on mobile-first design, touch interactions, and adaptive layouts for observability dashboards.

## Core Responsive Design Principles

### 1. Mobile-First Breakpoint Strategy

```css
/* Mobile-first breakpoint system */
:root {
  --mobile: 320px;
  --tablet: 768px;
  --desktop: 1024px;
  --wide: 1280px;
  --ultra-wide: 1536px;
}

/* Base styles for mobile */
.dashboard-container {
  padding: 1rem;
  gap: 1rem;
}

/* Tablet adjustments */
@media (min-width: 768px) {
  .dashboard-container {
    padding: 1.5rem;
    gap: 1.5rem;
  }
}

/* Desktop optimizations */
@media (min-width: 1024px) {
  .dashboard-container {
    padding: 2rem;
    gap: 2rem;
    display: grid;
    grid-template-columns: 250px 1fr;
  }
}

/* Wide screen layouts */
@media (min-width: 1280px) {
  .dashboard-container {
    grid-template-columns: 300px 1fr 250px;
  }
}
```

### 2. Tailwind CSS Responsive Utilities

```typescript
// Responsive dashboard layout using Tailwind
function ResponsiveDashboard() {
  return (
    <div className="
      min-h-screen bg-gray-50 dark:bg-gray-900
      p-4 sm:p-6 lg:p-8
      grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5
      gap-4 sm:gap-6 lg:gap-8
    ">
      {/* Sidebar - hidden on mobile, shows on desktop */}
      <aside className="
        hidden lg:block lg:col-span-1
        bg-white dark:bg-gray-800
        rounded-lg shadow-sm
        p-4 lg:p-6
      ">
        <NavigationMenu />
      </aside>

      {/* Main content area */}
      <main className="
        col-span-1 lg:col-span-2 xl:col-span-3
        space-y-4 sm:space-y-6
      ">
        {/* Header metrics - responsive grid */}
        <div className="
          grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
          gap-4 sm:gap-6
        ">
          <MetricCard title="Active Sessions" value="12" />
          <MetricCard title="Total Events" value="1,234" />
          <MetricCard title="Success Rate" value="98.5%" />
          <MetricCard title="Avg Response" value="145ms" />
        </div>

        {/* Main chart area */}
        <div className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-sm
          p-4 sm:p-6
          h-64 sm:h-80 lg:h-96
        ">
          <EventTimeline />
        </div>

        {/* Data table - responsive behavior */}
        <div className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-sm
          overflow-hidden
        ">
          <ResponsiveEventTable />
        </div>
      </main>

      {/* Right sidebar - hidden on mobile/tablet */}
      <aside className="
        hidden xl:block xl:col-span-1
        bg-white dark:bg-gray-800
        rounded-lg shadow-sm
        p-4 lg:p-6
      ">
        <SessionSidebar />
      </aside>
    </div>
  );
}
```

## Adaptive Layout Patterns

### 1. Container Query-Based Components

```css
/* Component-level responsiveness with container queries */
.metric-card {
  container-type: inline-size;
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Adapt based on container width, not viewport */
@container (width > 300px) {
  .metric-card {
    padding: 1.5rem;
  }
  
  .metric-card__title {
    font-size: 0.875rem;
  }
  
  .metric-card__value {
    font-size: 2rem;
  }
}

@container (width > 400px) {
  .metric-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .metric-card__icon {
    display: block;
    width: 3rem;
    height: 3rem;
  }
}
```

```typescript
// React component using container queries
function AdaptiveMetricCard({ 
  title, 
  value, 
  icon, 
  trend 
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="metric-card">
      <div className="metric-card__content">
        <h3 className="metric-card__title text-gray-500">{title}</h3>
        <p className="metric-card__value font-bold text-gray-900">{value}</p>
        {trend && <TrendIndicator trend={trend} />}
      </div>
      {icon && (
        <div className="metric-card__icon hidden">
          {icon}
        </div>
      )}
    </div>
  );
}
```

### 2. CSS Grid Responsive Layouts

```css
/* Advanced grid layout for dashboard sections */
.dashboard-grid {
  display: grid;
  gap: 1rem;
  
  /* Mobile: Single column */
  grid-template-columns: 1fr;
  grid-template-areas:
    "header"
    "metrics"
    "chart"
    "table"
    "sidebar";
}

/* Tablet: Two columns */
@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "header header"
      "metrics metrics"
      "chart chart"
      "table sidebar";
  }
}

/* Desktop: Complex layout */
@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 250px 1fr 300px;
    grid-template-areas:
      "nav header sidebar"
      "nav metrics sidebar"
      "nav chart sidebar"
      "nav table sidebar";
  }
}

/* Ultra-wide: Four column layout */
@media (min-width: 1536px) {
  .dashboard-grid {
    grid-template-columns: 250px 1fr 1fr 300px;
    grid-template-areas:
      "nav header header sidebar"
      "nav metrics chart sidebar"
      "nav table table sidebar";
  }
}

.dashboard-header { grid-area: header; }
.dashboard-nav { grid-area: nav; }
.dashboard-metrics { grid-area: metrics; }
.dashboard-chart { grid-area: chart; }
.dashboard-table { grid-area: table; }
.dashboard-sidebar { grid-area: sidebar; }
```

### 3. React Grid Layout for Draggable Dashboards

```typescript
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

interface DashboardWidget {
  id: string;
  title: string;
  component: React.ComponentType;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: 'metrics-overview',
    title: 'Metrics Overview',
    component: MetricsOverview,
    defaultSize: { w: 12, h: 4 },
    minSize: { w: 6, h: 3 },
  },
  {
    id: 'event-timeline',
    title: 'Event Timeline',
    component: EventTimeline,
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 6, h: 6 },
  },
  {
    id: 'session-list',
    title: 'Active Sessions',
    component: SessionList,
    defaultSize: { w: 4, h: 8 },
    minSize: { w: 3, h: 4 },
  },
];

function DraggableDashboard() {
  const [layouts, setLayouts] = useState(() => {
    const saved = localStorage.getItem('dashboard-layout');
    return saved ? JSON.parse(saved) : generateDefaultLayouts();
  });

  const [breakpoint, setBreakpoint] = useState('lg');
  const [cols, setCols] = useState({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 });

  const onLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts);
    localStorage.setItem('dashboard-layout', JSON.stringify(layouts));
  };

  const onBreakpointChange = (breakpoint: string, cols: number) => {
    setBreakpoint(breakpoint);
  };

  return (
    <div className="dashboard-container">
      <GridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={onLayoutChange}
        onBreakpointChange={onBreakpointChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={cols}
        rowHeight={60}
        isDraggable={true}
        isResizable={true}
        compactType="vertical"
        preventCollision={false}
      >
        {DASHBOARD_WIDGETS.map(widget => (
          <div
            key={widget.id}
            className="widget-container bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
          >
            <div className="widget-header p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium">{widget.title}</h3>
            </div>
            <div className="widget-content p-4">
              <widget.component />
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}

function generateDefaultLayouts() {
  const layouts: any = {};
  
  // Desktop layout
  layouts.lg = DASHBOARD_WIDGETS.map((widget, index) => ({
    i: widget.id,
    x: (index * 4) % 12,
    y: Math.floor(index / 3) * 4,
    w: widget.defaultSize.w,
    h: widget.defaultSize.h,
    minW: widget.minSize?.w || 2,
    minH: widget.minSize?.h || 2,
  }));

  // Tablet layout
  layouts.md = DASHBOARD_WIDGETS.map((widget, index) => ({
    i: widget.id,
    x: (index * 5) % 10,
    y: Math.floor(index / 2) * 4,
    w: Math.min(widget.defaultSize.w, 10),
    h: widget.defaultSize.h,
    minW: widget.minSize?.w || 2,
    minH: widget.minSize?.h || 2,
  }));

  // Mobile layout - stack vertically
  layouts.sm = DASHBOARD_WIDGETS.map((widget, index) => ({
    i: widget.id,
    x: 0,
    y: index * 4,
    w: 6,
    h: widget.defaultSize.h,
    minW: 6,
    minH: widget.minSize?.h || 2,
  }));

  return layouts;
}
```

## Mobile Touch Interactions

### 1. Touch-Friendly Controls

```css
/* Touch-optimized interactive elements */
.touch-control {
  min-height: 44px; /* iOS minimum touch target */
  min-width: 44px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  /* Ensure adequate spacing between touch targets */
  margin: 4px;
}

.touch-control:hover,
.touch-control:focus {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Active state for touch feedback */
.touch-control:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

/* Swipe gestures for mobile tables */
.mobile-table-row {
  position: relative;
  overflow: hidden;
  touch-action: pan-x;
}

.mobile-table-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 120px;
  background: linear-gradient(to left, #ef4444, #dc2626);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.mobile-table-row.swiped .mobile-table-actions {
  transform: translateX(0);
}
```

```typescript
// Touch gesture handling for mobile interactions
function useTouchGestures(ref: React.RefObject<HTMLElement>) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart.x - touchEnd.x;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Handle left swipe (e.g., reveal actions)
      ref.current?.classList.add('swiped');
    } else if (isRightSwipe) {
      // Handle right swipe (e.g., hide actions)
      ref.current?.classList.remove('swiped');
    }
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [touchStart, touchEnd]);

  return { touchStart, touchEnd };
}

// Mobile-optimized event table with swipe actions
function MobileEventTable({ events }: { events: Event[] }) {
  return (
    <div className="mobile-table">
      {events.map(event => (
        <MobileEventRow key={event.id} event={event} />
      ))}
    </div>
  );
}

function MobileEventRow({ event }: { event: Event }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useTouchGestures(rowRef);

  return (
    <div ref={rowRef} className="mobile-table-row">
      <div className="flex items-center p-4 bg-white dark:bg-gray-800 border-b">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{event.toolName}</p>
          <p className="text-sm text-gray-500 truncate">{event.description}</p>
          <p className="text-xs text-gray-400">{formatTime(event.timestamp)}</p>
        </div>
        <div className="ml-4">
          <StatusBadge status={event.status} />
        </div>
      </div>
      
      {/* Swipe actions */}
      <div className="mobile-table-actions">
        <button className="text-white font-medium">
          View Details
        </button>
      </div>
    </div>
  );
}
```

### 2. Mobile Navigation Patterns

```typescript
// Mobile-first navigation with drawer pattern
function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        
        <h1 className="text-lg font-semibold">Chronicle</h1>
        
        <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="left"
        className="lg:hidden"
      >
        <nav className="p-4 space-y-2">
          {NAVIGATION_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setIsOpen(false);
              }}
              className={`
                w-full text-left p-3 rounded-lg transition-colors
                ${activeSection === item.id 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </Drawer>

      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r">
        <nav className="p-6 space-y-2">
          {NAVIGATION_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`
                w-full text-left p-3 rounded-lg transition-colors
                ${activeSection === item.id 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

// Reusable drawer component
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

function Drawer({ isOpen, onClose, position, children, className }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div
        className={`
          fixed top-0 ${position === 'left' ? 'left-0' : 'right-0'} 
          h-full w-80 max-w-[80vw]
          bg-white dark:bg-gray-800
          transform transition-transform duration-300 ease-in-out
          z-50
          ${isOpen 
            ? 'translate-x-0' 
            : position === 'left' 
              ? '-translate-x-full' 
              : 'translate-x-full'
          }
          ${className}
        `}
      >
        {children}
      </div>
    </>
  );
}
```

## Responsive Data Visualization

### 1. Adaptive Chart Sizing

```typescript
import { useElementSize } from '@/hooks/useElementSize';

function ResponsiveChart({ data }: { data: ChartData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(containerRef);

  // Adapt chart configuration based on container size
  const chartConfig = useMemo(() => {
    if (width < 480) {
      // Mobile configuration
      return {
        width: width - 32, // Account for padding
        height: 200,
        margin: { top: 10, right: 10, bottom: 40, left: 40 },
        showLegend: false,
        tickFormat: 'short',
      };
    } else if (width < 768) {
      // Tablet configuration
      return {
        width: width - 48,
        height: 300,
        margin: { top: 20, right: 20, bottom: 50, left: 50 },
        showLegend: true,
        tickFormat: 'medium',
      };
    } else {
      // Desktop configuration
      return {
        width: width - 64,
        height: 400,
        margin: { top: 20, right: 30, bottom: 60, left: 60 },
        showLegend: true,
        tickFormat: 'full',
      };
    }
  }, [width]);

  return (
    <div ref={containerRef} className="w-full">
      <ResponsiveContainer width="100%" height={chartConfig.height}>
        <LineChart
          data={data}
          margin={chartConfig.margin}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(value) => formatTick(value, chartConfig.tickFormat)}
          />
          <YAxis />
          <Tooltip 
            contentStyle={{
              fontSize: width < 480 ? '12px' : '14px',
              padding: width < 480 ? '8px' : '12px',
            }}
          />
          {chartConfig.showLegend && <Legend />}
          <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Hook for measuring element size
function useElementSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return size;
}
```

### 2. Mobile-Optimized Tables

```typescript
// Responsive table that adapts to mobile
function ResponsiveEventTable({ events }: { events: Event[] }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileCardList events={events} />;
  }

  return <DesktopTable events={events} />;
}

// Mobile card-based layout
function MobileCardList({ events }: { events: Event[] }) {
  return (
    <div className="space-y-3 p-4">
      {events.map(event => (
        <div key={event.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-sm">{event.toolName}</h3>
            <StatusBadge status={event.status} size="sm" />
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {event.description}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatTime(event.timestamp)}</span>
            <span>{event.duration}ms</span>
          </div>
          
          {/* Expandable details */}
          <details className="mt-3">
            <summary className="text-xs text-blue-600 cursor-pointer">
              View Details
            </summary>
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
              <pre className="whitespace-pre-wrap overflow-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

// Desktop table layout
function DesktopTable({ events }: { events: Event[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-4">Tool</th>
            <th className="text-left p-4">Description</th>
            <th className="text-left p-4">Status</th>
            <th className="text-left p-4">Timestamp</th>
            <th className="text-left p-4">Duration</th>
            <th className="text-left p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-4 font-medium">{event.toolName}</td>
              <td className="p-4 text-gray-600 dark:text-gray-400">{event.description}</td>
              <td className="p-4"><StatusBadge status={event.status} /></td>
              <td className="p-4 text-sm">{formatTime(event.timestamp)}</td>
              <td className="p-4 text-sm">{event.duration}ms</td>
              <td className="p-4">
                <button className="text-blue-600 hover:text-blue-800 text-sm">
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Performance Optimization for Mobile

### 1. Virtual Scrolling for Large Lists

```typescript
import { FixedSizeList as List } from 'react-window';

function VirtualizedEventList({ events }: { events: Event[] }) {
  const [containerHeight, setContainerHeight] = useState(400);
  const itemHeight = 80;

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight;
      const availableHeight = vh - 200; // Account for header/footer
      setContainerHeight(Math.min(600, Math.max(300, availableHeight)));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const EventItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const event = events[index];
    
    return (
      <div style={style} className="px-4 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{event.toolName}</p>
            <p className="text-sm text-gray-500 truncate">{event.description}</p>
          </div>
          <StatusBadge status={event.status} />
        </div>
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <List
        height={containerHeight}
        itemCount={events.length}
        itemSize={itemHeight}
        overscanCount={5}
      >
        {EventItem}
      </List>
    </div>
  );
}
```

### 2. Lazy Loading Components

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const AdvancedChart = lazy(() => import('./AdvancedChart'));
const DetailedAnalytics = lazy(() => import('./DetailedAnalytics'));

function DashboardWithLazyLoading() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <Suspense fallback={<ComponentSkeleton />}>
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'analytics' && <DetailedAnalytics />}
        {activeTab === 'charts' && <AdvancedChart />}
      </Suspense>
    </div>
  );
}

function ComponentSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
```

## Accessibility and Mobile UX

### 1. Keyboard Navigation

```typescript
function AccessibleDashboard() {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Custom tab navigation for complex layouts
      e.preventDefault();
      const focusableElements = getFocusableElements();
      const currentIndex = focusableElements.findIndex(el => el.id === focusedElement);
      const nextIndex = e.shiftKey 
        ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
        : (currentIndex + 1) % focusableElements.length;
      
      const nextElement = focusableElements[nextIndex];
      nextElement.focus();
      setFocusedElement(nextElement.id);
    }
  };

  return (
    <div 
      onKeyDown={handleKeyDown}
      className="dashboard"
      role="main"
      aria-label="Dashboard"
    >
      {/* Skip to content link for screen readers */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-blue-600 text-white p-2 rounded"
      >
        Skip to main content
      </a>

      {/* Accessible navigation */}
      <nav role="navigation" aria-label="Dashboard navigation">
        <ul className="space-y-2">
          {NAVIGATION_ITEMS.map(item => (
            <li key={item.id}>
              <button
                id={`nav-${item.id}`}
                className="w-full text-left p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-current={focusedElement === item.id ? 'page' : undefined}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content with proper landmarks */}
      <main id="main-content" role="main">
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">Metrics Overview</h2>
          <MetricCards />
        </section>

        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="text-lg font-semibold mb-4">
            Recent Events
          </h2>
          <EventTable />
        </section>
      </main>
    </div>
  );
}
```

### 2. Screen Reader Support

```typescript
// Live region for announcing updates
function LiveRegion() {
  const [announcement, setAnnouncement] = useState('');

  const announce = (message: string) => {
    setAnnouncement(message);
    // Clear after announcement to avoid repetition
    setTimeout(() => setAnnouncement(''), 1000);
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

// Event updates with screen reader announcements
function EventStream() {
  const { events, isLoading } = useEvents();
  const announceRef = useRef<(message: string) => void>();

  useEffect(() => {
    if (events.length > 0) {
      const latestEvent = events[0];
      announceRef.current?.(
        `New ${latestEvent.type} event from ${latestEvent.toolName}`
      );
    }
  }, [events]);

  return (
    <div>
      <LiveRegion ref={announceRef} />
      
      <div role="log" aria-label="Event stream">
        {events.map(event => (
          <div
            key={event.id}
            role="article"
            aria-labelledby={`event-${event.id}-title`}
            className="border-b p-4"
          >
            <h3 id={`event-${event.id}-title`} className="font-medium">
              {event.toolName}
            </h3>
            <p className="text-sm text-gray-600">{event.description}</p>
            <time dateTime={event.timestamp.toISOString()}>
              {formatTime(event.timestamp)}
            </time>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Best Practices Summary

### 1. Layout Strategy
- **Mobile-first approach**: Start with mobile constraints, enhance for larger screens
- **Container queries**: Use for component-level responsiveness independent of viewport
- **CSS Grid**: Implement complex layouts that adapt across breakpoints
- **Flexible spacing**: Use relative units and responsive spacing scales

### 2. Touch Interactions
- **Minimum 44px touch targets**: Ensure adequate size for touch interactions
- **Swipe gestures**: Implement for mobile table actions and navigation
- **Visual feedback**: Provide immediate response to touch interactions
- **Prevent accidental interactions**: Use appropriate touch-action CSS properties

### 3. Performance Optimization
- **Virtual scrolling**: For large data sets to maintain performance
- **Lazy loading**: Load components and images only when needed
- **Component memoization**: Prevent unnecessary re-renders
- **Responsive images**: Serve appropriate image sizes for different screens

### 4. Accessibility
- **Keyboard navigation**: Ensure all functionality is accessible via keyboard
- **Screen reader support**: Provide proper ARIA labels and live regions
- **Focus management**: Maintain logical focus order and visible focus indicators
- **Semantic HTML**: Use proper landmarks and heading hierarchy

### 5. Data Visualization
- **Adaptive charts**: Adjust chart size and complexity based on screen size
- **Touch-friendly interactions**: Implement touch gestures for chart navigation
- **Alternative views**: Provide table/list alternatives for complex visualizations
- **Progressive disclosure**: Show less detail on smaller screens, with drill-down options