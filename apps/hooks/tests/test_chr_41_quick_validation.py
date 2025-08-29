#!/usr/bin/env python3
"""
CHR-41 Quick Validation Test - Auto-start/stop Mechanism
=======================================================

Quick validation test to ensure the server manager and hook integration
work correctly without full uv script execution overhead.

Author: C-Codey aka curl Stevens aka SWE-40
"""

import json
import os
import sys
import time
from pathlib import Path

# Add src to path
current_dir = Path(__file__).parent
src_dir = current_dir.parent / "src"
sys.path.insert(0, str(src_dir))

from lib.server_manager import (
    start_chronicle_server_if_needed,
    stop_chronicle_server_session,
    get_chronicle_server_status,
    ChronicleServerManager
)
from lib.health_check import run_quick_health_check


def test_server_manager_imports():
    """Test that all server manager functions can be imported and called."""
    print("🔍 Testing server manager imports...")
    
    try:
        # Test basic functions
        status = get_chronicle_server_status()
        print(f"✅ get_chronicle_server_status() works: {type(status)} returned")
        
        # Test non-blocking start (should be very fast)
        start_time = time.perf_counter()
        result = start_chronicle_server_if_needed("test-session")
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        print(f"✅ start_chronicle_server_if_needed() works: {result} in {execution_time_ms:.2f}ms")
        
        if execution_time_ms > 100:
            print(f"⚠️  Warning: Function took {execution_time_ms:.2f}ms (>100ms limit)")
        
        # Test stop
        start_time = time.perf_counter()
        stop_chronicle_server_session("test-session")
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        print(f"✅ stop_chronicle_server_session() works in {execution_time_ms:.2f}ms")
        
        return True
        
    except Exception as e:
        print(f"❌ Server manager test failed: {e}")
        return False


def test_server_manager_class():
    """Test server manager class functionality."""
    print("\n🔍 Testing server manager class...")
    
    try:
        manager = ChronicleServerManager()
        
        # Test initialization
        print(f"✅ ChronicleServerManager created successfully")
        print(f"  - PID file path: {manager.pid_file_path}")
        print(f"  - Server script path: {manager.server_script_path}")
        print(f"  - Active sessions: {len(manager.active_sessions)}")
        
        # Test status check
        status = manager.get_server_status()
        print(f"✅ get_server_status() works: running={status['running']}")
        
        # Test server detection
        is_running, pid = manager.is_server_running()
        print(f"✅ is_server_running() works: running={is_running}, pid={pid}")
        
        return True
        
    except Exception as e:
        print(f"❌ Server manager class test failed: {e}")
        return False


def test_health_check():
    """Test health check functionality."""
    print("\n🔍 Testing health check...")
    
    try:
        start_time = time.perf_counter()
        result = run_quick_health_check()
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        print(f"✅ run_quick_health_check() works: {result} in {execution_time_ms:.2f}ms")
        
        return True
        
    except Exception as e:
        print(f"❌ Health check test failed: {e}")
        return False


def test_performance_requirements():
    """Test that performance requirements are met."""
    print("\n🔍 Testing performance requirements...")
    
    try:
        # Test multiple calls to ensure consistency
        times = []
        
        for i in range(5):
            start_time = time.perf_counter()
            start_chronicle_server_if_needed(f"perf-test-{i}")
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            times.append(execution_time_ms)
            
            stop_chronicle_server_session(f"perf-test-{i}")
        
        avg_time = sum(times) / len(times)
        max_time = max(times)
        
        print(f"✅ Performance test completed:")
        print(f"  - Average execution time: {avg_time:.2f}ms")
        print(f"  - Maximum execution time: {max_time:.2f}ms")
        print(f"  - All times: {[f'{t:.1f}' for t in times]}ms")
        
        meets_requirement = max_time < 100
        print(f"  - Meets <100ms requirement: {'✅ YES' if meets_requirement else '❌ NO'}")
        
        return meets_requirement
        
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False


def test_error_handling():
    """Test error handling."""
    print("\n🔍 Testing error handling...")
    
    try:
        # Test with invalid session IDs
        test_cases = ["", None, 123, [], {}]
        
        for i, invalid_input in enumerate(test_cases):
            try:
                start_chronicle_server_if_needed(invalid_input)
                stop_chronicle_server_session(invalid_input)
                print(f"✅ Handled invalid input {i+1}: {type(invalid_input).__name__}")
            except Exception as e:
                print(f"❌ Failed with invalid input {i+1} ({type(invalid_input).__name__}): {e}")
                return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False


def main():
    """Run quick validation tests."""
    print("🚀 CHR-41 Quick Validation Test")
    print("Testing auto-start/stop mechanism implementation")
    print("=" * 60)
    
    tests = [
        ("Server Manager Imports", test_server_manager_imports),
        ("Server Manager Class", test_server_manager_class),
        ("Health Check", test_health_check),
        ("Performance Requirements", test_performance_requirements),
        ("Error Handling", test_error_handling),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 40)
        success = test_func()
        results.append((test_name, success))
        print(f"Result: {'✅ PASSED' if success else '❌ FAILED'}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 CHR-41 QUICK VALIDATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    print(f"Tests Passed: {passed}/{total}")
    print(f"Success Rate: {passed/total*100:.1f}%")
    
    print("\nDetailed Results:")
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} {test_name}")
    
    overall_success = all(success for _, success in results)
    
    print(f"\nOverall Status: {'✅ SUCCESS' if overall_success else '❌ FAILED'}")
    print("=" * 60)
    
    if overall_success:
        print("\n🎉 CHR-41 implementation is ready!")
        print("Non-blocking auto-start/stop mechanism working correctly.")
    else:
        print("\n⚠️ Some tests failed - implementation needs attention.")
    
    return 0 if overall_success else 1


if __name__ == "__main__":
    sys.exit(main())