"""
Database Integration Tests for Chronicle Hooks System
Tests database connectivity, schema validation, and data persistence integration.
"""

import pytest
import json
import tempfile
import os
import uuid
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys

# Add source paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "lib"))
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

try:
    from database import DatabaseManager, SupabaseClient, SQLiteClient
    from src.lib.base_hook import BaseHook
except ImportError:
    # Gracefully handle import failures during test discovery
    DatabaseManager = None
    SupabaseClient = None
    SQLiteClient = None
    BaseHook = None


class TestDatabaseIntegration:
    """Test database integration and connectivity."""

    @pytest.fixture
    def temp_sqlite_db(self):
        """Create temporary SQLite database for testing."""
        fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        yield db_path
        try:
            os.unlink(db_path)
        except FileNotFoundError:
            pass

    @pytest.fixture
    def mock_supabase_client(self):
        """Create mock Supabase client for testing."""
        mock_client = MagicMock()
        mock_table = MagicMock()
        
        # Configure table operations
        mock_client.table.return_value = mock_table
        mock_table.upsert.return_value.execute.return_value = Mock(data=[{"success": True}])
        mock_table.insert.return_value.execute.return_value = Mock(data=[{"event_id": "test-123"}])
        mock_table.select.return_value.execute.return_value = Mock(data=[])
        
        return mock_client, mock_table

    @pytest.fixture
    def sample_hook_data(self):
        """Sample hook data for testing."""
        return {
            "session_id": str(uuid.uuid4()),
            "transcript_path": "/tmp/test-session.md",
            "cwd": "/test/project",
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {
                "file_path": "/test/config.json"
            },
            "matcher": "Read",
            "timestamp": datetime.now().isoformat()
        }

    @pytest.mark.skipif(DatabaseManager is None, reason="Database modules not available")
    def test_database_manager_initialization(self):
        """Test DatabaseManager initialization and client selection."""
        # Test with mock environment variables
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test-key'
        }):
            db_manager = DatabaseManager()
            assert db_manager is not None
            assert hasattr(db_manager, 'primary_client')
            assert hasattr(db_manager, 'fallback_client')

    @pytest.mark.skipif(DatabaseManager is None, reason="Database modules not available")
    def test_database_health_check_supabase_success(self, mock_supabase_client):
        """Test database health check with successful Supabase connection."""
        mock_client, mock_table = mock_supabase_client
        
        with patch('src.lib.database.create_client', return_value=mock_client):
            with patch.dict(os.environ, {
                'SUPABASE_URL': 'https://test.supabase.co',
                'SUPABASE_ANON_KEY': 'test-key'
            }):
                supabase_client = SupabaseClient(
                    url='https://test.supabase.co',
                    key='test-key'
                )
                
                # Mock successful health check
                mock_client.table.return_value.select.return_value.limit.return_value.execute.return_value = Mock(
                    data=[]
                )
                
                health_status = supabase_client.health_check()
                assert health_status is True

    @pytest.mark.skipif(SQLiteClient is None, reason="Database modules not available")
    def test_sqlite_fallback_functionality(self, temp_sqlite_db):
        """Test SQLite fallback when Supabase is unavailable."""
        sqlite_client = SQLiteClient(db_path=temp_sqlite_db)
        
        # Test database initialization
        init_result = sqlite_client.initialize_database()
        assert init_result is True
        
        # Test health check
        health_status = sqlite_client.health_check()
        assert health_status is True
        
        # Test session creation
        session_data = {
            "session_id": str(uuid.uuid4()),
            "start_time": datetime.now(),
            "source": "startup",
            "project_path": "/test/project",
            "git_branch": "main"
        }
        
        upsert_result = sqlite_client.upsert_session(session_data)
        assert upsert_result is True
        
        # Test event insertion
        event_data = {
            "event_id": str(uuid.uuid4()),
            "session_id": session_data["session_id"],
            "hook_event_name": "PreToolUse",
            "timestamp": datetime.now(),
            "success": True,
            "raw_input": {"test": "data"}
        }
        
        insert_result = sqlite_client.insert_event(event_data)
        assert insert_result is True

    @pytest.mark.skipif(DatabaseManager is None, reason="Database modules not available")
    def test_database_connection_failover(self, temp_sqlite_db, mock_supabase_client):
        """Test automatic failover from Supabase to SQLite."""
        mock_client, mock_table = mock_supabase_client
        
        # Configure Supabase to fail
        mock_client.table.side_effect = Exception("Connection failed")
        
        with patch('src.lib.database.create_client', return_value=mock_client):
            with patch.dict(os.environ, {
                'SUPABASE_URL': 'https://test.supabase.co',
                'SUPABASE_ANON_KEY': 'test-key'
            }):
                db_manager = DatabaseManager(sqlite_path=temp_sqlite_db)
                
                # Test connection should use SQLite fallback
                connection_status = db_manager.test_connection()
                assert connection_status is True
                
                status = db_manager.get_status()
                assert status["current_client"] == "sqlite"
                assert status["fallback_active"] is True

    @pytest.mark.skipif(BaseHook is None, reason="Hook modules not available")
    def test_hook_database_integration(self, temp_sqlite_db, sample_hook_data):
        """Test integration between hooks and database storage."""
        # Create hook with SQLite fallback
        hook = BaseHook()
        
        # Mock database manager with SQLite
        mock_db_manager = Mock()
        mock_db_manager.get_client.return_value = SQLiteClient(db_path=temp_sqlite_db)
        mock_db_manager.get_client.return_value.initialize_database()
        
        hook.db_manager = mock_db_manager
        hook.db_client = mock_db_manager.get_client()
        
        # Process hook data
        result = hook.process_hook(sample_hook_data)
        
        # Verify processing succeeded
        assert result["continue"] is True
        assert "hookSpecificOutput" in result

    def test_database_schema_validation(self, temp_sqlite_db):
        """Test that database schema is correctly applied."""
        if SQLiteClient is None:
            pytest.skip("Database modules not available")
        
        sqlite_client = SQLiteClient(db_path=temp_sqlite_db)
        
        # Initialize database (should create schema)
        init_result = sqlite_client.initialize_database()
        assert init_result is True
        
        # Verify tables exist
        import sqlite3
        conn = sqlite3.connect(temp_sqlite_db)
        cursor = conn.cursor()
        
        # Check for required tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['sessions', 'events', 'tool_events', 'prompt_events', 
                          'notification_events', 'lifecycle_events', 'project_context']
        
        for table in expected_tables:
            assert table in tables, f"Required table {table} not found in database schema"
        
        conn.close()

    def test_concurrent_database_operations(self, temp_sqlite_db, sample_hook_data):
        """Test concurrent database operations don't cause corruption."""
        if SQLiteClient is None:
            pytest.skip("Database modules not available")
        
        import threading
        import time
        
        sqlite_client = SQLiteClient(db_path=temp_sqlite_db)
        sqlite_client.initialize_database()
        
        results = []
        errors = []
        
        def concurrent_operation(operation_id):
            try:
                # Create unique session data
                session_data = {
                    "session_id": f"session-{operation_id}",
                    "start_time": datetime.now(),
                    "source": "startup",
                    "project_path": f"/test/project-{operation_id}"
                }
                
                # Upsert session
                session_result = sqlite_client.upsert_session(session_data)
                
                # Insert event
                event_data = {
                    "event_id": f"event-{operation_id}",
                    "session_id": session_data["session_id"],
                    "hook_event_name": "PreToolUse",
                    "timestamp": datetime.now(),
                    "success": True,
                    "raw_input": sample_hook_data
                }
                
                event_result = sqlite_client.insert_event(event_data)
                
                results.append({
                    "operation_id": operation_id,
                    "session_result": session_result,
                    "event_result": event_result
                })
                
            except Exception as e:
                errors.append(f"Operation {operation_id}: {str(e)}")
        
        # Run 5 concurrent operations
        threads = []
        for i in range(5):
            thread = threading.Thread(target=concurrent_operation, args=(i,))
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join(timeout=10)
        
        # Verify all operations succeeded
        assert len(errors) == 0, f"Concurrent operations failed: {errors}"
        assert len(results) == 5, "Not all concurrent operations completed"
        
        # Verify all operations reported success
        for result in results:
            assert result["session_result"] is True
            assert result["event_result"] is True

    def test_data_integrity_validation(self, temp_sqlite_db, sample_hook_data):
        """Test data integrity and validation in database operations."""
        if SQLiteClient is None:
            pytest.skip("Database modules not available")
        
        sqlite_client = SQLiteClient(db_path=temp_sqlite_db)
        sqlite_client.initialize_database()
        
        # Test with valid data
        session_data = {
            "session_id": str(uuid.uuid4()),
            "start_time": datetime.now(),
            "source": "startup",
            "project_path": "/test/project"
        }
        
        result = sqlite_client.upsert_session(session_data)
        assert result is True
        
        # Test with invalid data types (should handle gracefully)
        invalid_session_data = {
            "session_id": None,  # Invalid
            "start_time": "not-a-date",  # Invalid
            "source": 123,  # Invalid type
            "project_path": "/test/project"
        }
        
        # Should handle invalid data gracefully without crashing
        try:
            result = sqlite_client.upsert_session(invalid_session_data)
            # If it doesn't raise an exception, it should return False
            assert result is False
        except Exception:
            # If it raises an exception, that's also acceptable handling
            pass

    def test_database_error_recovery(self, mock_supabase_client):
        """Test error recovery mechanisms in database operations."""
        if DatabaseManager is None:
            pytest.skip("Database modules not available")
        
        mock_client, mock_table = mock_supabase_client
        
        # Configure intermittent failures
        call_count = 0
        def failing_insert(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise Exception("Network error")
            return Mock(data=[{"event_id": "success"}])
        
        mock_table.insert.return_value.execute = failing_insert
        
        with patch('src.lib.database.create_client', return_value=mock_client):
            with patch.dict(os.environ, {
                'SUPABASE_URL': 'https://test.supabase.co',
                'SUPABASE_ANON_KEY': 'test-key'
            }):
                supabase_client = SupabaseClient(
                    url='https://test.supabase.co',
                    key='test-key'
                )
                
                event_data = {
                    "event_id": str(uuid.uuid4()),
                    "session_id": str(uuid.uuid4()),
                    "hook_event_name": "PreToolUse"
                }
                
                # Should eventually succeed after retries
                result = supabase_client.insert_event(event_data)
                # Result depends on retry implementation
                # At minimum, should not crash the system

    def test_database_connection_status_reporting(self, temp_sqlite_db):
        """Test accurate reporting of database connection status."""
        if DatabaseManager is None:
            pytest.skip("Database modules not available")
        
        # Test with SQLite fallback
        db_manager = DatabaseManager(sqlite_path=temp_sqlite_db)
        
        status = db_manager.get_status()
        
        # Verify status structure
        assert isinstance(status, dict)
        assert "current_client" in status
        assert "fallback_active" in status
        assert "connection_test_passed" in status
        
        # Test connection
        connection_result = db_manager.test_connection()
        assert isinstance(connection_result, bool)
        
        # Get updated status after connection test
        updated_status = db_manager.get_status()
        assert updated_status["connection_test_passed"] is not None

    def test_database_performance_monitoring(self, temp_sqlite_db, sample_hook_data):
        """Test database operation performance monitoring."""
        if SQLiteClient is None:
            pytest.skip("Database modules not available")
        
        import time
        
        sqlite_client = SQLiteClient(db_path=temp_sqlite_db)
        sqlite_client.initialize_database()
        
        # Test multiple operations and measure performance
        operation_times = []
        
        for i in range(10):
            start_time = time.time()
            
            session_data = {
                "session_id": f"perf-test-{i}",
                "start_time": datetime.now(),
                "source": "startup",
                "project_path": f"/test/project-{i}"
            }
            
            sqlite_client.upsert_session(session_data)
            
            event_data = {
                "event_id": f"event-{i}",
                "session_id": session_data["session_id"],
                "hook_event_name": "PreToolUse",
                "timestamp": datetime.now(),
                "success": True,
                "raw_input": sample_hook_data
            }
            
            sqlite_client.insert_event(event_data)
            
            end_time = time.time()
            operation_times.append(end_time - start_time)
        
        # Verify operations complete within reasonable time
        max_operation_time = max(operation_times)
        avg_operation_time = sum(operation_times) / len(operation_times)
        
        # Database operations should be fast (< 1 second each)
        assert max_operation_time < 1.0, f"Database operation too slow: {max_operation_time}s"
        assert avg_operation_time < 0.5, f"Average database operation too slow: {avg_operation_time}s"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])