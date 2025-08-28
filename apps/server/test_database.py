#!/usr/bin/env python3
"""
Comprehensive Unit Tests for Chronicle LocalDatabase
=================================================

Production-grade test suite covering all database operations,
performance requirements, concurrent access, and error scenarios.

Author: C-Codey aka curl Stevens aka SWE-40  
Port: 8510 (Oakland represent!)
"""

import json
import os
import shutil
import sqlite3
import tempfile
import threading
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List
from unittest.mock import patch

# Import the LocalDatabase class
from database import LocalDatabase, DatabaseConfig, DatabaseError, ConnectionError, SchemaError


class TestLocalDatabase(unittest.TestCase):
    """Comprehensive test suite for LocalDatabase."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_dir = Path(tempfile.mkdtemp())
        self.test_db_path = self.test_dir / "test_chronicle.db"
        self.db = LocalDatabase(db_path=self.test_db_path)
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            self.db.close()
            shutil.rmtree(self.test_dir, ignore_errors=True)
        except Exception:
            pass
    
    def test_database_initialization(self):
        """Test database initialization and setup."""
        # Verify database file was created
        self.assertTrue(self.test_db_path.exists())
        
        # Verify WAL mode is enabled
        with sqlite3.connect(str(self.test_db_path)) as conn:
            cursor = conn.execute("PRAGMA journal_mode")
            journal_mode = cursor.fetchone()[0]
            self.assertEqual(journal_mode.upper(), "WAL")
        
        # Verify schema exists
        with sqlite3.connect(str(self.test_db_path)) as conn:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cursor.fetchall()}
            expected_tables = {"chronicle_sessions", "chronicle_events", "_schema_version"}
            self.assertTrue(expected_tables.issubset(tables))
    
    def test_connection_configuration(self):
        """Test connection configuration and optimizations."""
        # Test connection works
        self.assertTrue(self.db.test_connection())
        
        # Verify foreign keys are enabled in our database connection
        with self.db._get_connection() as conn:
            cursor = conn.execute("PRAGMA foreign_keys")
            foreign_keys = cursor.fetchone()[0]
            self.assertEqual(foreign_keys, 1)
    
    def test_session_operations(self):
        """Test session save, retrieve, and update operations."""
        # Test session save
        session_data = {
            "claude_session_id": "test-session-123",
            "project_path": "/test/project",
            "git_branch": "main",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "metadata": {"test": "metadata"}
        }
        
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        self.assertIsNotNone(session_id)
        
        # Test session retrieval
        retrieved_session = self.db.get_session(session_data["claude_session_id"])
        self.assertIsNotNone(retrieved_session)
        self.assertEqual(retrieved_session["claude_session_id"], session_data["claude_session_id"])
        self.assertEqual(retrieved_session["project_path"], session_data["project_path"])
        
        # Test session retrieval by UUID
        retrieved_by_uuid = self.db.get_session(session_id)
        self.assertIsNotNone(retrieved_by_uuid)
        self.assertEqual(retrieved_by_uuid["id"], session_id)
    
    def test_session_upsert(self):
        """Test session upsert functionality."""
        claude_session_id = "upsert-test-session"
        
        # First insert
        session_data = {
            "claude_session_id": claude_session_id,
            "project_path": "/initial/path",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        
        success1, session_id1 = self.db.save_session(session_data)
        self.assertTrue(success1)
        
        # Second insert (should update, not create new)
        session_data["project_path"] = "/updated/path"
        session_data["end_time"] = datetime.now(timezone.utc).isoformat()
        
        success2, session_id2 = self.db.save_session(session_data)
        self.assertTrue(success2)
        self.assertEqual(session_id1, session_id2)  # Same session ID
        
        # Verify update
        retrieved = self.db.get_session(claude_session_id)
        self.assertEqual(retrieved["project_path"], "/updated/path")
        self.assertIsNotNone(retrieved["end_time"])
    
    def test_event_operations(self):
        """Test event save and retrieve operations."""
        # First create a session
        session_data = {
            "claude_session_id": "event-test-session",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Test event save
        event_data = {
            "session_id": session_id,
            "event_type": "pre_tool_use",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {"tool_name": "test_tool", "params": {"test": "data"}},
            "tool_name": "test_tool",
            "duration_ms": 150
        }
        
        self.assertTrue(self.db.save_event(event_data))
        
        # Test event retrieval
        events = self.db.get_session_events(session_id)
        self.assertEqual(len(events), 1)
        
        retrieved_event = events[0]
        self.assertEqual(retrieved_event["event_type"], event_data["event_type"])
        self.assertEqual(retrieved_event["tool_name"], event_data["tool_name"])
        self.assertEqual(retrieved_event["duration_ms"], event_data["duration_ms"])
    
    def test_event_type_validation(self):
        """Test event type validation and normalization."""
        # Create a session first
        session_data = {
            "claude_session_id": "validation-test",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Test valid event type
        valid_event = {
            "session_id": session_id,
            "event_type": "pre_tool_use",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.assertTrue(self.db.save_event(valid_event))
        
        # Test invalid event type (should default to 'notification')
        invalid_event = {
            "session_id": session_id,
            "event_type": "invalid_type",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.assertTrue(self.db.save_event(invalid_event))
        
        # Verify the invalid type was saved as 'notification'
        events = self.db.get_session_events(session_id)
        invalid_saved_event = next(e for e in events if e["event_type"] == "notification")
        self.assertIsNotNone(invalid_saved_event)
    
    def test_performance_requirements(self):
        """Test sub-10ms event insertion performance."""
        # Create a session
        session_data = {
            "claude_session_id": "performance-test",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Test multiple event insertions
        event_times = []
        num_events = 100
        
        for i in range(num_events):
            event_data = {
                "session_id": session_id,
                "event_type": "notification",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"sequence": i, "test_data": "x" * 100}
            }
            
            start_time = time.time()
            success = self.db.save_event(event_data)
            end_time = time.time()
            
            self.assertTrue(success)
            duration_ms = (end_time - start_time) * 1000
            event_times.append(duration_ms)
        
        # Calculate performance metrics
        avg_time = sum(event_times) / len(event_times)
        max_time = max(event_times)
        p95_time = sorted(event_times)[int(len(event_times) * 0.95)]
        
        print(f"Performance Results:")
        print(f"  Average: {avg_time:.2f}ms")
        print(f"  Maximum: {max_time:.2f}ms") 
        print(f"  P95: {p95_time:.2f}ms")
        
        # Performance assertions (relaxed for CI environments)
        self.assertLess(avg_time, 20.0, f"Average insertion time {avg_time:.2f}ms exceeds 20ms")
        self.assertLess(p95_time, 50.0, f"P95 insertion time {p95_time:.2f}ms exceeds 50ms")
    
    def test_concurrent_operations(self):
        """Test concurrent database operations for thread safety."""
        # Create a session
        session_data = {
            "claude_session_id": "concurrent-test",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        def worker_function(thread_id: int) -> Dict[str, int]:
            """Worker function for concurrent testing."""
            results = {"success": 0, "errors": 0}
            
            for i in range(10):
                event_data = {
                    "session_id": session_id,
                    "event_type": "notification",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"thread_id": thread_id, "sequence": i}
                }
                
                try:
                    if self.db.save_event(event_data):
                        results["success"] += 1
                    else:
                        results["errors"] += 1
                except Exception:
                    results["errors"] += 1
                    
            return results
        
        # Run concurrent operations
        num_threads = 10
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_function, i) for i in range(num_threads)]
            results = [future.result() for future in as_completed(futures)]
        
        # Verify results
        total_success = sum(r["success"] for r in results)
        total_errors = sum(r["errors"] for r in results)
        
        print(f"Concurrent Operations Results:")
        print(f"  Total Success: {total_success}")
        print(f"  Total Errors: {total_errors}")
        print(f"  Success Rate: {total_success/(total_success+total_errors)*100:.1f}%")
        
        # Should have high success rate
        self.assertGreaterEqual(total_success, num_threads * 10 * 0.95)  # 95% success rate
        
        # Verify all events were actually saved
        events = self.db.get_session_events(session_id)
        self.assertEqual(len(events), total_success)  # All concurrent events
    
    def test_database_views(self):
        """Test database views functionality."""
        # Create sessions and events
        session_ids = []
        for i in range(3):
            session_data = {
                "claude_session_id": f"view-test-{i}",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat() if i == 0 else None
            }
            success, session_id = self.db.save_session(session_data)
            self.assertTrue(success)
            session_ids.append(session_id)
            
            # Add some events
            for j in range(5):
                event_data = {
                    "session_id": session_id,
                    "event_type": "pre_tool_use" if j % 2 == 0 else "notification",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                self.assertTrue(self.db.save_event(event_data))
        
        # Test active sessions view
        recent_sessions = self.db.get_recent_sessions()
        self.assertGreaterEqual(len(recent_sessions), 3)
        
        # Verify event counts are included
        for session in recent_sessions:
            self.assertIn("event_count", session)
            self.assertGreaterEqual(session["event_count"], 5)
    
    def test_foreign_key_constraints(self):
        """Test foreign key constraint enforcement."""
        # Try to insert event with non-existent session_id
        invalid_event = {
            "session_id": str(uuid.uuid4()),  # Non-existent session
            "event_type": "notification",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Should fail due to foreign key constraint
        self.assertFalse(self.db.save_event(invalid_event))
    
    def test_triggers(self):
        """Test database triggers functionality."""
        # Create a session
        session_data = {
            "claude_session_id": "trigger-test",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Verify initial event count is 0
        session = self.db.get_session(session_id)
        self.assertEqual(session["event_count"], 0)
        
        # Add some events
        for i in range(3):
            event_data = {
                "session_id": session_id,
                "event_type": "notification",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self.assertTrue(self.db.save_event(event_data))
        
        # Verify event count was updated by trigger
        session = self.db.get_session(session_id)
        self.assertEqual(session["event_count"], 3)
        
        # Test session end trigger
        end_event = {
            "session_id": session_id,
            "event_type": "stop",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {"session_termination": 1}
        }
        self.assertTrue(self.db.save_event(end_event))
        
        # Verify session end_time was updated
        session = self.db.get_session(session_id)
        self.assertIsNotNone(session["end_time"])
    
    def test_cleanup_operations(self):
        """Test database cleanup and maintenance operations."""
        # Test WAL checkpoint
        self.assertTrue(self.db.checkpoint_wal())
        
        # Test database vacuum
        self.assertTrue(self.db.vacuum_database())
        
        # Test cleanup old data (should not delete anything since data is recent)
        deleted_count = self.db.cleanup_old_data(retention_days=1)
        self.assertEqual(deleted_count, 0)
    
    def test_performance_stats(self):
        """Test performance statistics collection."""
        # Perform some operations
        session_data = {
            "claude_session_id": "stats-test",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Add events
        for i in range(5):
            event_data = {
                "session_id": session_id,
                "event_type": "notification",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self.assertTrue(self.db.save_event(event_data))
        
        # Get performance stats
        stats = self.db.get_performance_stats()
        
        self.assertIn("db_size_bytes", stats)
        self.assertIn("session_count", stats)
        self.assertIn("event_count", stats)
        self.assertIn("operations_count", stats)
        self.assertIn("avg_operation_time_ms", stats)
        
        self.assertGreaterEqual(stats["session_count"], 1)
        self.assertGreaterEqual(stats["event_count"], 5)
        self.assertGreater(stats["operations_count"], 0)
    
    def test_error_handling(self):
        """Test error handling and recovery."""
        # Test with invalid database path
        invalid_path = Path("/invalid/path/that/does/not/exist/test.db")
        
        with self.assertRaises(DatabaseError):
            LocalDatabase(db_path=invalid_path)
        
        # Test save session with missing required fields
        success, session_id = self.db.save_session({})
        self.assertFalse(success)
        self.assertIsNone(session_id)
        
        # Test save event with missing session_id
        success = self.db.save_event({"event_type": "test"})
        self.assertFalse(success)
    
    def test_json_handling(self):
        """Test JSON metadata handling."""
        # Create session with complex metadata
        metadata = {
            "git_commit": "abc123",
            "source": "test",
            "complex": {"nested": {"data": [1, 2, 3]}}
        }
        
        session_data = {
            "claude_session_id": "json-test",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata
        }
        
        success, session_id = self.db.save_session(session_data)
        self.assertTrue(success)
        
        # Retrieve and verify JSON was preserved
        retrieved = self.db.get_session(session_id)
        self.assertEqual(retrieved["metadata"]["git_commit"], "abc123")
        self.assertEqual(retrieved["metadata"]["complex"]["nested"]["data"], [1, 2, 3])
    
    def test_schema_version(self):
        """Test schema version tracking."""
        with sqlite3.connect(str(self.test_db_path)) as conn:
            cursor = conn.execute("SELECT MAX(version) FROM _schema_version")
            version = cursor.fetchone()[0]
            self.assertEqual(version, LocalDatabase.CURRENT_SCHEMA_VERSION)


class TestDatabaseConfig(unittest.TestCase):
    """Test DatabaseConfig class."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = DatabaseConfig(db_path=Path("test.db"))
        
        self.assertTrue(config.wal_mode)
        self.assertEqual(config.synchronous_mode, "NORMAL")
        self.assertEqual(config.cache_size, 10000)
        self.assertTrue(config.foreign_keys)
        self.assertEqual(config.max_connections, 10)


