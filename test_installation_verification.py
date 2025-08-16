#!/usr/bin/env python3
"""
Chronicle Hooks Installation Verification Script
===========================================

This script performs comprehensive validation of the Chronicle hooks installation.

Usage:
    python test_installation_verification.py [options]
    
Options:
    --verbose    Enable verbose output
    --fix        Attempt to fix any issues found
    --debug      Enable debug logging
"""

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class VerificationError(Exception):
    """Custom exception for verification errors."""
    pass


class InstallationVerifier:
    """
    Comprehensive verification of Chronicle hooks installation.
    
    Tests all aspects of the installation including:
    - File structure and permissions
    - Import functionality 
    - Hook execution
    - Database connectivity
    - Configuration validation
    """
    
    def __init__(self, claude_dir: str = None):
        """
        Initialize the verification system.
        
        Args:
            claude_dir: Claude directory path (auto-detected if None)
        """
        self.claude_dir = Path(claude_dir) if claude_dir else self._find_claude_directory()
        self.chronicle_dir = self.claude_dir / "hooks" / "chronicle"
        self.hooks_dir = self.chronicle_dir / "hooks"
        self.lib_dir = self.chronicle_dir / "lib"
        
        # Expected files
        self.expected_hooks = [
            "pre_tool_use.py",
            "post_tool_use.py",
            "user_prompt_submit.py",
            "notification.py",
            "session_start.py",
            "stop.py",
            "subagent_stop.py",
            "pre_compact.py"
        ]
        
        self.expected_lib_files = [
            "__init__.py",
            "base_hook.py",
            "database.py",
            "utils.py"
        ]
        
        self.test_results = {
            "overall_success": False,
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }
        
        logger.info(f"Verifier initialized for: {self.claude_dir}")
    
    def _find_claude_directory(self) -> Path:
        """Find the Claude directory automatically."""
        # Check user-level directory first
        user_claude = Path.home() / ".claude"
        if user_claude.exists():
            return user_claude
        
        # Check project-level directory
        project_claude = Path.cwd() / ".claude"
        if project_claude.exists():
            return project_claude
        
        raise VerificationError("No Claude directory found")
    
    def verify_file_structure(self) -> Dict[str, Any]:
        """
        Verify that all required files and directories exist.
        
        Returns:
            Dictionary containing verification results
        """
        logger.info("Verifying file structure...")
        
        result = {
            "test_name": "file_structure",
            "success": True,
            "details": {
                "chronicle_dir_exists": False,
                "hooks_dir_exists": False,
                "lib_dir_exists": False,
                "hook_files_found": 0,
                "lib_files_found": 0,
                "missing_hooks": [],
                "missing_lib_files": [],
                "config_files": {}
            },
            "errors": []
        }
        
        try:
            # Check main directories
            result["details"]["chronicle_dir_exists"] = self.chronicle_dir.exists()
            result["details"]["hooks_dir_exists"] = self.hooks_dir.exists()
            result["details"]["lib_dir_exists"] = self.lib_dir.exists()
            
            if not self.chronicle_dir.exists():
                result["errors"].append("Chronicle directory does not exist")
                result["success"] = False
                return result
            
            # Check hook files
            for hook_file in self.expected_hooks:
                hook_path = self.hooks_dir / hook_file
                if hook_path.exists():
                    result["details"]["hook_files_found"] += 1
                else:
                    result["details"]["missing_hooks"].append(hook_file)
            
            # Check lib files
            for lib_file in self.expected_lib_files:
                lib_path = self.lib_dir / lib_file
                if lib_path.exists():
                    result["details"]["lib_files_found"] += 1
                else:
                    result["details"]["missing_lib_files"].append(lib_file)
            
            # Check configuration files
            config_files = ["README.md", "config.json", ".env.example"]
            for config_file in config_files:
                config_path = self.chronicle_dir / config_file
                result["details"]["config_files"][config_file] = config_path.exists()
            
            # Overall success check
            if result["details"]["missing_hooks"] or result["details"]["missing_lib_files"]:
                result["success"] = False
                result["errors"].append("Missing required files")
            
            logger.info(f"File structure check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"File structure verification failed: {e}")
            logger.error(f"File structure verification error: {e}")
        
        return result
    
    def verify_permissions(self) -> Dict[str, Any]:
        """
        Verify that hook files have proper permissions.
        
        Returns:
            Dictionary containing permission verification results
        """
        logger.info("Verifying file permissions...")
        
        result = {
            "test_name": "permissions",
            "success": True,
            "details": {
                "executable_hooks": 0,
                "readable_lib_files": 0,
                "permission_issues": []
            },
            "errors": []
        }
        
        try:
            # Check hook file permissions
            for hook_file in self.expected_hooks:
                hook_path = self.hooks_dir / hook_file
                if hook_path.exists():
                    if os.access(hook_path, os.X_OK):
                        result["details"]["executable_hooks"] += 1
                    else:
                        result["details"]["permission_issues"].append(f"{hook_file} not executable")
            
            # Check lib file permissions
            for lib_file in self.expected_lib_files:
                lib_path = self.lib_dir / lib_file
                if lib_path.exists():
                    if os.access(lib_path, os.R_OK):
                        result["details"]["readable_lib_files"] += 1
                    else:
                        result["details"]["permission_issues"].append(f"{lib_file} not readable")
            
            if result["details"]["permission_issues"]:
                result["success"] = False
                result["errors"].extend(result["details"]["permission_issues"])
            
            logger.info(f"Permission check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"Permission verification failed: {e}")
            logger.error(f"Permission verification error: {e}")
        
        return result
    
    def verify_hook_execution(self) -> Dict[str, Any]:
        """
        Test that hooks can be executed successfully.
        
        Returns:
            Dictionary containing execution verification results
        """
        logger.info("Verifying hook execution...")
        
        result = {
            "test_name": "hook_execution",
            "success": True,
            "details": {
                "hooks_tested": 0,
                "hooks_passed": 0,
                "execution_results": {},
                "import_tests": {}
            },
            "errors": []
        }
        
        try:
            # Test a few key hooks with sample input
            test_cases = [
                {
                    "hook": "notification.py",
                    "input": '{"test": "verification"}',
                    "expected_output_contains": ["continue", "hookEventName"]
                },
                {
                    "hook": "session_start.py", 
                    "input": '{"session_id": "test-verification", "project_directory": "/tmp"}',
                    "expected_output_contains": ["continue", "SessionStart"]
                }
            ]
            
            for test_case in test_cases:
                hook_name = test_case["hook"]
                hook_path = self.hooks_dir / hook_name
                
                if not hook_path.exists():
                    result["details"]["execution_results"][hook_name] = "SKIPPED - file not found"
                    continue
                
                result["details"]["hooks_tested"] += 1
                
                try:
                    # Run the hook with test input
                    cmd = ["uv", "run", str(hook_path)]
                    process = subprocess.run(
                        cmd,
                        input=test_case["input"],
                        capture_output=True,
                        text=True,
                        timeout=10,
                        cwd=str(self.hooks_dir)
                    )
                    
                    if process.returncode == 0:
                        # Check if expected output elements are present
                        output_check_passed = True
                        for expected in test_case["expected_output_contains"]:
                            if expected not in process.stdout:
                                output_check_passed = False
                                break
                        
                        if output_check_passed:
                            result["details"]["hooks_passed"] += 1
                            result["details"]["execution_results"][hook_name] = "PASSED"
                        else:
                            result["details"]["execution_results"][hook_name] = "FAILED - output validation"
                    else:
                        result["details"]["execution_results"][hook_name] = f"FAILED - exit code {process.returncode}"
                        if process.stderr:
                            result["errors"].append(f"{hook_name}: {process.stderr[:200]}")
                
                except subprocess.TimeoutExpired:
                    result["details"]["execution_results"][hook_name] = "FAILED - timeout"
                except Exception as e:
                    result["details"]["execution_results"][hook_name] = f"FAILED - {str(e)[:100]}"
            
            # Overall success check
            if result["details"]["hooks_passed"] < result["details"]["hooks_tested"]:
                result["success"] = False
                result["errors"].append("Some hooks failed execution tests")
            
            logger.info(f"Hook execution check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"Hook execution verification failed: {e}")
            logger.error(f"Hook execution verification error: {e}")
        
        return result
    
    def verify_import_functionality(self) -> Dict[str, Any]:
        """
        Test that hooks can import from lib directory correctly.
        
        Returns:
            Dictionary containing import verification results
        """
        logger.info("Verifying import functionality...")
        
        result = {
            "test_name": "import_functionality",
            "success": True,
            "details": {
                "syntax_checks_passed": 0,
                "import_tests_passed": 0,
                "syntax_errors": [],
                "import_errors": []
            },
            "errors": []
        }
        
        try:
            # Test syntax of all Python files
            all_python_files = []
            
            # Add hook files
            for hook_file in self.expected_hooks:
                hook_path = self.hooks_dir / hook_file
                if hook_path.exists():
                    all_python_files.append(("hook", hook_file, hook_path))
            
            # Add lib files
            for lib_file in self.expected_lib_files:
                lib_path = self.lib_dir / lib_file
                if lib_path.exists():
                    all_python_files.append(("lib", lib_file, lib_path))
            
            # Check syntax of each file
            for file_type, file_name, file_path in all_python_files:
                try:
                    with open(file_path, 'r') as f:
                        source = f.read()
                    
                    # Compile to check syntax
                    compile(source, str(file_path), 'exec')
                    result["details"]["syntax_checks_passed"] += 1
                    
                except SyntaxError as e:
                    result["details"]["syntax_errors"].append(f"{file_name}: {e}")
                    result["success"] = False
                except Exception as e:
                    result["details"]["syntax_errors"].append(f"{file_name}: {e}")
            
            # Test that hooks can import lib modules (basic test)
            try:
                test_script = f"""
import sys
sys.path.insert(0, '{self.lib_dir}')
try:
    import base_hook
    import database
    import utils
    print("IMPORT_SUCCESS")
except Exception as e:
    print(f"IMPORT_FAILED: {{e}}")
"""
                
                process = subprocess.run(
                    ["python", "-c", test_script],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                if "IMPORT_SUCCESS" in process.stdout:
                    result["details"]["import_tests_passed"] += 1
                else:
                    result["details"]["import_errors"].append(f"Basic import test failed: {process.stdout}")
                    result["success"] = False
                    
            except Exception as e:
                result["details"]["import_errors"].append(f"Import test execution failed: {e}")
                result["success"] = False
            
            logger.info(f"Import functionality check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"Import functionality verification failed: {e}")
            logger.error(f"Import functionality verification error: {e}")
        
        return result
    
    def verify_settings_configuration(self) -> Dict[str, Any]:
        """
        Verify Claude Code settings.json configuration.
        
        Returns:
            Dictionary containing settings verification results
        """
        logger.info("Verifying settings configuration...")
        
        result = {
            "test_name": "settings_configuration",
            "success": True,
            "details": {
                "settings_file_exists": False,
                "settings_valid_json": False,
                "hooks_configured": 0,
                "expected_hooks_found": [],
                "missing_hook_configs": []
            },
            "errors": []
        }
        
        try:
            settings_path = self.claude_dir / "settings.json"
            
            # Check if settings file exists
            result["details"]["settings_file_exists"] = settings_path.exists()
            
            if not settings_path.exists():
                result["success"] = False
                result["errors"].append("Settings file does not exist")
                return result
            
            # Load and parse settings
            try:
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
                result["details"]["settings_valid_json"] = True
                
            except json.JSONDecodeError as e:
                result["success"] = False
                result["errors"].append(f"Invalid JSON in settings file: {e}")
                return result
            
            # Check hook configurations
            expected_hook_events = [
                "PreToolUse", "PostToolUse", "UserPromptSubmit", 
                "Notification", "SessionStart", "Stop", "SubagentStop", "PreCompact"
            ]
            
            if "hooks" in settings and isinstance(settings["hooks"], dict):
                for hook_event in expected_hook_events:
                    if hook_event in settings["hooks"]:
                        result["details"]["hooks_configured"] += 1
                        result["details"]["expected_hooks_found"].append(hook_event)
                    else:
                        result["details"]["missing_hook_configs"].append(hook_event)
            else:
                result["success"] = False
                result["errors"].append("No hooks configuration found in settings")
            
            # Check if all expected hooks are configured
            if len(result["details"]["missing_hook_configs"]) > 0:
                result["success"] = False
                result["errors"].append("Missing hook configurations")
            
            logger.info(f"Settings configuration check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"Settings configuration verification failed: {e}")
            logger.error(f"Settings configuration verification error: {e}")
        
        return result
    
    def verify_database_connectivity(self) -> Dict[str, Any]:
        """
        Test database connectivity (both Supabase and SQLite fallback).
        
        Returns:
            Dictionary containing database verification results
        """
        logger.info("Verifying database connectivity...")
        
        result = {
            "test_name": "database_connectivity",
            "success": True,
            "details": {
                "supabase_test": "not_tested",
                "sqlite_test": "not_tested",
                "database_files_exist": {}
            },
            "errors": []
        }
        
        try:
            # Check if SQLite database file exists
            sqlite_db_path = self.chronicle_dir / "data" / "chronicle.db"
            result["details"]["database_files_exist"]["sqlite"] = sqlite_db_path.exists()
            
            # Test database connectivity using the same method as installation
            try:
                import sys
                sys.path.append(str(self.chronicle_dir / "lib"))
                from database import DatabaseManager
                
                # Test database connection
                db_manager = DatabaseManager()
                connection_success = db_manager.test_connection()
                status = db_manager.get_status()
                
                if connection_success:
                    result["details"]["supabase_test"] = "connected" if status.get("connection_type") == "supabase" else "not_available"
                    result["details"]["sqlite_test"] = "connected" if status.get("connection_type") == "sqlite" else "fallback_available"
                else:
                    result["success"] = False
                    result["errors"].append("Database connection test failed")
                
            except ImportError as e:
                result["success"] = False
                result["errors"].append(f"Cannot import database module: {e}")
            except Exception as e:
                result["success"] = False
                result["errors"].append(f"Database connectivity test failed: {e}")
            
            logger.info(f"Database connectivity check: {result['success']}")
            
        except Exception as e:
            result["success"] = False
            result["errors"].append(f"Database connectivity verification failed: {e}")
            logger.error(f"Database connectivity verification error: {e}")
        
        return result
    
    def run_all_verifications(self) -> Dict[str, Any]:
        """
        Run all verification tests.
        
        Returns:
            Complete verification results
        """
        logger.info("Starting comprehensive verification...")
        
        # Run all verification tests
        tests = [
            self.verify_file_structure,
            self.verify_permissions,
            self.verify_hook_execution,
            self.verify_import_functionality,
            self.verify_settings_configuration,
            self.verify_database_connectivity
        ]
        
        all_passed = True
        
        for test_func in tests:
            try:
                test_result = test_func()
                self.test_results["tests"][test_result["test_name"]] = test_result
                
                if not test_result["success"]:
                    all_passed = False
                    
            except Exception as e:
                logger.error(f"Test {test_func.__name__} failed with exception: {e}")
                all_passed = False
                self.test_results["tests"][test_func.__name__] = {
                    "test_name": test_func.__name__,
                    "success": False,
                    "errors": [f"Test execution failed: {e}"]
                }
        
        self.test_results["overall_success"] = all_passed
        
        logger.info(f"Verification complete. Overall success: {all_passed}")
        return self.test_results
    
    def print_summary(self, results: Dict[str, Any] = None) -> None:
        """Print a formatted summary of verification results."""
        if results is None:
            results = self.test_results
        
        print("\n" + "="*60)
        print("CHRONICLE HOOKS INSTALLATION VERIFICATION REPORT")
        print("="*60)
        print(f"Timestamp: {results['timestamp']}")
        print(f"Overall Success: {'✅ PASSED' if results['overall_success'] else '❌ FAILED'}")
        print()
        
        for test_name, test_result in results["tests"].items():
            status = "✅ PASSED" if test_result["success"] else "❌ FAILED"
            print(f"{test_result.get('test_name', test_name).replace('_', ' ').title()}: {status}")
            
            if not test_result["success"] and test_result.get("errors"):
                for error in test_result["errors"][:3]:  # Show first 3 errors
                    print(f"  └─ {error}")
                if len(test_result["errors"]) > 3:
                    print(f"  └─ ... and {len(test_result['errors']) - 3} more errors")
        
        print()
        
        # Summary statistics
        total_tests = len(results["tests"])
        passed_tests = sum(1 for test in results["tests"].values() if test["success"])
        
        print(f"Summary: {passed_tests}/{total_tests} tests passed")
        
        if results["overall_success"]:
            print("\n🎉 Chronicle hooks installation is fully functional!")
        else:
            print("\n⚠️  Issues found in installation. Check errors above.")
        
        print("="*60)


def main():
    """Main entry point for the verification script."""
    parser = argparse.ArgumentParser(
        description="Verify Chronicle hooks installation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--claude-dir",
        help="Claude Code directory path (default: auto-detect)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    
    parser.add_argument(
        "--output",
        help="Output file for results (JSON format)"
    )
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    elif args.verbose:
        logging.getLogger().setLevel(logging.INFO)
    else:
        logging.getLogger().setLevel(logging.WARNING)
    
    try:
        # Run verification
        verifier = InstallationVerifier(claude_dir=args.claude_dir)
        results = verifier.run_all_verifications()
        
        # Print summary
        verifier.print_summary(results)
        
        # Save results to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\nDetailed results saved to: {args.output}")
        
        # Exit with appropriate code
        sys.exit(0 if results["overall_success"] else 1)
        
    except VerificationError as e:
        logger.error(f"Verification error: {e}")
        print(f"❌ Verification failed: {e}")
        sys.exit(1)
    
    except KeyboardInterrupt:
        logger.info("Verification cancelled by user")
        print("\n⚠️  Verification cancelled")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()