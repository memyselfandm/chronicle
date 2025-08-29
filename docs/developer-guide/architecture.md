# Chronicle System Architecture

## Overview

Chronicle is a comprehensive observability system for Claude Code that captures, processes, and visualizes agent activities in real-time. The system follows a modular architecture with clear separation between data collection (hooks), processing (server), storage (database), and presentation (dashboard).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Claude Code                            │
│  ┌───────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │  Tool Usage   │────│  User Input  │────│   Agent Logic   │  │
│  └───────────────┘    └──────────────┘    └─────────────────┘  │
│         │                     │                     │          │
│         ▼                     ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Chronicle Hooks                           │ │
│  │    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ │
│  │    │ Tool Hooks   │  │ Input Hooks  │  │ Session Hooks │   │ │
│  │    └──────────────┘  └──────────────┘  └──────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/JSON Events
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Chronicle Server                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   FastAPI    │  │  WebSocket   │  │    Event     │          │
│  │   Server     │  │   Manager    │  │  Processor   │          │
│  │  (Port 8510) │  └──────────────┘  └──────────────┘          │
│  └──────────────┘          │                │                  │
│         │                  │                │                  │
│         ▼                  ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Database Layer                             │ │
│  │    ┌──────────────┐              ┌──────────────┐          │ │
│  │    │    SQLite    │      OR      │   Supabase   │          │ │
│  │    │  (Default)   │              │ (PostgreSQL) │          │ │
│  │    └──────────────┘              └──────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Real-time Updates
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Chronicle Dashboard                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │  Real-time   │  │  Analytics   │          │
│  │  Frontend    │  │   Events     │  │    Views     │          │
│  │ (Port 3000)  │  │  (WebSocket) │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Hook System (`apps/hooks/`)

The hook system integrates directly with Claude Code to capture events at key execution points.

```
apps/hooks/
├── src/
│   ├── hooks/           # Event capture hooks
│   │   ├── session_start.py      # Session lifecycle
│   │   ├── user_prompt_submit.py # User interactions
│   │   ├── pre_tool_use.py       # Before tool execution
│   │   ├── post_tool_use.py      # After tool execution
│   │   └── stop.py               # Session termination
│   │
│   └── lib/             # Shared libraries
│       ├── base_hook.py          # Hook base class
│       ├── database.py           # Database abstraction
│       ├── utils.py              # Utility functions
│       └── security.py           # Data sanitization
│
├── config/              # Configuration management
│   ├── settings.py      # Environment settings
│   └── database.py      # Database configuration
│
└── scripts/             # Installation and maintenance
    ├── install.py       # Hook installation
    └── validate_environment.py
```

#### Hook Execution Flow

```python
# Hook execution sequence for tool usage:

1. user_prompt_submit.py    # Captures user input
   ↓
2. pre_tool_use.py         # Before tool execution
   ↓
3. [Tool Execution]        # Claude Code tool runs
   ↓
4. post_tool_use.py        # After tool execution
   ↓
5. Database Storage        # Event persisted
   ↓
6. Real-time Broadcast     # WebSocket notification
```

### 2. Server Architecture (`apps/server/`)

High-performance FastAPI server that brokers data between hooks and dashboard.

```
apps/server/
├── main.py              # FastAPI application & lifecycle
├── api_endpoints.py     # REST API routes
├── websocket.py         # WebSocket connection manager
├── event_broadcaster.py # Real-time event streaming
├── database.py          # Database operations
└── demo_server.py       # Development/testing server
```

#### Server Components

**FastAPI Application (`main.py`):**
- HTTP/WebSocket server on localhost:8510
- CORS middleware for dashboard access
- Graceful shutdown handling
- Health monitoring endpoints
- Request/response logging

**API Layer (`api_endpoints.py`):**
```python
# REST API endpoints:
GET  /health              # Health check
GET  /api/info            # Server information
GET  /api/stats           # Performance metrics
GET  /api/sessions        # Session list
GET  /api/sessions/{id}   # Session details
GET  /api/sessions/{id}/events  # Session events
WS   /ws                  # WebSocket endpoint
SSE  /api/events/stream   # Server-Sent Events
```

