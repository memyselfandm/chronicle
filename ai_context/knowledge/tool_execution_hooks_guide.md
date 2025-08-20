# Tool Execution Hooks Implementation Guide

## Overview

This guide covers implementing pre/post execution hooks for tool monitoring in Python applications. These patterns enable comprehensive data capture about tool usage, including parameters, context, and execution results.

## Core Hook Architecture Patterns

### 1. Decorator-Based Interception

The most Pythonic approach for tool execution monitoring uses function decorators:

```python
from functools import wraps
import time
import logging
from typing import Any, Callable, Dict

def tool_execution_hook(hook_manager):
    """Decorator for capturing tool execution data"""
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Pre-execution hook
            execution_id = hook_manager.generate_execution_id()
            start_time = time.time()
            
            pre_context = {
                'tool_name': func.__name__,
                'module': func.__module__,
                'args': args,
                'kwargs': kwargs,
                'timestamp': start_time,
                'execution_id': execution_id
            }
            
            hook_manager.capture_pre_execution(pre_context)
            
            try:
                # Execute the original function
                result = func(*args, **kwargs)
                
                # Post-execution hook (success)
                end_time = time.time()
                post_context = {
                    'execution_id': execution_id,
                    'result': result,
                    'duration': end_time - start_time,
                    'status': 'success',
                    'timestamp': end_time
                }
                
                hook_manager.capture_post_execution(post_context)
                return result
                
            except Exception as e:
                # Post-execution hook (error)
                end_time = time.time()
                error_context = {
                    'execution_id': execution_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'duration': end_time - start_time,
                    'status': 'error',
                    'timestamp': end_time
                }
                
                hook_manager.capture_post_execution(error_context)
                raise
                
        return wrapper
    return decorator
```

### 2. Context Manager Pattern

For more controlled execution monitoring:

```python
from contextlib import contextmanager
from typing import Generator, Dict, Any

@contextmanager
def tool_execution_context(tool_name: str, parameters: Dict[str, Any]) -> Generator[Dict[str, Any], None, None]:
    """Context manager for tool execution monitoring"""
    
    execution_id = generate_execution_id()
    start_time = time.time()
    
    # Pre-execution
    context = {
        'execution_id': execution_id,
        'tool_name': tool_name,
        'parameters': parameters,
        'start_time': start_time
    }
    
    capture_pre_execution(context)
    
    try:
        yield context
        
        # Post-execution success
        end_time = time.time()
        context.update({
            'end_time': end_time,
            'duration': end_time - start_time,
            'status': 'success'
        })
        capture_post_execution(context)
        
    except Exception as e:
        # Post-execution error
        end_time = time.time()
        context.update({
            'end_time': end_time,
            'duration': end_time - start_time,
            'status': 'error',
            'error': str(e),
            'error_type': type(e).__name__
        })
        capture_post_execution(context)
        raise
```

### 3. Event-Driven Hook System

For more complex monitoring requirements:

```python
from enum import Enum
from typing import Protocol, Callable, Dict, Any
import asyncio

class HookEvent(Enum):
    TOOL_PRE_EXECUTION = "tool:pre_execution"
    TOOL_POST_EXECUTION = "tool:post_execution"
    TOOL_ERROR = "tool:error"

class HookHandler(Protocol):
    def handle(self, event: HookEvent, data: Dict[str, Any]) -> None:
        ...

class ToolExecutionMonitor:
    def __init__(self):
        self.handlers: Dict[HookEvent, list[HookHandler]] = {}
        
    def register_handler(self, event: HookEvent, handler: HookHandler):
        if event not in self.handlers:
            self.handlers[event] = []
        self.handlers[event].append(handler)
        
    async def emit_event(self, event: HookEvent, data: Dict[str, Any]):
        if event in self.handlers:
            for handler in self.handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler.handle):
                        await handler.handle(event, data)
                    else:
                        handler.handle(event, data)
                except Exception as e:
                    logging.error(f"Hook handler error: {e}")
                    
    async def monitor_tool_execution(self, tool_func: Callable, *args, **kwargs):
        execution_id = generate_execution_id()
        
        # Pre-execution event
        pre_data = {
            'execution_id': execution_id,
            'tool_name': tool_func.__name__,
            'args': args,
            'kwargs': kwargs,
            'timestamp': time.time()
        }
        await self.emit_event(HookEvent.TOOL_PRE_EXECUTION, pre_data)
        
        try:
            result = await tool_func(*args, **kwargs)
            
            # Post-execution success event
            post_data = {
                'execution_id': execution_id,
                'result': result,
                'status': 'success',
                'timestamp': time.time()
            }
            await self.emit_event(HookEvent.TOOL_POST_EXECUTION, post_data)
            return result
            
        except Exception as e:
            # Error event
            error_data = {
                'execution_id': execution_id,
                'error': str(e),
                'error_type': type(e).__name__,
                'status': 'error',
                'timestamp': time.time()
            }
            await self.emit_event(HookEvent.TOOL_ERROR, error_data)
            raise
```

## Parameter Capture Strategies

### Safe Parameter Extraction

