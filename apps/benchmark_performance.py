#!/usr/bin/env python3
"""
Chronicle Performance Benchmark Script
Real-world performance testing for hooks and dashboard integration
"""

import time
import json
import uuid
import asyncio
import threading
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics
import sys
import os

# Add the apps directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'hooks', 'src'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'dashboard', 'src'))

try:
    from base_hook import BaseHook
    from database import SupabaseClient, DatabaseManager
    from utils import sanitize_input_data, validate_hook_input
except ImportError as e:
    print(f"Warning: Could not import hooks modules: {e}")
    BaseHook = None

def generate_realistic_hook_data(session_id=None, event_type="PreToolUse"):
    """Generate realistic hook input data."""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    base_data = {
        "session_id": session_id,
        "transcript_path": f"/tmp/claude-session-{session_id}.md",
        "cwd": "/test/project",
        "hook_event_name": event_type,
        "timestamp": datetime.now().isoformat()
    }
    
    if event_type == "PreToolUse":
        tool_types = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "LS"]
        tool_name = tool_types[int(time.time()) % len(tool_types)]
        
        base_data.update({
            "tool_name": tool_name,
            "tool_input": {
                "file_path": f"/test/project/src/component_{uuid.uuid4().hex[:8]}.tsx"
            },
            "matcher": tool_name
        })
    elif event_type == "PostToolUse":
        base_data.update({
            "tool_name": "Read",
            "tool_response": {
                "success": True,
                "content": "Mock file content here...",
                "size": 1024
            }
        })
    elif event_type == "UserPromptSubmit":
        base_data.update({
            "prompt_text": f"Please help with task {uuid.uuid4().hex[:8]}"
        })
    
    return base_data

def benchmark_data_processing():
    """Benchmark data processing operations."""
    print("\n=== Data Processing Benchmark ===")
    
    # Test data sanitization performance
    large_sensitive_data = {
        "session_id": str(uuid.uuid4()),
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {
            "command": f"export API_KEY=secret123 && {'echo test; ' * 1000}",
            "env": {f"VAR_{i}": f"secret_value_{i}" for i in range(100)},
            "large_data": "x" * 100000  # 100KB of data
        }
    }
    
    times = []
    for i in range(100):
        start_time = time.perf_counter()
        sanitized = sanitize_input_data(large_sensitive_data)
        end_time = time.perf_counter()
        times.append((end_time - start_time) * 1000)
    
    print(f"Data Sanitization (100KB payload, 100 iterations):")
    print(f"  Average: {statistics.mean(times):.2f}ms")
    print(f"  Min: {min(times):.2f}ms")
    print(f"  Max: {max(times):.2f}ms")
    print(f"  95th percentile: {statistics.quantiles(times, n=20)[18]:.2f}ms")
    
    # Test validation performance
    validation_times = []
    for i in range(1000):
        test_data = generate_realistic_hook_data()
        start_time = time.perf_counter()
        is_valid = validate_hook_input(test_data)
        end_time = time.perf_counter()
        validation_times.append((end_time - start_time) * 1000)
    
    print(f"\nInput Validation (1000 iterations):")
    print(f"  Average: {statistics.mean(validation_times):.3f}ms")
    print(f"  95th percentile: {statistics.quantiles(validation_times, n=20)[18]:.3f}ms")

