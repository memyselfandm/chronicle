# MVP Implementation Backlog: Claude Code Observability System

## Overview
This MVP focuses on getting a basic observability system up and running quickly with minimal complexity. The goal is to capture core events and display them in real-time using only Next.js and Supabase.

**MVP Constraints:**
- Single user deployment (no SaaS complexity)
- Minimal third-party dependencies (Next.js + Supabase only)
- 2-3 week implementation timeline
- Essential features only

---

## 🔧 MVP HOOKS SYSTEM 

### Feature H1: Basic Database Schema
**Description**: Simple Supabase PostgreSQL schema to store events and sessions.

**Technical Requirements**:
- PostgreSQL database with real-time subscriptions enabled
- Minimal table structure focused on essential data capture
- Basic indexes for query performance

**Detailed Tasks**:

**H1.1: Database Design & Setup** ✅ **COMPLETED**
- [x] Create Supabase project and obtain connection credentials
- [x] Design and create `sessions` table with fields:
  - `id` (UUID, primary key)
  - `claude_session_id` (TEXT, unique, indexed)
  - `project_path` (TEXT)
  - `git_branch` (TEXT, nullable)
  - `start_time` (TIMESTAMPTZ)
  - `end_time` (TIMESTAMPTZ, nullable)
  - `created_at` (TIMESTAMPTZ, default now())

**H1.2: Events Table Creation** ✅ **COMPLETED**
- [x] Create `events` table with fields:
  - `id` (UUID, primary key)
  - `session_id` (UUID, foreign key to sessions.id)
  - `event_type` (TEXT, indexed) - values: 'prompt', 'tool_use', 'session_start', 'session_end'
  - `timestamp` (TIMESTAMPTZ, indexed)
  - `data` (JSONB) - flexible storage for event-specific data
  - `tool_name` (TEXT, nullable, indexed) - for tool_use events
  - `duration_ms` (INTEGER, nullable) - for tool_use events
  - `created_at` (TIMESTAMPTZ, default now())

**H1.3: Database Configuration** ✅ **COMPLETED**
- [x] Enable Row Level Security (RLS) with basic policies allowing all operations (single-user deployment)
- [x] Create indexes: `idx_events_session_timestamp` on (session_id, timestamp DESC)
- [x] Enable real-time subscriptions on both tables
- [x] Create database connection configuration file at `apps/hooks/config/database.py`

**Acceptance Criteria**:
- Database schema supports all MVP event types
- Real-time subscriptions work for both tables
- Connection configuration is environment-variable based

---

### Feature H2: Core Hook Architecture
**Description**: Minimal Python hook framework with Supabase-only integration.

**Technical Requirements**:
- Python 3.8+ compatibility
- Supabase Python client integration
- Error handling with graceful degradation
- Session context management

**Detailed Tasks**:

**H2.1: Base Hook Class Implementation** ✅ **COMPLETED**
- [x] Create `apps/hooks/src/base_hook.py` with BaseHook class containing:
  - `__init__()` method for database client initialization
  - `get_session_id()` method to extract Claude session ID from environment
  - `load_project_context()` method to capture basic project info (cwd, git branch)
  - `save_event()` method for database operations with error handling
  - `log_error()` method for debugging (writes to local file)

**H2.2: Database Client Wrapper** ✅ **COMPLETED**
- [x] Create `apps/hooks/src/database.py` with SupabaseClient wrapper:
  - Connection initialization with retry logic
  - `upsert_session()` method for session creation/update
  - `insert_event()` method with validation
  - Connection health checks and error recovery
  - Environment variable configuration (SUPABASE_URL, SUPABASE_ANON_KEY)

**H2.3: Utilities and Common Functions** ✅ **COMPLETED**
- [x] Create `apps/hooks/src/utils.py` with:
  - `sanitize_data()` function to remove sensitive information (API keys, file paths containing user info)
  - `extract_session_context()` function to get Claude session info from environment
  - `validate_json()` function for input validation
  - `get_git_info()` function to safely extract git branch/commit info

