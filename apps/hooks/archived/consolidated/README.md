# Chronicle Hooks Consolidated Dependencies

This directory contains consolidated versions of all Chronicle hooks core dependencies, optimized for inlining into UV single-file scripts. The consolidation reduces the ~5,000 lines of original dependencies down to essential functionality suitable for single-file use.

## Key Consolidations Made

### Size Reduction
- **Original**: ~5,000+ lines across 7+ modules
- **Consolidated**: ~1,500 lines across 6 modules
- **Footprint per hook**: <500 lines including inline dependencies

### Functional Simplifications
- Removed async/await functionality to reduce complexity
- Simplified error handling without complex retry logic
- Removed performance monitoring dependencies (psutil, etc.)
- Consolidated client classes into single interfaces
- Essential validation only, removed complex pattern matching
- Basic caching without advanced eviction strategies

### Maintained Capabilities
- ✅ Database connectivity (Supabase + SQLite fallback)
- ✅ Security validation and input sanitization
- ✅ Error handling and logging
- ✅ Performance monitoring (<100ms execution requirement)
- ✅ Session and event management
- ✅ Cross-platform compatibility (basic)

## Module Overview

### `database.py` (~300 lines)
Consolidated database client with automatic Supabase/SQLite fallback.
- **Key features**: Session/event saving, connection testing, schema management
- **Removed**: Async operations, complex retry logic, connection pooling
- **Dependencies**: `supabase` (optional), `sqlite3` (builtin)

### `security.py` (~200 lines)
Essential security validation for hook inputs.
- **Key features**: Input size limits, schema validation, sensitive data sanitization
- **Removed**: Complex pattern matching, metrics tracking, detailed path validation
- **Dependencies**: None (uses only builtins)

### `errors.py` (~250 lines)
Simplified error handling and logging.
- **Key features**: Basic file logging, error classification, graceful degradation
- **Removed**: Complex retry logic, error recovery strategies, structured metrics
- **Dependencies**: None (uses only builtins)

### `performance.py` (~300 lines)
Basic performance monitoring and caching.
- **Key features**: Execution timing, simple caching, early return validation
- **Removed**: Memory monitoring, complex metrics collection, psutil dependency
- **Dependencies**: None (uses only builtins)

### `utils.py` (~300 lines)
Essential utilities for data processing and project context.
- **Key features**: Data sanitization, git info, session context, JSON validation
- **Removed**: Cross-platform complexity, advanced path resolution, subprocess timeouts
- **Dependencies**: None (uses only builtins)

### `base_hook.py` (~200 lines)
Minimal base hook class using all consolidated dependencies.
- **Key features**: Full hook lifecycle, optimized execution, session management
- **Removed**: Complex caching, advanced error recovery, performance metrics collection
- **Dependencies**: All above consolidated modules

## Usage Examples

### Basic Hook Implementation

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["supabase"]
# ///

from consolidated import consolidated_hook

@consolidated_hook("SessionStart")
def session_start_hook(processed_data):
    """Simple session start hook."""
    return {
        "continue": True,
        "suppressOutput": False,
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "message": "Session started successfully"
        }
    }

if __name__ == "__main__":
    import json
    import sys
    
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    
    # Process with hook
    result = session_start_hook(input_data)
    
    # Output result
    print(json.dumps(result))
```

### Manual Hook Implementation

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["supabase"]
# ///

from consolidated import create_hook

def custom_hook(input_data):
    # Create hook instance
    hook = create_hook()
    
    # Define hook logic
    def hook_logic(processed_data):
        # Your custom hook logic here
        hook_event = processed_data["hook_event_name"]
        
        # Save event to database
        event_data = {
            "event_type": "custom",
            "hook_event_name": hook_event,
            "data": processed_data["raw_input"]
        }
        hook.save_event(event_data)
        
        return {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": hook_event,
                "processed": True
            }
        }
    
    # Execute with optimization
    return hook.execute_hook_optimized(input_data, hook_logic)
```

### Component Usage

```python
# Individual components can be used separately
from consolidated import (
    create_database, create_security_validator, 
    create_logger, sanitize_data
)

# Database operations
db = create_database()
success, session_id = db.save_session({"claude_session_id": "test"})

# Security validation
security = create_security_validator()
validated_data = security.comprehensive_validation(input_data)

# Logging
logger = create_logger("my_hook")
logger.info("Processing started")

# Data sanitization
clean_data = sanitize_data(raw_data)
```

## Performance Characteristics

- **Initialization**: <10ms typical
- **Hook execution**: <100ms (Claude Code requirement)
- **Memory usage**: Minimal (no heavy dependencies)
- **Database operations**: <50ms typical
- **Security validation**: <5ms typical

## Inlining Strategy

For maximum portability, you can inline the consolidated modules directly into your UV scripts:

1. Copy the essential functions from each module
2. Remove imports between consolidated modules
3. Inline only the functions you need
4. Target <500 lines total per hook including dependencies

## Migration from Full Dependencies

To migrate existing hooks to use consolidated dependencies:

1. Replace `from core.base_hook import BaseHook` with `from consolidated import ConsolidatedBaseHook`
2. Update method calls to use simplified interfaces
3. Remove async/await usage
4. Test performance to ensure <100ms execution
5. Verify database operations still work as expected

## Limitations

- No async/await support (not needed for UV single-file scripts)
- Simplified error recovery (basic logging only)
- Reduced cross-platform path handling
- Basic caching (no advanced eviction strategies)
- Limited performance metrics collection

These limitations are acceptable for UV single-file script usage while maintaining all essential Chronicle hooks functionality.