#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "psutil>=5.9.0",
#     "requests>=2.25.0",
# ]
# ///
"""
Claude Code Session Start Hook - UV Single-File Script

This hook captures session initialization events and tracks project context.
Implements session lifecycle tracking as specified in H3.3.

Features:
- Extract project context (working directory, git branch if available)
- Generate or retrieve session ID from Claude Code environment
- Create session record in database with start_time
- Store as event_type='session_start' with data containing: {project_path, git_branch, git_commit}

Usage:
    uv run session_start.py

Exit Codes:
    0: Success, continue execution
    2: Blocking error, show stderr to Claude
    Other: Non-blocking error, show stderr to user
"""

import json
import os
import sys
import time
import subprocess
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Optional

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import (
    load_chronicle_env,
    sanitize_data,
    get_project_path,
    extract_session_id,
)
from lib.server_manager import start_chronicle_server_if_needed

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("session_start")

@contextmanager

def measure_performance(operation_name):
    """Simple performance measurement context manager."""
    start_time = time.perf_counter()
    metrics = {}
    yield metrics
    end_time = time.perf_counter()
    metrics['duration_ms'] = (end_time - start_time) * 1000

def get_git_info(cwd: Optional[str] = None) -> Dict[str, Any]:
    """Safely extract git branch and commit information."""
    git_info = {
        "branch": None,
        "commit_hash": None,
        "is_git_repo": False,
        "has_changes": False,
        "untracked_files": 0,
        "modified_files": 0
    }

    work_dir = cwd or os.getcwd()

    try:
        # Check if git repo
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=2
        )

        if result.returncode == 0:
            git_info["is_git_repo"] = True

            # Get branch name
            branch_result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if branch_result.returncode == 0 and branch_result.stdout.strip():
                git_info["branch"] = branch_result.stdout.strip()

            # Get commit hash
            commit_result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if commit_result.returncode == 0 and commit_result.stdout.strip():
                git_info["commit_hash"] = commit_result.stdout.strip()[:12]  # Short hash

            # Check for changes
            status_result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=2
            )
            if status_result.returncode == 0:
                status_lines = status_result.stdout.strip().split('\n')
                git_info["has_changes"] = bool(status_lines[0]) if status_lines else False

                # Count untracked and modified files
                for line in status_lines:
                    if line.startswith('??'):
                        git_info["untracked_files"] += 1
                    elif line.startswith(('M ', ' M', 'A ', ' A')):
                        git_info["modified_files"] += 1

    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        logger.debug("Git command failed or timed out")
    except Exception as e:
        logger.debug(f"Error getting git info: {e}")

    return git_info

def resolve_project_path(fallback_path: Optional[str] = None) -> str:
    """Get the project root path using CLAUDE_PROJECT_DIR or fallback."""
    claude_project_dir = os.getenv("CLAUDE_PROJECT_DIR")

    if claude_project_dir:
        expanded = os.path.expanduser(claude_project_dir)
        if os.path.isdir(expanded):
            return os.path.abspath(expanded)
        else:
            logger.warning(
                f"CLAUDE_PROJECT_DIR points to non-existent directory: {claude_project_dir}")

    if fallback_path and os.path.isdir(fallback_path):
        return os.path.abspath(fallback_path)

    return os.getcwd()

def get_project_context_with_env_support(cwd: Optional[str] = None) -> Dict[str, Any]:
    """Capture project information with environment variable support."""
    resolved_cwd = resolve_project_path(cwd)

    context = {
        "cwd": resolved_cwd,
        "claude_project_dir": os.getenv("CLAUDE_PROJECT_DIR"),
        "resolved_from_env": bool(os.getenv("CLAUDE_PROJECT_DIR")),
        "git_info": get_git_info(resolved_cwd),
        "session_context": {
            "session_id": os.getenv("CLAUDE_SESSION_ID"),
            "transcript_path": os.getenv("CLAUDE_TRANSCRIPT_PATH"),
            "user": os.getenv("USER", "unknown"),
        }
    }

    # Add project type detection
    try:
        files = os.listdir(resolved_cwd)
        file_set = set(files)

        project_files = {}
        project_type = None

        # Detect project type
        if any(f in file_set for f in ["requirements.txt",
            "setup.py", "pyproject.toml", "Pipfile"]):
            project_type = "python"
            for f in ["requirements.txt",
                "setup.py", "pyproject.toml", "Pipfile"]:
                if f in file_set:
                    project_files[f] = True
        elif "package.json" in file_set:
            project_type = "node"
            project_files["package.json"] = True
        elif "Cargo.toml" in file_set:
            project_type = "rust"
            project_files["Cargo.toml"] = True
        elif "go.mod" in file_set:
            project_type = "go"
            project_files["go.mod"] = True

        context["session_context"]["project_type"] = project_type
        context["session_context"]["project_files"] = project_files

    except OSError:
        logger.debug("Could not read project directory for type detection")

    return context

