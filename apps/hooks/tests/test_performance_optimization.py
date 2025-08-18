"""
Performance optimization tests for Chronicle hooks system.

Tests to validate that all hooks complete within the 100ms Claude Code compatibility
requirement with comprehensive performance monitoring and validation.
"""

import pytest
import asyncio
import time
import uuid
import json
import os
from datetime import datetime
from unittest.mock import Mock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics
import sys

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.lib.base_hook import BaseHook
from src.lib.database import DatabaseManager
from src.lib.performance import (
    measure_performance, get_performance_collector, get_hook_cache,
    PerformanceMetrics, EarlyReturnValidator
)
from hooks.session_start import SessionStartHook


class TestPerformanceRequirements:
    """Test hooks meet the 100ms Claude Code performance requirement."""
    
    @pytest.fixture
    def performance_thresholds(self):
        """Performance thresholds for Claude Code compatibility."""
        return {
            "hook_execution_ms": 100.0,      # Main requirement
            "fast_validation_ms": 1.0,       # Early validation should be very fast
            "cache_lookup_ms": 1.0,           # Cache operations should be instant
            "security_validation_ms": 5.0,    # Security validation target
            "database_operation_ms": 50.0,    # Database ops should be reasonable
            "memory_growth_mb": 5.0,          # Memory growth per operation
        }
    
    @pytest.fixture
    def sample_hook_input(self):
        """Standard hook input for testing."""
        return {
            "hookEventName": "SessionStart",
            "sessionId": str(uuid.uuid4()),
            "cwd": "/test/project",
            "source": "startup",
            "transcriptPath": "/test/transcript.txt",
            "timestamp": datetime.now().isoformat()
        }
    
    def test_base_hook_initialization_performance(self, performance_thresholds):
        """Test BaseHook initialization is fast."""
        start_time = time.perf_counter()
        hook = BaseHook()
        init_time = (time.perf_counter() - start_time) * 1000
        
        print(f"BaseHook initialization: {init_time:.2f}ms")
        assert init_time < 50.0  # Initialization should be very fast
        assert hook.performance_collector is not None
        assert hook.hook_cache is not None
        assert hook.early_validator is not None
    
    def test_fast_validation_performance(self, sample_hook_input, performance_thresholds):
        """Test fast validation meets performance requirements."""
        hook = BaseHook()
        
        # Test valid input
        start_time = time.perf_counter()
        is_valid, error = hook._fast_validation_check(sample_hook_input)
        validation_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Fast validation (valid): {validation_time:.2f}ms")
        assert is_valid is True
        assert error is None
        assert validation_time < performance_thresholds["fast_validation_ms"]
        
        # Test invalid input for early return
        invalid_input = {"invalid": "data"}
        start_time = time.perf_counter()
        is_valid, error = hook._fast_validation_check(invalid_input)
        validation_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Fast validation (invalid): {validation_time:.2f}ms")
        assert is_valid is False
        assert error is not None
        assert validation_time < performance_thresholds["fast_validation_ms"]
    
    def test_cache_performance(self, sample_hook_input, performance_thresholds):
        """Test caching operations are fast."""
        hook = BaseHook()
        cache_key = hook._generate_input_cache_key(sample_hook_input)
        test_data = {"test": "data", "cached_at": datetime.now().isoformat()}
        
        # Test cache set
        start_time = time.perf_counter()
        hook.hook_cache.set(cache_key, test_data)
        set_time = (time.perf_counter() - start_time) * 1000
        
        # Test cache get
        start_time = time.perf_counter()
        cached_result = hook.hook_cache.get(cache_key)
        get_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Cache operations - Set: {set_time:.2f}ms, Get: {get_time:.2f}ms")
        assert cached_result == test_data
        assert set_time < performance_thresholds["cache_lookup_ms"]
        assert get_time < performance_thresholds["cache_lookup_ms"]
    
    def test_hook_data_processing_performance(self, sample_hook_input, performance_thresholds):
        """Test hook data processing meets performance requirements."""
        hook = BaseHook()
        
        start_time = time.perf_counter()
        processed_data = hook.process_hook_data(sample_hook_input)
        processing_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Hook data processing: {processing_time:.2f}ms")
        assert processed_data is not None
        assert "hook_event_name" in processed_data
        assert processing_time < 20.0  # Should be very fast with optimizations
        
        # Verify security validation time is tracked
        if "security_validation_time_ms" in processed_data:
            assert processed_data["security_validation_time_ms"] < performance_thresholds["security_validation_ms"]
    
    def test_session_start_hook_performance(self, sample_hook_input, performance_thresholds):
        """Test SessionStart hook meets 100ms requirement."""
        # Mock database operations to focus on hook logic performance
        with patch('core.database.DatabaseManager') as mock_db:
            mock_db_instance = Mock()
            mock_db_instance.save_session.return_value = (True, str(uuid.uuid4()))
            mock_db_instance.save_event.return_value = True
            mock_db.return_value = mock_db_instance
            
            hook = SessionStartHook()
            hook.db_manager = mock_db_instance
            
            start_time = time.perf_counter()
            success, session_data, event_data = hook.process_session_start(sample_hook_input)
            execution_time = (time.perf_counter() - start_time) * 1000
            
            print(f"SessionStart hook execution: {execution_time:.2f}ms")
            assert success is True
            assert execution_time < performance_thresholds["hook_execution_ms"]
            assert "claude_session_id" in session_data
            assert "event_type" in event_data
    
    def test_optimized_hook_execution_performance(self, sample_hook_input, performance_thresholds):
        """Test the optimized hook execution pipeline."""
        hook = BaseHook()
        
        def mock_hook_func(processed_data):
            """Mock hook function that simulates processing."""
            return {
                "continue": True,
                "suppressOutput": True,
                "hookSpecificOutput": {
                    "hookEventName": processed_data.get("hook_event_name", "Test"),
                    "success": True
                }
            }
        
        start_time = time.perf_counter()
        result = hook.execute_hook_optimized(sample_hook_input, mock_hook_func)
        execution_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Optimized hook execution: {execution_time:.2f}ms")
        assert result is not None
        assert result.get("continue") is True
        assert "execution_time_ms" in result
        assert execution_time < performance_thresholds["hook_execution_ms"]
        
        # Second execution should be faster (cached)
        start_time = time.perf_counter()
        cached_result = hook.execute_hook_optimized(sample_hook_input, mock_hook_func)
        cached_time = (time.perf_counter() - start_time) * 1000
        
        print(f"Cached hook execution: {cached_time:.2f}ms")
        assert cached_result.get("cached") is True
        assert cached_time < 5.0  # Cached results should be very fast
    
    def test_early_return_performance(self, performance_thresholds):
        """Test early return paths are extremely fast."""
        hook = BaseHook()
        
        # Test invalid input early return
        invalid_inputs = [
            None,
            "string",
            123,
            [],
            {"hookEventName": "InvalidEvent"},
            {"hookEventName": "SessionStart", "sessionId": ""},
            {"hookEventName": "SessionStart", "data": "x" * (11 * 1024 * 1024)}  # 11MB
        ]
        
        for invalid_input in invalid_inputs:
            if invalid_input is None:
                continue
                
            start_time = time.perf_counter()
            result = hook.execute_hook_optimized(invalid_input, lambda x: {"continue": True})
            early_return_time = (time.perf_counter() - start_time) * 1000
            
            print(f"Early return for invalid input: {early_return_time:.2f}ms")
            assert early_return_time < 2.0  # Early returns should be extremely fast
            assert "error" in str(result) or result.get("hookSpecificOutput", {}).get("validation_error")
    
    @pytest.mark.asyncio
    async def test_async_database_operations_performance(self, performance_thresholds):
        """Test async database operations improve performance."""
        # Test with mock async operations
        from src.lib.database import SQLiteClient
        
        with patch('aiosqlite.connect') as mock_connect:
            # Mock async context manager
            mock_conn = Mock()
            mock_conn.__aenter__ = Mock(return_value=mock_conn)
            mock_conn.__aexit__ = Mock(return_value=None)
            mock_conn.execute = Mock(return_value=mock_conn)
            mock_conn.fetchone = Mock(return_value=None)
            mock_conn.commit = Mock()
            mock_connect.return_value = mock_conn
            
            client = SQLiteClient()
            
            # Test async session upsert
            session_data = {
                "claude_session_id": str(uuid.uuid4()),
                "start_time": datetime.now().isoformat(),
                "project_path": "/test/project"
            }
            
            start_time = time.perf_counter()
            success, session_uuid = await client.upsert_session_async(session_data)
            async_time = (time.perf_counter() - start_time) * 1000
            
            print(f"Async session upsert: {async_time:.2f}ms")
            # Note: This is mostly testing the mock, real performance would depend on actual DB
            assert async_time < 100.0  # Should be reasonable even with async overhead
    
    def test_concurrent_hook_performance(self, sample_hook_input, performance_thresholds):
        """Test performance under concurrent load."""
        hook = BaseHook()
        
        def execute_hook_test(hook_id):
            """Execute single hook test."""
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"concurrent-{hook_id}"
            
            start_time = time.perf_counter()
            result = hook.execute_hook_optimized(
                input_data, 
                lambda x: {"continue": True, "hookSpecificOutput": {"success": True}}
            )
            execution_time = (time.perf_counter() - start_time) * 1000
            
            return execution_time, result.get("continue", False)
        
        # Execute 20 concurrent hooks
        concurrent_count = 20
        with ThreadPoolExecutor(max_workers=10) as executor:
            start_time = time.time()
            
            futures = [
                executor.submit(execute_hook_test, i) 
                for i in range(concurrent_count)
            ]
            
            results = [future.result() for future in as_completed(futures)]
            
            total_time = time.time() - start_time
        
        execution_times = [result[0] for result in results]
        successes = [result[1] for result in results]
        
        avg_time = statistics.mean(execution_times)
        max_time = max(execution_times)
        min_time = min(execution_times)
        p95_time = statistics.quantiles(execution_times, n=20)[18]  # 95th percentile
        
        print(f"Concurrent execution results:")
        print(f"  Total hooks: {concurrent_count}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Throughput: {concurrent_count / total_time:.1f} hooks/s")
        print(f"  Avg execution: {avg_time:.2f}ms")
        print(f"  Min execution: {min_time:.2f}ms")
        print(f"  Max execution: {max_time:.2f}ms")
        print(f"  P95 execution: {p95_time:.2f}ms")
        print(f"  Success rate: {sum(successes) / len(successes) * 100:.1f}%")
        
        # Verify performance requirements
        assert all(successes), "All hooks should succeed"
        assert avg_time < performance_thresholds["hook_execution_ms"]
        assert p95_time < performance_thresholds["hook_execution_ms"] * 1.2  # Allow 20% overhead for P95
        assert concurrent_count / total_time > 10  # Should handle at least 10 hooks/second
    
    def test_performance_monitoring_accuracy(self, sample_hook_input):
        """Test performance monitoring provides accurate metrics."""
        hook = BaseHook()
        collector = hook.performance_collector
        
        # Clear any existing metrics
        collector.reset_stats()
        
        # Execute some operations
        for i in range(5):
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"monitor-test-{i}"
            
            hook.execute_hook_optimized(
                input_data,
                lambda x: {"continue": True, "test": f"execution-{i}"}
            )
        
        # Check collected metrics
        stats = collector.get_statistics()
        print(f"Performance monitoring stats: {json.dumps(stats, indent=2)}")
        
        assert stats["total_operations"] >= 5  # Should have recorded our operations
        assert "operations" in stats
        assert stats["avg_ms"] > 0  # Should have measured some time
        
        # Check for any threshold violations
        if stats["violations"] > 0:
            print(f"Performance violations detected: {stats['recent_violations']}")
    
    def test_memory_efficiency(self, sample_hook_input, performance_thresholds):
        """Test memory usage stays within reasonable bounds."""
        import psutil
        
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        hook = BaseHook()
        
        # Execute many operations to test memory efficiency
        for i in range(100):
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"memory-test-{i}"
            input_data["iteration"] = i
            
            hook.execute_hook_optimized(
                input_data,
                lambda x: {"continue": True, "iteration": x.get("iteration", 0)}
            )
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_growth = final_memory - initial_memory
        
        print(f"Memory usage - Initial: {initial_memory:.2f}MB, Final: {final_memory:.2f}MB, Growth: {memory_growth:.2f}MB")
        
        assert memory_growth < performance_thresholds["memory_growth_mb"] * 20  # Allow for 100 operations
    
    def test_performance_under_load_scenarios(self, sample_hook_input, performance_thresholds):
        """Test various load scenarios to ensure consistent performance."""
        hook = BaseHook()
        scenarios = []
        
        # Scenario 1: Rapid sequential execution
        start_time = time.perf_counter()
        for i in range(10):
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"rapid-{i}"
            hook.execute_hook_optimized(input_data, lambda x: {"continue": True})
        rapid_total_time = (time.perf_counter() - start_time) * 1000
        scenarios.append(("Rapid Sequential", rapid_total_time / 10))
        
        # Scenario 2: With large but valid payloads
        large_input = sample_hook_input.copy()
        large_input["largeData"] = {"data": "x" * 50000}  # 50KB payload
        start_time = time.perf_counter()
        hook.execute_hook_optimized(large_input, lambda x: {"continue": True})
        large_payload_time = (time.perf_counter() - start_time) * 1000
        scenarios.append(("Large Payload", large_payload_time))
        
        # Scenario 3: With complex nested data
        complex_input = sample_hook_input.copy()
        complex_input["toolInput"] = {
            "files": [{"path": f"/test/file{i}.txt", "content": f"content{i}"} for i in range(20)],
            "config": {"nested": {"deep": {"structure": {"value": i} for i in range(10)}}}
        }
        start_time = time.perf_counter()
        hook.execute_hook_optimized(complex_input, lambda x: {"continue": True})
        complex_data_time = (time.perf_counter() - start_time) * 1000
        scenarios.append(("Complex Data", complex_data_time))
        
        # Print scenario results
        print("Load scenario results:")
        for scenario_name, avg_time in scenarios:
            print(f"  {scenario_name}: {avg_time:.2f}ms")
            assert avg_time < performance_thresholds["hook_execution_ms"], f"{scenario_name} exceeded threshold"
    
    def test_performance_regression_detection(self, sample_hook_input):
        """Test that we can detect performance regressions."""
        hook = BaseHook()
        collector = hook.performance_collector
        collector.reset_stats()
        
        # Establish baseline performance
        baseline_times = []
        for i in range(10):
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"baseline-{i}"
            
            start_time = time.perf_counter()
            hook.execute_hook_optimized(input_data, lambda x: {"continue": True})
            baseline_times.append((time.perf_counter() - start_time) * 1000)
        
        baseline_avg = statistics.mean(baseline_times)
        baseline_std = statistics.stdev(baseline_times) if len(baseline_times) > 1 else 0
        
        print(f"Baseline performance: {baseline_avg:.2f}ms ± {baseline_std:.2f}ms")
        
        # Simulate a performance regression by adding artificial delay
        def slow_hook_func(processed_data):
            time.sleep(0.01)  # 10ms artificial delay
            return {"continue": True, "artificialDelay": True}
        
        # Measure performance with regression
        regression_times = []
        for i in range(10):
            input_data = sample_hook_input.copy()
            input_data["sessionId"] = f"regression-{i}"
            
            start_time = time.perf_counter()
            hook.execute_hook_optimized(input_data, slow_hook_func)
            regression_times.append((time.perf_counter() - start_time) * 1000)
        
        regression_avg = statistics.mean(regression_times)
        performance_degradation = regression_avg - baseline_avg
        
        print(f"Regression performance: {regression_avg:.2f}ms (degradation: +{performance_degradation:.2f}ms)")
        
        # Verify we can detect significant regression
        assert performance_degradation > 5.0  # Should detect the artificial 10ms delay
        assert regression_avg > baseline_avg + 2 * baseline_std  # Statistical significance


