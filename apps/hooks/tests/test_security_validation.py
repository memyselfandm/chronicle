"""Tests for security validation and input sanitization."""

import json
import os
import pytest
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Try to import the security validation modules that we'll create
try:
    from src.lib.security import SecurityValidator, InputSizeError, PathTraversalError
    from src.lib.base_hook import BaseHook
    from src.lib.utils import sanitize_data
except ImportError:
    # In case modules don't exist yet, we'll create them
    SecurityValidator = None
    InputSizeError = None
    PathTraversalError = None


class TestPathTraversalValidation:
    """Test path traversal attack prevention."""
    
    @pytest.fixture
    def temp_directory(self):
        """Create temporary directory for tests."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    def test_path_traversal_attack_prevention(self, temp_directory):
        """Test prevention of path traversal attacks."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        allowed_paths = [str(temp_directory)]
        validator = SecurityValidator(allowed_base_paths=allowed_paths)
        
        # Test various path traversal attack vectors
        malicious_paths = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32\\config\\sam",
            "/etc/shadow",
            "../../../../root/.ssh/id_rsa",
            "..\\..\\..\\Program Files\\sensitive.exe",
            "/usr/bin/../../../etc/passwd",
            "legitimate_file/../../../etc/passwd",
            "./../../etc/passwd",
            "subdir/../../etc/passwd"
        ]
        
        for malicious_path in malicious_paths:
            try:
                result = validator.validate_file_path(malicious_path)
                # If no exception is raised, the result should be None (invalid path)
                assert result is None, f"Malicious path {malicious_path} was not blocked"
            except (PathTraversalError, ValueError):
                # This is expected and good - the path was blocked
                pass
    
    def test_legitimate_paths_allowed(self, temp_directory):
        """Test that legitimate paths within allowed directories are accepted."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        allowed_paths = [str(temp_directory)]
        validator = SecurityValidator(allowed_base_paths=allowed_paths)
        
        # Create test files
        test_file = temp_directory / "test.txt"
        subdir = temp_directory / "subdir"
        subdir.mkdir()
        nested_file = subdir / "nested.txt"
        
        test_file.write_text("test content")
        nested_file.write_text("nested content")
        
        # These paths should be valid (using absolute paths since we're in temp dir)
        legitimate_paths = [
            str(test_file),
            str(nested_file),
            str(temp_directory / "non_existent.txt")
        ]
        
        for path in legitimate_paths:
            try:
                validated_path = validator.validate_file_path(path)
                assert validated_path is not None
            except Exception as e:
                pytest.fail(f"Legitimate path {path} was rejected: {e}")


class TestInputSizeValidation:
    """Test input size validation to prevent memory exhaustion."""
    
    def test_large_input_rejection(self):
        """Test rejection of inputs exceeding size limits."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator(max_input_size_mb=1)  # 1MB limit
        
        # Create input larger than 1MB
        large_string = "A" * (2 * 1024 * 1024)  # 2MB string
        large_dict = {"large_data": large_string}
        
        with pytest.raises(InputSizeError):
            validator.validate_input_size(large_dict)
    
    def test_normal_input_acceptance(self):
        """Test acceptance of normal-sized inputs."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator(max_input_size_mb=10)  # 10MB limit
        
        normal_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "parameters": {"file_path": "/tmp/test.txt"},
            "session_id": "test-session-123"
        }
        
        # Should not raise exception
        result = validator.validate_input_size(normal_data)
        assert result is True
    
    def test_configurable_size_limits(self):
        """Test that size limits are configurable."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        # Test with small limit
        small_validator = SecurityValidator(max_input_size_mb=0.1)  # 100KB
        large_string = "A" * (200 * 1024)  # 200KB
        
        with pytest.raises(InputSizeError):
            small_validator.validate_input_size({"data": large_string})
        
        # Test with larger limit
        large_validator = SecurityValidator(max_input_size_mb=1)  # 1MB
        # Same data should pass with larger limit
        result = large_validator.validate_input_size({"data": large_string})
        assert result is True