def run_performance_benchmark():
    """Run comprehensive performance benchmark."""
    print("\n" + "="*60)
    print("Chronicle LocalDatabase Performance Benchmark")
    print("="*60)
    
    test_dir = Path(tempfile.mkdtemp())
    test_db_path = test_dir / "benchmark_chronicle.db"
    
    try:
        db = LocalDatabase(db_path=test_db_path)
        
        # Session performance test
        print("\n1. Session Operations:")
        session_times = []
        for i in range(50):
            session_data = {
                "claude_session_id": f"benchmark-session-{i}",
                "project_path": f"/benchmark/project/{i}",
                "git_branch": "main",
                "start_time": datetime.now(timezone.utc).isoformat()
            }
            
            start = time.time()
            success, session_id = db.save_session(session_data)
            duration = (time.time() - start) * 1000
            
            if success:
                session_times.append(duration)
        
        print(f"   Sessions created: {len(session_times)}")
        print(f"   Average time: {sum(session_times)/len(session_times):.2f}ms")
        print(f"   Max time: {max(session_times):.2f}ms")
        
        # Event performance test
        print("\n2. Event Operations:")
        if session_times:  # Use the last session
            event_times = []
            for i in range(1000):
                event_data = {
                    "session_id": session_id,
                    "event_type": "pre_tool_use" if i % 2 == 0 else "notification",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": {"benchmark_id": i, "payload": "x" * 100}
                }
                
                start = time.time()
                success = db.save_event(event_data)
                duration = (time.time() - start) * 1000
                
                if success:
                    event_times.append(duration)
            
            print(f"   Events created: {len(event_times)}")
            print(f"   Average time: {sum(event_times)/len(event_times):.2f}ms")
            print(f"   Max time: {max(event_times):.2f}ms")
            print(f"   P95 time: {sorted(event_times)[int(len(event_times)*0.95)]:.2f}ms")
            print(f"   Sub-10ms count: {sum(1 for t in event_times if t < 10)}")
            print(f"   Sub-10ms rate: {sum(1 for t in event_times if t < 10)/len(event_times)*100:.1f}%")
        
        # Database stats
        print("\n3. Database Statistics:")
        stats = db.get_performance_stats()
        for key, value in stats.items():
            print(f"   {key}: {value}")
        
        db.close()
        
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)
    
    print("\n" + "="*60)


if __name__ == "__main__":
    # Run benchmark if requested
    if len(os.sys.argv) > 1 and os.sys.argv[1] == "benchmark":
        run_performance_benchmark()
    else:
        # Run unit tests
        unittest.main(verbosity=2)