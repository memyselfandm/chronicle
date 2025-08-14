# Chronicle Hooks Enhanced Error Handling Guide

## Overview

The Chronicle hooks system now includes comprehensive error handling designed to ensure hooks **never crash Claude Code execution** while providing useful debugging information for developers. This guide explains the error handling patterns, configuration options, and best practices.

## Key Principles

1. **Never Break Claude**: Hooks always exit with code 0 (success) to avoid interrupting Claude Code workflow
2. **Graceful Degradation**: When components fail, hooks continue with reduced functionality
3. **Comprehensive Logging**: All errors are logged with structured context for debugging
4. **Developer-Friendly Messages**: Error messages include recovery suggestions and actionable steps
5. **Security-First**: Sensitive information is automatically sanitized from logs and error messages

## Error Handling Architecture

### Core Components

- **`ChronicleError`**: Base exception class with structured error information
- **`ChronicleLogger`**: Enhanced logging system with configurable verbosity
- **`ErrorHandler`**: Centralized error processing with recovery strategies
- **Error Decorators**: `@with_error_handling` for automatic error management
- **Context Managers**: `error_context()` for operation-specific error tracking

### Error Classification

Errors are automatically classified by severity and recovery strategy:

| Error Type | Severity | Recovery Strategy | Description |
|------------|----------|------------------|-------------|
| `ValidationError` | LOW | IGNORE | Invalid input data - log and continue |
| `NetworkError` | MEDIUM | RETRY | Network connectivity issues - retry with backoff |
| `DatabaseError` | HIGH | FALLBACK | Database failures - switch to SQLite fallback |
| `SecurityError` | CRITICAL | ESCALATE | Security violations - log extensively |
| `ConfigurationError` | HIGH | ESCALATE | Setup/configuration issues |

## Configuration

### Environment Variables

```bash
# Logging configuration
export CHRONICLE_LOG_LEVEL="DEBUG"  # DEBUG, INFO, WARN, ERROR
export CHRONICLE_LOG_FILE="~/.claude/chronicle_hooks.log"

# Database fallback configuration
export CLAUDE_HOOKS_SQLITE_FALLBACK="true"
export CLAUDE_HOOKS_DB_PATH="~/.claude/hooks_data.db"

# Error handling behavior
export CHRONICLE_MAX_RETRIES="3"
export CHRONICLE_RETRY_DELAY="1.0"
export CHRONICLE_CIRCUIT_BREAKER_THRESHOLD="5"
```

### Hook Configuration

```python
# In hook __init__ method
config = {
    "error_handling": {
        "max_retries": 3,
        "retry_delay": 1.0,
        "log_level": "INFO"
    },
    "database": {
        "fallback_enabled": True,
        "timeout": 30
    }
}

hook = BaseHook(config)
```

## Usage Patterns

### 1. Enhanced BaseHook Usage

The updated `BaseHook` class automatically provides error handling:

```python
class MyCustomHook(BaseHook):
    def __init__(self, config=None):
        super().__init__(config)
        # Error handling is automatically initialized
        # - self.chronicle_logger: Enhanced logger
        # - self.error_handler: Error processing
        # - Graceful database initialization
    
    def process_data(self, data):
        # Use error context for operation-specific error tracking
        with error_context("process_data", {"data_type": type(data).__name__}):
            # Your processing logic here
            result = self.save_event(data)  # Automatically handles database errors
            return result
```

### 2. Function-Level Error Handling

Use the `@with_error_handling` decorator for automatic error management:

```python
from core.errors import with_error_handling, RetryConfig

@with_error_handling(
    operation="api_request",
    retry_config=RetryConfig(max_attempts=3, base_delay=1.0),
    fallback_func=lambda: {"status": "offline"}
)
def make_api_request(url):
    # Function that might fail
    response = requests.get(url, timeout=10)
    return response.json()
```

### 3. Context Manager for Operations

Use `error_context` for fine-grained error tracking:

```python
from core.errors import error_context

def complex_operation(data):
    with error_context("data_validation", {"size": len(data)}) as handler:
        validated_data = validate_input(data)
    
    with error_context("database_save", {"event_type": data.get("type")}) as handler:
        success = save_to_database(validated_data)
    
    return success
```

