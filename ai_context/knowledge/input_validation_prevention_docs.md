# Input Validation & Injection Prevention Guide

## Overview
This guide provides comprehensive input validation strategies and injection attack prevention techniques for Chronicle's observability system. Proper input validation is critical when handling user data, tool parameters, file paths, and database operations.

## Common Attack Vectors

### 1. SQL Injection
SQL injection attacks occur when user input is improperly sanitized before being used in SQL queries.

#### Example Vulnerable Code
```python
# VULNERABLE - Never do this
def get_session_data(session_id):
    query = f"SELECT * FROM sessions WHERE id = '{session_id}'"
    return execute_query(query)
```

#### Secure Implementation
```python
import sqlite3
from typing import Optional, Dict, Any

class SecureDatabase:
    def __init__(self, db_path: str):
        self.connection = sqlite3.connect(db_path)
        self.connection.row_factory = sqlite3.Row
    
    def get_session_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Secure parameterized query"""
        cursor = self.connection.cursor()
        cursor.execute(
            "SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL",
            (session_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def insert_event(self, event_data: Dict[str, Any]) -> bool:
        """Secure batch insert with validation"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO events (session_id, event_type, timestamp, data)
                VALUES (?, ?, ?, ?)
            """, (
                event_data['session_id'],
                event_data['event_type'],
                event_data['timestamp'],
                json.dumps(event_data['data'])
            ))
            self.connection.commit()
            return True
        except sqlite3.Error as e:
            logging.error(f"Database error: {e}")
            self.connection.rollback()
            return False
```

### 2. Path Traversal Attacks
Directory traversal attacks attempt to access files outside intended directories.

#### Secure Path Validation
```python
import os
from pathlib import Path
from typing import Optional

class SecurePathValidator:
    def __init__(self, allowed_base_paths: list[str]):
        self.allowed_base_paths = [Path(p).resolve() for p in allowed_base_paths]
    
    def validate_file_path(self, file_path: str) -> Optional[Path]:
        """Validate and resolve file path securely"""
        try:
            # Resolve the path to handle any .. or . components
            resolved_path = Path(file_path).resolve()
            
            # Check if path is within allowed base paths
            for base_path in self.allowed_base_paths:
                try:
                    resolved_path.relative_to(base_path)
                    return resolved_path
                except ValueError:
                    continue
            
            # Path not within any allowed base path
            raise ValueError(f"Path {file_path} is outside allowed directories")
            
        except (OSError, ValueError) as e:
            logging.warning(f"Invalid file path {file_path}: {e}")
            return None
    
    def safe_read_file(self, file_path: str, max_size: int = 1024 * 1024) -> Optional[str]:
        """Safely read file with path validation and size limits"""
        validated_path = self.validate_file_path(file_path)
        if not validated_path or not validated_path.is_file():
            return None
        
        try:
            # Check file size before reading
            if validated_path.stat().st_size > max_size:
                logging.warning(f"File {file_path} exceeds size limit")
                return None
            
            return validated_path.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError) as e:
            logging.error(f"Error reading file {file_path}: {e}")
            return None
```

### 3. Command Injection
Command injection occurs when user input is used to construct system commands.

#### Secure Command Execution
```python
import subprocess
import shlex
from typing import List, Optional, Tuple

class SecureCommandExecutor:
    def __init__(self, allowed_commands: List[str]):
        self.allowed_commands = set(allowed_commands)
    
    def execute_command(self, command: str, args: List[str], 
                       timeout: int = 30) -> Tuple[bool, str, str]:
        """Execute command securely with whitelist validation"""
        
        # Validate command is in allowlist
        if command not in self.allowed_commands:
            return False, "", f"Command '{command}' not allowed"
        
        # Validate and sanitize arguments
        sanitized_args = []
        for arg in args:
            if not self._validate_argument(arg):
                return False, "", f"Invalid argument: {arg}"
            sanitized_args.append(shlex.quote(arg))
        
        try:
            # Use subprocess with explicit argument list (no shell=True)
            result = subprocess.run(
                [command] + sanitized_args,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False
            )
            
            return True, result.stdout, result.stderr
            
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except subprocess.SubprocessError as e:
            return False, "", f"Command execution error: {e}"
    
    def _validate_argument(self, arg: str) -> bool:
        """Validate command argument"""
        # Reject arguments with dangerous characters
        dangerous_chars = ['`', '$', '&', '|', ';', '>', '<', '(', ')']
        if any(char in arg for char in dangerous_chars):
            return False
        
        # Additional validation based on argument content
        if len(arg) > 1000:  # Reasonable length limit
            return False
        
        return True
