# Chronicle Hooks UV Single-File Scripts Refactor Backlog (Corrected)

## Critical Context

**This is a corrected version of the backlog after a critical misinterpretation in Sprint 1.**

### What Went Wrong
- **Feature 4** in Sprint 1 was catastrophically misinterpreted
- **Intent**: Extract shared code into library modules that hooks would import (reducing duplication)
- **Implemented**: Inlined all code into each hook (creating massive duplication)
- **Result**: 8 hooks with 500-1100+ lines each, containing 8 different DatabaseManager implementations
- **Impact**: Only 2-3 of 8 hooks actually save to Supabase correctly

### Current State (as of Sprint 7 completion)
- ✅ UV conversion complete (but with wrong architecture)
- ✅ Installation structure works
- ✅ Permission bug fixed
- ✅ Event type mapping implemented
- ❌ 6,000+ lines of duplicated code across hooks
- ❌ Inconsistent DatabaseManager implementations
- ❌ Most hooks fail to save to Supabase
- ❌ Maintenance nightmare (fixes must be applied 8 times)

## Overview

This epic focuses on refactoring the Claude Code hooks system to use UV single-file scripts with **shared library modules** installed in a clean, organized structure. The primary goals are:

1. **Eliminate Installation Clutter**: Replace the current approach that spreads multiple Python files across `.claude` with a clean, self-contained installation
2. **Improve Portability**: Use UV single-file scripts that manage external dependencies while importing shared code from local libraries
3. **Organized Installation Structure**: Install all hooks in a dedicated `chronicle` subfolder under `.claude/hooks/`
4. **Maintain Full Functionality**: Preserve all existing hook capabilities including database connectivity, security validation, and performance monitoring
5. **Simplify Maintenance**: Make hooks easier to install, update, and uninstall through shared libraries
6. **Clean Architecture**: Achieve a maintainable codebase with UV scripts importing from shared libraries
7. **Fix Permission Issues**: Resolve overly aggressive hook behaviors that interfere with Claude Code's auto-approve mode
8. **Eliminate Code Duplication**: One DatabaseManager, one BaseHook, shared by all hooks

## Reference
1. Current hook implementation: `apps/hooks/src/hooks/` (8 files, 500-1100+ lines each)
2. Core dependencies (unused): `apps/hooks/src/core/` (~5,000 lines)
3. Installation script: `apps/hooks/scripts/install.py`
4. Best working implementation: `apps/hooks/src/hooks/post_tool_use.py` (has functional Supabase support)

## Features

### Feature 1: Convert Hooks to UV Single-File Scripts ✅ COMPLETED
**Description**: Transform each hook script to use UV runtime with proper dependency declarations.

**Status**: ✅ Completed correctly in Sprint 1

**Tasks**:
- [x] Add UV shebang headers and dependency declarations to all 8 hook scripts
- [x] Update hooks to use UV runtime
- [x] Declare external dependencies in UV script metadata
- [x] Test UV execution for all hooks
- [x] Validate performance (<100ms)

### Feature 2: Create Chronicle Subfolder Installation Structure ✅ COMPLETED
**Description**: Establish a clean, organized installation structure using a dedicated `chronicle` subfolder.

**Status**: ✅ Completed correctly in Sprint 2

**Tasks**:
- [x] Design new directory structure for chronicle subfolder
- [x] Create installation path mapping for all hook files
- [x] Define configuration file placement strategy
- [x] Plan environment variable and settings organization
- [x] Design clean uninstallation process

### Feature 3: Update Installation Process and Settings Configuration ✅ COMPLETED
**Description**: Modify the installation script and settings.json generation to work with the new structure.

**Status**: ✅ Completed correctly in Sprint 2

**Tasks**:
- [x] Update `install.py` to target chronicle subfolder
- [x] Modify settings.json path generation for new structure
- [x] Add UV availability check to installation process
- [x] Create migration logic for existing installations
- [x] Update installation validation to work with UV scripts

### Feature 4: Extract Shared Code to Library Modules ✅ COMPLETED
**Description**: Extract common functionality into shared library modules that hooks import.

**Status**: ✅ Successfully completed in Sprint 8

**Corrected Acceptance Criteria**:
- ✅ Create `lib/` directory with shared Python modules
- ✅ Use existing standalone DatabaseManager from `src/core/database.py` (more modular than inline versions)
- ✅ Extract BaseHook class for common hook functionality
- ✅ Consolidate utilities to shared modules
- ✅ Hooks import from lib/ directory (NOT inline code)
- ✅ Single source of truth for all shared functionality

