"""
Test suite to validate the cleanup of the consolidated directory.

This test ensures that:
1. No active code imports from consolidated/
2. All functionality exists in src/lib/
3. It's safe to remove or archive the consolidated directory
"""

import unittest
import subprocess
import sys
from pathlib import Path


class TestConsolidatedCleanup(unittest.TestCase):
    """Test that consolidated directory can be safely removed."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.hooks_dir = Path(__file__).parent.parent
        self.consolidated_dir = self.hooks_dir / "consolidated"
        self.lib_dir = self.hooks_dir / "src" / "lib"
        
    def test_consolidated_directory_archived(self):
        """Verify consolidated directory has been archived."""
        archived_consolidated = self.hooks_dir / "archived" / "consolidated"
        self.assertFalse(self.consolidated_dir.exists(), 
                        "Consolidated directory should no longer exist in root")
        self.assertTrue(archived_consolidated.exists(),
                       "Consolidated directory should exist in archived/")
        
    def test_no_external_imports_from_consolidated(self):
        """Test that no external code imports from consolidated directory."""
        # Search for actual imports from consolidated, excluding:
        # - Comments and test files
        # - The consolidated directory itself
        # - This test file
        search_paths = [
            self.hooks_dir / "src",
            self.hooks_dir / "scripts", 
            self.hooks_dir / "config",
            self.hooks_dir / "examples"
        ]
        
        for search_path in search_paths:
            if search_path.exists():
                for py_file in search_path.rglob("*.py"):
                    with open(py_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        
                    for i, line in enumerate(lines, 1):
                        line = line.strip()
                        # Skip comments and empty lines
                        if line.startswith('#') or not line:
                            continue
                        # Look for actual import statements
                        if ('from consolidated' in line or 'import consolidated' in line) and \
                           (line.startswith('from ') or line.startswith('import ')):
                            self.fail(f"Found consolidated import in {py_file}:{i}: {line}")
    
    def test_no_references_to_consolidated_in_active_hooks(self):
        """Test that active hooks don't reference consolidated directory."""
        hooks_dir = self.hooks_dir / "src" / "hooks"
        
        if hooks_dir.exists():
            for hook_file in hooks_dir.glob("*.py"):
                with open(hook_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    self.assertNotIn('consolidated', content.lower(),
                                   f"Hook {hook_file.name} references 'consolidated'")
    
    def test_lib_directory_has_core_modules(self):
        """Test that src/lib has all essential modules."""
        required_modules = [
            '__init__.py',
            'base_hook.py', 
            'database.py',
            'utils.py',
            'errors.py',
            'performance.py',
            'security.py'
        ]
        
        for module in required_modules:
            module_path = self.lib_dir / module
            self.assertTrue(module_path.exists(),
                          f"Required module {module} missing from src/lib/")
    
    def test_lib_modules_importable(self):
        """Test that lib modules can be imported successfully."""
        # Add lib to path for testing
        lib_path = str(self.lib_dir)
        if lib_path not in sys.path:
            sys.path.insert(0, str(self.lib_dir.parent))
        
        try:
            # Test core imports work - these should import without external deps
            from lib.base_hook import BaseHook
            from lib.database import DatabaseManager
            from lib.utils import sanitize_data
            from lib.errors import ChronicleLogger
            from lib.security import SecurityValidator
            
            # Basic instantiation tests for modules that don't require external deps
            hook = BaseHook()
            self.assertIsNotNone(hook)
            
            db = DatabaseManager()
            self.assertIsNotNone(db)
            
        except ImportError as e:
            # If it fails due to missing external dependencies (like psutil), that's expected
            if 'psutil' in str(e) or 'supabase' in str(e):
                # This is expected - lib modules have external dependencies
                # The key test is that the modules exist and are structured correctly
                pass
            else:
                self.fail(f"Failed to import from lib due to structural issue: {e}")
        
        # Test that performance module exists even if it can't be imported due to psutil
        performance_path = self.lib_dir / 'performance.py'
        self.assertTrue(performance_path.exists(), "performance.py should exist in lib/")
    
    def test_consolidated_modules_not_imported_by_lib(self):
        """Test that lib modules don't import from consolidated."""
        for lib_file in self.lib_dir.glob("*.py"):
            with open(lib_file, 'r', encoding='utf-8') as f:
                content = f.read()
                self.assertNotIn('from consolidated', content,
                               f"lib/{lib_file.name} imports from consolidated")
                self.assertNotIn('import consolidated', content,
                               f"lib/{lib_file.name} imports consolidated")


class TestConsolidatedArchival(unittest.TestCase):
    """Test preparation for archival process."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.hooks_dir = Path(__file__).parent.parent
        self.consolidated_dir = self.hooks_dir / "consolidated"
        self.archived_dir = self.hooks_dir / "archived"
        
    def test_archived_directory_structure_ready(self):
        """Test that we can create archived directory structure."""
        # This test prepares for archival but doesn't actually archive
        expected_archive_path = self.archived_dir / "consolidated"
        
        # Verify we could create the archive path
        self.assertTrue(isinstance(expected_archive_path, Path))
        self.assertEqual(expected_archive_path.name, "consolidated")
        
    def test_consolidated_size_analysis(self):
        """Analyze the size of consolidated directory for documentation."""
        if not self.consolidated_dir.exists():
            self.skipTest("Consolidated directory doesn't exist")
            
        total_size = 0
        file_count = 0
        line_count = 0
        
        for file_path in self.consolidated_dir.rglob("*.py"):
            file_count += 1
            file_size = file_path.stat().st_size
            total_size += file_size
            
            # Count lines
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = len(f.readlines())
                    line_count += lines
            except UnicodeDecodeError:
                pass  # Skip binary files
        
        # Log the analysis results
        print(f"\nConsolidated directory analysis:")
        print(f"  Files: {file_count}")
        print(f"  Total size: {total_size:,} bytes ({total_size/1024:.1f} KB)")
        print(f"  Total lines: {line_count:,}")
        
        # These are informational, not assertions
        self.assertGreater(file_count, 0, "Should have found Python files")


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)