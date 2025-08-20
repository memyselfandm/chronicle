"""
Comprehensive tests for Chronicle error handling system.

Tests error creation, classification, recovery strategies, logging, retry logic,
and graceful degradation to ensure hooks never crash Claude Code.
"""

import json
import os
import sys
import tempfile
import time
import pytest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock, call
import logging
from contextlib import contextmanager

# Add the source directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'lib'))

from errors import (
    ChronicleError, DatabaseError, NetworkError, ValidationError,
    ConfigurationError, HookExecutionError, SecurityError, ResourceError,
    ErrorSeverity, RecoveryStrategy, LogLevel, RetryConfig,
    ChronicleLogger, ErrorHandler, with_error_handling, error_context,
    get_log_level_from_env, default_logger, default_error_handler
)


class TestChronicleErrorBase:
    """Test base Chronicle error functionality."""
    
    def test_error_creation_with_defaults(self):
        """Test Chronicle error creation with default values."""
        error = ChronicleError("Test error message")
        
        assert error.message == "Test error message"
        assert error.error_code == "ChronicleError"
        assert error.context == {}
        assert error.severity == ErrorSeverity.MEDIUM
        assert error.exit_code == 1
        assert error.recovery_suggestion is None
        assert error.cause is None
        assert isinstance(error.timestamp, datetime)
        assert len(error.error_id) == 8  # UUID prefix

    def test_error_creation_with_all_parameters(self):
        """Test Chronicle error creation with all parameters."""
        context = {"operation": "test", "data": "sample"}
        cause = ValueError("Original error")
        
        error = ChronicleError(
            "Test error message",
            error_code="TEST_001",
            context=context,
            cause=cause,
            severity=ErrorSeverity.CRITICAL,
            recovery_suggestion="Try restarting the service",
            exit_code=2
        )
        
        assert error.message == "Test error message"
        assert error.error_code == "TEST_001"
        assert error.context == context
        assert error.cause == cause
        assert error.severity == ErrorSeverity.CRITICAL
        assert error.recovery_suggestion == "Try restarting the service"
        assert error.exit_code == 2

    def test_error_to_dict_serialization(self):
        """Test error serialization to dictionary."""
        error = ChronicleError(
            "Database connection failed",
            error_code="DB_CONN_001",
            context={"host": "localhost", "port": 5432},
            severity=ErrorSeverity.HIGH,
            recovery_suggestion="Check database server status"
        )
        
        error_dict = error.to_dict()
        
        # Check required fields
        required_fields = [
            'error_id', 'error_type', 'error_code', 'message',
            'severity', 'context', 'recovery_suggestion', 
            'exit_code', 'timestamp'
        ]
        
        for field in required_fields:
            assert field in error_dict
        
        # Check values
        assert error_dict['error_type'] == 'ChronicleError'
        assert error_dict['error_code'] == 'DB_CONN_001'
        assert error_dict['message'] == 'Database connection failed'
        assert error_dict['severity'] == 'high'
        assert error_dict['context'] == {"host": "localhost", "port": 5432}

    def test_error_to_dict_with_traceback(self):
        """Test error serialization includes traceback when cause exists."""
        original_error = ValueError("Original error")
        
        try:
            raise original_error
        except ValueError as e:
            error = ChronicleError("Wrapper error", cause=e)
            error_dict = error.to_dict()
            
            assert 'traceback' in error_dict
            assert error_dict['traceback'] is not None

    def test_get_user_message_formatting(self):
        """Test user-friendly error message formatting."""
        error = ChronicleError(
            "Operation failed",
            recovery_suggestion="Please try again later"
        )
        
        user_msg = error.get_user_message()
        
        assert "Chronicle Hook Error" in user_msg
        assert error.error_id in user_msg
        assert "Operation failed" in user_msg
        assert "Please try again later" in user_msg

    def test_get_user_message_without_suggestion(self):
        """Test user message without recovery suggestion."""
        error = ChronicleError("Simple error")
        user_msg = error.get_user_message()
        
        assert "Chronicle Hook Error" in user_msg
        assert "Simple error" in user_msg
        assert "Suggestion:" not in user_msg

    def test_get_developer_message_formatting(self):
        """Test detailed developer error message formatting."""
        error = ChronicleError(
            "API call failed",
            error_code="API_001",
            context={"endpoint": "/api/v1/data", "status_code": 500},
            recovery_suggestion="Check API server logs"
        )
        
        dev_msg = error.get_developer_message()
        
        assert error.error_id in dev_msg
        assert "API_001" in dev_msg
        assert "API call failed" in dev_msg
        assert "/api/v1/data" in dev_msg
        assert "Check API server logs" in dev_msg

    def test_get_developer_message_json_formatting(self):
        """Test that context is properly JSON formatted."""
        complex_context = {
            "nested": {"data": [1, 2, 3]},
            "status": "failed"
        }
        
        error = ChronicleError("Complex error", context=complex_context)
        dev_msg = error.get_developer_message()
        
        # Should contain formatted JSON
        assert '"nested"' in dev_msg
        assert '"data"' in dev_msg
        assert '[\n    1,\n    2,\n    3\n  ]' in dev_msg or '[1, 2, 3]' in dev_msg


