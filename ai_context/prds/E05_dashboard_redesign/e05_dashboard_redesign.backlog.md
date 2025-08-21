# Chronicle Dashboard Redesign - Development Backlog

## Epic Overview

**Epic ID**: E05  
**Epic Name**: Chronicle Dashboard Redesign  
**Epic Goal**: Implement a focused, efficient monitoring interface for Claude Code instances with immediate visibility of sessions awaiting input

---

## Priority Definitions

- **P0**: Critical for MVP - Must have for launch
- **P1**: Important for MVP - Should have for launch
- **P2**: Nice to have - Can be delivered post-MVP
- **P3**: Future enhancement - Roadmap items

---

## Sprint Planning

### Sprint 1: Foundation & Setup
- Project setup and configuration
- Design system implementation
- Basic component structure

### Sprint 2: Sidebar Implementation
- Awaiting input section
- Project folders and sessions
- Preset filters

### Sprint 3: Event Feed & Header
- Header with metrics
- Event feed table
- Real-time updates

### Sprint 4: Integration & Polish
- Supabase integration
- Performance optimization
- Testing and bug fixes

---

## User Stories & Tasks

### 🎯 Epic Setup & Foundation

#### Story 1.1: Project Setup
**Priority**: P0  
**Points**: 3  
**As a** developer  
**I want** a properly configured Next.js project  
**So that** I can build the Chronicle Dashboard with TypeScript and modern tooling  

**Acceptance Criteria:**
- [ ] Next.js 14+ with App Router configured
- [ ] TypeScript with strict mode enabled
- [ ] Tailwind CSS with custom dark theme variables
- [ ] ESLint and Prettier configured
- [ ] Zustand store initialized
- [ ] Material Icons package installed

**Technical Tasks:**
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind with custom color palette
- [ ] Set up Zustand store structure
- [ ] Install and configure Material Icons
- [ ] Create base layout components
- [ ] Set up development environment variables

---

### 🎯 Sidebar Component

#### Story 2.1: Awaiting Input Section
**Priority**: P0  
**Points**: 5  
**As a** user monitoring Claude Code  
**I want** a pinned section showing all sessions awaiting input  
**So that** I can immediately see which sessions need my attention  

**Acceptance Criteria:**
- [ ] Pinned section at top of sidebar
- [ ] Dynamically grows/shrinks with content
- [ ] Shows sessions from all projects
- [ ] Yellow status indicators for awaiting
- [ ] Maximum height of 40vh to prevent overwhelming
- [ ] Smooth animations when sessions added/removed

**Technical Tasks:**
- [ ] Create AwaitingSection component
- [ ] Implement dynamic height calculation
- [ ] Add session filtering logic for awaiting status
- [ ] Style with yellow accent colors
- [ ] Add overflow scroll for many sessions
- [ ] Implement enter/exit animations

#### Story 2.2: Project Folders
**Priority**: P0  
**Points**: 5  
**As a** user with multiple projects  
**I want** collapsible project folders showing sessions  
**So that** I can organize and navigate my active sessions efficiently  

**Acceptance Criteria:**
- [ ] Projects displayed as collapsible folders
- [ ] Session count badges (e.g., "5 (2 awaiting)")
- [ ] Awaiting sessions bubble to top within folders
- [ ] Projects with awaiting sessions appear first
- [ ] Smooth expand/collapse animations
- [ ] Session format: "folder-name / branch #id"

**Technical Tasks:**
- [ ] Create ProjectFolder component
- [ ] Implement session grouping by project_path
- [ ] Add collapse/expand state management
- [ ] Sort logic for awaiting sessions
- [ ] Create SessionItem component
- [ ] Handle duplicate session identification

#### Story 2.3: Sidebar Controls
**Priority**: P0  
**Points**: 3  
**As a** user  
**I want** to collapse the sidebar and use preset filters  
**So that** I can maximize screen space and quickly filter sessions  

**Acceptance Criteria:**
- [ ] Sidebar toggle button with smooth animation
- [ ] Main content adjusts when sidebar collapses
- [ ] Preset filter buttons: All, Active, Awaiting, Errors, Recent
- [ ] Filter state reflected in event feed
- [ ] 220px width when expanded
- [ ] Keyboard shortcut for toggle (Cmd+B)

**Technical Tasks:**
- [ ] Create sidebar toggle mechanism
- [ ] Implement preset filter buttons
- [ ] Connect filters to global state
- [ ] Add keyboard shortcut handler
- [ ] Adjust main content grid on toggle
- [ ] Style active filter states

---

### 🎯 Header Component

#### Story 3.1: Header Metrics
**Priority**: P0  
**Points**: 3  
**As a** user  
**I want** to see key metrics in the header  
**So that** I can understand system status at a glance  

