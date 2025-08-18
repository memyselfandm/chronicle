# SQL Migration Files

This directory contains SQL migration files for Chronicle Hooks database schema management.

## File Naming Convention

Migration files use the format: `YYYYMMDD_HHMMSS_description.sql`

Example: `20241201_000001_fix_supabase_schema.sql`

## Migration Files

### 20241201_000001_fix_supabase_schema.sql
**Purpose:** Initial Supabase schema fixes for Chronicle Hooks compatibility
**Description:** Adds missing columns to existing `chronicle_sessions` and `chronicle_events` tables to match what the hooks expect. Includes performance indexes.

**Changes:**
- Adds `git_commit`, `source`, `updated_at` to `chronicle_sessions`
- Adds `hook_event_name`, `data`, `metadata` to `chronicle_events`
- Creates performance indexes on events table

### 20241201_120000_fix_supabase_schema_complete.sql
**Purpose:** Complete Supabase schema setup with specialized tables
**Description:** Creates the full schema including specialized tables for tool events and prompt events with proper relationships and RLS policies.

**Changes:**
- Extends basic schema from previous migration
- Adds `chronicle_tool_events` table for detailed tool tracking
- Adds `chronicle_prompt_events` table for prompt analysis
- Implements Row Level Security policies
- Creates comprehensive indexing strategy

### 20241202_000000_add_event_types_migration.sql
**Purpose:** Update event type constraints to support all hook types
**Description:** Updates the event_type check constraint to include all new hook event types, providing 1:1 mapping between hooks and event types.

**Changes:**
- Drops existing event_type check constraint
- Adds new constraint with complete list of event types
- Maps legacy types to new hook-specific types

### 20241202_120000_migrate_event_types.sql
**Purpose:** Migrate existing events to new type system
**Description:** Converts legacy event types (like 'tool_use', 'prompt') to the new specific event types based on the actual hook that generated them.

**Changes:**
- Converts `tool_use` events to `pre_tool_use`/`post_tool_use` based on metadata
- Converts `prompt` events to `user_prompt_submit`
- Converts `session_end` to `stop`
- Handles misclassified notification events
- Provides migration statistics

### 20241203_000000_check_actual_schema.sql
**Purpose:** Schema validation and inspection queries
**Description:** Utility queries to check the actual schema state in Supabase and validate that migrations were applied correctly.

**Changes:**
- Queries to inspect `chronicle_sessions` columns
- Queries to inspect `chronicle_events` columns
- Validation of schema state

## Usage

These migration files are designed to be run in order against a Supabase database. Each file is idempotent where possible (uses `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.).

### Running Migrations

1. **Manual Execution:** Copy and paste the SQL content into the Supabase SQL editor
2. **Script-based:** Use the database utilities in `scripts/db_utils/` 
3. **CLI Tools:** Use psql or other PostgreSQL clients

### Migration Dependencies

- Migrations should be run in timestamp order
- Each migration assumes the previous ones have been applied
- The `check_actual_schema.sql` can be used to validate state before/after

## Best Practices

- Always backup your database before running migrations
- Test migrations on a development environment first
- Review the migration content to understand what changes will be made
- Check that your application is compatible with the schema changes

## Rollback Strategy

These migrations focus on additive changes (adding columns, creating tables, updating constraints). For rollback:

- New columns can be dropped
- New tables can be dropped  
- Check constraints can be reverted to previous definitions
- Indexes can be dropped

Consider creating rollback scripts if you need to reverse these changes.