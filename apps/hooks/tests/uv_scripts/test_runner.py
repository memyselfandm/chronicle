#!/usr/bin/env python3
"""
Automated test runner for UV single-file scripts.

This script runs all tests and generates a comprehensive report.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Test configuration
TEST_DIR = Path(__file__).parent
RESULTS_DIR = TEST_DIR / "results"
SCRIPT_DIR = TEST_DIR.parent.parent / "src" / "hooks" / "uv_scripts"


class TestRunner:
    """Main test runner for UV scripts."""
    
    def __init__(self, verbose: bool = False, performance_only: bool = False):
        self.verbose = verbose
        self.performance_only = performance_only
        self.results = {
            "start_time": datetime.now().isoformat(),
            "tests_run": 0,
            "tests_passed": 0,
            "tests_failed": 0,
            "performance_results": {},
            "errors": []
        }
        
        # Ensure results directory exists
        RESULTS_DIR.mkdir(exist_ok=True)
    
    def run_pytest(self, test_file: Optional[str] = None, 
                   markers: Optional[str] = None) -> Dict[str, Any]:
        """Run pytest with specified parameters."""
        cmd = ["pytest", "-v"]
        
        if self.verbose:
            cmd.append("-s")
        
        if markers:
            cmd.extend(["-m", markers])
        
        if test_file:
            cmd.append(str(TEST_DIR / test_file))
        else:
            cmd.append(str(TEST_DIR))
        
        # Add JSON report
        report_file = RESULTS_DIR / f"pytest_report_{int(time.time())}.json"
        cmd.extend(["--json-report", "--json-report-file", str(report_file)])
        
        # Run pytest
        start_time = time.perf_counter()
        result = subprocess.run(cmd, capture_output=True, text=True)
        execution_time = time.perf_counter() - start_time
        
        # Parse results
        test_result = {
            "exit_code": result.returncode,
            "execution_time": execution_time,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
        
        # Load JSON report if available
        if report_file.exists():
            try:
                with open(report_file) as f:
                    test_result["report"] = json.load(f)
            except Exception as e:
                test_result["report_error"] = str(e)
        
        return test_result
    
    def run_performance_tests(self) -> Dict[str, Any]:
        """Run performance-specific tests for all hooks."""
        print("\n🏃 Running performance tests...")
        
        perf_results = {}
        hooks = [
            ("SessionStart", "session_start_uv.py"),
            ("PreToolUse", "pre_tool_use_uv.py"),
            ("PostToolUse", "post_tool_use_uv.py"),
            ("UserPromptSubmit", "user_prompt_submit_uv.py"),
            ("Notification", "notification_uv.py"),
            ("Stop", "stop_uv.py"),
            ("SubagentStop", "subagent_stop_uv.py"),
            ("PreCompact", "pre_compact_uv.py")
        ]
        
        for hook_name, script_name in hooks:
            script_path = SCRIPT_DIR / script_name
            if not script_path.exists():
                print(f"  ⚠️  {hook_name}: Script not found")
                continue
            
            # Run simple performance test
            perf_result = self._test_hook_performance(hook_name, script_path)
            perf_results[hook_name] = perf_result
            
            # Display result
            if perf_result["success"]:
                avg_time = perf_result["avg_execution_time_ms"]
                status = "✅" if avg_time < 100 else "⚠️"
                print(f"  {status} {hook_name}: {avg_time:.2f}ms average")
            else:
                print(f"  ❌ {hook_name}: {perf_result['error']}")
        
        return perf_results
    
    def _test_hook_performance(self, hook_name: str, script_path: Path,
                               iterations: int = 10) -> Dict[str, Any]:
        """Test performance of a single hook."""
        execution_times = []
        
        # Prepare minimal test input
        test_input = {
            "sessionId": "perf-test-session",
            "transcriptPath": "/tmp/perf-test.jsonl",
            "cwd": "/tmp",
            "hookEventName": hook_name
        }
        
        # Add hook-specific fields
        if hook_name == "PreToolUse" or hook_name == "PostToolUse":
            test_input["toolName"] = "TestTool"
            test_input["toolInput"] = {"test": "data"}
        elif hook_name == "UserPromptSubmit":
            test_input["prompt"] = "Test prompt"
        elif hook_name == "Notification":
            test_input["message"] = "Test notification"
        elif hook_name == "PreCompact":
            test_input["trigger"] = "manual"
        elif hook_name == "SessionStart":
            test_input["source"] = "startup"
        
        # Run multiple iterations
        for i in range(iterations):
            cmd = ["uv", "run", str(script_path)]
            
            start_time = time.perf_counter()
            try:
                result = subprocess.run(
                    cmd,
                    input=json.dumps(test_input),
                    capture_output=True,
                    text=True,
                    timeout=5.0,
                    env={**os.environ, "CHRONICLE_TEST_MODE": "1"}
                )
                execution_time_ms = (time.perf_counter() - start_time) * 1000
                
                if result.returncode == 0:
                    execution_times.append(execution_time_ms)
                else:
                    return {
                        "success": False,
                        "error": f"Hook failed with exit code {result.returncode}"
                    }
                    
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "error": "Hook timed out"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }
        
        # Calculate statistics
        avg_time = sum(execution_times) / len(execution_times)
        min_time = min(execution_times)
        max_time = max(execution_times)
        
        return {
            "success": True,
            "iterations": iterations,
            "avg_execution_time_ms": avg_time,
            "min_execution_time_ms": min_time,
            "max_execution_time_ms": max_time,
            "all_times": execution_times
        }
    
    def run_database_tests(self) -> Dict[str, Any]:
        """Run database connectivity tests."""
        print("\n🗄️  Running database tests...")
        
        # Test SQLite
        sqlite_result = self.run_pytest("test_database_sqlite.py")
        
        # Test Supabase (if configured)
        supabase_result = None
        if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"):
            supabase_result = self.run_pytest("test_database_supabase.py")
        
        return {
            "sqlite": sqlite_result,
            "supabase": supabase_result
        }
    
    def run_security_tests(self) -> Dict[str, Any]:
        """Run security and validation tests."""
        print("\n🔒 Running security tests...")
        
        return self.run_pytest(markers="security")
    
    def run_integration_tests(self) -> Dict[str, Any]:
        """Run end-to-end integration tests."""
        print("\n🔗 Running integration tests...")
        
        return self.run_pytest(markers="integration")
    
    def generate_report(self) -> None:
        """Generate final test report."""
        self.results["end_time"] = datetime.now().isoformat()
        
        # Save JSON report
        report_path = RESULTS_DIR / f"test_report_{int(time.time())}.json"
        with open(report_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        # Generate summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        # Performance results
        if self.results.get("performance_results"):
            print("\n⚡ Performance Results:")
            for hook, result in self.results["performance_results"].items():
                if result.get("success"):
                    avg_time = result["avg_execution_time_ms"]
                    status = "PASS" if avg_time < 100 else "WARN"
                    print(f"  {hook}: {avg_time:.2f}ms [{status}]")
                else:
                    print(f"  {hook}: FAILED - {result.get('error')}")
        
        # Test counts
        print(f"\n📈 Tests Run: {self.results['tests_run']}")
        print(f"✅ Passed: {self.results['tests_passed']}")
        print(f"❌ Failed: {self.results['tests_failed']}")
        
        # Errors
        if self.results["errors"]:
            print("\n⚠️  Errors:")
            for error in self.results["errors"]:
                print(f"  - {error}")
        
        print(f"\n📄 Full report saved to: {report_path}")
        print("="*60)
    
    def run(self) -> int:
        """Run all tests and return exit code."""
        try:
            if self.performance_only:
                self.results["performance_results"] = self.run_performance_tests()
            else:
                # Run all test suites
                print("🚀 Starting comprehensive UV script tests...")
                
                # Performance tests
                self.results["performance_results"] = self.run_performance_tests()
                
                # Unit tests for each hook
                print("\n🧪 Running unit tests...")
                unit_results = self.run_pytest()
                self._update_counts(unit_results)
                
                # Security tests
                security_results = self.run_security_tests()
                self._update_counts(security_results)
                
                # Database tests
                db_results = self.run_database_tests()
                self._update_counts(db_results.get("sqlite"))
                if db_results.get("supabase"):
                    self._update_counts(db_results["supabase"])
                
                # Integration tests
                integration_results = self.run_integration_tests()
                self._update_counts(integration_results)
            
            # Generate report
            self.generate_report()
            
            # Return appropriate exit code
            return 0 if self.results["tests_failed"] == 0 else 1
            
        except Exception as e:
            print(f"\n❌ Test runner failed: {e}")
            self.results["errors"].append(f"Test runner error: {e}")
            self.generate_report()
            return 2
    
    def _update_counts(self, test_result: Optional[Dict[str, Any]]) -> None:
        """Update test counts from pytest results."""
        if not test_result:
            return
        
        if "report" in test_result:
            report = test_result["report"]
            summary = report.get("summary", {})
            
            self.results["tests_run"] += summary.get("total", 0)
            self.results["tests_passed"] += summary.get("passed", 0)
            self.results["tests_failed"] += summary.get("failed", 0)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run comprehensive tests for UV single-file scripts"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    
    parser.add_argument(
        "-p", "--performance-only",
        action="store_true",
        help="Run only performance tests"
    )
    
    parser.add_argument(
        "--json-output",
        help="Save results to specified JSON file"
    )
    
    args = parser.parse_args()
    
    # Run tests
    runner = TestRunner(
        verbose=args.verbose,
        performance_only=args.performance_only
    )
    
    exit_code = runner.run()
    
    # Save custom output if requested
    if args.json_output:
        with open(args.json_output, 'w') as f:
            json.dump(runner.results, f, indent=2)
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()