#!/usr/bin/env python3
"""
Import Pattern Validation Script

This script validates that all hooks follow the standardized import pattern.
Can be used in CI/CD pipelines or as a development check.

Usage:
    python scripts/validate_import_patterns.py
    python scripts/validate_import_patterns.py --hook notification.py
    python scripts/validate_import_patterns.py --fix
"""

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class ImportPatternValidator:
    """Validates import patterns in hook files."""
    
    def __init__(self, hooks_dir: Path):
        self.hooks_dir = hooks_dir
        self.errors = []
        self.warnings = []
        
        # Standard patterns to validate
        self.required_patterns = {
            "path_setup": r"sys\.path\.insert\(0, os\.path\.join\(os\.path\.dirname\(__file__\), '\.\.'\)\)",
            "lib_imports": r"from lib\.",
            "ujson_try": r"try:\s+import ujson as json_impl",
            "ujson_except": r"except ImportError:\s+import json as json_impl",
            "env_load": r"load_chronicle_env\(\)",
            "logger_setup": r"setup_hook_logging\("
        }
        
        # Forbidden patterns (indicate old/redundant code)
        self.forbidden_patterns = {
            "redundant_try_lib": r"try:\s+from lib\.",
            "uv_fallback": r"# For UV script compatibility",
            "old_path_insert": r"sys\.path\.insert\(0, str\(Path\(__file__\)\.parent\.parent",
            "duplicate_ujson": r"try:\s+import ujson.*\n.*except ImportError.*\n.*try:\s+import ujson"
        }
        
        # Required imports for all hooks
        self.required_imports = {
            "lib.database": ["DatabaseManager"],
            "lib.base_hook": ["BaseHook"],
            "lib.utils": ["load_chronicle_env"]
        }
    
    def validate_hook(self, hook_file: Path) -> Tuple[bool, List[str], List[str]]:
        """Validate a single hook file."""
        errors = []
        warnings = []
        
        try:
            content = hook_file.read_text()
            
            # Check required patterns
            for pattern_name, pattern in self.required_patterns.items():
                if not re.search(pattern, content, re.MULTILINE):
                    errors.append(f"Missing required pattern: {pattern_name}")
            
            # Check forbidden patterns
            for pattern_name, pattern in self.forbidden_patterns.items():
                if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                    errors.append(f"Found forbidden pattern: {pattern_name}")
            
            # Check required imports
            for module, imports in self.required_imports.items():
                for import_name in imports:
                    if not self._check_import_exists(content, module, import_name):
                        errors.append(f"Missing required import: {import_name} from {module}")
            
            # Check import order
            order_issues = self._check_import_order(content)
            warnings.extend(order_issues)
            
            # Check for duplicate imports
            duplicates = self._check_duplicate_imports(content)
            errors.extend(duplicates)
            
        except Exception as e:
            errors.append(f"Error reading file: {e}")
        
        return len(errors) == 0, errors, warnings
    
    def _check_import_exists(self, content: str, module: str, import_name: str) -> bool:
        """Check if a specific import exists in the content."""
        patterns = [
            f"from {module} import {import_name}",
            f"from {module} import .*{import_name}",
            f"from {module} import \\(\n.*{import_name}"
        ]
        
        for pattern in patterns:
            if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                return True
        
        # Fallback: check if both module and import exist separately
        module_exists = f"from {module} import" in content
        import_exists = import_name in content
        return module_exists and import_exists
    
    def _check_import_order(self, content: str) -> List[str]:
        """Check if imports are in the correct order."""
        issues = []
        lines = content.split('\n')
        
        # Find key lines
        path_insert_line = -1
        lib_import_line = -1
        ujson_line = -1
        env_load_line = -1
        
        for i, line in enumerate(lines):
            if "sys.path.insert(0, os.path.join" in line:
                path_insert_line = i
            elif line.strip().startswith("from lib.") and lib_import_line == -1:
                lib_import_line = i
            elif "import ujson as json_impl" in line and ujson_line == -1:
                ujson_line = i
            elif "load_chronicle_env()" in line and env_load_line == -1:
                env_load_line = i
        
        # Check order
        if path_insert_line != -1 and lib_import_line != -1:
            if path_insert_line > lib_import_line:
                issues.append("sys.path.insert should come before lib imports")
        
        if lib_import_line != -1 and ujson_line != -1:
            if lib_import_line > ujson_line:
                issues.append("lib imports should come before ujson imports")
        
        if ujson_line != -1 and env_load_line != -1:
            if ujson_line > env_load_line:
                issues.append("ujson imports should come before environment loading")
        
        return issues
    
    def _check_duplicate_imports(self, content: str) -> List[str]:
        """Check for duplicate import statements."""
        issues = []
        
        # Check for duplicate ujson imports
        ujson_pattern = r"try:\s+import ujson as json_impl\s+except ImportError:\s+import json as json_impl"
        matches = list(re.finditer(ujson_pattern, content, re.MULTILINE | re.DOTALL))
        if len(matches) > 1:
            issues.append(f"Found {len(matches)} duplicate ujson import blocks")
        
        # Check for duplicate env loading
        env_pattern = r"load_chronicle_env\(\)"
        matches = list(re.finditer(env_pattern, content))
        if len(matches) > 1:
            issues.append(f"Found {len(matches)} duplicate load_chronicle_env() calls")
        
        # Check for duplicate logger setup
        logger_pattern = r"setup_hook_logging\("
        matches = list(re.finditer(logger_pattern, content))
        if len(matches) > 1:
            issues.append(f"Found {len(matches)} duplicate logger setup calls")
        
        return issues
    
    def validate_all_hooks(self, specific_hook: Optional[str] = None) -> bool:
        """Validate all hooks or a specific hook."""
        if specific_hook:
            hook_files = [self.hooks_dir / specific_hook]
            if not hook_files[0].exists():
                print(f"❌ Hook file not found: {specific_hook}")
                return False
        else:
            hook_files = [f for f in self.hooks_dir.glob("*.py") if f.name != "__init__.py"]
        
        total_hooks = len(hook_files)
        valid_hooks = 0
        
        print(f"🔍 Validating import patterns for {total_hooks} hooks...\n")
        
        for hook_file in sorted(hook_files):
            print(f"📁 {hook_file.name}")
            
            is_valid, errors, warnings = self.validate_hook(hook_file)
            
            if is_valid:
                print("  ✅ PASS")
                valid_hooks += 1
            else:
                print("  ❌ FAIL")
                for error in errors:
                    print(f"    🚨 {error}")
            
            if warnings:
                for warning in warnings:
                    print(f"    ⚠️  {warning}")
            
            print()
        
        print(f"📊 Results: {valid_hooks}/{total_hooks} hooks passed validation")
        
        if valid_hooks == total_hooks:
            print("🎉 All hooks follow the standard import pattern!")
            return True
        else:
            print("💥 Some hooks need fixing. Run with --fix to auto-fix common issues.")
            return False
    
    def auto_fix_hook(self, hook_file: Path) -> bool:
        """Attempt to auto-fix common import pattern issues."""
        try:
            content = hook_file.read_text()
            original_content = content
            
            # Remove duplicate ujson blocks
            ujson_pattern = r"(try:\s+import ujson as json_impl\s+except ImportError:\s+import json as json_impl\s*\n)"
            matches = list(re.finditer(ujson_pattern, content, re.MULTILINE | re.DOTALL))
            if len(matches) > 1:
                # Keep only the first occurrence
                for match in matches[1:]:
                    content = content.replace(match.group(1), "")
                print(f"    🔧 Removed {len(matches) - 1} duplicate ujson blocks")
            
            # Remove duplicate environment loading
            env_calls = list(re.finditer(r"load_chronicle_env\(\)\s*\n", content))
            if len(env_calls) > 1:
                for match in env_calls[1:]:
                    content = content.replace(match.group(0), "")
                print(f"    🔧 Removed {len(env_calls) - 1} duplicate load_chronicle_env() calls")
            
            # Remove duplicate logger setup
            logger_calls = list(re.finditer(r"logger = setup_hook_logging\([^)]+\)\s*\n", content))
            if len(logger_calls) > 1:
                for match in logger_calls[1:]:
                    content = content.replace(match.group(0), "")
                print(f"    🔧 Removed {len(logger_calls) - 1} duplicate logger setup calls")
            
            # Remove redundant try/except blocks for lib imports
            redundant_pattern = r"# Import from shared library modules\ntry:\s+from lib\..*?(?=\n\n|\nfrom|\nclass|\ndef)"
            content = re.sub(redundant_pattern, "", content, flags=re.MULTILINE | re.DOTALL)
            
            if content != original_content:
                hook_file.write_text(content)
                return True
            
        except Exception as e:
            print(f"    ❌ Error auto-fixing: {e}")
        
        return False

