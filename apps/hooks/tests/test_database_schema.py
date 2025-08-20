"""
Test suite for Chronicle database schema implementation.

Tests cover:
- Database connection and setup
- Sessions table structure and operations
- Events table structure and operations  
- Foreign key relationships
- Indexes and constraints
- Row Level Security policies
"""

import pytest
import pytest_asyncio
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

# Import our database implementation
from config.database import DatabaseManager, DatabaseError
from config.models import Session, Event


class TestDatabaseSchema:
    """Test database schema structure and basic operations."""
    
    @pytest_asyncio.fixture
    async def db_manager(self):
        """Setup test database manager with SQLite fallback."""
        manager = DatabaseManager(
            supabase_config=None,  # Use SQLite for testing
            sqlite_path=":memory:"  # In-memory database for tests
        )
        await manager.initialize()
        yield manager
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_database_initialization(self, db_manager):
        """Test that database initializes successfully."""
        assert db_manager.current_client is not None
        assert db_manager.current_client.client_type == "sqlite"
        
        # Health check should pass
        is_healthy = await db_manager.current_client.health_check()
        assert is_healthy is True
    
    @pytest.mark.asyncio
    async def test_sessions_table_structure(self, db_manager):
        """Test sessions table has correct structure."""
        # Get table schema
        tables = await db_manager.current_client.execute_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
        )
        assert len(tables) == 1
        
        # Check columns exist
        columns = await db_manager.current_client.execute_query(
            "PRAGMA table_info(sessions)"
        )
        
        column_names = [col['name'] for col in columns]
        expected_columns = [
            'id', 'claude_session_id', 'project_path', 'git_branch',
            'start_time', 'end_time', 'created_at'
        ]
        
        for col in expected_columns:
            assert col in column_names, f"Column {col} missing from sessions table"
    
    @pytest.mark.asyncio
    async def test_events_table_structure(self, db_manager):
        """Test events table has correct structure."""
        # Get table schema
        tables = await db_manager.current_client.execute_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='events'"
        )
        assert len(tables) == 1
        
        # Check columns exist
        columns = await db_manager.current_client.execute_query(
            "PRAGMA table_info(events)"
        )
        
        column_names = [col['name'] for col in columns]
        expected_columns = [
            'id', 'session_id', 'event_type', 'timestamp', 'data',
            'tool_name', 'duration_ms', 'created_at'
        ]
        
        for col in expected_columns:
            assert col in column_names, f"Column {col} missing from events table"
    
    @pytest.mark.asyncio
    async def test_foreign_key_relationship(self, db_manager):
        """Test foreign key relationship between sessions and events."""
        # Check foreign key constraints
        foreign_keys = await db_manager.current_client.execute_query(
            "PRAGMA foreign_key_list(events)"
        )
        
        assert len(foreign_keys) > 0, "No foreign keys found on events table"
        
        # Find the session_id foreign key
        session_fk = next((fk for fk in foreign_keys if fk['from'] == 'session_id'), None)
        assert session_fk is not None, "session_id foreign key not found"
        assert session_fk['table'] == 'sessions', "Foreign key doesn't reference sessions table"
    
    @pytest.mark.asyncio
    async def test_required_indexes_exist(self, db_manager):
        """Test that required indexes exist for performance."""
        # Get all indexes
        indexes = await db_manager.current_client.execute_query(
            "SELECT name, tbl_name FROM sqlite_master WHERE type='index'"
        )
        
        index_names = [idx['name'] for idx in indexes]
        
        # Check for required indexes
        expected_indexes = [
            'idx_events_session_timestamp',  # Composite index on (session_id, timestamp)
            'idx_events_session_id',         # Session lookup
            'idx_events_timestamp',          # Time-based queries
        ]
        
        for idx_name in expected_indexes:
            assert any(idx_name in name for name in index_names), f"Index {idx_name} not found"


