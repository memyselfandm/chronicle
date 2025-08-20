#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",  # optional, will gracefully fallback
#     "ujson>=5.8.0",
# ]
# ///
"""
Subagent Stop Hook for Claude Code Observability - UV Single-File Script

Captures subagent termination events and resource cleanup including:
- Subagent lifecycle tracking
- Resource usage summary
- Final state capture
- Performance metrics for subagent operations
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

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
logger = setup_hook_logging("subagent_stop", "INFO")

class SubagentStopHook(BaseHook):
    """Hook for capturing subagent termination events."""
    
    def __init__(self):
        super().__init__()
        self.hook_name = "SubagentStop"
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "session_id" in input_data:
            return input_data["session_id"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process subagent stop hook input."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            self.log_info(f"Session ID extraction: {self.claude_session_id}")
            
            # Extract subagent details
            subagent_id = input_data.get("subagentId", "unknown")
            subagent_type = input_data.get("subagentType", "generic")
            exit_reason = input_data.get("exitReason", "completed")
            duration_ms = input_data.get("durationMs", 0)
            memory_usage_mb = input_data.get("memoryUsageMb", 0)
            operations_count = input_data.get("operationsCount", 0)
            
            self.log_info(f"Processing subagent termination: {subagent_id} ({subagent_type})")
            self.log_info(f"Exit reason: {exit_reason}, Duration: {duration_ms}ms, Memory: {memory_usage_mb}MB, Operations: {operations_count}")
            
            # Analyze subagent lifecycle
            lifecycle_analysis = {
                "subagent_id": subagent_id,
                "subagent_type": subagent_type,
                "exit_reason": exit_reason,
                "duration_ms": duration_ms,
                "memory_usage_mb": memory_usage_mb,
                "operations_count": operations_count,
                "performance_rating": self._calculate_performance_rating(duration_ms, memory_usage_mb, operations_count),
                "resource_efficiency": memory_usage_mb / max(duration_ms / 1000, 0.001) if duration_ms > 0 else 0
            }
            
            # Create event data with corrected event_type
            event_data = {
                "event_type": "subagent_stop",  # Changed from "subagent_termination" as per requirements
                "hook_event_name": "SubagentStop",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "subagent_lifecycle": lifecycle_analysis,
                    "termination_metrics": {
                        "exit_reason": exit_reason,
                        "duration_ms": duration_ms,
                        "memory_peak_mb": memory_usage_mb,
                        "operations_completed": operations_count
                    },
                    "resource_cleanup": {
                        "memory_freed": memory_usage_mb > 0,
                        "operations_finalized": operations_count > 0,
                        "clean_shutdown": exit_reason in ["completed", "success", "normal"]
                    }
                }
            }
            
            # Save event
            self.log_info(f"Saving subagent termination event to database...")
            event_saved = self.save_event(event_data)
            self.log_info(f"Database save result: {event_saved}")
            
            # Create response as per Claude Code spec
            # SubagentStop hooks should not return hookSpecificOutput
            self.log_info(f"Subagent {subagent_id} ({subagent_type}) stopped - Reason: {exit_reason}")
            self.log_info(f"Subagent metrics - Duration: {duration_ms}ms, Memory: {memory_usage_mb}MB, Ops: {operations_count}")
            self.log_info(f"Performance rating: {lifecycle_analysis['performance_rating']}")
            
            return {
                "continue": True,
                "suppressOutput": True  # Subagent stops are internal
            }
            
        except Exception as e:
            self.log_error(f"Subagent stop hook error: {e}")
            self.log_debug(f"Error details: {str(e)}")
            return {
                "continue": True,
                "suppressOutput": True
            }
    
    def _calculate_performance_rating(self, duration_ms: int, memory_mb: float, operations: int) -> str:
        """Calculate performance rating for subagent execution."""
        # Simple heuristic for performance rating
        if duration_ms < 1000 and memory_mb < 50 and operations > 0:
            return "excellent"
        elif duration_ms < 5000 and memory_mb < 100:
            return "good"
        elif duration_ms < 15000 and memory_mb < 250:
            return "acceptable"
        else:
            return "needs_optimization"

def main():
    """Main entry point for subagent stop hook."""
    try:
        logger.debug("SUBAGENT STOP HOOK STARTED")
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
            
        # Log subagent termination details
        subagent_id = input_data.get("subagentId", "unknown")
        subagent_type = input_data.get("subagentType", "generic")
        exit_reason = input_data.get("exitReason", "completed")
        duration_ms = input_data.get("durationMs", 0)
        logger.info(f"Subagent termination - ID: {subagent_id}, Type: {subagent_type}, Exit: {exit_reason}, Duration: {duration_ms}ms")
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing SubagentStopHook...")
        
        hook = SubagentStopHook()
        logger.info("Processing subagent stop hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        logger.debug(f"Subagent stop hook completed in {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON input received")
        # Safe response for invalid JSON
        safe_response = {
            "continue": True,
            "suppressOutput": True,
            "hookSpecificOutput": {
                "hookEventName": "SubagentStop",
                "error": "Invalid JSON input",
                "eventSaved": False
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        # Safe default response
        safe_response = {
            "continue": True,
            "suppressOutput": True,
            "hookSpecificOutput": {
                "hookEventName": "SubagentStop",
                "error": "Hook processing failed",
                "eventSaved": False
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)

if __name__ == "__main__":
    main()