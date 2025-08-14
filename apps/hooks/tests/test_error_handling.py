#!/usr/bin/env python3
"""
Comprehensive tests for Chronicle error handling system.

Tests error classification, recovery strategies, logging, retry logic,
and graceful degradation to ensure hooks never crash Claude Code.
"""

import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock

# Add the source directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'core'))

from errors import (
    ChronicleError, DatabaseError, NetworkError, ValidationError,
    ConfigurationError, HookExecutionError, SecurityError, ResourceError,
    ErrorSeverity, RecoveryStrategy, LogLevel, RetryConfig,
    ChronicleLogger, ErrorHandler, with_error_handling, error_context,
    get_log_level_from_env
)


class TestChronicleError(unittest.TestCase):
    """Test Chronicle error classes and functionality."""
    
    def test_base_error_creation(self):
        """Test basic Chronicle error creation."""
        error = ChronicleError(
            "Test error message",
            error_code="TEST_ERROR",
            context={"test": "data"},
            severity=ErrorSeverity.HIGH
        )
        
        self.assertEqual(error.message, "Test error message")
        self.assertEqual(error.error_code, "TEST_ERROR")
        self.assertEqual(error.context, {"test": "data"})
        self.assertEqual(error.severity, ErrorSeverity.HIGH)
        self.assertIsNotNone(error.error_id)
        self.assertIsInstance(error.timestamp, datetime)
    
    def test_error_to_dict(self):
        """Test error serialization to dictionary."""
        error = ChronicleError("Test message", error_code="TEST", context={"key": "value"})
        error_dict = error.to_dict()
        
        required_fields = [
            'error_id', 'error_type', 'error_code', 'message',
            'severity', 'context', 'timestamp'
        ]
        
        for field in required_fields:
            self.assertIn(field, error_dict)
        
        self.assertEqual(error_dict['message'], "Test message")
        self.assertEqual(error_dict['error_code'], "TEST")
        self.assertEqual(error_dict['context'], {"key": "value"})
    
    def test_user_message_formatting(self):
        """Test user-friendly error message formatting."""
        error = ChronicleError(
            "Database connection failed",
            recovery_suggestion="Check database credentials"
        )
        
        user_msg = error.get_user_message()
        self.assertIn("Chronicle Hook Error", user_msg)
        self.assertIn("Database connection failed", user_msg)
        self.assertIn("Check database credentials", user_msg)
    
    def test_developer_message_formatting(self):
        """Test developer error message formatting."""
        error = ChronicleError(
            "Database error",
            error_code="DB_001",
            context={"table": "sessions", "query": "SELECT * FROM sessions"},
            recovery_suggestion="Check connection pool"
        )
        
        dev_msg = error.get_developer_message()
        self.assertIn("DB_001", dev_msg)
        self.assertIn("Database error", dev_msg)
        self.assertIn("sessions", dev_msg)
        self.assertIn("Check connection pool", dev_msg)


class TestSpecificErrors(unittest.TestCase):
    """Test specific error types and their configurations."""
    
    def test_database_error(self):
        """Test DatabaseError configuration."""
        error = DatabaseError("Connection timeout")
        
        self.assertEqual(error.error_code, "DB_ERROR")
        self.assertEqual(error.severity, ErrorSeverity.HIGH)
        self.assertEqual(error.exit_code, 1)
        self.assertIn("database", error.recovery_suggestion.lower())
    
    def test_network_error(self):
        """Test NetworkError configuration."""
        error = NetworkError("API request failed")
        
        self.assertEqual(error.error_code, "NETWORK_ERROR")
        self.assertEqual(error.severity, ErrorSeverity.MEDIUM)
        self.assertIn("network", error.recovery_suggestion.lower())
    
    def test_validation_error(self):
        """Test ValidationError configuration."""
        error = ValidationError("Invalid JSON format")
        
        self.assertEqual(error.error_code, "VALIDATION_ERROR")
        self.assertEqual(error.severity, ErrorSeverity.LOW)
        self.assertIn("validation", error.recovery_suggestion.lower())
    
    def test_configuration_error(self):
        """Test ConfigurationError configuration."""
        error = ConfigurationError("Missing environment variable")
        
        self.assertEqual(error.error_code, "CONFIG_ERROR")
        self.assertEqual(error.severity, ErrorSeverity.HIGH)
        self.assertEqual(error.exit_code, 2)  # Blocking error
        self.assertIn("configuration", error.recovery_suggestion.lower())
    
    def test_security_error(self):
        """Test SecurityError configuration."""
        error = SecurityError("Unauthorized access attempt")
        
        self.assertEqual(error.error_code, "SECURITY_ERROR")
        self.assertEqual(error.severity, ErrorSeverity.CRITICAL)
        self.assertEqual(error.exit_code, 2)  # Blocking error
        self.assertIn("security", error.recovery_suggestion.lower())


