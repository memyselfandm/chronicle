#!/usr/bin/env python3
"""Update all UV scripts to use the new database manager and environment loader."""

import os
import re
from pathlib import Path

def update_imports_in_file(file_path: Path):
    """Update imports in a single file."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Skip if already updated or if it's one of our new modules
    if 'from env_loader import' in content or file_path.name in ['env_loader.py', 'database_manager.py', 'update_db_imports.py']:
        print(f"Skipping {file_path.name} - already updated or is a helper module")
        return
    
    # Update the environment loading section
    env_load_pattern = r'# Load environment variables\ntry:\n    from dotenv import load_dotenv\n    load_dotenv\(\)\nexcept ImportError:\n    pass'
    env_load_replacement = '''# Load environment variables with chronicle-aware loading
try:
    from env_loader import load_chronicle_env, get_database_config
    load_chronicle_env()
except ImportError:
    # Fallback to standard dotenv
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass'''
    
    content = re.sub(env_load_pattern, env_load_replacement, content)
    
    # Update DatabaseManager __init__ to use get_database_config
    db_init_pattern = r'(self\.sqlite_path = )os\.path\.expanduser\(os\.getenv\("CLAUDE_HOOKS_DB_PATH", ".*?"\)\)'
    db_init_replacement = r'\1Path(get_database_config().get("sqlite_path", "~/.claude/hooks/chronicle/data/chronicle.db")).expanduser().resolve()'
    
    content = re.sub(db_init_pattern, db_init_replacement, content)
    
    # Add Path import if using Path
    if 'Path(' in content and 'from pathlib import Path' not in content:
        # Add after other imports
        import_section_end = content.find('\n\n')
        if import_section_end > 0:
            content = content[:import_section_end] + '\nfrom pathlib import Path' + content[import_section_end:]
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Updated {file_path.name}")

def main():
    """Update all UV scripts."""
    script_dir = Path(__file__).parent.parent  # Go up to hooks/ directory
    
    # List of files to update
    files_to_update = [
        'notification.py',
        'post_tool_use.py',
        'pre_compact.py',
        'pre_tool_use.py',
        'stop.py',
        'subagent_stop.py',
        'user_prompt_submit.py',
    ]
    
    for filename in files_to_update:
        file_path = script_dir / filename
        if file_path.exists():
            update_imports_in_file(file_path)
        else:
            print(f"Warning: {filename} not found")

if __name__ == "__main__":
    main()