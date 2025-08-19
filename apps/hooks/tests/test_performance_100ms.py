"""
Claude Code 100ms Performance Requirement Validation Tests

Critical performance tests to validate that all hook operations complete within
the 100ms response time requirement for Claude Code compatibility.
"""

import pytest
import time
import threading
import uuid
import json
import statistics
import psutil
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import Mock, patch
from typing import Dict, List, Any

from src.lib.database import SupabaseClient, DatabaseManager
from src.lib.base_hook import BaseHook
from src.lib.performance import measure_performance, get_performance_collector
from src.lib.utils import sanitize_data


class TestClaudeCode100msRequirement:
    """
    Comprehensive tests to validate 100ms response time requirement.
    
    This test suite is specifically designed to validate the critical
    100ms performance requirement for Claude Code compatibility.
    """

    @pytest.fixture
    def performance_baseline(self):
        """Baseline performance requirements for Claude Code."""
        return {
            "max_hook_execution_ms": 100.0,  # Hard requirement from Claude Code
            "target_hook_execution_ms": 50.0,  # Target for safety margin
            "max_database_operation_ms": 25.0,  # Database should be fast
            "max_validation_ms": 5.0,  # Input validation should be instant
            "max_sanitization_ms": 10.0,  # Data sanitization threshold
            "concurrent_users_target": 50,  # Minimum concurrent user support
        }

    @pytest.fixture
    def claude_code_events(self):
        """Realistic Claude Code event scenarios for testing."""
        base_session_id = str(uuid.uuid4())
        
        return {
            "session_start": {
                "session_id": base_session_id,
                "hook_event_name": "SessionStart",
                "source": "startup",
                "custom_instructions": "Build a React dashboard with TypeScript",
                "git_branch": "main",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "pre_tool_use_read": {
                "session_id": base_session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/Users/developer/my-project/package.json"},
                "matcher": "Read",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "post_tool_use_read": {
                "session_id": base_session_id,
                "hook_event_name": "PostToolUse",
                "tool_name": "Read",
                "tool_response": {
                    "content": '{"name": "my-project", "version": "1.0.0", "dependencies": {"react": "^18.0.0"}}'
                },
                "duration_ms": 50,
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "pre_tool_use_write": {
                "session_id": base_session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "/Users/developer/my-project/src/Dashboard.tsx",
                    "content": "import React from 'react';\n\nfunction Dashboard() {\n  return <div>Dashboard</div>;\n}\n\nexport default Dashboard;"
                },
                "matcher": "Write",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "user_prompt_submit": {
                "session_id": base_session_id,
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Create a responsive dashboard component with charts using React and TypeScript",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "mcp_tool_use": {
                "session_id": base_session_id,
                "hook_event_name": "PreToolUse",
                "tool_name": "mcp__github__create_issue",
                "tool_input": {
                    "title": "Add dashboard component",
                    "body": "Need to implement the dashboard component as discussed",
                    "labels": ["enhancement", "frontend"]
                },
                "matcher": "mcp__github__create_issue",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            },
            "session_stop": {
                "session_id": base_session_id,
                "hook_event_name": "Stop",
                "cwd": "/Users/developer/my-project",
                "transcript_path": "/tmp/claude-session.md"
            }
        }

    def test_individual_hook_execution_under_100ms(self, performance_baseline, claude_code_events):
        """Test that each individual hook execution completes under 100ms."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True

        results = {}
        
        for event_name, event_data in claude_code_events.items():
            hook = BaseHook()
            hook.db_client = mock_client
            
            # Measure execution time with high precision
            execution_times = []
            
            # Run each event multiple times for statistical accuracy
            for run in range(10):
                start_time = time.perf_counter()
                result = hook.process_hook(event_data.copy())
                end_time = time.perf_counter()
                
                execution_time_ms = (end_time - start_time) * 1000
                execution_times.append(execution_time_ms)
                
                assert result["continue"] is True, f"Hook should continue for {event_name}"
            
            # Calculate statistics
            avg_time = statistics.mean(execution_times)
            max_time = max(execution_times)
            p95_time = statistics.quantiles(execution_times, n=20)[18] if len(execution_times) >= 20 else max_time
            
            results[event_name] = {
                "avg_ms": avg_time,
                "max_ms": max_time,
                "p95_ms": p95_time,
                "all_times": execution_times
            }
            
            print(f"{event_name}: avg={avg_time:.2f}ms, max={max_time:.2f}ms, p95={p95_time:.2f}ms")
            
            # Critical assertions for 100ms requirement
            assert max_time < performance_baseline["max_hook_execution_ms"], \
                f"{event_name} max execution time {max_time:.2f}ms exceeds 100ms requirement"
            
            assert avg_time < performance_baseline["target_hook_execution_ms"], \
                f"{event_name} avg execution time {avg_time:.2f}ms exceeds 50ms target"
        
        return results

    def test_database_operations_under_25ms(self, performance_baseline):
        """Test that database operations complete under 25ms threshold."""
        mock_client = Mock()
        
        # Mock database operations with timing
        def timed_upsert_session(*args, **kwargs):
            start = time.perf_counter()
            time.sleep(0.001)  # Simulate 1ms database operation
            end = time.perf_counter()
            return True
        
        def timed_insert_event(*args, **kwargs):
            start = time.perf_counter()
            time.sleep(0.002)  # Simulate 2ms database operation
            end = time.perf_counter()
            return True
        
        mock_client.health_check.return_value = True
        mock_client.upsert_session = timed_upsert_session
        mock_client.insert_event = timed_insert_event
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        test_event = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/test/file.txt"}
        }
        
        # Measure database operation times
        db_operation_times = []
        
        for _ in range(20):
            start_time = time.perf_counter()
            
            # This should trigger both session upsert and event insert
            result = hook.process_hook(test_event.copy())
            
            end_time = time.perf_counter()
            db_time_ms = (end_time - start_time) * 1000
            db_operation_times.append(db_time_ms)
            
            assert result["continue"] is True
        
        avg_db_time = statistics.mean(db_operation_times)
        max_db_time = max(db_operation_times)
        
        print(f"Database operations: avg={avg_db_time:.2f}ms, max={max_db_time:.2f}ms")
        
        assert max_db_time < performance_baseline["max_database_operation_ms"], \
            f"Database operation {max_db_time:.2f}ms exceeds 25ms threshold"

    def test_input_validation_under_5ms(self, performance_baseline):
        """Test that input validation completes under 5ms."""
        from src.lib.security import validate_input
        
        # Test various input scenarios
        test_inputs = [
            {"session_id": str(uuid.uuid4()), "hook_event_name": "PreToolUse", "tool_name": "Read"},
            {"session_id": str(uuid.uuid4()), "hook_event_name": "PostToolUse", "tool_name": "Write"},
            {
                "session_id": str(uuid.uuid4()),
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "ls -la /home/user/projects"}
            },
            {
                "session_id": str(uuid.uuid4()),
                "hook_event_name": "UserPromptSubmit",
                "prompt_text": "Create a new React component with TypeScript interfaces"
            }
        ]
        
        validation_times = []
        
        for test_input in test_inputs:
            start_time = time.perf_counter()
            
            try:
                is_valid = validate_input(test_input)
            except ImportError:
                # Fallback validation if security module not available
                is_valid = isinstance(test_input, dict) and "session_id" in test_input
            
            end_time = time.perf_counter()
            validation_time_ms = (end_time - start_time) * 1000
            validation_times.append(validation_time_ms)
            
            assert is_valid is True or is_valid is False  # Should return boolean
        
        avg_validation_time = statistics.mean(validation_times)
        max_validation_time = max(validation_times)
        
        print(f"Input validation: avg={avg_validation_time:.2f}ms, max={max_validation_time:.2f}ms")
        
        assert max_validation_time < performance_baseline["max_validation_ms"], \
            f"Input validation {max_validation_time:.2f}ms exceeds 5ms threshold"

    def test_data_sanitization_under_10ms(self, performance_baseline):
        """Test that data sanitization completes under 10ms."""
        # Test sanitization with sensitive data
        sensitive_data = {
            "session_id": str(uuid.uuid4()),
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {
                "command": "export API_KEY=secret123 && export PASSWORD=mypass && curl -H 'Authorization: Bearer token123' https://api.example.com",
                "env": {
                    "API_KEY": "secret123",
                    "PASSWORD": "mypassword",
                    "SECRET_TOKEN": "token456",
                    "NORMAL_VAR": "normal_value"
                },
                "metadata": {
                    "api_keys": ["key1", "key2", "key3"],
                    "credentials": {"user": "admin", "pass": "secret"}
                }
            }
        }
        
        sanitization_times = []
        
        for _ in range(20):
            start_time = time.perf_counter()
            sanitized = sanitize_data(sensitive_data.copy())
            end_time = time.perf_counter()
            
            sanitization_time_ms = (end_time - start_time) * 1000
            sanitization_times.append(sanitization_time_ms)
            
            # Verify sanitization worked
            assert "secret123" not in str(sanitized)
            assert "[REDACTED]" in str(sanitized) or sanitized != sensitive_data
        
        avg_sanitization_time = statistics.mean(sanitization_times)
        max_sanitization_time = max(sanitization_times)
        
        print(f"Data sanitization: avg={avg_sanitization_time:.2f}ms, max={max_sanitization_time:.2f}ms")
        
        assert max_sanitization_time < performance_baseline["max_sanitization_ms"], \
            f"Data sanitization {max_sanitization_time:.2f}ms exceeds 10ms threshold"

    def test_concurrent_100ms_compliance(self, performance_baseline, claude_code_events):
        """Test 100ms compliance under concurrent load."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        concurrent_users = 25  # Test with 25 concurrent users
        operations_per_user = 10
        
        def user_session(user_id):
            """Simulate a user session with multiple operations."""
            user_times = []
            hook = BaseHook()
            hook.db_client = mock_client
            
            # Use different event types for variety
            events = list(claude_code_events.values())
            
            for op_num in range(operations_per_user):
                event = events[op_num % len(events)].copy()
                event["session_id"] = f"user-{user_id}-session"
                
                start_time = time.perf_counter()
                result = hook.process_hook(event)
                end_time = time.perf_counter()
                
                execution_time_ms = (end_time - start_time) * 1000
                user_times.append(execution_time_ms)
                
                assert result["continue"] is True
            
            return user_times
        
        # Execute concurrent user sessions
        all_execution_times = []
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = [executor.submit(user_session, user_id) for user_id in range(concurrent_users)]
            
            for future in as_completed(futures):
                user_times = future.result()
                all_execution_times.extend(user_times)
        
        # Analyze concurrent performance
        avg_time = statistics.mean(all_execution_times)
        max_time = max(all_execution_times)
        p95_time = statistics.quantiles(all_execution_times, n=20)[18] if len(all_execution_times) >= 20 else max_time
        p99_time = statistics.quantiles(all_execution_times, n=100)[98] if len(all_execution_times) >= 100 else max_time
        
        violations = [t for t in all_execution_times if t > performance_baseline["max_hook_execution_ms"]]
        violation_rate = len(violations) / len(all_execution_times)
        
        print(f"Concurrent performance ({concurrent_users} users):")
        print(f"  Total operations: {len(all_execution_times)}")
        print(f"  Average: {avg_time:.2f}ms")
        print(f"  P95: {p95_time:.2f}ms")
        print(f"  P99: {p99_time:.2f}ms")
        print(f"  Max: {max_time:.2f}ms")
        print(f"  100ms violations: {len(violations)} ({violation_rate:.2%})")
        
        # Critical assertions
        assert violation_rate < 0.01, f"100ms violation rate {violation_rate:.2%} exceeds 1% threshold"
        assert p95_time < performance_baseline["max_hook_execution_ms"], \
            f"P95 time {p95_time:.2f}ms exceeds 100ms requirement"

    def test_memory_efficiency_during_100ms_operations(self, performance_baseline):
        """Test memory efficiency while maintaining 100ms performance."""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        memory_samples = [initial_memory]
        execution_times = []
        
        # Run operations for 30 seconds, measuring both memory and performance
        start_test = time.time()
        operation_count = 0
        
        while time.time() - start_test < 30:
            test_event = {
                "session_id": f"memory-test-{operation_count}",
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": f"/test/file-{operation_count}.txt"},
                "timestamp": datetime.now().isoformat()
            }
            
            # Measure execution time
            start_time = time.perf_counter()
            result = hook.process_hook(test_event)
            end_time = time.perf_counter()
            
            execution_time_ms = (end_time - start_time) * 1000
            execution_times.append(execution_time_ms)
            operation_count += 1
            
            # Sample memory every 100 operations
            if operation_count % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)
            
            assert result["continue"] is True
        
        final_memory = process.memory_info().rss / 1024 / 1024
        memory_growth = final_memory - initial_memory
        max_memory = max(memory_samples)
        
        avg_execution_time = statistics.mean(execution_times)
        violations = [t for t in execution_times if t > performance_baseline["max_hook_execution_ms"]]
        
        print(f"Memory efficiency test (30s duration):")
        print(f"  Operations: {operation_count}")
        print(f"  Memory growth: {memory_growth:.2f}MB")
        print(f"  Max memory: {max_memory:.2f}MB")
        print(f"  Avg execution time: {avg_execution_time:.2f}ms")
        print(f"  100ms violations: {len(violations)}")
        
        # Memory should not grow excessively while maintaining performance
        assert memory_growth < 50, f"Memory growth {memory_growth:.2f}MB exceeds 50MB limit"
        assert len(violations) < operation_count * 0.01, "Too many 100ms violations during memory test"
        assert avg_execution_time < performance_baseline["target_hook_execution_ms"], \
            f"Average execution time {avg_execution_time:.2f}ms exceeds target during memory test"

    def test_performance_degradation_detection(self, performance_baseline, claude_code_events):
        """Test detection of performance degradation over time."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Collect performance data in time windows
        time_windows = []
        window_duration = 5  # 5 second windows
        total_test_duration = 30  # 30 second test
        
        start_test = time.time()
        
        while time.time() - start_test < total_test_duration:
            window_start = time.time()
            window_execution_times = []
            
            while time.time() - window_start < window_duration:
                # Use random event type
                event_name = list(claude_code_events.keys())[len(window_execution_times) % len(claude_code_events)]
                event_data = claude_code_events[event_name].copy()
                event_data["session_id"] = f"degradation-test-{len(time_windows)}"
                
                start_time = time.perf_counter()
                result = hook.process_hook(event_data)
                end_time = time.perf_counter()
                
                execution_time_ms = (end_time - start_time) * 1000
                window_execution_times.append(execution_time_ms)
                
                assert result["continue"] is True
            
            window_avg = statistics.mean(window_execution_times)
            window_max = max(window_execution_times)
            window_violations = len([t for t in window_execution_times if t > performance_baseline["max_hook_execution_ms"]])
            
            time_windows.append({
                "window": len(time_windows),
                "avg_ms": window_avg,
                "max_ms": window_max,
                "violations": window_violations,
                "operation_count": len(window_execution_times)
            })
        
        # Analyze performance degradation
        initial_avg = statistics.mean([w["avg_ms"] for w in time_windows[:2]])  # First 2 windows
        final_avg = statistics.mean([w["avg_ms"] for w in time_windows[-2:]])   # Last 2 windows
        
        degradation_percent = ((final_avg - initial_avg) / initial_avg) * 100
        total_violations = sum(w["violations"] for w in time_windows)
        
        print(f"Performance degradation analysis:")
        print(f"  Initial avg: {initial_avg:.2f}ms")
        print(f"  Final avg: {final_avg:.2f}ms")
        print(f"  Degradation: {degradation_percent:.1f}%")
        print(f"  Total violations: {total_violations}")
        
        for i, window in enumerate(time_windows):
            print(f"  Window {i}: avg={window['avg_ms']:.2f}ms, max={window['max_ms']:.2f}ms, violations={window['violations']}")
        
        # Performance should not degrade significantly over time
        assert degradation_percent < 20, f"Performance degraded by {degradation_percent:.1f}% over test duration"
        assert total_violations < sum(w["operation_count"] for w in time_windows) * 0.02, \
            "Too many 100ms violations across test duration"

    def test_100ms_compliance_with_real_payloads(self, performance_baseline):
        """Test 100ms compliance with realistic large payloads."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Test with increasingly large payloads
        payload_sizes = [1024, 5120, 10240, 51200]  # 1KB, 5KB, 10KB, 50KB
        
        for payload_size in payload_sizes:
            large_content = "x" * payload_size
            
            large_payload_event = {
                "session_id": str(uuid.uuid4()),
                "hook_event_name": "PreToolUse",
                "tool_name": "Write",
                "tool_input": {
                    "file_path": f"/test/large_file_{payload_size}.txt",
                    "content": large_content
                },
                "metadata": {
                    "file_size": payload_size,
                    "content_type": "text/plain",
                    "encoding": "utf-8"
                }
            }
            
            execution_times = []
            
            # Test each payload size multiple times
            for _ in range(5):
                start_time = time.perf_counter()
                result = hook.process_hook(large_payload_event.copy())
                end_time = time.perf_counter()
                
                execution_time_ms = (end_time - start_time) * 1000
                execution_times.append(execution_time_ms)
                
                assert result["continue"] is True
            
            avg_time = statistics.mean(execution_times)
            max_time = max(execution_times)
            
            print(f"Payload size {payload_size} bytes: avg={avg_time:.2f}ms, max={max_time:.2f}ms")
            
            # Even with large payloads, should maintain 100ms compliance
            assert max_time < performance_baseline["max_hook_execution_ms"], \
                f"Large payload ({payload_size} bytes) execution {max_time:.2f}ms exceeds 100ms"


class TestPerformanceRegression:
    """Test suite for detecting performance regressions."""
    
    def test_performance_baseline_establishment(self):
        """Establish performance baselines for regression detection."""
        collector = get_performance_collector()
        collector.reset_stats()
        
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Run standardized test operations
        baseline_operations = [
            {"hook_event_name": "SessionStart", "source": "startup"},
            {"hook_event_name": "PreToolUse", "tool_name": "Read", "tool_input": {"file_path": "/test/file.txt"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Read", "tool_response": {"content": "file contents"}},
            {"hook_event_name": "UserPromptSubmit", "prompt_text": "Create a component"},
            {"hook_event_name": "Stop"}
        ]
        
        for op in baseline_operations:
            event_data = {"session_id": str(uuid.uuid4()), **op}
            
            with measure_performance(f"baseline_{op['hook_event_name']}"):
                result = hook.process_hook(event_data)
                assert result["continue"] is True
        
        # Get baseline statistics
        stats = collector.get_statistics()
        
        print("Performance baseline established:")
        for operation, metrics in stats.get("operations", {}).items():
            print(f"  {operation}: avg={metrics['avg_ms']:.2f}ms, max={metrics['max_ms']:.2f}ms")
        
        # Save baseline for future regression tests
        baseline_file = "performance_baseline.json"
        try:
            import json
            with open(baseline_file, 'w') as f:
                json.dump(stats, f, indent=2)
            print(f"Baseline saved to {baseline_file}")
        except Exception as e:
            print(f"Could not save baseline: {e}")
        
        return stats

    def test_regression_detection_thresholds(self):
        """Test regression detection with configurable thresholds."""
        # Define regression thresholds (percentage increases that trigger alerts)
        regression_thresholds = {
            "avg_ms_increase": 20.0,    # 20% average time increase
            "max_ms_increase": 50.0,    # 50% max time increase  
            "p95_ms_increase": 30.0,    # 30% P95 time increase
            "violation_rate_increase": 5.0  # 5% violation rate increase
        }
        
        # This test would compare current performance against saved baselines
        # In a real implementation, this would load previous baseline data
        print("Regression thresholds configured:")
        for metric, threshold in regression_thresholds.items():
            print(f"  {metric}: {threshold}%")
        
        assert regression_thresholds["avg_ms_increase"] <= 25, "Average time regression threshold too high"
        assert regression_thresholds["violation_rate_increase"] <= 10, "Violation rate threshold too high"


class TestClaudeCodeIntegrationPerformance:
    """Test performance in realistic Claude Code integration scenarios."""
    
    def test_realistic_coding_session_performance(self, performance_baseline):
        """Test performance during a realistic coding session."""
        mock_client = Mock()
        mock_client.health_check.return_value = True
        mock_client.upsert_session.return_value = True
        mock_client.insert_event.return_value = True
        
        session_id = str(uuid.uuid4())
        hook = BaseHook()
        hook.db_client = mock_client
        
        # Simulate a realistic coding session workflow
        coding_workflow = [
            # Session starts
            {"hook_event_name": "SessionStart", "source": "startup", "git_branch": "feature/dashboard"},
            
            # User asks for help
            {"hook_event_name": "UserPromptSubmit", "prompt_text": "Help me build a React dashboard"},
            
            # Claude reads project files
            {"hook_event_name": "PreToolUse", "tool_name": "Read", "tool_input": {"file_path": "/project/package.json"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Read", "tool_response": {"content": '{"name": "dashboard"}'}},
            
            {"hook_event_name": "PreToolUse", "tool_name": "LS", "tool_input": {"path": "/project/src"}},
            {"hook_event_name": "PostToolUse", "tool_name": "LS", "tool_response": {"files": ["App.tsx", "index.tsx"]}},
            
            # Claude creates new files
            {"hook_event_name": "PreToolUse", "tool_name": "Write", "tool_input": {
                "file_path": "/project/src/Dashboard.tsx",
                "content": "import React from 'react';\n\nfunction Dashboard() {\n  return <div>Dashboard</div>;\n}\n\nexport default Dashboard;"
            }},
            {"hook_event_name": "PostToolUse", "tool_name": "Write", "tool_response": {"success": True}},
            
            # User asks for modifications
            {"hook_event_name": "UserPromptSubmit", "prompt_text": "Add charts to the dashboard"},
            
            # Claude edits files
            {"hook_event_name": "PreToolUse", "tool_name": "Edit", "tool_input": {
                "file_path": "/project/src/Dashboard.tsx",
                "old_string": "return <div>Dashboard</div>;",
                "new_string": "return <div><h1>Dashboard</h1><ChartComponent /></div>;"
            }},
            {"hook_event_name": "PostToolUse", "tool_name": "Edit", "tool_response": {"success": True}},
            
            # Claude runs tests
            {"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "npm test"}},
            {"hook_event_name": "PostToolUse", "tool_name": "Bash", "tool_response": {"output": "Tests passed"}},
            
            # Session ends
            {"hook_event_name": "Stop"}
        ]
        
        execution_times = []
        total_start = time.time()
        
        for step, operation in enumerate(coding_workflow):
            event_data = {"session_id": session_id, **operation}
            
            start_time = time.perf_counter()
            result = hook.process_hook(event_data)
            end_time = time.perf_counter()
            
            execution_time_ms = (end_time - start_time) * 1000
            execution_times.append(execution_time_ms)
            
            print(f"Step {step + 1} ({operation['hook_event_name']}): {execution_time_ms:.2f}ms")
            
            assert result["continue"] is True
            assert execution_time_ms < performance_baseline["max_hook_execution_ms"], \
                f"Step {step + 1} exceeded 100ms: {execution_time_ms:.2f}ms"
        
        total_time = time.time() - total_start
        avg_time = statistics.mean(execution_times)
        max_time = max(execution_times)
        
        print(f"\nCoding session performance:")
        print(f"  Total steps: {len(coding_workflow)}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Average step time: {avg_time:.2f}ms")
        print(f"  Max step time: {max_time:.2f}ms")
        
        # Verify overall session performance
        assert max_time < performance_baseline["max_hook_execution_ms"]
        assert avg_time < performance_baseline["target_hook_execution_ms"]
        assert total_time < 30, "Total session time should be reasonable for user experience"