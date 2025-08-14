#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
#     "ujson>=5.8.0",
#     "supabase>=2.0.0",
# ]
# ///
"""
Notification Hook for Claude Code Observability - UV Single-File Script

Captures system notifications and alerts from Claude Code including:
- Error notifications and warnings
- System status messages
- User interface notifications
- Performance alerts and resource usage warnings
"""

import json
import logging
import os
import sys
import time
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

# Load environment variables with chronicle-aware loading
try:
    from env_loader import load_chronicle_env
    from database_manager import DatabaseManager
    load_chronicle_env()
except ImportError:
    # Fallback to standard dotenv
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

# If DatabaseManager wasn't imported above, define a minimal version
try:
    DatabaseManager
except NameError:
    # Minimal database manager for standalone operation
    class DatabaseManager:
        """Minimal database manager for notifications."""
        
        def __init__(self):
            self.sqlite_path = os.path.expanduser("~/.claude/hooks/chronicle/data/chronicle.db")
            self._ensure_tables()
        
        def _ensure_tables(self):
            """Ensure SQLite tables exist."""
            try:
                os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
                with sqlite3.connect(self.sqlite_path) as conn:
                    conn.execute('''
                        CREATE TABLE IF NOT EXISTS sessions (
                            id TEXT PRIMARY KEY,
                            claude_session_id TEXT UNIQUE,
                            start_time TIMESTAMP,
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
                pass  # Fail silently for notifications
        
        def save_event(self, event_data: Dict[str, Any]) -> bool:
            """Save notification event."""
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
# Notification Hook
# ===========================================

class NotificationHook:
    """Hook for capturing Claude Code notifications."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "sessionId" in input_data:
            return input_data["sessionId"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process notification hook input."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            
            # Extract notification details
            notification_type = input_data.get("type", "unknown")
            message = input_data.get("message", "")
            severity = input_data.get("severity", "info")
            source = input_data.get("source", "system")
            
            # Create event data
            event_data = {
                "event_type": "notification",
                "hook_event_name": "Notification",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "notification_type": notification_type,
                    "message": message[:1000],  # Truncate long messages
                    "severity": severity,
                    "source": source,
                    "raw_input": input_data
                }
            }
            
            # Save event (non-critical for notifications)
            event_saved = self.db_manager.save_event(event_data)
            
            # Create response
            return {
                "continue": True,
                "suppressOutput": severity in ["debug", "trace"],  # Hide low-level notifications
                "hookSpecificOutput": {
                    "hookEventName": "Notification",
                    "notificationType": notification_type,
                    "severity": severity,
                    "eventSaved": event_saved
                }
            }
            
        except Exception as e:
            logger.debug(f"Notification hook error: {e}")
            return {
                "continue": True,
                "suppressOutput": False,
                "hookSpecificOutput": {
                    "hookEventName": "Notification",
                    "error": "Processing failed",
                    "eventSaved": False
                }
            }

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for notification hook."""
    try:
        # Read input
        input_text = sys.stdin.read().strip()
        input_data = json_impl.loads(input_text) if input_text else {}
        
        # Process hook
        start_time = time.perf_counter()
        hook = NotificationHook()
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