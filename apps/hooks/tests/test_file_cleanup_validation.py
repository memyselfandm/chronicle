#!/usr/bin/env python3
"""
Test File Cleanup Validation Script

This test validates that all moved test files are in their proper locations
and can import their dependencies correctly after the cleanup operation.

Usage:
    python test_file_cleanup_validation.py
"""

import os
import sys
import importlib.util
from pathlib import Path

def test_moved_test_files():
    """Test that moved test files exist and can import correctly."""
    print("🧪 Validating moved test files...")
    
    # Define expected file locations
    test_files = {
        "apps/hooks/tests/test_database_connectivity.py": {
            "description": "Database connectivity test",
            "imports": ["lib.database"]
        },
        "apps/hooks/tests/test_hook_integration.py": {
            "description": "Hook integration test", 
            "imports": ["lib.database"]
        },
        "apps/hooks/tests/test_real_world_scenario.py": {
            "description": "Real-world scenario test",
            "imports": ["lib.database"]
        }
    }
    
    repo_root = Path(__file__).parent.parent.parent.parent
    results = []
    
    for file_path, info in test_files.items():
        full_path = repo_root / file_path
        
        # Check if file exists
        if not full_path.exists():
            results.append({
                "file": file_path,
                "status": "missing",
                "error": f"File not found at {full_path}"
            })
            continue
        
        # Try to validate imports by loading the module
        try:
            spec = importlib.util.spec_from_file_location("test_module", full_path)
            module = importlib.util.module_from_spec(spec)
            
            # Add path for imports before executing
            original_path = sys.path.copy()
            sys.path.insert(0, str(full_path.parent.parent / 'src'))
            
            try:
                spec.loader.exec_module(module)
                results.append({
                    "file": file_path,
                    "status": "success",
                    "description": info["description"]
                })
            except ImportError as e:
                results.append({
                    "file": file_path,
                    "status": "import_error",
                    "error": str(e)
                })
            finally:
                sys.path = original_path
                
        except Exception as e:
            results.append({
                "file": file_path,
                "status": "load_error",
                "error": str(e)
            })
    
    return results

def test_performance_scripts():
    """Test that performance scripts exist in their new location."""
    print("🧪 Validating moved performance scripts...")
    
    performance_files = {
        "scripts/performance/benchmark_performance.py": "Performance benchmark script",
        "scripts/performance/performance_monitor.py": "Advanced performance monitoring",
        "scripts/performance/realtime_stress_test.py": "Real-time stress testing"
    }
    
    repo_root = Path(__file__).parent.parent.parent.parent
    results = []
    
    for file_path, description in performance_files.items():
        full_path = repo_root / file_path
        
        if not full_path.exists():
            results.append({
                "file": file_path,
                "status": "missing",
                "error": f"File not found at {full_path}"
            })
        else:
            # Check if file is executable/readable
            try:
                with open(full_path, 'r') as f:
                    content = f.read()
                    if len(content) > 100:  # Basic sanity check
                        results.append({
                            "file": file_path,
                            "status": "success",
                            "description": description
                        })
                    else:
                        results.append({
                            "file": file_path,
                            "status": "too_small",
                            "error": "File appears to be truncated or empty"
                        })
            except Exception as e:
                results.append({
                    "file": file_path,
                    "status": "read_error", 
                    "error": str(e)
                })
    
    return results

def test_root_test_scripts():
    """Test that root test scripts were moved to scripts/test/."""
    print("🧪 Validating moved root test scripts...")
    
    test_scripts = {
        "scripts/test/test_claude_code_env.sh": "Environment testing script",
        "scripts/test/test_hook_trigger.txt": "Simple test trigger file"
    }
    
    repo_root = Path(__file__).parent.parent.parent.parent
    results = []
    
    for file_path, description in test_scripts.items():
        full_path = repo_root / file_path
        
        if not full_path.exists():
            results.append({
                "file": file_path,
                "status": "missing",
                "error": f"File not found at {full_path}"
            })
        else:
            results.append({
                "file": file_path,
                "status": "success", 
                "description": description
            })
    
    return results

def test_old_locations_cleaned():
    """Test that files were actually removed from old locations."""
    print("🧪 Validating old locations are cleaned up...")
    
    old_locations = [
        "apps/hooks/test_database_connectivity.py",
        "apps/hooks/test_hook_integration.py", 
        "apps/hooks/test_real_world_scenario.py",
        "apps/benchmark_performance.py",
        "apps/performance_monitor.py",
        "apps/realtime_stress_test.py",
        "test_claude_code_env.sh",
        "test_hook_trigger.txt"
    ]
    
    repo_root = Path(__file__).parent.parent.parent.parent
    results = []
    
    for file_path in old_locations:
        full_path = repo_root / file_path
        
        if full_path.exists():
            results.append({
                "file": file_path,
                "status": "still_exists",
                "error": f"File should have been moved but still exists at {full_path}"
            })
        else:
            results.append({
                "file": file_path,
                "status": "properly_removed",
                "description": "File correctly removed from old location"
            })
    
    return results

def test_directory_structure():
    """Test that new directories were created properly."""
    print("🧪 Validating directory structure...")
    
    expected_directories = [
        "scripts/performance",
        "scripts/test", 
        "apps/hooks/tests"
    ]
    
    repo_root = Path(__file__).parent.parent.parent.parent
    results = []
    
    for dir_path in expected_directories:
        full_path = repo_root / dir_path
        
        if not full_path.exists():
            results.append({
                "directory": dir_path,
                "status": "missing",
                "error": f"Directory not found at {full_path}"
            })
        elif not full_path.is_dir():
            results.append({
                "directory": dir_path,
                "status": "not_directory",
                "error": f"Path exists but is not a directory: {full_path}"
            })
        else:
            results.append({
                "directory": dir_path,
                "status": "success",
                "description": "Directory exists and is properly structured"
            })
    
    return results

def print_test_results(test_name, results):
    """Print formatted test results."""
    print(f"\n{test_name} Results:")
    print("-" * 60)
    
    success_count = 0
    total_count = len(results)
    
    for result in results:
        item_name = result.get('file', result.get('directory', 'Unknown'))
        status = result['status']
        
        if status in ['success', 'properly_removed']:
            print(f"  ✅ {item_name}: {status}")
            success_count += 1
        else:
            print(f"  ❌ {item_name}: {status}")
            if 'error' in result:
                print(f"     Error: {result['error']}")
    
    print(f"\nSummary: {success_count}/{total_count} passed")
    return success_count, total_count

def main():
    """Run all validation tests."""
    print("🚀 Test File Cleanup Validation Suite")
    print("=" * 60)
    
    all_results = {}
    total_passed = 0
    total_tests = 0
    
    # Run all tests
    test_functions = [
        ("Moved Test Files", test_moved_test_files),
        ("Performance Scripts", test_performance_scripts), 
        ("Root Test Scripts", test_root_test_scripts),
        ("Old Locations Cleaned", test_old_locations_cleaned),
        ("Directory Structure", test_directory_structure)
    ]
    
    for test_name, test_func in test_functions:
        try:
            results = test_func()
            all_results[test_name] = results
            passed, total = print_test_results(test_name, results)
            total_passed += passed
            total_tests += total
        except Exception as e:
            print(f"\n❌ {test_name} failed with error: {e}")
            import traceback
            traceback.print_exc()
    
    # Final summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Overall: {total_passed}/{total_tests} validations passed")
    
    if total_passed == total_tests:
        print("🎉 ALL VALIDATIONS PASSED! Test file cleanup was successful.")
        return 0
    else:
        print("⚠️ Some validations failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())