class TestSpecificErrorTypes:
    """Test specific error type configurations."""
    
    def test_database_error_defaults(self):
        """Test DatabaseError default configuration."""
        error = DatabaseError("Connection timeout")
        
        assert error.error_code == "DB_ERROR"
        assert error.severity == ErrorSeverity.HIGH
        assert error.exit_code == 1
        assert "database" in error.recovery_suggestion.lower()
        assert "fallback" in error.recovery_suggestion.lower()

    def test_network_error_defaults(self):
        """Test NetworkError default configuration."""
        error = NetworkError("API request failed")
        
        assert error.error_code == "NETWORK_ERROR"
        assert error.severity == ErrorSeverity.MEDIUM
        assert error.exit_code == 1
        assert "network" in error.recovery_suggestion.lower()

    def test_validation_error_defaults(self):
        """Test ValidationError default configuration."""
        error = ValidationError("Invalid JSON format")
        
        assert error.error_code == "VALIDATION_ERROR"
        assert error.severity == ErrorSeverity.LOW
        assert error.exit_code == 1
        assert "validation" in error.recovery_suggestion.lower()

    def test_configuration_error_defaults(self):
        """Test ConfigurationError default configuration."""
        error = ConfigurationError("Missing environment variable")
        
        assert error.error_code == "CONFIG_ERROR"
        assert error.severity == ErrorSeverity.HIGH
        assert error.exit_code == 2  # Blocking error
        assert "configuration" in error.recovery_suggestion.lower()

    def test_hook_execution_error_defaults(self):
        """Test HookExecutionError default configuration."""
        error = HookExecutionError("Hook processing failed")
        
        assert error.error_code == "HOOK_ERROR"
        assert error.severity == ErrorSeverity.MEDIUM
        assert error.exit_code == 1
        assert "continue" in error.recovery_suggestion.lower()

    def test_security_error_defaults(self):
        """Test SecurityError default configuration."""
        error = SecurityError("Unauthorized access attempt")
        
        assert error.error_code == "SECURITY_ERROR"
        assert error.severity == ErrorSeverity.CRITICAL
        assert error.exit_code == 2  # Blocking error
        assert "security" in error.recovery_suggestion.lower()

    def test_resource_error_defaults(self):
        """Test ResourceError default configuration."""
        error = ResourceError("Memory exhausted")
        
        assert error.error_code == "RESOURCE_ERROR"
        assert error.severity == ErrorSeverity.HIGH
        assert error.exit_code == 1
        assert "resources" in error.recovery_suggestion.lower()

    def test_error_inheritance(self):
        """Test that all specific errors inherit from ChronicleError."""
        errors = [
            DatabaseError("test"),
            NetworkError("test"),
            ValidationError("test"),
            ConfigurationError("test"),
            HookExecutionError("test"),
            SecurityError("test"),
            ResourceError("test")
        ]
        
        for error in errors:
            assert isinstance(error, ChronicleError)
            assert hasattr(error, 'error_id')
            assert hasattr(error, 'timestamp')
            assert callable(error.to_dict)


