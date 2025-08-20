# Chronicle Hooks System Changelog

## [Unreleased]

### Cleanup - Archive Consolidated Directory

**Archived unused consolidated/ directory to improve codebase organization:**

#### Background
- The `consolidated/` directory contained simplified versions of hook dependencies designed for UV single-file scripts
- Directory contained 8 Python files (~71KB, 2,094 lines) with reduced functionality
- No active hooks or scripts import from this directory
- All current hooks use the full-featured `src/lib/` modules instead

#### Analysis Results
- **No external dependencies**: Comprehensive codebase search confirmed no imports from consolidated/
- **Functionality subset**: All consolidated features are available in enhanced form in src/lib/
- **Historical purpose**: Directory was experimental approach for UV single-file script optimization
- **Current approach**: Active hooks use modular lib/ structure with full dependency management

#### Changes Made
- **Archived**: Moved consolidated/ directory to archived/consolidated/ for historical reference
- **Preserved**: All code and documentation maintained in archive
- **Validated**: Test suite confirms no functionality loss
- **Documented**: Added historical context to CHANGELOG

**Files Affected:**
- `consolidated/` → `archived/consolidated/` (moved entire directory)
- `tests/test_consolidated_cleanup.py` - Added validation test suite

## [3.1.0] - 2025-08-16

### Fixed - Pre-Tool-Use Event Visibility Issues

**Critical fixes for pre_tool_use events not appearing in Supabase:**

#### Database Save Strategy
- **Fixed**: Modified `save_event()` and `save_session()` to save to BOTH databases (Supabase and SQLite) instead of returning after first success
- **Changed**: Database operations now attempt both databases regardless of individual results
- **Improved**: Return success if at least one database saves successfully

#### SQLite Schema Constraints
- **Fixed**: Removed restrictive CHECK constraint on event_type column that was blocking valid event types
- **Added**: Migration script `fix_sqlite_check_constraint.py` to safely update existing databases
- **Preserved**: Database views and triggers during migration process

#### Missing Dependencies
- **Fixed**: Added `supabase>=2.18.0` dependency to pre_tool_use.py UV script header
- **Resolved**: Supabase client was not available due to missing dependency in UV environment

#### Environment Configuration
- **Fixed**: Added Supabase credentials to Chronicle installation .env file
- **Updated**: Environment variables now properly loaded for all hooks

#### Tool Permissions
- **Added**: ExitPlanMode to auto-approved tools list in pre_tool_use hook
- **Updated**: Both standard_tools and safe_tools lists for consistency

### Technical Details

**Files Modified:**
- `src/lib/database.py` - Modified save_event() and save_session() for dual database saves
- `src/hooks/pre_tool_use.py` - Added supabase dependency and ExitPlanMode tool
- `fix_sqlite_check_constraint.py` - New migration script for schema updates
- `.claude/hooks/chronicle/.env` - Added Supabase configuration

**Database Changes:**
- Removed CHECK constraint from SQLite events.event_type column
- Sessions and events now save to both Supabase and SQLite simultaneously
- Improved logging to track database save operations

### Fixed - Database Persistence Issues (2025-01-14)

**Critical fixes for Chronicle hooks database save failures:**

#### Session ID Mapping Resolution
- **Fixed**: Session ID extraction and mapping between Claude Code input and database schema
- **Enhanced**: BaseHook.get_claude_session_id() now properly extracts from input payload first, then environment fallback
- **Improved**: Session management flow ensures proper UUID mapping between claude_session_id (text) and session_id (UUID)
- **Added**: Automatic session creation when saving events to maintain referential integrity

#### SQLite Fallback Implementation
- **Implemented**: Complete SQLite fallback functionality (was placeholder TODOs)
- **Fixed**: Schema column mismatches between SQLite and Supabase implementations  
- **Added**: Comprehensive SQLiteClient with connection pooling, WAL mode, and proper error handling
- **Enhanced**: Automatic fallback detection and seamless switching when Supabase unavailable

#### Database Layer Consolidation
- **Enhanced**: Compatibility layer with deprecation warnings for future migration
- **Added**: Custom exception classes (DatabaseError, ConnectionError, ValidationError)
- **Improved**: Comprehensive error handling with detailed context and logging
- **Created**: Environment validation utilities for robust configuration checking

#### Schema Alignment
- **Fixed**: Database operations now align with actual Supabase schema structure
- **Resolved**: Foreign key constraint issues between sessions and events tables
- **Ensured**: Data integrity maintained across both Supabase and SQLite backends

#### New Utilities
- **Added**: `scripts/validate_environment.py` - Comprehensive environment validation
- **Added**: `scripts/check_imports.py` - Import pattern analysis and migration helper
- **Enhanced**: `setup_schema_and_verify()` with improved feedback and validation

### Technical Details

**Files Modified:**
- `src/core/base_hook.py` - Session ID handling and automatic session management
- `src/core/database.py` - Complete SQLite implementation and improved error handling  
- `src/database.py` - Enhanced compatibility layer with deprecation warnings
- `src/hooks/session_start.py` - Updated session creation flow
- `src/hooks/user_prompt_submit.py` - Simplified event saving with automatic session handling

**Database Schema Fixes:**
- Consistent column naming: `claude_session_id` (text) properly mapped to `session_id` (UUID)
- Proper foreign key relationships: `chronicle_events.session_id → chronicle_sessions.id`
- SQLite schema alignment with PostgreSQL structure

**Breaking Changes:** None - Full backward compatibility maintained

**Migration Notes:**
- Existing hooks continue to work without modification
- Deprecated imports show warnings but still function
- Environment validation helps identify configuration issues
- SQLite fallback provides offline functionality

This release resolves the "Database save failed" errors reported in hook logs and ensures reliable event persistence across both cloud and local storage backends.

## Previous Releases

### [v1.0.0] - 2024-12-XX - Initial MVP Release
- Complete hooks system implementation
- Supabase integration with real-time subscriptions
- Next.js dashboard with event visualization
- Session lifecycle tracking
- Tool usage monitoring
- User prompt capture