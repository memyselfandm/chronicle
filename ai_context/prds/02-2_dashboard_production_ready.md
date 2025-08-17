# Chronicle Dashboard Production Ready Backlog

## Critical Context

**The hooks system underwent a major refactor in Sprints 1-10 that changed the database schema and event structure.**

### Key Changes from Hooks Refactor
1. **Table Names**: Changed from `sessions`/`events` to `chronicle_sessions`/`chronicle_events` (prefixed to avoid collisions)
2. **Event Types**: Changed from generic types to specific hook-based types:
   - Old: `prompt`, `tool_use`, `session`, `lifecycle`, `error`, `file_op`, `system`, `notification`
   - New: `session_start`, `notification`, `error`, `pre_tool_use`, `post_tool_use`, `user_prompt_submit`, `stop`, `subagent_stop`, `pre_compact`
3. **Session ID Field**: Uses `session_id` (snake_case) consistently, not `sessionId` (camelCase)
4. **ID Types**: Sessions and events use UUIDs, not simple strings
5. **New Fields**: Added `tool_name`, `duration_ms`, and structured `metadata` JSONB fields

### Current Dashboard Issues
1. **TypeError**: `Cannot read properties of undefined (reading 'length')` - AnimatedEventCard expects `sessionId` but data has `session_id`
2. **Wrong Table Names**: Dashboard queries `sessions`/`events` instead of `chronicle_sessions`/`chronicle_events`
3. **Incorrect Event Types**: Dashboard expects old event types that no longer exist
4. **Type Mismatches**: Dashboard interfaces don't match actual database schema

## Overview

This epic focuses on transforming the Chronicle Dashboard from a demo prototype to a production-ready observability tool. After completing the hooks refactor integration, we discovered the dashboard is running in pure demo mode with no real data connections.

### Primary Goals

**Phase 1: Schema Compatibility (Sprint 1) ✅**
1. **Fix Breaking Errors**: Resolve the TypeError and other runtime errors
2. **Update Database Queries**: Use correct table names with `chronicle_` prefix

**Phase 2: Production Readiness (Sprints 2-6)**
3. **Remove Demo Mode**: Replace demo EventDashboard with real data component
4. **Wire Real Data**: Connect dashboard to actual Supabase data streams
5. **Align Event Types**: Update to new hook-based event type system
6. **Fix Type Definitions**: Ensure TypeScript interfaces match actual database schema
7. **Real Connection Status**: Monitor actual Supabase connection state
8. **Production UI**: Remove demo labels and add professional interface

## Critical Implementation Guidelines

### DO NOT MODIFY BACKEND CODE
**IMPORTANT**: The hooks backend in `apps/hooks/` is maintained by a separate team and should NOT be modified during this dashboard update.

**If you encounter backend issues**:
1. **STOP** immediately - do not attempt to fix hooks code
2. **Document** the issue in the sprint log with:
   - Exact error message
   - File and line number where issue occurs
   - What dashboard feature is blocked
3. **Notify** the user about the backend issue
4. **Switch** to a different parallelizable task if possible

**Backend boundaries**:
- ❌ DO NOT touch: `apps/hooks/src/`
- ❌ DO NOT touch: `apps/hooks/scripts/`
- ❌ DO NOT touch: `apps/hooks/config/`
- ✅ OK to modify: `apps/dashboard/` (all subdirectories)
- ✅ OK to read: Backend code for understanding schema/types only

## Features

### Feature 1: Fix Critical Runtime Errors
**Description**: Fix the immediate breaking errors preventing dashboard from functioning.

**Acceptance Criteria**:
- AnimatedEventCard no longer throws TypeError
- Dashboard connects without crashing
- Events display correctly when received

**Tasks**:
- [x] Update AnimatedEventCard Event interface to use `session_id` instead of `sessionId`
- [x] Update line 138 in AnimatedEventCard to access `event.session_id`
- [x] Update EventCard component similarly
- [x] Update EventFeed component to use `session_id`
- [x] Fix all other components accessing sessionId

