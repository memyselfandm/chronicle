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
from typing import Optional, Dict, Any

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
        self.hook_name = "SessionStart"
    
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
                "hook_event_name": processed_data.get("hook_event_name", "SessionStart"),
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
                self.log_error(Exception("Cannot save event: session save failed or no session UUID available"), "process_session_start")
            
            return (session_success and event_success, session_data, event_data)
            
        except Exception as e:
            self.log_error(e, "process_session_start")
            return (False, {}, {})
    
    def create_session_start_response(self, success, session_data, event_data, 
                                      additional_context: Optional[str] = None):
        """
        Create hook response for session start with new JSON format.
        
        Args:
            success: Whether session start processing succeeded
            session_data: Session data that was saved
            event_data: Event data that was logged
            additional_context: Optional context about the session/project state
            
        Returns:
            Dict containing hook response with hookSpecificOutput
        """
        hook_data = self.create_hook_specific_output(
            hook_event_name="SessionStart",
            session_initialized=success,
            claude_session_id=session_data.get("claude_session_id"),
            session_uuid=getattr(self, "session_uuid", None),
            project_path=session_data.get("project_path"),
            git_branch=session_data.get("git_branch"),
            git_commit=session_data.get("git_commit"),
            trigger_source=session_data.get("source")
        )
        
        # Add additional context if provided
        if additional_context:
            hook_data["additionalContext"] = additional_context
        
        return self.create_response(
            continue_execution=True,
            suppress_output=True,  # Don't clutter transcript with session init
            hook_specific_data=hook_data
        )
    
    def generate_session_context(self, session_data: Dict[str, Any], 
                                event_data: Dict[str, Any]) -> Optional[str]:
        """
        Generate contextual information for the session start.
        
        Args:
            session_data: Session initialization data
            event_data: Event data for this session start
            
        Returns:
            Context string or None if no context should be provided
        """
        context_parts = []
        
        # Git branch context
        git_branch = session_data.get("git_branch")
        if git_branch and git_branch != "main" and git_branch != "master":
            context_parts.append(f"You're working on branch '{git_branch}'")
        
        # Project type detection
        project_path = session_data.get("project_path", "")
        project_type = self._detect_project_type(project_path)
        if project_type:
            context_parts.append(f"Detected {project_type} project")
        
        # Session resumption context
        trigger_source = session_data.get("source")
        if trigger_source == "resume":
            context_parts.append("Resuming previous session")
        elif trigger_source == "clear":
            context_parts.append("Starting fresh session (context cleared)")
        
        if context_parts:
            return " | ".join(context_parts)
        
        return None
    
    def generate_git_status_context(self, session_data: Dict[str, Any], 
                                   event_data: Dict[str, Any]) -> Optional[str]:
        """
        Generate context about git repository status.
        
        Args:
            session_data: Session data
            event_data: Event data
            
        Returns:
            Git status context or None
        """
        # This would analyze the git info from project context
        git_info = event_data.get("data", {}).get("session_context", {}).get("git_info", {})
        
        if git_info.get("has_changes"):
            untracked = git_info.get("untracked_files", 0)
            modified = git_info.get("modified_files", 0)
            
            if untracked > 0 or modified > 0:
                parts = []
                if modified > 0:
                    parts.append(f"{modified} modified file{'s' if modified != 1 else ''}")
                if untracked > 0:
                    parts.append(f"{untracked} untracked file{'s' if untracked != 1 else ''}")
                
                return f"Working directory has uncommitted changes: {', '.join(parts)}"
        
        return None
    
    def generate_project_type_context(self, session_data: Dict[str, Any], 
                                     event_data: Dict[str, Any]) -> Optional[str]:
        """
        Generate project-specific context and recommendations.
        
        Args:
            session_data: Session data
            event_data: Event data
            
        Returns:
            Project-specific context or None
        """
        project_files = event_data.get("data", {}).get("session_context", {}).get("project_files", {})
        project_type = event_data.get("data", {}).get("session_context", {}).get("project_type")
        
        if project_type == "python":
            if project_files.get("requirements.txt"):
                return "Python project detected - remember to activate your virtual environment if needed"
            elif project_files.get("pyproject.toml"):
                return "Python project with pyproject.toml - consider using poetry or pip-tools for dependency management"
        
        elif project_type == "node":
            if project_files.get("package.json"):
                return "Node.js project detected - run 'npm install' if dependencies need updating"
        
        elif project_type == "rust":
            if project_files.get("Cargo.toml"):
                return "Rust project detected - use 'cargo build' or 'cargo run' for development"
        
        return None
    
    def _detect_project_type(self, project_path: str) -> Optional[str]:
        """
        Detect project type based on directory contents.
        
        Args:
            project_path: Path to the project directory
            
        Returns:
            Project type string or None
        """
        if not project_path or not os.path.isdir(project_path):
            return None
        
        try:
            files = os.listdir(project_path)
            file_set = set(files)
            
            # Python detection
            if any(f in file_set for f in ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"]):
                return "Python"
            
            # Node.js detection
            if "package.json" in file_set:
                return "Node.js"
            
            # Rust detection
            if "Cargo.toml" in file_set:
                return "Rust"
            
            # Go detection
            if "go.mod" in file_set:
                return "Go"
            
            # Java detection
            if "pom.xml" in file_set or "build.gradle" in file_set:
                return "Java"
            
            # PHP detection
            if "composer.json" in file_set:
                return "PHP"
            
            # Ruby detection
            if "Gemfile" in file_set:
                return "Ruby"
            
        except OSError:
            # Handle permission errors or other filesystem issues
            pass
        
        return None


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
        
        # Generate additional context
        additional_context = hook.generate_session_context(session_data, event_data)
        
        # Create response
        response = hook.create_session_start_response(success, session_data, event_data, additional_context)
        
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