class TestRetryConfiguration:
    """Test retry configuration and delay calculation."""
    
    def test_retry_config_defaults(self):
        """Test RetryConfig default values."""
        config = RetryConfig()
        
        assert config.max_attempts == 3
        assert config.base_delay == 1.0
        assert config.max_delay == 60.0
        assert config.exponential_base == 2.0
        assert config.jitter is True

    def test_retry_config_custom_values(self):
        """Test RetryConfig with custom values."""
        config = RetryConfig(
            max_attempts=5,
            base_delay=0.5,
            max_delay=30.0,
            exponential_base=1.5,
            jitter=False
        )
        
        assert config.max_attempts == 5
        assert config.base_delay == 0.5
        assert config.max_delay == 30.0
        assert config.exponential_base == 1.5
        assert config.jitter is False

    def test_exponential_backoff_calculation(self):
        """Test exponential backoff delay calculation."""
        config = RetryConfig(
            base_delay=1.0,
            exponential_base=2.0,
            jitter=False
        )
        
        # Test exponential growth: 1, 2, 4, 8, 16...
        assert config.get_delay(0) == 1.0
        assert config.get_delay(1) == 2.0
        assert config.get_delay(2) == 4.0
        assert config.get_delay(3) == 8.0

    def test_max_delay_cap(self):
        """Test that delay is capped at max_delay."""
        config = RetryConfig(
            base_delay=10.0,
            max_delay=15.0,
            exponential_base=2.0,
            jitter=False
        )
        
        # Should be capped at 15.0 for higher attempts
        assert config.get_delay(0) == 10.0
        assert config.get_delay(1) == 15.0  # Would be 20, but capped
        assert config.get_delay(5) == 15.0

    def test_jitter_randomization(self):
        """Test that jitter adds randomness to delays."""
        config = RetryConfig(base_delay=10.0, jitter=True)
        
        delays = [config.get_delay(0) for _ in range(10)]
        
        # All delays should be different due to jitter
        assert len(set(delays)) > 1
        
        # All delays should be between 50% and 100% of base delay
        for delay in delays:
            assert 5.0 <= delay <= 10.0

    def test_jitter_disabled(self):
        """Test consistent delays when jitter is disabled."""
        config = RetryConfig(base_delay=5.0, jitter=False)
        
        delays = [config.get_delay(0) for _ in range(5)]
        
        # All delays should be identical
        assert all(delay == 5.0 for delay in delays)

    def test_different_exponential_bases(self):
        """Test delay calculation with different exponential bases."""
        config_2x = RetryConfig(base_delay=1.0, exponential_base=2.0, jitter=False)
        config_3x = RetryConfig(base_delay=1.0, exponential_base=3.0, jitter=False)
        
        # Compare growth rates
        assert config_2x.get_delay(2) == 4.0  # 1 * 2^2
        assert config_3x.get_delay(2) == 9.0  # 1 * 3^2


