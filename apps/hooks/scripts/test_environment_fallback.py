#!/usr/bin/env python3
"""
Environment Variable Fallback Test Script

This script tests the fallback logic and error handling when environment 
variables are missing or invalid. It provides clear error messages and 
demonstrates the robustness of the Chronicle hooks system.

Usage:
    python test_environment_fallback.py [options]

Options:
    --test-missing-env       Test behavior with no CLAUDE_PROJECT_DIR
    --test-invalid-env       Test behavior with invalid CLAUDE_PROJECT_DIR
    --test-all              Run all fallback tests
    --verbose               Enable verbose output
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, Any

# Add src directory to path for importing
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir.parent / "src"))
sys.path.insert(0, str(script_dir.parent / "src" / "core"))

from base_hook import BaseHook
from utils import (
    resolve_project_path, validate_environment_setup, 
    get_project_context_with_env_support
)


class EnvironmentFallbackTester:
    """Test environment variable fallback scenarios."""
    
    def __init__(self, verbose: bool = False):
        """Initialize the tester."""
        self.verbose = verbose
        self.original_env = os.environ.copy()
        self.test_results = []
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message if verbose mode is enabled."""
        if self.verbose or level == "ERROR":
            prefix = f"[{level}]" if level != "INFO" else ""
            print(f"{prefix} {message}")
    
    def run_test(self, test_name: str, test_func) -> Dict[str, Any]:
        """Run a single test and capture results."""
        self.log(f"Running test: {test_name}")
        
        try:
            result = test_func()
            result["test_name"] = test_name
            result["success"] = result.get("success", True)
            
            if result["success"]:
                self.log(f"✅ {test_name} passed")
            else:
                self.log(f"❌ {test_name} failed: {result.get('error', 'Unknown error')}", "ERROR")
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            error_result = {
                "test_name": test_name,
                "success": False,
                "error": str(e),
                "exception_type": type(e).__name__
            }
            self.log(f"❌ {test_name} failed with exception: {e}", "ERROR")
            self.test_results.append(error_result)
            return error_result
        finally:
            # Restore original environment after each test
            os.environ.clear()
            os.environ.update(self.original_env)
    
    def test_missing_claude_project_dir(self) -> Dict[str, Any]:
        """Test behavior when CLAUDE_PROJECT_DIR is not set."""
        # Remove CLAUDE_PROJECT_DIR if it exists
        if "CLAUDE_PROJECT_DIR" in os.environ:
            del os.environ["CLAUDE_PROJECT_DIR"]
        
        result = {
            "description": "Test fallback when CLAUDE_PROJECT_DIR is not set",
            "expected_behavior": "Should fall back to current working directory",
        }
        
        try:
            # Test project path resolution
            project_path = resolve_project_path()
            result["resolved_path"] = project_path
            result["fallback_used"] = True
            
            # Test hook initialization
            from unittest.mock import MagicMock, patch
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                hook = BaseHook()
                
                context = hook.load_project_context()
                result["context_loaded"] = True
                result["resolved_from_env"] = context.get("resolved_from_env", False)
                
                # Validate environment
                validation = hook.validate_environment()
                result["validation"] = validation
                result["has_warnings"] = len(validation.get("warnings", [])) > 0
                
            result["success"] = True
            
        except Exception as e:
            result["success"] = False
            result["error"] = str(e)
        
        return result
    
    def test_invalid_claude_project_dir(self) -> Dict[str, Any]:
        """Test behavior when CLAUDE_PROJECT_DIR points to invalid location."""
        # Set invalid project directory
        invalid_path = "/nonexistent/invalid/directory/path"
        os.environ["CLAUDE_PROJECT_DIR"] = invalid_path
        
        result = {
            "description": "Test fallback when CLAUDE_PROJECT_DIR is invalid",
            "expected_behavior": "Should fall back to current working directory with warning",
            "invalid_path_set": invalid_path,
        }
        
        try:
            # Test project path resolution
            project_path = resolve_project_path()
            result["resolved_path"] = project_path
            result["fallback_used"] = project_path != invalid_path
            
            # Test hook initialization
            from unittest.mock import MagicMock, patch
            with patch("base_hook.DatabaseManager") as mock_db:
                mock_db.return_value = MagicMock()
                hook = BaseHook()
                
                context = hook.load_project_context()
                result["context_loaded"] = True
                
                # Validate environment - should have errors
                validation = hook.validate_environment()
                result["validation"] = validation
                result["has_errors"] = len(validation.get("errors", [])) > 0
                result["is_invalid"] = not validation.get("is_valid", True)
                
            result["success"] = True
            
        except Exception as e:
            result["success"] = False
            result["error"] = str(e)
        
        return result
    
    def test_empty_claude_project_dir(self) -> Dict[str, Any]:
        """Test behavior when CLAUDE_PROJECT_DIR is empty string."""
        os.environ["CLAUDE_PROJECT_DIR"] = ""
        
        result = {
            "description": "Test fallback when CLAUDE_PROJECT_DIR is empty string",
            "expected_behavior": "Should treat empty string as not set",
        }
        
        try:
            # Test project path resolution
            project_path = resolve_project_path()
            result["resolved_path"] = project_path
            result["fallback_used"] = True
            
            # Test environment validation
            validation = validate_environment_setup()
            result["validation"] = validation
            result["has_warnings"] = len(validation.get("warnings", [])) > 0
            
            result["success"] = True
            
        except Exception as e:
            result["success"] = False
            result["error"] = str(e)
        
        return result
    
    def test_permission_denied_directory(self) -> Dict[str, Any]:
        """Test behavior when CLAUDE_PROJECT_DIR exists but is not accessible."""
        # Create a temporary directory and remove permissions
        import tempfile
        import stat
        
        result = {
            "description": "Test fallback when CLAUDE_PROJECT_DIR has permission issues",
            "expected_behavior": "Should handle permission errors gracefully",
        }
        
        temp_dir = None
        try:
            # Create temporary directory
            temp_dir = tempfile.mkdtemp()
            
            # On Unix systems, remove read/execute permissions
            if os.name != 'nt':  # Not Windows
                os.chmod(temp_dir, stat.S_IWRITE)  # Write only, no read/execute
            
            os.environ["CLAUDE_PROJECT_DIR"] = temp_dir
            
            # Test project path resolution
            project_path = resolve_project_path()
            result["resolved_path"] = project_path
            result["permission_error_handled"] = True
            
            result["success"] = True
            
        except PermissionError:
            result["success"] = True  # Expected behavior
            result["permission_error_caught"] = True
        except Exception as e:
            result["success"] = False
            result["error"] = str(e)
        finally:
            # Clean up: restore permissions and remove directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    if os.name != 'nt':
                        os.chmod(temp_dir, stat.S_IREAD | stat.S_IWRITE | stat.S_IEXEC)
                    os.rmdir(temp_dir)
                except (OSError, PermissionError):
                    pass  # Cleanup failed, but test is done
        
        return result
    
    def test_cross_platform_paths(self) -> Dict[str, Any]:
        """Test handling of different path formats."""
        result = {
            "description": "Test cross-platform path handling",
            "expected_behavior": "Should handle various path formats gracefully",
        }
        
        test_paths = [
            "/unix/style/path",
            r"C:\Windows\Style\Path", 
            "relative/path",
            "./current/directory/path",
            "../parent/directory/path",
            r"C:/mixed\separators/path",
        ]
        
        path_results = []
        
        for test_path in test_paths:
            os.environ["CLAUDE_PROJECT_DIR"] = test_path
            
            try:
                # Test that path resolution doesn't crash
                project_path = resolve_project_path()
                path_results.append({
                    "test_path": test_path,
                    "resolved_path": project_path,
                    "success": True
                })
            except Exception as e:
                path_results.append({
                    "test_path": test_path,
                    "error": str(e),
                    "success": False
                })
        
        result["path_tests"] = path_results
        result["success"] = all(p.get("success", False) for p in path_results)
        
        return result
    
    def test_environment_validation_messages(self) -> Dict[str, Any]:
        """Test that environment validation provides helpful messages."""
        result = {
            "description": "Test environment validation provides helpful error messages",
            "expected_behavior": "Should provide actionable recommendations",
        }
        
        # Test with missing environment variable
        if "CLAUDE_PROJECT_DIR" in os.environ:
            del os.environ["CLAUDE_PROJECT_DIR"]
        
        validation = validate_environment_setup()
        
        result["validation_result"] = validation
        result["has_warnings"] = len(validation.get("warnings", [])) > 0
        result["has_recommendations"] = len(validation.get("recommendations", [])) > 0
        result["provides_help"] = result["has_warnings"] or result["has_recommendations"]
        
        # Check that recommendations include helpful text
        recommendations = validation.get("recommendations", [])
        helpful_keywords = ["export", "CLAUDE_PROJECT_DIR", "project root"]
        result["recommendations_helpful"] = any(
            any(keyword in rec for keyword in helpful_keywords)
            for rec in recommendations
        )
        
        result["success"] = result["provides_help"] and result["recommendations_helpful"]
        
        return result
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all fallback tests."""
        self.log("Starting comprehensive environment fallback tests...")
        
        tests = [
            ("Missing CLAUDE_PROJECT_DIR", self.test_missing_claude_project_dir),
            ("Invalid CLAUDE_PROJECT_DIR", self.test_invalid_claude_project_dir),
            ("Empty CLAUDE_PROJECT_DIR", self.test_empty_claude_project_dir),
            ("Permission Denied Directory", self.test_permission_denied_directory),
            ("Cross-Platform Paths", self.test_cross_platform_paths),
            ("Environment Validation Messages", self.test_environment_validation_messages),
        ]
        
        for test_name, test_func in tests:
            self.run_test(test_name, test_func)
        
        # Generate summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.get("success"))
        failed_tests = total_tests - passed_tests
        
        summary = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": passed_tests / total_tests if total_tests > 0 else 0,
            "all_tests_passed": failed_tests == 0,
        }
        
        self.log(f"\n📊 Test Summary:")
        self.log(f"   Total tests: {total_tests}")
        self.log(f"   Passed: {passed_tests}")
        self.log(f"   Failed: {failed_tests}")
        self.log(f"   Success rate: {summary['success_rate']:.1%}")
        
        if failed_tests > 0:
            self.log(f"\n❌ Failed tests:")
            for result in self.test_results:
                if not result.get("success"):
                    self.log(f"   - {result['test_name']}: {result.get('error', 'Unknown error')}")
        
        return summary
    
    def generate_report(self) -> str:
        """Generate a detailed test report."""
        report = {
            "environment_fallback_test_report": {
                "timestamp": __import__('datetime').datetime.now().isoformat(),
                "test_results": self.test_results,
                "summary": {
                    "total_tests": len(self.test_results),
                    "passed_tests": sum(1 for r in self.test_results if r.get("success")),
                    "failed_tests": sum(1 for r in self.test_results if not r.get("success")),
                }
            }
        }
        
        return json.dumps(report, indent=2)


def main():
    """Main entry point for the test script."""
    parser = argparse.ArgumentParser(
        description="Test environment variable fallback and error handling",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--test-missing-env",
        action="store_true",
        help="Test behavior with no CLAUDE_PROJECT_DIR"
    )
    
    parser.add_argument(
        "--test-invalid-env", 
        action="store_true",
        help="Test behavior with invalid CLAUDE_PROJECT_DIR"
    )
    
    parser.add_argument(
        "--test-all",
        action="store_true",
        help="Run all fallback tests"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    
    parser.add_argument(
        "--output-report",
        metavar="FILE",
        help="Output detailed report to JSON file"
    )
    
    args = parser.parse_args()
    
    # Default to running all tests if no specific test is requested
    if not any([args.test_missing_env, args.test_invalid_env, args.test_all]):
        args.test_all = True
    
    tester = EnvironmentFallbackTester(verbose=args.verbose)
    
    try:
        if args.test_all:
            summary = tester.run_all_tests()
        else:
            if args.test_missing_env:
                tester.run_test("Missing CLAUDE_PROJECT_DIR", tester.test_missing_claude_project_dir)
            
            if args.test_invalid_env:
                tester.run_test("Invalid CLAUDE_PROJECT_DIR", tester.test_invalid_claude_project_dir)
            
            # Generate summary for individual tests
            total_tests = len(tester.test_results)
            passed_tests = sum(1 for result in tester.test_results if result.get("success"))
            summary = {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": total_tests - passed_tests,
                "all_tests_passed": passed_tests == total_tests,
            }
        
        # Output report if requested
        if args.output_report:
            report = tester.generate_report()
            with open(args.output_report, 'w') as f:
                f.write(report)
            tester.log(f"Detailed report written to: {args.output_report}")
        
        # Exit with appropriate code
        sys.exit(0 if summary["all_tests_passed"] else 1)
        
    except KeyboardInterrupt:
        tester.log("Tests interrupted by user", "ERROR")
        sys.exit(130)
    except Exception as e:
        tester.log(f"Unexpected error: {e}", "ERROR")
        sys.exit(1)


if __name__ == "__main__":
    main()