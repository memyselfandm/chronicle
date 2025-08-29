#!/usr/bin/env python3
"""
CHR-41 Integration Test - Auto-start/stop Mechanism End-to-End Validation
=========================================================================

Integration test to validate the complete auto-start/stop mechanism works
correctly with the modified session_start.py and stop.py hooks.

This test simulates real Claude Code hook execution to ensure:
- Hooks execute without errors
- Server management integrates properly
- Performance requirements are met
- No blocking behavior occurs

Author: C-Codey aka curl Stevens aka SWE-40
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict

# Test configuration
TEST_SESSION_ID = "chr-41-integration-test"
HOOKS_DIR = Path(__file__).parent.parent / "src" / "hooks"
MAX_HOOK_EXECUTION_TIME_MS = 100


class CHR41IntegrationTester:
    """Integration tester for CHR-41 auto-start/stop mechanism."""
    
    def __init__(self):
        """Initialize the integration tester."""
        self.results = {}
        self.session_start_script = HOOKS_DIR / "session_start.py"
        self.stop_script = HOOKS_DIR / "stop.py"
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all integration tests and return results."""
        print("🧪 Running CHR-41 Integration Tests...")
        print("=" * 60)
        
        # Test 1: Hook script existence
        self.results["hook_files"] = self.test_hook_files_exist()
        
        # Test 2: Session start hook execution
        self.results["session_start_hook"] = self.test_session_start_hook()
        
        # Test 3: Stop hook execution
        self.results["stop_hook"] = self.test_stop_hook()
        
        # Test 4: Performance validation
        self.results["performance"] = self.test_performance_requirements()
        
        # Test 5: Error handling
        self.results["error_handling"] = self.test_error_handling()
        
        # Calculate overall success
        all_passed = all(result.get("success", False) for result in self.results.values())
        
        summary = {
            "overall_success": all_passed,
            "total_tests": len(self.results),
            "passed_tests": sum(1 for r in self.results.values() if r.get("success")),
            "failed_tests": [name for name, r in self.results.items() if not r.get("success")],
            "results": self.results
        }
        
        return summary
    
    def test_hook_files_exist(self) -> Dict[str, Any]:
        """Test that required hook files exist and are executable."""
        result = {"test_name": "hook_files_exist", "success": False, "details": {}}
        
        try:
            # Check session_start.py
            session_start_exists = self.session_start_script.exists()
            session_start_executable = (
                self.session_start_script.is_file() and 
                os.access(self.session_start_script, os.X_OK)
            ) if session_start_exists else False
            
            # Check stop.py
            stop_exists = self.stop_script.exists()
            stop_executable = (
                self.stop_script.is_file() and 
                os.access(self.stop_script, os.X_OK)
            ) if stop_exists else False
            
            result["details"] = {
                "session_start_py": {
                    "exists": session_start_exists,
                    "executable": session_start_executable,
                    "path": str(self.session_start_script)
                },
                "stop_py": {
                    "exists": stop_exists,
                    "executable": stop_executable,
                    "path": str(self.stop_script)
                }
            }
            
            result["success"] = (
                session_start_exists and session_start_executable and
                stop_exists and stop_executable
            )
            
            if not result["success"]:
                result["error"] = "One or more hook files missing or not executable"
                
        except Exception as e:
            result["error"] = f"Error checking hook files: {e}"
        
        return result
    
    def test_session_start_hook(self) -> Dict[str, Any]:
        """Test session_start.py hook execution."""
        result = {"test_name": "session_start_hook", "success": False, "details": {}}
        
        try:
            # Prepare input data
            input_data = {
                "cwd": str(Path.cwd()),
                "session_id": TEST_SESSION_ID,
                "timestamp": time.time()
            }
            
            # Execute hook
            start_time = time.perf_counter()
            
            process = subprocess.run(
                ["python", str(self.session_start_script)],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                timeout=10  # 10 second timeout
            )
            
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            
            result["details"] = {
                "return_code": process.returncode,
                "execution_time_ms": round(execution_time_ms, 2),
                "stdout_length": len(process.stdout),
                "stderr_length": len(process.stderr),
                "within_time_limit": execution_time_ms < MAX_HOOK_EXECUTION_TIME_MS
            }
            
            # Parse output if successful
            if process.returncode == 0 and process.stdout:
                try:
                    output_json = json.loads(process.stdout)
                    result["details"]["output_json"] = output_json
                    result["details"]["has_json_output"] = True
                    
                    # Check for expected fields
                    expected_fields = ["continue", "suppressOutput"]
                    has_expected_fields = all(field in output_json for field in expected_fields)
                    result["details"]["has_expected_fields"] = has_expected_fields
                    
                except json.JSONDecodeError as e:
                    result["details"]["json_parse_error"] = str(e)
                    result["details"]["has_json_output"] = False
            
            # Include stderr if present
            if process.stderr:
                result["details"]["stderr"] = process.stderr[:500]  # First 500 chars
            
            # Success criteria
            result["success"] = (
                process.returncode == 0 and
                execution_time_ms < MAX_HOOK_EXECUTION_TIME_MS and
                result["details"].get("has_json_output", False)
            )
            
            if not result["success"]:
                if process.returncode != 0:
                    result["error"] = f"Hook returned non-zero exit code: {process.returncode}"
                elif execution_time_ms >= MAX_HOOK_EXECUTION_TIME_MS:
                    result["error"] = f"Hook execution too slow: {execution_time_ms:.2f}ms"
                else:
                    result["error"] = "Hook output validation failed"
                    
        except subprocess.TimeoutExpired:
            result["error"] = "Hook execution timed out"
        except Exception as e:
            result["error"] = f"Error executing session_start hook: {e}"
        
        return result
    
    def test_stop_hook(self) -> Dict[str, Any]:
        """Test stop.py hook execution."""
        result = {"test_name": "stop_hook", "success": False, "details": {}}
        
        try:
            # Prepare input data
            input_data = {
                "session_id": TEST_SESSION_ID,
                "timestamp": time.time(),
                "reason": "test_completion"
            }
            
            # Execute hook
            start_time = time.perf_counter()
            
            process = subprocess.run(
                ["python", str(self.stop_script)],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                timeout=10  # 10 second timeout
            )
            
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            
            result["details"] = {
                "return_code": process.returncode,
                "execution_time_ms": round(execution_time_ms, 2),
                "stdout_length": len(process.stdout),
                "stderr_length": len(process.stderr),
                "within_time_limit": execution_time_ms < MAX_HOOK_EXECUTION_TIME_MS
            }
            
            # Parse output if successful
            if process.returncode == 0 and process.stdout:
                try:
                    output_json = json.loads(process.stdout)
                    result["details"]["output_json"] = output_json
                    result["details"]["has_json_output"] = True
                    
                    # Check for expected fields
                    expected_fields = ["continue", "suppressOutput"]
                    has_expected_fields = all(field in output_json for field in expected_fields)
                    result["details"]["has_expected_fields"] = has_expected_fields
                    
                except json.JSONDecodeError as e:
                    result["details"]["json_parse_error"] = str(e)
                    result["details"]["has_json_output"] = False
            
            # Include stderr if present
            if process.stderr:
                result["details"]["stderr"] = process.stderr[:500]  # First 500 chars
            
            # Success criteria
            result["success"] = (
                process.returncode == 0 and
                execution_time_ms < MAX_HOOK_EXECUTION_TIME_MS and
                result["details"].get("has_json_output", False)
            )
            
            if not result["success"]:
                if process.returncode != 0:
                    result["error"] = f"Hook returned non-zero exit code: {process.returncode}"
                elif execution_time_ms >= MAX_HOOK_EXECUTION_TIME_MS:
                    result["error"] = f"Hook execution too slow: {execution_time_ms:.2f}ms"
                else:
                    result["error"] = "Hook output validation failed"
                    
        except subprocess.TimeoutExpired:
            result["error"] = "Hook execution timed out"
        except Exception as e:
            result["error"] = f"Error executing stop hook: {e}"
        
        return result
    
    def test_performance_requirements(self) -> Dict[str, Any]:
        """Test that performance requirements are met."""
        result = {"test_name": "performance_requirements", "success": False, "details": {}}
        
        try:
            # Run multiple iterations to test consistency
            iterations = 5
            session_start_times = []
            stop_times = []
            
            for i in range(iterations):
                # Test session start performance
                start_time = time.perf_counter()
                start_process = subprocess.run(
                    ["python", str(self.session_start_script)],
                    input=json.dumps({"session_id": f"perf-test-{i}"}),
                    text=True,
                    capture_output=True,
                    timeout=5
                )
                session_start_time = (time.perf_counter() - start_time) * 1000
                session_start_times.append(session_start_time)
                
                # Test stop performance
                start_time = time.perf_counter()
                stop_process = subprocess.run(
                    ["python", str(self.stop_script)],
                    input=json.dumps({"session_id": f"perf-test-{i}"}),
                    text=True,
                    capture_output=True,
                    timeout=5
                )
                stop_time = (time.perf_counter() - start_time) * 1000
                stop_times.append(stop_time)
            
            # Calculate statistics
            avg_session_start = sum(session_start_times) / len(session_start_times)
            max_session_start = max(session_start_times)
            avg_stop = sum(stop_times) / len(stop_times)
            max_stop = max(stop_times)
            
            result["details"] = {
                "iterations": iterations,
                "session_start_times_ms": session_start_times,
                "stop_times_ms": stop_times,
                "avg_session_start_ms": round(avg_session_start, 2),
                "max_session_start_ms": round(max_session_start, 2),
                "avg_stop_ms": round(avg_stop, 2),
                "max_stop_ms": round(max_stop, 2),
                "meets_100ms_requirement": max_session_start < MAX_HOOK_EXECUTION_TIME_MS and max_stop < MAX_HOOK_EXECUTION_TIME_MS
            }
            
            result["success"] = result["details"]["meets_100ms_requirement"]
            
            if not result["success"]:
                result["error"] = f"Performance requirement not met - max times: start={max_session_start:.2f}ms, stop={max_stop:.2f}ms"
                
        except Exception as e:
            result["error"] = f"Error testing performance requirements: {e}"
        
        return result
    
    def test_error_handling(self) -> Dict[str, Any]:
        """Test error handling with invalid input."""
        result = {"test_name": "error_handling", "success": False, "details": {}}
        
        try:
            test_cases = [
                {"name": "invalid_json", "input": "invalid json"},
                {"name": "empty_input", "input": ""},
                {"name": "null_input", "input": "null"},
                {"name": "empty_object", "input": "{}"}
            ]
            
            test_results = {}
            
            for test_case in test_cases:
                case_name = test_case["name"]
                case_input = test_case["input"]
                
                # Test session_start with invalid input
                start_process = subprocess.run(
                    ["python", str(self.session_start_script)],
                    input=case_input,
                    text=True,
                    capture_output=True,
                    timeout=5
                )
                
                # Test stop with invalid input  
                stop_process = subprocess.run(
                    ["python", str(self.stop_script)],
                    input=case_input,
                    text=True,
                    capture_output=True,
                    timeout=5
                )
                
                test_results[case_name] = {
                    "session_start_return_code": start_process.returncode,
                    "session_start_has_output": bool(start_process.stdout),
                    "stop_return_code": stop_process.returncode,
                    "stop_has_output": bool(stop_process.stdout),
                    "no_crashes": start_process.returncode != -1 and stop_process.returncode != -1
                }
            
            result["details"] = test_results
            
            # Success if no crashes occurred
            all_no_crashes = all(case["no_crashes"] for case in test_results.values())
            all_exit_zero = all(
                case["session_start_return_code"] == 0 and case["stop_return_code"] == 0
                for case in test_results.values()
            )
            
            result["success"] = all_no_crashes and all_exit_zero
            
            if not result["success"]:
                if not all_no_crashes:
                    result["error"] = "Some hooks crashed with invalid input"
                else:
                    result["error"] = "Some hooks returned non-zero exit codes with invalid input"
                    
        except Exception as e:
            result["error"] = f"Error testing error handling: {e}"
        
        return result
    
    def print_results(self, summary: Dict[str, Any]):
        """Print test results in a readable format."""
        print("\n" + "=" * 60)
        print("🧪 CHR-41 INTEGRATION TEST RESULTS")
        print("=" * 60)
        
        overall_status = "✅ PASSED" if summary["overall_success"] else "❌ FAILED"
        print(f"Overall Status: {overall_status}")
        print(f"Tests Passed: {summary['passed_tests']}/{summary['total_tests']}")
        
        if summary["failed_tests"]:
            print(f"Failed Tests: {', '.join(summary['failed_tests'])}")
        
        print("\n📋 DETAILED RESULTS:")
        print("-" * 40)
        
        for test_name, test_result in summary["results"].items():
            status = "✅ PASS" if test_result["success"] else "❌ FAIL"
            print(f"{status} {test_result['test_name']}")
            
            if not test_result["success"] and "error" in test_result:
                print(f"    Error: {test_result['error']}")
            
            # Show key details
            if "details" in test_result:
                details = test_result["details"]
                if "execution_time_ms" in details:
                    print(f"    Execution time: {details['execution_time_ms']:.2f}ms")
                if "return_code" in details:
                    print(f"    Return code: {details['return_code']}")
        
        print("\n" + "=" * 60)


def main():
    """Run CHR-41 integration tests."""
    print("🚀 CHR-41 Auto-start/stop Mechanism Integration Test")
    print("Testing non-blocking server management with hook integration")
    print()
    
    tester = CHR41IntegrationTester()
    summary = tester.run_all_tests()
    tester.print_results(summary)
    
    # Exit with appropriate code
    sys.exit(0 if summary["overall_success"] else 1)


if __name__ == "__main__":
    main()