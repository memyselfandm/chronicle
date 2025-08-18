"""
Comprehensive tests for core/lib consolidation validation.

This test suite ensures that all functionality from src/core is properly 
merged into src/lib without loss of features or breaking changes.
"""

import unittest
import sys
import os
from unittest.mock import patch, MagicMock, call
from pathlib import Path

# Add the hooks source directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "lib"))

class TestConsolidationPreMerge(unittest.TestCase):
    """Test the current state before consolidation."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_input = {
            "session_id": "test-session-123",
            "event_name": "test_event",
            "timestamp": "2025-08-18T10:00:00Z",
            "data": {"test": "data"}
        }
    
    def test_core_base_hook_imports(self):
        """Test that core BaseHook can be imported and instantiated."""
        try:
            from src.lib.base_hook import BaseHook
            hook = BaseHook()
            self.assertIsNotNone(hook)
            self.assertTrue(hasattr(hook, 'save_event'))
            self.assertTrue(hasattr(hook, 'get_claude_session_id'))
            # Test advanced functionality that should be preserved
            self.assertTrue(hasattr(hook, 'get_security_metrics'))
            self.assertTrue(hasattr(hook, 'get_performance_metrics'))
            self.assertTrue(hasattr(hook, 'validate_file_path'))
        except ImportError as e:
            self.fail(f"Failed to import core BaseHook: {e}")
    
    def test_lib_base_hook_imports(self):
        """Test that lib BaseHook can be imported and instantiated."""
        try:
            from src.lib.base_hook import BaseHook
            hook = BaseHook()
            self.assertIsNotNone(hook)
            self.assertTrue(hasattr(hook, 'save_event'))
            self.assertTrue(hasattr(hook, 'get_claude_session_id'))
        except ImportError as e:
            self.fail(f"Failed to import lib BaseHook: {e}")
    
    def test_core_database_imports(self):
        """Test that core database modules can be imported."""
        try:
            from src.lib.database import DatabaseManager, SupabaseClient
            self.assertIsNotNone(DatabaseManager)
            self.assertIsNotNone(SupabaseClient)
        except ImportError as e:
            self.fail(f"Failed to import core database: {e}")
    
    def test_lib_database_imports(self):
        """Test that lib database modules can be imported."""
        try:
            from src.lib.database import DatabaseManager
            self.assertIsNotNone(DatabaseManager)
        except ImportError as e:
            self.fail(f"Failed to import lib database: {e}")
    
    def test_core_utils_imports(self):
        """Test that core utils can be imported."""
        try:
            from src.lib.utils import sanitize_data, format_error_message
            self.assertIsNotNone(sanitize_data)
            self.assertIsNotNone(format_error_message)
        except ImportError as e:
            self.fail(f"Failed to import core utils: {e}")
    
    def test_lib_utils_imports(self):
        """Test that lib utils can be imported."""
        try:
            from src.lib.utils import sanitize_data
            self.assertIsNotNone(sanitize_data)
        except ImportError as e:
            self.fail(f"Failed to import lib utils: {e}")
    
    def test_core_only_modules_import(self):
        """Test that core-only modules can be imported."""
        try:
            from src.lib.errors import ChronicleLogger, ErrorHandler
            from src.lib.performance import PerformanceMetrics
            from src.lib.security import SecurityValidator
            from src.lib.cross_platform import normalize_path
            
            self.assertIsNotNone(ChronicleLogger)
            self.assertIsNotNone(ErrorHandler)
            self.assertIsNotNone(PerformanceMetrics)
            self.assertIsNotNone(SecurityValidator)
            self.assertIsNotNone(normalize_path)
        except ImportError as e:
            self.fail(f"Failed to import core-only modules: {e}")


class TestConsolidationPostMerge(unittest.TestCase):
    """Test the state after consolidation - to be run after merge."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_input = {
            "session_id": "test-session-123", 
            "event_name": "test_event",
            "timestamp": "2025-08-18T10:00:00Z",
            "data": {"test": "data"}
        }
    
    def test_lib_has_all_core_base_hook_functionality(self):
        """Test that lib BaseHook has all functionality from src.lib."""
        try:
            from src.lib.base_hook import BaseHook
            hook = BaseHook()
            
            # Core functionality that must be preserved
            required_methods = [
                'save_event', 'get_claude_session_id', 'load_project_context',
                'validate_environment', 'get_project_root', 'save_session',
                'log_error', 'process_hook_data', 'create_response',
                'create_hook_specific_output', 'create_permission_response',
                'get_database_status', 'validate_file_path', 'check_input_size',
                'escape_shell_command', 'detect_sensitive_data', 
                'get_security_metrics', 'get_performance_metrics',
                'reset_performance_metrics', 'execute_hook_optimized'
            ]
            
            for method in required_methods:
                self.assertTrue(hasattr(hook, method), 
                    f"BaseHook missing required method: {method}")
        except ImportError as e:
            self.fail(f"Failed to import consolidated lib BaseHook: {e}")
    
    def test_lib_has_all_core_database_functionality(self):
        """Test that lib database has all functionality from src.lib."""
        try:
            from src.lib.database import DatabaseManager, SupabaseClient
            
            # Test that SupabaseClient is available
            self.assertIsNotNone(SupabaseClient)
            
            # Test DatabaseManager instantiation
            db_manager = DatabaseManager()
            self.assertIsNotNone(db_manager)
            
            # Test required methods
            required_methods = [
                'get_client', 'save_event', 'save_session', 'get_events',
                'get_sessions', 'health_check', 'close'
            ]
            
            for method in required_methods:
                self.assertTrue(hasattr(db_manager, method),
                    f"DatabaseManager missing required method: {method}")
        except ImportError as e:
            self.fail(f"Failed to import consolidated lib database: {e}")
    
    def test_lib_has_all_core_utils_functionality(self):
        """Test that lib utils has all functionality from src.lib."""
        try:
            from src.lib.utils import (
                sanitize_data, format_error_message, extract_session_context,
                get_git_info, resolve_project_path, validate_environment_setup
            )
            
            self.assertIsNotNone(sanitize_data)
            self.assertIsNotNone(format_error_message)
            self.assertIsNotNone(extract_session_context)
            self.assertIsNotNone(get_git_info)
            self.assertIsNotNone(resolve_project_path)
            self.assertIsNotNone(validate_environment_setup)
        except ImportError as e:
            self.fail(f"Failed to import consolidated lib utils: {e}")
    
    def test_core_only_modules_moved_to_lib(self):
        """Test that core-only modules are available in lib."""
        try:
            from src.lib.errors import ChronicleLogger, ErrorHandler
            from src.lib.performance import PerformanceMetrics
            from src.lib.security import SecurityValidator
            from src.lib.cross_platform import normalize_path
            
            self.assertIsNotNone(ChronicleLogger)
            self.assertIsNotNone(ErrorHandler)
            self.assertIsNotNone(PerformanceMetrics)
            self.assertIsNotNone(SecurityValidator)
            self.assertIsNotNone(normalize_path)
        except ImportError as e:
            self.fail(f"Failed to import moved core modules from lib: {e}")
    
    def test_core_directory_removed(self):
        """Test that core directory no longer exists."""
        core_path = Path(__file__).parent.parent / "src" / "core"
        self.assertFalse(core_path.exists(), 
            "Core directory should be removed after consolidation")
    
    def test_all_imports_use_lib(self):
        """Test that no imports reference src.core anymore."""
        import subprocess
        import os
        
        # Search for any remaining core imports
        hooks_dir = Path(__file__).parent.parent
        try:
            result = subprocess.run([
                'grep', '-r', '--include=*.py', 'from.*src\\.core', str(hooks_dir)
            ], capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout:
                self.fail(f"Found remaining src.core imports:\n{result.stdout}")
        except FileNotFoundError:
            # grep not available, skip this test
            pass


class TestFunctionalityPreservation(unittest.TestCase):
    """Test that specific functionality is preserved during consolidation."""
    
    @patch('src.lib.database.DatabaseManager')
    def test_hook_processing_preserved(self, mock_db):
        """Test that hook processing functionality is preserved."""
        try:
            from src.lib.base_hook import BaseHook
            
            hook = BaseHook()
            test_data = {
                "session_id": "test-123",
                "event_name": "test_event", 
                "data": {"key": "value"}
            }
            
            # Test that process_hook_data works
            result = hook.process_hook_data(test_data, "test_event")
            self.assertIsInstance(result, dict)
            self.assertIn("session_id", result)
            
        except ImportError as e:
            # Skip if not yet consolidated
            self.skipTest(f"Consolidation not yet complete: {e}")
    
    @patch('src.lib.database.DatabaseManager.save_event')
    def test_event_saving_preserved(self, mock_save):
        """Test that event saving functionality is preserved."""
        try:
            from src.lib.base_hook import BaseHook
            
            mock_save.return_value = True
            hook = BaseHook()
            
            event_data = {
                "event_type": "test",
                "session_id": "test-123",
                "timestamp": "2025-08-18T10:00:00Z",
                "data": {"test": "data"}
            }
            
            result = hook.save_event(event_data)
            self.assertTrue(result)
            mock_save.assert_called_once()
            
        except ImportError as e:
            # Skip if not yet consolidated
            self.skipTest(f"Consolidation not yet complete: {e}")


if __name__ == '__main__':
    # Run pre-merge tests first
    print("Running pre-consolidation validation tests...")
    pre_suite = unittest.TestLoader().loadTestsFromTestCase(TestConsolidationPreMerge)
    pre_runner = unittest.TextTestRunner(verbosity=2)
    pre_result = pre_runner.run(pre_suite)
    
    if not pre_result.wasSuccessful():
        print("Pre-consolidation tests failed! Cannot proceed safely.")
        sys.exit(1)
    
    print("\nPre-consolidation tests passed! Ready for consolidation.")
    
    # Note: Post-merge tests should be run after consolidation is complete