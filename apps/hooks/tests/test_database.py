"""Tests for database client wrapper."""

import pytest
from unittest.mock import Mock, patch, MagicMock
import uuid
from datetime import datetime


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    mock_client = Mock()
    mock_table = Mock()
    mock_client.table.return_value = mock_table
    return mock_client, mock_table


@pytest.fixture
def sample_session_data():
    """Sample session data for testing."""
    return {
        "session_id": str(uuid.uuid4()),
        "start_time": datetime.now().isoformat(),
        "source": "startup",
        "project_path": "/test/project",
        "git_branch": "main"
    }


@pytest.fixture
def sample_event_data():
    """Sample event data for testing."""
    return {
        "session_id": str(uuid.uuid4()),
        "hook_event_name": "PreToolUse",
        "timestamp": datetime.now().isoformat(),
        "success": True,
        "raw_input": {"tool_name": "Read", "parameters": {}}
    }


def test_database_init_with_supabase_config():
    """Test database initialization with Supabase configuration."""
    from src.core.database import SupabaseClient
    
    with patch('src.database.create_client') as mock_create:
        with patch('src.database.SUPABASE_AVAILABLE', True):
            mock_create.return_value = Mock()
            
            client = SupabaseClient(
                url="https://test.supabase.co",
                key="test-key"
            )
            
            assert client.supabase_url == "https://test.supabase.co"
            assert client.supabase_key == "test-key"
            mock_create.assert_called_once()


def test_database_init_missing_credentials():
    """Test database initialization without credentials."""
    from src.core.database import SupabaseClient
    
    client = SupabaseClient()
    
    assert client.supabase_url is None
    assert client.supabase_key is None
    assert client._supabase_client is None


def test_connection_health_check_success(mock_supabase):
    """Test successful connection health check."""
    from src.core.database import SupabaseClient
    
    mock_client, mock_table = mock_supabase
    mock_table.select.return_value.limit.return_value.execute.return_value = Mock(data=[])
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            
            is_healthy = client.health_check()
            
            assert is_healthy is True


def test_connection_health_check_failure(mock_supabase):
    """Test failed connection health check."""
    from src.core.database import SupabaseClient
    
    mock_client, mock_table = mock_supabase
    mock_table.select.return_value.limit.return_value.execute.side_effect = Exception("Connection failed")
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            
            is_healthy = client.health_check()
            
            assert is_healthy is False


def test_upsert_session_success(mock_supabase, sample_session_data):
    """Test successful session upsert."""
    from src.core.database import SupabaseClient
    
    mock_client, mock_table = mock_supabase
    mock_table.upsert.return_value.execute.return_value = Mock(data=[sample_session_data])
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            
            result = client.upsert_session(sample_session_data)
            
            assert result is True
            mock_table.upsert.assert_called_once_with(sample_session_data)


def test_upsert_session_failure(mock_supabase, sample_session_data):
    """Test failed session upsert."""
    from src.core.database import SupabaseClient
    
    mock_client, mock_table = mock_supabase
    mock_table.upsert.return_value.execute.side_effect = Exception("Database error")
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            
            result = client.upsert_session(sample_session_data)
            
            assert result is False


def test_insert_event_success(mock_supabase, sample_event_data):
    """Test successful event insertion."""
    from src.core.database import SupabaseClient
    
    mock_client, mock_table = mock_supabase
    mock_table.insert.return_value.execute.return_value = Mock(data=[sample_event_data])
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            client = SupabaseClient(url="https://test.supabase.co", key="test-key")
            
            result = client.insert_event(sample_event_data)
            
            assert result is True
            mock_table.insert.assert_called_once_with(sample_event_data)


def test_insert_event_validation_failure():
    """Test event insertion with invalid data."""
    from src.core.database import SupabaseClient
    
    client = SupabaseClient()
    
    # Test with missing required fields
    invalid_event = {"timestamp": datetime.now().isoformat()}
    
    result = client.insert_event(invalid_event)
    
    assert result is False


def test_insert_event_without_client():
    """Test event insertion without Supabase client."""
    from src.core.database import SupabaseClient
    
    client = SupabaseClient()  # No credentials
    
    result = client.insert_event({
        "session_id": str(uuid.uuid4()),
        "hook_event_name": "test",
        "timestamp": datetime.now().isoformat()
    })
    
    assert result is False


def test_retry_logic_success():
    """Test retry logic with eventual success."""
    from src.core.database import SupabaseClient
    
    mock_client = Mock()
    mock_table = Mock()
    mock_client.table.return_value = mock_table
    
    # First call fails, second succeeds
    mock_table.insert.return_value.execute.side_effect = [
        Exception("Temporary error"),
        Mock(data=[{"success": True}])
    ]
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            with patch('time.sleep'):  # Skip actual sleep in tests
                client = SupabaseClient(url="https://test.supabase.co", key="test-key")
                
                result = client.insert_event({
                    "session_id": str(uuid.uuid4()),
                    "hook_event_name": "test",
                    "timestamp": datetime.now().isoformat()
                })
                
                assert result is True
                assert mock_table.insert.return_value.execute.call_count == 2


def test_retry_logic_max_attempts():
    """Test retry logic reaches maximum attempts."""
    from src.core.database import SupabaseClient
    
    mock_client = Mock()
    mock_table = Mock()
    mock_client.table.return_value = mock_table
    mock_table.insert.return_value.execute.side_effect = Exception("Persistent error")
    
    with patch('src.database.create_client', return_value=mock_client):
        with patch('src.database.SUPABASE_AVAILABLE', True):
            with patch('time.sleep'):  # Skip actual sleep in tests
                client = SupabaseClient(url="https://test.supabase.co", key="test-key")
                
                result = client.insert_event({
                    "session_id": str(uuid.uuid4()),
                    "hook_event_name": "test",
                    "timestamp": datetime.now().isoformat()
                })
                
                assert result is False
                # Should try 3 times (initial + 2 retries)
                assert mock_table.insert.return_value.execute.call_count == 3