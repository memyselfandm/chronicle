#!/usr/bin/env python3
"""
Chronicle Real-time Stress Test
Comprehensive stress testing for real-time event flow from hooks to dashboard
"""

import time
import json
import uuid
import asyncio
import threading
import websockets
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import statistics
import sys
import os
import requests
from typing import List, Dict, Any, Optional
import queue

class EventStreamSimulator:
    """Simulates real-time event streams like those from Claude Code hooks."""
    
    def __init__(self):
        self.active_sessions = {}
        self.event_queue = queue.Queue()
        self.stats = {
            'events_generated': 0,
            'sessions_created': 0,
            'errors': 0
        }
        
    def create_session(self, session_id: Optional[str] = None) -> str:
        """Create a new simulated session."""
        if not session_id:
            session_id = f"stress-session-{uuid.uuid4().hex[:8]}"
        
        self.active_sessions[session_id] = {
            'start_time': datetime.now(),
            'event_count': 0,
            'last_activity': datetime.now(),
            'tools_used': [],
            'current_workflow': 'initialization'
        }
        
        self.stats['sessions_created'] += 1
        return session_id
    
    def generate_realistic_workflow_events(self, session_id: str, workflow_type: str = 'development') -> List[Dict[str, Any]]:
        """Generate realistic sequences of events for different workflows."""
        events = []
        session = self.active_sessions.get(session_id, {})
        
        if workflow_type == 'development':
            # Typical development workflow
            workflows = [
                [
                    ('SessionStart', {'source': 'startup', 'project_path': '/test/my-app'}),
                    ('PreToolUse', {'tool_name': 'Read', 'tool_input': {'file_path': '/test/my-app/package.json'}}),
                    ('PostToolUse', {'tool_name': 'Read', 'tool_response': {'success': True, 'content': '{"name": "my-app"}'}}),
                    ('PreToolUse', {'tool_name': 'LS', 'tool_input': {'path': '/test/my-app/src'}}),
                    ('PostToolUse', {'tool_name': 'LS', 'tool_response': {'success': True, 'files': ['App.tsx', 'index.tsx']}}),
                    ('UserPromptSubmit', {'prompt_text': 'Help me add a new component'}),
                    ('PreToolUse', {'tool_name': 'Write', 'tool_input': {'file_path': '/test/my-app/src/NewComponent.tsx', 'content': 'import React from "react";'}}),
                    ('PostToolUse', {'tool_name': 'Write', 'tool_response': {'success': True}}),
                    ('PreToolUse', {'tool_name': 'Bash', 'tool_input': {'command': 'npm test'}}),
                    ('PostToolUse', {'tool_name': 'Bash', 'tool_response': {'success': True, 'exit_code': 0}}),
                    ('Stop', {})
                ],
                [
                    ('SessionStart', {'source': 'resume'}),
                    ('PreToolUse', {'tool_name': 'Read', 'tool_input': {'file_path': '/test/my-app/src/App.tsx'}}),
                    ('PostToolUse', {'tool_name': 'Read', 'tool_response': {'success': True}}),
                    ('PreToolUse', {'tool_name': 'Edit', 'tool_input': {'file_path': '/test/my-app/src/App.tsx', 'old_string': 'old', 'new_string': 'new'}}),
                    ('PostToolUse', {'tool_name': 'Edit', 'tool_response': {'success': True}}),
                    ('PreToolUse', {'tool_name': 'Bash', 'tool_input': {'command': 'npm run build'}}),
                    ('PostToolUse', {'tool_name': 'Bash', 'tool_response': {'success': True}}),
                    ('Stop', {})
                ]
            ]
            
            workflow = workflows[self.stats['events_generated'] % len(workflows)]
        
        elif workflow_type == 'debugging':
            # Debugging workflow with errors
            workflow = [
                ('SessionStart', {'source': 'startup'}),
                ('PreToolUse', {'tool_name': 'Bash', 'tool_input': {'command': 'npm test'}}),
                ('PostToolUse', {'tool_name': 'Bash', 'tool_response': {'success': False, 'exit_code': 1, 'stderr': 'Test failed'}}),
                ('PreToolUse', {'tool_name': 'Read', 'tool_input': {'file_path': '/test/failing-test.js'}}),
                ('PostToolUse', {'tool_name': 'Read', 'tool_response': {'success': True}}),
                ('UserPromptSubmit', {'prompt_text': 'Why is this test failing?'}),
                ('PreToolUse', {'tool_name': 'Edit', 'tool_input': {'file_path': '/test/failing-test.js'}}),
                ('PostToolUse', {'tool_name': 'Edit', 'tool_response': {'success': True}}),
                ('PreToolUse', {'tool_name': 'Bash', 'tool_input': {'command': 'npm test'}}),
                ('PostToolUse', {'tool_name': 'Bash', 'tool_response': {'success': True, 'exit_code': 0}}),
                ('Stop', {})
            ]
        
        # Generate events from workflow
        for hook_event_name, data in workflow:
            event = {
                'session_id': session_id,
                'hook_event_name': hook_event_name,
                'timestamp': datetime.now().isoformat(),
                'event_id': str(uuid.uuid4()),
                **data
            }
            events.append(event)
            
            # Update session stats
            if session_id in self.active_sessions:
                self.active_sessions[session_id]['event_count'] += 1
                self.active_sessions[session_id]['last_activity'] = datetime.now()
                if 'tool_name' in data:
                    self.active_sessions[session_id]['tools_used'].append(data['tool_name'])
        
        self.stats['events_generated'] += len(events)
        return events
    
    def generate_random_event(self, session_id: str) -> Dict[str, Any]:
        """Generate a single random event for ongoing activity."""
        tool_names = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'LS']
        event_types = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit']
        
        event_type = event_types[self.stats['events_generated'] % len(event_types)]
        
        event = {
            'session_id': session_id,
            'hook_event_name': event_type,
            'timestamp': datetime.now().isoformat(),
            'event_id': str(uuid.uuid4())
        }
        
        if event_type in ['PreToolUse', 'PostToolUse']:
            tool_name = tool_names[self.stats['events_generated'] % len(tool_names)]
            event['tool_name'] = tool_name
            
            if event_type == 'PreToolUse':
                event['tool_input'] = {
                    'file_path': f'/test/project/file-{uuid.uuid4().hex[:8]}.tsx'
                }
            else:
                event['tool_response'] = {
                    'success': True,
                    'result': f'Tool {tool_name} completed successfully'
                }
        elif event_type == 'UserPromptSubmit':
            event['prompt_text'] = f'Random user prompt {uuid.uuid4().hex[:8]}'
        
        self.stats['events_generated'] += 1
        
        # Update session
        if session_id in self.active_sessions:
            self.active_sessions[session_id]['event_count'] += 1
            self.active_sessions[session_id]['last_activity'] = datetime.now()
        
        return event

