# Python Base Hook Patterns Guide

## Overview

This guide covers Python base class design patterns for building extensible hook systems, focusing on observability and monitoring architectures. These patterns enable consistent interfaces, shared functionality, and easy extension for new hook types.

## Core Design Patterns

### 1. Abstract Base Class (ABC) Pattern

The ABC pattern provides a formal contract that all hook implementations must follow:

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio
from datetime import datetime

class BaseHook(ABC):
    """Abstract base class for all Chronicle hooks."""
    
    def __init__(self, hook_name: str, config: Optional[Dict[str, Any]] = None):
        self.hook_name = hook_name
        self.config = config or {}
        self.execution_start = None
        self.execution_end = None
        
    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the hook with given context."""
        pass
    
    @abstractmethod
    def validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate input data before processing."""
        pass
    
    async def pre_execute(self, context: Dict[str, Any]) -> None:
        """Common pre-execution logic."""
        self.execution_start = datetime.utcnow()
        
    async def post_execute(self, result: Dict[str, Any]) -> None:
        """Common post-execution logic."""
        self.execution_end = datetime.utcnow()
```

### 2. Template Method Pattern

Provides a skeleton algorithm with customizable steps:

```python
class TemplateHook(BaseHook):
    """Template pattern implementation for hooks."""
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Template method defining the execution flow."""
        try:
            # Pre-execution setup
            await self.pre_execute(context)
            
            # Validate input
            if not self.validate_input(context):
                raise ValueError("Invalid input data")
            
            # Process data (customizable)
            processed_data = await self.process_data(context)
            
            # Transform result (customizable)
            result = await self.transform_result(processed_data)
            
            # Post-execution cleanup
            await self.post_execute(result)
            
            return result
            
        except Exception as e:
            await self.handle_error(e, context)
            raise
    
    @abstractmethod
    async def process_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Process the input data - must be implemented by subclasses."""
        pass
    
    async def transform_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform the processed data - can be overridden."""
        return data
    
    async def handle_error(self, error: Exception, context: Dict[str, Any]) -> None:
        """Handle errors - can be overridden."""
        print(f"Error in {self.hook_name}: {error}")
```

### 3. Strategy Pattern for Hook Types

Different strategies for different hook types:

```python
from enum import Enum
from typing import Protocol

class HookType(Enum):
    TOOL_PRE = "tool_pre"
    TOOL_POST = "tool_post"
    USER_PROMPT = "user_prompt"
    SESSION_START = "session_start"
    SESSION_STOP = "session_stop"
    NOTIFICATION = "notification"

class HookStrategy(Protocol):
    """Protocol for hook execution strategies."""
    
    async def execute_strategy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the specific strategy."""
        ...

class ConfigurableHook(BaseHook):
    """Hook that uses different strategies based on type."""
    
    def __init__(self, hook_name: str, hook_type: HookType, strategy: HookStrategy):
        super().__init__(hook_name)
        self.hook_type = hook_type
        self.strategy = strategy
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute using the configured strategy."""
        await self.pre_execute(context)
        result = await self.strategy.execute_strategy(context)
        await self.post_execute(result)
        return result
    
    def validate_input(self, data: Dict[str, Any]) -> bool:
        """Basic validation - can be extended."""
        return isinstance(data, dict) and 'timestamp' in data
```

### 4. Mixin Pattern for Shared Functionality

Mixins provide reusable functionality:

```python
class DatabaseMixin:
    """Mixin for database operations."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.db_client = None
    
    async def ensure_db_connection(self):
        """Ensure database connection is available."""
        if not self.db_client:
            from .database import get_database_client
            self.db_client = await get_database_client()
    
    async def save_to_database(self, data: Dict[str, Any]) -> bool:
        """Save data to database with error handling."""
        try:
            await self.ensure_db_connection()
            await self.db_client.insert(data)
            return True
        except Exception as e:
            print(f"Database save failed: {e}")
            return False

class LoggingMixin:
    """Mixin for structured logging."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.logger = self._setup_logger()
    
    def _setup_logger(self):
        import logging
        logger = logging.getLogger(f"chronicle.{self.hook_name}")
        return logger
    
    def log_execution(self, level: str, message: str, **kwargs):
        """Log with structured context."""
        extra = {
            'hook_name': self.hook_name,
            'execution_id': getattr(self, 'execution_id', None),
            **kwargs
        }
        getattr(self.logger, level)(message, extra=extra)

class MetricsMixin:
    """Mixin for metrics collection."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.metrics = {}
    
    def record_metric(self, name: str, value: Any, tags: Dict[str, str] = None):
        """Record a metric with optional tags."""
        self.metrics[name] = {
            'value': value,
            'timestamp': datetime.utcnow(),
            'tags': tags or {}
        }
    
    def get_execution_time(self) -> Optional[float]:
        """Calculate execution time if available."""
        if self.execution_start and self.execution_end:
            return (self.execution_end - self.execution_start).total_seconds()
        return None