class TestPerformanceIntegration:
    """Integration tests for performance monitoring system."""
    
    def test_end_to_end_performance_tracking(self):
        """Test complete performance tracking workflow."""
        hook = BaseHook()
        collector = hook.performance_collector
        cache = hook.hook_cache
        
        # Reset for clean test
        collector.reset_stats()
        cache.clear()
        
        # Simulate realistic hook execution sequence
        session_id = str(uuid.uuid4())
        operations = [
            {"hookEventName": "SessionStart", "operation": "start"},
            {"hookEventName": "PreToolUse", "toolName": "Read", "operation": "pre_read"},
            {"hookEventName": "PostToolUse", "toolName": "Read", "operation": "post_read"},
            {"hookEventName": "PreToolUse", "toolName": "Edit", "operation": "pre_edit"},
            {"hookEventName": "PostToolUse", "toolName": "Edit", "operation": "post_edit"},
        ]
        
        execution_times = []
        for i, op_data in enumerate(operations):
            input_data = {
                "sessionId": session_id,
                "timestamp": datetime.now().isoformat(),
                "cwd": "/test/project",
                **op_data
            }
            
            start_time = time.perf_counter()
            result = hook.execute_hook_optimized(
                input_data,
                lambda x: {
                    "continue": True, 
                    "hookSpecificOutput": {"operation": x.get("operation", "unknown")}
                }
            )
            execution_time = (time.perf_counter() - start_time) * 1000
            execution_times.append(execution_time)
            
            assert result.get("continue") is True
            assert "execution_time_ms" in result
        
        # Analyze performance metrics
        stats = collector.get_statistics()
        cache_stats = cache.stats()
        
        print("End-to-end performance tracking results:")
        print(f"  Operations executed: {len(operations)}")
        print(f"  Average execution time: {statistics.mean(execution_times):.2f}ms")
        print(f"  Max execution time: {max(execution_times):.2f}ms")
        print(f"  Total operations tracked: {stats.get('total_operations', 0)}")
        print(f"  Cache size: {cache_stats.get('size', 0)}")
        
        # Verify all operations were tracked
        assert stats.get("total_operations", 0) >= len(operations)
        assert all(time < 100.0 for time in execution_times)  # All under 100ms
        
        # Test cache effectiveness on repeated operations
        repeat_input = {
            "sessionId": session_id,
            "hookEventName": "PreToolUse", 
            "toolName": "Read",
            "operation": "repeat_test"
        }
        
        # First execution
        start_time = time.perf_counter()
        result1 = hook.execute_hook_optimized(repeat_input, lambda x: {"continue": True})
        time1 = (time.perf_counter() - start_time) * 1000
        
        # Second execution (should be cached)
        start_time = time.perf_counter()
        result2 = hook.execute_hook_optimized(repeat_input, lambda x: {"continue": True})
        time2 = (time.perf_counter() - start_time) * 1000
        
        print(f"Cache effectiveness - First: {time1:.2f}ms, Cached: {time2:.2f}ms")
        assert result2.get("cached") is True
        assert time2 < time1  # Cached should be faster
        assert time2 < 5.0     # Cached should be very fast


if __name__ == "__main__":
    # Run a quick performance check
    print("Running quick performance validation...")
    
    hook = BaseHook()
    sample_input = {
        "hookEventName": "SessionStart",
        "sessionId": str(uuid.uuid4()),
        "cwd": "/test/project"
    }
    
    start_time = time.perf_counter()
    result = hook.execute_hook_optimized(sample_input, lambda x: {"continue": True})
    execution_time = (time.perf_counter() - start_time) * 1000
    
    print(f"Quick test result: {execution_time:.2f}ms")
    print(f"Meets 100ms requirement: {'✅' if execution_time < 100 else '❌'}")
    
    if execution_time < 100:
        print("Performance optimization successful! 🎉")
    else:
        print("Performance optimization needs work 🔧")