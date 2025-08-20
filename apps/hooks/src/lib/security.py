"""Security validation and input sanitization for Chronicle hooks."""

import json
import logging
import os
import re
import shlex
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from collections import defaultdict

# Configure logger
logger = logging.getLogger(__name__)

# Custom security exceptions
class SecurityError(Exception):
    """Base class for security-related errors."""
    pass

class PathTraversalError(SecurityError):
    """Raised when path traversal attack is detected."""
    pass

class InputSizeError(SecurityError):
    """Raised when input exceeds size limits."""
    pass

class CommandInjectionError(SecurityError):
    """Raised when command injection is detected."""
    pass

class SensitiveDataError(SecurityError):
    """Raised when sensitive data is detected in inappropriate context."""
    pass


class SecurityMetrics:
    """Track security-related metrics and violations."""
    
    def __init__(self):
        self.path_traversal_attempts = 0
        self.oversized_input_attempts = 0
        self.command_injection_attempts = 0
        self.sensitive_data_detections = 0
        self.blocked_operations = 0
        self.total_validations = 0
        self.validation_times = []
    
    def record_path_traversal_attempt(self, path: str):
        """Record a path traversal attempt."""
        self.path_traversal_attempts += 1
        logger.warning(f"Path traversal attempt detected: {path}")
    
    def record_oversized_input(self, size_mb: float):
        """Record an oversized input attempt."""
        self.oversized_input_attempts += 1
        logger.warning(f"Oversized input detected: {size_mb:.2f}MB")
    
    def record_command_injection_attempt(self, command: str):
        """Record a command injection attempt."""
        self.command_injection_attempts += 1
        logger.warning(f"Command injection attempt detected: {command}")
    
    def record_sensitive_data_detection(self, data_type: str):
        """Record sensitive data detection."""
        self.sensitive_data_detections += 1
        logger.info(f"Sensitive data detected and sanitized: {data_type}")
    
    def record_validation_time(self, duration_ms: float):
        """Record validation execution time."""
        self.validation_times.append(duration_ms)
        if len(self.validation_times) > 1000:  # Keep only last 1000 measurements
            self.validation_times = self.validation_times[-1000:]
    
    def get_average_validation_time(self) -> float:
        """Get average validation time in milliseconds."""
        if not self.validation_times:
            return 0.0
        return sum(self.validation_times) / len(self.validation_times)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of security metrics."""
        return {
            "path_traversal_attempts": self.path_traversal_attempts,
            "oversized_input_attempts": self.oversized_input_attempts,
            "command_injection_attempts": self.command_injection_attempts,
            "sensitive_data_detections": self.sensitive_data_detections,
            "blocked_operations": self.blocked_operations,
            "total_validations": self.total_validations,
            "average_validation_time_ms": self.get_average_validation_time()
        }


class EnhancedSensitiveDataDetector:
    """Enhanced sensitive data detection with comprehensive patterns."""
    
    def __init__(self):
        self.patterns = {
            "api_keys": [
                # OpenAI API keys
                r'sk-[a-zA-Z0-9]{48}',
                r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
                # AWS keys
                r'AKIA[0-9A-Z]{16}',
                r'[A-Za-z0-9+/]{40}',  # AWS secret access key
                # GitHub tokens
                r'ghp_[a-zA-Z0-9]{36}',
                r'github_pat_[a-zA-Z0-9_]{82}',
                # GitLab tokens  
                r'glpat-[a-zA-Z0-9_-]{20}',
                # Slack tokens
                r'xoxb-[0-9]{11,12}-[0-9]{11,12}-[a-zA-Z0-9]{24}',
                # JWT tokens
                r'eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*',
                # Generic API key patterns
                r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',
                r'access[_-]?token["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{16,}',
                # Stripe keys
                r'sk_(live|test)_[a-zA-Z0-9]{24}',
                r'pk_(live|test)_[a-zA-Z0-9]{24}',
            ],
            "passwords": [
                r'password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
                r'pass["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
                r'secret["\']?\s*[:=]\s*["\'][^"\']{8,}["\']',
                r'supabase[_-]?key["\']?\s*[:=]\s*["\'][^"\']{16,}["\']',
                r'database[_-]?password["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
                r'db[_-]?pass["\']?\s*[:=]\s*["\'][^"\']{6,}["\']',
            ],
            "credentials": [
                # SSH private keys
                r'-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----',
                # PGP private keys
                r'-----BEGIN PGP PRIVATE KEY BLOCK-----',
                # Certificates
                r'-----BEGIN CERTIFICATE-----',
                # Connection strings
                r'(postgres|mysql|mongodb)://[^:]+:[^@]+@[^/]+/[^?\s]+',
            ],
            "pii": [
                # Email addresses
                r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                # Phone numbers
                r'\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
                # SSN
                r'\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b',
                # Credit card numbers
                r'\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b',
            ],
            "user_paths": [
                r'/Users/[^/\s,}]+',  # macOS user paths
                r'/home/[^/\s,}]+',   # Linux user paths
                r'C:\\Users\\[^\\s,}]+',  # Windows user paths
                r'/root/[^/\s,}]*',   # Root paths
            ]
        }
        
        # Compile patterns for performance
        self.compiled_patterns = {}
        for category, pattern_list in self.patterns.items():
            self.compiled_patterns[category] = [
                re.compile(pattern, re.IGNORECASE) for pattern in pattern_list
            ]
    
    def detect_sensitive_data(self, data: Any) -> Dict[str, List[str]]:
        """Detect sensitive data in input and return findings by category."""
        findings = defaultdict(list)
        data_str = json.dumps(data, default=str) if not isinstance(data, str) else data
        
        for category, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                matches = pattern.findall(data_str)
                if matches:
                    findings[category].extend(matches)
        
        return dict(findings)
    
    def is_sensitive_data(self, data: Any) -> bool:
        """Check if data contains any sensitive information."""
        findings = self.detect_sensitive_data(data)
        return bool(findings)
    
    def sanitize_sensitive_data(self, data: Any, mask: str = "[REDACTED]") -> Any:
        """Sanitize sensitive data by replacing with mask."""
        if data is None:
            return None
        
        data_str = json.dumps(data, default=str) if not isinstance(data, str) else data
        sanitized_str = data_str
        
        # Replace sensitive patterns
        for category, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                sanitized_str = pattern.sub(mask, sanitized_str)
        
        # Special handling for user paths - replace with generic path
        for pattern in self.compiled_patterns["user_paths"]:
            sanitized_str = pattern.sub('/Users/[USER]', sanitized_str)
        
        # Try to convert back to original structure
        try:
            if isinstance(data, dict):
                return json.loads(sanitized_str)
            elif isinstance(data, str):
                return sanitized_str
            else:
                return json.loads(sanitized_str)
        except json.JSONDecodeError:
            # If we can't parse it back, return the sanitized string
            return sanitized_str


class PathValidator:
    """Secure path validation to prevent path traversal attacks."""
    
    def __init__(self, allowed_base_paths: List[str]):
        self.allowed_base_paths = [Path(p).resolve() for p in allowed_base_paths]
        self.metrics = SecurityMetrics()
    
    def validate_file_path(self, file_path: str) -> Optional[Path]:
        """
        Validate and resolve file path securely.
        
        Args:
            file_path: Path to validate
            
        Returns:
            Resolved path if valid, None otherwise
            
        Raises:
            PathTraversalError: If path traversal is detected
        """
        start_time = time.time()
        
        try:
            # Basic validation
            if not file_path or not isinstance(file_path, str):
                raise PathTraversalError("Invalid file path: empty or non-string")
            
            # Check for obvious path traversal patterns
            if ".." in file_path:
                # Allow some legitimate cases but be restrictive
                if file_path.count("..") > 2:  # Too many traversals
                    self.metrics.record_path_traversal_attempt(file_path)
                    raise PathTraversalError(f"Excessive path traversal detected: {file_path}")
            
            # Check for null bytes and other dangerous characters
            if "\x00" in file_path or any(char in file_path for char in ["|", "&", ";", "`"]):
                self.metrics.record_command_injection_attempt(file_path)
                raise PathTraversalError(f"Dangerous characters in path: {file_path}")
            
            # Resolve the path to handle any .. or . components
            try:
                if os.path.isabs(file_path):
                    resolved_path = Path(file_path).resolve()
                else:
                    # For relative paths, try resolving against each allowed base path
                    # This allows relative paths within allowed directories
                    resolved_path = None
                    for base_path in self.allowed_base_paths:
                        try:
                            candidate_path = (base_path / file_path).resolve()
                            # Check if the resolved path is still within the base path
                            candidate_path.relative_to(base_path)
                            resolved_path = candidate_path
                            break
                        except (ValueError, OSError):
                            continue
                    
                    # If no base path worked, try resolving against current working directory
                    if resolved_path is None:
                        cwd_path = Path(os.getcwd())
                        resolved_path = (cwd_path / file_path).resolve()
                        
            except (OSError, ValueError) as e:
                raise PathTraversalError(f"Invalid path resolution: {e}")
            
            # Check if path is within allowed base paths
            for base_path in self.allowed_base_paths:
                try:
                    resolved_path.relative_to(base_path)
                    # Path is within allowed base path
                    duration_ms = (time.time() - start_time) * 1000
                    self.metrics.record_validation_time(duration_ms)
                    return resolved_path
                except ValueError:
                    continue
            
            # Path not within any allowed base path
            self.metrics.record_path_traversal_attempt(file_path)
            raise PathTraversalError(f"Path outside allowed directories: {file_path}")
            
        except PathTraversalError:
            raise
        except Exception as e:
            logger.error(f"Path validation error for {file_path}: {e}")
            raise PathTraversalError(f"Path validation failed: {e}")
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_validation_time(duration_ms)


class ShellEscaper:
    """Utility for safe shell command construction."""
    
    def __init__(self):
        self.dangerous_chars = set(['|', '&', ';', '(', ')', '`', '$', '<', '>', '"', "'", '\\', '\n', '\r'])
        self.metrics = SecurityMetrics()
    
    def escape_shell_argument(self, arg: str) -> str:
        """
        Safely escape shell argument.
        
        Args:
            arg: Argument to escape
            
        Returns:
            Safely escaped argument
            
        Raises:
            CommandInjectionError: If argument contains dangerous patterns
        """
        if not isinstance(arg, str):
            arg = str(arg)
        
        # Check for command injection patterns
        if any(char in arg for char in self.dangerous_chars):
            # Log the attempt but don't necessarily block - just escape
            self.metrics.record_command_injection_attempt(arg)
            logger.warning(f"Potentially dangerous shell argument detected: {arg[:100]}")
        
        # Use shlex.quote for safe escaping
        return shlex.quote(arg)
    
    def validate_command(self, command: str, allowed_commands: Set[str]) -> bool:
        """
        Validate command against allowed list.
        
        Args:
            command: Command to validate
            allowed_commands: Set of allowed commands
            
        Returns:
            True if command is allowed
            
        Raises:
            CommandInjectionError: If command is not allowed
        """
        if command not in allowed_commands:
            self.metrics.record_command_injection_attempt(command)
            raise CommandInjectionError(f"Command not in allowlist: {command}")
        
        return True
    
    def safe_command_construction(self, command: str, args: List[str], 
                                allowed_commands: Set[str]) -> List[str]:
        """
        Safely construct command with arguments.
        
        Args:
            command: Base command
            args: List of arguments
            allowed_commands: Set of allowed commands
            
        Returns:
            List of command parts ready for subprocess.run()
            
        Raises:
            CommandInjectionError: If command or args are invalid
        """
        # Validate command
        self.validate_command(command, allowed_commands)
        
        # Escape all arguments
        escaped_args = [self.escape_shell_argument(arg) for arg in args]
        
        # Return command list (don't shell escape the command itself)
        return [command] + escaped_args


class JSONSchemaValidator:
    """JSON schema validation for hook inputs."""
    
    def __init__(self):
        self.valid_hook_events = {
            "SessionStart", "PreToolUse", "PostToolUse", "UserPromptSubmit",
            "PreCompact", "Notification", "Stop", "SubagentStop"
        }
        self.valid_tool_names = {
            "Read", "Write", "Edit", "MultiEdit", "Bash", "Grep", "Glob", "LS",
            "WebFetch", "WebSearch", "TodoRead", "TodoWrite", "NotebookRead",
            "NotebookEdit", "mcp__ide__getDiagnostics", "mcp__ide__executeCode"
        }
    
    def validate_hook_input_schema(self, data: Dict[str, Any]) -> bool:
        """
        Validate hook input against expected schema.
        
        Args:
            data: Hook input data
            
        Returns:
            True if valid
            
        Raises:
            ValueError: If schema validation fails
        """
        if not isinstance(data, dict):
            raise ValueError("Hook input must be a dictionary")
        
        # Check required hookEventName
        hook_event_name = data.get("hookEventName")
        if not hook_event_name:
            raise ValueError("Missing required field: hookEventName")
        
        if not isinstance(hook_event_name, str):
            raise ValueError("hookEventName must be a string")
        
        if hook_event_name not in self.valid_hook_events:
            raise ValueError(f"Invalid hookEventName: {hook_event_name}")
        
        # Validate sessionId if present
        session_id = data.get("sessionId")
        if session_id is not None:
            if not isinstance(session_id, str) or not session_id.strip():
                raise ValueError("sessionId must be a non-empty string")
        
        # Validate toolName if present
        tool_name = data.get("toolName")
        if tool_name is not None:
            if not isinstance(tool_name, str):
                raise ValueError("toolName must be a string")
            if tool_name not in self.valid_tool_names:
                logger.warning(f"Unknown tool name: {tool_name}")
        
        # Validate toolInput structure if present
        tool_input = data.get("toolInput")
        if tool_input is not None:
            if not isinstance(tool_input, dict):
                raise ValueError("toolInput must be a dictionary")
        
        return True


class SecurityValidator:
    """Main security validator combining all validation mechanisms."""
    
    def __init__(self, 
                 max_input_size_mb: float = 10.0,
                 allowed_base_paths: Optional[List[str]] = None,
                 allowed_commands: Optional[Set[str]] = None):
        """
        Initialize security validator.
        
        Args:
            max_input_size_mb: Maximum input size in megabytes
            allowed_base_paths: List of allowed base paths for file operations
            allowed_commands: Set of allowed shell commands
        """
        self.max_input_size_bytes = int(max_input_size_mb * 1024 * 1024)
        
        if allowed_base_paths is None:
            # Default allowed paths - restrict to common safe directories
            allowed_base_paths = [
                "/Users",
                "/home", 
                "/tmp",
                "/var/folders",  # macOS temp directories
                os.getcwd()      # Current working directory
            ]
        
        if allowed_commands is None:
            allowed_commands = {
                "git", "ls", "cat", "grep", "find", "head", "tail", "wc", "sort",
                "echo", "pwd", "which", "python", "python3", "pip", "npm", "yarn"
            }
        
        self.path_validator = PathValidator(allowed_base_paths)
        self.sensitive_data_detector = EnhancedSensitiveDataDetector()
        self.shell_escaper = ShellEscaper()
        self.json_schema_validator = JSONSchemaValidator()
        self.allowed_commands = allowed_commands
        self.metrics = SecurityMetrics()
    
    def validate_input_size(self, data: Any) -> bool:
        """
        Validate that input size is within limits.
        
        Args:
            data: Data to validate
            
        Returns:
            True if size is acceptable
            
        Raises:
            InputSizeError: If input is too large
        """
        start_time = time.time()
        
        try:
            # Convert to JSON to measure size
            json_str = json.dumps(data, default=str)
            size_bytes = len(json_str.encode('utf-8'))
            
            if size_bytes > self.max_input_size_bytes:
                size_mb = size_bytes / (1024 * 1024)
                self.metrics.record_oversized_input(size_mb)
                raise InputSizeError(f"Input size {size_mb:.2f}MB exceeds limit of {self.max_input_size_bytes/(1024*1024):.2f}MB")
            
            return True
            
        except (TypeError, OverflowError) as e:
            raise InputSizeError(f"Invalid input data: {e}")
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_validation_time(duration_ms)
    
    def validate_file_path(self, file_path: str) -> Optional[Path]:
        """Validate file path using path validator."""
        return self.path_validator.validate_file_path(file_path)
    
    def is_sensitive_data(self, data: Any) -> bool:
        """Check if data contains sensitive information."""
        return self.sensitive_data_detector.is_sensitive_data(data)
    
    def sanitize_sensitive_data(self, data: Any) -> Any:
        """Sanitize sensitive data."""
        findings = self.sensitive_data_detector.detect_sensitive_data(data)
        
        # Record metrics for findings
        for category, matches in findings.items():
            for _ in matches:
                self.metrics.record_sensitive_data_detection(category)
        
        return self.sensitive_data_detector.sanitize_sensitive_data(data)
    
    def escape_shell_argument(self, arg: str) -> str:
        """Safely escape shell argument."""
        return self.shell_escaper.escape_shell_argument(arg)
    
    def validate_hook_input_schema(self, data: Dict[str, Any]) -> bool:
        """Validate hook input schema."""
        return self.json_schema_validator.validate_hook_input_schema(data)
    
    def comprehensive_validation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform comprehensive validation and sanitization.
        
        Args:
            data: Input data to validate and sanitize
            
        Returns:
            Validated and sanitized data
            
        Raises:
            SecurityError: If validation fails
        """
        start_time = time.time()
        
        try:
            self.metrics.total_validations += 1
            
            # 1. Input size validation
            self.validate_input_size(data)
            
            # 2. JSON schema validation
            self.validate_hook_input_schema(data)
            
            # 3. Path validation for any file paths in the data
            self._validate_paths_in_data(data)
            
            # 4. Sensitive data sanitization
            sanitized_data = self.sanitize_sensitive_data(data)
            
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_validation_time(duration_ms)
            
            return sanitized_data
            
        except Exception as e:
            self.metrics.blocked_operations += 1
            logger.error(f"Comprehensive validation failed: {e}")
            raise
    
    def _validate_paths_in_data(self, data: Dict[str, Any]) -> None:
        """Validate any file paths found in the data structure."""
        def check_dict(d: Dict[str, Any]) -> None:
            for key, value in d.items():
                if isinstance(value, dict):
                    check_dict(value)
                elif isinstance(value, list):
                    check_list(value)
                elif isinstance(value, str):
                    # Check if this looks like a file path
                    if ("path" in key.lower() and len(value) > 0 and 
                        (value.startswith("/") or value.startswith("./") or 
                         value.startswith("../") or "\\" in value)):
                        # Validate the path
                        self.validate_file_path(value)
        
        def check_list(lst: List[Any]) -> None:
            for item in lst:
                if isinstance(item, dict):
                    check_dict(item)
                elif isinstance(item, list):
                    check_list(item)
        
        if isinstance(data, dict):
            check_dict(data)
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get comprehensive security metrics."""
        combined_metrics = self.metrics.get_metrics_summary()
        
        # Aggregate metrics from sub-components
        path_metrics = self.path_validator.metrics.get_metrics_summary()
        shell_metrics = self.shell_escaper.metrics.get_metrics_summary()
        
        # Combine metrics, summing overlapping keys
        for key, value in path_metrics.items():
            if key in combined_metrics and isinstance(value, (int, float)):
                combined_metrics[key] += value
            else:
                combined_metrics[key] = value
        
        for key, value in shell_metrics.items():
            if key in combined_metrics and isinstance(value, (int, float)):
                combined_metrics[key] += value
            else:
                combined_metrics[key] = value
                
        return combined_metrics


# Global security validator instance
DEFAULT_SECURITY_VALIDATOR = SecurityValidator()


def validate_and_sanitize_input(data: Any, validator: Optional[SecurityValidator] = None) -> Any:
    """
    Convenience function for input validation and sanitization.
    
    Args:
        data: Input data to validate and sanitize
        validator: Optional custom validator (uses default if None)
        
    Returns:
        Validated and sanitized data
        
    Raises:
        SecurityError: If validation fails
    """
    if validator is None:
        validator = DEFAULT_SECURITY_VALIDATOR
    
    return validator.comprehensive_validation(data)


def is_safe_file_path(file_path: str, allowed_base_paths: Optional[List[str]] = None) -> bool:
    """
    Check if a file path is safe (no path traversal).
    
    Args:
        file_path: Path to check
        allowed_base_paths: Optional list of allowed base paths
        
    Returns:
        True if path is safe, False otherwise
    """
    try:
        if allowed_base_paths:
            validator = SecurityValidator(allowed_base_paths=allowed_base_paths)
        else:
            validator = DEFAULT_SECURITY_VALIDATOR
        
        result = validator.validate_file_path(file_path)
        return result is not None
    except (PathTraversalError, SecurityError):
        return False