class TestSessionOperations:
    """Test session CRUD operations."""
    
    @pytest_asyncio.fixture
    async def db_manager(self):
        """Setup test database manager."""
        manager = DatabaseManager(
            supabase_config=None,
            sqlite_path=":memory:"
        )
        await manager.initialize()
        yield manager
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_create_session(self, db_manager):
        """Test creating a new session."""
        session_data = {
            'claude_session_id': 'test-session-123',
            'project_path': '/test/project',
            'git_branch': 'main',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        
        session_id = await db_manager.insert('sessions', session_data)
        assert session_id is not None
        assert isinstance(session_id, str)
    
    @pytest.mark.asyncio
    async def test_unique_claude_session_id(self, db_manager):
        """Test that claude_session_id is unique."""
        session_data = {
            'claude_session_id': 'unique-session-123',
            'project_path': '/test/project',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        
        # Insert first session
        session_id1 = await db_manager.insert('sessions', session_data)
        assert session_id1 is not None
        
        # Try to insert duplicate (should fail or be handled gracefully)
        with pytest.raises((DatabaseError, Exception)):
            await db_manager.insert('sessions', session_data)
    
    @pytest.mark.asyncio
    async def test_update_session_end_time(self, db_manager):
        """Test updating session with end time."""
        # Create session
        session_data = {
            'claude_session_id': 'session-to-update',
            'project_path': '/test/project',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        
        session_id = await db_manager.insert('sessions', session_data)
        
        # Update with end time
        end_time = datetime.now(timezone.utc).isoformat()
        updated = await db_manager.update('sessions', session_id, {
            'end_time': end_time
        })
        
        assert updated is True
        
        # Verify update
        sessions = await db_manager.select('sessions', {'id': session_id})
        assert len(sessions) == 1
        assert sessions[0]['end_time'] == end_time
    
    @pytest.mark.asyncio
    async def test_retrieve_sessions(self, db_manager):
        """Test retrieving sessions with filters."""
        # Create multiple sessions
        sessions_data = [
            {
                'claude_session_id': f'session-{i}',
                'project_path': f'/test/project-{i}',
                'git_branch': 'main' if i % 2 == 0 else 'develop',
                'start_time': datetime.now(timezone.utc).isoformat(),
            }
            for i in range(3)
        ]
        
        session_ids = []
        for session in sessions_data:
            session_id = await db_manager.insert('sessions', session)
            session_ids.append(session_id)
        
        # Test retrieve all
        all_sessions = await db_manager.select('sessions')
        assert len(all_sessions) >= 3
        
        # Test filter by git_branch
        main_sessions = await db_manager.select('sessions', {'git_branch': 'main'})
        assert len(main_sessions) >= 1


class TestEventOperations:
    """Test event CRUD operations."""
    
    @pytest_asyncio.fixture
    async def db_manager_with_session(self):
        """Setup database with a test session."""
        manager = DatabaseManager(
            supabase_config=None,
            sqlite_path=":memory:"
        )
        await manager.initialize()
        
        # Create a test session
        session_data = {
            'claude_session_id': 'test-event-session',
            'project_path': '/test/project',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        session_id = await manager.insert('sessions', session_data)
        
        yield manager, session_id
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_create_tool_event(self, db_manager_with_session):
        """Test creating a tool use event."""
        db_manager, session_id = db_manager_with_session
        
        event_data = {
            'session_id': session_id,
            'event_type': 'tool_use',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {
                'tool_input': {'command': 'ls -la'},
                'tool_output': 'file1.txt\nfile2.txt',
                'status': 'success'
            },
            'tool_name': 'Bash',
            'duration_ms': 250,
        }
        
        event_id = await db_manager.insert('events', event_data)
        assert event_id is not None
    
    @pytest.mark.asyncio
    async def test_create_prompt_event(self, db_manager_with_session):
        """Test creating a user prompt event."""
        db_manager, session_id = db_manager_with_session
        
        event_data = {
            'session_id': session_id,
            'event_type': 'prompt',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {
                'prompt_text': 'Help me write a Python function',
                'context': 'user_request'
            },
        }
        
        event_id = await db_manager.insert('events', event_data)
        assert event_id is not None
    
    @pytest.mark.asyncio
    async def test_create_session_lifecycle_event(self, db_manager_with_session):
        """Test creating session start/end events."""
        db_manager, session_id = db_manager_with_session
        
        # Session start event
        start_event = {
            'session_id': session_id,
            'event_type': 'session_start',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {
                'trigger': 'startup',
                'project_context': {'git_branch': 'main'}
            },
        }
        
        event_id = await db_manager.insert('events', start_event)
        assert event_id is not None
    
    @pytest.mark.asyncio
    async def test_bulk_event_insertion(self, db_manager_with_session):
        """Test inserting multiple events at once."""
        db_manager, session_id = db_manager_with_session
        
        events_data = [
            {
                'session_id': session_id,
                'event_type': 'tool_use',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': {'tool': f'tool_{i}'},
                'tool_name': f'Tool{i}',
            }
            for i in range(5)
        ]
        
        event_ids = await db_manager.bulk_insert('events', events_data)
        assert len(event_ids) == 5
        assert all(isinstance(eid, str) for eid in event_ids)
    
    @pytest.mark.asyncio
    async def test_query_events_by_session(self, db_manager_with_session):
        """Test querying events for a specific session."""
        db_manager, session_id = db_manager_with_session
        
        # Create events
        events_data = [
            {
                'session_id': session_id,
                'event_type': 'tool_use',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': {'index': i},
                'tool_name': 'TestTool',
            }
            for i in range(3)
        ]
        
        await db_manager.bulk_insert('events', events_data)
        
        # Query events for session
        session_events = await db_manager.select('events', {'session_id': session_id})
        assert len(session_events) >= 3
        
        # All events should belong to our session
        for event in session_events:
            assert event['session_id'] == session_id
    
    @pytest.mark.asyncio
    async def test_query_events_by_type(self, db_manager_with_session):
        """Test querying events by type."""
        db_manager, session_id = db_manager_with_session
        
        # Create different event types
        event_types = ['tool_use', 'prompt', 'session_start']
        for event_type in event_types:
            event_data = {
                'session_id': session_id,
                'event_type': event_type,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': {'type': event_type},
            }
            await db_manager.insert('events', event_data)
        
        # Query tool_use events
        tool_events = await db_manager.select('events', {'event_type': 'tool_use'})
        assert len(tool_events) >= 1
        assert all(event['event_type'] == 'tool_use' for event in tool_events)
    
    @pytest.mark.asyncio
    async def test_event_ordering_by_timestamp(self, db_manager_with_session):
        """Test that events are ordered by timestamp descending."""
        db_manager, session_id = db_manager_with_session
        
        # Create events with different timestamps
        base_time = datetime.now(timezone.utc)
        events_data = []
        for i in range(3):
            timestamp = base_time.replace(microsecond=i * 1000).isoformat()
            events_data.append({
                'session_id': session_id,
                'event_type': 'test',
                'timestamp': timestamp,
                'data': {'order': i},
            })
        
        await db_manager.bulk_insert('events', events_data)
        
        # Query events - should be ordered by timestamp DESC
        events = await db_manager.select('events', {'session_id': session_id})
        
        # Verify ordering (most recent first)
        if len(events) >= 3:
            timestamps = [event['timestamp'] for event in events[:3]]
            assert timestamps == sorted(timestamps, reverse=True)


class TestDataIntegrity:
    """Test data integrity constraints and edge cases."""
    
    @pytest_asyncio.fixture
    async def db_manager(self):
        """Setup test database manager."""
        manager = DatabaseManager(
            supabase_config=None,
            sqlite_path=":memory:"
        )
        await manager.initialize()
        yield manager
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_foreign_key_constraint_enforcement(self, db_manager):
        """Test that foreign key constraints are enforced."""
        # Try to create event with non-existent session_id
        event_data = {
            'session_id': 'non-existent-session-id',
            'event_type': 'test',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {'test': True},
        }
        
        # This should fail due to foreign key constraint
        with pytest.raises((DatabaseError, Exception)):
            await db_manager.insert('events', event_data)
    
    @pytest.mark.asyncio
    async def test_cascading_delete(self, db_manager):
        """Test that deleting a session cascades to events."""
        # Create session
        session_data = {
            'claude_session_id': 'cascade-test-session',
            'project_path': '/test',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        session_id = await db_manager.insert('sessions', session_data)
        
        # Create events for this session
        events_data = [
            {
                'session_id': session_id,
                'event_type': 'test',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': {'index': i},
            }
            for i in range(2)
        ]
        await db_manager.bulk_insert('events', events_data)
        
        # Verify events exist
        events_before = await db_manager.select('events', {'session_id': session_id})
        assert len(events_before) == 2
        
        # Delete session
        deleted = await db_manager.delete('sessions', session_id)
        assert deleted is True
        
        # Verify events are gone (cascading delete)
        events_after = await db_manager.select('events', {'session_id': session_id})
        assert len(events_after) == 0
    
    @pytest.mark.asyncio
    async def test_json_data_handling(self, db_manager):
        """Test that JSON data fields are handled correctly."""
        # Create session
        session_data = {
            'claude_session_id': 'json-test-session',
            'project_path': '/test',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        session_id = await db_manager.insert('sessions', session_data)
        
        # Create event with complex JSON data
        complex_data = {
            'nested': {
                'array': [1, 2, 3],
                'object': {'key': 'value'},
                'null_value': None,
                'boolean': True,
            },
            'unicode': 'héllo wörld 🌍',
            'numbers': [1.5, -42, 1e10],
        }
        
        event_data = {
            'session_id': session_id,
            'event_type': 'test',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': complex_data,
        }
        
        event_id = await db_manager.insert('events', event_data)
        assert event_id is not None
        
        # Retrieve and verify JSON data integrity
        events = await db_manager.select('events', {'id': event_id})
        assert len(events) == 1
        
        retrieved_data = events[0]['data']
        assert retrieved_data == complex_data
    
    @pytest.mark.asyncio
    async def test_large_data_handling(self, db_manager):
        """Test handling of large data payloads."""
        # Create session
        session_data = {
            'claude_session_id': 'large-data-session',
            'project_path': '/test',
            'start_time': datetime.now(timezone.utc).isoformat(),
        }
        session_id = await db_manager.insert('sessions', session_data)
        
        # Create event with large data payload
        large_text = 'x' * 10000  # 10KB of text
        event_data = {
            'session_id': session_id,
            'event_type': 'large_data_test',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'data': {
                'large_field': large_text,
                'metadata': {'size': len(large_text)}
            },
        }
        
        event_id = await db_manager.insert('events', event_data)
        assert event_id is not None
        
        # Retrieve and verify
        events = await db_manager.select('events', {'id': event_id})
        assert len(events) == 1
        assert len(events[0]['data']['large_field']) == 10000


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])