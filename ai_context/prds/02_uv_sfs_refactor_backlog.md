# Chronicle Hooks UV Single-File Scripts Refactor Backlog

## Overview

This epic focuses on refactoring the Claude Code hooks system to use UV single-file scripts installed in a clean, organized structure. The primary goals are:

1. **Eliminate Installation Clutter**: Replace the current approach that spreads multiple Python files across `.claude` with a clean, self-contained installation
2. **Improve Portability**: Use UV single-file scripts that manage their own dependencies without requiring complex import paths
3. **Organized Installation Structure**: Install all hooks in a dedicated `chronicle` subfolder under `.claude/hooks/`
4. **Maintain Full Functionality**: Preserve all existing hook capabilities including database connectivity, security validation, and performance monitoring
5. **Simplify Maintenance**: Make hooks easier to install, update, and uninstall
6. **Clean Architecture**: Achieve a maintainable codebase with UV scripts as the sole implementation, eliminating duplication and unnecessary complexity
7. **Fix Permission Issues**: Resolve overly aggressive hook behaviors that interfere with Claude Code's auto-approve mode

## Reference
1. Current hook implementation: `apps/hooks/src/hooks/`
2. Core dependencies analysis: `apps/hooks/src/core/`
3. Installation script: `apps/hooks/scripts/install.py`

## Features

### Feature 1: Convert Hooks to UV Single-File Scripts

**Description**: Transform each hook script from the current import-dependent structure to self-contained UV single-file scripts that include all necessary functionality inline.

**Acceptance Criteria**:
- Each hook script runs independently with UV without external imports
- All core functionality (database, security, performance) is preserved
- Scripts maintain the same input/output interface as current hooks
- UV dependencies are declared inline using script metadata
- Scripts execute within the same performance constraints (<100ms)

**Tasks**:
- [x] Add UV shebang headers and dependency declarations to all 8 hook scripts ✅ **COMPLETED**
- [x] Inline essential functions from `base_hook.py` into each hook script ✅ **COMPLETED**
- [x] Consolidate database connectivity logic directly into each hook ✅ **COMPLETED**
- [x] Merge security validation functions into hook scripts ✅ **COMPLETED**
- [x] Integrate performance monitoring and error handling inline ✅ **COMPLETED**

### Feature 2: Create Chronicle Subfolder Installation Structure

**Description**: Establish a clean, organized installation structure using a dedicated `chronicle` subfolder under `.claude/hooks/` to contain all hook-related files.

**Acceptance Criteria**:
- All hook files install to `~/.claude/hooks/chronicle/` directory
- Installation creates only the necessary files (8 hook scripts + config)
- Directory structure is easy to understand and maintain
- Uninstallation is simple (delete chronicle folder)
- No files are scattered across other `.claude` directories

**Tasks**:
- [x] Design new directory structure for chronicle subfolder ✅ **COMPLETED**
- [x] Create installation path mapping for all hook files ✅ **COMPLETED**
- [x] Define configuration file placement strategy ✅ **COMPLETED**
- [x] Plan environment variable and settings organization ✅ **COMPLETED**
- [x] Design clean uninstallation process ✅ **COMPLETED**

### Feature 3: Update Installation Process and Settings Configuration

**Description**: Modify the installation script and settings.json generation to work with the new chronicle subfolder structure and UV single-file scripts.

**Acceptance Criteria**:
- Install script creates `chronicle` subfolder automatically
- Settings.json uses correct paths pointing to chronicle subfolder
- Hook paths use `$CLAUDE_PROJECT_DIR/.claude/hooks/chronicle/` format
- Installation validates UV availability before proceeding
- Backward compatibility with existing installations is maintained

**Tasks**:
- [x] Update `install.py` to target chronicle subfolder ✅ **COMPLETED**
- [x] Modify settings.json path generation for new structure ✅ **COMPLETED**
- [x] Add UV availability check to installation process ✅ **COMPLETED**
- [x] Create migration logic for existing installations ✅ **COMPLETED**
- [x] Update installation validation to work with UV scripts ✅ **COMPLETED**

### Feature 4: Consolidate Core Dependencies

**Description**: Analyze and consolidate the ~5,000 lines of core dependencies into the minimal essential functionality needed by each hook script.

**Acceptance Criteria**:
- Essential database connectivity is preserved in each hook
- Security validation functions are maintained
- Performance monitoring capabilities are retained
- Error handling and logging remain functional
- Total code footprint per hook is reasonable (<500 lines including inline deps)

**Tasks**:
- [x] Audit core dependencies to identify essential vs. optional functionality ✅ **COMPLETED**
- [x] Create consolidated database client for inline use ✅ **COMPLETED**
- [x] Simplify security validation to core requirements ✅ **COMPLETED**
- [x] Streamline error handling and logging for inline use ✅ **COMPLETED**
- [x] Optimize performance monitoring for single-file context ✅ **COMPLETED**

### Feature 5: Database Configuration and Environment Management

**Description**: Ensure database connectivity and environment variable management work seamlessly with the new UV single-file script structure.

