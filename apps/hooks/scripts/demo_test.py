#!/usr/bin/env python3
"""
Chronicle Hooks Demo Test

Creates test files and performs actions that will trigger hooks
to demonstrate Chronicle observability in action.
"""

import json
import os
import tempfile
import time
from datetime import datetime
from pathlib import Path


def create_demo_files():
    """Create demo files for testing Chronicle hooks."""
    demo_dir = Path.cwd() / "chronicle_demo"
    demo_dir.mkdir(exist_ok=True)
    
    # Create a simple Python file
    python_file = demo_dir / "demo_script.py"
    python_file.write_text('''#!/usr/bin/env python3
"""
Demo script for Chronicle hooks testing.
"""

def greet(name):
    """Simple greeting function."""
    return f"Hello, {name}! Chronicle is watching! 👀"

def calculate(a, b):
    """Simple calculation."""
    return a + b

if __name__ == "__main__":
    print(greet("Developer"))
    result = calculate(10, 5)
    print(f"10 + 5 = {result}")
''')
    
    # Create a config file
    config_file = demo_dir / "config.json"
    config_data = {
        "app_name": "Chronicle Demo",
        "version": "1.0.0",
        "settings": {
            "debug": True,
            "logging_level": "INFO"
        }
    }
    config_file.write_text(json.dumps(config_data, indent=2))
    
    # Create a README
    readme_file = demo_dir / "README.md"
    readme_file.write_text('''# Chronicle Demo Project

This is a demo project for testing Chronicle hooks.

## Files
- `demo_script.py` - Sample Python script
- `config.json` - Configuration file
- `README.md` - This file

## Testing Chronicle
When you interact with these files using Claude Code tools, Chronicle will capture:
- File reads and writes
- Code execution
- Session activity
- Tool usage patterns

Check your Chronicle dashboard to see the observability data!
''')
    
    return demo_dir


def print_demo_instructions():
    """Print instructions for testing hooks with Claude Code."""
    print("🎬 Chronicle Hooks Demo")
    print("=" * 50)
    
    print("\n📝 Demo Instructions:")
    print("1. Start a new Claude Code session")
    print("2. Try these commands to trigger Chronicle hooks:")
    print()
    
    demo_dir = Path.cwd() / "chronicle_demo"
    
    print("   📖 Read operations (triggers post_tool_use hook):")
    print(f"   - Read the file {demo_dir}/demo_script.py")
    print(f"   - List files in {demo_dir}")
    print(f"   - Read {demo_dir}/config.json")
    print()
    
    print("   ✏️ Write operations (triggers post_tool_use hook):")
    print(f"   - Edit {demo_dir}/demo_script.py to add a new function")
    print(f"   - Create a new file in {demo_dir}")
    print()
    
    print("   🖥️ Command operations (triggers post_tool_use hook):")
    print(f"   - Run: python {demo_dir}/demo_script.py")
    print("   - Run: ls -la")
    print("   - Run: git status")
    print()
    
    print("   💬 Conversation (triggers user_prompt_submit hook):")
    print("   - Ask questions about the code")
    print("   - Request explanations or modifications")
    print()
    
    print("🔍 Observability Data Captured:")
    print("- Session start/stop events")
    print("- Tool usage (Read, Write, Edit, Bash, etc.)")
    print("- User prompts and responses") 
    print("- File modifications and access patterns")
    print("- Command executions and results")
    print("- Performance metrics (execution times)")
    print()
    
    print("📊 Check Your Data:")
    print("- Chronicle Dashboard: http://localhost:3000")
    print("- Database: ~/.claude/hooks_data.db (SQLite)")
    print("- Logs: ~/.claude/hooks.log")
    print()
    
    print("🧪 Test Hooks Directly:")
    print("- Run: python scripts/test_hooks.py --full")
    print("- Check: python scripts/test_hooks.py --quick")


def simulate_hook_events():
    """Simulate some hook events for testing."""
    print("\n🔄 Simulating Hook Events...")
    
    # Simulate a session start
    print("📍 Session start event")
    
    # Simulate some tool usage
    tools_to_simulate = [
        ("Read", {"file_path": "/demo/test.py"}),
        ("Write", {"file_path": "/demo/new.py", "content": "print('Hello')"}),
        ("Bash", {"command": "ls -la"}),
        ("Edit", {"file_path": "/demo/test.py", "old_string": "old", "new_string": "new"})
    ]
    
    for tool_name, tool_input in tools_to_simulate:
        print(f"🔧 {tool_name} tool usage")
        time.sleep(0.5)  # Simulate time between operations
    
    print("📍 Session end event")
    print("\n✅ Simulation complete!")
    print("💡 In a real Claude Code session, these events would be captured automatically.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Chronicle hooks demo and testing")
    parser.add_argument("--create-files", action="store_true", help="Create demo files")
    parser.add_argument("--simulate", action="store_true", help="Simulate hook events")
    parser.add_argument("--instructions", action="store_true", help="Show demo instructions")
    
    args = parser.parse_args()
    
    if args.create_files:
        demo_dir = create_demo_files()
        print(f"✅ Demo files created in: {demo_dir}")
        print("📝 Now follow the instructions to test Chronicle hooks!")
        print_demo_instructions()
        
    elif args.simulate:
        simulate_hook_events()
        
    elif args.instructions:
        print_demo_instructions()
        
    else:
        # Default: show instructions and create files
        demo_dir = create_demo_files()
        print(f"✅ Demo files created in: {demo_dir}")
        print_demo_instructions()