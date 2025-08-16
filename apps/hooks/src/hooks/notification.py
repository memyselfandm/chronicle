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
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules  
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("notification")


# ===========================================
# Notification Hook
# ===========================================

class NotificationHook(BaseHook):
    """Hook for capturing Claude Code notifications."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process notification hook input."""
        try:
            logger.debug("Starting notification hook processing")
            
            # Process input data using base hook functionality
            processed_data = self.process_hook_data(input_data, "Notification")
            
            # Extract notification details
            notification_type = input_data.get("type", "unknown")
            message = input_data.get("message", "")
            severity = input_data.get("severity", "info")
            source = input_data.get("source", "system")
            
            logger.info(f"Notification details - Type: {notification_type}, Severity: {severity}, Source: {source}")
            logger.debug(f"Notification message: {message[:500]}{'...' if len(message) > 500 else ''}")
            
            # Create event data using helper function
            event_data = create_event_data(
                event_type="notification",
                hook_event_name="Notification",
                data={
                    "notification_type": notification_type,
                    "message": message[:1000],  # Truncate long messages
                    "severity": severity,
                    "source": source,
                    "raw_input": processed_data.get("raw_input")
                }
            )
            
            # Save event
            logger.info("Attempting to save notification event to database...")
            event_saved = self.save_event(event_data)
            logger.info(f"Database save result: {event_saved}")
            
            # Create response with output suppression for low-level notifications
            suppress_output = severity in ["debug", "trace"]
            logger.debug(f"Output suppression: {suppress_output} (severity: {severity})")
            
            return self.create_response(
                continue_execution=True,
                suppress_output=suppress_output,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="Notification",
                    notification_type=notification_type,
                    severity=severity,
                    event_saved=event_saved
                )
            )
            
        except Exception as e:
            logger.error(f"Notification hook processing error: {e}", exc_info=True)
            return self.create_response(continue_execution=True, suppress_output=False)

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for notification hook."""
    try:
        logger.info("=" * 60)
        logger.info("NOTIFICATION HOOK STARTED")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing NotificationHook...")
        
        hook = NotificationHook()
        logger.info("Processing notification hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Notification hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        else:
            logger.info(f"Hook completed in {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        logger.info("Notification hook completed successfully")
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        safe_response = {
            "continue": True,
            "suppressOutput": False
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Critical error in notification hook: {e}", exc_info=True)
        safe_response = {
            "continue": True,
            "suppressOutput": True
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)

if __name__ == "__main__":
    main()