**H2.4: Configuration Management** ✅ **COMPLETED**
- [x] Create `apps/hooks/config/settings.py` for configuration constants
- [x] Create `apps/hooks/.env.template` file with required environment variables
- [x] Create `apps/hooks/requirements.txt` with minimal dependencies: supabase, python-dotenv

**Acceptance Criteria**:
- BaseHook class can be imported and initialized successfully
- Database connection works with proper error handling
- Session context extraction works in Claude Code environment
- All utilities handle edge cases gracefully

---

### Feature H3: Essential Event Capture
**Description**: Capture only the most critical events to prove the concept.

**Technical Requirements**:
- Integration with Claude Code's hook system
- JSON input/output processing for Claude Code hook format
- Minimal performance impact (<50ms per hook execution)

**Detailed Tasks**:

**H3.1: User Prompt Capture Hook**
- [ ] Create `hooks/user_prompt_submit.py` with:
  - Parse Claude Code input JSON to extract prompt text and metadata
  - Capture prompt length, timestamp, and session context
  - Store as event_type='prompt' with data containing: {prompt_text, prompt_length, context}
  - Handle both direct prompts and follow-up messages
  - Output original JSON unchanged (pass-through behavior)

**H3.2: Tool Usage Tracking Hook**
- [ ] Create `hooks/post_tool_use.py` with:
  - Parse Claude Code tool execution results
  - Extract tool name, execution duration, success/failure status
  - Capture result size and any error messages
  - Store as event_type='tool_use' with data containing: {tool_name, duration_ms, success, result_size, error}
  - Identify and log MCP tools vs built-in tools
  - Handle timeout scenarios and partial results

**H3.3: Session Lifecycle Tracking**
- [ ] Create `hooks/session_start.py` with:
  - Extract project context (working directory, git branch if available)
  - Generate or retrieve session ID from Claude Code environment
  - Create session record in database with start_time
  - Store as event_type='session_start' with data containing: {project_path, git_branch, git_commit}

**H3.4: Session End Tracking**  
- [ ] Create `hooks/stop.py` with:
  - Update existing session record with end_time
  - Calculate total session duration
  - Store as event_type='session_end' with data containing: {duration_ms, events_count}
  - Handle cases where session_start wasn't captured

**H3.5: Hook Integration Files**
- [ ] Create installation script `hooks/install.py` to:
  - Copy hook files to appropriate Claude Code hooks directory
  - Update Claude Code settings.json to register all hooks
  - Validate hook registration and permissions
  - Test database connection

**Acceptance Criteria**:
- All hooks execute successfully without breaking Claude Code functionality
- Events appear in database within 2 seconds of hook execution
- Hooks handle malformed input gracefully
- Session tracking works across Claude Code restarts

---

## 🖥️ MVP DASHBOARD SYSTEM

### Feature D1: Basic Next.js Setup
**Description**: Simple Next.js application with TypeScript and basic styling.

**Technical Requirements**:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for minimal styling
- Responsive design for desktop and mobile

**Detailed Tasks**:

**D1.1: Project Initialization** ✅ **COMPLETED**
- [x] Create Next.js project in `apps/dashboard/` with TypeScript, Tailwind, ESLint, and App Router
- [x] Configure `next.config.ts` for development settings
- [x] Set up `.env.local.template` with required environment variables
- [x] Install dependencies: `@supabase/supabase-js`, `date-fns` for date formatting
- [x] Configure TypeScript strict mode in `tsconfig.json`

**D1.2: Basic Layout Structure** ✅ **COMPLETED**
- [x] Create `app/layout.tsx` with:
  - Dark theme configuration using Tailwind dark classes
  - Basic meta tags and title
  - Root HTML structure with proper font loading
- [x] Create `app/page.tsx` as main dashboard page
- [x] Create `components/layout/Header.tsx` with:
  - Chronicle title and logo area
  - Connection status indicator
  - Basic navigation (future-ready but minimal for MVP)

**D1.3: Component Foundation** ✅ **COMPLETED**
- [x] Create `components/ui/` directory with basic components:
  - `Button.tsx` with variants (primary, secondary, ghost)
  - `Card.tsx` for event cards with proper spacing
  - `Badge.tsx` for event type indicators
  - `Modal.tsx` for event details overlay
