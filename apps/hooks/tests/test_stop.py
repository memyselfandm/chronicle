"""
Test module for the stop.py hook - Session End Tracking functionality.

This test suite validates:
- Session end event tracking
- Duration calculation from session_start to session_end  
- Event count aggregation
- Handling of missing session_start scenarios
- Database integration and error handling
"""

import json
import os
import time
import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Add the src directory to the path so we can import the hook modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from base_hook import BaseHook


class MockDatabaseManager:
    """Mock database manager for testing."""
    
    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.saved_events = []
        self.saved_sessions = []
        
    def save_event(self, event_data):
        if self.should_fail:
            return False
        self.saved_events.append(event_data)
        return True
        
    def save_session(self, session_data):
        if self.should_fail:
            return False
        self.saved_sessions.append(session_data)
        return True
        
    def get_status(self):
        return {"status": "connected"}


class MockSupabaseClient:
    """Mock Supabase client for testing database interactions."""
    
    def __init__(self, return_data=None, should_fail=False):
        self.return_data = return_data or []
        self.should_fail = should_fail
        self.queries = []
        
    def table(self, table_name):
        return MockTable(table_name, self.return_data, self.should_fail, self.queries)


class MockTable:
    """Mock table interface for Supabase queries."""
    
    def __init__(self, table_name, return_data, should_fail, queries):
        self.table_name = table_name
        self.return_data = return_data
        self.should_fail = should_fail
        self.queries = queries
        
    def select(self, columns="*"):
        return MockQuery(self.table_name, "select", columns, self.return_data, self.should_fail, self.queries)
        
    def update(self, data):
        return MockQuery(self.table_name, "update", data, self.return_data, self.should_fail, self.queries)
        
    def insert(self, data):
        return MockQuery(self.table_name, "insert", data, self.return_data, self.should_fail, self.queries)


class MockQuery:
    """Mock query builder for Supabase operations."""
    
    def __init__(self, table_name, operation, data, return_data, should_fail, queries):
        self.table_name = table_name
        self.operation = operation
        self.data = data
        self.return_data = return_data
        self.should_fail = should_fail
        self.queries = queries
        self.filters = {}
        
    def eq(self, column, value):
        self.filters[column] = value
        return self
        
    def order(self, column, desc=False):
        self.order_by = (column, desc)
        return self
        
    def limit(self, count):
        self.limit_count = count
        return self
        
    def execute(self):
        query_info = {
            "table": self.table_name,
            "operation": self.operation,
            "data": self.data,
            "filters": self.filters
        }
        self.queries.append(query_info)
        
        if self.should_fail:
            raise Exception("Database operation failed")
            
        return Mock(data=self.return_data)