### 4. Main Hook Entry Point Pattern

Updated pattern for hook main functions:

```python
def main():
    """Enhanced main function with comprehensive error handling."""
    from core.errors import ErrorHandler, ChronicleLogger, error_context
    
    # Initialize error handling
    logger = ChronicleLogger(name="chronicle.my_hook")
    error_handler = ErrorHandler(logger)
    
    try:
        with error_context("hook_main") as handler:
            # Read and validate input
            input_data = read_stdin_input()
            
            # Initialize hook
            hook = MyHook()
            
            # Process hook logic
            result = hook.process(input_data)
            
            # Output response
            response = hook.create_response(result)
            print(json.dumps(response))
            
    except Exception as e:
        # Ultimate fallback - should rarely be reached
        should_continue, exit_code, message = error_handler.handle_error(e)
        
        # Always output valid JSON and exit with 0
        minimal_response = {"continue": True, "suppressOutput": True}
        print(json.dumps(minimal_response))
    
    # Always exit with success to avoid breaking Claude
    sys.exit(0)
```

## Error Message Templates

The system provides standardized error messages with recovery suggestions:

### User-Friendly Messages

```
Chronicle Hook Error [a1b2c3d4]: Database connection failed

Suggestion: Check database connection and retry. Data will be saved locally as fallback.
```

### Developer Messages

```
Error a1b2c3d4 (DB_ERROR): Database connection failed during session_save
Context: {
  "session_id": "session-123",
  "operation": "save_session",
  "retry_attempt": 2
}
Recovery: Check database credentials and network connectivity
```

## Logging and Monitoring

### Log Levels

- **ERROR**: Critical errors that need attention
- **WARN**: Issues that don't break functionality but should be investigated
- **INFO**: Important operational events (hook executions, database operations)
- **DEBUG**: Detailed execution flow for troubleshooting

### Structured Logging Format

```json
{
  "timestamp": "2025-01-08T10:30:45.123Z",
  "level": "ERROR",
  "message": "Database save failed",
  "context": {
    "hook": "session_start",
    "error_id": "a1b2c3d4",
    "session_id": "session-123",
    "retry_attempt": 3,
    "operation": "save_event"
  },
  "error_details": {
    "error_type": "DatabaseError",
    "error_code": "DB_CONNECTION_FAILED",
    "recovery_suggestion": "Check database connectivity"
  }
}
```

### Log File Locations

- **Enhanced Logs**: `~/.claude/chronicle_hooks.log`
- **Legacy Logs**: `~/.claude/hooks_debug.log` (for backward compatibility)

## Testing Error Scenarios

### Unit Tests

```python
from core.errors import ChronicleError, ErrorHandler

def test_database_error_handling():
    error_handler = ErrorHandler()
    
    db_error = DatabaseError("Connection timeout")
    should_continue, exit_code, message = error_handler.handle_error(db_error)
    
    assert should_continue == True  # Graceful degradation
    assert exit_code == 1  # Non-blocking error
    assert "Connection timeout" in message
```

### Integration Tests

```bash
# Test hook with various failure scenarios
python tests/test_hook_error_scenarios.py

# Test specific error conditions
python -c "
import json
import subprocess
result = subprocess.run(
    ['python', 'src/hooks/session_start.py'],
    input='invalid json',
    capture_output=True,
    text=True
)
print('Exit code:', result.returncode)  # Should be 0
print('Response:', result.stdout)  # Should be valid JSON
"
```

## Best Practices

### 1. Always Use Error Handling

```python
# ❌ Bad: No error handling
def save_data(data):
    return database.save(data)

# ✅ Good: With error handling
@with_error_handling(operation="save_data")
def save_data(data):
    return database.save(data)
```

### 2. Provide Context

```python
# ❌ Bad: Generic error handling
try:
    process_file(filename)
except Exception as e:
    logger.error("File processing failed")

# ✅ Good: Contextual error handling
with error_context("file_processing", {"filename": filename, "size": file_size}):
    process_file(filename)
```