- [x] Create `lib/utils.ts` for common utilities (date formatting, classname helpers)
- [x] Set up basic Tailwind config with custom colors for dark theme

**Acceptance Criteria**:
- Next.js development server runs without errors
- All UI components render correctly in dark theme
- Layout is responsive on mobile and desktop
- TypeScript compilation succeeds

---

### Feature D2: Supabase Integration  
**Description**: Connect to Supabase with real-time event subscriptions.

**Technical Requirements**:
- Supabase client configuration with proper types
- Real-time subscriptions for events table
- Basic error handling and connection recovery
- Environment-based configuration

**Detailed Tasks**:

**D2.1: Supabase Client Setup**
- [ ] Create `lib/supabase.ts` with:
  - Supabase client initialization using environment variables
  - TypeScript types for database schema (generated or manual)
  - Connection configuration for real-time subscriptions
- [ ] Create database types in `lib/types.ts`:
  - `Session` interface matching database schema
  - `Event` interface with proper JSONB data typing
  - `EventType` enum for 'prompt', 'tool_use', 'session_start', 'session_end'

**D2.2: Data Fetching Hooks**
- [ ] Create `hooks/useEvents.ts` custom hook with:
  - `useState` for events array and loading states
  - `useEffect` for initial data fetch and real-time subscription setup
  - Event sorting by timestamp (newest first)
  - Basic error handling with retry mechanism
- [ ] Create `hooks/useSessions.ts` custom hook for:
  - Active sessions list with status indicators
  - Session summary data (event counts, duration)

**D2.3: Real-time Event Processing**
- [ ] Implement real-time subscription in `useEvents` hook:
  - Subscribe to `events` table INSERT operations
  - Handle new events with proper state updates
  - Implement event deduplication (prevent duplicate events)
  - Add automatic scrolling to new events
- [ ] Create `lib/eventProcessor.ts` for:
  - Event data transformation and validation
  - Sanitization of sensitive data before display
  - Event grouping by session

**Acceptance Criteria**:
- Dashboard connects to Supabase successfully
- Real-time events appear within 3 seconds of database insertion
- Error handling prevents crashes on connection issues
- Event data is properly typed and validated

---

### Feature D3: Simple Event Display
**Description**: Basic event list showing real-time activity.

**Technical Requirements**:
- Scrollable event feed with newest events first
- Basic filtering by event type
- Event detail modal for expanded view
- Simple animations for new events

**Detailed Tasks**:

**D3.1: Event Feed Component**
- [ ] Create `components/EventFeed.tsx` with:
  - Scrollable container with proper height management
  - Event cards displaying: timestamp, event type, session info, basic data preview
  - Loading states and empty state messaging
  - Auto-scroll to top when new events arrive (with user override)

**D3.2: Event Card Component**
- [ ] Create `components/EventCard.tsx` with:
  - Color-coded badges for different event types (prompt=blue, tool_use=green, session=purple)
  - Timestamp formatting using `date-fns` (relative time + absolute on hover)
  - Session ID display with truncation for long IDs
  - Click handler to open event detail modal
  - Subtle hover effects and animations

**D3.3: Event Filtering**
- [ ] Create `components/EventFilter.tsx` with:
  - Simple dropdown/checkbox group for event type filtering
  - "Show All" option that's selected by default
  - Filter state management using React useState
  - Apply filters to event list in real-time
- [ ] Update `useEvents` hook to accept filter parameters
- [ ] Implement client-side filtering (server-side filtering in future roadmap)

**D3.4: Event Detail Modal**
- [ ] Create `components/EventDetailModal.tsx` with:
  - Full event data display in formatted JSON
  - Session context information (project path, git branch if available)
  - Related events timeline (other events from same session)
  - Proper modal overlay with click-outside-to-close
  - Copy to clipboard functionality for event data

**D3.5: Real-time Animations**
- [ ] Add CSS transitions for new event appearance:
  - Fade-in animation for new event cards
  - Subtle highlight pulse for newly arrived events
  - Smooth scroll behavior when auto-scrolling to new events
- [ ] Implement connection status indicator:
  - Green dot when connected and receiving real-time updates
  - Yellow/red dots for connection issues
  - Display last update timestamp