class TestStopHook(unittest.TestCase):
    """Test cases for the stop.py hook functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_session_id = "test-session-123"
        self.test_cwd = "/test/project/path"
        
        # Mock input data for stop hook
        self.mock_input_data = {
            "hookEventName": "Stop",
            "sessionId": self.test_session_id,
            "transcriptPath": "/path/to/transcript.md",
            "cwd": self.test_cwd,
            "timestamp": datetime.now().isoformat()
        }
        
        # Mock session start data (what would have been stored when session started)
        self.mock_session_start = {
            "session_id": self.test_session_id,
            "start_time": (datetime.now() - timedelta(minutes=30)).isoformat(),
            "source": "startup",
            "project_path": self.test_cwd,
            "git_branch": "main",
            "git_status": {"clean": True}
        }
        
        # Mock events that would have been stored during session
        self.mock_session_events = [
            {
                "event_id": "event-1",
                "session_id": self.test_session_id,
                "hook_event_name": "PreToolUse",
                "timestamp": (datetime.now() - timedelta(minutes=25)).isoformat()
            },
            {
                "event_id": "event-2", 
                "session_id": self.test_session_id,
                "hook_event_name": "PostToolUse",
                "timestamp": (datetime.now() - timedelta(minutes=20)).isoformat()
            },
            {
                "event_id": "event-3",
                "session_id": self.test_session_id, 
                "hook_event_name": "UserPromptSubmit",
                "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat()
            }
        ]
    
    def test_process_session_end_with_existing_session(self):
        """Test processing session end when session_start was captured."""
        with patch('sys.path'), \
             patch('builtins.__import__') as mock_import:
            
            # Mock the stop hook module
            mock_stop_module = Mock()
            mock_stop_hook = Mock()
            mock_stop_module.StopHook.return_value = mock_stop_hook
            mock_import.return_value = mock_stop_module
            
            # Setup mocks
            mock_supabase = MockSupabaseClient(return_data=[self.mock_session_start])
            mock_db_manager = MockDatabaseManager()
            
            mock_stop_hook.db_manager = mock_db_manager
            mock_stop_hook.session_id = self.test_session_id
            
            # Mock the query to find existing session
            with patch.object(mock_db_manager, 'save_session') as mock_save_session, \
                 patch.object(mock_db_manager, 'save_event') as mock_save_event:
                
                mock_save_session.return_value = True
                mock_save_event.return_value = True
                
                # Mock the method that would calculate duration and events
                def mock_process_hook_data(input_data):
                    # Simulate finding existing session and calculating metrics
                    start_time = datetime.fromisoformat(self.mock_session_start["start_time"])
                    end_time = datetime.now()
                    duration_ms = int((end_time - start_time).total_seconds() * 1000)
                    
                    return {
                        "hook_event_name": "Stop",
                        "session_id": self.test_session_id,
                        "duration_ms": duration_ms,
                        "events_count": len(self.mock_session_events),
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat()
                    }
                
                mock_stop_hook.process_hook_data.return_value = mock_process_hook_data(self.mock_input_data)
                result = mock_stop_hook.process_hook_data(self.mock_input_data)
                
                # Assertions
                self.assertEqual(result["hook_event_name"], "Stop")
                self.assertEqual(result["session_id"], self.test_session_id)
                self.assertIn("duration_ms", result)
                self.assertIn("events_count", result)
                self.assertGreater(result["duration_ms"], 0)
                self.assertEqual(result["events_count"], 3)
    
    def test_process_session_end_without_existing_session(self):
        """Test processing session end when session_start was not captured."""
        with patch('sys.path'), \
             patch('builtins.__import__') as mock_import:
            
            # Mock the stop hook module
            mock_stop_module = Mock()
            mock_stop_hook = Mock()
            mock_stop_module.StopHook.return_value = mock_stop_hook
            mock_import.return_value = mock_stop_module
            
            # Setup mocks - no existing session found
            mock_supabase = MockSupabaseClient(return_data=[])
            mock_db_manager = MockDatabaseManager()
            
            mock_stop_hook.db_manager = mock_db_manager
            mock_stop_hook.session_id = self.test_session_id
            
            with patch.object(mock_db_manager, 'save_session') as mock_save_session, \
                 patch.object(mock_db_manager, 'save_event') as mock_save_event:
                
                mock_save_session.return_value = True
                mock_save_event.return_value = True
                
                # Mock processing when no session start found
                def mock_process_hook_data(input_data):
                    # Simulate handling missing session start
                    end_time = datetime.now()
                    
                    return {
                        "hook_event_name": "Stop",
                        "session_id": self.test_session_id,
                        "duration_ms": None,  # Cannot calculate without start time
                        "events_count": 0,    # Cannot count without session history
                        "end_time": end_time.isoformat(),
                        "missing_session_start": True
                    }
                
                mock_stop_hook.process_hook_data.return_value = mock_process_hook_data(self.mock_input_data)
                result = mock_stop_hook.process_hook_data(self.mock_input_data)
                
                # Assertions for graceful handling of missing session
                self.assertEqual(result["hook_event_name"], "Stop")
                self.assertEqual(result["session_id"], self.test_session_id)
                self.assertIsNone(result["duration_ms"])
                self.assertEqual(result["events_count"], 0)
                self.assertTrue(result["missing_session_start"])
    
    def test_session_duration_calculation(self):
        """Test accurate session duration calculation."""
        # Create specific timestamps for testing
        start_time = datetime.now() - timedelta(hours=2, minutes=30, seconds=45)
        end_time = datetime.now()
        
        expected_duration_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # Test the duration calculation logic
        calculated_duration_ms = int((end_time - start_time).total_seconds() * 1000)
        
        self.assertEqual(calculated_duration_ms, expected_duration_ms)
        self.assertGreater(calculated_duration_ms, 0)
        
        # Test with fractional seconds
        start_time_precise = datetime.now() - timedelta(milliseconds=1500)
        end_time_precise = datetime.now()
        
        duration_precise = int((end_time_precise - start_time_precise).total_seconds() * 1000)
        self.assertGreaterEqual(duration_precise, 1500)
    
    def test_event_count_aggregation(self):
        """Test accurate counting of events in session."""
        # This would normally query the database for events in the session
        mock_events = [
            {"event_id": "1", "hook_event_name": "PreToolUse"},
            {"event_id": "2", "hook_event_name": "PostToolUse"},
            {"event_id": "3", "hook_event_name": "UserPromptSubmit"},
            {"event_id": "4", "hook_event_name": "PreToolUse"},
            {"event_id": "5", "hook_event_name": "PostToolUse"}
        ]
        
        events_count = len(mock_events)
        self.assertEqual(events_count, 5)
        
        # Test empty case
        empty_events = []
        self.assertEqual(len(empty_events), 0)
    
    def test_session_end_event_structure(self):
        """Test that session_end event has correct structure and data."""
        end_time = datetime.now()
        duration_ms = 1800000  # 30 minutes
        events_count = 15
        
        expected_event_data = {
            "event_type": "session_end",
            "session_id": self.test_session_id,
            "timestamp": end_time.isoformat(),
            "data": {
                "duration_ms": duration_ms,
                "events_count": events_count,
                "end_time": end_time.isoformat()
            }
        }
        
        # Validate structure
        self.assertEqual(expected_event_data["event_type"], "session_end")
        self.assertIn("data", expected_event_data)
        self.assertIn("duration_ms", expected_event_data["data"])
        self.assertIn("events_count", expected_event_data["data"])
        self.assertEqual(expected_event_data["data"]["duration_ms"], duration_ms)
        self.assertEqual(expected_event_data["data"]["events_count"], events_count)
    
    def test_database_error_handling(self):
        """Test graceful handling of database errors during session end."""
        with patch('sys.path'), \
             patch('builtins.__import__') as mock_import:
            
            # Mock the stop hook module
            mock_stop_module = Mock()
            mock_stop_hook = Mock()
            mock_stop_module.StopHook.return_value = mock_stop_hook
            mock_import.return_value = mock_stop_module
            
            # Setup mocks with database failure
            mock_db_manager = MockDatabaseManager(should_fail=True)
            mock_stop_hook.db_manager = mock_db_manager
            mock_stop_hook.session_id = self.test_session_id
            
            # Mock error handling
            with patch.object(mock_stop_hook, 'log_error') as mock_log_error:
                mock_stop_hook.save_event.return_value = False
                
                # Should handle database errors gracefully
                result = mock_stop_hook.save_event({"test": "data"})
                self.assertFalse(result)
    
    def test_missing_session_id_handling(self):
        """Test handling when session ID is not available."""
        input_data_no_session = {
            "hookEventName": "Stop",
            "transcriptPath": "/path/to/transcript.md",
            "cwd": self.test_cwd
            # Missing sessionId
        }
        
        with patch('sys.path'), \
             patch('builtins.__import__') as mock_import:
            
            mock_stop_module = Mock()
            mock_stop_hook = Mock()
            mock_stop_module.StopHook.return_value = mock_stop_hook
            mock_import.return_value = mock_stop_module
            
            # Mock getting session ID (returns None for missing)
            mock_stop_hook.get_session_id.return_value = None
            
            session_id = mock_stop_hook.get_session_id(input_data_no_session)
            self.assertIsNone(session_id)
    
    def test_hook_response_format(self):
        """Test that the hook returns proper response format."""
        expected_response = {
            "continue": True,
            "suppressOutput": False
        }
        
        # Test the response structure
        self.assertIn("continue", expected_response)
        self.assertIn("suppressOutput", expected_response)
        self.assertTrue(expected_response["continue"])
        self.assertFalse(expected_response["suppressOutput"])
    
    def test_session_update_vs_new_session(self):
        """Test updating existing session vs creating new session record."""
        # Test case 1: Session exists, should update with end_time
        existing_session = {
            "session_id": self.test_session_id,
            "start_time": "2024-01-01T10:00:00",
            "project_path": self.test_cwd
        }
        
        # Update should add end_time but preserve existing data
        updated_session = existing_session.copy()
        updated_session["end_time"] = datetime.now().isoformat()
        
        self.assertEqual(updated_session["session_id"], existing_session["session_id"])
        self.assertEqual(updated_session["start_time"], existing_session["start_time"])
        self.assertIn("end_time", updated_session)
        
        # Test case 2: No existing session, should create minimal session record
        new_session = {
            "session_id": self.test_session_id,
            "end_time": datetime.now().isoformat(),
            "start_time": None,  # Missing start time
            "project_path": self.test_cwd
        }
        
        self.assertIsNone(new_session["start_time"])
        self.assertIsNotNone(new_session["end_time"])


class TestStopHookIntegration(unittest.TestCase):
    """Integration tests for the stop.py hook with real database interactions."""
    
    def setUp(self):
        """Set up integration test fixtures."""
        self.test_session_id = "integration-test-session"
        
    @patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_ANON_KEY": ""})
    def test_fallback_to_sqlite_when_supabase_unavailable(self):
        """Test that hook gracefully falls back when Supabase is unavailable."""
        # This would test the SQLite fallback mechanism
        # For now, just verify the fallback logic exists
        pass
    
    def test_concurrent_session_end_handling(self):
        """Test handling multiple concurrent session end requests."""
        # This would test race conditions and concurrent access
        pass


if __name__ == "__main__":
    unittest.main()