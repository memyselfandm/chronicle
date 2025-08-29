#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
#     "supabase>=2.18.0",
#     "typing-extensions>=4.7.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Pre Tool Use Hook for Claude Code Observability - UV Single-File Script

Captures tool execution context before tool execution including:
- Tool name and input parameters
- Sensitive data sanitization for secure logging
- Tool use event tracking for observability

NOTE: This hook is purely observational and does not interfere with
Claude's native permission system.
"""

import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
logger = setup_hook_logging("pre_tool_use")

# ===========================================
# Utility Functions
# ===========================================

def check_sensitive_parameters(tool_input: Dict[str, Any]) -> List[str]:
    """Check for sensitive parameters in tool input."""
    sensitive_types = []
    
    if not isinstance(tool_input, dict):
        return sensitive_types
    
    sensitive_keys = {
        'password': 'password',
        'token': 'token', 
        'secret': 'secret',
        'key': 'api_key',
        'auth': 'auth',
        'credential': 'credential'
    }
    
    for param_name, param_value in tool_input.items():
        param_lower = param_name.lower()
        
        for sensitive_key, sensitive_type in sensitive_keys.items():
            if sensitive_key in param_lower:
                sensitive_types.append(sensitive_type)
                break
        
        # Check for URLs with credentials
        if isinstance(param_value, str):
            if any(protocol in param_value.lower() for protocol in ['http://', 'https://']):
                if any(indicator in param_value.lower() for indicator in ['token=', 'key=', 'secret=']):
                    sensitive_types.append('url_with_credentials')
    
    return list(set(sensitive_types))


class PreToolUseHook(BaseHook):
    """Hook for pre-tool execution observability (no permission interference)."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process pre-tool use hook - purely observational."""
        try:
            # Process input data using base hook functionality
            processed_data = self.process_hook_data(input_data, "PreToolUse")
            
            # Extract tool information as per Claude Code spec
            tool_name = input_data.get('tool_name', 'unknown')
            tool_input = input_data.get('tool_input', {})
            
            # Create event data for logging
            event_data = create_event_data(
                event_type="pre_tool_use",
                hook_event_name="PreToolUse",
                data={
                    "tool_name": tool_name,
                    "tool_input": self._sanitize_tool_input(tool_input),
                    "analysis": {
                        "input_size_bytes": len(str(tool_input)),
                        "parameter_count": len(tool_input) if isinstance(tool_input, dict) else 0,
                        "sensitive_params": check_sensitive_parameters(tool_input)
                    }
                }
            )
            
            # Save event
            logger.info(f"Attempting to save pre_tool_use event for tool: {tool_name}")
            logger.info(f"Event data event_type: {event_data.get('event_type')}")
            save_success = self.save_event(event_data)
            logger.info(f"Event save result: {save_success}")
            
            # Chronicle is purely observational - always continue execution
            return self.create_response(
                continue_execution=True,
                suppress_output=True,  # Don't show any output to avoid interference
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PreToolUse",
                    tool_name=tool_name,
                    event_saved=save_success
                )
            )
            
        except Exception as e:
            logger.debug(f"Hook processing error: {e}")
            
            # Even on error, don't block tool execution
            return self.create_response(
                continue_execution=True,
                suppress_output=True,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PreToolUse",
                    error=str(e)[:100],
                    tool_name=input_data.get('tool_name', 'unknown')
                )
            )

    def _sanitize_tool_input(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize tool input for logging."""
        if not isinstance(tool_input, dict):
            return {}
        
        # Remove sensitive values but keep structure
        sanitized = {}
        for key, value in tool_input.items():
            if any(sensitive in key.lower() for sensitive in ['password', 'token', 'secret', 'key']):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str) and len(value) > 200:
                sanitized[key] = f"{value[:100]}...[TRUNCATED]"
            else:
                sanitized[key] = value
        
        return sanitized
    


def main():
    """Main entry point for pre-tool use hook."""
    try:
        logger.debug("PRE TOOL USE HOOK STARTED")
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            
            # Log specific PreToolUse data as per Claude Code spec
            tool_name = input_data.get('tool_name', 'unknown')
            tool_input = input_data.get('tool_input', {})
            logger.info(f"Tool name: {tool_name}")
            logger.info(f"Tool input keys: {list(tool_input.keys()) if isinstance(tool_input, dict) else 'non-dict'}")
            
            # Log session ID extraction attempt
            session_id = input_data.get('session_id') or os.getenv('CLAUDE_SESSION_ID')
            logger.info(f"Session ID extracted: {'Yes' if session_id else 'No'}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing PreToolUseHook...")
        
        hook = PreToolUseHook()
        logger.info("Processing tool use event for observability...")
        result = hook.process_hook(input_data)
        
        # Log hook processing result
        hook_output = result.get('hookSpecificOutput', {})
        event_saved = hook_output.get('eventSaved', False)
        logger.info(f"Event saved: {event_saved}")
        logger.info(f"Hook processing result keys: {list(result.keys())}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError:
        # On error, allow execution to not break Claude
        safe_response = {
            "continue": True,
            "suppressOutput": True,
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "error": "Invalid JSON input - Chronicle logging skipped"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        # On error, allow execution to not break Claude
        safe_response = {
            "continue": True,
            "suppressOutput": True,
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "error": "Chronicle hook error - execution continues"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)


if __name__ == "__main__":
    main()