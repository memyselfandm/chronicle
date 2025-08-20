#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Claude Code Hook: Session End Tracking (stop.py) - UV Single-File Script

This hook is triggered when Claude Code main agent execution completes.
It captures session end data, calculates duration, and stores final metrics.

Features:
- Updates existing session record with end_time
- Calculates total session duration from start to end
- Counts total events that occurred during session
- Stores stop event with comprehensive metrics
"""

import json
import os
import sys
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env, extract_session_id, format_error_message

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("stop", "INFO")

class StopHook(BaseHook):
    """Hook for tracking session end and calculating final session metrics."""
    
    def __init__(self):
        super().__init__()
        self.hook_name = "Stop"
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "session_id" in input_data:
            return input_data["session_id"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process session stop hook."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            self.log_info(f"Attempting to terminate session: {self.claude_session_id}")
            
            if not self.claude_session_id:
                self.log_warning("No Claude session ID found for termination")
                return self._create_response(
                    session_found=False,
                    error="No session ID available"
                )
            
            # Find existing session
            self.log_info(f"Looking up session in database: {self.claude_session_id}")
            session = self.db_manager.get_session(self.claude_session_id)
            
            if not session:
                self.log_warning(f"Session not found in database: {self.claude_session_id}")
                # Create a session for proper termination tracking
                self.log_info("Creating session record for termination tracking")
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": input_data.get("timestamp", datetime.now().isoformat()),
                    "project_path": input_data.get("cwd", "unknown"),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success:
                    session = {"id": session_uuid}
                    self.log_info(f"Created session with UUID: {session_uuid}")
                else:
                    self.log_error("Failed to create session for termination")
                    return self._create_response(
                        session_found=False,
                        error="Could not create session for termination"
                    )
            
            session_id = session["id"]
            self.log_info(f"Found session record with ID: {session_id}")
            
            # Count events in this session
            event_count = self._count_session_events(session_id)
            self.log_info(f"Total events in session: {event_count}")
            
            # Update session with end time and metrics
            end_time = datetime.now().isoformat()
            self.log_info(f"Setting session end time: {end_time}")
            session_updated = self._update_session_end(session_id, end_time, event_count)
            self.log_info(f"Session update result: {session_updated}")
            
            # Calculate session metrics
            duration_minutes = None
            if session["start_time"]:
                try:
                    start_time = datetime.fromisoformat(session["start_time"].replace('Z', '+00:00'))
                    end_time_dt = datetime.fromisoformat(end_time)
                    duration_minutes = (end_time_dt - start_time).total_seconds() / 60
                    self.log_info(f"Session duration calculated: {duration_minutes:.2f} minutes")
                except Exception as e:
                    self.log_warning(f"Could not calculate session duration: {e}")
            
            # Create session end event with corrected event_type
            event_data = {
                "event_type": "stop",  # Changed from "session_end" as per requirements
                "hook_event_name": "Stop",
                "session_id": session_id,
                "timestamp": end_time,
                "data": {
                    "session_duration_minutes": duration_minutes,
                    "total_events": event_count,
                    "end_reason": input_data.get("reason", "normal_completion"),
                    "final_metrics": {
                        "start_time": session["start_time"],
                        "end_time": end_time,
                        "event_count": event_count
                    }
                }
            }
            
            # Save session end event
            self.log_info("Saving session end event to database...")
            event_saved = self.save_event(event_data)
            self.log_info(f"Session end event saved: {event_saved}")
            
            return self._create_response(
                session_found=True,
                session_updated=session_updated,
                event_saved=event_saved,
                duration_minutes=duration_minutes,
                event_count=event_count
            )
            
        except Exception as e:
            self.log_error(f"Stop hook error: {e}")
            return self._create_response(
                session_found=False,
                error="Processing failed"
            )
    
    def _count_session_events(self, session_id: str) -> int:
        """Count total events for a session."""
        try:
            # Try Supabase first
            if self.db_manager.supabase_client:
                try:
                    result = self.db_manager.supabase_client.table(self.db_manager.EVENTS_TABLE).select("id", count="exact").eq("session_id", session_id).execute()
                    return result.count or 0
                except Exception:
                    pass
            
            # SQLite fallback
            import sqlite3
            with sqlite3.connect(str(self.db_manager.sqlite_path), timeout=self.db_manager.timeout) as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM events WHERE session_id = ?",
                    (session_id,)
                )
                row = cursor.fetchone()
                return row[0] if row else 0
            
        except Exception:
            return 0
    
    def _update_session_end(self, session_id: str, end_time: str, event_count: int) -> bool:
        """Update session with end time and metrics."""
        try:
            # Try Supabase first
            if self.db_manager.supabase_client:
                try:
                    update_data = {
                        "end_time": end_time,
                        "updated_at": datetime.now().isoformat()
                    }
                    
                    self.db_manager.supabase_client.table(self.db_manager.SESSIONS_TABLE).update(update_data).eq("id", session_id).execute()
                    return True
                    
                except Exception:
                    pass
            
            # SQLite fallback
            import sqlite3
            with sqlite3.connect(str(self.db_manager.sqlite_path), timeout=self.db_manager.timeout) as conn:
                conn.execute('''
                    UPDATE sessions 
                    SET end_time = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (end_time, session_id))
                conn.commit()
                return conn.total_changes > 0
            
        except Exception:
            return False
    
    def _create_response(self, session_found: bool = False,
                        session_updated: bool = False,
                        event_saved: bool = False,
                        duration_minutes: Optional[float] = None,
                        event_count: int = 0,
                        error: Optional[str] = None) -> Dict[str, Any]:
        """Create stop hook response as per Claude Code spec."""
        
        # Stop hooks should not return hookSpecificOutput
        # They only support decision and reason fields
        response = {
            "continue": True,
            "suppressOutput": True  # Session end is internal
        }
        
        # Log the internal metrics for debugging
        self.log_info(f"Session termination - Found: {session_found}, Updated: {session_updated}, Events: {event_count}")
        if duration_minutes is not None:
            self.log_info(f"Session duration: {round(duration_minutes, 2)} minutes")
        if error:
            self.log_error(f"Stop hook error: {error}")
        
        return response

def main():
    """Main entry point for stop hook."""
    try:
        logger.debug("STOP HOOK STARTED - SESSION TERMINATION")
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing StopHook for session termination...")
        
        hook = StopHook()
        logger.info("Processing session stop...")
        result = hook.process_hook(input_data)
        logger.info(f"Session stop processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance and session metrics
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        logger.debug("STOP HOOK COMPLETED - SESSION TERMINATED")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Critical error in stop hook: {e}")
        logger.debug(f"Critical error details: {e}", exc_info=True)
        print(json_impl.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)

if __name__ == "__main__":
    main()