```

### 5. Complete Hook Implementation Example

Combining all patterns:

```python
class ToolExecutionHook(DatabaseMixin, LoggingMixin, MetricsMixin, TemplateHook):
    """Complete hook implementation for tool execution monitoring."""
    
    def __init__(self, hook_name: str, tool_type: str):
        super().__init__(hook_name)
        self.tool_type = tool_type
    
    def validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate tool execution data."""
        required_fields = ['tool_name', 'parameters', 'timestamp']
        return all(field in data for field in required_fields)
    
    async def process_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Process tool execution data."""
        processed = {
            'hook_type': self.tool_type,
            'tool_name': context['tool_name'],
            'parameters': self._sanitize_parameters(context['parameters']),
            'timestamp': context['timestamp'],
            'session_id': context.get('session_id'),
            'execution_time': None
        }
        
        # Record metrics
        self.record_metric('tool_execution', 1, {
            'tool_name': processed['tool_name'],
            'hook_type': self.tool_type
        })
        
        return processed
    
    async def transform_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add execution metrics to result."""
        execution_time = self.get_execution_time()
        if execution_time:
            data['execution_time'] = execution_time
            self.record_metric('execution_duration', execution_time)
        
        return data
    
    async def post_execute(self, result: Dict[str, Any]) -> None:
        """Save to database and log."""
        await super().post_execute(result)
        
        # Save to database
        saved = await self.save_to_database(result)
        
        # Log execution
        self.log_execution('info', 'Hook executed successfully', 
                          tool_name=result.get('tool_name'),
                          saved_to_db=saved)
    
    def _sanitize_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive data from parameters."""
        sensitive_keys = ['password', 'token', 'key', 'secret']
        sanitized = {}
        
        for key, value in params.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                sanitized[key] = '[REDACTED]'
            else:
                sanitized[key] = value
        
        return sanitized
```

## Factory Pattern for Hook Creation

```python
class HookFactory:
    """Factory for creating hook instances."""
    
    _hook_registry = {}
    
    @classmethod
    def register_hook(cls, hook_type: str, hook_class: type):
        """Register a hook class for a specific type."""
        cls._hook_registry[hook_type] = hook_class
    
    @classmethod
    def create_hook(cls, hook_type: str, **kwargs) -> BaseHook:
        """Create a hook instance of the specified type."""
        if hook_type not in cls._hook_registry:
            raise ValueError(f"Unknown hook type: {hook_type}")
        
        hook_class = cls._hook_registry[hook_type]
        return hook_class(**kwargs)
    
    @classmethod
    def list_available_hooks(cls) -> list:
        """List all registered hook types."""
        return list(cls._hook_registry.keys())

# Registration
HookFactory.register_hook('tool_pre', ToolExecutionHook)
HookFactory.register_hook('tool_post', ToolExecutionHook)

# Usage
pre_hook = HookFactory.create_hook('tool_pre', 
                                  hook_name='pre_tool_use',
                                  tool_type='pre')
```

## Configuration and Context Management

```python
class HookContext:
    """Context manager for hook execution."""
    
    def __init__(self, session_id: str, user_id: str, environment: str):
        self.session_id = session_id
        self.user_id = user_id
        self.environment = environment
        self.start_time = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary."""
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'environment': self.environment,
            'start_time': self.start_time.isoformat()
        }

class HookConfigManager:
    """Manages hook configuration and context."""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.context = None
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file or defaults."""
        if config_path:
            with open(config_path) as f:
                import json
                return json.load(f)
        
        # Default configuration
        return {
            'database': {
                'primary': 'supabase',
                'fallback': 'sqlite'
            },
            'hooks': {
                'enabled': True,
                'timeout': 30,
                'retry_attempts': 3
            },
            'logging': {
                'level': 'INFO',
                'format': 'json'
            }
        }
    
    def create_context(self, session_id: str, user_id: str) -> HookContext:
        """Create execution context."""
        self.context = HookContext(
            session_id=session_id,
            user_id=user_id,
            environment=self.config.get('environment', 'production')
        )
        return self.context
```

## Performance Considerations

### Async/Await Pattern
- All hook operations use async/await for non-blocking execution
- Database operations are asynchronous to prevent blocking
- Context managers ensure proper resource cleanup

### Memory Management
- Use `__slots__` for frequently instantiated classes
- Implement proper cleanup in `__del__` methods
- Use weak references for observer patterns

### Error Isolation
- Each hook execution is isolated
- Failures in one hook don't affect others
- Graceful degradation when services are unavailable

## Best Practices

1. **Single Responsibility**: Each hook class has one clear purpose
2. **Open/Closed Principle**: Easy to extend, hard to modify
3. **Dependency Injection**: Pass dependencies rather than creating them
4. **Interface Segregation**: Small, focused interfaces
5. **Composition over Inheritance**: Use mixins and composition
6. **Fail Fast**: Validate early and fail with clear messages
7. **Logging and Monitoring**: Comprehensive observability built-in

This architecture provides a solid foundation for the Chronicle hook system, enabling consistent behavior across all hook types while maintaining flexibility for specific implementations.