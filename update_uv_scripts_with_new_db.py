#!/usr/bin/env python3
"""Update all UV scripts with the new database manager code."""

import os
from pathlib import Path

# Read the new database manager
db_manager_path = Path("apps/hooks/src/hooks/uv_scripts/database_manager.py")
with open(db_manager_path) as f:
    db_manager_content = f.read()

# Extract just the DatabaseManager class
start_marker = "class DatabaseManager:"
end_marker = "\n\n# Example usage" 
start_idx = db_manager_content.find(start_marker)
end_idx = db_manager_content.find(end_marker)

if end_idx == -1:
    # Find the end of the class by looking for the next class or end of file
    class_content = db_manager_content[start_idx:]
    # Find where the class ends (next class definition or end of imports section)
    lines = class_content.split('\n')
    class_lines = []
    indent_level = None
    
    for i, line in enumerate(lines):
        if i == 0:  # class DatabaseManager: line
            class_lines.append(line)
            continue
            
        # Detect the base indentation level from first method
        if indent_level is None and line.strip() and not line.startswith('class'):
            indent_level = len(line) - len(line.lstrip())
        
        # If we hit a line that's not indented (and not empty), we're done
        if line.strip() and not line.startswith(' ') and i > 1:
            break
            
        class_lines.append(line)
    
    new_db_manager = '\n'.join(class_lines)
else:
    new_db_manager = db_manager_content[start_idx:end_idx]

# Now update each UV script
uv_scripts_dir = Path("apps/hooks/src/hooks/uv_scripts")
updated = 0

for script_path in uv_scripts_dir.glob("*_uv.py"):
    print(f"Updating {script_path.name}...")
    
    with open(script_path) as f:
        content = f.read()
    
    # Find and replace the DatabaseManager class
    if "class DatabaseManager:" in content:
        # Find the start and end of the existing DatabaseManager class
        start = content.find("class DatabaseManager:")
        
        # Find the end by looking for the next class or a specific marker
        # Look for the next line that starts with a non-whitespace character after methods
        lines_after_start = content[start:].split('\n')
        end_line_idx = 0
        
        for i, line in enumerate(lines_after_start[1:], 1):
            # If we find another class or a top-level function/variable, stop
            if line and not line.startswith(' ') and not line.startswith('\t'):
                end_line_idx = i
                break
        
        if end_line_idx > 0:
            # Calculate the actual end position in the content
            end = start + len('\n'.join(lines_after_start[:end_line_idx]))
            
            # Replace the old DatabaseManager with the new one
            new_content = content[:start] + new_db_manager + content[end:]
            
            # Write the updated content
            with open(script_path, 'w') as f:
                f.write(new_content)
            
            updated += 1
            print(f"  ✅ Updated {script_path.name}")
        else:
            print(f"  ⚠️  Could not find end of DatabaseManager class in {script_path.name}")
    else:
        print(f"  ⏭️  No DatabaseManager class found in {script_path.name}")

print(f"\n✅ Updated {updated} UV scripts with new database manager")