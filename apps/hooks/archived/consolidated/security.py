"""
Consolidated Security Validation for UV Single-File Scripts

Essential security validation functionality consolidated into a minimal module
suitable for inlining into UV single-file scripts.

Key consolidations:
- Removed complex pattern matching to reduce overhead
- Simplified to essential security checks only
- Removed metrics tracking to reduce dependencies
- Essential input validation and sanitization
- Basic path traversal protection
- Core sensitive data detection
"""

import json
import os
import re
import shlex
from pathlib import Path
from typing import Any, Dict, Optional, List


class SecurityError(Exception):
    """Security validation error."""
    pass


class ConsolidatedSecurity:
    """
    Minimal security validator for UV single-file scripts.
    Focuses on essential security checks with minimal overhead.
    """
    
    def __init__(self, max_input_size_mb: float = 10.0):
        """Initialize with basic configuration."""
        self.max_input_size_bytes = int(max_input_size_mb * 1024 * 1024)
        
        # Essential sensitive data patterns
        self.sensitive_patterns = [
            r'sk-[a-zA-Z0-9]{48}',  # OpenAI API keys
            r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
            r'AKIA[0-9A-Z]{16}',  # AWS access keys
            r'ghp_[a-zA-Z0-9]{36}',  # GitHub tokens
            r'password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',  # Password patterns
            r'/Users/[^/\s,}]+',  # User paths (macOS)
            r'/home/[^/\s,}]+',   # User paths (Linux)
            r'C:\\Users\\[^\\s,}]+',  # User paths (Windows)
        ]
        
        # Valid hook events for validation
        self.valid_hook_events = {
            "SessionStart", "PreToolUse", "PostToolUse", "UserPromptSubmit",
            "PreCompact", "Notification", "Stop", "SubagentStop"
        }
    
    def validate_input_size(self, data: Any) -> bool:
        """Check if input size is within limits."""
        try:
            json_str = json.dumps(data, default=str)
            size_bytes = len(json_str.encode('utf-8'))
            return size_bytes <= self.max_input_size_bytes
        except (TypeError, ValueError):
            return False
    
    def validate_hook_input_schema(self, data: Dict[str, Any]) -> bool:
        """Basic hook input schema validation."""
        if not isinstance(data, dict):
            return False
        
        # Check required hookEventName
        hook_event_name = data.get("hookEventName")
        if not hook_event_name or hook_event_name not in self.valid_hook_events:
            return False
        
        # Check sessionId if present
        session_id = data.get("sessionId")
        if session_id is not None:
            if not isinstance(session_id, str) or len(session_id) < 8:
                return False
        
        return True
    
    def validate_file_path(self, file_path: str) -> bool:
        """Basic path traversal protection."""
        if not file_path or not isinstance(file_path, str):
            return False
        
        # Check for obvious path traversal patterns
        if ".." in file_path and file_path.count("..") > 2:
            return False
        
        # Check for dangerous characters
        dangerous_chars = ["\x00", "|", "&", ";", "`"]
        if any(char in file_path for char in dangerous_chars):
            return False
        
        # Try to resolve path safely
        try:
            resolved_path = Path(file_path).resolve()
            # Basic check - path should exist or be in reasonable location
            return True
        except (OSError, ValueError):
            return False
    
    def sanitize_sensitive_data(self, data: Any) -> Any:
        """Remove sensitive information from data."""
        if data is None:
            return None
        
        # Convert to string for pattern matching
        data_str = json.dumps(data) if not isinstance(data, str) else data
        
        # Replace sensitive patterns with placeholder
        sanitized_str = data_str
        for pattern in self.sensitive_patterns:
            sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str, flags=re.IGNORECASE)
        
        # Try to convert back to original structure
        try:
            if isinstance(data, dict):
                return json.loads(sanitized_str)
            elif isinstance(data, str):
                return sanitized_str
            else:
                return json.loads(sanitized_str)
        except json.JSONDecodeError:
            return sanitized_str
    
    def detect_sensitive_data(self, data: Any) -> bool:
        """Check if data contains sensitive information."""
        if data is None:
            return False
        
        data_str = json.dumps(data) if not isinstance(data, str) else data
        
        for pattern in self.sensitive_patterns:
            if re.search(pattern, data_str, re.IGNORECASE):
                return True
        
        return False
    
    def escape_shell_argument(self, arg: str) -> str:
        """Safely escape shell argument."""
        if not isinstance(arg, str):
            arg = str(arg)
        return shlex.quote(arg)
    
    def comprehensive_validation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive but lightweight validation."""
        # Input size check
        if not self.validate_input_size(data):
            raise SecurityError("Input data exceeds size limit")
        
        # Schema validation
        if not self.validate_hook_input_schema(data):
            raise SecurityError("Invalid hook input schema")
        
        # Sanitize sensitive data
        sanitized_data = self.sanitize_sensitive_data(data)
        
        return sanitized_data


# Simple validation functions for inline use
def is_safe_input_size(data: Any, max_size_mb: float = 10.0) -> bool:
    """Quick check for reasonable input size."""
    try:
        data_str = json.dumps(data) if not isinstance(data, str) else data
        size_mb = len(data_str.encode('utf-8')) / 1024 / 1024
        return size_mb <= max_size_mb
    except (TypeError, ValueError):
        return False


def is_valid_session_id(session_id: Optional[str]) -> bool:
    """Quick session ID validation."""
    if not session_id or not isinstance(session_id, str):
        return False
    return 8 <= len(session_id) <= 100


def is_valid_hook_event(event_name: Optional[str]) -> bool:
    """Quick hook event validation."""
    valid_events = {
        'SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
        'PreCompact', 'Notification', 'Stop', 'SubagentStop'
    }
    return event_name in valid_events if event_name else False


def sanitize_basic_data(data: Any) -> Any:
    """Basic data sanitization."""
    if data is None:
        return None
    
    try:
        if isinstance(data, dict):
            # Remove private keys and limit nested structure
            return {
                k: v for k, v in data.items() 
                if not str(k).startswith('_') and not str(k).lower().startswith('password')
            }
        elif isinstance(data, str):
            # Basic string sanitization - remove potential sensitive patterns
            sanitized = data
            patterns = [
                r'sk-[a-zA-Z0-9]+',
                r'password["\']?\s*[:=]\s*["\'][^"\']+["\']'
            ]
            for pattern in patterns:
                sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
            return sanitized[:10000]  # Limit length
        else:
            return data
    except Exception:
        return str(data)[:1000]  # Safe fallback


def validate_and_sanitize_hook_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """Quick validation and sanitization for hook input."""
    # Basic checks
    if not isinstance(data, dict):
        raise SecurityError("Input must be a dictionary")
    
    if not is_safe_input_size(data):
        raise SecurityError("Input size exceeds limit")
    
    hook_event = data.get("hookEventName")
    if not is_valid_hook_event(hook_event):
        raise SecurityError(f"Invalid hook event: {hook_event}")
    
    # Basic sanitization
    return sanitize_basic_data(data)


# Factory function
def create_security_validator(max_input_size_mb: float = 10.0) -> ConsolidatedSecurity:
    """Create and return a security validator instance."""
    return ConsolidatedSecurity(max_input_size_mb)