**Acceptance Criteria:**
- [ ] Active sessions count (green)
- [ ] Awaiting sessions count (yellow)
- [ ] Events per minute rate
- [ ] Connection status indicator
- [ ] All metrics right-aligned
- [ ] Based on variant 4 exact design

**Technical Tasks:**
- [ ] Create HeaderMetrics component
- [ ] Calculate real-time metrics from store
- [ ] Implement connection status monitoring
- [ ] Style with semantic colors
- [ ] Add throughput calculation
- [ ] Right-align all components

---

### 🎯 Event Feed

#### Story 4.1: Event Table Structure
**Priority**: P0  
**Points**: 5  
**As a** user  
**I want** a dense, scannable table of events  
**So that** I can monitor activity across all sessions  

**Acceptance Criteria:**
- [ ] Fixed column widths per specification
- [ ] 24px row height for optimal density
- [ ] Chronological order (newest first)
- [ ] Color coding with left border and subtle background
- [ ] Headers: Time, Session, Type, Tool, Details
- [ ] Variant 3 colors + Variant 5 typography

**Technical Tasks:**
- [ ] Create EventTable component
- [ ] Implement fixed table layout
- [ ] Add column headers with proper widths
- [ ] Create EventRow component
- [ ] Apply color coding styles
- [ ] Set up virtual scrolling for performance

#### Story 4.2: Event Feed Updates
**Priority**: P0  
**Points**: 5  
**As a** user  
**I want** real-time event updates  
**So that** I can see activity as it happens  

**Acceptance Criteria:**
- [ ] New events prepend to top
- [ ] Smooth animation for new events
- [ ] Optional auto-scroll toggle
- [ ] Maintain scroll position when auto-scroll off
- [ ] Batch updates to prevent flooding
- [ ] Handle 100-200 events/minute

**Technical Tasks:**
- [ ] Implement event prepending logic
- [ ] Add entry animations
- [ ] Create auto-scroll toggle
- [ ] Implement update batching (100ms)
- [ ] Optimize render performance
- [ ] Add scroll position preservation

#### Story 4.3: Session Filtering
**Priority**: P0  
**Points**: 3  
**As a** user  
**I want** to filter events by selected sessions  
**So that** I can focus on specific activity  

**Acceptance Criteria:**
- [ ] Single click on session filters event feed
- [ ] Ctrl/Cmd+click for multi-select
- [ ] Visual indication of selected sessions
- [ ] Clear selection button
- [ ] Filtered state persists during updates
- [ ] Filter badges show active filters

**Technical Tasks:**
- [ ] Add session selection to store
- [ ] Implement filter logic in event feed
- [ ] Create multi-select handlers
- [ ] Style selected session states
- [ ] Add filter badge component
- [ ] Connect to sidebar interactions

---

### 🎯 Data Integration

#### Story 5.1: Supabase Setup
**Priority**: P0  
**Points**: 5  
**As a** developer  
**I want** Supabase configured for real-time data  
**So that** the dashboard receives live updates  

**Acceptance Criteria:**
- [ ] Supabase client configured
- [ ] Real-time subscriptions established
- [ ] Event table queries optimized
- [ ] Session queries with proper filters
- [ ] Connection error handling
- [ ] Reconnection logic implemented

**Technical Tasks:**
- [ ] Configure Supabase client
- [ ] Set up event subscription
- [ ] Implement session fetching
- [ ] Add error boundaries
- [ ] Create reconnection strategy
- [ ] Add connection status monitoring

#### Story 5.2: Data Processing
**Priority**: P0  
**Points**: 5  
**As a** system  
**I need** to process Chronicle events correctly  
**So that** sessions show accurate status  

**Acceptance Criteria:**
- [ ] Parse all 9 event types
- [ ] Determine session status from events
- [ ] Handle sub-agent hierarchy
- [ ] Process notification awaiting state
- [ ] Calculate event rates
- [ ] Manage event history (1000 max)

**Technical Tasks:**
- [ ] Create event parser
- [ ] Implement status determination logic
- [ ] Build sub-agent detection
- [ ] Add awaiting state calculator
- [ ] Implement rate calculations
- [ ] Set up event cache management

---

### 🎯 Performance Optimization

#### Story 6.1: Virtual Scrolling
**Priority**: P1  
**Points**: 5  
**As a** user with many sessions  
**I want** smooth scrolling performance  
**So that** the UI remains responsive with 30+ sessions  

**Acceptance Criteria:**
- [ ] Virtual scroll for session list
- [ ] Virtual scroll for event feed
- [ ] 60fps scroll performance
- [ ] Overscan of 3 items
- [ ] Smooth scroll animations
- [ ] Handle dynamic item heights