class TestChronicleLogger:
    """Test Chronicle logging system."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "test.log"

    def tearDown(self):
        """Clean up test environment."""
        import shutil
        if hasattr(self, 'temp_dir'):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_logger_creation_defaults(self):
        """Test logger creation with default values."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "test.log"
            
            logger = ChronicleLogger(
                name="test_logger",
                log_file=str(log_file),
                console_output=False
            )
            
            assert logger.name == "test_logger"
            assert logger.log_level == LogLevel.INFO
            assert logger.log_file == log_file
            assert logger.console_output is False

    def test_logger_creation_custom_level(self):
        """Test logger creation with custom log level."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "debug.log"
            
            logger = ChronicleLogger(
                log_level=LogLevel.DEBUG,
                log_file=str(log_file),
                console_output=True
            )
            
            assert logger.log_level == LogLevel.DEBUG
            assert logger.console_output is True

    def test_logger_file_creation(self):
        """Test that log file and directory are created."""
        with tempfile.TemporaryDirectory() as temp_dir:
            nested_path = Path(temp_dir) / "logs" / "nested" / "test.log"
            
            logger = ChronicleLogger(log_file=str(nested_path), console_output=False)
            
            # Should create parent directories
            assert nested_path.parent.exists()
            assert nested_path.exists()

    def test_logging_methods_basic(self):
        """Test basic logging methods."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "test.log"
            
            logger = ChronicleLogger(
                log_level=LogLevel.DEBUG,
                log_file=str(log_file),
                console_output=False
            )
            
            # Test all log levels
            logger.debug("Debug message")
            logger.info("Info message")
            logger.warning("Warning message")
            logger.error("Error message")
            logger.critical("Critical message")
            
            # Check log file contents
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Debug message" in content
            assert "Info message" in content
            assert "Warning message" in content
            assert "Error message" in content
            assert "CRITICAL: Critical message" in content

    def test_logging_with_context(self):
        """Test logging with context data."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "context.log"
            
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            context = {"user_id": "123", "operation": "data_fetch"}
            logger.info("Operation completed", context)
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Operation completed" in content
            assert "user_id" in content
            assert "123" in content
            assert "operation" in content

    def test_error_logging_with_exception(self):
        """Test error logging with exception details."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "error.log"
            
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            try:
                raise ValueError("Test exception")
            except ValueError as e:
                logger.error("An error occurred", {"operation": "test"}, error=e)
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "An error occurred" in content
            assert "ValueError" in content
            assert "Test exception" in content
            assert "operation" in content

    def test_chronicle_error_logging(self):
        """Test logging ChronicleError with error_id."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "chronicle.log"
            
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            error = DatabaseError("Connection failed", context={"host": "localhost"})
            logger.error("Database operation failed", error=error)
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Database operation failed" in content
            assert error.error_id in content

    def test_log_error_details_method(self):
        """Test dedicated log_error_details method."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "details.log"
            
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            error = SecurityError(
                "Unauthorized access",
                context={"ip": "192.168.1.100", "endpoint": "/admin"}
            )
            logger.log_error_details(error)
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert error.error_id in content
            assert "Unauthorized access" in content
            assert "SECURITY_ERROR" in content
            assert "critical" in content
            assert "192.168.1.100" in content

    def test_log_level_filtering(self):
        """Test that log level filtering works correctly."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "filtered.log"
            
            logger = ChronicleLogger(
                log_level=LogLevel.WARN,
                log_file=str(log_file),
                console_output=False
            )
            
            logger.debug("Debug message")
            logger.info("Info message")
            logger.warning("Warning message")
            logger.error("Error message")
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            # Only warning and error should be present
            assert "Debug message" not in content
            assert "Info message" not in content
            assert "Warning message" in content
            assert "Error message" in content

    def test_set_level_dynamically(self):
        """Test dynamic log level changes."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "dynamic.log"
            
            logger = ChronicleLogger(
                log_level=LogLevel.WARN,
                log_file=str(log_file),
                console_output=False
            )
            
            logger.info("Info before change")  # Should not appear
            
            logger.set_level(LogLevel.DEBUG)
            logger.info("Info after change")   # Should appear
            
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Info before change" not in content
            assert "Info after change" in content

    def test_default_log_file_location(self):
        """Test default log file location."""
        logger = ChronicleLogger(console_output=False)
        
        expected_path = Path.home() / ".claude" / "chronicle_hooks.log"
        assert logger.log_file == expected_path
        
        # Should create the file
        assert logger.log_file.exists()

    def test_prevent_propagation(self):
        """Test that logger doesn't propagate to root logger."""
        logger = ChronicleLogger(console_output=False)
        assert logger.logger.propagate is False


