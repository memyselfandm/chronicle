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
logger = setup_hook_logging("pre_compact", "INFO")

class PreCompactHook(BaseHook):
    """Hook for capturing pre-compaction conversation state."""
    
    def __init__(self):
        super().__init__()
        self.hook_name = "PreCompact"
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "session_id" in input_data:
            return input_data["session_id"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process pre-compact hook input."""
        try:
            self.log_info("Processing pre-compact hook...")
            self.log_debug(f"Input data keys: {list(input_data.keys())}")
            
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            self.log_info(f"Claude session ID: {self.claude_session_id}")
            
            # Extract compaction details
            conversation_length = input_data.get("conversationLength", 0)
            token_count = input_data.get("tokenCount", 0)
            memory_usage_mb = input_data.get("memoryUsageMb", 0)
            trigger_reason = input_data.get("triggerReason", "unknown")
            
            self.log_info(f"Compact details - Length: {conversation_length}, Tokens: {token_count}, Memory: {memory_usage_mb}MB")
            self.log_info(f"Compact trigger: {trigger_reason} ({'manual' if 'manual' in trigger_reason.lower() else 'automatic'})")
            
            # Analyze conversation state
            analysis = {
                "conversation_length": conversation_length,
                "estimated_token_count": token_count,
                "memory_usage_mb": memory_usage_mb,
                "trigger_reason": trigger_reason,
                "compaction_needed": conversation_length > 100 or token_count > 100000,
                "preservation_strategy": self._determine_preservation_strategy(input_data)
            }
            
            # Create event data with corrected event_type
            event_data = {
                "event_type": "pre_compact",  # Changed from "pre_compaction" as per requirements
                "hook_event_name": "PreCompact",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "conversation_state": analysis,
                    "pre_compact_metrics": {  # Changed from "pre_compaction_metrics"
                        "length": conversation_length,
                        "tokens": token_count,
                        "memory_mb": memory_usage_mb
                    },
                    "raw_input": {k: v for k, v in input_data.items() if k not in ["content", "messages"]}  # Exclude large content
                }
            }
            
            # Save event
            self.log_info("Saving pre-compaction event to database...")
            event_saved = self.save_event(event_data)
            self.log_info(f"Event saved successfully: {event_saved}")
            
            # Create response
            return {
                "continue": True,
                "suppressOutput": True,  # Pre-compact events are internal
            }
            
        except Exception as e:
            self.log_debug(f"Pre-compact hook error: {e}")
            return {
                "continue": True,
                "suppressOutput": True,
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

def main():
    """Main entry point for pre-compact hook."""
    try:
        logger.debug("PRE-COMPACT HOOK STARTED")
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing PreCompactHook...")
        
        hook = PreCompactHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        logger.info(f"Hook execution completed in {execution_time:.2f}ms")
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)

if __name__ == "__main__":
    main()