class TestSensitiveDataDetection:
    """Test enhanced sensitive data detection patterns."""
    
    def test_api_key_detection(self):
        """Test detection of various API key patterns."""
        test_data = {
            "openai_key": "sk-1234567890123456789012345678901234567890",
            "anthropic_key": "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890",
            "aws_key": "AKIA1234567890ABCDEF",
            "stripe_key": "sk_live_1234567890abcdefghijklmnop",
            "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        }
        
        sanitized_data = sanitize_data(test_data)
        
        # All API keys should be redacted
        assert "sk-1234567890123456789012345678901234567890" not in str(sanitized_data)
        assert "AKIA1234567890ABCDEF" not in str(sanitized_data)
        assert "[REDACTED]" in str(sanitized_data)
    
    def test_credential_detection(self):
        """Test detection of passwords and credentials."""
        test_data = {
            "password": "mysecretpassword123",
            "supabase_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
            "database_password": "db_pass_123",
            "secret_key": "supersecretkey456",
            "access_token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
        }
        
        sanitized_data = sanitize_data(test_data)
        
        # Passwords and secrets should be redacted
        for key, value in test_data.items():
            if "password" in key.lower() or "secret" in key.lower() or "key" in key.lower():
                assert value not in str(sanitized_data)
    
    def test_pii_detection(self):
        """Test detection of personally identifiable information."""
        test_data = {
            "email": "user@example.com",
            "ssn": "123-45-6789",
            "credit_card": "4532-1234-5678-9012",
            "phone": "+1-555-123-4567",
            "user_path": "/Users/johnsmith/documents/secret.txt"
        }
        
        sanitized_data = sanitize_data(test_data)
        
        # User paths should be sanitized
        assert "/Users/johnsmith" not in str(sanitized_data)
        assert "/Users/[USER]" in str(sanitized_data)
    
    def test_enhanced_token_patterns(self):
        """Test detection of various token patterns."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        token_patterns = [
            "github_pat_11ABCDEFG_abcdefghijklmnopqrstuvwxyz123456789abcdefghijklmnopqrstuvwxyz12",
            "glpat-xxxxxxxxxxxxxxxxxxxx",
            "xoxb-123456789012-123456789012-abcdefghijklmnopqrstuvwx",
            "AKIA1234567890ABCDEF",
            "sk-1234567890123456789012345678901234567890abcdefgh",
        ]
        
        for token in token_patterns:
            detected = validator.is_sensitive_data(token)
            assert detected is True, f"Failed to detect token: {token}"


class TestShellEscaping:
    """Test shell command escaping utilities."""
    
    def test_command_injection_prevention(self):
        """Test prevention of command injection attacks."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        dangerous_inputs = [
            "; rm -rf /",
            "| cat /etc/passwd",
            "$(whoami)",
            "`id`",
            "&& curl malicious.com",
            "|| echo 'injected'",
            "> /tmp/malicious.txt",
            "< /etc/shadow"
        ]
        
        for dangerous_input in dangerous_inputs:
            escaped = validator.escape_shell_argument(dangerous_input)
            # After escaping with shlex.quote, the entire string should be wrapped in quotes
            # making it safe to use as a single argument (dangerous chars are neutralized)
            assert escaped.startswith("'") and escaped.endswith("'"), f"Input '{dangerous_input}' not properly quoted: {escaped}"
            # The escaped version should be different from the original
            assert escaped != dangerous_input, f"Input '{dangerous_input}' was not modified during escaping"
    
    def test_safe_command_construction(self):
        """Test safe command construction with escaping."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        # Test safe argument escaping
        args = ["normal_file.txt", "file with spaces.txt", "special&chars.txt"]
        safe_args = [validator.escape_shell_argument(arg) for arg in args]
        
        # Construct command safely
        command = ["ls"] + safe_args
        
        # Should be safe to execute (in theory)
        assert all(isinstance(arg, str) for arg in command)
        assert len(command) == 4


class TestJSONSchemaValidation:
    """Test JSON schema validation for hook inputs."""
    
    def test_valid_hook_input_schema(self):
        """Test validation of correctly formatted hook inputs."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        valid_inputs = [
            {
                "hookEventName": "PreToolUse",
                "sessionId": "session-123",
                "toolName": "Read",
                "toolInput": {"file_path": "/tmp/test.txt"}
            },
            {
                "hookEventName": "PostToolUse",
                "sessionId": "session-456",
                "toolName": "Write",
                "toolInput": {"file_path": "/tmp/output.txt", "content": "Hello"},
                "toolResult": {"success": True}
            },
            {
                "hookEventName": "SessionStart",
                "sessionId": "session-789",
                "cwd": "/test/project"
            }
        ]
        
        for valid_input in valid_inputs:
            # Should not raise exception
            result = validator.validate_hook_input_schema(valid_input)
            assert result is True
    
    def test_invalid_hook_input_schema(self):
        """Test rejection of malformed hook inputs."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        invalid_inputs = [
            {},  # Empty input
            {"hookEventName": ""},  # Empty event name
            {"hookEventName": "InvalidEvent"},  # Invalid event name
            {"sessionId": ""},  # Empty session ID
            {"toolName": "UnknownTool"},  # Invalid tool name
            {"hookEventName": 123},  # Wrong type
        ]
        
        for invalid_input in invalid_inputs:
            with pytest.raises(ValueError):
                validator.validate_hook_input_schema(invalid_input)


class TestPerformanceRequirements:
    """Test that validation meets performance requirements (<5ms)."""
    
    def test_path_validation_performance(self):
        """Test path validation performance."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator(allowed_base_paths=["/tmp", "/Users"])
        
        test_paths = [
            "/tmp/test.txt",
            "/Users/test/document.txt",
            "../../../etc/passwd",
            "normal_file.txt"
        ] * 100  # Test with 400 paths
        
        start_time = time.time()
        
        for path in test_paths:
            try:
                validator.validate_file_path(path)
            except (PathTraversalError, ValueError):
                pass  # Expected for malicious paths
        
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000
        
        # Should complete in less than 5ms per validation on average
        avg_time_per_validation = duration_ms / len(test_paths)
        assert avg_time_per_validation < 5.0, f"Path validation too slow: {avg_time_per_validation}ms"
    
    def test_input_size_validation_performance(self):
        """Test input size validation performance."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator(max_input_size_mb=10)
        
        # Create reasonably sized test data
        test_data = {
            "hook_event_name": "PreToolUse",
            "tool_input": {"content": "A" * 10000},  # 10KB
            "session_data": {"events": [{"id": i, "data": "event_data"} for i in range(100)]}
        }
        
        start_time = time.time()
        
        for _ in range(1000):  # Run 1000 validations
            validator.validate_input_size(test_data)
        
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000
        avg_time_per_validation = duration_ms / 1000
        
        assert avg_time_per_validation < 5.0, f"Input size validation too slow: {avg_time_per_validation}ms"
    
    def test_sensitive_data_detection_performance(self):
        """Test sensitive data detection performance."""
        # Create test data with various patterns
        test_data = {
            "normal_field": "just normal text here",
            "api_data": "sk-1234567890123456789012345678901234567890",
            "config": {"password": "secretpassword123", "database_url": "postgres://user:pass@host/db"},
            "user_info": {"path": "/Users/testuser/documents/file.txt"}
        }
        
        start_time = time.time()
        
        for _ in range(1000):  # Run 1000 sanitizations
            sanitize_data(test_data)
        
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000
        avg_time_per_sanitization = duration_ms / 1000
        
        assert avg_time_per_sanitization < 5.0, f"Data sanitization too slow: {avg_time_per_sanitization}ms"


class TestSecurityLogging:
    """Test security violation logging."""
    
    def test_security_violation_logging(self):
        """Test that security violations are logged."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        with patch('src.core.security.logger') as mock_logger:
            validator = SecurityValidator()
            
            # Trigger a security violation
            try:
                validator.validate_file_path("../../../etc/passwd")
            except (PathTraversalError, ValueError):
                pass
            
            # Should have logged the violation
            mock_logger.warning.assert_called()
            call_args = mock_logger.warning.call_args[0][0]
            assert "path traversal" in call_args.lower() or "invalid path" in call_args.lower()
    
    def test_security_metrics_tracking(self):
        """Test tracking of security metrics."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        validator = SecurityValidator()
        
        # Simulate various security events
        malicious_paths = ["../etc/passwd", "../../windows/system32", "/etc/shadow"]
        
        for path in malicious_paths:
            try:
                validator.validate_file_path(path)
            except (PathTraversalError, ValueError):
                pass
        
        # Check that violations were tracked
        metrics = validator.get_security_metrics()
        assert metrics.get('path_traversal_attempts', 0) >= len(malicious_paths)


class TestBaseHookSecurityIntegration:
    """Test security validation integration with BaseHook."""
    
    @pytest.fixture
    def mock_database_manager(self):
        """Mock database manager."""
        manager = Mock()
        manager.save_session.return_value = (True, "session-uuid-123")
        manager.save_event.return_value = True
        manager.get_status.return_value = {"supabase": {"has_client": True}}
        return manager
    
    def test_base_hook_validates_input_size(self, mock_database_manager):
        """Test that BaseHook validates input size."""
        from src.lib.base_hook import BaseHook
        
        with patch('src.lib.base_hook.DatabaseManager') as mock_db_manager:
            mock_db_manager.return_value = mock_database_manager
            
            hook = BaseHook()
            
            # Create oversized input
            large_input = {
                "hookEventName": "PreToolUse",
                "toolInput": {"content": "A" * (20 * 1024 * 1024)}  # 20MB
            }
            
            # Should handle large input gracefully (security violation should be detected)
            processed_data = hook.process_hook_data(large_input)
            
            # Should detect security violation and return fallback data
            assert processed_data.get("hook_event_name") == "SecurityViolation"
            assert processed_data.get("error_type") == "InputSizeError"
    
    def test_base_hook_path_validation(self, mock_database_manager):
        """Test that BaseHook validates file paths."""
        from src.lib.base_hook import BaseHook
        
        with patch('src.lib.base_hook.DatabaseManager') as mock_db_manager:
            mock_db_manager.return_value = mock_database_manager
            
            hook = BaseHook()
            
            # Test with malicious path - this should trigger path validation during comprehensive_validation
            malicious_input = {
                "hookEventName": "PreToolUse",
                "toolName": "Read",
                "toolInput": {"file_path": "../../../etc/passwd"}
            }
            
            # Process the input
            processed_data = hook.process_hook_data(malicious_input)
            
            # Should detect security violation and return fallback data
            assert processed_data.get("hook_event_name") == "SecurityViolation"
            assert processed_data.get("error_type") == "PathTraversalError"
    
    def test_base_hook_sensitive_data_sanitization(self, mock_database_manager):
        """Test that BaseHook sanitizes sensitive data."""
        from src.lib.base_hook import BaseHook
        
        with patch('src.lib.base_hook.DatabaseManager') as mock_db_manager:
            mock_db_manager.return_value = mock_database_manager
            
            hook = BaseHook()
            
            # Input with sensitive data
            sensitive_input = {
                "hookEventName": "PreToolUse",
                "toolInput": {
                    "api_key": "sk-1234567890123456789012345678901234567890",
                    "password": "mysecretpassword",
                    "config": {
                        "supabase_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
                    }
                }
            }
            
            processed_data = hook.process_hook_data(sensitive_input)
            
            # Sensitive data should be redacted
            data_str = str(processed_data)
            assert "sk-1234567890123456789012345678901234567890" not in data_str
            assert "mysecretpassword" not in data_str
            assert "[REDACTED]" in data_str


class TestConfigurableSecuritySettings:
    """Test configurable security settings."""
    
    def test_configurable_max_input_size(self):
        """Test configurable maximum input size."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        # Test with different size limits
        small_validator = SecurityValidator(max_input_size_mb=1)
        large_validator = SecurityValidator(max_input_size_mb=50)
        
        # Create 2MB test data
        test_data = {"content": "A" * (2 * 1024 * 1024)}
        
        # Should fail with small limit
        with pytest.raises(InputSizeError):
            small_validator.validate_input_size(test_data)
        
        # Should pass with large limit
        result = large_validator.validate_input_size(test_data)
        assert result is True
    
    def test_configurable_allowed_paths(self):
        """Test configurable allowed base paths."""
        if SecurityValidator is None:
            pytest.skip("SecurityValidator not implemented yet")
        
        # Test with restricted paths
        restricted_validator = SecurityValidator(allowed_base_paths=["/tmp"])
        
        # Test with permissive paths
        permissive_validator = SecurityValidator(
            allowed_base_paths=["/tmp", "/Users", "/home", "/opt"]
        )
        
        test_path = "/Users/test/document.txt"
        
        # Should fail with restricted validator
        with pytest.raises((PathTraversalError, ValueError)):
            restricted_validator.validate_file_path(test_path)
        
        # Should pass with permissive validator
        result = permissive_validator.validate_file_path(test_path)
        assert result is not None


if __name__ == "__main__":
    pytest.main([__file__])