def benchmark_hook_execution():
    """Benchmark hook execution performance."""
    print("\n=== Hook Execution Benchmark ===")
    
    if not BaseHook:
        print("BaseHook not available, skipping hook execution benchmark")
        return
    
    # Mock database client for performance testing
    class MockDatabaseClient:
        def __init__(self):
            self.call_count = 0
            
        def health_check(self):
            return True
            
        def upsert_session(self, session_data):
            self.call_count += 1
            time.sleep(0.001)  # Simulate 1ms database latency
            return True
            
        def insert_event(self, event_data):
            self.call_count += 1
            time.sleep(0.001)  # Simulate 1ms database latency
            return True
    
    hook = BaseHook()
    hook.db_client = MockDatabaseClient()
    
    # Single hook execution benchmark
    execution_times = []
    for i in range(1000):
        hook_input = generate_realistic_hook_data()
        
        start_time = time.perf_counter()
        result = hook.process_hook(hook_input)
        end_time = time.perf_counter()
        
        execution_times.append((end_time - start_time) * 1000)
    
    print(f"Single Hook Execution (1000 iterations):")
    print(f"  Average: {statistics.mean(execution_times):.2f}ms")
    print(f"  Min: {min(execution_times):.2f}ms")
    print(f"  Max: {max(execution_times):.2f}ms")
    print(f"  95th percentile: {statistics.quantiles(execution_times, n=20)[18]:.2f}ms")
    print(f"  Throughput: {1000 / statistics.mean(execution_times):.0f} hooks/second")

def benchmark_concurrent_execution():
    """Benchmark concurrent hook execution."""
    print("\n=== Concurrent Execution Benchmark ===")
    
    if not BaseHook:
        print("BaseHook not available, skipping concurrent execution benchmark")
        return
    
    class MockDatabaseClient:
        def __init__(self):
            self.call_count = 0
            self.lock = threading.Lock()
            
        def health_check(self):
            return True
            
        def upsert_session(self, session_data):
            with self.lock:
                self.call_count += 1
            time.sleep(0.001)  # Simulate database latency
            return True
            
        def insert_event(self, event_data):
            with self.lock:
                self.call_count += 1
            time.sleep(0.001)  # Simulate database latency
            return True
    
    def execute_hook_batch(batch_size, session_id):
        """Execute a batch of hooks."""
        hook = BaseHook()
        hook.db_client = MockDatabaseClient()
        
        times = []
        for i in range(batch_size):
            hook_input = generate_realistic_hook_data(session_id=session_id)
            
            start_time = time.perf_counter()
            result = hook.process_hook(hook_input)
            end_time = time.perf_counter()
            
            times.append((end_time - start_time) * 1000)
        
        return times
    
    # Test different concurrency levels
    concurrency_levels = [1, 5, 10, 20, 50]
    batch_size = 100
    
    for concurrency in concurrency_levels:
        print(f"\nConcurrency Level: {concurrency}")
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = []
            for i in range(concurrency):
                session_id = f"session-{i}"
                future = executor.submit(execute_hook_batch, batch_size, session_id)
                futures.append(future)
            
            all_times = []
            for future in as_completed(futures):
                batch_times = future.result()
                all_times.extend(batch_times)
        
        end_time = time.time()
        total_duration = end_time - start_time
        total_operations = concurrency * batch_size
        
        throughput = total_operations / total_duration
        avg_latency = statistics.mean(all_times)
        p95_latency = statistics.quantiles(all_times, n=20)[18]
        
        print(f"  Total operations: {total_operations}")
        print(f"  Duration: {total_duration:.2f}s")
        print(f"  Throughput: {throughput:.0f} ops/sec")
        print(f"  Average latency: {avg_latency:.2f}ms")
        print(f"  95th percentile latency: {p95_latency:.2f}ms")

def benchmark_memory_usage():
    """Benchmark memory usage patterns."""
    print("\n=== Memory Usage Benchmark ===")
    
    try:
        import psutil
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        print(f"Initial memory usage: {initial_memory:.2f}MB")
        
        # Test memory growth with large payloads
        large_payloads = []
        for i in range(100):
            payload = generate_realistic_hook_data()
            payload["tool_input"]["large_content"] = "x" * 10000  # 10KB per payload
            large_payloads.append(payload)
            
            if i % 20 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                print(f"  After {i+1} payloads: {current_memory:.2f}MB (+{current_memory - initial_memory:.2f}MB)")
        
        final_memory = process.memory_info().rss / 1024 / 1024
        memory_growth = final_memory - initial_memory
        
        print(f"Final memory usage: {final_memory:.2f}MB")
        print(f"Memory growth: {memory_growth:.2f}MB")
        print(f"Memory per payload: {memory_growth / 100:.3f}MB")
        
    except ImportError:
        print("psutil not available, skipping memory benchmark")