### Feature 2: Update Database Table Names
**Description**: Update all Supabase queries to use the new prefixed table names.

**Acceptance Criteria**:
- All queries use `chronicle_sessions` instead of `sessions`
- All queries use `chronicle_events` instead of `events`
- Dashboard successfully fetches data from correct tables

**Tasks**:
- [x] Update useEvents hook to query `chronicle_events` table
- [x] Update useSessions hook to query `chronicle_sessions` table
- [x] Update any other database queries in the codebase
- [x] Test database connectivity with new table names

### Feature 3: Align Event Type System ✅ COMPLETED
**Description**: Update event types throughout the dashboard to match new hook-based system.

**Acceptance Criteria**:
- EventType type definition includes all new event types ✅
- Old event types are mapped or removed ✅
- Event filtering works with new types ✅
- Event icons and colors work for new types ✅

**Tasks**:
- [x] Update EventType in types/filters.ts with new event types
- [x] ~~Create mapping function for old->new event types for backwards compatibility~~ (No backwards compatibility needed)
- [x] Update getEventIcon() functions to handle new event types
- [x] Update getEventTypeColor() functions for new types
- [x] Update event type filtering logic
- [x] Add display names for new event types (e.g., "pre_tool_use" -> "Pre-Tool Use")

### Feature 4: Fix Type Definitions and Interfaces ✅ COMPLETED
**Description**: Update all TypeScript interfaces to match actual database schema.

**Acceptance Criteria**:
- Event interface matches database schema exactly ✅
- Session interface matches database schema ✅
- No TypeScript errors in dashboard ✅
- All fields properly typed (UUIDs, timestamps, etc.) ✅

**Tasks**:
- [x] Update Event interface in types/events.ts to match schema
- [x] Change all `sessionId` references to `session_id`
- [x] Add `tool_name` and `duration_ms` fields to Event interface
- [x] Update Session interface to use UUID type for id
- [x] Update timestamp fields to proper types
- [x] Add metadata field with proper JSONB typing

### Feature 5: Update Mock Data Generators ✅ COMPLETED
**Description**: Update mock data generation to create data matching new schema.

**Acceptance Criteria**:
- Mock events use new event types ✅
- Mock data has correct field names (session_id not sessionId) ✅
- Mock data includes new fields (tool_name, duration_ms) ✅
- Mock sessions use UUID format ✅

**Tasks**:
- [x] Update generateMockEvent() to use new event types
- [x] Fix session_id field name in mock data
- [x] Add tool_name generation for tool events
- [x] Add duration_ms for appropriate events
- [x] Update mock session generation to use UUIDs
- [x] Update EVENT_SUMMARIES for new event types

### Feature 6: Update Event Display Components ✅ COMPLETED
**Description**: Update how events are displayed to handle new event structure.

**Acceptance Criteria**:
- Events display with correct information ✅
- Tool events show tool_name ✅
- Duration is displayed when available ✅
- New event types have appropriate icons/colors ✅

**Tasks**:
- [x] Update EventDetailModal to display new fields
- [x] Add tool_name display to event cards
- [x] Add duration display where appropriate
- [x] Update event summary generation for new types
- [x] Test all event type displays

### Feature 7: Session Management Updates ✅ COMPLETED
**Description**: Update session handling for new structure.

**Acceptance Criteria**:
- Sessions are created with UUIDs ✅
- Session lifecycle matches new event types ✅
- Session stats work with new structure ✅

**Tasks**:
- [x] Update session creation to use UUIDs
- [x] Map session_start and stop events to session lifecycle
- [x] Update session statistics calculations
- [x] Fix session filtering with new structure

### Feature 8: Add Migration/Compatibility Layer ⏭️ SKIPPED
**Description**: Add compatibility for existing data and smooth migration.
**Status**: SKIPPED - Chronicle is still in development, no backwards compatibility needed

**Acceptance Criteria**:
- ~~Dashboard can display old events if they exist~~
- ~~Clear migration path for existing users~~
- ~~No data loss during transition~~

