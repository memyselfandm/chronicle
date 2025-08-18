# PRD Folder Cleanup Plan

## Overview

This document outlines the plan to clean up the `ai_context/prds/` folder after the cleanup workstream is complete. The goals are to:

1. **Add PRDs to .gitignore** - Keep planning documents private and out of the public repository
2. **Archive completed work** - Move finished backlogs and superseded documents to an archive folder
3. **Maintain active documents** - Keep only relevant, active planning documents in the main folder

## Current State

The PRDs folder currently contains 14 files:
- 4 completed backlogs (100% done)
- 7 superseded or backup files
- 3 active/future planning documents

## Implementation Plan

### Step 1: Update .gitignore

Add the following entry to `.gitignore`:

```gitignore
# PRDs and planning documents (internal only)
ai_context/prds/
```

This will prevent all PRD documents from being committed to the public repository.

### Step 2: Archive Completed Documents

Move the following **completed backlogs** to `ai_context/prds/archive/`:

#### Completed Backlogs (100% Production Ready)
1. `00_mvp_backlog.md` - MVP is 100% production ready, all sprints completed
2. `01_hooks_refguide_backlog.md` - All 4 sprints completed, hooks aligned with Claude Code reference
3. `02-1_uv_sfs_refactor_backlog.md` - All 10 sprints completed, UV architecture implemented
4. `02-2_dashboard_production_ready.md` - All 7 sprints completed, dashboard is production ready

### Step 3: Archive Superseded Documents

Move the following **superseded/old documents** to `ai_context/prds/archive/`:

#### Initial PRDs (Superseded by MVP Backlog)
1. `00_dashboard_initial_prd.md` - Original dashboard PRD, superseded by MVP backlog
2. `00_hooks_initial_prd.md` - Original hooks PRD, superseded by MVP backlog

#### Old/Backup Versions
3. `02_uv_sfs_refactor_backlog.md` - Original version, superseded by 02-1 (corrected version)
4. `02_uv_sfs_refactor_backlog.backup.md` - Backup file from refactor
5. `02_uv_sfs_refactor_backlog.wrecked.md` - Old wrecked version from Sprint 1 error
6. `03_hook_script_cleanup_backlog.md` - Superseded by UV refactor work
7. `03_hook_script_cleanup_backlog.backup.md` - Backup file

### Step 4: Retain Active Documents

Keep the following files in the main `ai_context/prds/` folder:

#### Active Planning Documents
1. `00_future_roadmap.md` - Still relevant for future feature planning
2. `00_issues_bugs.md` - Active issue and bug tracking
3. `04_database_middleware_server.prd.md` - Future work not yet started
4. `02-4_prd_cleanup.plan.md` - This cleanup plan (self-reference)

## File Movement Commands

When ready to execute, use these commands:

```bash
# Create archive directory if it doesn't exist
mkdir -p ai_context/prds/archive

# Move completed backlogs
mv ai_context/prds/00_mvp_backlog.md ai_context/prds/archive/
mv ai_context/prds/01_hooks_refguide_backlog.md ai_context/prds/archive/
mv ai_context/prds/02-1_uv_sfs_refactor_backlog.md ai_context/prds/archive/
mv ai_context/prds/02-2_dashboard_production_ready.md ai_context/prds/archive/

# Move superseded documents
mv ai_context/prds/00_dashboard_initial_prd.md ai_context/prds/archive/
mv ai_context/prds/00_hooks_initial_prd.md ai_context/prds/archive/
mv ai_context/prds/02_uv_sfs_refactor_backlog.md ai_context/prds/archive/
mv ai_context/prds/02_uv_sfs_refactor_backlog.backup.md ai_context/prds/archive/
mv ai_context/prds/02_uv_sfs_refactor_backlog.wrecked.md ai_context/prds/archive/
mv ai_context/prds/03_hook_script_cleanup_backlog.md ai_context/prds/archive/
mv ai_context/prds/03_hook_script_cleanup_backlog.backup.md ai_context/prds/archive/
```

## Expected Results

After cleanup:

### Main PRDs Folder (`ai_context/prds/`)
- 4 files remaining (3 active + this plan)
- Clean, focused on current and future work
- No clutter from completed or superseded documents

### Archive Folder (`ai_context/prds/archive/`)
- 11 files archived
- Historical record of completed work
- Reference for future planning

### Repository
- PRDs folder completely gitignored
- Planning documents remain private
- No PRDs in public repository

## Benefits

1. **Privacy**: PRDs and internal planning documents stay private
2. **Organization**: Clear separation between active and completed work
3. **Cleanliness**: Main folder only contains relevant, active documents
4. **History**: Archive preserves completed work for reference
5. **Focus**: Developers see only what's currently relevant

## Execution Timeline

This cleanup should be executed:
- **After** the current cleanup workstream is complete
- **Before** starting new major feature work
- **When** there's a natural break in development

## Notes

- The archive folder will also be gitignored (as part of the parent folder)
- Consider creating a README in the archive folder explaining its contents
- Future completed backlogs should follow the same archival process
- Active bugs and issues should remain in the main folder for visibility