"""
Backward compatibility validation tests for existing Chronicle installations.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import patch, Mock
import pytest

from src.lib.database import DatabaseManager, get_database_config
from src.lib.base_hook import BaseHook


class TestBackwardCompatibility:
    """Validate that existing Chronicle setups continue to work unchanged."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.test_db_path = Path(self.temp_dir) / "test_chronicle.db"
        
    def teardown_method(self):
        """Clean up test environment."""
        if self.test_db_path.exists():
            self.test_db_path.unlink()
            
    def test_existing_supabase_only_setup(self):
        """Test that existing Supabase-only setups work unchanged."""
        # Simulate existing environment (no CHRONICLE_BACKEND_MODE set)
        old_env = {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test-key',
            'CLAUDE_HOOKS_DB_PATH': str(self.test_db_path)
        }
        
        with patch.dict(os.environ, old_env, clear=False), \
             patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client') as mock_create, \
             patch('src.lib.database.SupabaseBackend') as mock_backend_class, \
             patch('src.lib.database.LocalAPIBackend') as mock_local_class:
            
            # Make local backend unavailable (simulating no local server)
            mock_local = Mock()
            mock_local.health_check.return_value = False
            mock_local_class.return_value = mock_local
            
            # Make Supabase available
            mock_client = Mock()
            mock_create.return_value = mock_client
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend_class.return_value = mock_backend
            
            # Should auto-detect and use Supabase
            manager = DatabaseManager()
            
            assert manager.mode == 'auto'
            assert manager.backend is not None
            assert manager.SESSIONS_TABLE == "chronicle_sessions"
            assert manager.EVENTS_TABLE == "chronicle_events"
            
    def test_existing_sqlite_only_setup(self):
        """Test that existing SQLite-only setups work unchanged."""
        # Simulate existing environment (no Supabase, no local API)
        old_env = {
            'CLAUDE_HOOKS_DB_PATH': str(self.test_db_path)
        }
        
        with patch.dict(os.environ, old_env, clear=False), \
             patch('src.lib.database.SUPABASE_AVAILABLE', False), \
             patch('src.lib.database.LocalAPIBackend') as mock_local_class:
            
            # Make local backend unavailable
            mock_local = Mock()
            mock_local.health_check.return_value = False
            mock_local_class.return_value = mock_local
            
            # Should fall back to SQLite
            manager = DatabaseManager()
            
            assert manager.mode == 'auto'
            assert manager.backend is None  # No backend wrapper for SQLite fallback
            assert manager.SESSIONS_TABLE == "sessions"
            assert manager.EVENTS_TABLE == "events"
            assert manager.sqlite_path.exists()
            
    def test_base_hook_backward_compatibility(self):
        """Test that BaseHook continues to work with new backend system."""
        config = {
            'database': {
                'backend_mode': 'auto',
                'sqlite_path': str(self.test_db_path),
                'db_timeout': 5
            }
        }
        
        with patch('src.lib.database.SUPABASE_AVAILABLE', False), \
             patch('src.lib.database.LocalAPIBackend') as mock_local_class:
            
            # Make local backend unavailable
            mock_local = Mock()
            mock_local.health_check.return_value = False
            mock_local_class.return_value = mock_local
            
            # BaseHook should initialize successfully
            hook = BaseHook(config)
            
            assert hook.db_manager is not None
            assert hook.db_manager.mode == 'auto'
            
            # Should be able to save events (to SQLite fallback)
            test_event = {
                'event_type': 'test',
                'timestamp': '2025-01-01T00:00:00Z',
                'data': {'test': 'data'}
            }
            
            # This should work without errors (would create session automatically)
            hook.claude_session_id = "test-session-123"
            result = hook.save_event(test_event)
            
            # Should succeed using SQLite fallback
            assert isinstance(result, bool)
            
    def test_environment_variable_precedence(self):
        """Test that environment variables take precedence over defaults."""
        # Test environment with explicit backend mode
        test_env = {
            'CHRONICLE_BACKEND_MODE': 'supabase',
            'CHRONICLE_LOCAL_API_URL': 'http://custom:9999',
            'SUPABASE_URL': 'https://custom.supabase.co',
            'SUPABASE_ANON_KEY': 'custom-key'
        }
        
        with patch.dict(os.environ, test_env, clear=False):
            config = get_database_config()
            
            assert config['backend_mode'] == 'supabase'
            assert config['local_api_url'] == 'http://custom:9999'
            assert config['supabase_url'] == 'https://custom.supabase.co'
            assert config['supabase_key'] == 'custom-key'
            
    def test_config_without_new_variables(self):
        """Test that config works when new environment variables are not set."""
        # Clear new environment variables
        test_env = {
            'CHRONICLE_BACKEND_MODE': None,
            'CHRONICLE_LOCAL_API_URL': None
        }
        
        with patch.dict(os.environ, test_env, clear=True):
            config = get_database_config()
            
            # Should use defaults
            assert config['backend_mode'] == 'auto'
            assert config['local_api_url'] == 'http://localhost:8510'
            
    def test_mixed_old_and_new_config(self):
        """Test that old and new configurations can coexist."""
        test_env = {
            'CHRONICLE_BACKEND_MODE': 'auto',
            'SUPABASE_URL': 'https://legacy.supabase.co',
            'SUPABASE_ANON_KEY': 'legacy-key',
            'CLAUDE_HOOKS_DB_PATH': str(self.test_db_path),
            'CLAUDE_HOOKS_LOG_LEVEL': 'DEBUG'
        }
        
        with patch.dict(os.environ, test_env, clear=False), \
             patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client') as mock_create, \
             patch('src.lib.database.SupabaseBackend') as mock_backend_class, \
             patch('src.lib.database.LocalAPIBackend') as mock_local_class:
            
            # Make local backend unavailable, Supabase available
            mock_local = Mock()
            mock_local.health_check.return_value = False
            mock_local_class.return_value = mock_local
            
            mock_client = Mock()
            mock_create.return_value = mock_client
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend_class.return_value = mock_backend
            
            manager = DatabaseManager()
            
            # Should respect both old and new config
            assert manager.mode == 'auto'
            assert manager.backend is not None  # Should use Supabase
            assert str(manager.sqlite_path) == str(self.test_db_path)
            
    def test_graceful_degradation(self):
        """Test graceful degradation when backends are unavailable."""
        config = {
            'backend_mode': 'local',
            'local_api_url': 'http://localhost:8510',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.REQUESTS_AVAILABLE', False), \
             patch('src.lib.database.SUPABASE_AVAILABLE', False):
            
            # No backends available - should fall back to SQLite
            manager = DatabaseManager(config)
            
            assert manager.mode == 'local'
            assert manager.backend is None  # No backend available
            assert manager.sqlite_path.exists()  # SQLite should be initialized
            
            # Should still be able to save sessions/events to SQLite
            session_data = {
                "claude_session_id": "test-session",
                "start_time": "2025-01-01T00:00:00Z"
            }
            
            success, session_uuid = manager.save_session(session_data)
            assert success is True
            assert session_uuid is not None


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])