**Tasks**:
- ~~Create event type mapping function (old->new)~~
- ~~Add fallback for sessionId->session_id~~
- ~~Document migration process~~
- ~~Add data migration utility (optional)~~

### Feature 9: Update Tests ✅ COMPLETED
**Description**: Update all tests to work with new structure.

**Acceptance Criteria**:
- All existing tests updated ✅
- Tests use new event types and field names ✅
- Test coverage maintained or improved ✅

**Tasks**:
- [x] Update AnimatedEventCard tests
- [x] Update EventDetailModal tests
- [x] Update useEvents hook tests
- [x] Update useSessions hook tests (no changes needed)
- [x] Update EventCard, EventFeed, EventFilter tests
- [x] Fix all TypeScript errors in tests

### Feature 10: Remove Demo Mode and Wire Real Data ✅ COMPLETED
**Description**: Replace the demo EventDashboard with a component that uses real data.

**Acceptance Criteria**:
- Dashboard uses `useEvents` and `useSessions` hooks ✅
- No more fake data generation in production mode ✅
- Real-time events stream from Supabase ✅
- Events display as they arrive from hooks ✅

**Tasks**:
- [x] Create new ProductionEventDashboard component
- [x] Import and use `useEvents` hook for real data
- [x] Import and use `useSessions` hook for session data
- [x] Remove all `generateMockEvent` calls from production code
- [x] Update main page.tsx to use production component
- [x] Keep demo component for development/testing only

### Feature 11: Fix Connection Status Monitoring ✅ COMPLETED
**Description**: Make ConnectionStatus monitor actual Supabase connection.

**Acceptance Criteria**:
- Connection status reflects real Supabase state ✅
- Auto-reconnect on connection loss ✅
- Show meaningful connection errors ✅
- Real-time subscription status displayed ✅

**Tasks**:
- [x] Update ConnectionStatus to monitor Supabase client
- [x] Add connection state to useEvents hook
- [x] Implement reconnection logic
- [x] Add connection error handling
- [x] Display real subscription status

### Feature 12: Production UI Updates
**Description**: Remove all demo labels and create professional interface.

**Acceptance Criteria**:
- No "Demo" or "Demonstrating" text in production
- Professional application title
- Production-ready UI components
- Proper loading and error states

**Tasks**:
- [ ] Change "Chronicle Dashboard Demo" to "Chronicle Observability"
- [ ] Remove "Demonstrating..." subtitle
- [ ] Remove fake control buttons (Connect/Disconnect if not real)
- [ ] Add proper loading skeletons
- [ ] Implement error boundaries
- [ ] Add production favicon and metadata

### Feature 13: Environment Configuration
**Description**: Set up proper environment configuration for production.

**Acceptance Criteria**:
- Clear separation of dev/staging/production configs
- Secure credential management
- Feature flags for gradual rollout
- Performance monitoring setup

**Tasks**:
- [ ] Create environment-specific configs
- [ ] Remove MOCK_DATA flag entirely
- [ ] Set up proper secret management
- [ ] Configure performance monitoring
- [ ] Add error tracking (Sentry or similar)
- [ ] Document deployment process

### Feature 14: Documentation Updates
**Description**: Update documentation to reflect new structure.

**Acceptance Criteria**:
- README reflects new event types
- API documentation updated
- Setup instructions updated

**Tasks**:
- [ ] Update dashboard README
- [ ] Document new event types
- [ ] Update setup instructions for new schema
- [ ] Add troubleshooting section

## Sprint Plan

### Sprint 1: Critical Fixes (URGENT) ✅ COMPLETED
**Features**: Feature 1, Feature 2
**Goal**: Get dashboard working again with basic functionality
**Priority**: CRITICAL - Dashboard is currently broken
**Status**: COMPLETED - Aug 16, 2025

**Parallelization Strategy**:
- **Agent 1**: Fix all sessionId -> session_id issues in components (Feature 1) ✅
- **Agent 2**: Update database table names in hooks (Feature 2) ✅
- **No dependencies**: Both can work simultaneously without conflicts