def main():
    """Main entry point for the validation script."""
    parser = argparse.ArgumentParser(description="Validate hook import patterns")
    parser.add_argument("--hook", help="Validate specific hook file")
    parser.add_argument("--fix", action="store_true", help="Auto-fix common issues")
    parser.add_argument("--quiet", action="store_true", help="Minimal output")
    
    args = parser.parse_args()
    
    # Find hooks directory
    script_dir = Path(__file__).parent
    hooks_dir = script_dir.parent / "src" / "hooks"
    
    if not hooks_dir.exists():
        print(f"❌ Hooks directory not found: {hooks_dir}")
        sys.exit(1)
    
    validator = ImportPatternValidator(hooks_dir)
    
    if args.fix:
        print("🔧 Auto-fixing common import pattern issues...\n")
        
        hook_files = [hooks_dir / args.hook] if args.hook else [f for f in hooks_dir.glob("*.py") if f.name != "__init__.py"]
        
        for hook_file in sorted(hook_files):
            if hook_file.exists():
                print(f"📁 {hook_file.name}")
                if validator.auto_fix_hook(hook_file):
                    print("    ✅ Fixed")
                else:
                    print("    ℹ️  No fixes needed")
        
        print("\n🔍 Re-validating after fixes...\n")
    
    # Validate
    success = validator.validate_all_hooks(args.hook)
    
    if not args.quiet:
        if success:
            print("\n✨ Import pattern validation completed successfully!")
        else:
            print("\n💥 Import pattern validation failed!")
            print("Run 'python scripts/validate_import_patterns.py --fix' to auto-fix common issues.")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()