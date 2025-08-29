"""
Comprehensive tests for Chronicle backend modes (local, supabase, auto).
"""

import json
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch
import pytest

# Import the components we're testing
from src.lib.database import (
    DatabaseManager, LocalAPIBackend, SupabaseBackend, BackendInterface,
    get_database_config, validate_and_fix_session_id, ensure_valid_uuid
)


class TestLocalAPIBackend:
    """Test LocalAPIBackend functionality."""
    
    def setup_method(self):
        """Set up test environment."""
        self.base_url = "http://localhost:8510"
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', True)
    @patch('requests.Session')
    def test_init_with_requests_available(self, mock_session_class):
        """Test LocalAPIBackend initialization when requests is available."""
        mock_session = Mock()
        mock_session_class.return_value = mock_session
        
        backend = LocalAPIBackend(self.base_url, timeout=15)
        
        assert backend.base_url == self.base_url
        assert backend.timeout == 15
        assert backend.session == mock_session
        mock_session_class.assert_called_once()
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', False)
    def test_init_without_requests(self):
        """Test LocalAPIBackend initialization when requests is not available."""
        backend = LocalAPIBackend(self.base_url)
        
        assert backend.base_url == self.base_url
        assert backend.session is None
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', True)
    @patch('requests.Session')
    def test_health_check_success(self, mock_session_class):
        """Test successful health check."""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_session.get.return_value = mock_response
        mock_session_class.return_value = mock_session
        
        backend = LocalAPIBackend(self.base_url)
        
        assert backend.health_check() is True
        mock_session.get.assert_called_once_with(f"{self.base_url}/health", timeout=5)
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', True)
    @patch('requests.Session')
    def test_health_check_failure(self, mock_session_class):
        """Test failed health check."""
        mock_session = Mock()
        mock_session.get.side_effect = Exception("Connection failed")
        mock_session_class.return_value = mock_session
        
        backend = LocalAPIBackend(self.base_url)
        
        assert backend.health_check() is False
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', True)
    @patch('requests.Session')
    def test_save_session_success(self, mock_session_class):
        """Test successful session save."""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": "test-uuid-123"}
        mock_session.post.return_value = mock_response
        mock_session_class.return_value = mock_session
        
        backend = LocalAPIBackend(self.base_url)
        session_data = {
            "claude_session_id": "test-session-123",
            "start_time": datetime.now().isoformat(),
            "project_path": "/test/path"
        }
        
        success, session_uuid = backend.save_session(session_data)
        
        assert success is True
        assert session_uuid == "test-uuid-123"
        mock_session.post.assert_called_once()
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', True)
    @patch('requests.Session')
    def test_save_event_success(self, mock_session_class):
        """Test successful event save."""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_session.post.return_value = mock_response
        mock_session_class.return_value = mock_session
        
        backend = LocalAPIBackend(self.base_url)
        event_data = {
            "session_id": "test-session-uuid",
            "event_type": "prompt",
            "timestamp": datetime.now().isoformat(),
            "data": {"test": "data"}
        }
        
        success = backend.save_event(event_data)
        
        assert success is True
        mock_session.post.assert_called_once()
        
    @patch('src.lib.database.REQUESTS_AVAILABLE', False)
    def test_operations_without_requests(self):
        """Test that operations fail gracefully without requests library."""
        backend = LocalAPIBackend(self.base_url)
        
        assert backend.health_check() is False
        
        success, uuid = backend.save_session({"claude_session_id": "test"})
        assert success is False
        assert uuid is None
        
        assert backend.save_event({"session_id": "test", "event_type": "test"}) is False
        
        assert backend.get_session("test") is None