**Technical Tasks:**
- [ ] Implement react-window or similar
- [ ] Configure virtual scroll parameters
- [ ] Add scroll performance monitoring
- [ ] Optimize render cycles
- [ ] Test with 30+ sessions
- [ ] Profile and optimize bottlenecks

#### Story 6.2: Update Batching
**Priority**: P1  
**Points**: 3  
**As a** system  
**I need** to batch rapid updates  
**So that** the UI doesn't freeze with high event rates  

**Acceptance Criteria:**
- [ ] Batch window of 100ms
- [ ] Queue events during batch window
- [ ] Single render per batch
- [ ] Maintain event order
- [ ] Handle 200 events/minute
- [ ] Smooth visual updates

**Technical Tasks:**
- [ ] Create event queue system
- [ ] Implement batch timer
- [ ] Add batch processor
- [ ] Optimize state updates
- [ ] Test with high event rates
- [ ] Add performance metrics

---

### 🎯 Polish & Testing

#### Story 7.1: Keyboard Navigation
**Priority**: P1  
**Points**: 3  
**As a** power user  
**I want** keyboard shortcuts  
**So that** I can navigate efficiently  

**Acceptance Criteria:**
- [ ] j/k for event feed navigation
- [ ] 1/2/3 for quick filters
- [ ] Cmd+B for sidebar toggle
- [ ] Escape to clear selection
- [ ] Space to expand event details
- [ ] Shortcuts documented in UI

**Technical Tasks:**
- [ ] Add keyboard event handlers
- [ ] Implement navigation logic
- [ ] Create shortcut manager
- [ ] Add visual focus indicators
- [ ] Create help modal
- [ ] Test all shortcuts

#### Story 7.2: Responsive Design
**Priority**: P2  
**Points**: 5  
**As a** user on different devices  
**I want** the dashboard to be responsive  
**So that** I can monitor sessions on any screen size  

**Acceptance Criteria:**
- [ ] Desktop layout (>1200px)
- [ ] Tablet layout (768-1200px)
- [ ] Mobile layout (<768px)
- [ ] Touch-friendly on mobile
- [ ] Collapsible sidebar on tablet
- [ ] Simplified event cards on mobile

**Technical Tasks:**
- [ ] Create responsive breakpoints
- [ ] Build mobile event card variant
- [ ] Add touch event handlers
- [ ] Test on various devices
- [ ] Optimize for tablet
- [ ] Create mobile navigation

---

## Future Features Backlog

### Phase 1: Comprehensive Filters
- [ ] Collapsible filter section in sidebar
- [ ] Multi-select dropdowns
- [ ] Filter presets
- [ ] URL-based filter sharing

### Phase 2: Search
- [ ] Full-text event search
- [ ] Session search
- [ ] Search highlighting
- [ ] Recent searches

### Phase 3: Tool Lifecycle
- [ ] Group pre/post tool events
- [ ] Collapsed view with details
- [ ] Duration indicators
- [ ] Success/failure badges

### Phase 4: Timeline
- [ ] Swimlane visualization
- [ ] 5-minute rolling window
- [ ] Horizontal scroll
- [ ] Event dots with colors

### Phase 5: Sub-agent Visualization
- [ ] Tree view for agents
- [ ] Execution boundaries
- [ ] Parent-child lines
- [ ] Expand/collapse states

---

## Dependencies

### External Dependencies
- Supabase database setup and schema
- Chronicle event producer implementation
- Authentication system (future)

### Technical Dependencies
- Next.js 14+ stable
- Supabase real-time stability
- Material Icons availability
- Browser WebSocket support

---

## Risk Mitigation

### Performance Risks
- **Risk**: UI freezing with high event rates
- **Mitigation**: Implement batching and virtual scrolling early

### Data Risks
- **Risk**: Missing or malformed events
- **Mitigation**: Add validation and error boundaries

### UX Risks
- **Risk**: Information overload with many sessions
- **Mitigation**: Strong filtering and organization features

---

## Definition of Done

### Story Completion
- [ ] Code implemented and reviewed
- [ ] Unit tests written (where applicable)
- [ ] Integration tested with real data
- [ ] Performance validated
- [ ] Accessibility checked
- [ ] Documentation updated

### Sprint Completion
- [ ] All P0 stories complete
- [ ] Performance benchmarks met
- [ ] No critical bugs
- [ ] Deployed to staging
- [ ] Stakeholder review passed

### MVP Completion
- [ ] All P0 and P1 stories complete
- [ ] Handles 30 sessions smoothly
- [ ] 200 events/minute without lag
- [ ] < 2 second initial load
- [ ] Real-time updates working
- [ ] Production deployment ready

---

This backlog provides a comprehensive roadmap for implementing the Chronicle Dashboard redesign, with clear priorities, acceptance criteria, and technical tasks for each user story.