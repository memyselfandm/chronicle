#!/usr/bin/env python3
"""Fix UV scripts to import helper modules instead of inlining them."""

import re
from pathlib import Path

def fix_uv_script(script_path: Path):
    """Fix a single UV script to use imports instead of inline code."""
    
    with open(script_path, 'r') as f:
        content = f.read()
    
    # Check if it already imports database_manager
    if "from database_manager import DatabaseManager" in content:
        print(f"✓ {script_path.name} already imports DatabaseManager")
        return
    
    # Find where DatabaseManager class is defined
    db_manager_match = re.search(r'^class DatabaseManager:.*?(?=^class\s|\Z)', content, re.MULTILINE | re.DOTALL)
    
    if not db_manager_match:
        print(f"⚠ {script_path.name} doesn't have DatabaseManager class")
        return
    
    # Remove the DatabaseManager class definition
    new_content = content[:db_manager_match.start()] + content[db_manager_match.end():]
    
    # Also remove DatabaseError class if it exists
    db_error_match = re.search(r'^class DatabaseError\(Exception\):.*?pass\s*\n\n', new_content, re.MULTILINE | re.DOTALL)
    if db_error_match:
        new_content = new_content[:db_error_match.start()] + new_content[db_error_match.end():]
    
    # Add import after env_loader import
    env_import_match = re.search(r'(from env_loader import.*?\n)', new_content)
    if env_import_match:
        # Add database_manager import after env_loader import
        insert_pos = env_import_match.end()
        new_content = (new_content[:insert_pos] + 
                      "from database_manager import DatabaseManager, DatabaseError\n" +
                      new_content[insert_pos:])
    else:
        # Add import after the main imports section
        import_section_end = re.search(r'(from typing import.*?\n\n)', new_content)
        if import_section_end:
            insert_pos = import_section_end.end()
            new_content = (new_content[:insert_pos] + 
                          "# Import database manager\n"
                          "try:\n"
                          "    from database_manager import DatabaseManager, DatabaseError\n"
                          "except ImportError:\n"
                          "    # This should not happen if properly installed\n"
                          "    raise ImportError('database_manager.py must be in the same directory as the hooks')\n\n" +
                          new_content[insert_pos:])
    
    # Write the updated content
    with open(script_path, 'w') as f:
        f.write(new_content)
    
    print(f"✅ Fixed {script_path.name}")

# Fix all UV scripts
uv_scripts_dir = Path("apps/hooks/src/hooks/uv_scripts")
for script_path in uv_scripts_dir.glob("*_uv.py"):
    if script_path.name not in ["database_manager.py", "env_loader.py"]:
        fix_uv_script(script_path)