class TestSupabaseBackend:
    """Test SupabaseBackend functionality."""
    
    def setup_method(self):
        """Set up test environment."""
        self.mock_client = Mock()
        
    def test_init(self):
        """Test SupabaseBackend initialization."""
        backend = SupabaseBackend(self.mock_client)
        
        assert backend.client == self.mock_client
        assert backend.SESSIONS_TABLE == "chronicle_sessions"
        assert backend.EVENTS_TABLE == "chronicle_events"
        
    def test_health_check_success(self):
        """Test successful health check."""
        mock_table = Mock()
        mock_table.select.return_value.limit.return_value.execute.return_value = Mock()
        self.mock_client.table.return_value = mock_table
        
        backend = SupabaseBackend(self.mock_client)
        
        assert backend.health_check() is True
        self.mock_client.table.assert_called_once_with("chronicle_sessions")
        
    def test_health_check_failure(self):
        """Test failed health check."""
        self.mock_client.table.side_effect = Exception("Connection failed")
        
        backend = SupabaseBackend(self.mock_client)
        
        assert backend.health_check() is False
        
    def test_save_session_new(self):
        """Test saving a new session."""
        # Mock existing session check (no existing session)
        mock_select = Mock()
        mock_select.eq.return_value.execute.return_value.data = []
        mock_table = Mock()
        mock_table.select.return_value = mock_select
        mock_table.upsert.return_value.execute.return_value = Mock()
        self.mock_client.table.return_value = mock_table
        
        backend = SupabaseBackend(self.mock_client)
        session_data = {
            "claude_session_id": "test-session-123",
            "start_time": datetime.now().isoformat(),
            "project_path": "/test/path"
        }
        
        success, session_uuid = backend.save_session(session_data)
        
        assert success is True
        assert session_uuid is not None
        mock_table.upsert.assert_called_once()