**Acceptance Criteria**:
- Event feed displays all types of events correctly
- Filtering works without performance issues
- Event detail modal shows complete event information
- New events animate in smoothly
- Interface remains responsive with 100+ events displayed

---

## 🚀 MVP IMPLEMENTATION PLAN

### Sprint 1: Foundation (Days 1-5)
**Sprint Goal**: Establish database schema and basic infrastructure

**Parallel Development Tracks:**

**🗄️ Database Track** (Dependencies: None)
- H1.1: Database Design & Setup
- H1.2: Events Table Creation  
- H1.3: Database Configuration

**🏗️ Frontend Foundation Track** (Dependencies: None - can use mock data)
- D1.1: Project Initialization
- D1.2: Basic Layout Structure
- D1.3: Component Foundation

**🏗️ Hook Architecture Track** (Dependencies: None - foundation work)
- H2.1: Base Hook Class Implementation  
- H2.2: Database Client Wrapper
- H2.3: Utilities and Common Functions
- H2.4: Configuration Management

**Sprint 1 Deliverables:** ✅ **COMPLETED**
- Working Supabase database with proper schema and SQLite fallback
- Next.js application with Chronicle dark theme UI components
- Python hook architecture with comprehensive testing
- Test-driven development foundation with 42+ passing tests

**Sprint 1 Actual Results:**
- **Database**: Fully implemented with dual Supabase/SQLite support, 20 passing tests
- **Frontend**: Complete Next.js foundation with Chronicle branding, 22 passing tests  
- **Hook Architecture**: BaseHook class, database abstraction, utilities with comprehensive error handling
- **Extra Value**: Auto-failover, data sanitization, git integration, responsive design

---

### Sprint 2: Core Systems (Days 6-10) ✅ **COMPLETED**
**Sprint Goal**: Implement data collection and basic dashboard functionality

**Parallel Development Tracks:**

**🔗 Hook Implementation Track** ✅ **COMPLETED**
- H3.1: User Prompt Capture Hook ✅ **COMPLETED** - 17 passing tests
- H3.2: Tool Usage Tracking Hook ✅ **COMPLETED** - 12 passing tests
- H3.3: Session Lifecycle Tracking ✅ **COMPLETED** - 15 passing tests
- H3.4: Session End Tracking ✅ **COMPLETED** - 11 passing tests
- H3.5: Hook Integration Files ✅ **COMPLETED** - Installation system ready

**📊 Dashboard Integration Track** ✅ **COMPLETED**
- D2.1: Supabase Client Setup ✅ **COMPLETED**
- D2.2: Data Fetching Hooks ✅ **COMPLETED**
- D2.3: Real-time Event Processing ✅ **COMPLETED**

**🎨 UI Components Track** ✅ **COMPLETED**
- D3.1: Event Feed Component ✅ **COMPLETED** - 25 passing tests
- D3.2: Event Card Component ✅ **COMPLETED** - 12 passing tests
- D3.3: Event Filtering ✅ **COMPLETED** - 16 passing tests

**Sprint 2 Deliverables:** ✅ **ALL COMPLETED**
- All 4 essential hooks implemented with comprehensive test coverage (55+ tests)
- Dashboard connected to Supabase with real-time subscriptions
- Core UI components built with mock data integration
- Hook installation system ready for deployment

**Sprint 2 Actual Results:**
- **Hooks**: Complete event capture system with user prompts, tool usage, session lifecycle tracking
- **Dashboard**: Full Supabase integration with real-time event processing and data sanitization
- **UI Components**: EventFeed, EventCard, and EventFilter with comprehensive test coverage
- **Extra Value**: Installation automation, cross-platform support, accessibility compliance, TDD methodology

---

### Sprint 3: Event Capture & Display (Days 11-15) ✅ **MOSTLY COMPLETED**
**Sprint Goal**: Complete MVP functionality with working hooks and event display

**Parallel Development Tracks:**