**WebSocket Manager (`websocket.py`):**
```python
class ChronicleWebSocketServer:
    - Connection management
    - Client subscription filtering
    - Heartbeat/ping-pong handling
    - Graceful disconnection
    - Broadcasting to multiple clients
```

**Event Broadcaster (`event_broadcaster.py`):**
```python
class EventBroadcaster:
    - Database change monitoring
    - Real-time event filtering
    - WebSocket message formatting
    - Rate limiting and queuing
```

### 3. Database Layer

Chronicle supports two database backends with consistent interfaces.

#### SQLite Backend (Default)
```
Database File: ~/.claude/hooks/chronicle/data/chronicle.db

Schema:
├── sessions              # Session metadata
│   ├── session_id (PK)
│   ├── created_at
│   ├── ended_at
│   └── metadata
│
├── events               # Event records
│   ├── id (PK)
│   ├── session_id (FK)
│   ├── timestamp
│   ├── event_type
│   ├── tool_name
│   └── metadata (JSON)
│
└── session_summaries    # Aggregated session data
    ├── session_id (PK)
    ├── event_count
    ├── duration
    └── summary
```

#### Supabase Backend (Optional)
```
PostgreSQL with real-time subscriptions:
- Row Level Security (RLS)
- Real-time table subscriptions
- Built-in backup and scaling
- Multi-user support
```

#### Database Abstraction Layer

```python
# Unified database interface
class DatabaseInterface:
    def get_sessions(limit: int) -> List[Session]
    def get_session(session_id: str) -> Session
    def get_events(session_id: str) -> List[Event]
    def store_event(event: Event) -> bool
    def get_performance_stats() -> Dict
```

### 4. Dashboard Architecture (`apps/dashboard/`)

Modern React-based dashboard with real-time updates.

```
apps/dashboard/
├── src/
│   ├── app/             # Next.js 15 App Router
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main dashboard page
│   │
│   ├── components/      # React components
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── EventFeed.tsx          # Real-time event list
│   │   ├── SessionList.tsx        # Session management
│   │   └── MetricsDisplay.tsx     # Performance metrics
│   │
│   ├── hooks/           # Custom React hooks
│   │   ├── useEvents.ts           # Event data management
│   │   ├── useSessions.ts         # Session data management
│   │   └── useConnectionStatus.ts # WebSocket connectivity
│   │
│   ├── lib/             # Utility libraries
│   │   ├── backend/               # Backend abstraction
│   │   │   ├── LocalBackend.ts    # Local server backend
│   │   │   └── SupabaseBackend.ts # Supabase backend
│   │   ├── config.ts              # Configuration management
│   │   └── utils.ts               # Utility functions
│   │
│   └── stores/          # State management
│       └── dashboardStore.ts      # Zustand store
```

#### Component Hierarchy

```
Dashboard
├── Header
│   ├── ConnectionStatus
│   ├── MetricsDisplay
│   └── ThroughputIndicator
├── Sidebar
│   ├── SessionList
│   ├── FilterControls
│   └── AwaitingInput
└── MainContent
    ├── EventFeed
    │   ├── EventRow
    │   ├── EventDetails
    │   └── AutoScrollToggle
    └── EventDetailModal
```

## Data Flow Architecture

### 1. Event Capture Flow

```
Claude Code Operation
↓
Hook Triggered (pre_tool_use.py)
↓
Event Created & Sanitized
↓
HTTP POST to Server (/api/events)
↓
Server Validates & Stores Event
↓
Database Write (SQLite/Supabase)
↓
Event Broadcaster Notified
↓
WebSocket Broadcast to Clients
↓
Dashboard Real-time Update
```

### 2. Dashboard Data Flow

```
Dashboard Loads
↓
Fetch Initial Data (REST API)
├── Sessions List (/api/sessions)
├── Recent Events (/api/events)
└── System Stats (/api/stats)
↓
Establish WebSocket Connection
↓
Subscribe to Real-time Updates
↓
Render Components with Data
↓
[Real-time Event Received]
↓
Update State & Re-render
```

### 3. Session Lifecycle

```
Claude Code Session Starts
↓
session_start.py Hook Triggered
↓
Session Record Created
↓
[User Operations & Tool Usage]
↓
Multiple Events Generated
├── user_prompt_submit
├── pre_tool_use  
├── post_tool_use
└── notification (if applicable)
↓
Session Ends (stop.py)
↓
Session Summary Generated
↓
Dashboard Updates Session Status
```