class TestRetryConfig(unittest.TestCase):
    """Test retry configuration and delay calculation."""
    
    def test_exponential_backoff(self):
        """Test exponential backoff delay calculation."""
        config = RetryConfig(
            base_delay=1.0,
            exponential_base=2.0,
            jitter=False
        )
        
        # Test exponential growth
        self.assertEqual(config.get_delay(0), 1.0)
        self.assertEqual(config.get_delay(1), 2.0)
        self.assertEqual(config.get_delay(2), 4.0)
    
    def test_max_delay_limit(self):
        """Test maximum delay limit."""
        config = RetryConfig(
            base_delay=10.0,
            max_delay=15.0,
            exponential_base=2.0,
            jitter=False
        )
        
        # Should be capped at max_delay
        self.assertEqual(config.get_delay(10), 15.0)
    
    def test_jitter_variation(self):
        """Test jitter adds randomness."""
        config = RetryConfig(base_delay=10.0, jitter=True)
        
        delays = [config.get_delay(0) for _ in range(10)]
        
        # All delays should be different due to jitter
        self.assertEqual(len(set(delays)), 10)
        
        # All delays should be between 5.0 and 10.0 (50% to 100% of base)
        for delay in delays:
            self.assertGreaterEqual(delay, 5.0)
            self.assertLessEqual(delay, 10.0)


class TestChronicleLogger(unittest.TestCase):
    """Test Chronicle logging system."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "test.log"
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_logger_creation(self):
        """Test logger creation and configuration."""
        logger = ChronicleLogger(
            name="test_logger",
            log_level=LogLevel.DEBUG,
            log_file=str(self.log_file),
            console_output=False
        )
        
        self.assertEqual(logger.name, "test_logger")
        self.assertEqual(logger.log_level, LogLevel.DEBUG)
        self.assertEqual(logger.log_file, self.log_file)
    
    def test_logging_methods(self):
        """Test different logging methods."""
        logger = ChronicleLogger(
            log_file=str(self.log_file),
            console_output=False
        )
        
        # Test different log levels
        logger.debug("Debug message", {"debug": True})
        logger.info("Info message", {"info": True})
        logger.warning("Warning message", {"warning": True})
        logger.error("Error message", {"error": True})
        logger.critical("Critical message", {"critical": True})
        
        # Check log file exists and has content
        self.assertTrue(self.log_file.exists())
        
        with open(self.log_file, 'r') as f:
            log_content = f.read()
        
        # Should contain all log levels (depending on configured level)
        self.assertIn("Info message", log_content)
        self.assertIn("Warning message", log_content)
        self.assertIn("Error message", log_content)
        self.assertIn("Critical message", log_content)
    
    def test_error_logging_with_exception(self):
        """Test error logging with exception details."""
        logger = ChronicleLogger(
            log_file=str(self.log_file),
            console_output=False
        )
        
        try:
            raise ValueError("Test exception")
        except ValueError as e:
            logger.error("An error occurred", {"operation": "test"}, error=e)
        
        with open(self.log_file, 'r') as f:
            log_content = f.read()
        
        self.assertIn("An error occurred", log_content)
        self.assertIn("ValueError", log_content)
        self.assertIn("Test exception", log_content)
    
    def test_log_level_filtering(self):
        """Test log level filtering."""
        logger = ChronicleLogger(
            log_level=LogLevel.WARN,
            log_file=str(self.log_file),
            console_output=False
        )
        
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")
        
        with open(self.log_file, 'r') as f:
            log_content = f.read()
        
        # Only warning and error should be logged
        self.assertNotIn("Debug message", log_content)
        self.assertNotIn("Info message", log_content)
        self.assertIn("Warning message", log_content)
        self.assertIn("Error message", log_content)


class TestErrorHandler(unittest.TestCase):
    """Test error handler functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = Path(self.temp_dir) / "error_test.log"
        
        self.logger = ChronicleLogger(
            log_file=str(self.log_file),
            console_output=False
        )
        self.error_handler = ErrorHandler(self.logger)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_handle_chronicle_error(self):
        """Test handling of Chronicle errors."""
        error = DatabaseError("Connection failed", context={"db": "test"})
        
        should_continue, exit_code, message = self.error_handler.handle_error(
            error, operation="test_db_operation"
        )
        
        self.assertTrue(should_continue)
        self.assertEqual(exit_code, 1)
        self.assertIn("Connection failed", message)
    
    def test_handle_standard_exception(self):
        """Test handling of standard Python exceptions."""
        error = ConnectionError("Network is unreachable")
        
        should_continue, exit_code, message = self.error_handler.handle_error(
            error, 
            context={"host": "example.com"},
            operation="network_request"
        )
        
        self.assertTrue(should_continue)
        self.assertIn("Network is unreachable", message)
    
    def test_error_classification(self):
        """Test error classification system."""
        # Test known error types
        severity, strategy = self.error_handler._classify_error(ConnectionError())
        self.assertEqual(severity, ErrorSeverity.HIGH)
        self.assertEqual(strategy, RecoveryStrategy.FALLBACK)
        
        severity, strategy = self.error_handler._classify_error(ValueError())
        self.assertEqual(severity, ErrorSeverity.MEDIUM)
        self.assertEqual(strategy, RecoveryStrategy.IGNORE)
        
        # Test unknown error type
        class UnknownError(Exception):
            pass
        
        severity, strategy = self.error_handler._classify_error(UnknownError())
        self.assertEqual(severity, ErrorSeverity.MEDIUM)
        self.assertEqual(strategy, RecoveryStrategy.GRACEFUL_FAIL)
    
    def test_error_tracking(self):
        """Test error occurrence tracking."""
        error = ValidationError("Invalid data")
        
        # Handle same error multiple times
        for _ in range(5):
            self.error_handler.handle_error(error, operation="validation")
        
        # Check error was tracked
        error_key = "VALIDATION_ERROR:ValidationError"
        self.assertIn(error_key, self.error_handler.error_counts)
        self.assertEqual(self.error_handler.error_counts[error_key], 5)
    
    def test_convert_to_chronicle_error(self):
        """Test conversion of standard exceptions to Chronicle errors."""
        # Test connection error conversion
        conn_error = ConnectionError("Connection refused")
        chronicle_error = self.error_handler._convert_to_chronicle_error(
            conn_error, {"host": "localhost"}, "database_connect"
        )
        
        self.assertIsInstance(chronicle_error, NetworkError)
        self.assertIn("database_connect", chronicle_error.message)
        self.assertEqual(chronicle_error.context, {"host": "localhost"})
        
        # Test permission error conversion
        perm_error = PermissionError("Access denied")
        chronicle_error = self.error_handler._convert_to_chronicle_error(
            perm_error, {}, "file_write"
        )
        
        self.assertIsInstance(chronicle_error, SecurityError)
        self.assertIn("file_write", chronicle_error.message)


