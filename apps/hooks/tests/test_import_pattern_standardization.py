#!/usr/bin/env python3
"""
Test suite for validating standardized import patterns across all hooks.

This test ensures that all hooks follow the exact same import pattern for
maintainability and consistency. Tests that the standard template works
and that all hooks conform to it.
"""

import ast
import os
import re
import sys
import unittest
from pathlib import Path
from typing import Dict, List, Set

# Add the hooks source directory to path
hooks_src_dir = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(hooks_src_dir))

class TestImportPatternStandardization(unittest.TestCase):
    """Test suite for import pattern consistency across hooks."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.hooks_dir = Path(__file__).parent.parent / "src" / "hooks"
        self.expected_hook_files = {
            "post_tool_use.py",
            "pre_tool_use.py", 
            "session_start.py",
            "notification.py",
            "stop.py",
            "user_prompt_submit.py",
            "subagent_stop.py",
            "pre_compact.py"
        }
        
        # Standard import template - this is what all hooks should follow
        self.standard_import_template = {
            "path_setup": "sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))",
            "required_imports": {
                "from lib.database import DatabaseManager",
                "from lib.base_hook import BaseHook",
                "from lib.utils import load_chronicle_env"
            },
            "optional_imports": {
                "from lib.base_hook import create_event_data",
                "from lib.base_hook import setup_hook_logging",
                "from lib.utils import extract_session_id",
                "from lib.utils import format_error_message",
                "from lib.utils import sanitize_data",
                "from lib.utils import get_project_path"
            },
            "ujson_pattern": "try:\n    import ujson as json_impl\nexcept ImportError:\n    import json as json_impl"
        }
    
    def test_all_hook_files_exist(self):
        """Test that all expected hook files exist."""
        actual_files = {f.name for f in self.hooks_dir.glob("*.py") if f.name != "__init__.py"}
        self.assertEqual(
            actual_files, 
            self.expected_hook_files,
            f"Missing or extra hook files. Expected: {self.expected_hook_files}, Got: {actual_files}"
        )
    
    def test_standard_import_template_validity(self):
        """Test that our standard template imports work correctly."""
        # Create a temporary script to test the imports
        import tempfile
        
        test_script_content = f"""
import os
import sys

# Simulate __file__ being in hooks directory
__file__ = "{self.hooks_dir / 'test_import.py'}"

# Add src directory to path for lib imports  
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Test that we can import from lib
try:
    from lib.database import DatabaseManager
    from lib.base_hook import BaseHook
    from lib.utils import load_chronicle_env
    print("SUCCESS: All imports work")
    sys.exit(0)
except ImportError as e:
    print(f"FAILED: Import error: {{e}}")
    sys.exit(1)
