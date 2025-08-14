# Chronicle Hooks Reference Guide Update Backlog

## Overview

This epic focuses on updating the Chronicle hooks system to align with the latest Claude Code hooks reference documentation. The primary goals are:

1. **Fix Configuration Issues**: Resolve invalid matcher syntax and incorrect event names that prevent hooks from registering properly
2. **Modernize Output Formats**: Update hooks to use the new JSON output structures with `hookSpecificOutput` 
3. **Enhance Security**: Add input validation, sanitization, and security best practices
4. **Improve Performance**: Ensure all hooks execute within the recommended <100ms timeframe
5. **Add New Features**: Implement permission decisions, context injection, and environment variable support

## Reference
1. Claude Code hooks reference: @ai_context/knowledge/claude-code-hooks-reference.md

## Features

### Feature 1: Fix Hook Configuration and Registration

**Description**: Update hook configurations to use valid syntax and correct event names according to the latest Claude Code reference.

**Acceptance Criteria**:
- All hook configurations use valid matcher syntax (no `"matcher": "*"`)
- SessionStart hook is properly configured with correct matchers
- Event names match documentation exactly (case-sensitive)
- Installation script generates valid settings.json

**Tasks**:
- [x] Remove `"matcher": "*"` from PreToolUse and PostToolUse in install.py ✅ **COMPLETED**
- [x] Update SessionStart to use "startup", "resume", "clear" matchers ✅ **COMPLETED**
- [x] Fix event name casing throughout the codebase (e.g., "SessionStart" not "session_start") ✅ **COMPLETED**
- [x] Update test files to match new configuration format ✅ **COMPLETED**
- [x] Validate generated settings.json against Claude Code schema ✅ **COMPLETED**

**Sprint 1 Status**: ✅ **COMPLETED** - All critical configuration fixes implemented with comprehensive test coverage.

### Feature 2: Implement New JSON Output Formats

**Description**: Update all hooks to use the new JSON output structure with `hookSpecificOutput` for better control and clarity.

**Acceptance Criteria**:
- PreToolUse uses `permissionDecision` and `permissionDecisionReason`
- UserPromptSubmit supports `additionalContext` injection
- SessionStart supports `additionalContext` for loading context
- All hooks properly set `continue`, `stopReason`, and `suppressOutput` fields

**Tasks**:
- [x] Update BaseHook.create_response() to support new output format ✅ **COMPLETED**
- [x] Implement PreToolUse permission decision logic (allow/deny/ask) ✅ **COMPLETED**
- [x] Add additionalContext support to UserPromptSubmit and SessionStart ✅ **COMPLETED**
- [x] Update PostToolUse to support decision blocking ✅ **COMPLETED**
- [x] Create helper methods for building hookSpecificOutput ✅ **COMPLETED**

**Sprint 2 Status**: ✅ **COMPLETED** - New JSON output formats with hookSpecificOutput implemented across all hooks.

### Feature 3: Add Input Validation and Security

**Description**: Implement comprehensive input validation and security measures to prevent malicious use and ensure data integrity.

**Acceptance Criteria**:
- All file paths are validated against directory traversal
- Input size limits are enforced (configurable MAX_INPUT_SIZE_MB)
- Sensitive data detection is enhanced and comprehensive
- Shell commands are properly escaped
- JSON schemas are validated on input

**Tasks**:
- [ ] Implement path traversal validation in BaseHook
- [ ] Add input size validation with configurable limits
- [ ] Enhance sensitive data detection patterns
- [ ] Create shell escaping utility functions
- [ ] Add JSON schema validation for hook inputs

### Feature 4: Use Environment Variables and Project Paths

**Description**: Update hooks to use `$CLAUDE_PROJECT_DIR` and other environment variables for better portability.

**Acceptance Criteria**:
- Hook paths in settings.json use $CLAUDE_PROJECT_DIR
- Hooks can access CLAUDE_PROJECT_DIR at runtime
- Documentation shows proper environment variable usage
- Hooks work regardless of Claude's current directory

**Tasks**:
- [ ] Update install.py to use $CLAUDE_PROJECT_DIR in hook paths
- [ ] Add CLAUDE_PROJECT_DIR usage to hook implementations
- [ ] Update documentation with environment variable examples
- [ ] Test hooks work from different working directories
- [ ] Add fallback logic for missing environment variables

### Feature 5: Performance Optimization