### Sprint 2: Type System & Mock Data ✅ COMPLETED
**Features**: Feature 3, Feature 4, Feature 5
**Goal**: Align type system with new schema and update mock data
**Status**: COMPLETED - Aug 16, 2025

**Parallelization Strategy**:
- **Agent 1**: Update EventType definitions and type mappings (Feature 3)
- **Agent 2**: Fix TypeScript interfaces for Event/Session (Feature 4)
- **Agent 3**: Update mock data generators (Feature 5)
- **Dependency Note**: Feature 5 depends on Features 3 & 4, but can start with basic structure updates

### Sprint 3: Display & Session Updates ✅ COMPLETED
**Features**: Feature 6, Feature 7
**Goal**: Update display components and session management
**Status**: COMPLETED - Aug 16, 2025

**Parallelization Strategy**:
- **Agent 1**: Update event display components (Feature 6)
- **Agent 2**: Fix session management and UUID handling (Feature 7)
- **No dependencies**: Display and session logic are separate concerns

### Sprint 4: Compatibility & Testing ✅ COMPLETED
**Features**: Feature 8 (SKIPPED), Feature 9
**Goal**: ~~Add backwards compatibility~~ and update tests
**Status**: COMPLETED - Aug 16, 2025
**Note**: Feature 8 skipped as Chronicle is in development and doesn't need backwards compatibility

**Parallelization Strategy**:
- **Agent 1**: Create migration/compatibility layer (Feature 8)
- **Agent 2**: Update all test files (Feature 9)
- **Dependency Note**: Tests may need compatibility layer, but can update syntax in parallel

### Sprint 5: Production Data Integration ✅ COMPLETED
**Features**: Feature 10, Feature 11
**Goal**: Replace demo mode with real data connections
**Status**: COMPLETED - Aug 16, 2025
**Impact**: Dashboard now displays LIVE Chronicle events from Supabase!

**Parallelization Strategy**:
- **Agent 1**: Create production dashboard component with real data (Feature 10)
- **Agent 2**: Fix connection status monitoring (Feature 11)
- **Dependency Note**: Both can work independently on their features

### Sprint 6: Production UI & Environment
**Features**: Feature 12, Feature 13
**Goal**: Create production-ready interface and environment configuration

**Parallelization Strategy**:
- **Agent 1**: Update UI for production (Feature 12)
- **Agent 2**: Configure production environment (Feature 13)
- **No dependencies**: Both can work simultaneously

### Sprint 7: Code Consistency & Technical Debt Cleanup
**Features**: Code quality improvements identified from parallel agent work
**Goal**: Standardize patterns and eliminate technical debt from rapid development
**Priority**: HIGH - Prevents future bugs and improves maintainability

**Issues to Address**:
1. **Type Duplication**: ConnectionState defined in multiple files
2. **Unstable Functions**: formatLastUpdate/formatAbsoluteTime recreated on each render
3. **Inconsistent Logging**: Mix of console.warn and console.error for similar issues
4. **Magic Numbers**: Hardcoded delays (300ms, 500ms, 30000ms) throughout code
5. **Cleanup Duplication**: Timeout cleanup logic repeated in multiple places
6. **Unused Variables**: sessionsError and other variables defined but never used

**Parallelization Strategy**:
- **Agent 1 - Type Consolidation & Constants**:
  - Create `/src/types/connection.ts` for shared connection types
  - Create `/src/lib/constants.ts` for timing constants
  - Update all imports to use single source
  - Replace magic numbers with named constants
  
- **Agent 2 - Function Optimization & Performance**:
  - Convert inline functions to useCallback/useMemo
  - Stabilize formatLastUpdate and formatAbsoluteTime functions
  - Optimize re-render triggers in ConnectionStatus
  - Review and optimize all useEffect dependencies

- **Agent 3 - Cleanup & Error Handling**:
  - Consolidate timeout cleanup logic into reusable functions
  - Standardize console logging patterns (warn vs error)
  - Remove all unused variables and imports
  - Add consistent error boundaries

**Dependencies**: 
- All agents can work simultaneously on different aspects
- Integration testing needed after all changes complete