class TestDatabaseManagerModes:
    """Test DatabaseManager with different backend modes."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.test_db_path = Path(self.temp_dir) / "test_chronicle.db"
        
    def teardown_method(self):
        """Clean up test environment."""
        if self.test_db_path.exists():
            self.test_db_path.unlink()
            
    def test_local_mode_initialization(self):
        """Test DatabaseManager initialization in local mode."""
        config = {
            'backend_mode': 'local',
            'local_api_url': 'http://localhost:8510',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_backend:
            mock_instance = Mock()
            mock_instance.health_check.return_value = True
            mock_backend.return_value = mock_instance
            
            manager = DatabaseManager(config)
            
            assert manager.mode == 'local'
            assert isinstance(manager.backend, Mock)  # Our mocked LocalAPIBackend
            mock_backend.assert_called_once_with(base_url='http://localhost:8510', timeout=5)
            
    def test_supabase_mode_initialization(self):
        """Test DatabaseManager initialization in supabase mode."""
        config = {
            'backend_mode': 'supabase',
            'supabase_url': 'https://test.supabase.co',
            'supabase_key': 'test-key',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client') as mock_create, \
             patch('src.lib.database.SupabaseBackend') as mock_backend:
            
            mock_client = Mock()
            mock_create.return_value = mock_client
            mock_instance = Mock()
            mock_instance.health_check.return_value = True
            mock_backend.return_value = mock_instance
            
            manager = DatabaseManager(config)
            
            assert manager.mode == 'supabase'
            mock_create.assert_called_once_with('https://test.supabase.co', 'test-key')
            mock_backend.assert_called_once_with(mock_client)
            
    def test_auto_mode_prefers_local(self):
        """Test that auto mode prefers local backend when available."""
        config = {
            'backend_mode': 'auto',
            'local_api_url': 'http://localhost:8510',
            'supabase_url': 'https://test.supabase.co',
            'supabase_key': 'test-key',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_local_backend, \
             patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client'), \
             patch('src.lib.database.SupabaseBackend'):
            
            # Make local backend available
            mock_local_instance = Mock()
            mock_local_instance.health_check.return_value = True
            mock_local_backend.return_value = mock_local_instance
            
            manager = DatabaseManager(config)
            
            assert manager.mode == 'auto'
            assert isinstance(manager.backend, Mock)  # Should be local backend
            
    def test_auto_mode_falls_back_to_supabase(self):
        """Test that auto mode falls back to Supabase when local is not available."""
        config = {
            'backend_mode': 'auto',
            'local_api_url': 'http://localhost:8510',
            'supabase_url': 'https://test.supabase.co',
            'supabase_key': 'test-key',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_local_backend, \
             patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client') as mock_create, \
             patch('src.lib.database.SupabaseBackend') as mock_supabase_backend:
            
            # Make local backend unavailable
            mock_local_instance = Mock()
            mock_local_instance.health_check.return_value = False
            mock_local_backend.return_value = mock_local_instance
            
            # Make Supabase backend available
            mock_client = Mock()
            mock_create.return_value = mock_client
            mock_supabase_instance = Mock()
            mock_supabase_instance.health_check.return_value = True
            mock_supabase_backend.return_value = mock_supabase_instance
            
            manager = DatabaseManager(config)
            
            assert manager.mode == 'auto'
            # Should fall back to Supabase
            mock_supabase_backend.assert_called_once()
            
    def test_save_session_with_backend(self):
        """Test session save using backend with SQLite fallback."""
        config = {
            'backend_mode': 'local',
            'local_api_url': 'http://localhost:8510',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_backend_class:
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend.save_session.return_value = (True, "test-uuid-123")
            mock_backend_class.return_value = mock_backend
            
            manager = DatabaseManager(config)
            session_data = {
                "claude_session_id": "test-session",
                "start_time": datetime.now().isoformat()
            }
            
            success, session_uuid = manager.save_session(session_data)
            
            assert success is True
            assert session_uuid == "test-uuid-123"
            mock_backend.save_session.assert_called_once_with(session_data)
            
    def test_save_session_fallback_to_sqlite(self):
        """Test session save falls back to SQLite when backend fails."""
        config = {
            'backend_mode': 'local',
            'local_api_url': 'http://localhost:8510',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_backend_class:
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend.save_session.return_value = (False, None)  # Backend fails
            mock_backend_class.return_value = mock_backend
            
            manager = DatabaseManager(config)
            session_data = {
                "claude_session_id": "test-session",
                "start_time": datetime.now().isoformat()
            }
            
            success, session_uuid = manager.save_session(session_data)
            
            assert success is True  # Should succeed via SQLite fallback
            assert session_uuid is not None
            
    def test_get_status_with_backend(self):
        """Test get_status method with active backend."""
        config = {
            'backend_mode': 'local',
            'local_api_url': 'http://localhost:8510',
            'sqlite_path': str(self.test_db_path),
            'db_timeout': 5
        }
        
        with patch('src.lib.database.LocalAPIBackend') as mock_backend_class:
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend.base_url = 'http://localhost:8510'
            mock_backend_class.return_value = mock_backend
            
            manager = DatabaseManager(config)
            status = manager.get_status()
            
            assert status['mode'] == 'local'
            assert status['primary_backend'] == 'Mock'
            assert status['primary_backend_healthy'] is True
            assert status['local_api_url'] == 'http://localhost:8510'
            assert 'sqlite_path' in status


class TestBackwardCompatibility:
    """Test that existing Supabase setups continue to work."""
    
    def test_existing_supabase_config_still_works(self):
        """Test that existing Supabase environment variables still work."""
        test_config = {
            'supabase_url': 'https://test.supabase.co',
            'supabase_key': 'test-key',
            'sqlite_path': '/tmp/test.db',
            'backend_mode': 'auto'  # Should auto-detect Supabase
        }
        
        with patch('src.lib.database.SUPABASE_AVAILABLE', True), \
             patch('src.lib.database.create_client') as mock_create, \
             patch('src.lib.database.SupabaseBackend') as mock_backend_class, \
             patch('src.lib.database.LocalAPIBackend') as mock_local_class:
            
            # Make local unavailable, Supabase available
            mock_local = Mock()
            mock_local.health_check.return_value = False
            mock_local_class.return_value = mock_local
            
            mock_client = Mock()
            mock_create.return_value = mock_client
            mock_backend = Mock()
            mock_backend.health_check.return_value = True
            mock_backend_class.return_value = mock_backend
            
            manager = DatabaseManager(test_config)
            
            # Should initialize Supabase backend
            assert manager.backend is not None
            assert manager.SESSIONS_TABLE == "chronicle_sessions"
            assert manager.EVENTS_TABLE == "chronicle_events"
            
    def test_no_backend_mode_defaults_to_auto(self):
        """Test that missing backend_mode defaults to 'auto'."""
        config = get_database_config()
        
        # Should default to 'auto' when CHRONICLE_BACKEND_MODE is not set
        assert config.get('backend_mode', 'auto') == 'auto'


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])