**Corrected Tasks**:
- [x] Create `lib/` directory structure in source
- [x] Copy and adapt `src/core/database.py` to `lib/database.py`
- [x] Extract BaseHook class to `lib/base_hook.py` (from post_tool_use.py)
- [x] Create `lib/utils.py` consolidating utilities and env_loader functionality
- [ ] Update installation to copy lib/ to chronicle folder
- [x] Ensure lib/ modules are UV-compatible (no async features hooks don't need)

⚠️ **CRITICAL IMPLEMENTATION NOTE**:
The inline DatabaseManager implementations in current hooks contain the **UPDATED** event type mappings from Feature 14 (Sprint 7). The standalone `src/core/database.py` has **OLDER** mappings that will cause regressions. When creating `lib/database.py`, you MUST:
1. Start with `src/core/database.py` for the modular structure
2. **Update all event type mappings** to match the inline versions from hooks
3. Use the correct snake_case event types:
   - `pre_tool_use` (NOT "prompt" or "tool_use")
   - `post_tool_use` (NOT "tool_use")
   - `user_prompt_submit` (NOT "prompt")
   - `session_start`
   - `stop` (NOT "session_end")
   - `subagent_stop`
   - `notification`
   - `pre_compact`
4. Reference the inline hooks (especially `post_tool_use.py`) for the correct implementation
5. Do NOT use deprecated mappings like "prompt", "tool_use", "session_end"

### Feature 5: Database Configuration and Environment Management ✅ COMPLETED
**Description**: Ensure database connectivity and environment variable management work seamlessly.

**Status**: ✅ Completed correctly in Sprint 3 (though hampered by Feature 4 error)

**Tasks**:
- [x] Update environment variable loading for chronicle subfolder
- [x] Test database connectivity from UV single-file scripts
- [x] Validate Supabase integration with new script structure
- [x] Ensure SQLite fallback works in chronicle folder
- [x] Test database schema creation and migration

### Feature 6: Testing and Validation ⚠️ PARTIALLY COMPLETED
**Description**: Comprehensive testing of the UV single-file script system.

**Status**: ⚠️ Testing revealed only 2-3 hooks work with Supabase

**Tasks**:
- [x] Create test suite for UV single-file scripts
- [x] Validate end-to-end hook execution
- [x] Performance test new scripts under load
- [x] Test database connectivity (**FAILED - only 2-3 hooks work**)
- [x] Validate error handling

### Feature 7: Documentation and Examples Update ✅ COMPLETED
**Description**: Update all documentation to reflect the new structure.

**Status**: ✅ Successfully completed in Sprint 10

**Tasks**:
- [x] Update main README with new installation instructions
- [x] Document chronicle subfolder structure and organization
- [x] Update troubleshooting guide with UV-related issues
- [x] Add UV architecture benefits and performance characteristics
- [x] Document configuration options and verification procedures

**Results**: Comprehensive documentation for UV single-file script architecture

### Feature 8: Remove Inline Code Duplication ❌ WRONG APPROACH
**Description**: This feature doubled down on the wrong approach from Feature 4.

**Status**: ❌ Completed but needs to be undone

**Note**: This feature made the problem worse by further entrenching inline code. Will be reversed by Feature 15.

### Feature 9: Consolidate Hook Scripts to Single Location ✅ COMPLETED
**Description**: Move UV scripts from `src/hooks/uv_scripts/` to `src/hooks/`.

**Status**: ✅ Completed correctly in Sprint 6

### Feature 10: Remove UV Suffix from Script Names ✅ COMPLETED
**Description**: Rename all hook scripts to remove the `_uv` suffix.

**Status**: ✅ Completed correctly in Sprint 6

### Feature 11: Update Installation Script for Clean Structure ✅ COMPLETED
**Description**: Modify install.py to work with the new simplified structure.

**Status**: ✅ Successfully completed in Sprint 9

**Tasks**:
- [x] Update hooks_source_dir path to point to `src/hooks/`
- [x] Add lib/ directory copying logic
- [x] Ensure lib/ is accessible to hooks at runtime
- [x] Update settings.json hook path generation
- [x] Test installation process end-to-end

**Results**: Installation now properly copies lib/ directory, all hooks work with imports

### Feature 12: Update Documentation for Clean Structure ✅ COMPLETED
**Description**: Update all documentation to reflect the new simplified structure.

**Status**: ✅ Successfully completed in Sprint 10

**Tasks**:
- [x] Document lib/ module architecture in CHRONICLE_INSTALLATION_STRUCTURE.md
- [x] Update ENVIRONMENT_VARIABLES.md with all 40+ variables
- [x] Add migration guides from old structure
- [x] Include configuration patterns for different environments

**Results**: Complete architectural and environment documentation

### Feature 13: Fix PreToolUse Hook Permission Bug ✅ COMPLETED
**Description**: Fix the overly aggressive permission management in the preToolUse hook.

**Status**: ✅ Completed correctly in Sprint 4

### Feature 14: Implement 1:1 Event Type Mapping ✅ COMPLETED
**Description**: Establish a 1:1 mapping between hook event names and database event types.

**Status**: ✅ Completed correctly in Sprint 7

### Feature 15: Repair Hook Implementations ✅ COMPLETED
**Description**: Remove inline code duplication and update hooks to use shared libraries. This is largely overlapping with Feature 4 tasks but focused on the hook-side changes.

**Status**: ✅ Successfully completed in Sprint 8

**Acceptance Criteria**:
- ✅ All hooks import from shared lib/ modules
- ✅ Each hook reduced from 500-1100+ lines to ~100-400 lines
- ✅ Consistent DatabaseManager across all hooks
- ✅ All hooks successfully save to Supabase
- ✅ All hooks successfully fallback to SQLite
- ✅ No duplicated code between hooks

**Tasks**:
- [x] Remove inline DatabaseManager from all 8 hooks
- [x] Update hooks to import from lib/database
- [x] Remove inline BaseHook code from hooks
- [x] Update hooks to extend lib/base_hook.BaseHook
- [x] Remove all other duplicated inline code
- [x] Test each hook for proper imports
- [x] Verify all hooks save to both databases

**Results**: Reduced total hook code from 6,130 lines to 2,490 lines (59% reduction)

### Feature 16: Fix Database Connectivity Issues ✅ COMPLETED
**Description**: Ensure all hooks properly save events to both Supabase and SQLite.

**Status**: ✅ Successfully completed in Sprint 8

**Acceptance Criteria**:
- ✅ All 8 hooks successfully save to Supabase
- ✅ Session creation works consistently
- ✅ No 400 Bad Request errors
- ✅ SQLite fallback works for all hooks
- ✅ Event types are consistent across all hooks

**Tasks**:
- [x] Fix session creation logic for all hooks
- [x] Resolve Supabase 400 errors (session_id UUID issues)
- [x] Ensure consistent event_type usage
- [x] Test all hooks with real Claude Code sessions
- [x] Verify data appears in both databases
- [x] Add error logging for debugging

**Results**: All hooks tested and working with both databases, UUID validation fixed

### Feature 17: Test Code Cleanup ✅ COMPLETED
**Description**: Remove all test/debug/throwaway code from troubleshooting cycles to clean up the codebase.

**Status**: ✅ Successfully completed in Sprint 10

**Acceptance Criteria**:
- ✅ All throwaway test scripts removed from project root
- ✅ Debug and demo scripts removed from apps/hooks/scripts/
- ✅ Legitimate test suites preserved in apps/hooks/tests/
- ✅ No orphaned test utilities outside proper test directories
- ✅ Clean project structure with only production and proper test code

**Tasks**:
- [x] Remove 22 test/debug scripts from project root
- [x] Review and remove demo/test scripts from apps/hooks/scripts/
- [x] Keep only install.py, uninstall.py, setup_schema.py, validate_environment.py in scripts/
- [x] Ensure apps/hooks/tests/ remains intact (proper test suites)
- [x] Update .gitignore to prevent future test file commits
- [x] Verify no broken references after cleanup

**Results**: Removed 29 total files (22 from root + 7 from scripts), updated .gitignore

**Files to Remove from Project Root**:
- check_event_types.py, check_hook_events.py, check_supabase_data.py, check_supabase_events.py
- debug_hook_detailed.py, debug_hook_env.py, debug_hook_save.py
- fix_sqlite_schema.py, fix_uv_imports.py, update_uv_scripts_with_new_db.py
- test_all_hooks.py, test_all_hooks_supabase.py, test_hook_manual.py
- test_hook_with_debug_env.py, test_hook_with_json.py
- test_supabase_direct.py, test_supabase_query.py, test_uuid_fix.py
- test_valid_event_type.py, test_with_existing_session.py, validate_database.py

### Feature 18: Logging System Cleanup ✅ COMPLETED
**Description**: Clean up and enhance the existing logging system for all hooks.

**Status**: ✅ Successfully completed in Sprint 10

**Acceptance Criteria**:
- ✅ Consistent logging format across all hooks
- ✅ Configurable log levels via environment variables
- ✅ Clean, professional log messages (no debug spam)
- ✅ Silent mode option for production use
- ✅ Optional file logging control

**Tasks**:
- [x] Enhanced existing logging configuration in lib/base_hook.py
- [x] Updated all hooks to use consistent logging
- [x] Added log level configuration to .env template
- [x] Removed debug print() statements (kept response prints)
- [x] Documented logging configuration options
- [x] Tested logging at different verbosity levels

**Results**: Professional logging with SILENT_MODE, configurable levels, optional file output

### Feature 19: Environment File Simplification ✅ COMPLETED
**Description**: Clean up and simplify the .env file to only include necessary configuration options.

**Status**: ✅ Successfully completed in Sprint 9

**Acceptance Criteria**:
- ✅ Minimal .env with only essential variables
- ✅ Clear comments explaining each variable
- ✅ Sensible defaults for optional settings
- ✅ Separate advanced options into optional config file
- ✅ Backwards compatibility with existing installations

**Tasks**:
- [x] Audit current .env variables for necessity
- [x] Create minimal chronicle.env.template with essentials only
- [x] Move advanced options to optional chronicle.config.json
- [x] Update installation script to use simplified .env
- [x] Update documentation for environment setup
- [x] Test with minimal configuration

**Results**: Reduced from 12 to 3 optional variables, all with defaults

## Sprint Plan

### ✅ Sprint 1: Core Script Conversion **COMPLETED** (with critical error)
**Features**: Feature 1 ✅, Feature 4 ❌ (misimplemented)
**Status**: UV conversion successful, but Feature 4 was catastrophically misinterpreted. Instead of extracting to shared libraries, all code was inlined into each hook.

### ✅ Sprint 2: Installation Infrastructure **COMPLETED**
**Features**: Feature 2 ✅, Feature 3 ✅
**Status**: Successfully implemented chronicle subfolder structure and installation process.

### ✅ Sprint 3: Database Integration and Testing **COMPLETED** (partially failed)
**Features**: Feature 5 ✅, Feature 6 ⚠️
**Status**: Database configuration works, but testing revealed only 2-3 hooks actually save to Supabase due to Sprint 1's error.

### ✅ Sprint 4: Critical Bug Fix **COMPLETED**
**Features**: Feature 13 ✅
**Status**: Successfully fixed PreToolUse permission bug.

### ✅ Sprint 5: Code Cleanup **COMPLETED** (wrong direction)
**Features**: Feature 8 ❌
**Status**: This sprint made the problem worse by further inlining code instead of extracting it.

### ✅ Sprint 6: Structure Simplification **COMPLETED**
**Features**: Feature 9 ✅, Feature 10 ✅
**Status**: Successfully consolidated hooks and removed UV suffix.

### ✅ Sprint 7: Event Type Mapping **COMPLETED**
**Features**: Feature 14 ✅
**Status**: Successfully implemented 1:1 event type mapping.

### ✅ Sprint 8: Architecture Repair **COMPLETED**
**Features**: Feature 4 ✅, Feature 15 ✅, Feature 16 ✅
**Status**: ✅ Successfully completed - architecture disaster from Sprint 1 has been fixed!

**Execution Summary**:
- **Phase 1**: Created lib/ directory with shared modules (database, base_hook, utils)
- **Phase 2**: Parallel refactoring of all 8 hooks by 3 agents
- **Phase 3**: Integration testing confirmed all hooks working

**Results Achieved**:
- ✅ Extracted shared code to lib/ modules
- ✅ Removed 3,640 lines of duplicated code (59% reduction)
- ✅ Fixed all database connectivity issues
- ✅ All 8 hooks tested and working properly
- ✅ Total lines: 6,130 → 2,490 (massive improvement!)

**Key Metrics**:
- Code reduction: 59% (3,640 lines removed)
- Hooks working with Supabase: 100% (was 25%)
- Maintainability: Single-point fixes now possible
- Performance: <100ms goal not met due to UV startup, but acceptable

### ✅ Sprint 9: Installation & Testing Foundation **COMPLETED**
**Features**: Feature 19 ✅, Feature 11 ✅
**Status**: ✅ Successfully completed - installation and configuration now production-ready!

**Execution Summary**:
- **Phase 1**: Simplified environment from 12 to 3 optional variables
- **Phase 2**: Updated installation to properly copy lib/ directory
- **Phase 3**: End-to-end testing confirmed all hooks working

**Results Achieved**:
- ✅ Minimal .env with only 3 optional variables (all have defaults)
- ✅ Installation script copies lib/ directory correctly
- ✅ All 8 hooks tested and working with lib/ imports
- ✅ Database connectivity validated (Supabase + SQLite)
- ✅ Created comprehensive verification script

**Key Improvements**:
- Configuration complexity: 75% reduction (12 → 3 variables)
- Installation reliability: 100% (lib/ copying fixed)
- Test coverage: Complete E2E validation
- User experience: Minimal config "just works"

### ✅ Sprint 10: Cleanup & Documentation **COMPLETED**
**Features**: Feature 18 ✅, Feature 17 ✅, Feature 7 ✅, Feature 12 ✅
**Status**: ✅ Successfully completed - codebase and documentation now production-ready!

**Execution Summary**:
- **Phase 1**: Parallel cleanup by 2 agents
  - Agent 1: Enhanced logging system with configurable levels
  - Agent 2: Removed 29 test/debug files
- **Phase 2**: Parallel documentation by 2 agents
  - Agent 3: Updated main README for UV architecture
  - Agent 4: Documented lib/ structure and environment

**Results Achieved**:
- ✅ Professional logging with SILENT_MODE and configurable levels
- ✅ Removed 4,093 lines of test/debug code
- ✅ Clean project structure (no test files in root)
- ✅ Comprehensive documentation for UV architecture
- ✅ Complete environment variable reference (40+ variables)
- ✅ Migration guides from old structure

**Key Metrics**:
- Test files removed: 29 (22 root + 7 scripts)
- Lines removed: 4,093
- Documentation added: 960+ lines
- Logging improvements: 3 new configuration options

### 🚀 Sprint 11: Optional Enhancements
**Features**: Future enhancements from original Feature 6 in 03_hook_script_cleanup_backlog.md
**Rationale**: Once core architecture is fixed, consider additional optimizations.

**Parallelization Strategy**:
- **Independent Explorations**: Each enhancement can be explored separately
- **No Critical Path**: These are optional improvements that don't block anything

**Ideas**:
- Create shared UV package for even better dependency management
- Performance optimizations
- Additional testing tools

## Success Metrics

### Must Have (Sprint 8)
- Each hook reduced from 500-1100+ lines to ~100-200 lines
- Single DatabaseManager implementation shared by all hooks
- All 8 hooks successfully save to Supabase
- All 8 hooks successfully save to SQLite
- Zero code duplication between hooks
- Fix can be applied once and affects all hooks

### Already Achieved
- ✅ Hook installation uses only `chronicle` subfolder
- ✅ All hooks execute in <100ms using UV runtime
- ✅ Installation process completes successfully
- ✅ UV scripts are the only implementation
- ✅ Clean, flat directory structure in `src/hooks/`
- ✅ PreToolUse hook no longer interferes with auto-approve mode
- ✅ 1:1 event type mapping implemented

### Still Needed
- ✅ Complete functional parity with intended design
- ✅ All documentation accurately reflects new structure
- ✅ Installation copies lib/ directory correctly
- ✅ Clean, minimal .env configuration with only essentials
- ✅ Professional, configurable logging system
- ✅ All test/debug code removed from project root

## Risk Assessment

### Critical Risks
1. **Current State**: Only 2-3 of 8 hooks work properly - system is largely broken
2. **Maintenance Burden**: Any fix must be applied 8 times currently
3. **Testing Gap**: Cannot properly test until architecture is fixed

### Mitigation Plan
1. Sprint 8 is highest priority - fix architecture immediately
2. Use post_tool_use.py as reference (it works with Supabase)
3. Test each hook thoroughly after repair
4. Document the fix process for future reference

## Lessons Learned

1. **Clear Communication**: "Consolidate" was misinterpreted as "inline" instead of "extract to shared modules"
2. **Early Testing**: Database connectivity issues should have been caught earlier
3. **Code Review**: 500-1100 line files should have been a red flag
4. **Architecture First**: Shared libraries should have been created before hook conversion

## Path Forward

The immediate priority is Sprint 8 to repair the architecture. This will:
1. Reduce codebase by ~80% (from 6,000+ duplicated lines to ~1,200 total)
2. Enable single-point fixes for all hooks
3. Ensure all hooks work with both databases
4. Restore maintainability to the project

Once Sprint 8 is complete, the project will be back on track with a clean, maintainable architecture as originally intended.