```

## Input Validation Framework

### Pydantic-Based Validation
```python
from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import re

class SessionEventModel(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    event_type: str = Field(..., regex=r'^[a-zA-Z_][a-zA-Z0-9_]*$')
    timestamp: datetime
    user_id: Optional[str] = Field(None, max_length=100)
    data: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('session_id')
    def validate_session_id(cls, v):
        # UUID format validation
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        if not uuid_pattern.match(v):
            raise ValueError('Invalid session ID format')
        return v
    
    @validator('data')
    def validate_data_size(cls, v):
        # Limit serialized data size
        import json
        serialized = json.dumps(v, default=str)
        if len(serialized) > 100000:  # 100KB limit
            raise ValueError('Event data too large')
        return v

class ToolExecutionModel(BaseModel):
    tool_name: str = Field(..., regex=r'^[a-zA-Z_][a-zA-Z0-9_]*$')
    parameters: Dict[str, Any] = Field(default_factory=dict)
    file_path: Optional[str] = Field(None, max_length=2000)
    
    @validator('tool_name')
    def validate_tool_name(cls, v):
        # Whitelist of allowed tool names
        allowed_tools = {
            'read', 'write', 'edit', 'bash', 'grep', 'glob',
            'ls', 'multiedit', 'webfetch', 'websearch'
        }
        if v not in allowed_tools:
            raise ValueError(f'Tool {v} not allowed')
        return v
    
    @validator('file_path')
    def validate_file_path(cls, v):
        if v is None:
            return v
        
        # Basic path traversal prevention
        if '..' in v or v.startswith('/'):
            if not v.startswith('/Users') and not v.startswith('/tmp'):
                raise ValueError('Invalid file path')
        
        return v

class ChronicleInputValidator:
    def __init__(self):
        self.path_validator = SecurePathValidator(['/Users', '/tmp', '/var'])
    
    def validate_session_event(self, data: Dict[str, Any]) -> SessionEventModel:
        """Validate session event data"""
        try:
            return SessionEventModel(**data)
        except Exception as e:
            logging.error(f"Session event validation failed: {e}")
            raise ValueError(f"Invalid session event data: {e}")
    
    def validate_tool_execution(self, data: Dict[str, Any]) -> ToolExecutionModel:
        """Validate tool execution data"""
        try:
            model = ToolExecutionModel(**data)
            
            # Additional file path validation
            if model.file_path:
                validated_path = self.path_validator.validate_file_path(model.file_path)
                if not validated_path:
                    raise ValueError(f"Invalid file path: {model.file_path}")
                model.file_path = str(validated_path)
            
            return model
        except Exception as e:
            logging.error(f"Tool execution validation failed: {e}")
            raise ValueError(f"Invalid tool execution data: {e}")
```

### Advanced Input Sanitization
```python
import html
import re
from typing import Any, Dict, List, Union

class InputSanitizer:
    def __init__(self):
        # HTML entity patterns
        self.html_entities = re.compile(r'&[a-zA-Z0-9#]+;')
        
        # Script injection patterns
        self.script_patterns = [
            re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
            re.compile(r'javascript:', re.IGNORECASE),
            re.compile(r'vbscript:', re.IGNORECASE),
            re.compile(r'on\w+\s*=', re.IGNORECASE),
        ]
        
        # SQL injection patterns
        self.sql_patterns = [
            re.compile(r'\b(union|select|insert|update|delete|drop|exec|execute)\b', re.IGNORECASE),
            re.compile(r'[\'";]'),
            re.compile(r'--'),
            re.compile(r'/\*.*?\*/', re.DOTALL),
        ]
    
    def sanitize_string(self, value: str, allow_html: bool = False) -> str:
        """Sanitize string input"""
        if not isinstance(value, str):
            return str(value)
        
        # Normalize unicode
        value = value.encode('utf-8', errors='ignore').decode('utf-8')
        
        # HTML escape if HTML not allowed
        if not allow_html:
            value = html.escape(value, quote=True)
        
        # Remove script injections
        for pattern in self.script_patterns:
            value = pattern.sub('', value)
        
        # Limit length
        if len(value) > 10000:
            value = value[:10000] + '[TRUNCATED]'
        
        return value.strip()
    
    def sanitize_dict(self, data: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
        """Recursively sanitize dictionary"""
        if max_depth <= 0:
            return {}
        
        sanitized = {}
        for key, value in data.items():
            # Sanitize key
            clean_key = self.sanitize_string(str(key))
            
            # Sanitize value based on type
            if isinstance(value, str):
                sanitized[clean_key] = self.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[clean_key] = self.sanitize_dict(value, max_depth - 1)
            elif isinstance(value, list):
                sanitized[clean_key] = self.sanitize_list(value, max_depth - 1)
            elif isinstance(value, (int, float, bool)):
                sanitized[clean_key] = value
            else:
                sanitized[clean_key] = self.sanitize_string(str(value))
        
        return sanitized
    
    def sanitize_list(self, data: List[Any], max_depth: int = 10) -> List[Any]:
        """Recursively sanitize list"""
        if max_depth <= 0:
            return []
        
        sanitized = []
        for item in data[:1000]:  # Limit list size
            if isinstance(item, str):
                sanitized.append(self.sanitize_string(item))
            elif isinstance(item, dict):
                sanitized.append(self.sanitize_dict(item, max_depth - 1))
            elif isinstance(item, list):
                sanitized.append(self.sanitize_list(item, max_depth - 1))
            elif isinstance(item, (int, float, bool)):
                sanitized.append(item)
            else:
                sanitized.append(self.sanitize_string(str(item)))
        
        return sanitized
```

## Rate Limiting and DoS Prevention

### Request Rate Limiting
```python
import time
from collections import defaultdict, deque
from typing import Dict, Optional

class RateLimiter:
    def __init__(self, max_requests: int = 100, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if request is within rate limits"""
        now = time.time()
        client_requests = self.requests[client_id]
        
        # Remove old requests outside time window
        while client_requests and client_requests[0] < now - self.time_window:
            client_requests.popleft()
        
        # Check if under limit
        if len(client_requests) >= self.max_requests:
            return False
        
        # Add current request
        client_requests.append(now)
        return True
    
    def get_remaining_requests(self, client_id: str) -> int:
        """Get remaining requests for client"""
        now = time.time()
        client_requests = self.requests[client_id]
        
        # Clean old requests
        while client_requests and client_requests[0] < now - self.time_window:
            client_requests.popleft()
        
        return max(0, self.max_requests - len(client_requests))

class ResourceLimiter:
    def __init__(self, max_memory_mb: int = 100, max_file_size_mb: int = 10):
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.max_file_size_bytes = max_file_size_mb * 1024 * 1024
    
    def check_memory_usage(self) -> bool:
        """Check if memory usage is within limits"""
        import psutil
        process = psutil.Process()
        memory_usage = process.memory_info().rss
        return memory_usage < self.max_memory_bytes
    
    def validate_file_size(self, file_path: str) -> bool:
        """Validate file size is within limits"""
        try:
            size = os.path.getsize(file_path)
            return size < self.max_file_size_bytes
        except OSError:
            return False
```

## Security Headers and Configuration

### Security Configuration
```python
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class SecurityConfig:
    # Input validation settings
    max_input_length: int = 10000
    max_nesting_depth: int = 10
    allowed_file_extensions: List[str] = None
    blocked_file_patterns: List[str] = None
    
    # Rate limiting settings
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    # Path validation settings
    allowed_base_paths: List[str] = None
    
    # Command execution settings
    allowed_commands: List[str] = None
    command_timeout: int = 30
    
    # Security features
    enable_xss_protection: bool = True
    enable_sql_injection_protection: bool = True
    enable_path_traversal_protection: bool = True
    enable_command_injection_protection: bool = True
    
    def __post_init__(self):
        if self.allowed_file_extensions is None:
            self.allowed_file_extensions = ['.txt', '.md', '.py', '.js', '.json', '.yaml']
        
        if self.blocked_file_patterns is None:
            self.blocked_file_patterns = ['*.exe', '*.bat', '*.sh', '*.ps1']
        
        if self.allowed_base_paths is None:
            self.allowed_base_paths = ['/Users', '/tmp']
        
        if self.allowed_commands is None:
            self.allowed_commands = ['git', 'ls', 'cat', 'grep', 'find']

class SecurityMiddleware:
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.rate_limiter = RateLimiter(
            config.rate_limit_requests,
            config.rate_limit_window
        )
        self.input_sanitizer = InputSanitizer()
        self.path_validator = SecurePathValidator(config.allowed_base_paths)
    
    def validate_request(self, client_id: str, data: Dict[str, Any]) -> bool:
        """Comprehensive request validation"""
        
        # Rate limiting check
        if not self.rate_limiter.is_allowed(client_id):
            raise ValueError("Rate limit exceeded")
        
        # Input validation and sanitization
        try:
            sanitized_data = self.input_sanitizer.sanitize_dict(data)
        except Exception as e:
            raise ValueError(f"Input sanitization failed: {e}")
        
        # File path validation if present
        if 'file_path' in data:
            if not self.path_validator.validate_file_path(data['file_path']):
                raise ValueError("Invalid file path")
        
        return True
```

## Testing Input Validation

### Comprehensive Security Tests
```python
import unittest
import pytest

class TestInputValidation(unittest.TestCase):
    def setUp(self):
        self.sanitizer = InputSanitizer()
        self.validator = ChronicleInputValidator()
    
    def test_sql_injection_prevention(self):
        """Test SQL injection attack prevention"""
        malicious_inputs = [
            "'; DROP TABLE sessions; --",
            "1' OR '1'='1",
            "admin'/*",
            "1; DELETE FROM users; --"
        ]
        
        for malicious_input in malicious_inputs:
            sanitized = self.sanitizer.sanitize_string(malicious_input)
            self.assertNotIn("'", sanitized)
            self.assertNotIn(";", sanitized)
            self.assertNotIn("--", sanitized)
    
    def test_xss_prevention(self):
        """Test XSS attack prevention"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "<body onload=alert('xss')>"
        ]
        
        for payload in xss_payloads:
            sanitized = self.sanitizer.sanitize_string(payload)
            self.assertNotIn("<script", sanitized.lower())
            self.assertNotIn("javascript:", sanitized.lower())
            self.assertNotIn("onerror=", sanitized.lower())
    
    def test_path_traversal_prevention(self):
        """Test path traversal attack prevention"""
        malicious_paths = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32\\config\\sam",
            "/etc/shadow",
            "file:///etc/passwd"
        ]
        
        path_validator = SecurePathValidator(['/safe/directory'])
        for malicious_path in malicious_paths:
            result = path_validator.validate_file_path(malicious_path)
            self.assertIsNone(result)
    
    def test_command_injection_prevention(self):
        """Test command injection prevention"""
        executor = SecureCommandExecutor(['echo', 'ls'])
        
        malicious_args = [
            "; rm -rf /",
            "| cat /etc/passwd",
            "$(whoami)",
            "`id`"
        ]
        
        for arg in malicious_args:
            success, stdout, stderr = executor.execute_command('echo', [arg])
            # Command should fail validation
            self.assertFalse(success)
```

## Best Practices Summary

### 1. Input Validation Principles
- **Validate all inputs** at application boundaries
- **Use allowlists** instead of blocklists when possible
- **Sanitize and escape** all user-provided data
- **Limit input size** and complexity
- **Use parameterized queries** for database operations

### 2. Error Handling
- **Don't expose system details** in error messages
- **Log security violations** for monitoring
- **Fail securely** - default to deny access
- **Rate limit** to prevent abuse

### 3. Defense in Depth
- **Multiple validation layers** (client, server, database)
- **Input sanitization** combined with output encoding
- **Principle of least privilege** for file access
- **Regular security testing** and updates

### 4. Monitoring and Alerting
- **Log all validation failures** for analysis
- **Monitor for attack patterns** in logs
- **Set up alerts** for repeated violations
- **Regular security assessments** and penetration testing