### 3. Use Appropriate Error Types

```python
# ❌ Bad: Generic exceptions
if not validate_input(data):
    raise Exception("Invalid input")

# ✅ Good: Specific error types
if not validate_input(data):
    raise ValidationError(
        "Input validation failed: missing required fields",
        context={"provided_fields": list(data.keys())}
    )
```

### 4. Graceful Degradation

```python
# ❌ Bad: Hard failure
def get_user_data(user_id):
    return database.get_user(user_id)  # Fails if DB is down

# ✅ Good: Graceful degradation
@with_error_handling(
    operation="get_user_data",
    fallback_func=lambda user_id: {"id": user_id, "status": "unknown"}
)
def get_user_data(user_id):
    return database.get_user(user_id)
```

### 5. Never Break Claude Code

```python
# ❌ Bad: Can break Claude execution
def main():
    hook = MyHook()
    result = hook.process()
    sys.exit(1 if result.failed else 0)

# ✅ Good: Always continue Claude execution
def main():
    try:
        hook = MyHook()
        result = hook.process()
        response = create_success_response(result)
    except Exception as e:
        response = create_error_response(e)
    
    print(json.dumps(response))
    sys.exit(0)  # Always success
```

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   - Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
   - Verify network connectivity
   - Enable SQLite fallback: `export CLAUDE_HOOKS_SQLITE_FALLBACK=true`

2. **Permission Errors**
   - Check write permissions for `~/.claude/` directory
   - Verify log file locations are accessible
   - Run with appropriate user permissions

3. **High Error Rates**
   - Check log files for error patterns
   - Increase log level to DEBUG: `export CHRONICLE_LOG_LEVEL=DEBUG`
   - Monitor error frequency and implement circuit breakers

### Debug Mode

Enable debug mode for detailed error tracking:

```bash
export CHRONICLE_LOG_LEVEL=DEBUG
export CHRONICLE_DEBUG_MODE=true

# Run hook with debug output
python src/hooks/session_start.py < test_input.json
```

### Log Analysis

```bash
# View recent errors
tail -f ~/.claude/chronicle_hooks.log | grep ERROR

# Search for specific error patterns
grep "DatabaseError" ~/.claude/chronicle_hooks.log | tail -10

# Analyze error frequencies
grep "error_id" ~/.claude/chronicle_hooks.log | cut -d'"' -f4 | sort | uniq -c | sort -nr
```

## Error Recovery Strategies

### Automatic Recovery

1. **Retry with Exponential Backoff**: Network and database errors
2. **Circuit Breaker**: Prevents cascading failures
3. **Fallback Operations**: SQLite fallback for database failures
4. **Graceful Degradation**: Continue with reduced functionality

### Manual Recovery

1. **Configuration Fixes**: Update environment variables
2. **Permission Repairs**: Fix file system permissions
3. **Database Maintenance**: Repair database connections
4. **Resource Management**: Free up system resources

## Migration Guide

### Updating Existing Hooks

1. **Import Enhanced Error Handling**:
   ```python
   from core.errors import ChronicleLogger, ErrorHandler, error_context
   ```

2. **Update Hook Initialization**:
   ```python
   # Old
   class MyHook(BaseHook):
       def __init__(self):
           super().__init__()
   
   # New - BaseHook automatically includes error handling
   class MyHook(BaseHook):
       def __init__(self, config=None):
           super().__init__(config)  # Error handling included
   ```

3. **Wrap Critical Operations**:
   ```python
   # Old
   def process(self, data):
       return self.save_event(data)
   
   # New
   @with_error_handling(operation="process_data")
   def process(self, data):
       return self.save_event(data)
   ```

4. **Update Main Function**:
   ```python
   # Follow the enhanced main function pattern (see above)
   ```

### Testing Migration

1. Run existing tests to ensure compatibility
2. Test error scenarios with new error handling
3. Verify log output format and content
4. Confirm hooks never return non-zero exit codes

This enhanced error handling system ensures Chronicle hooks are robust, reliable, and developer-friendly while maintaining seamless integration with Claude Code's execution environment.