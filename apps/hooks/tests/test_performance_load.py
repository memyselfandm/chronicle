"""
Performance and Load Tests for Chronicle Hooks System
Tests system performance under high load and stress conditions
"""

import pytest
import asyncio
import time
import threading
import uuid
import json
import psutil
import os
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed
import tempfile

from src.database import SupabaseClient, DatabaseManager
from src.base_hook import BaseHook
from src.utils import sanitize_input_data, validate_hook_input


class MockSQLiteClient:
    """Mock SQLite client for testing purposes."""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.sessions = []
        self.events = []
        
    def initialize_database(self):
        """Mock database initialization."""
        return True
        
    def upsert_session(self, session_data):
        """Mock session upsert."""
        self.sessions.append(session_data)
        return True
        
    def insert_event(self, event_data):
        """Mock event insert."""
        self.events.append(event_data)
        return True
        
    def get_sessions(self):
        """Mock get sessions."""
        return self.sessions
        
    def get_events(self):
        """Mock get events."""
        return self.events


class TestHookPerformance:
    """Performance tests for individual hook operations."""

    @pytest.fixture
    def performance_thresholds(self):
        """Performance thresholds for hook operations."""
        return {
            "hook_execution_ms": 100,      # Max 100ms per hook execution
            "database_operation_ms": 50,   # Max 50ms per database operation
            "memory_usage_mb": 50,         # Max 50MB memory per hook process
            "concurrent_hooks": 50,        # Support 50 concurrent hooks
            "events_per_second": 100       # Process 100 events/second minimum
        }

    def test_single_hook_execution_performance(self, performance_thresholds):
        """Test performance of single hook execution."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/test/file.txt"},
            "timestamp": datetime.now().isoformat()
        }

        hook = BaseHook()
        hook.db_client = mock_client

        # Measure execution time
        start_time = time.perf_counter()
        result = hook.process_hook(hook_input)
        end_time = time.perf_counter()

        execution_time_ms = (end_time - start_time) * 1000

        print(f"Single hook execution: {execution_time_ms:.2f}ms")
        
        assert result["continue"] is True
        assert execution_time_ms < performance_thresholds["hook_execution_ms"]

    def test_database_operation_performance(self, performance_thresholds):
        """Test performance of database operations."""
        # Test with mock SQLite database
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as temp_db:
            sqlite_client = MockSQLiteClient(temp_db.name)
            sqlite_client.initialize_database()

            session_data = {
                "session_id": str(uuid.uuid4()),
                "start_time": datetime.now().isoformat(),
                "source": "startup",
                "project_path": "/test/project"
            }

            event_data = {
                "session_id": session_data["session_id"],
                "hook_event_name": "PreToolUse",
                "timestamp": datetime.now().isoformat(),
                "success": True,
                "raw_input": {"tool_name": "Read"}
            }

            # Test session upsert performance
            start_time = time.perf_counter()
            result = sqlite_client.upsert_session(session_data)
            session_time = (time.perf_counter() - start_time) * 1000

            # Test event insert performance
            start_time = time.perf_counter()
            result = sqlite_client.insert_event(event_data)
            event_time = (time.perf_counter() - start_time) * 1000

            print(f"Database operations - Session: {session_time:.2f}ms, Event: {event_time:.2f}ms")

            assert result is True
            assert session_time < performance_thresholds["database_operation_ms"]
            assert event_time < performance_thresholds["database_operation_ms"]

            # Cleanup
            os.unlink(temp_db.name)

    def test_memory_usage_performance(self, performance_thresholds):
        """Test memory usage during hook execution."""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        # Execute multiple hooks to test memory growth
        hook = BaseHook()
        hook.db_client = mock_client

        for i in range(100):
            hook_input = {
                "session_id": f"session-{i}",
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/file-{i}.txt"},
                "timestamp": datetime.now().isoformat()
            }
            hook.process_hook(hook_input)

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_growth = final_memory - initial_memory

        print(f"Memory usage - Initial: {initial_memory:.2f}MB, Final: {final_memory:.2f}MB, Growth: {memory_growth:.2f}MB")

        assert memory_growth < performance_thresholds["memory_usage_mb"]

    def test_data_processing_performance(self):
        """Test performance of data processing operations."""
        # Test sanitization performance
        large_sensitive_data = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {
                "command": f"export API_KEY=secret123 && {'echo test; ' * 100}",
                "env": {f"VAR_{i}": f"value_{i}" for i in range(100)},
                "large_data": "x" * 10000  # 10KB of data
            }
        }

        start_time = time.perf_counter()
        sanitized = sanitize_input_data(large_sensitive_data)
        sanitization_time = (time.perf_counter() - start_time) * 1000

        # Test validation performance
        start_time = time.perf_counter()
        is_valid = validate_hook_input(large_sensitive_data)
        validation_time = (time.perf_counter() - start_time) * 1000

        print(f"Data processing - Sanitization: {sanitization_time:.2f}ms, Validation: {validation_time:.2f}ms")

        assert sanitization_time < 50  # Should be very fast
        assert validation_time < 10    # Should be very fast
        assert is_valid is True


class TestConcurrentLoad:
    """Test system behavior under concurrent load."""

    @pytest.fixture
    def load_test_config(self):
        """Configuration for load testing."""
        return {
            "concurrent_users": 20,
            "events_per_user": 50,
            "test_duration_seconds": 30,
            "ramp_up_seconds": 5
        }

    def test_concurrent_hook_execution(self, load_test_config):
        """Test concurrent execution of multiple hooks."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        results = []
        errors = []
        execution_times = []

        def execute_hook_batch(user_id, events_per_user):
            """Execute a batch of hooks for a simulated user."""
            local_results = []
            local_errors = []
            local_times = []

            for event_num in range(events_per_user):
                try:
                    hook_input = {
                        "session_id": f"session-{user_id}",
                        "hook_event_name": "PreToolUse",
                        "tool_name": "Read",
                        "tool_input": {"file_path": f"/test/file-{user_id}-{event_num}.txt"},
                        "timestamp": datetime.now().isoformat()
                    }

                    hook = BaseHook()
                    hook.db_client = mock_client

                    start_time = time.perf_counter()
                    result = hook.process_hook(hook_input)
                    end_time = time.perf_counter()

                    execution_time = (end_time - start_time) * 1000
                    local_times.append(execution_time)
                    local_results.append(result)

                except Exception as e:
                    local_errors.append(f"User {user_id}, Event {event_num}: {str(e)}")

            return local_results, local_errors, local_times

        # Execute concurrent load test
        with ThreadPoolExecutor(max_workers=load_test_config["concurrent_users"]) as executor:
            start_time = time.time()

            # Submit all tasks
            futures = []
            for user_id in range(load_test_config["concurrent_users"]):
                future = executor.submit(
                    execute_hook_batch, 
                    user_id, 
                    load_test_config["events_per_user"]
                )
                futures.append(future)

            # Collect results
            for future in as_completed(futures):
                batch_results, batch_errors, batch_times = future.result()
                results.extend(batch_results)
                errors.extend(batch_errors)
                execution_times.extend(batch_times)

            end_time = time.time()

        total_duration = end_time - start_time
        total_events = len(results)
        events_per_second = total_events / total_duration
        avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0
        max_execution_time = max(execution_times) if execution_times else 0

        print(f"Concurrent Load Test Results:")
        print(f"  Total events: {total_events}")
        print(f"  Total duration: {total_duration:.2f}s")
        print(f"  Events/second: {events_per_second:.2f}")
        print(f"  Avg execution time: {avg_execution_time:.2f}ms")
        print(f"  Max execution time: {max_execution_time:.2f}ms")
        print(f"  Errors: {len(errors)}")

        # Verify performance requirements
        assert len(errors) == 0, f"Errors occurred: {errors[:5]}"  # Show first 5 errors
        assert events_per_second > 50  # Should process at least 50 events/second
        assert avg_execution_time < 200  # Average should be under 200ms
        assert max_execution_time < 1000  # No single execution over 1 second

    @pytest.mark.asyncio
    async def test_async_concurrent_execution(self):
        """Test asynchronous concurrent execution."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        async def async_hook_execution(hook_id):
            """Simulate async hook execution."""
            hook_input = {
                "session_id": f"async-session-{hook_id}",
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/async-file-{hook_id}.txt"},
                "timestamp": datetime.now().isoformat()
            }

            # Simulate async database operation
            await asyncio.sleep(0.01)  # 10ms simulated async work

            hook = BaseHook()
            hook.db_client = mock_client
            return hook.process_hook(hook_input)

        # Execute 100 async hooks concurrently
        start_time = time.time()
        tasks = [async_hook_execution(i) for i in range(100)]
        results = await asyncio.gather(*tasks)
        end_time = time.time()

        duration = end_time - start_time
        throughput = len(results) / duration

        print(f"Async execution - Duration: {duration:.2f}s, Throughput: {throughput:.2f} hooks/s")

        assert all(result["continue"] for result in results)
        assert throughput > 50  # Should handle at least 50 async hooks/second

    def test_memory_stability_under_load(self):
        """Test memory stability during extended load."""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        memory_samples = []
        
        # Run load test for extended period
        start_time = time.time()
        event_count = 0

        while time.time() - start_time < 30:  # Run for 30 seconds
            hook_input = {
                "session_id": f"stability-session-{event_count % 10}",  # Rotate sessions
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/stability-file-{event_count}.txt"},
                "timestamp": datetime.now().isoformat()
            }

            hook = BaseHook()
            hook.db_client = mock_client
            hook.process_hook(hook_input)

            event_count += 1

            # Sample memory every 100 events
            if event_count % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)

        final_memory = process.memory_info().rss / 1024 / 1024
        memory_growth = final_memory - initial_memory
        max_memory = max(memory_samples) if memory_samples else final_memory

        print(f"Memory stability test:")
        print(f"  Events processed: {event_count}")
        print(f"  Initial memory: {initial_memory:.2f}MB")
        print(f"  Final memory: {final_memory:.2f}MB")
        print(f"  Max memory: {max_memory:.2f}MB")
        print(f"  Memory growth: {memory_growth:.2f}MB")

        # Memory should not grow excessively
        assert memory_growth < 100  # Less than 100MB growth
        assert max_memory < initial_memory + 150  # Max spike less than 150MB


class TestStressScenarios:
    """Test system behavior under stress conditions."""

    def test_rapid_event_bursts(self):
        """Test handling of rapid bursts of events."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        burst_sizes = [10, 50, 100, 200]
        results = {}

        for burst_size in burst_sizes:
            hook = BaseHook()
            hook.db_client = mock_client

            start_time = time.perf_counter()
            
            # Process burst of events as fast as possible
            for i in range(burst_size):
                hook_input = {
                    "session_id": f"burst-session-{i}",
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/test/burst-file-{i}.txt"},
                    "timestamp": datetime.now().isoformat()
                }
                hook.process_hook(hook_input)

            end_time = time.perf_counter()
            duration = end_time - start_time
            events_per_second = burst_size / duration

            results[burst_size] = {
                "duration": duration,
                "events_per_second": events_per_second
            }

            print(f"Burst of {burst_size} events: {duration:.3f}s ({events_per_second:.1f} events/s)")

        # Verify system maintains good performance even with large bursts
        for burst_size, metrics in results.items():
            assert metrics["events_per_second"] > 20  # Minimum 20 events/second

    def test_large_payload_handling(self):
        """Test handling of events with very large payloads."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        payload_sizes = [1024, 10240, 102400, 1048576]  # 1KB, 10KB, 100KB, 1MB

        for size in payload_sizes:
            large_payload = "x" * size
            
            hook_input = {
                "session_id": str(uuid.uuid4()),
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/test/large_file.txt",
                    "content": large_payload
                },
                "timestamp": datetime.now().isoformat()
            }

            hook = BaseHook()
            hook.db_client = mock_client

            start_time = time.perf_counter()
            result = hook.process_hook(hook_input)
            end_time = time.perf_counter()

            processing_time = (end_time - start_time) * 1000

            print(f"Payload size {size} bytes: {processing_time:.2f}ms")

            assert result["continue"] is True
            # Processing time should scale reasonably with payload size
            assert processing_time < size / 1000 + 100  # Rough scaling heuristic

    def test_database_stress_operations(self):
        """Test database operations under stress."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as temp_db:
            sqlite_client = MockSQLiteClient(temp_db.name)
            sqlite_client.initialize_database()

            # Stress test with many rapid database operations
            session_count = 0
            event_count = 0
            
            start_time = time.time()
            
            # Insert many sessions and events rapidly
            for i in range(100):
                session_data = {
                    "session_id": f"stress-session-{i}",
                    "start_time": datetime.now().isoformat(),
                    "source": "startup",
                    "project_path": f"/test/project-{i}"
                }
                
                if sqlite_client.upsert_session(session_data):
                    session_count += 1

                # Multiple events per session
                for j in range(10):
                    event_data = {
                        "session_id": f"stress-session-{i}",
                        "hook_event_name": "PreToolUse",
                        "timestamp": datetime.now().isoformat(),
                        "success": True,
                        "raw_input": {"tool_name": f"Tool-{j}"}
                    }
                    
                    if sqlite_client.insert_event(event_data):
                        event_count += 1

            end_time = time.time()
            duration = end_time - start_time

            print(f"Database stress test:")
            print(f"  Sessions inserted: {session_count}/100")
            print(f"  Events inserted: {event_count}/1000")
            print(f"  Duration: {duration:.2f}s")
            print(f"  Operations/second: {(session_count + event_count) / duration:.1f}")

            # Verify data integrity
            sessions = sqlite_client.get_sessions()
            events = sqlite_client.get_events()

            assert len(sessions) == session_count
            assert len(events) == event_count
            assert (session_count + event_count) / duration > 50  # At least 50 ops/second

            # Cleanup
            os.unlink(temp_db.name)

    def test_resource_exhaustion_protection(self):
        """Test protection against resource exhaustion."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        # Try to create a scenario that could exhaust resources
        massive_nested_data = {}
        current_level = massive_nested_data
        
        # Create deeply nested structure
        for i in range(100):
            current_level[f"level_{i}"] = {"data": f"value_{i}", "next": {}}
            current_level = current_level[f"level_{i}"]["next"]

        hook_input = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": massive_nested_data,
            "timestamp": datetime.now().isoformat()
        }

        hook = BaseHook()
        hook.db_client = mock_client

        # Should handle excessive nesting gracefully
        start_time = time.perf_counter()
        result = hook.process_hook(hook_input)
        end_time = time.perf_counter()

        processing_time = (end_time - start_time) * 1000

        print(f"Resource exhaustion test: {processing_time:.2f}ms")

        assert result["continue"] is True
        assert processing_time < 1000  # Should not take more than 1 second


class TestRealWorldScenarios:
    """Test realistic usage scenarios."""

    def test_typical_development_session(self):
        """Simulate a typical development session with Claude Code."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        session_id = str(uuid.uuid4())
        events_processed = 0
        start_time = time.time()

        # Session start
        session_start = {
            "session_id": session_id,
            "hook_event_name": "SessionStart",
            "source": "startup",
            "project_path": "/test/my-app",
            "git_branch": "feature/new-component"
        }

        hook = BaseHook()
        hook.db_client = mock_client
        hook.process_hook(session_start)
        events_processed += 1

        # Typical development workflow
        common_operations = [
            ("Read", {"file_path": "/test/my-app/package.json"}),
            ("Read", {"file_path": "/test/my-app/src/App.tsx"}),
            ("LS", {"path": "/test/my-app/src/components"}),
            ("Read", {"file_path": "/test/my-app/src/components/Header.tsx"}),
            ("Edit", {"file_path": "/test/my-app/src/components/Header.tsx", "old_string": "old", "new_string": "new"}),
            ("Bash", {"command": "npm test"}),
            ("Read", {"file_path": "/test/my-app/src/components/Header.test.tsx"}),
            ("Write", {"file_path": "/test/my-app/src/components/NewComponent.tsx", "content": "import React from 'react';"}),
            ("Bash", {"command": "npm run build"}),
            ("Read", {"file_path": "/test/my-app/README.md"})
        ]

        # Simulate typical timing - some operations back to back, others with delays
        for i, (tool_name, tool_input) in enumerate(common_operations):
            # Pre-tool hook
            pre_hook = {
                "session_id": session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": tool_name,
                "tool_input": tool_input,
                "timestamp": datetime.now().isoformat()
            }
            hook.process_hook(pre_hook)
            events_processed += 1

            # Simulate tool execution time
            time.sleep(0.01 + (i % 3) * 0.005)  # Variable execution time

            # Post-tool hook
            post_hook = {
                "session_id": session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": tool_name,
                "tool_response": {"success": True, "result": f"Tool {tool_name} completed"},
                "timestamp": datetime.now().isoformat()
            }
            hook.process_hook(post_hook)
            events_processed += 1

            # Occasional user prompts
            if i % 4 == 0:
                prompt_hook = {
                    "session_id": session_id,
                    "hook_event_name": "UserPromptSubmit",
                    "prompt_text": f"Please help with step {i}",
                    "timestamp": datetime.now().isoformat()
                }
                hook.process_hook(prompt_hook)
                events_processed += 1

        # Session end
        session_end = {
            "session_id": session_id,
            "hook_event_name": "Stop",
            "timestamp": datetime.now().isoformat()
        }
        hook.process_hook(session_end)
        events_processed += 1

        end_time = time.time()
        total_duration = end_time - start_time
        events_per_second = events_processed / total_duration

        print(f"Development session simulation:")
        print(f"  Events processed: {events_processed}")
        print(f"  Duration: {total_duration:.2f}s")
        print(f"  Events/second: {events_per_second:.2f}")

        # Verify realistic performance
        assert events_per_second > 10  # Should handle realistic development pace
        assert total_duration < 10     # Reasonable session duration

    def test_multi_session_parallel_development(self):
        """Simulate multiple developers working simultaneously."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        def simulate_developer_session(dev_id, num_operations=20):
            """Simulate one developer's session."""
            session_id = f"dev-{dev_id}-{uuid.uuid4()}"
            hook = BaseHook()
            hook.db_client = mock_client

            results = []
            
            for op_num in range(num_operations):
                hook_input = {
                    "session_id": session_id,
                    "hook_event_name": "PreToolUse",
                    "tool_name": "Read",
                    "tool_input": {"file_path": f"/dev{dev_id}/file{op_num}.tsx"},
                    "timestamp": datetime.now().isoformat()
                }
                
                result = hook.process_hook(hook_input)
                results.append(result)
                
                # Simulate realistic development pace
                time.sleep(0.01)
            
            return results

        # Simulate 5 developers working simultaneously
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(simulate_developer_session, dev_id, 30)
                for dev_id in range(5)
            ]
            
            all_results = []
            for future in as_completed(futures):
                dev_results = future.result()
                all_results.extend(dev_results)

        end_time = time.time()
        total_duration = end_time - start_time
        total_events = len(all_results)
        events_per_second = total_events / total_duration

        print(f"Multi-developer simulation:")
        print(f"  Developers: 5")
        print(f"  Total events: {total_events}")
        print(f"  Duration: {total_duration:.2f}s")
        print(f"  Combined throughput: {events_per_second:.2f} events/s")

        # Verify all operations succeeded
        assert all(result["continue"] for result in all_results)
        assert events_per_second > 20  # Should handle multiple developers efficiently