## Technology Stack

### Backend Technologies
- **Python 3.8+**: Core runtime
- **FastAPI**: High-performance web framework
- **uvicorn**: ASGI server
- **SQLite**: Default database (file-based)
- **PostgreSQL/Supabase**: Optional cloud database
- **asyncio**: Asynchronous programming
- **Pydantic**: Data validation and serialization

### Frontend Technologies
- **Next.js 15**: React framework with App Router
- **React 18**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS v4**: Utility-first CSS
- **Recharts**: Data visualization
- **Zustand**: State management
- **SWR**: Data fetching and caching

### Development & Testing
- **pytest**: Python testing framework
- **Jest**: JavaScript testing framework
- **Playwright**: E2E testing
- **ESLint/Prettier**: Code formatting
- **Coverage.py**: Python code coverage

## Performance Architecture

### Optimization Strategies

**Database Optimization:**
- Indexed queries on session_id, timestamp, event_type
- WAL mode for SQLite concurrency
- Query optimization with EXPLAIN ANALYZE
- Connection pooling for Supabase

**Memory Management:**
- Event batching to reduce memory footprint
- Automatic cleanup at 80% memory threshold
- WebSocket connection limits
- Garbage collection optimization

**Network Optimization:**
- WebSocket compression
- Event filtering at source
- Efficient JSON serialization (ujson)
- Rate limiting and debouncing

**Frontend Optimization:**
- Virtual scrolling for large event lists
- React.memo for component optimization
- SWR caching for API responses
- Code splitting and lazy loading

### Scalability Considerations

**Horizontal Scaling:**
- SQLite: Single-node limitation
- Supabase: Cloud-native scaling
- Load balancing for multiple dashboard instances

**Vertical Scaling:**
- Memory-efficient event processing
- Database query optimization
- WebSocket connection pooling

## Security Architecture

### Data Protection

**Input Sanitization:**
```python
# Data sanitization pipeline:
Raw Event Data
↓
PII Detection & Removal
↓
Content Filtering
↓
JSON Structure Validation
↓
Safe Storage
```

**Network Security:**
- CORS protection for dashboard
- Trusted host middleware
- Local-only server binding (127.0.0.1)
- WebSocket connection validation

**Database Security:**
- File permissions for SQLite
- Row Level Security for Supabase
- Prepared statements for SQL injection prevention
- Audit logging for data access

## Deployment Architecture

### Development Environment
```
Local Development:
├── Dashboard: http://localhost:3000
├── Server: http://localhost:8510  
├── Database: Local SQLite file
└── Hooks: ~/.claude/hooks/chronicle/
```

### Production Environment
```
Production Deployment:
├── Dashboard: Vercel/Netlify
├── Server: Railway/Render/VPS
├── Database: Supabase Cloud
└── Hooks: User local installation
```

## Integration Points

### Claude Code Integration
- **Settings.json**: Hook registration
- **Hook Directory**: `~/.claude/hooks/chronicle/`
- **Event Capture**: Automatic on Claude operations
- **No Configuration**: Zero-config for end users

### External Integrations
- **Monitoring**: Prometheus metrics export
- **Logging**: Structured JSON logging
- **Backup**: Automated database backups
- **Analytics**: Event data export capabilities

## Extension Architecture

Chronicle is designed for extensibility:

### Custom Hooks
```python
# Create custom hooks by extending BaseHook
class CustomHook(BaseHook):
    def should_run(self, context):
        # Custom execution logic
        return True
        
    def execute(self, context):
        # Custom event processing
        event = self.create_event(context)
        self.store_event(event)
```

### Dashboard Plugins
```typescript
// Extend dashboard with custom components
interface DashboardPlugin {
    name: string;
    component: React.ComponentType;
    route: string;
}
```

### Backend Extensions
```python
# Custom event processors
class CustomEventProcessor:
    def process(self, event: Event) -> Event:
        # Custom processing logic
        return enhanced_event
```

This architecture provides a solid foundation for observability while maintaining flexibility for future enhancements and customizations.