class SessionStartHook(BaseHook):
    """Hook for processing Claude Code session start events."""

    def __init__(self, config=None):
        super().__init__(config)
        self.hook_name = "SessionStart"

    def process_session_start(self, input_data):
        """Process session start hook data with performance optimization."""
        try:
            with measure_performance("session_start.data_processing") as metrics:
                processed_data = self.process_hook_data(input_data, "SessionStart")

                if processed_data.get("error"):
                    return (False, {}, {"error": processed_data.get("error",
                        "Processing failed")})

            # Get project context
            with measure_performance("session_start.project_context") as metrics:
                cwd = processed_data.get("cwd")
                project_context = get_project_context_with_env_support(cwd)

            # Extract session start specific data
            trigger_source = input_data.get("source", "unknown")

            # Prepare session data
            session_data = {
                "claude_session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "source": trigger_source,
                "project_path": project_context.get("cwd"),
                "git_branch": project_context.get("git_info",
                    {}).get("branch"),
                "git_commit": project_context.get("git_info",
                    {}).get("commit_hash"),
            }

            # Prepare event data
            event_data = {
                "event_type": "session_start",
                "hook_event_name": processed_data.get("hook_event_name",
                    "SessionStart"),
                "data": {
                    "project_path": project_context.get("cwd"),
                    "git_branch": project_context.get("git_info",
                        {}).get("branch"),
                    "git_commit": project_context.get("git_info",
                        {}).get("commit_hash"),
                    "trigger_source": trigger_source,
                    "session_context": project_context.get("session_context",
                        {}),
                }
            }

            # Save session and event
            with measure_performance("session_start.database_operations"):
                # Use the new save_session method from BaseHook which auto-creates sessions
                session_success = True
                if self.claude_session_id:
                    event_success = self.save_event(event_data)
                else:
                    logger.warning("Cannot save event: no session ID")
                    event_success = False

            return (session_success and event_success, session_data, event_data)

        except Exception as e:
            logger.error(f"Exception in process_session_start: {e}")
            return (False, {}, {})

    def create_session_start_response(self, success, session_data, event_data,
                                      additional_context: Optional[str] = None):
        """Create hook response for session start."""
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

        if additional_context:
            hook_data["additionalContext"] = additional_context

        return self.create_response(
            continue_execution=True,
            suppress_output=True,
            hook_specific_data=hook_data
        )

    def generate_session_context(self, session_data: Dict[str, Any],
                                event_data: Dict[str, Any]) -> Optional[str]:
        """Generate contextual information for the session start."""
        context_parts = []

        # Git branch context
        git_branch = session_data.get("git_branch")
        if git_branch and git_branch not in ["main", "master"]:
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

        return " | ".join(context_parts) if context_parts else None

    def _detect_project_type(self, project_path: str) -> Optional[str]:
        """Detect project type based on directory contents."""
        if not project_path or not os.path.isdir(project_path):
            return None

        try:
            files = os.listdir(project_path)
            file_set = set(files)

            if any(f in file_set for f in ["requirements.txt",
                "setup.py", "pyproject.toml", "Pipfile"]):
                return "Python"
            elif "package.json" in file_set:
                return "Node.js"
            elif "Cargo.toml" in file_set:
                return "Rust"
            elif "go.mod" in file_set:
                return "Go"
            elif "pom.xml" in file_set or "build.gradle" in file_set:
                return "Java"
            elif "composer.json" in file_set:
                return "PHP"
            elif "Gemfile" in file_set:
                return "Ruby"

        except OSError:
            pass

        return None

def main():
    """Main entry point for session start hook."""
    try:
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}

        # Initialize hook
        hook = SessionStartHook()

        # Process session start
        start_time = time.perf_counter()

        success, session_data, event_data = hook.process_session_start(input_data)
        additional_context = hook.generate_session_context(session_data, event_data)
        response = hook.create_session_start_response(success, session_data, event_data, additional_context)

        # Auto-start Chronicle server (non-blocking) - CHR-41 implementation
        if success and hook.claude_session_id:
            try:
                # This is non-blocking and will fail gracefully without impacting Claude Code
                start_chronicle_server_if_needed(hook.claude_session_id)
            except Exception as e:
                # Never let server startup issues affect Claude Code
                logger.debug(f"Server auto-start failed gracefully: {e}")

        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        response["execution_time_ms"] = execution_time

        # Log performance
        if execution_time > 100:
            logger.warning(
                f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        else:
            logger.debug(f"Hook completed in {execution_time:.2f}ms")

        # Output response
        print(json_impl.dumps(response, indent=2))
        sys.exit(0)

    except json.JSONDecodeError:
        # Invalid JSON input
        minimal_response = {
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "error": "Invalid JSON input",
                "sessionInitialized": False
            }
        }
        print(json_impl.dumps(minimal_response))
        sys.exit(0)

    except Exception as e:
        logger.error(f"Critical error in session start hook: {e}")
        # Output minimal response
        try:
            minimal_response = {"continue": True, "suppressOutput": True}
            print(json_impl.dumps(minimal_response))
        except Exception:
            print("{}")
        sys.exit(0)

if __name__ == "__main__":
    main()