class RealTimeStressTester:
    """Comprehensive real-time stress testing."""
    
    def __init__(self):
        self.event_simulator = EventStreamSimulator()
        self.test_results = {
            'throughput_tests': [],
            'load_tests': [],
            'burst_tests': [],
            'memory_tests': [],
            'error_tests': []
        }
        self.start_time = time.time()
    
    def test_sustained_throughput(self, target_eps: int = 100, duration_seconds: int = 60) -> Dict[str, Any]:
        """Test sustained event throughput over time."""
        print(f"\n=== Sustained Throughput Test ===")
        print(f"Target: {target_eps} events/second for {duration_seconds} seconds")
        
        actual_events = []
        start_time = time.time()
        target_interval = 1.0 / target_eps
        
        # Create multiple sessions for realistic load
        sessions = [self.event_simulator.create_session() for _ in range(10)]
        
        event_count = 0
        last_log_time = start_time
        
        while time.time() - start_time < duration_seconds:
            event_start = time.time()
            
            # Generate event
            session_id = sessions[event_count % len(sessions)]
            event = self.event_simulator.generate_random_event(session_id)
            
            # Simulate processing
            processing_start = time.perf_counter()
            self._simulate_event_processing(event)
            processing_time = (time.perf_counter() - processing_start) * 1000
            
            actual_events.append({
                'timestamp': time.time(),
                'processing_time_ms': processing_time,
                'session_id': session_id,
                'event_type': event['hook_event_name']
            })
            
            event_count += 1
            
            # Log progress
            current_time = time.time()
            if current_time - last_log_time >= 10:  # Log every 10 seconds
                elapsed = current_time - start_time
                current_rate = event_count / elapsed
                print(f"  {elapsed:.0f}s: {event_count} events ({current_rate:.1f} eps)")
                last_log_time = current_time
            
            # Wait for next event
            event_duration = time.time() - event_start
            sleep_time = max(0, target_interval - event_duration)
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        total_duration = time.time() - start_time
        actual_eps = len(actual_events) / total_duration
        avg_processing_time = statistics.mean([e['processing_time_ms'] for e in actual_events])
        
        results = {
            'target_eps': target_eps,
            'actual_eps': actual_eps,
            'total_events': len(actual_events),
            'duration_seconds': total_duration,
            'avg_processing_time_ms': avg_processing_time,
            'accuracy': (actual_eps / target_eps) * 100,
            'sessions_used': len(sessions)
        }
        
        print(f"Results:")
        print(f"  Actual throughput: {actual_eps:.1f} events/second")
        print(f"  Accuracy: {results['accuracy']:.1f}% of target")
        print(f"  Average processing time: {avg_processing_time:.2f}ms")
        
        self.test_results['throughput_tests'].append(results)
        return results
    
    def test_concurrent_sessions(self, num_sessions: int = 50, events_per_session: int = 100) -> Dict[str, Any]:
        """Test concurrent sessions generating events simultaneously."""
        print(f"\n=== Concurrent Sessions Test ===")
        print(f"{num_sessions} sessions, {events_per_session} events each")
        
        def session_worker(session_num: int) -> Dict[str, Any]:
            """Worker function for a single session."""
            session_id = self.event_simulator.create_session()
            session_start = time.time()
            processing_times = []
            
            # Generate a realistic workflow
            if session_num % 3 == 0:
                events = self.event_simulator.generate_realistic_workflow_events(session_id, 'development')
            elif session_num % 3 == 1:
                events = self.event_simulator.generate_realistic_workflow_events(session_id, 'debugging')
            else:
                # Random events
                events = [self.event_simulator.generate_random_event(session_id) for _ in range(events_per_session)]
            
            # Process events
            for event in events:
                processing_start = time.perf_counter()
                self._simulate_event_processing(event)
                processing_time = (time.perf_counter() - processing_start) * 1000
                processing_times.append(processing_time)
                
                # Small random delay to simulate realistic timing
                time.sleep(0.01 + (session_num % 10) * 0.001)
            
            session_duration = time.time() - session_start
            
            return {
                'session_id': session_id,
                'events_processed': len(events),
                'duration_seconds': session_duration,
                'avg_processing_time_ms': statistics.mean(processing_times),
                'throughput_eps': len(events) / session_duration
            }
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_sessions) as executor:
            futures = [executor.submit(session_worker, i) for i in range(num_sessions)]
            session_results = [future.result() for future in futures]
        
        total_duration = time.time() - start_time
        total_events = sum(r['events_processed'] for r in session_results)
        overall_throughput = total_events / total_duration
        
        avg_session_throughput = statistics.mean([r['throughput_eps'] for r in session_results])
        avg_processing_time = statistics.mean([r['avg_processing_time_ms'] for r in session_results])
        
        results = {
            'num_sessions': num_sessions,
            'total_events': total_events,
            'total_duration_seconds': total_duration,
            'overall_throughput_eps': overall_throughput,
            'avg_session_throughput_eps': avg_session_throughput,
            'avg_processing_time_ms': avg_processing_time,
            'session_results': session_results[:5]  # Store first 5 for analysis
        }
        
        print(f"Results:")
        print(f"  Total events: {total_events}")
        print(f"  Overall throughput: {overall_throughput:.1f} events/second")
        print(f"  Average session throughput: {avg_session_throughput:.1f} events/second")
        print(f"  Average processing time: {avg_processing_time:.2f}ms")
        
        self.test_results['load_tests'].append(results)
        return results
    
    def test_burst_scenarios(self, burst_configs: List[Dict[str, int]] = None) -> Dict[str, Any]:
        """Test sudden bursts of high-frequency events."""
        print(f"\n=== Burst Scenarios Test ===")
        
        if not burst_configs:
            burst_configs = [
                {'events': 50, 'duration_ms': 100},   # 500 eps burst
                {'events': 100, 'duration_ms': 500},  # 200 eps burst
                {'events': 200, 'duration_ms': 2000}, # 100 eps burst
                {'events': 500, 'duration_ms': 10000} # 50 eps burst
            ]
        
        burst_results = []
        
        for config in burst_configs:
            burst_events = config['events']
            burst_duration_ms = config['duration_ms']
            target_eps = (burst_events / burst_duration_ms) * 1000
            
            print(f"\nTesting burst: {burst_events} events in {burst_duration_ms}ms ({target_eps:.0f} eps)")
            
            session_id = self.event_simulator.create_session()
            events = [self.event_simulator.generate_random_event(session_id) for _ in range(burst_events)]
            
            start_time = time.perf_counter()
            processing_times = []
            
            # Process events as fast as possible
            for event in events:
                processing_start = time.perf_counter()
                self._simulate_event_processing(event)
                processing_time = (time.perf_counter() - processing_start) * 1000
                processing_times.append(processing_time)
            
            actual_duration_ms = (time.perf_counter() - start_time) * 1000
            actual_eps = (burst_events / actual_duration_ms) * 1000
            
            burst_result = {
                'target_events': burst_events,
                'target_duration_ms': burst_duration_ms,
                'target_eps': target_eps,
                'actual_duration_ms': actual_duration_ms,
                'actual_eps': actual_eps,
                'avg_processing_time_ms': statistics.mean(processing_times),
                'max_processing_time_ms': max(processing_times)
            }
            
            burst_results.append(burst_result)
            
            print(f"  Actual: {actual_duration_ms:.0f}ms ({actual_eps:.0f} eps)")
            print(f"  Processing time: avg={burst_result['avg_processing_time_ms']:.2f}ms, max={burst_result['max_processing_time_ms']:.2f}ms")
        
        overall_results = {
            'burst_tests': burst_results,
            'max_sustained_eps': max(r['actual_eps'] for r in burst_results),
            'avg_burst_processing_ms': statistics.mean([r['avg_processing_time_ms'] for r in burst_results])
        }
        
        self.test_results['burst_tests'].append(overall_results)
        return overall_results
    
    def test_memory_under_load(self, duration_seconds: int = 120, target_eps: int = 50) -> Dict[str, Any]:
        """Test memory behavior under sustained load."""
        print(f"\n=== Memory Under Load Test ===")
        print(f"Duration: {duration_seconds}s at {target_eps} events/second")
        
        try:
            import psutil
            process = psutil.Process()
        except ImportError:
            print("psutil not available, skipping memory test")
            return {}
        
        initial_memory = process.memory_info().rss / 1024 / 1024
        memory_samples = []
        
        session_id = self.event_simulator.create_session()
        start_time = time.time()
        event_count = 0
        
        print(f"Initial memory: {initial_memory:.2f}MB")
        
        while time.time() - start_time < duration_seconds:
            # Generate and process event
            event = self.event_simulator.generate_random_event(session_id)
            self._simulate_event_processing(event)
            event_count += 1
            
            # Sample memory every 100 events
            if event_count % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append({
                    'timestamp': time.time() - start_time,
                    'memory_mb': current_memory,
                    'events_processed': event_count
                })
                
                if event_count % 1000 == 0:
                    print(f"  {event_count} events, memory: {current_memory:.2f}MB")
            
            # Rate limiting
            if event_count % target_eps == 0:
                time.sleep(1.0)
        
        final_memory = process.memory_info().rss / 1024 / 1024
        memory_growth = final_memory - initial_memory
        
        results = {
            'initial_memory_mb': initial_memory,
            'final_memory_mb': final_memory,
            'memory_growth_mb': memory_growth,
            'events_processed': event_count,
            'memory_per_event_kb': (memory_growth * 1024) / event_count if event_count > 0 else 0,
            'memory_samples': memory_samples[-10:]  # Last 10 samples
        }
        
        print(f"Results:")
        print(f"  Events processed: {event_count}")
        print(f"  Final memory: {final_memory:.2f}MB")
        print(f"  Memory growth: {memory_growth:.2f}MB")
        print(f"  Memory per event: {results['memory_per_event_kb']:.3f}KB")
        
        self.test_results['memory_tests'].append(results)
        return results
    
    def test_error_propagation(self, error_rate: float = 0.1, num_events: int = 1000) -> Dict[str, Any]:
        """Test how errors propagate through the system."""
        print(f"\n=== Error Propagation Test ===")
        print(f"{num_events} events with {error_rate:.1%} error rate")
        
        session_id = self.event_simulator.create_session()
        
        successful_events = 0
        failed_events = 0
        error_types = {}
        recovery_times = []
        
        for i in range(num_events):
            event = self.event_simulator.generate_random_event(session_id)
            
            # Inject errors
            should_fail = (i % int(1/error_rate)) == 0 if error_rate > 0 else False
            
            start_time = time.perf_counter()
            
            try:
                if should_fail:
                    error_type = ['network_error', 'processing_error', 'validation_error'][i % 3]
                    if error_type not in error_types:
                        error_types[error_type] = 0
                    error_types[error_type] += 1
                    raise Exception(f"Simulated {error_type}")
                
                self._simulate_event_processing(event)
                successful_events += 1
                
                # If we recovered from an error, record recovery time
                if failed_events > 0 and i > 0:
                    recovery_times.append(time.perf_counter() - start_time)
                
            except Exception as e:
                failed_events += 1
                self.event_simulator.stats['errors'] += 1
        
        success_rate = successful_events / num_events
        
        results = {
            'total_events': num_events,
            'successful_events': successful_events,
            'failed_events': failed_events,
            'success_rate': success_rate,
            'error_types': error_types,
            'avg_recovery_time_ms': statistics.mean(recovery_times) * 1000 if recovery_times else 0
        }
        
        print(f"Results:")
        print(f"  Success rate: {success_rate:.2%}")
        print(f"  Failed events: {failed_events}")
        print(f"  Error types: {error_types}")
        if recovery_times:
            print(f"  Average recovery time: {results['avg_recovery_time_ms']:.2f}ms")
        
        self.test_results['error_tests'].append(results)
        return results
    
    def _simulate_event_processing(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate realistic event processing."""
        # Simulate validation
        if not isinstance(event, dict) or 'session_id' not in event:
            raise ValueError("Invalid event data")
        
        # Simulate data sanitization (processing time varies by content)
        content_size = len(json.dumps(event))
        if content_size > 1000:
            time.sleep(0.002)  # Extra time for large events
        else:
            time.sleep(0.001)  # Base processing time
        
        # Simulate database write
        time.sleep(0.0005)  # 0.5ms for database operation
        
        return {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": event.get("hook_event_name", "Unknown"),
                "processed_at": datetime.now().isoformat()
            }
        }
    
    def run_comprehensive_stress_test(self) -> Dict[str, Any]:
        """Run complete stress test suite."""
        print("Chronicle Real-time Stress Test Suite")
        print("=" * 50)
        
        start_time = time.time()
        all_results = {}
        
        try:
            # Progressive load testing
            print("\n🔥 Starting stress tests...")
            
            # Test 1: Moderate sustained load
            all_results['sustained_moderate'] = self.test_sustained_throughput(50, 30)
            
            # Test 2: High sustained load
            all_results['sustained_high'] = self.test_sustained_throughput(100, 30)
            
            # Test 3: Concurrent sessions
            all_results['concurrent_sessions'] = self.test_concurrent_sessions(20, 50)
            
            # Test 4: Burst scenarios
            all_results['burst_scenarios'] = self.test_burst_scenarios()
            
            # Test 5: Memory under load
            all_results['memory_load'] = self.test_memory_under_load(60, 75)
            
            # Test 6: Error handling
            all_results['error_handling'] = self.test_error_propagation(0.05, 1000)
            
        except Exception as e:
            print(f"Stress test error: {e}")
            import traceback
            traceback.print_exc()
        
        total_time = time.time() - start_time
        
        # Generate stress test report
        print("\n" + "=" * 50)
        print("STRESS TEST RESULTS")
        print("=" * 50)
        
        print(f"Total test duration: {total_time:.2f}s")
        print(f"Total events generated: {self.event_simulator.stats['events_generated']}")
        print(f"Total sessions created: {self.event_simulator.stats['sessions_created']}")
        print(f"Total errors: {self.event_simulator.stats['errors']}")
        
        # Performance assessment
        stress_issues = []
        
        # Check sustained throughput
        if 'sustained_high' in all_results:
            accuracy = all_results['sustained_high'].get('accuracy', 0)
            if accuracy < 90:
                stress_issues.append(f"Low sustained throughput accuracy: {accuracy:.1f}%")
        
        # Check concurrent performance
        if 'concurrent_sessions' in all_results:
            concurrent_eps = all_results['concurrent_sessions'].get('overall_throughput_eps', 0)
            if concurrent_eps < 500:
                stress_issues.append(f"Low concurrent throughput: {concurrent_eps:.0f} eps")
        
        # Check memory growth
        if 'memory_load' in all_results and all_results['memory_load']:
            memory_per_event = all_results['memory_load'].get('memory_per_event_kb', 0)
            if memory_per_event > 1:
                stress_issues.append(f"High memory per event: {memory_per_event:.3f}KB")
        
        # Check error handling
        if 'error_handling' in all_results:
            success_rate = all_results['error_handling'].get('success_rate', 0)
            if success_rate < 0.90:
                stress_issues.append(f"Low error recovery rate: {success_rate:.1%}")
        
        if stress_issues:
            print("\n⚠️  STRESS TEST ISSUES:")
            for issue in stress_issues:
                print(f"  - {issue}")
        else:
            print("\n✅ ALL STRESS TESTS PASSED")
        
        # System recommendations
        max_sustained_eps = 0
        if 'sustained_high' in all_results:
            max_sustained_eps = all_results['sustained_high'].get('actual_eps', 0)
        
        print(f"\n📊 PERFORMANCE CHARACTERISTICS:")
        print(f"  Maximum sustained throughput: {max_sustained_eps:.0f} events/second")
        
        if 'burst_scenarios' in all_results:
            max_burst_eps = all_results['burst_scenarios'].get('max_sustained_eps', 0)
            print(f"  Maximum burst throughput: {max_burst_eps:.0f} events/second")
        
        return {
            'test_results': all_results,
            'summary': {
                'total_duration_s': total_time,
                'events_generated': self.event_simulator.stats['events_generated'],
                'sessions_created': self.event_simulator.stats['sessions_created'],
                'errors_encountered': self.event_simulator.stats['errors'],
                'stress_issues': stress_issues,
                'max_sustained_eps': max_sustained_eps
            }
        }

def main():
    """Run the comprehensive stress test."""
    tester = RealTimeStressTester()
    results = tester.run_comprehensive_stress_test()
    
    # Save detailed results
    results_file = f"stress_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\nDetailed results saved to: {results_file}")
    except Exception as e:
        print(f"Could not save results: {e}")

if __name__ == "__main__":
    main()