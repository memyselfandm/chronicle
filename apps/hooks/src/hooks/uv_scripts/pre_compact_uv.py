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
Pre-Compact Hook for Claude Code Observability - UV Single-File Script

Captures conversation compaction events before context compression including:
- Conversation state before compaction
- Memory usage and token count metrics  
- Content analysis and preservation strategies
- Performance impact assessment
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
# Database Manager (Minimal)
# ===========================================

class DatabaseManager:
    """Minimal database manager for pre-compact events."""
    
    def __init__(self):
        self.sqlite_path = os.path.expanduser("~/.claude/hooks_data.db")
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
            pass
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save pre-compact event."""
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
# Pre-Compact Hook
# ===========================================

class PreCompactHook:
    """Hook for capturing pre-compaction conversation state."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "sessionId" in input_data:
            return input_data["sessionId"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process pre-compact hook input."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            
            # Extract compaction details
            conversation_length = input_data.get("conversationLength", 0)
            token_count = input_data.get("tokenCount", 0)
            memory_usage_mb = input_data.get("memoryUsageMb", 0)
            trigger_reason = input_data.get("triggerReason", "unknown")
            
            # Analyze conversation state
            analysis = {
                "conversation_length": conversation_length,
                "estimated_token_count": token_count,
                "memory_usage_mb": memory_usage_mb,
                "trigger_reason": trigger_reason,
                "compaction_needed": conversation_length > 100 or token_count > 100000,
                "preservation_strategy": self._determine_preservation_strategy(input_data)
            }
            
            # Create event data
            event_data = {
                "event_type": "pre_compaction",
                "hook_event_name": "PreCompact",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "conversation_state": analysis,
                    "pre_compaction_metrics": {
                        "length": conversation_length,
                        "tokens": token_count,
                        "memory_mb": memory_usage_mb
                    },
                    "raw_input": {k: v for k, v in input_data.items() if k not in ["content", "messages"]}  # Exclude large content
                }
            }
            
            # Save event
            event_saved = self.db_manager.save_event(event_data)
            
            # Create response
            return {
                "continue": True,
                "suppressOutput": True,  # Pre-compact events are internal
                "hookSpecificOutput": {
                    "hookEventName": "PreCompact",
                    "conversationLength": conversation_length,
                    "tokenCount": token_count,
                    "memoryUsageMb": memory_usage_mb,
                    "compactionNeeded": analysis["compaction_needed"],
                    "preservationStrategy": analysis["preservation_strategy"],
                    "eventSaved": event_saved
                }
            }
            
        except Exception as e:
            logger.debug(f"Pre-compact hook error: {e}")
            return {
                "continue": True,
                "suppressOutput": True,
                "hookSpecificOutput": {
                    "hookEventName": "PreCompact",
                    "error": "Processing failed",
                    "eventSaved": False
                }
            }
    
    def _determine_preservation_strategy(self, input_data: Dict[str, Any]) -> str:
        """Determine what preservation strategy should be used."""
        conversation_length = input_data.get("conversationLength", 0)
        token_count = input_data.get("tokenCount", 0)
        
        if token_count > 200000:
            return "aggressive_compression"
        elif conversation_length > 200:
            return "selective_preservation"
        elif "important" in str(input_data).lower():
            return "conservative_compression"
        else:
            return "standard_compression"

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for pre-compact hook."""
    try:
        # Read input
        input_text = sys.stdin.read().strip()
        input_data = json_impl.loads(input_text) if input_text else {}
        
        # Process hook
        start_time = time.perf_counter()
        hook = PreCompactHook()
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