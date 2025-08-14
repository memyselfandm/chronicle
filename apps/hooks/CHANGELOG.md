# Chronicle Hooks System Changelog

## [Unreleased]

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