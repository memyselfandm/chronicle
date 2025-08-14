#!/usr/bin/env python3
"""
Claude Code Session Start Hook

This hook captures session initialization events and tracks project context.
Implements session lifecycle tracking as specified in H3.3.

Features:
- Extract project context (working directory, git branch if available)
- Generate or retrieve session ID from Claude Code environment
- Create session record in database with start_time
- Store as event_type='session_start' with data containing: {project_path, git_branch, git_commit}

Usage:
    This script is called by Claude Code during session initialization.
    It reads JSON input from stdin and outputs JSON response to stdout.

Exit Codes:
    0: Success, continue execution
    2: Blocking error, show stderr to Claude
    Other: Non-blocking error, show stderr to user
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add core directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'core'))

from base_hook import BaseHook


class SessionStartHook(BaseHook):
    """
    Hook for processing Claude Code session start events.
    
    Captures session initialization data including:
    - Session ID extraction and management
    - Project context (working directory, git info)
    - Session record creation in database
    - Event logging with session_start event type
    """
    
    def __init__(self, config=None):
        """Initialize session start hook."""
        super().__init__(config)
        self.hook_name = "session_start"
    
    def process_session_start(self, input_data):
        """
        Process session start hook data.
        
        Args:
            input_data: Hook input data from Claude Code
            
        Returns:
            Tuple of (success: bool, session_data: dict, event_data: dict)
        """
        try:
            # Extract session ID and basic data
            processed_data = self.process_hook_data(input_data)
            
            # Get project context
            project_context = self.load_project_context(processed_data.get("cwd"))
            
            # Extract session start specific data
            trigger_source = input_data.get("source", "unknown")
            
            # Prepare session data with claude_session_id
            session_data = {
                "claude_session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "source": trigger_source,
                "project_path": project_context.get("cwd"),
                "git_branch": project_context.get("git_info", {}).get("branch"),
                "git_commit": project_context.get("git_info", {}).get("commit_hash"),
            }
            
            # Prepare event data (session_id will be set by BaseHook.save_event using session_uuid)
            event_data = {
                "event_type": "session_start",
                "hook_event_name": "session_start",
                "data": {
                    "project_path": project_context.get("cwd"),
                    "git_branch": project_context.get("git_info", {}).get("branch"),
                    "git_commit": project_context.get("git_info", {}).get("commit_hash"),
                    "trigger_source": trigger_source,
                    "session_context": project_context.get("session_context", {}),
                }
            }
            
            # Save session first to get the UUID for events
            session_success = self.save_session(session_data)
            event_success = False
            
            # Only save event if session was saved successfully
            if session_success and self.session_uuid:
                event_success = self.save_event(event_data)
            else:
                logger.error("Cannot save event: session save failed or no session UUID available")
            
            return (session_success and event_success, session_data, event_data)
            
        except Exception as e:
            self.log_error(e, "process_session_start")
            return (False, {}, {})
    
    def create_session_start_response(self, success, session_data, event_data):
        """
        Create hook response for session start.
        
        Args:
            success: Whether session start processing succeeded
            session_data: Session data that was saved
            event_data: Event data that was logged
            
        Returns:
            Dict containing hook response
        """
        hook_specific_data = {
            "session_initialized": success,
            "claude_session_id": session_data.get("claude_session_id"),
            "session_uuid": getattr(self, "session_uuid", None),
            "project_path": session_data.get("project_path"),
            "git_branch": session_data.get("git_branch"),
            "trigger_source": session_data.get("source"),
        }
        
        return self.create_response(
            continue_execution=True,
            suppress_output=True,  # Don't clutter transcript with session init
            hook_specific_data=hook_specific_data
        )


def main():
    """
    Main entry point for session start hook.
    
    Reads JSON input from stdin, processes session start event,
    and outputs JSON response to stdout.
    """
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Initialize hook
        hook = SessionStartHook()
        
        # Process session start
        success, session_data, event_data = hook.process_session_start(input_data)
        
        # Create response
        response = hook.create_session_start_response(success, session_data, event_data)
        
        # Output response as JSON
        print(json.dumps(response))
        
        # Exit with success
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        # Invalid JSON input
        error_msg = f"Invalid JSON input: {str(e)}"
        print(error_msg, file=sys.stderr)
        sys.exit(2)
        
    except Exception as e:
        # General error - log but don't block Claude execution
        error_msg = f"Session start hook error: {str(e)}"
        print(error_msg, file=sys.stderr)
        
        # Try to output a minimal response to continue execution
        try:
            minimal_response = {"continue": True, "suppressOutput": True}
            print(json.dumps(minimal_response))
        except:
            pass  # If even this fails, just exit
        
        sys.exit(1)


if __name__ == "__main__":
    main()