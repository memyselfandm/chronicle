#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
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
- Stores session_end event with comprehensive metrics
"""

import json
import sys
import time
import logging
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================================
# Database Manager
# ===========================================

class DatabaseManager:
    """Database manager for stop hook."""
    
    def __init__(self):
        self.sqlite_path = os.path.expanduser("~/.claude/hooks_data.db")
        self._ensure_tables()
    
    def _ensure_tables(self):
        """Ensure SQLite tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        claude_session_id TEXT UNIQUE,
                        start_time TIMESTAMP,
                        end_time TIMESTAMP,
                        duration_minutes REAL,
                        event_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        event_type TEXT,
                        hook_event_name TEXT,
                        timestamp TIMESTAMP,
                        data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                conn.commit()
        except Exception:
            pass
    
    def find_session(self, claude_session_id: str) -> Optional[Dict[str, Any]]:
        """Find session by Claude session ID."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM sessions WHERE claude_session_id = ?", 
                    (claude_session_id,)
                )
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception:
            return None
    
    def count_session_events(self, session_id: str) -> int:
        """Count events for a session."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT COUNT(*) FROM events WHERE session_id = ?", 
                    (session_id,)
                )
                return cursor.fetchone()[0]
        except Exception:
            return 0
    
    def update_session_end(self, session_id: str, end_time: str, event_count: int) -> bool:
        """Update session with end time and final metrics."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                # Calculate duration if we have start_time
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT start_time FROM sessions WHERE id = ?", 
                    (session_id,)
                )
                row = cursor.fetchone()
                
                duration_minutes = None
                if row and row[0]:
                    try:
                        start_time = datetime.fromisoformat(row[0].replace('Z', '+00:00'))
                        end_time_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                        duration_minutes = (end_time_dt - start_time).total_seconds() / 60
                    except Exception:
                        pass
                
                # Update session
                conn.execute('''
                    UPDATE sessions 
                    SET end_time = ?, duration_minutes = ?, event_count = ?
                    WHERE id = ?
                ''', (end_time, duration_minutes, event_count, session_id))
                conn.commit()
                return True
        except Exception:
            return False
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save session end event."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, hook_event_name, timestamp, data)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    event_data.get("event_id", str(uuid.uuid4())),
                    event_data.get("session_id"),
                    event_data.get("event_type"),
                    event_data.get("hook_event_name"),
                    event_data.get("timestamp"),
                    json_impl.dumps(event_data.get("data", {}))
                ))
                conn.commit()
            return True
        except Exception:
            return False

# ===========================================
# Stop Hook
# ===========================================

class StopHook:
    """Hook for tracking session end and calculating final session metrics."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "sessionId" in input_data:
            return input_data["sessionId"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process session stop hook."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            
            if not self.claude_session_id:
                return self._create_response(
                    session_found=False,
                    error="No session ID available"
                )
            
            # Find existing session
            session = self.db_manager.find_session(self.claude_session_id)
            
            if not session:
                return self._create_response(
                    session_found=False,
                    error="Session not found in database"
                )
            
            session_id = session["id"]
            
            # Count events in this session
            event_count = self.db_manager.count_session_events(session_id)
            
            # Update session with end time and metrics
            end_time = datetime.now().isoformat()
            session_updated = self.db_manager.update_session_end(
                session_id, end_time, event_count
            )
            
            # Calculate session metrics
            duration_minutes = None
            if session["start_time"]:
                try:
                    start_time = datetime.fromisoformat(session["start_time"].replace('Z', '+00:00'))
                    end_time_dt = datetime.fromisoformat(end_time)
                    duration_minutes = (end_time_dt - start_time).total_seconds() / 60
                except Exception:
                    pass
            
            # Create session end event
            event_data = {
                "event_type": "session_end",
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
            event_saved = self.db_manager.save_event(event_data)
            
            return self._create_response(
                session_found=True,
                session_updated=session_updated,
                event_saved=event_saved,
                duration_minutes=duration_minutes,
                event_count=event_count
            )
            
        except Exception as e:
            logger.debug(f"Stop hook error: {e}")
            return self._create_response(
                session_found=False,
                error="Processing failed"
            )
    
    def _create_response(self, session_found: bool = False,
                        session_updated: bool = False,
                        event_saved: bool = False,
                        duration_minutes: Optional[float] = None,
                        event_count: int = 0,
                        error: Optional[str] = None) -> Dict[str, Any]:
        """Create stop hook response."""
        
        hook_output = {
            "hookEventName": "Stop",
            "sessionFound": session_found,
            "sessionUpdated": session_updated,
            "eventSaved": event_saved,
            "eventCount": event_count
        }
        
        if duration_minutes is not None:
            hook_output["sessionDurationMinutes"] = round(duration_minutes, 2)
        
        if error:
            hook_output["error"] = error
        
        return {
            "continue": True,
            "suppressOutput": True,  # Session end is internal
            "hookSpecificOutput": hook_output
        }

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for stop hook."""
    try:
        # Read input
        input_text = sys.stdin.read().strip()
        input_data = json_impl.loads(input_text) if input_text else {}
        
        # Process hook
        start_time = time.perf_counter()
        hook = StopHook()
        result = hook.process_hook(input_data)
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)

if __name__ == "__main__":
    main()