**Acceptance Criteria**:
- Scripts can read database configuration from `.env` file in chronicle folder
- Supabase connectivity works from UV scripts
- SQLite fallback functions properly
- Environment variables are loaded correctly
- Database schema initialization works with new structure

**Tasks**:
- [x] Update environment variable loading for chronicle subfolder ✅ **COMPLETED**
- [x] Test database connectivity from UV single-file scripts ✅ **COMPLETED**
- [x] Validate Supabase integration with new script structure ✅ **COMPLETED**
- [x] Ensure SQLite fallback works in chronicle folder ✅ **COMPLETED**
- [x] Test database schema creation and migration ✅ **COMPLETED**

### Feature 6: Testing and Validation

**Description**: Comprehensive testing of the new UV single-file script system to ensure all functionality works correctly and performance requirements are met.

**Acceptance Criteria**:
- All hooks execute successfully with UV runtime
- Database writes complete successfully from new scripts
- Performance remains under 100ms execution time
- Error scenarios are handled gracefully
- Integration with Claude Code works properly

**Tasks**:
- [x] Create test suite for UV single-file scripts ✅ **COMPLETED**
- [x] Validate end-to-end hook execution with real Claude Code sessions ✅ **COMPLETED**
- [x] Performance test new scripts under load ✅ **COMPLETED**
- [x] Test database connectivity and data writing ✅ **COMPLETED**
- [x] Validate error handling and recovery scenarios ✅ **COMPLETED**

### Feature 7: Documentation and Examples Update

**Description**: Update all documentation, examples, and troubleshooting guides to reflect the new UV single-file script structure and installation process.

**Acceptance Criteria**:
- Installation documentation reflects new chronicle subfolder approach
- Examples show correct UV script usage
- Troubleshooting guide covers UV-specific issues
- README files are updated with new structure information
- Migration guide is provided for existing users

**Tasks**:
- [ ] Update main README with new installation instructions
- [ ] Create UV single-file script usage examples
- [ ] Document chronicle subfolder structure and organization
- [ ] Write migration guide for existing installations
- [ ] Update troubleshooting guide with UV-related issues

### Feature 8: Extract and Inline Shared Code into UV Scripts

**Description**: Convert DatabaseManager and EnvLoader from separate Python modules into inline code within each UV script, ensuring true self-containment.

**Acceptance Criteria**:
- All UV scripts contain necessary database and environment loading code inline
- No Python imports from local modules (database_manager, env_loader)
- Each script can run independently with only UV-managed dependencies
- Database operations and environment loading work identically to current implementation

**Tasks**:
- [ ] Extract core DatabaseManager functionality and create inline version
- [ ] Extract core EnvLoader functionality and create inline version
- [ ] Update each UV script to include inline database/env code
- [ ] Test each script independently to verify self-containment
- [ ] Remove standalone database_manager.py and env_loader.py files

### Feature 9: Consolidate Hook Scripts to Single Location

**Description**: Move UV scripts from `src/hooks/uv_scripts/` to `src/hooks/` and remove traditional Python implementations.

**Acceptance Criteria**:
- All hook scripts exist in `src/hooks/` directory
- No duplicate implementations remain
- UV scripts are the only implementation
- Empty `uv_scripts/` directory is removed

**Tasks**:
- [ ] Move all UV scripts from `src/hooks/uv_scripts/` to `src/hooks/`
- [ ] Delete traditional Python hook files (notification.py, post_tool_use.py, etc.)
- [ ] Remove empty `uv_scripts/` directory
- [ ] Verify no broken imports or references
- [ ] Update any relative path references in moved scripts

### Feature 10: Remove UV Suffix from Script Names

**Description**: Rename all hook scripts to remove the `_uv` suffix for cleaner naming convention.

**Acceptance Criteria**:
- All hook scripts have clean names without `_uv` suffix
- Scripts are named: notification.py, post_tool_use.py, etc.
- No references to old `_uv` names remain in codebase

**Tasks**:
- [ ] Rename notification_uv.py to notification.py
- [ ] Rename post_tool_use_uv.py to post_tool_use.py
- [ ] Rename remaining 6 UV scripts to remove suffix
- [ ] Search codebase for any hardcoded references to old names
- [ ] Update any logging or error messages that reference old names

### Feature 11: Update Installation Script for Clean Structure

**Description**: Modify install.py to work with the new simplified structure and naming conventions.

**Acceptance Criteria**:
- Installation script correctly references hooks from `src/hooks/`
- No references to `uv_scripts/` subdirectory
- Helper files list is removed (no database_manager.py, env_loader.py)
- Hook files list uses clean names without `_uv` suffix
- Settings.json generation uses correct paths

**Tasks**:
- [ ] Update hooks_source_dir path to point to `src/hooks/`
- [ ] Update hook_files list to use clean names
- [ ] Remove helper_files list and copying logic
- [ ] Update settings.json hook path generation
- [ ] Test installation process end-to-end

### Feature 12: Update Documentation for Clean Structure

**Description**: Update all documentation to reflect the new simplified structure.

**Acceptance Criteria**:
- CHRONICLE_INSTALLATION_STRUCTURE.md reflects new paths
- No references to dual implementation types
- README files updated with correct structure
- Installation instructions are accurate