**Acceptance Criteria**:
- Zero duplicate type definitions
- All functions in useEffect deps are stable
- Consistent error handling throughout
- No magic numbers in code
- Single cleanup pattern used everywhere
- TypeScript strict mode passes without errors

### Sprint 8: Documentation & Final Polish
**Features**: Feature 14 + any remaining fixes
**Goal**: Complete documentation and final testing

**Parallelization Strategy**:
- **Single Agent**: Documentation requires understanding of all changes
- **Can parallelize**: Different documentation sections if needed

## Success Metrics

### Must Have (Sprint 1)
- Dashboard loads without errors
- Events display correctly
- Database queries work

### Should Have (Sprint 2-3)
- All event types display correctly
- Type system fully aligned
- Mock data works properly

### Nice to Have (Sprint 4-5)
- Full backwards compatibility
- All tests passing
- Complete documentation

### Critical for Production (Sprint 5-6)
- Real data integration working
- Production UI without demo labels
- Proper connection monitoring
- Environment configurations set

## Risk Assessment

### Critical Risks
1. **Dashboard Currently Broken**: Users cannot use dashboard at all
2. **Data Loss**: Incorrect queries might miss events
3. **Type Mismatches**: Could cause runtime errors

### Mitigation Plan
1. Sprint 1 is highest priority - fix immediately
2. Test thoroughly with real hook data
3. Add error boundaries and fallbacks
4. Keep backwards compatibility where possible

## Dependencies

### External Dependencies
- Hooks system (completed in Sprint 10)
- Supabase schema (already updated)
- Chronicle events from Claude Code

### Internal Dependencies
- TypeScript definitions
- React components
- Supabase client

## Technical Considerations

### Breaking Changes
- Table name changes require query updates
- Event type changes affect filtering
- Field name changes (sessionId -> session_id) affect entire codebase

### Performance Considerations
- New JSONB metadata field might need optimized queries
- UUID comparisons vs string comparisons
- Index usage with new table names

### Security Considerations
- Ensure RLS policies work with new tables
- Validate UUID formats
- Sanitize metadata field display

## Implementation Notes

### Key Files to Update
1. **Components**:
   - src/components/AnimatedEventCard.tsx (critical)
   - src/components/EventCard.tsx
   - src/components/EventDetailModal.tsx
   - src/components/EventDashboard.tsx
   - src/components/EventFeed.tsx

2. **Hooks**:
   - src/hooks/useEvents.ts (critical)
   - src/hooks/useSessions.ts (critical)

3. **Types**:
   - src/types/events.ts (critical)
   - src/types/filters.ts (critical)
   - src/lib/types.ts

4. **Utilities**:
   - src/lib/mockData.ts
   - src/lib/eventProcessor.ts
   - src/lib/utils.ts

### Quick Fixes for Testing
For immediate testing while working on full fix:
1. Change `sessionId` to `session_id` in AnimatedEventCard line 13 and 138
2. Update table names in useEvents and useSessions hooks
3. Add new event types to EventType definition

## Lessons Learned from Hooks Refactor

1. **Coordinate Schema Changes**: Dashboard and hooks teams need better coordination
2. **Test Integration Early**: Should have tested dashboard with new hooks immediately
3. **Document Breaking Changes**: Schema changes should be clearly documented
4. **Maintain Compatibility**: Consider backwards compatibility during refactors

## Path Forward

### Completed
**Sprint 1** ✅ restored basic dashboard functionality:
1. Fixed the breaking errors preventing dashboard from loading
2. Updated database queries to use correct table names
3. Fixed session_id field references

### Next Priority: Production Readiness
The dashboard currently only shows demo data. **Sprint 5-6 are critical** to make it production-ready:

1. **Sprint 5**: Wire up real data connections
   - Replace demo EventDashboard with production component
   - Connect to actual Supabase data streams
   - Fix connection status monitoring

2. **Sprint 6**: Production UI and environment
   - Remove all demo labels
   - Configure production environment

Without these sprints, the dashboard remains a non-functional demo that doesn't show real Chronicle events.