```python
import json
from typing import Any, Dict

def safe_parameter_capture(args: tuple, kwargs: dict) -> Dict[str, Any]:
    """Safely capture function parameters with sanitization"""
    
    def sanitize_value(value: Any) -> Any:
        # Remove sensitive data patterns
        if isinstance(value, str):
            # Mask potential secrets
            if any(keyword in value.lower() for keyword in ['password', 'token', 'key', 'secret']):
                return '[REDACTED]'
            # Truncate very long strings
            if len(value) > 1000:
                return value[:1000] + '[TRUNCATED]'
        elif isinstance(value, dict):
            return {k: sanitize_value(v) for k, v in value.items()}
        elif isinstance(value, (list, tuple)):
            return [sanitize_value(item) for item in value]
        
        return value
    
    try:
        # Capture positional arguments
        safe_args = [sanitize_value(arg) for arg in args]
        
        # Capture keyword arguments
        safe_kwargs = {k: sanitize_value(v) for k, v in kwargs.items()}
        
        return {
            'args': safe_args,
            'kwargs': safe_kwargs,
            'arg_count': len(args),
            'kwarg_count': len(kwargs)
        }
    except Exception as e:
        return {
            'capture_error': str(e),
            'arg_count': len(args),
            'kwarg_count': len(kwargs)
        }
```

### Context Logging

```python
import inspect
import os
from pathlib import Path

def capture_execution_context() -> Dict[str, Any]:
    """Capture comprehensive execution context"""
    
    frame = inspect.currentframe()
    if frame and frame.f_back:
        caller_frame = frame.f_back.f_back  # Skip the wrapper frame
        
        return {
            'file_path': caller_frame.f_code.co_filename,
            'function_name': caller_frame.f_code.co_name,
            'line_number': caller_frame.f_lineno,
            'working_directory': os.getcwd(),
            'environment_variables': {
                k: v for k, v in os.environ.items() 
                if not any(sensitive in k.lower() for sensitive in ['password', 'token', 'key', 'secret'])
            },
            'process_id': os.getpid(),
            'thread_id': threading.get_ident(),
            'stack_depth': len(inspect.stack())
        }
    
    return {}
```

## Hook Registration Patterns

### Pytest-Style Hook Registration

```python
class HookRegistry:
    def __init__(self):
        self.hooks = {}
        
    def register_hook(self, hook_name: str, priority: int = 0):
        def decorator(func):
            if hook_name not in self.hooks:
                self.hooks[hook_name] = []
            self.hooks[hook_name].append((priority, func))
            # Sort by priority (higher values execute first)
            self.hooks[hook_name].sort(key=lambda x: x[0], reverse=True)
            return func
        return decorator
        
    def execute_hooks(self, hook_name: str, *args, **kwargs):
        if hook_name in self.hooks:
            for priority, hook_func in self.hooks[hook_name]:
                try:
                    hook_func(*args, **kwargs)
                except Exception as e:
                    logging.error(f"Hook {hook_func.__name__} failed: {e}")

# Usage
hook_registry = HookRegistry()

@hook_registry.register_hook("pre_tool_execution", priority=10)
def log_tool_execution(context):
    logging.info(f"Executing tool: {context['tool_name']}")

@hook_registry.register_hook("pre_tool_execution", priority=5)
def validate_parameters(context):
    # Lower priority, runs after logging
    pass
```

## Performance Considerations

### Minimal Overhead Design

```python
import time
from typing import Optional

class LightweightHookManager:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.execution_times = []
        
    def time_execution(self, func_name: str, start_time: float, end_time: float):
        if not self.enabled:
            return
            
        duration = end_time - start_time
        
        # Only log if execution time is significant
        if duration > 0.001:  # > 1ms
            self.execution_times.append({
                'function': func_name,
                'duration': duration,
                'timestamp': end_time
            })
            
        # Prevent memory buildup
        if len(self.execution_times) > 1000:
            self.execution_times = self.execution_times[-500:]

def minimal_hook(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not hook_manager.enabled:
            return func(*args, **kwargs)
            
        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            hook_manager.time_execution(func.__name__, start, time.perf_counter())
            return result
        except Exception as e:
            hook_manager.time_execution(func.__name__, start, time.perf_counter())
            raise
    return wrapper
```

## Integration with Async Code

```python
import asyncio
from typing import Awaitable

def async_tool_hook(hook_manager):
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                execution_id = hook_manager.generate_execution_id()
                start_time = time.time()
                
                await hook_manager.capture_pre_execution_async({
                    'execution_id': execution_id,
                    'tool_name': func.__name__,
                    'args': args,
                    'kwargs': kwargs
                })
                
                try:
                    result = await func(*args, **kwargs)
                    await hook_manager.capture_post_execution_async({
                        'execution_id': execution_id,
                        'result': result,
                        'status': 'success',
                        'duration': time.time() - start_time
                    })
                    return result
                except Exception as e:
                    await hook_manager.capture_post_execution_async({
                        'execution_id': execution_id,
                        'error': str(e),
                        'status': 'error',
                        'duration': time.time() - start_time
                    })
                    raise
            return async_wrapper
        else:
            # Handle sync functions normally
            return tool_execution_hook(hook_manager)(func)
    return decorator
```

## Best Practices

1. **Keep hooks lightweight** - Minimize processing in hook callbacks
2. **Handle errors gracefully** - Never let hook failures break the main execution
3. **Use appropriate serialization** - JSON for simple data, pickle for complex objects
4. **Implement circuit breakers** - Disable hooks if they consistently fail
5. **Provide configuration options** - Allow users to enable/disable specific hooks
6. **Consider async compatibility** - Support both sync and async function monitoring
7. **Implement proper cleanup** - Prevent memory leaks from accumulated hook data
8. **Use structured logging** - Make hook output easily parseable and searchable

This guide provides the foundation for implementing robust tool execution hooks that can capture comprehensive data about tool usage while maintaining performance and reliability.