**📝 Event Collection Track** ✅ **COMPLETED** (Dependencies: H2 complete)
- H3.1: User Prompt Capture Hook ✅ **COMPLETED** 
- H3.2: Tool Usage Tracking Hook ✅ **COMPLETED**
- H3.3: Session Lifecycle Tracking ✅ **COMPLETED**
- H3.4: Session End Tracking ✅ **COMPLETED**
- H3.5: Hook Integration Files ✅ **COMPLETED**

**🖥️ Event Visualization Track** ⚠️ **PARTIALLY COMPLETED** (Dependencies: D2 complete)
- D3.1: Event Feed Component ✅ **COMPLETED**
- D3.2: Event Card Component ✅ **COMPLETED**
- D3.3: Event Filtering ✅ **COMPLETED**
- D3.4: Event Detail Modal 🔄 **PENDING** - Ready for next sprint
- D3.5: Real-time Animations 🔄 **PENDING** - Ready for next sprint

**Sprint 3 Status:**
- All essential hooks capturing events successfully ✅ **COMPLETED**
- Core event dashboard with filtering ✅ **COMPLETED**
- Real-time data integration foundation ✅ **COMPLETED**
- Event detail modal and animations ⏭️ **DEFERRED TO NEXT SPRINT**

---

### Sprint 4: Integration & Polish (Days 16-20)
**Sprint Goal**: End-to-end testing, documentation, and deployment readiness

**Sequential Tasks** (No parallelization - integration work):
- End-to-end testing with real Claude Code sessions
- Performance testing and optimization
- Error handling validation and edge case testing
- Basic installation documentation
- Simple deployment guide creation
- User configuration template creation

**Sprint 4 Deliverables:**
- Fully functional MVP tested with Claude Code
- Installation and deployment documentation
- MVP ready for individual user deployment

---

## 🔄 PARALLELIZATION STRATEGY

### Maximum Parallel Development
**2-3 teams can work simultaneously throughout most sprints:**

**Team 1: Backend/Infrastructure**
- Sprint 1: Database schema (H1)
- Sprint 2: Hook architecture (H2)  
- Sprint 3: Hook implementations (H3)

**Team 2: Frontend/UI**
- Sprint 1: Next.js foundation (D1)
- Sprint 2: Supabase integration (D2)
- Sprint 3: Event display components (D3)

**Team 3: Integration/Testing** (joins in Sprint 2)
- Sprint 2: Testing infrastructure setup
- Sprint 3: Component integration testing
- Sprint 4: End-to-end testing and documentation

### Critical Dependencies
1. **H1 (Database) → H2 (Hooks Architecture)**: Database schema must be complete before hook implementation
2. **H1 (Database) → D2 (Dashboard Integration)**: Database must exist before frontend integration
3. **H2 (Hooks Architecture) → H3 (Event Capture)**: Base classes needed before specific hook implementation
4. **D2 (Dashboard Integration) → D3 (Event Display)**: Data layer needed before UI components

### Risk Mitigation
- **Frontend can start immediately** with mock data and basic UI components
- **Database design is critical path** - any delays here impact both tracks
- **Hook architecture is foundational** - invest extra time in Sprint 2 to get this right
- **Integration testing should start early** in Sprint 3 to catch issues quickly

### Sprint Success Criteria

**Sprint 1 Success:**
- Database accepts manual event inserts
- Next.js dev server runs with basic UI
- Both teams can continue work independently

**Sprint 2 Success:**
- BaseHook class successfully connects to database
- Dashboard displays real-time events from database
- Mock events can flow end-to-end

**Sprint 3 Success:**
- All hooks capture events during actual Claude Code usage
- Dashboard shows all event types with proper formatting
- Filtering and modal functionality works correctly

**Sprint 4 Success:**
- Complete MVP works in real user environment
- Installation process takes <30 minutes
- System handles normal Claude Code workload without issues

---

## 📝 MVP SUCCESS CRITERIA

### Core Functionality
- Captures user prompts, tool usage, and session lifecycle
- Real-time dashboard shows events as they happen
- Individual users can deploy their own instance
- Works with only Next.js and Supabase dependencies

### Technical Requirements  
- Events appear in dashboard within 3 seconds of hook execution
- System works reliably during normal Claude Code usage
- Simple deployment process (< 30 minutes setup)