**Tasks**:
- [ ] Update CHRONICLE_INSTALLATION_STRUCTURE.md directory structure
- [ ] Update path mapping tables in documentation
- [ ] Update chronicle_readme.md with new structure
- [ ] Remove references to traditional vs UV scripts
- [ ] Update any code examples in docs

### Feature 13: Fix PreToolUse Hook Permission Bug

**Description**: Fix the overly aggressive permission management in the preToolUse hook that causes Claude Code to constantly ask for permission even when auto-approve mode is enabled. Chronicle is an observability tool and should not interfere with Claude Code's normal workflow.

**Acceptance Criteria**:
- PreToolUse hook respects Claude Code's auto-approve mode settings
- Hook continues to log tool usage for observability
- No blocking dialogs or permission prompts when auto-approve is enabled
- Permission flow only triggers when Claude Code itself requires approval
- Chronicle remains purely observational without modifying tool execution flow

**Tasks**:
- [x] Analyze current preToolUse hook permission logic ✅ **COMPLETED**
- [x] Remove or bypass permission checks when auto-approve mode is detected ✅ **COMPLETED**
- [x] Ensure hook only observes and logs without blocking ✅ **COMPLETED**
- [x] Test with various auto-approve configurations ✅ **COMPLETED**
- [x] Validate that observability data is still captured correctly ✅ **COMPLETED**

## Sprint Plan

### ✅ Sprint 1: Core Script Conversion **COMPLETED**
**Features**: Feature 1 (Convert Hooks to UV Single-File Scripts) ✅, Feature 4 (Consolidate Core Dependencies) ✅
**Rationale**: These features work together to create the foundation of self-contained scripts. Converting to UV format and consolidating dependencies must happen together for consistency.
**Status**: All 8 hook scripts successfully converted to UV single-file format. Core dependencies consolidated from ~5,000 lines to ~1,500 lines optimized for inline use. Performance targets achieved (<100ms execution). Zero external import dependencies.

### ✅ Sprint 2: Installation Infrastructure **COMPLETED**
**Features**: Feature 2 (Create Chronicle Subfolder Installation Structure) ✅, Feature 3 (Update Installation Process and Settings Configuration) ✅
**Rationale**: Installation structure and process updates can proceed in parallel with script conversion. These changes don't conflict with Sprint 1 work.
**Status**: Complete chronicle subfolder installation system implemented. UV availability validation added. Migration logic for existing installations. Clean uninstallation process. Settings.json generation updated for chronicle paths. Integration testing completed successfully.

### ✅ Sprint 3: Database Integration and Testing **COMPLETED**
**Features**: Feature 5 (Database Configuration and Environment Management) ✅, Feature 6 (Testing and Validation) ✅
**Rationale**: Database integration and testing depend on completion of previous sprints. These can proceed in parallel once the foundation is established.
**Status**: Database connectivity working with both Supabase and SQLite fallback. Environment loading from chronicle folder. Comprehensive test suite created with all hooks validated for <100ms performance. Integration tests confirm end-to-end functionality.

### ✅ Sprint 4: Critical Bug Fix **COMPLETED**
**Features**: Feature 13 (Fix PreToolUse Hook Permission Bug) ✅
**Rationale**: This bug was actively disrupting user workflows and needed immediate attention. The fix was independent of other refactoring work and has been deployed to restore normal Claude Code operation.
**Status**: Successfully fixed the PreToolUse hook to respect Claude Code's auto-approve mode. Changed default from "ask" to "allow" for standard operations while maintaining "deny" for dangerous operations. Chronicle now remains purely observational.

### Sprint 5: Code Cleanup
**Features**: Feature 8 (Extract and Inline Shared Code)
**Rationale**: With the critical bug fixed, focus on making UV scripts truly self-contained by inlining shared code. This is the foundation for subsequent structure cleanup.

### Sprint 6: Structure Simplification
**Features**: Feature 9 (Consolidate Hook Scripts), Feature 10 (Remove UV Suffix)
**Rationale**: These structural changes depend on Sprint 5's code extraction being complete. Both features can proceed in parallel as they involve file movements and renames that don't conflict.

### Sprint 7: Infrastructure and Documentation Updates
**Features**: Feature 11 (Update Installation Script), Feature 7 (Documentation Updates), Feature 12 (Update Documentation for Clean Structure)
**Rationale**: All documentation and installation updates consolidated into one sprint. These changes depend on the structure simplification from Sprint 6 being complete. Multiple documentation tasks can proceed in parallel.

## Success Metrics

- Hook installation uses only `chronicle` subfolder (zero files outside this folder)
- All hooks execute in <100ms using UV runtime
- Database connectivity works 100% from new scripts
- Installation process completes successfully on clean systems
- Migration from existing installations works without data loss
- Zero external import dependencies for hook scripts
- Complete functional parity with current hook system
- Zero duplicate hook implementations
- All scripts run independently without local Python imports
- Clean, flat directory structure in `src/hooks/`
- PreToolUse hook no longer interferes with auto-approve mode
- All documentation accurately reflects new structure