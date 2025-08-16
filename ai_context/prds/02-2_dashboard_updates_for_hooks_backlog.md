# Chronicle Dashboard Updates for Hooks Refactor Backlog

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

This epic focuses on updating the Chronicle Dashboard to work with the new database schema and event structure implemented during the hooks refactor. The primary goals are:

1. **Fix Breaking Errors**: Resolve the TypeError and other runtime errors preventing dashboard from working
2. **Update Database Queries**: Use correct table names with `chronicle_` prefix
3. **Align Event Types**: Update to new hook-based event type system
4. **Fix Type Definitions**: Ensure TypeScript interfaces match actual database schema
5. **Update Mock Data**: Align mock data generators with new structure
6. **Maintain UI/UX**: Keep existing dashboard functionality and appearance
7. **Add Backwards Compatibility**: Support both old and new event types during transition

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

### Feature 3: Align Event Type System
**Description**: Update event types throughout the dashboard to match new hook-based system.

**Acceptance Criteria**:
- EventType type definition includes all new event types
- Old event types are mapped or removed
- Event filtering works with new types
- Event icons and colors work for new types

**Tasks**:
- [ ] Update EventType in types/filters.ts with new event types
- [ ] Create mapping function for old->new event types for backwards compatibility
- [ ] Update getEventIcon() functions to handle new event types
- [ ] Update getEventTypeColor() functions for new types
- [ ] Update event type filtering logic
- [ ] Add display names for new event types (e.g., "pre_tool_use" -> "Pre-Tool Use")

### Feature 4: Fix Type Definitions and Interfaces
**Description**: Update all TypeScript interfaces to match actual database schema.

**Acceptance Criteria**:
- Event interface matches database schema exactly
- Session interface matches database schema
- No TypeScript errors in dashboard
- All fields properly typed (UUIDs, timestamps, etc.)

**Tasks**:
- [ ] Update Event interface in types/events.ts to match schema
- [ ] Change all `sessionId` references to `session_id`
- [ ] Add `tool_name` and `duration_ms` fields to Event interface
- [ ] Update Session interface to use UUID type for id
- [ ] Update timestamp fields to proper types
- [ ] Add metadata field with proper JSONB typing

### Feature 5: Update Mock Data Generators
**Description**: Update mock data generation to create data matching new schema.

**Acceptance Criteria**:
- Mock events use new event types
- Mock data has correct field names (session_id not sessionId)
- Mock data includes new fields (tool_name, duration_ms)
- Mock sessions use UUID format

**Tasks**:
- [ ] Update generateMockEvent() to use new event types
- [ ] Fix session_id field name in mock data
- [ ] Add tool_name generation for tool events
- [ ] Add duration_ms for appropriate events
- [ ] Update mock session generation to use UUIDs
- [ ] Update EVENT_SUMMARIES for new event types

### Feature 6: Update Event Display Components
**Description**: Update how events are displayed to handle new event structure.

**Acceptance Criteria**:
- Events display with correct information
- Tool events show tool_name
- Duration is displayed when available
- New event types have appropriate icons/colors

**Tasks**:
- [ ] Update EventDetailModal to display new fields
- [ ] Add tool_name display to event cards
- [ ] Add duration display where appropriate
- [ ] Update event summary generation for new types
- [ ] Test all event type displays

### Feature 7: Session Management Updates
**Description**: Update session handling for new structure.

**Acceptance Criteria**:
- Sessions are created with UUIDs
- Session lifecycle matches new event types
- Session stats work with new structure

**Tasks**:
- [ ] Update session creation to use UUIDs
- [ ] Map session_start and stop events to session lifecycle
- [ ] Update session statistics calculations
- [ ] Fix session filtering with new structure

### Feature 8: Add Migration/Compatibility Layer
**Description**: Add compatibility for existing data and smooth migration.

**Acceptance Criteria**:
- Dashboard can display old events if they exist
- Clear migration path for existing users
- No data loss during transition

**Tasks**:
- [ ] Create event type mapping function (old->new)
- [ ] Add fallback for sessionId->session_id
- [ ] Document migration process
- [ ] Add data migration utility (optional)

### Feature 9: Update Tests
**Description**: Update all tests to work with new structure.

**Acceptance Criteria**:
- All existing tests pass
- Tests use new event types and field names
- Test coverage maintained or improved

**Tasks**:
- [ ] Update AnimatedEventCard tests
- [ ] Update EventDetailModal tests
- [ ] Update useEvents hook tests
- [ ] Update useSessions hook tests
- [ ] Update integration tests
- [ ] Fix all TypeScript errors in tests

### Feature 10: Documentation Updates
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

### Sprint 2: Type System & Mock Data
**Features**: Feature 3, Feature 4, Feature 5
**Goal**: Align type system with new schema and update mock data

**Parallelization Strategy**:
- **Agent 1**: Update EventType definitions and type mappings (Feature 3)
- **Agent 2**: Fix TypeScript interfaces for Event/Session (Feature 4)
- **Agent 3**: Update mock data generators (Feature 5)
- **Dependency Note**: Feature 5 depends on Features 3 & 4, but can start with basic structure updates

### Sprint 3: Display & Session Updates
**Features**: Feature 6, Feature 7
**Goal**: Update display components and session management

**Parallelization Strategy**:
- **Agent 1**: Update event display components (Feature 6)
- **Agent 2**: Fix session management and UUID handling (Feature 7)
- **No dependencies**: Display and session logic are separate concerns

### Sprint 4: Compatibility & Testing
**Features**: Feature 8, Feature 9
**Goal**: Add backwards compatibility and update tests

**Parallelization Strategy**:
- **Agent 1**: Create migration/compatibility layer (Feature 8)
- **Agent 2**: Update all test files (Feature 9)
- **Dependency Note**: Tests may need compatibility layer, but can update syntax in parallel

### Sprint 5: Documentation & Final Polish
**Features**: Feature 10 + any remaining fixes
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

The immediate priority is Sprint 1 to restore basic dashboard functionality. This will:
1. Fix the breaking errors preventing dashboard from loading
2. Enable basic event viewing and session tracking
3. Restore value to users who depend on the dashboard
4. Create foundation for remaining updates

Once Sprint 1 is complete, we can incrementally improve the dashboard while maintaining functionality.