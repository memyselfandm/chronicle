# Hook Script Cleanup Epic Backlog

## Overview

The goal of this epic is to refactor the Chronicle hooks codebase to achieve a clean, maintainable architecture with UV single-file scripts as the sole implementation. This involves eliminating code duplication, removing unnecessary Python module imports, simplifying the folder structure, and ensuring all scripts are truly self-contained UV scripts with proper dependency management through UV's script headers.

Key objectives:
- Eliminate duplicate hook implementations (traditional Python vs UV scripts)
- Make UV scripts genuinely self-contained without external Python imports
- Simplify folder structure by removing unnecessary nesting
- Remove redundant filename suffixes (`_uv`)
- Update installation and documentation to reflect the clean architecture

## Features

### Feature 1: Extract and Inline Shared Code into UV Scripts

**Description:** Convert DatabaseManager and EnvLoader from separate Python modules into inline code within each UV script, ensuring true self-containment.

**Acceptance Criteria:**
- All UV scripts contain necessary database and environment loading code inline
- No Python imports from local modules (database_manager, env_loader)
- Each script can run independently with only UV-managed dependencies
- Database operations and environment loading work identically to current implementation

**Tasks:**
- [ ] Extract core DatabaseManager functionality and create inline version
- [ ] Extract core EnvLoader functionality and create inline version
- [ ] Update each UV script to include inline database/env code
- [ ] Test each script independently to verify self-containment
- [ ] Remove standalone database_manager.py and env_loader.py files

### Feature 2: Consolidate Hook Scripts to Single Location

**Description:** Move UV scripts from `src/hooks/uv_scripts/` to `src/hooks/` and remove traditional Python implementations.

**Acceptance Criteria:**
- All hook scripts exist in `src/hooks/` directory
- No duplicate implementations remain
- UV scripts are the only implementation
- Empty `uv_scripts/` directory is removed

**Tasks:**
- [ ] Move all UV scripts from `src/hooks/uv_scripts/` to `src/hooks/`
- [ ] Delete traditional Python hook files (notification.py, post_tool_use.py, etc.)
- [ ] Remove empty `uv_scripts/` directory
- [ ] Verify no broken imports or references
- [ ] Update any relative path references in moved scripts

### Feature 3: Remove UV Suffix from Script Names

**Description:** Rename all hook scripts to remove the `_uv` suffix for cleaner naming convention.

**Acceptance Criteria:**
- All hook scripts have clean names without `_uv` suffix
- Scripts are named: notification.py, post_tool_use.py, etc.
- No references to old `_uv` names remain in codebase

**Tasks:**
- [ ] Rename notification_uv.py to notification.py
- [ ] Rename post_tool_use_uv.py to post_tool_use.py
- [ ] Rename remaining 6 UV scripts to remove suffix
- [ ] Search codebase for any hardcoded references to old names
- [ ] Update any logging or error messages that reference old names

### Feature 4: Update Installation Script

**Description:** Modify install.py to work with the new simplified structure and naming conventions.

**Acceptance Criteria:**
- Installation script correctly references hooks from `src/hooks/`
- No references to `uv_scripts/` subdirectory
- Helper files list is removed (no database_manager.py, env_loader.py)
- Hook files list uses clean names without `_uv` suffix
- Settings.json generation uses correct paths

**Tasks:**
- [ ] Update hooks_source_dir path to point to `src/hooks/`
- [ ] Update hook_files list to use clean names
- [ ] Remove helper_files list and copying logic
- [ ] Update settings.json hook path generation
- [ ] Test installation process end-to-end

### Feature 5: Update Documentation

**Description:** Update all documentation to reflect the new simplified structure.

**Acceptance Criteria:**
- CHRONICLE_INSTALLATION_STRUCTURE.md reflects new paths
- No references to dual implementation types
- README files updated with correct structure
- Installation instructions are accurate

**Tasks:**
- [ ] Update CHRONICLE_INSTALLATION_STRUCTURE.md directory structure
- [ ] Update path mapping tables in documentation
- [ ] Update chronicle_readme.md with new structure
- [ ] Remove references to traditional vs UV scripts
- [ ] Update any code examples in docs

### Feature 6: Create Shared UV Package (Optional Enhancement)

**Description:** Create a reusable UV package for shared functionality that can be referenced as a dependency in UV script headers.

**Acceptance Criteria:**
- Shared UV package created with database and env functionality
- Package can be referenced in UV script dependency headers
- Reduces code duplication across scripts
- Works with UV's dependency resolution

**Tasks:**
- [ ] Create chronicle-hooks-common UV package
- [ ] Move shared database logic to package
- [ ] Move shared environment logic to package
- [ ] Update UV scripts to use package as dependency
- [ ] Publish package to appropriate registry or use local path

## Sprint Plan

### Sprint 1: Self-Contained Scripts
- **Feature 1:** Extract and Inline Shared Code into UV Scripts

*Focus: Make UV scripts truly self-contained by inlining shared code. This is prerequisite for all other changes.*

### Sprint 2: Structure Simplification
- **Feature 2:** Consolidate Hook Scripts to Single Location
- **Feature 3:** Remove UV Suffix from Script Names

*Focus: Clean up the folder structure and naming conventions. These can be done in parallel since they're independent operations.*

### Sprint 3: Infrastructure Updates
- **Feature 4:** Update Installation Script
- **Feature 5:** Update Documentation

*Focus: Update supporting infrastructure to work with the new structure. Documentation can be updated while testing installation changes.*

### Sprint 4: Future Enhancement (Optional)
- **Feature 6:** Create Shared UV Package

*Focus: Optional optimization to reduce code duplication through proper UV package management. Can be implemented after core refactoring is complete.*

## Success Metrics
- Zero duplicate hook implementations
- All scripts run independently without local Python imports
- Clean, flat directory structure in `src/hooks/`
- Successful installation with updated install.py
- All documentation accurately reflects new structure