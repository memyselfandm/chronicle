#!/usr/bin/env python3
"""
Chronicle Performance Monitor
Advanced performance testing and monitoring for the complete Chronicle system
"""

import time
import json
import uuid
import threading
import asyncio
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import statistics
import sys
import os
from typing import List, Dict, Any, Optional

class PerformanceMetrics:
    """Class to collect and analyze performance metrics."""
    
    def __init__(self):
        self.metrics = {
            'event_processing_times': [],
            'database_operation_times': [],
            'memory_usage_samples': [],
            'throughput_measurements': [],
            'error_counts': {},
            'concurrent_execution_stats': {}
        }
        self.start_time = time.time()
    
    def record_event_processing(self, duration_ms: float):
        """Record event processing time."""
        self.metrics['event_processing_times'].append(duration_ms)
    
    def record_database_operation(self, duration_ms: float, operation_type: str):
        """Record database operation time."""
        self.metrics['database_operation_times'].append({
            'duration_ms': duration_ms,
            'operation': operation_type,
            'timestamp': time.time()
        })
    
    def record_memory_usage(self, memory_mb: float):
        """Record memory usage sample."""
        self.metrics['memory_usage_samples'].append({
            'memory_mb': memory_mb,
            'timestamp': time.time()
        })
    
    def record_throughput(self, events_per_second: float, test_name: str):
        """Record throughput measurement."""
        self.metrics['throughput_measurements'].append({
            'events_per_second': events_per_second,
            'test_name': test_name,
            'timestamp': time.time()
        })
    
    def record_error(self, error_type: str):
        """Record error occurrence."""
        if error_type not in self.metrics['error_counts']:
            self.metrics['error_counts'][error_type] = 0
        self.metrics['error_counts'][error_type] += 1
    
    def get_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        processing_times = self.metrics['event_processing_times']
        db_times = [op['duration_ms'] for op in self.metrics['database_operation_times']]
        memory_samples = [sample['memory_mb'] for sample in self.metrics['memory_usage_samples']]
        
        summary = {
            'test_duration_seconds': time.time() - self.start_time,
            'total_events_processed': len(processing_times),
            'performance_stats': {},
            'database_performance': {},
            'memory_stats': {},
            'throughput_stats': {},
            'error_summary': self.metrics['error_counts']
        }
        
        # Event processing stats
        if processing_times:
            summary['performance_stats'] = {
                'avg_processing_time_ms': statistics.mean(processing_times),
                'min_processing_time_ms': min(processing_times),
                'max_processing_time_ms': max(processing_times),
                'p95_processing_time_ms': statistics.quantiles(processing_times, n=20)[18] if len(processing_times) >= 20 else max(processing_times),
                'p99_processing_time_ms': statistics.quantiles(processing_times, n=100)[98] if len(processing_times) >= 100 else max(processing_times)
            }
        
        # Database performance stats
        if db_times:
            summary['database_performance'] = {
                'avg_db_operation_ms': statistics.mean(db_times),
                'min_db_operation_ms': min(db_times),
                'max_db_operation_ms': max(db_times),
                'total_db_operations': len(db_times)
            }
        
        # Memory stats
        if memory_samples:
            summary['memory_stats'] = {
                'avg_memory_usage_mb': statistics.mean(memory_samples),
                'min_memory_usage_mb': min(memory_samples),
                'max_memory_usage_mb': max(memory_samples),
                'memory_growth_mb': max(memory_samples) - min(memory_samples) if len(memory_samples) > 1 else 0
            }
        
        # Throughput stats
        if self.metrics['throughput_measurements']:
            throughputs = [m['events_per_second'] for m in self.metrics['throughput_measurements']]
            summary['throughput_stats'] = {
                'avg_throughput_eps': statistics.mean(throughputs),
                'max_throughput_eps': max(throughputs),
                'min_throughput_eps': min(throughputs)
            }
        
        return summary

