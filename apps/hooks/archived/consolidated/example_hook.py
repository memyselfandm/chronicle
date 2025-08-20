#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["supabase"]
# ///

"""
Example UV Single-File Hook using Consolidated Dependencies

This demonstrates how to create a complete Chronicle hook in a single file
using the consolidated dependencies. The hook includes:
- Database connectivity with fallback
- Security validation 
- Error handling
- Performance monitoring
- Session management

Total lines including dependencies: <500 lines
Execution time: <100ms (Claude Code compatible)
"""

import json
import sys
from typing import Dict, Any

# Import consolidated functionality
from consolidated import consolidated_hook, create_hook


@consolidated_hook("PostToolUse")
def post_tool_use_hook(processed_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Example PostToolUse hook with full functionality.
    
    Demonstrates:
    - Input processing and validation
    - Database event saving
    - Hook-specific response generation
    """
    hook_event = processed_data["hook_event_name"]
    claude_session_id = processed_data["claude_session_id"]
    raw_input = processed_data["raw_input"]
    
    # Extract tool information
    tool_name = raw_input.get("toolName", "unknown")
    tool_input = raw_input.get("toolInput", {})
    tool_result = raw_input.get("toolResult", {})
    
    # Create hook-specific response
    hook_response = {
        "hookEventName": hook_event,
        "toolName": tool_name,
        "sessionId": claude_session_id,
        "processed": True,
        "inputKeys": list(tool_input.keys()) if isinstance(tool_input, dict) else [],
        "hasResult": bool(tool_result),
        "timestamp": processed_data["timestamp"]
    }
    
    return {
        "continue": True,
        "suppressOutput": False,
        "hookSpecificOutput": hook_response
    }


def manual_session_start_hook(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Example of manual hook implementation for more control.
    Shows how to use the consolidated base hook directly.
    """
    # Create hook instance with custom config
    config = {"max_input_size_mb": 5.0}  # Smaller limit for this hook
    hook = create_hook(config)
    
    def session_logic(processed_data):
        # Extract session information
        claude_session_id = processed_data["claude_session_id"]
        project_context = hook.load_project_context()
        
        # Create session data
        session_data = {
            "claude_session_id": claude_session_id,
            "project_path": project_context["cwd"],
            "git_branch": project_context["git_info"]["branch"],
            "start_time": processed_data["timestamp"]
        }
        
        # Save session to database
        session_saved = hook.save_session(session_data)
        
        # Create event for session start
        event_data = {
            "event_type": "session_start", 
            "hook_event_name": "SessionStart",
            "data": {
                "project_context": project_context,
                "session_saved": session_saved
            }
        }
        hook.save_event(event_data)
        
        # Return response
        return hook.create_response(
            continue_execution=True,
            suppress_output=False,
            hook_specific_data={
                "hookEventName": "SessionStart",
                "sessionId": claude_session_id,
                "projectPath": project_context["cwd"],
                "gitBranch": project_context["git_info"]["branch"],
                "sessionSaved": session_saved,
                "timestamp": processed_data["timestamp"]
            }
        )
    
    # Execute with full optimization pipeline
    return hook.execute_hook_optimized(input_data, session_logic)


def simple_validation_hook(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal hook that just validates input and returns status.
    Demonstrates the lightest possible hook implementation.
    """
    from consolidated import (
        is_valid_hook_event, is_safe_input_size, 
        sanitize_data, create_hook_response
    )
    
    # Quick validation
    hook_event = input_data.get("hookEventName")
    
    if not is_valid_hook_event(hook_event):
        return create_hook_response(
            continue_execution=True,
            suppress_output=True,
            hook_specific_data={
                "error": f"Invalid hook event: {hook_event}",
                "valid": False
            }
        )
    
    if not is_safe_input_size(input_data, max_size_mb=1.0):
        return create_hook_response(
            continue_execution=True, 
            suppress_output=True,
            hook_specific_data={
                "error": "Input data too large",
                "valid": False
            }
        )
    
    # Sanitize and return
    sanitized = sanitize_data(input_data)
    
    return create_hook_response(
        continue_execution=True,
        hook_specific_data={
            "hookEventName": hook_event,
            "inputValid": True,
            "inputSize": len(json.dumps(input_data)),
            "timestamp": sanitized.get("timestamp")
        }
    )


def main():
    """Main entry point for UV script execution."""
    if len(sys.argv) > 1:
        # Command line argument specifies which hook to run
        hook_type = sys.argv[1].lower()
    else:
        # Default to PostToolUse
        hook_type = "posttooluse"
    
    # Read input from stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        # Invalid JSON input
        result = {
            "continue": True,
            "suppressOutput": True,
            "error": "Invalid JSON input"
        }
        print(json.dumps(result))
        return
    
    # Route to appropriate hook
    if hook_type == "posttooluse":
        result = post_tool_use_hook(input_data)
    elif hook_type == "sessionstart":
        result = manual_session_start_hook(input_data)
    elif hook_type == "validation":
        result = simple_validation_hook(input_data)
    else:
        result = {
            "continue": True,
            "suppressOutput": True, 
            "error": f"Unknown hook type: {hook_type}"
        }
    
    # Output result as JSON
    print(json.dumps(result, separators=(',', ':')))


if __name__ == "__main__":
    main()