**Description**: Optimize hook execution to ensure all hooks complete within the recommended 100ms timeframe.

**Acceptance Criteria**:
- All hooks execute in <100ms under normal conditions
- Performance metrics are logged for monitoring
- Database operations are optimized or made async
- Early returns are implemented for validation failures

**Tasks**:
- [ ] Add timing measurements to all hooks
- [ ] Implement async database operations where beneficial
- [ ] Add early return paths for validation failures
- [ ] Create performance benchmarking tests
- [ ] Document performance optimization techniques

### Feature 6: PreToolUse Permission Controls

**Description**: Implement the new permission decision system for PreToolUse hooks to control tool execution.

**Acceptance Criteria**:
- PreToolUse can return "allow", "deny", or "ask" decisions
- Permission decisions include appropriate reasons
- Auto-approval logic for safe operations (e.g., reading docs)
- Blocking logic for sensitive operations
- Proper integration with Claude Code permission system

**Tasks**:
- [x] Implement permission decision logic in PreToolUse ✅ **COMPLETED**
- [x] Add configurable rules for auto-approval ✅ **COMPLETED**
- [x] Create sensitive operation detection ✅ **COMPLETED**
- [x] Add permission reason generation ✅ **COMPLETED**
- [x] Test integration with Claude Code permissions ✅ **COMPLETED**

**Sprint 2 Status**: ✅ **COMPLETED** - Permission controls implemented with comprehensive security analysis and decision logic.

### Feature 7: Enhanced Error Handling and Logging

**Description**: Improve error handling to ensure hooks fail gracefully and provide useful debugging information.

**Acceptance Criteria**:
- All exceptions are caught and logged appropriately
- Exit codes follow documentation (0, 2, other)
- Error messages are helpful and actionable
- Debug mode provides detailed execution traces
- Hooks never crash Claude Code execution

**Tasks**:
- [ ] Implement comprehensive try-catch blocks
- [ ] Standardize exit code usage across hooks
- [ ] Create detailed error message templates
- [ ] Add debug logging with verbosity levels
- [ ] Test error scenarios and recovery

### Feature 8: Testing and Documentation Updates

**Description**: Update all tests and documentation to reflect the new hook implementations and best practices.

**Acceptance Criteria**:
- All unit tests pass with new implementations
- Integration tests cover new features
- README reflects new JSON output formats
- Security best practices are documented
- Installation guide is updated

**Tasks**:
- [ ] Update unit tests for new output formats
- [ ] Create integration tests for permission decisions
- [ ] Update README with new examples
- [ ] Document security best practices
- [ ] Create troubleshooting guide

## Sprint Plan

### ✅ Sprint 1: Critical Configuration Fixes **COMPLETED**
**Features**: Feature 1 (Fix Hook Configuration and Registration) ✅
**Rationale**: These fixes are blocking proper hook registration and must be completed first. Can be done independently without dependencies.
**Status**: All critical configuration issues resolved. Hooks now generate valid Claude Code settings.json configurations.

### ✅ Sprint 2: Output Format Modernization **COMPLETED**
**Features**: Feature 2 (Implement New JSON Output Formats) ✅, Feature 6 (PreToolUse Permission Controls) ✅
**Rationale**: These features work together to implement the new output structures. PreToolUse permissions depend on the new JSON format.
**Status**: All hooks now use new JSON output format with hookSpecificOutput. Permission controls implemented with security analysis.

### Sprint 3: Security and Validation
**Features**: Feature 3 (Add Input Validation and Security), Feature 7 (Enhanced Error Handling and Logging)
**Rationale**: Security features can be implemented in parallel with error handling. Both improve hook reliability.

### Sprint 4: Environment and Performance
**Features**: Feature 4 (Use Environment Variables and Project Paths), Feature 5 (Performance Optimization)
**Rationale**: Environment variable updates and performance optimization can proceed in parallel without conflicts.

### Sprint 5: Testing and Documentation
**Features**: Feature 8 (Testing and Documentation Updates)
**Rationale**: Final sprint to ensure all changes are properly tested and documented. Depends on completion of previous sprints.

## Success Metrics

- All hooks register successfully with Claude Code
- Hook execution time P95 < 100ms
- Zero hook failures that crash Claude Code
- 100% test coverage for new features
- Security vulnerabilities: 0 critical, 0 high
- Documentation completeness score > 90%