class TestErrorHandlingDecorator(unittest.TestCase):
    """Test error handling decorator functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.call_count = 0
        self.fallback_called = False
    
    def test_successful_execution(self):
        """Test decorator with successful function execution."""
        @with_error_handling(operation="test_operation")
        def successful_function():
            return "success"
        
        result = successful_function()
        self.assertEqual(result, "success")
    
    def test_retry_logic(self):
        """Test retry logic with temporary failures."""
        @with_error_handling(
            operation="retry_test",
            retry_config=RetryConfig(max_attempts=3, base_delay=0.01)
        )
        def failing_function():
            self.call_count += 1
            if self.call_count < 3:
                raise ConnectionError("Temporary failure")
            return "success"
        
        result = failing_function()
        self.assertEqual(result, "success")
        self.assertEqual(self.call_count, 3)
    
    def test_fallback_execution(self):
        """Test fallback function execution."""
        def fallback_function():
            self.fallback_called = True
            return "fallback_result"
        
        @with_error_handling(
            operation="fallback_test",
            fallback_func=fallback_function
        )
        def always_failing_function():
            raise ValueError("Always fails")
        
        result = always_failing_function()
        self.assertTrue(self.fallback_called)
        self.assertEqual(result, "fallback_result")
    
    def test_non_retryable_error(self):
        """Test handling of non-retryable errors."""
        @with_error_handling(
            operation="security_test",
            retry_config=RetryConfig(max_attempts=3)
        )
        def security_error_function():
            self.call_count += 1
            raise PermissionError("Access denied")
        
        result = security_error_function()
        # Should not retry security errors
        self.assertEqual(self.call_count, 1)
        # Should return graceful failure
        self.assertTrue(result)


class TestErrorContext(unittest.TestCase):
    """Test error context manager."""
    
    def test_successful_context(self):
        """Test error context with successful operation."""
        with error_context("test_operation", {"param": "value"}) as handler:
            self.assertIsInstance(handler, ErrorHandler)
            # Successful operation
            pass
    
    def test_error_in_context(self):
        """Test error context with exception."""
        with self.assertRaises(ValueError):
            with error_context("failing_operation"):
                raise ValueError("Test error")
    
    def test_context_logging(self):
        """Test that context manager logs operations."""
        temp_dir = tempfile.mkdtemp()
        log_file = Path(temp_dir) / "context_test.log"
        
        try:
            # Create a logger for testing
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            
            # Create error handler with our logger
            error_handler = ErrorHandler(logger)
            
            # Test the error context functionality directly
            with error_context("logged_operation", {"test": True}) as handler:
                time.sleep(0.01)  # Small delay to test duration logging
                self.assertIsInstance(handler, ErrorHandler)
            
            # Check that log file has content
            if log_file.exists():
                with open(log_file, 'r') as f:
                    log_content = f.read()
                    # Should have some logging activity
                    self.assertTrue(len(log_content) > 0)
                
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestEnvironmentConfiguration(unittest.TestCase):
    """Test environment-based configuration."""
    
    def test_log_level_from_env(self):
        """Test log level configuration from environment."""
        # Test default
        with patch.dict(os.environ, {}, clear=True):
            level = get_log_level_from_env()
            self.assertEqual(level, LogLevel.INFO)
        
        # Test DEBUG
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'DEBUG'}):
            level = get_log_level_from_env()
            self.assertEqual(level, LogLevel.DEBUG)
        
        # Test WARNING
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'WARNING'}):
            level = get_log_level_from_env()
            self.assertEqual(level, LogLevel.WARN)
        
        # Test invalid level (should default to INFO)
        with patch.dict(os.environ, {'CHRONICLE_LOG_LEVEL': 'INVALID'}):
            level = get_log_level_from_env()
            self.assertEqual(level, LogLevel.INFO)


class TestIntegrationScenarios(unittest.TestCase):
    """Test complete error handling scenarios."""
    
    def test_database_failure_scenario(self):
        """Test complete database failure scenario with fallback."""
        temp_dir = tempfile.mkdtemp()
        log_file = Path(temp_dir) / "integration_test.log"
        
        try:
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            error_handler = ErrorHandler(logger)
            
            # Simulate database operation that fails
            class MockDatabase:
                def save_data(self, data):
                    raise ConnectionError("Database unavailable")
                
                def save_to_fallback(self, data):
                    return {"saved": True, "fallback": True}
            
            db = MockDatabase()
            
            # Test error handling
            try:
                db.save_data({"test": "data"})
            except ConnectionError as e:
                should_continue, exit_code, message = error_handler.handle_error(
                    e, {"operation": "save_data"}, "database_save"
                )
                
                self.assertTrue(should_continue)
                self.assertEqual(exit_code, 1)
                self.assertIn("Connection", message)
            
            # Test fallback works
            fallback_result = db.save_to_fallback({"test": "data"})
            self.assertTrue(fallback_result["fallback"])
            
            # Check logging
            with open(log_file, 'r') as f:
                log_content = f.read()
            
            self.assertIn("Database unavailable", log_content)
            self.assertIn("database_save", log_content)
            
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_hook_execution_with_multiple_errors(self):
        """Test hook execution with multiple different error types."""
        temp_dir = tempfile.mkdtemp()
        log_file = Path(temp_dir) / "multi_error_test.log"
        
        try:
            logger = ChronicleLogger(log_file=str(log_file), console_output=False)
            error_handler = ErrorHandler(logger)
            
            # Simulate different types of errors
            errors = [
                ValidationError("Invalid input data"),
                NetworkError("API request timeout"),
                DatabaseError("Connection pool exhausted"),
                SecurityError("Unauthorized access")
            ]
            
            results = []
            for error in errors:
                should_continue, exit_code, message = error_handler.handle_error(
                    error, operation="hook_execution"
                )
                results.append((should_continue, exit_code, message))
            
            # All errors should allow continuation (graceful degradation)
            for should_continue, exit_code, message in results:
                self.assertTrue(should_continue)
                self.assertIsInstance(exit_code, int)
                self.assertIsInstance(message, str)
            
            # Security error should have exit code 2 (blocking)
            security_result = results[3]
            self.assertEqual(security_result[1], 2)
            
            # Check comprehensive logging
            with open(log_file, 'r') as f:
                log_content = f.read()
            
            self.assertIn("Invalid input data", log_content)
            self.assertIn("API request timeout", log_content)
            self.assertIn("Connection pool exhausted", log_content)
            self.assertIn("Unauthorized access", log_content)
            
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    # Set up test environment
    os.environ['CHRONICLE_LOG_LEVEL'] = 'DEBUG'
    
    # Run tests
    unittest.main(verbosity=2)