def benchmark_realistic_scenarios():
    """Benchmark realistic usage scenarios."""
    print("\n=== Realistic Scenario Benchmark ===")
    
    # Simulate a typical development session
    session_durations = []
    events_per_session = []
    
    for session_num in range(10):
        session_id = str(uuid.uuid4())
        session_start = time.time()
        event_count = 0
        
        # Simulate typical development workflow
        workflow_steps = [
            ("SessionStart", 1),
            ("PreToolUse", 5),   # Read some files
            ("PostToolUse", 5),  # Response to reads
            ("UserPromptSubmit", 2),  # User asks questions
            ("PreToolUse", 10),  # More tool usage
            ("PostToolUse", 10), # Tool responses
            ("Stop", 1)          # Session end
        ]
        
        for event_type, count in workflow_steps:
            for _ in range(count):
                event_data = generate_realistic_hook_data(session_id, event_type)
                # Simulate processing time
                time.sleep(0.001)  # 1ms per event
                event_count += 1
                
                # Random delays to simulate thinking time
                if event_type == "UserPromptSubmit":
                    time.sleep(0.05)  # 50ms for user prompts
        
        session_duration = time.time() - session_start
        session_durations.append(session_duration)
        events_per_session.append(event_count)
    
    print(f"Development Session Simulation (10 sessions):")
    print(f"  Average session duration: {statistics.mean(session_durations):.2f}s")
    print(f"  Average events per session: {statistics.mean(events_per_session):.0f}")
    print(f"  Average events per second: {statistics.mean(events_per_session) / statistics.mean(session_durations):.1f}")

def benchmark_error_scenarios():
    """Benchmark error handling performance."""
    print("\n=== Error Handling Benchmark ===")
    
    # Test malformed data handling
    malformed_data_types = [
        {},  # Empty data
        {"session_id": None},  # None values
        {"session_id": "test", "hook_event_name": ""},  # Empty strings
        {"invalid": "data"},  # Wrong structure
        {"session_id": "../../../etc/passwd"},  # Path traversal
    ]
    
    validation_times = []
    for malformed_data in malformed_data_types * 200:  # 1000 total tests
        start_time = time.perf_counter()
        try:
            is_valid = validate_hook_input(malformed_data)
            sanitized = sanitize_input_data(malformed_data)
        except Exception:
            pass  # Expected for malformed data
        end_time = time.perf_counter()
        validation_times.append((end_time - start_time) * 1000)
    
    print(f"Malformed Data Handling (1000 iterations):")
    print(f"  Average: {statistics.mean(validation_times):.3f}ms")
    print(f"  Max: {max(validation_times):.3f}ms")
    print(f"  Should handle errors gracefully without crashes")

def run_all_benchmarks():
    """Run complete benchmark suite."""
    print("Chronicle Performance Benchmark Suite")
    print("=" * 50)
    
    start_time = time.time()
    
    try:
        benchmark_data_processing()
        benchmark_hook_execution()
        benchmark_concurrent_execution()
        benchmark_memory_usage()
        benchmark_realistic_scenarios()
        benchmark_error_scenarios()
    except Exception as e:
        print(f"Benchmark error: {e}")
        import traceback
        traceback.print_exc()
    
    total_time = time.time() - start_time
    print(f"\n=== Benchmark Summary ===")
    print(f"Total benchmark time: {total_time:.2f}s")
    print(f"System appears to be {'✓ HEALTHY' if total_time < 30 else '⚠ SLOW'}")

if __name__ == "__main__":
    run_all_benchmarks()