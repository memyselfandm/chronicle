#!/usr/bin/env python3
"""Debug hook environment during Claude Code execution."""

import os
import sys
import json
from pathlib import Path

def main():
    """Log environment details when called as a hook."""
    
    # Get input from stdin (Claude Code sends JSON)
    try:
        input_data = json.loads(sys.stdin.read())
    except:
        input_data = {"error": "Could not parse input"}
    
    # Log to a debug file
    debug_file = Path.home() / ".claude" / "hooks" / "chronicle" / "debug.log"
    debug_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(debug_file, 'a') as f:
        f.write("\n" + "="*60 + "\n")
        f.write(f"Hook Debug - {input_data.get('hookEventName', 'unknown')}\n")
        f.write("="*60 + "\n")
        
        # Log environment variables
        f.write("\nEnvironment Variables:\n")
        for key in sorted(os.environ.keys()):
            if any(x in key for x in ['SUPABASE', 'CLAUDE', 'CHRONICLE']):
                value = os.environ[key]
                if 'KEY' in key or 'key' in key:
                    value = value[:10] + "..." if len(value) > 10 else value
                f.write(f"  {key}={value}\n")
        
        # Log working directory
        f.write(f"\nWorking Directory: {os.getcwd()}\n")
        
        # Log .env file locations
        f.write("\n.env File Search:\n")
        search_paths = [
            Path.cwd() / '.env',
            Path.home() / '.claude' / 'hooks' / 'chronicle' / '.env',
            Path(__file__).parent / '.env',
        ]
        
        for path in search_paths:
            if path.exists():
                f.write(f"  ✓ Found: {path}\n")
            else:
                f.write(f"  ✗ Missing: {path}\n")
        
        # Log input data
        f.write(f"\nInput Data: {json.dumps(input_data, indent=2)}\n")
    
    # Return standard hook response
    response = {
        "continue": True,
        "suppressOutput": False,
        "debug_logged": str(debug_file)
    }
    
    print(json.dumps(response))

if __name__ == "__main__":
    main()