class TestErrorHandler:
    """Test comprehensive error handler functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "handler.log"
        
        self.logger = ChronicleLogger(
            log_file=str(self.log_file),
            console_output=False
        )
        self.error_handler = ErrorHandler(self.logger)

    def tearDown(self):
        """Clean up test environment."""
        import shutil
        if hasattr(self, 'temp_dir'):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_error_handler_creation(self):
        """Test ErrorHandler creation and initialization."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "handler.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            handler = ErrorHandler(logger)
            
            assert handler.logger == logger
            assert isinstance(handler.error_counts, dict)
            assert isinstance(handler.last_errors, dict)
            assert isinstance(handler.error_classification, dict)

    def test_error_handler_default_logger(self):
        """Test ErrorHandler with default logger."""
        handler = ErrorHandler()
        assert isinstance(handler.logger, ChronicleLogger)

    def test_handle_chronicle_error_directly(self):
        """Test handling ChronicleError instances directly."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "chronicle.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            error = DatabaseError(
                "Connection failed",
                context={"database": "test_db"}
            )
            
            should_continue, exit_code, message = handler.handle_error(
                error, operation="database_connect"
            )
            
            assert should_continue is True
            assert exit_code == 1
            assert "Connection failed" in message
            assert error.error_id in message

    def test_handle_standard_exceptions(self):
        """Test handling standard Python exceptions."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "standard.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            test_cases = [
                (ConnectionError("Network down"), NetworkError),
                (PermissionError("Access denied"), SecurityError),
                (TimeoutError("Request timeout"), NetworkError),
                (json.JSONDecodeError("Invalid JSON", "test", 0), ValidationError),
                (ValueError("Invalid value"), HookExecutionError)
            ]
            
            for original_error, expected_type in test_cases:
                should_continue, exit_code, message = handler.handle_error(
                    original_error,
                    context={"test": "case"},
                    operation="test_operation"
                )
                
                assert should_continue is True
                assert isinstance(exit_code, int)
                assert isinstance(message, str)

    def test_error_classification_system(self):
        """Test error classification and strategy determination."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "classification.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            # Test known classifications
            test_cases = [
                (ConnectionError(), ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
                (ValueError(), ErrorSeverity.MEDIUM, RecoveryStrategy.IGNORE),
                (PermissionError(), ErrorSeverity.HIGH, RecoveryStrategy.ESCALATE),
                (TimeoutError(), ErrorSeverity.MEDIUM, RecoveryStrategy.RETRY)
            ]
            
            for error, expected_severity, expected_strategy in test_cases:
                severity, strategy = handler._classify_error(error)
                assert severity == expected_severity
                assert strategy == expected_strategy

    def test_unknown_error_classification(self):
        """Test classification of unknown error types."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "unknown.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            class UnknownError(Exception):
                pass
            
            severity, strategy = handler._classify_error(UnknownError())
            assert severity == ErrorSeverity.MEDIUM
            assert strategy == RecoveryStrategy.GRACEFUL_FAIL

    def test_error_conversion_patterns(self):
        """Test conversion of specific error patterns to Chronicle errors."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "conversion.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            # Test connection errors
            conn_error = ConnectionError("Database unreachable")
            chronicle_error = handler._convert_to_chronicle_error(
                conn_error, {"host": "db.example.com"}, "db_connect"
            )
            assert isinstance(chronicle_error, NetworkError)
            assert "db_connect" in chronicle_error.message
            assert chronicle_error.context["host"] == "db.example.com"
            
            # Test permission errors
            perm_error = PermissionError("File access denied")
            chronicle_error = handler._convert_to_chronicle_error(
                perm_error, {}, "file_read"
            )
            assert isinstance(chronicle_error, SecurityError)
            assert "file_read" in chronicle_error.message

    def test_error_tracking_system(self):
        """Test error occurrence tracking and pattern detection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "tracking.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            error = ValidationError("Data format error")
            
            # Handle same error multiple times
            for i in range(5):
                handler.handle_error(error, operation=f"validation_{i}")
            
            # Check tracking
            error_key = "VALIDATION_ERROR:ValidationError"
            assert error_key in handler.error_counts
            assert handler.error_counts[error_key] == 5
            assert error_key in handler.last_errors

    def test_recurring_error_warning(self):
        """Test warning for recurring error patterns."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "recurring.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            error = NetworkError("Connection timeout")
            
            # Trigger recurring error warning (>3 occurrences)
            for i in range(5):
                handler.handle_error(error, operation="network_call")
            
            # Check log for recurring pattern warning
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Recurring error pattern detected" in content
            assert "NETWORK_ERROR:NetworkError" in content

    def test_recovery_strategy_execution(self):
        """Test execution of different recovery strategies."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "recovery.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            # Test different strategies
            strategies = [
                (ErrorSeverity.LOW, RecoveryStrategy.IGNORE),
                (ErrorSeverity.MEDIUM, RecoveryStrategy.GRACEFUL_FAIL),
                (ErrorSeverity.HIGH, RecoveryStrategy.FALLBACK),
                (ErrorSeverity.CRITICAL, RecoveryStrategy.ESCALATE)
            ]
            
            for severity, strategy in strategies:
                error = ChronicleError("Test error", severity=severity)
                should_continue, exit_code, message = handler._execute_recovery_strategy(error, strategy)
                
                assert should_continue is True  # All strategies allow continuation
                assert isinstance(exit_code, int)
                assert isinstance(message, str)

    def test_security_error_handling(self):
        """Test special handling of security errors."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "security.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            handler = ErrorHandler(logger)
            
            security_error = SecurityError("Unauthorized API access")
            should_continue, exit_code, message = handler.handle_error(
                security_error, operation="api_call"
            )
            
            # Security errors should still allow continuation but with exit code 2
            assert should_continue is True
            assert exit_code == 2
            assert "developer" in message.lower() or "Unauthorized" in message


class TestErrorHandlingDecorator:
    """Test error handling decorator functionality."""
    
    def test_successful_function_execution(self):
        """Test decorator with successful function execution."""
        @with_error_handling(operation="test_operation")
        def successful_function(x, y):
            return x + y
        
        result = successful_function(2, 3)
        assert result == 5

    def test_function_with_retryable_error(self):
        """Test decorator with temporary failures and retry."""
        call_count = 0
        
        @with_error_handling(
            operation="retry_test",
            retry_config=RetryConfig(max_attempts=3, base_delay=0.01)
        )
        def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Temporary failure")
            return "success"
        
        result = flaky_function()
        assert result == "success"
        assert call_count == 3

    def test_function_with_non_retryable_error(self):
        """Test decorator with non-retryable errors."""
        call_count = 0
        
        @with_error_handling(
            operation="security_test",
            retry_config=RetryConfig(max_attempts=3)
        )
        def security_function():
            nonlocal call_count
            call_count += 1
            raise PermissionError("Access denied")
        
        result = security_function()
        # Should not retry security errors
        assert call_count == 1
        # Should return graceful failure (True)
        assert result is True

    def test_function_with_fallback(self):
        """Test decorator with fallback function."""
        fallback_called = False
        
        def fallback_function(*args, **kwargs):
            nonlocal fallback_called
            fallback_called = True
            return "fallback_result"
        
        @with_error_handling(
            operation="fallback_test",
            fallback_func=fallback_function
        )
        def always_failing_function():
            raise ValueError("Always fails")
        
        result = always_failing_function()
        assert fallback_called is True
        assert result == "fallback_result"

    def test_fallback_function_also_fails(self):
        """Test decorator when both main and fallback functions fail."""
        def failing_fallback(*args, **kwargs):
            raise RuntimeError("Fallback also fails")
        
        @with_error_handling(
            operation="double_failure",
            fallback_func=failing_fallback
        )
        def always_failing_function():
            raise ValueError("Main function fails")
        
        result = always_failing_function()
        # Should return True for graceful failure
        assert result is True

    def test_decorator_preserves_function_metadata(self):
        """Test that decorator preserves original function metadata."""
        @with_error_handling(operation="metadata_test")
        def documented_function():
            """This function has documentation."""
            return "result"
        
        assert documented_function.__name__ == "documented_function"
        assert "documentation" in documented_function.__doc__

    def test_decorator_with_arguments_and_kwargs(self):
        """Test decorator with functions that accept arguments."""
        @with_error_handling(operation="args_test")
        def function_with_args(a, b, c=None, **kwargs):
            return {"a": a, "b": b, "c": c, "kwargs": kwargs}
        
        result = function_with_args(1, 2, c=3, extra="value")
        expected = {"a": 1, "b": 2, "c": 3, "kwargs": {"extra": "value"}}
        assert result == expected

    def test_retry_delay_progression(self):
        """Test that retry delays follow expected progression."""
        delays = []
        original_sleep = time.sleep
        
        def mock_sleep(duration):
            delays.append(duration)
        
        with patch('time.sleep', side_effect=mock_sleep):
            call_count = 0
            
            @with_error_handling(
                operation="delay_test",
                retry_config=RetryConfig(
                    max_attempts=4,
                    base_delay=1.0,
                    exponential_base=2.0,
                    jitter=False
                )
            )
            def failing_function():
                nonlocal call_count
                call_count += 1
                if call_count < 4:
                    raise ConnectionError("Retry me")
                return "success"
            
            result = failing_function()
            assert result == "success"
            assert len(delays) == 3  # 3 retries
            # Should follow exponential backoff: 1.0, 2.0, 4.0
            assert delays[0] == 1.0
            assert delays[1] == 2.0
            assert delays[2] == 4.0


class TestErrorContextManager:
    """Test error context manager functionality."""
    
    def test_successful_context_execution(self):
        """Test error context with successful operation."""
        with error_context("test_operation", {"param": "value"}) as handler:
            assert isinstance(handler, ErrorHandler)
            # Successful operation should complete normally
            result = "success"
        
        assert result == "success"

    def test_context_with_exception(self):
        """Test error context with exception handling."""
        with pytest.raises(ValueError):
            with error_context("failing_operation"):
                raise ValueError("Test error")

    def test_context_timing_and_logging(self):
        """Test that context manager logs operation timing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "context.log"
            
            # Create custom logger for this test
            logger = ChronicleLogger(
                log_level=LogLevel.DEBUG,
                log_file=str(log_file),
                console_output=False
            )
            
            # Patch the default error handler to use our logger
            with patch('errors.ErrorHandler') as mock_handler_class:
                mock_handler = MagicMock()
                mock_handler.logger = logger
                mock_handler_class.return_value = mock_handler
                
                with error_context("logged_operation", {"test": True}):
                    time.sleep(0.01)  # Small delay to measure
                
                # Verify the handler was called appropriately
                assert mock_handler_class.called

    def test_context_with_operation_failure(self):
        """Test context manager when operation fails."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "failure.log"
            
            try:
                with error_context("failing_operation", {"will_fail": True}):
                    raise RuntimeError("Operation failed")
            except RuntimeError:
                pass  # Expected
            
            # Context should handle the error appropriately


class TestEnvironmentConfiguration:
    """Test environment-based configuration."""
    
    def test_get_log_level_from_env_default(self):
        """Test default log level when no environment variable."""
        with patch.dict(os.environ, {}, clear=True):
            level = get_log_level_from_env()
            assert level == LogLevel.INFO

    def test_get_log_level_from_env_debug(self):
        """Test DEBUG log level from environment."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'DEBUG'}):
            level = get_log_level_from_env()
            assert level == LogLevel.DEBUG

    def test_get_log_level_from_env_warning(self):
        """Test WARNING log level from environment."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'WARNING'}):
            level = get_log_level_from_env()
            assert level == LogLevel.WARN

    def test_get_log_level_from_env_warn_alias(self):
        """Test WARN alias for WARNING level."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'WARN'}):
            level = get_log_level_from_env()
            assert level == LogLevel.WARN

    def test_get_log_level_from_env_error(self):
        """Test ERROR log level from environment."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'ERROR'}):
            level = get_log_level_from_env()
            assert level == LogLevel.ERROR

    def test_get_log_level_from_env_case_insensitive(self):
        """Test case insensitive log level parsing."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'debug'}):
            level = get_log_level_from_env()
            assert level == LogLevel.DEBUG

    def test_get_log_level_from_env_invalid(self):
        """Test invalid log level defaults to INFO."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'INVALID_LEVEL'}):
            level = get_log_level_from_env()
            assert level == LogLevel.INFO

    def test_get_log_level_from_env_empty(self):
        """Test empty log level defaults to INFO."""
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': ''}):
            level = get_log_level_from_env()
            assert level == LogLevel.INFO


class TestGlobalInstances:
    """Test global logger and error handler instances."""
    
    def test_default_logger_exists(self):
        """Test that default logger instance exists."""
        assert default_logger is not None
        assert isinstance(default_logger, ChronicleLogger)

    def test_default_error_handler_exists(self):
        """Test that default error handler instance exists."""
        assert default_error_handler is not None
        assert isinstance(default_error_handler, ErrorHandler)
        assert default_error_handler.logger == default_logger

    def test_default_logger_configuration(self):
        """Test default logger configuration."""
        # Should use log level from environment
        with patch('errors.get_log_level_from_env', return_value=LogLevel.DEBUG):
            # Re-import to get fresh instance
            from importlib import reload
            import errors
            reload(errors)
            
            # Check the configuration was applied
            assert errors.default_logger.log_level == LogLevel.DEBUG


class TestIntegrationScenarios:
    """Test complete error handling integration scenarios."""
    
    def test_database_connection_failure_scenario(self):
        """Test complete database failure scenario with graceful handling."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "integration.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            error_handler = ErrorHandler(logger)
            
            # Simulate database connection failure
            connection_error = ConnectionError("Database server unreachable")
            
            should_continue, exit_code, message = error_handler.handle_error(
                connection_error,
                context={"host": "db.example.com", "port": 5432},
                operation="database_connect"
            )
            
            # Should handle gracefully
            assert should_continue is True
            assert exit_code == 1
            assert "unreachable" in message.lower()
            
            # Check comprehensive logging
            with open(log_file, 'r') as f:
                content = f.read()
            
            assert "Database server unreachable" in content
            assert "db.example.com" in content

    def test_multiple_error_types_scenario(self):
        """Test handling multiple different error types in sequence."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "multi_error.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            error_handler = ErrorHandler(logger)
            
            # Different types of errors
            errors = [
                ValidationError("Invalid input format"),
                NetworkError("API timeout"),
                DatabaseError("Connection pool exhausted"),
                SecurityError("Authentication failed"),
                ResourceError("Memory limit exceeded")
            ]
            
            results = []
            for error in errors:
                should_continue, exit_code, message = error_handler.handle_error(
                    error, operation="multi_error_test"
                )
                results.append((should_continue, exit_code, error.severity))
            
            # All should allow continuation
            for should_continue, exit_code, severity in results:
                assert should_continue is True
                assert isinstance(exit_code, int)
            
            # Check that critical errors have higher exit codes
            security_result = results[3]  # SecurityError
            assert security_result[1] == 2  # Blocking exit code

    def test_error_recovery_with_fallback_chain(self):
        """Test error recovery with fallback operations."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "fallback.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            # Simulate primary operation failure
            primary_error = DatabaseError("Primary database unavailable")
            
            # Simulate fallback operation
            def fallback_operation():
                return {"status": "fallback_success", "data": "cached_result"}
            
            # Use decorator for complete flow
            @with_error_handling(
                operation="data_fetch",
                fallback_func=fallback_operation
            )
            def fetch_data():
                raise primary_error
            
            result = fetch_data()
            
            # Should get fallback result
            assert result["status"] == "fallback_success"
            assert result["data"] == "cached_result"

    def test_concurrent_error_handling(self):
        """Test error handling with concurrent operations."""
        import threading
        import queue
        
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = Path(temp_dir) / "concurrent.log"
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            error_handler = ErrorHandler(logger)
            
            results_queue = queue.Queue()
            
            def worker(worker_id):
                try:
                    if worker_id % 2 == 0:
                        raise NetworkError(f"Worker {worker_id} network error")
                    else:
                        raise ValidationError(f"Worker {worker_id} validation error")
                except Exception as e:
                    should_continue, exit_code, message = error_handler.handle_error(
                        e, operation=f"worker_{worker_id}"
                    )
                    results_queue.put((worker_id, should_continue, exit_code))
            
            # Start multiple workers
            threads = []
            for i in range(5):
                thread = threading.Thread(target=worker, args=(i,))
                threads.append(thread)
                thread.start()
            
            # Wait for completion
            for thread in threads:
                thread.join()
            
            # Collect results
            results = []
            while not results_queue.empty():
                results.append(results_queue.get())
            
            assert len(results) == 5
            for worker_id, should_continue, exit_code in results:
                assert should_continue is True
                assert isinstance(exit_code, int)


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])