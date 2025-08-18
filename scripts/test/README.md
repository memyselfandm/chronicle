# Test Utilities

This directory contains testing utilities and helper scripts that don't belong in the main test suites.

## Scripts

### `test_claude_code_env.sh`
Environment testing script for debugging Claude Code hook integration:
- Tests hook execution environment
- Validates environment variables
- Checks .env file locations
- Simulates Claude Code hook calls

**Usage:**
```bash
bash scripts/test/test_claude_code_env.sh
```

### `test_hook_trigger.txt`
Simple test trigger file used for manual testing:
- Contains sample text that should trigger PreToolUse and PostToolUse hooks
- Used with Claude Code debug mode
- Useful for quick integration testing

**Usage:**
This file is referenced by other test scripts or used manually in Claude Code debug sessions.

## Purpose

These utilities are different from the main test suites in `/apps/hooks/tests/` and `/apps/dashboard/__tests__/` because they are:
- Development and debugging helpers
- Environment validation tools  
- Manual testing aids
- Integration testing utilities

They complement the automated test suites but serve a different purpose in the development workflow.