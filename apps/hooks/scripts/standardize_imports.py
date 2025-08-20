#!/usr/bin/env python3
"""
Import Pattern Standardization Script

This script applies the standardized import pattern to all hooks,
ensuring consistency and maintainability across the codebase.
"""

import re
import sys
from pathlib import Path
from typing import Dict, List

def get_standard_import_section(hook_name: str) -> str:
    """Generate the standard import section for a hook."""
    # Extract just the hook name without .py extension
    clean_hook_name = hook_name.replace('.py', '').replace('_', ' ').title().replace(' ', '')
    
    return f'''# Add src directory to path for lib imports
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
logger = setup_hook_logging("{hook_name.replace('.py', '')}")'''

def find_import_section_boundaries(content: str) -> tuple:
    """Find the start and end of the import section to replace."""
    lines = content.split('\n')
    
    # Find first non-shebang, non-comment, non-docstring line with imports
    import_start = -1
    import_end = -1
    
    in_docstring = False
    docstring_delimiter = None
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Skip shebang
        if stripped.startswith('#!'):
            continue
            
        # Handle docstrings
        if not in_docstring and (stripped.startswith('"""') or stripped.startswith("'''")):
            in_docstring = True
            docstring_delimiter = stripped[:3]
            if stripped.count(docstring_delimiter) >= 2 and len(stripped) > 3:
                # Single-line docstring
                in_docstring = False
            continue
        elif in_docstring and docstring_delimiter in stripped:
            in_docstring = False
            continue
        elif in_docstring:
            continue
            
        # Skip other comments
        if stripped.startswith('#'):
            continue
            
        # Look for import-related lines
        if any(keyword in stripped for keyword in ['import ', 'from ', 'sys.path']):
            if import_start == -1:
                import_start = i
            import_end = i
        elif import_start != -1 and stripped and not stripped.startswith('#'):
            # Found non-import line after imports started
            break
    
    # Find initialization lines (logger setup, load_chronicle_env)
    for i in range(import_end + 1, min(import_end + 20, len(lines))):
        stripped = lines[i].strip()
        if any(keyword in stripped for keyword in ['load_chronicle_env', 'setup_hook_logging', 'logger =']):
            import_end = i
        elif stripped and not stripped.startswith('#'):
            break
    
    return import_start, import_end

def standardize_hook_imports(hook_path: Path) -> bool:
    """Standardize imports for a single hook file."""
    print(f"Processing {hook_path.name}...")
    
    try:
        content = hook_path.read_text()
        lines = content.split('\n')
        
        # Find import section boundaries
        import_start, import_end = find_import_section_boundaries(content)
        
        if import_start == -1:
            print(f"  Warning: Could not find import section in {hook_path.name}")
            return False
        
        print(f"  Found import section: lines {import_start+1} to {import_end+1}")
        
        # Generate standard import section
        standard_imports = get_standard_import_section(hook_path.name)
        
        # Replace the import section
        new_lines = (
            lines[:import_start] +  # Everything before imports
            standard_imports.split('\n') +  # New standard imports
            lines[import_end + 1:]  # Everything after imports
        )
        
        # Write back to file
        new_content = '\n'.join(new_lines)
        hook_path.write_text(new_content)
        
        print(f"  ✅ Standardized imports for {hook_path.name}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error processing {hook_path.name}: {e}")
        return False

def main():
    """Main function to standardize all hook imports."""
    hooks_dir = Path(__file__).parent.parent / "src" / "hooks"
    
    if not hooks_dir.exists():
        print(f"❌ Hooks directory not found: {hooks_dir}")
        sys.exit(1)
    
    # Get all hook files (exclude __init__.py)
    hook_files = [f for f in hooks_dir.glob("*.py") if f.name != "__init__.py"]
    
    if not hook_files:
        print("❌ No hook files found")
        sys.exit(1)
    
    print(f"🔧 Standardizing imports for {len(hook_files)} hooks...\n")
    
    success_count = 0
    for hook_file in sorted(hook_files):
        if standardize_hook_imports(hook_file):
            success_count += 1
        print()  # Empty line between files
    
    print(f"📊 Results: {success_count}/{len(hook_files)} hooks updated successfully")
    
    if success_count == len(hook_files):
        print("✅ All hooks standardized successfully!")
    else:
        print("⚠️  Some hooks had issues - please review manually")
        sys.exit(1)

if __name__ == "__main__":
    main()