"""
        
        # Write and execute the test script
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(test_script_content)
            f.flush()
            
            import subprocess
            result = subprocess.run([sys.executable, f.name], 
                                  capture_output=True, text=True, cwd=str(self.hooks_dir))
            
            # Clean up
            os.unlink(f.name)
            
            self.assertEqual(
                result.returncode, 0,
                f"Standard template imports failed: {result.stderr or result.stdout}"
            )
    
    def test_hooks_follow_standard_path_setup(self):
        """Test that all hooks use the standard sys.path.insert pattern."""
        expected_path_setup = "sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))"
        
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                self.assertIn(
                    expected_path_setup,
                    content,
                    f"{hook_file} does not use standard path setup pattern"
                )
    
    def test_hooks_have_required_imports(self):
        """Test that all hooks have the required core imports."""
        required_modules = {
            "lib.database": "DatabaseManager",
            "lib.base_hook": "BaseHook", 
            "lib.utils": "load_chronicle_env"
        }
        
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                for module, import_name in required_modules.items():
                    # Check for import in various formats
                    patterns = [
                        f"from {module} import {import_name}",
                        f"from {module} import (\n    load_chronicle_env",  # Multi-line
                        f"from {module} import.*{import_name}"  # In a list
                    ]
                    
                    found = any(pattern in content or 
                               any(p in content for p in patterns) for pattern in patterns)
                    
                    if not found:
                        # More flexible check - just ensure the module and import exist somewhere
                        module_imported = f"from {module} import" in content
                        import_exists = import_name in content
                        found = module_imported and import_exists
                    
                    self.assertTrue(
                        found,
                        f"{hook_file} missing required import: {import_name} from {module}"
                    )
    
    def test_hooks_use_standard_ujson_pattern(self):
        """Test that all hooks use the standard ujson import pattern."""
        expected_ujson_lines = [
            "try:",
            "    import ujson as json_impl", 
            "except ImportError:",
            "    import json as json_impl"
        ]
        
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                for line in expected_ujson_lines:
                    self.assertIn(
                        line,
                        content,
                        f"{hook_file} does not use standard ujson pattern: missing '{line}'"
                    )
    
    def test_no_redundant_try_except_imports(self):
        """Test that hooks don't have redundant try/except blocks for lib imports."""
        # This pattern should NOT exist - it's redundant with the standard approach
        redundant_patterns = [
            "try:\n    from lib.",
            "except ImportError:\n    # For UV script compatibility",
            "sys.path.insert(0, str(Path(__file__).parent.parent"
        ]
        
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                for pattern in redundant_patterns:
                    self.assertNotIn(
                        pattern,
                        content,
                        f"{hook_file} has redundant import pattern: {pattern}"
                    )
    
    def test_import_order_consistency(self):
        """Test that imports follow consistent ordering."""
        # Expected order:
        # 1. Standard library imports
        # 2. sys.path.insert
        # 3. lib imports  
        # 4. ujson imports
        
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                lines = content.split('\n')
                
                # Find key import sections
                path_insert_line = -1
                lib_import_start = -1
                ujson_try_line = -1
                
                for i, line in enumerate(lines):
                    if "sys.path.insert(0, os.path.join" in line:
                        path_insert_line = i
                    elif line.startswith("from lib.") and lib_import_start == -1:
                        lib_import_start = i
                    elif "import ujson as json_impl" in line:
                        ujson_try_line = i
                
                # Verify ordering
                if path_insert_line != -1 and lib_import_start != -1:
                    self.assertLess(
                        path_insert_line,
                        lib_import_start,
                        f"{hook_file}: sys.path.insert should come before lib imports"
                    )
                
                if lib_import_start != -1 and ujson_try_line != -1:
                    self.assertLess(
                        lib_import_start,
                        ujson_try_line,
                        f"{hook_file}: lib imports should come before ujson imports"
                    )
    
    def test_environment_loading_consistency(self):
        """Test that all hooks load environment consistently."""
        # Some hooks should call load_chronicle_env(), others might handle it differently
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                # Should have some form of environment loading
                env_patterns = [
                    "load_chronicle_env()",
                    "load_dotenv()",
                    "os.getenv("
                ]
                
                has_env_loading = any(pattern in content for pattern in env_patterns)
                self.assertTrue(
                    has_env_loading,
                    f"{hook_file} does not appear to load environment variables"
                )
    
    def test_logging_setup_consistency(self):
        """Test that all hooks set up logging consistently."""
        for hook_file in self.expected_hook_files:
            with self.subTest(hook=hook_file):
                hook_path = self.hooks_dir / hook_file
                content = hook_path.read_text()
                
                # Should call setup_hook_logging
                self.assertIn(
                    "setup_hook_logging(",
                    content,
                    f"{hook_file} does not use standard logging setup"
                )

class TestStandardImportTemplate(unittest.TestCase):
    """Test the standard import template itself."""
    
    def test_template_imports_are_available(self):
        """Test that all imports in the template actually exist."""
        hooks_src_dir = Path(__file__).parent.parent / "src"
        
        # Test that we can import everything in our standard template
        test_code = f"""
import os
import sys
sys.path.insert(0, "{hooks_src_dir}")

# Test all the standard imports
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# Test optional imports that some hooks use
try:
    from lib.utils import extract_session_id, format_error_message, sanitize_data, get_project_path
    optional_imports_available = True
except ImportError:
    optional_imports_available = False

success = True
"""
        
        namespace = {}
        exec(test_code, namespace)
        self.assertTrue(namespace.get('success', False), "Standard template imports failed")
        self.assertTrue(namespace.get('optional_imports_available', False), "Optional imports not available")

def create_standard_import_template() -> str:
    """Generate the standard import template that all hooks should use."""
    return '''# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("{hook_name}")'''

if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)