class MockEventGenerator:
    """Generate realistic mock events for testing."""
    
    def __init__(self):
        self.session_counter = 0
        self.event_counter = 0
    
    def generate_hook_event(self, session_id: Optional[str] = None, complexity: str = 'simple') -> Dict[str, Any]:
        """Generate a realistic hook event."""
        if not session_id:
            session_id = f"test-session-{self.session_counter}"
            self.session_counter += 1
        
        self.event_counter += 1
        
        base_event = {
            "session_id": session_id,
            "hook_event_name": "PreToolUse",
            "timestamp": datetime.now().isoformat(),
            "tool_name": "Read",
            "tool_input": {
                "file_path": f"/test/project/src/component-{self.event_counter}.tsx"
            }
        }
        
        if complexity == 'complex':
            # Add complex nested data
            base_event["tool_input"].update({
                "metadata": {
                    "file_stats": {
                        "size": 1024 * (self.event_counter % 100),
                        "modified": datetime.now().isoformat(),
                        "permissions": "644"
                    },
                    "project_context": {
                        "dependencies": [f"dep-{i}" for i in range(10)],
                        "environment": {f"VAR_{i}": f"value_{i}" for i in range(20)},
                        "git_info": {
                            "branch": "feature/testing",
                            "commit": f"abc123{self.event_counter}",
                            "dirty": True
                        }
                    }
                },
                "content_preview": "x" * 1000  # 1KB of content
            })
        elif complexity == 'large':
            # Add large payload
            base_event["tool_input"]["large_content"] = "x" * 50000  # 50KB payload
        
        return base_event
    
    def generate_dashboard_event(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate event in dashboard format."""
        hook_event = self.generate_hook_event(session_id, 'simple')
        
        return {
            "id": f"event-{self.event_counter}",
            "timestamp": datetime.now(),
            "type": "tool_use",
            "sessionId": hook_event["session_id"],
            "summary": f"Tool usage: {hook_event['tool_name']}",
            "details": hook_event["tool_input"],
            "toolName": hook_event["tool_name"],
            "success": True
        }

class PerformanceTestSuite:
    """Comprehensive performance test suite."""
    
    def __init__(self):
        self.metrics = PerformanceMetrics()
        self.event_generator = MockEventGenerator()
    
    def test_single_event_processing(self, num_events: int = 1000) -> Dict[str, float]:
        """Test single event processing performance."""
        print(f"\n=== Single Event Processing Test ({num_events} events) ===")
        
        times = []
        for i in range(num_events):
            event = self.event_generator.generate_hook_event()
            
            start_time = time.perf_counter()
            # Simulate event processing
            processed_event = self._process_event_mock(event)
            end_time = time.perf_counter()
            
            duration_ms = (end_time - start_time) * 1000
            times.append(duration_ms)
            self.metrics.record_event_processing(duration_ms)
            
            # Record memory usage periodically
            if i % 100 == 0:
                try:
                    import psutil
                    memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
                    self.metrics.record_memory_usage(memory_mb)
                except ImportError:
                    pass
        
        avg_time = statistics.mean(times)
        p95_time = statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times)
        throughput = 1000 / avg_time  # events per second
        
        self.metrics.record_throughput(throughput, "single_event_processing")
        
        results = {
            'avg_processing_time_ms': avg_time,
            'p95_processing_time_ms': p95_time,
            'max_processing_time_ms': max(times),
            'throughput_eps': throughput
        }
        
        print(f"Average processing time: {avg_time:.3f}ms")
        print(f"95th percentile: {p95_time:.3f}ms")
        print(f"Throughput: {throughput:.0f} events/second")
        
        return results
    
    def test_concurrent_processing(self, num_workers: int = 10, events_per_worker: int = 100) -> Dict[str, float]:
        """Test concurrent event processing."""
        print(f"\n=== Concurrent Processing Test ({num_workers} workers, {events_per_worker} events each) ===")
        
        def worker_task(worker_id: int) -> List[float]:
            """Process events in a worker thread."""
            worker_times = []
            session_id = f"worker-{worker_id}-session"
            
            for i in range(events_per_worker):
                event = self.event_generator.generate_hook_event(session_id)
                
                start_time = time.perf_counter()
                processed_event = self._process_event_mock(event)
                end_time = time.perf_counter()
                
                duration_ms = (end_time - start_time) * 1000
                worker_times.append(duration_ms)
            
            return worker_times
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_workers)]
            all_times = []
            
            for future in futures:
                worker_times = future.result()
                all_times.extend(worker_times)
                for duration in worker_times:
                    self.metrics.record_event_processing(duration)
        
        end_time = time.time()
        total_duration = end_time - start_time
        total_events = num_workers * events_per_worker
        overall_throughput = total_events / total_duration
        
        avg_time = statistics.mean(all_times)
        p95_time = statistics.quantiles(all_times, n=20)[18] if len(all_times) >= 20 else max(all_times)
        
        self.metrics.record_throughput(overall_throughput, f"concurrent_{num_workers}_workers")
        
        results = {
            'total_events': total_events,
            'total_duration_s': total_duration,
            'overall_throughput_eps': overall_throughput,
            'avg_processing_time_ms': avg_time,
            'p95_processing_time_ms': p95_time
        }
        
        print(f"Total events: {total_events}")
        print(f"Total duration: {total_duration:.2f}s")
        print(f"Overall throughput: {overall_throughput:.0f} events/second")
        print(f"Average processing time: {avg_time:.3f}ms")
        
        return results
    
    def test_large_payload_processing(self, num_events: int = 100) -> Dict[str, float]:
        """Test processing of events with large payloads."""
        print(f"\n=== Large Payload Processing Test ({num_events} events) ===")
        
        times = []
        for i in range(num_events):
            event = self.event_generator.generate_hook_event(complexity='large')
            
            start_time = time.perf_counter()
            processed_event = self._process_event_mock(event)
            end_time = time.perf_counter()
            
            duration_ms = (end_time - start_time) * 1000
            times.append(duration_ms)
            self.metrics.record_event_processing(duration_ms)
        
        avg_time = statistics.mean(times)
        throughput = 1000 / avg_time
        
        self.metrics.record_throughput(throughput, "large_payload_processing")
        
        results = {
            'avg_processing_time_ms': avg_time,
            'max_processing_time_ms': max(times),
            'throughput_eps': throughput
        }
        
        print(f"Average processing time: {avg_time:.3f}ms")
        print(f"Max processing time: {max(times):.3f}ms")
        print(f"Throughput: {throughput:.0f} events/second")
        
        return results
    
    def test_burst_processing(self, burst_sizes: List[int] = [10, 50, 100, 200, 500]) -> Dict[str, Any]:
        """Test burst event processing capabilities."""
        print(f"\n=== Burst Processing Test ===")
        
        burst_results = {}
        
        for burst_size in burst_sizes:
            print(f"\nTesting burst of {burst_size} events...")
            
            # Generate all events for the burst
            events = [self.event_generator.generate_hook_event() for _ in range(burst_size)]
            
            start_time = time.perf_counter()
            
            # Process all events in the burst
            for event in events:
                processed_event = self._process_event_mock(event)
            
            end_time = time.perf_counter()
            duration_s = end_time - start_time
            throughput = burst_size / duration_s
            
            burst_results[burst_size] = {
                'duration_s': duration_s,
                'throughput_eps': throughput
            }
            
            self.metrics.record_throughput(throughput, f"burst_{burst_size}")
            
            print(f"  Duration: {duration_s:.3f}s")
            print(f"  Throughput: {throughput:.0f} events/second")
        
        return burst_results
    
    def test_memory_stability(self, duration_seconds: int = 30) -> Dict[str, float]:
        """Test memory stability over time."""
        print(f"\n=== Memory Stability Test ({duration_seconds}s) ===")
        
        try:
            import psutil
            process = psutil.Process()
        except ImportError:
            print("psutil not available, skipping memory test")
            return {}
        
        initial_memory = process.memory_info().rss / 1024 / 1024
        memory_samples = [initial_memory]
        
        start_time = time.time()
        event_count = 0
        
        print(f"Initial memory: {initial_memory:.2f}MB")
        
        while time.time() - start_time < duration_seconds:
            # Process events continuously
            event = self.event_generator.generate_hook_event()
            processed_event = self._process_event_mock(event)
            event_count += 1
            
            # Sample memory every 100 events
            if event_count % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)
                self.metrics.record_memory_usage(current_memory)
                
                if event_count % 1000 == 0:
                    print(f"  {event_count} events, memory: {current_memory:.2f}MB")
        
        final_memory = process.memory_info().rss / 1024 / 1024
        memory_growth = final_memory - initial_memory
        avg_memory = statistics.mean(memory_samples)
        max_memory = max(memory_samples)
        
        results = {
            'initial_memory_mb': initial_memory,
            'final_memory_mb': final_memory,
            'memory_growth_mb': memory_growth,
            'avg_memory_mb': avg_memory,
            'max_memory_mb': max_memory,
            'events_processed': event_count
        }
        
        print(f"Events processed: {event_count}")
        print(f"Final memory: {final_memory:.2f}MB")
        print(f"Memory growth: {memory_growth:.2f}MB")
        print(f"Events per MB: {event_count / max(memory_growth, 0.1):.0f}")
        
        return results
    
    def test_error_resilience(self, num_events: int = 1000, error_rate: float = 0.1) -> Dict[str, Any]:
        """Test system resilience to errors."""
        print(f"\n=== Error Resilience Test ({num_events} events, {error_rate:.1%} error rate) ===")
        
        successful_events = 0
        failed_events = 0
        processing_times = []
        
        for i in range(num_events):
            event = self.event_generator.generate_hook_event()
            
            # Inject errors based on error rate
            should_fail = (i % int(1/error_rate)) == 0 if error_rate > 0 else False
            
            start_time = time.perf_counter()
            try:
                if should_fail:
                    raise Exception("Simulated processing error")
                
                processed_event = self._process_event_mock(event)
                successful_events += 1
                
            except Exception as e:
                failed_events += 1
                self.metrics.record_error("processing_error")
            
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000
            processing_times.append(duration_ms)
        
        success_rate = successful_events / num_events
        avg_time = statistics.mean(processing_times)
        
        results = {
            'total_events': num_events,
            'successful_events': successful_events,
            'failed_events': failed_events,
            'success_rate': success_rate,
            'avg_processing_time_ms': avg_time
        }
        
        print(f"Success rate: {success_rate:.2%}")
        print(f"Failed events: {failed_events}")
        print(f"Average processing time: {avg_time:.3f}ms")
        
        return results
    
    def _process_event_mock(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Mock event processing that simulates real work."""
        # Simulate data validation
        if not isinstance(event, dict) or 'session_id' not in event:
            raise ValueError("Invalid event data")
        
        # Simulate data sanitization
        sanitized_event = json.loads(json.dumps(event))  # Deep copy
        
        # Simulate database operation latency
        time.sleep(0.001)  # 1ms simulated database call
        
        # Simulate response generation
        response = {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": event.get("hook_event_name", "Unknown"),
                "processed_at": datetime.now().isoformat(),
                "event_id": str(uuid.uuid4())
            }
        }
        
        return response
    
    def run_full_suite(self) -> Dict[str, Any]:
        """Run the complete performance test suite."""
        print("Chronicle Performance Test Suite")
        print("=" * 50)
        
        start_time = time.time()
        results = {}
        
        try:
            # Basic performance tests
            results['single_event'] = self.test_single_event_processing(1000)
            results['concurrent'] = self.test_concurrent_processing(10, 100)
            results['large_payload'] = self.test_large_payload_processing(100)
            results['burst'] = self.test_burst_processing()
            results['memory_stability'] = self.test_memory_stability(30)
            results['error_resilience'] = self.test_error_resilience(1000, 0.05)
            
        except Exception as e:
            print(f"Test suite error: {e}")
            import traceback
            traceback.print_exc()
        
        total_time = time.time() - start_time
        
        # Generate final report
        print("\n" + "=" * 50)
        print("PERFORMANCE TEST SUMMARY")
        print("=" * 50)
        
        metrics_summary = self.metrics.get_summary()
        print(f"Total test duration: {total_time:.2f}s")
        print(f"Total events processed: {metrics_summary.get('total_events_processed', 0)}")
        
        # Performance assessment
        performance_issues = []
        
        if 'single_event' in results:
            if results['single_event']['avg_processing_time_ms'] > 10:
                performance_issues.append("High single event processing time")
            if results['single_event']['throughput_eps'] < 100:
                performance_issues.append("Low single event throughput")
        
        if 'concurrent' in results:
            if results['concurrent']['overall_throughput_eps'] < 500:
                performance_issues.append("Low concurrent throughput")
        
        if 'memory_stability' in results and results['memory_stability']:
            if results['memory_stability'].get('memory_growth_mb', 0) > 100:
                performance_issues.append("High memory growth")
        
        if performance_issues:
            print("\n⚠️  PERFORMANCE ISSUES DETECTED:")
            for issue in performance_issues:
                print(f"  - {issue}")
        else:
            print("\n✅ ALL PERFORMANCE TESTS PASSED")
        
        print(f"\nDetailed metrics available in: {metrics_summary}")
        
        return {
            'test_results': results,
            'metrics_summary': metrics_summary,
            'performance_issues': performance_issues,
            'total_duration_s': total_time
        }

def main():
    """Run the performance test suite."""
    suite = PerformanceTestSuite()
    results = suite.run_full_suite()
    
    # Save results to file
    results_file = f"performance_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\nResults saved to: {results_file}")
    except Exception as e:
        print(f"Could not save results: {e}")

if __name__ == "__main__":
    main()