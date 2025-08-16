#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "asyncpg>=0.28.0",
#     "python-dotenv>=1.0.0",
#     "typing-extensions>=4.7.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Post Tool Use Hook for Claude Code Observability - UV Single-File Script

Captures tool execution results after tool completion including:
- Tool name and execution duration
- Success/failure status and error messages  
- Result size and metadata
- MCP tool detection and server identification
- Timeout and partial result handling
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import (
    load_chronicle_env, sanitize_data, is_mcp_tool, extract_mcp_server_name,
    parse_tool_response, calculate_duration_ms
)

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("post_tool_use")


class PostToolUseHook(BaseHook):
    """Hook to capture tool execution results and performance metrics."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Any) -> Dict[str, Any]:
        """Process tool execution completion and capture metrics."""
        try:
            logger.debug("Starting process_hook")
            
            if input_data is None:
                logger.warning("No input data provided to process_hook")
                return self.create_response()
            
            # Process input data using base hook functionality
            logger.debug("Processing input data")
            processed_data = self.process_hook_data(input_data, "PostToolUse")
            
            # Extract tool execution details as per Claude Code spec
            raw_input = processed_data.get("raw_input", {})
            tool_name = raw_input.get("tool_name")
            tool_input = raw_input.get("tool_input", {})
            tool_response = raw_input.get("tool_response")
            execution_time = raw_input.get("execution_time")
            start_time = raw_input.get("start_time")
            end_time = raw_input.get("end_time")
            
            logger.info(f"Processing tool: {tool_name}")
            logger.debug(f"Tool input keys: {list(tool_input.keys()) if isinstance(tool_input, dict) else 'Not a dict'}")
            
            if not tool_name:
                logger.warning("No tool name found in input data")
                return self.create_response()
            
            # Parse tool response
            logger.debug("Parsing tool response")
            response_parsed = parse_tool_response(tool_response)
            logger.info(f"Tool success: {response_parsed['success']}, Result size: {response_parsed['result_size']} bytes")
            
            if response_parsed.get("error"):
                logger.warning(f"Tool error detected: {response_parsed['error']}")
            
            # Calculate execution duration
            duration_ms = calculate_duration_ms(start_time, end_time, execution_time)
            logger.info(f"Tool execution duration: {duration_ms}ms")
            
            # Detect MCP tool information
            is_mcp = is_mcp_tool(tool_name)
            mcp_server = extract_mcp_server_name(tool_name) if is_mcp else None
            if is_mcp:
                logger.info(f"MCP tool detected - Server: {mcp_server}")
            
            # Create tool usage event data using helper function
            tool_event_data = create_event_data(
                event_type="post_tool_use",
                hook_event_name="PostToolUse",
                data={
                    "tool_name": tool_name,
                    "duration_ms": duration_ms,
                    "success": response_parsed["success"],
                    "result_size": response_parsed["result_size"],
                    "error": response_parsed["error"],
                    "error_type": response_parsed["error_type"],
                    "is_mcp_tool": is_mcp,
                    "mcp_server": mcp_server,
                    "large_result": response_parsed["large_result"],
                    "tool_input_summary": self._summarize_tool_input(tool_input),
                }
            )
            
            # Include partial results for timeout scenarios
            if "partial_result" in response_parsed:
                tool_event_data["data"]["partial_result"] = response_parsed["partial_result"]
                tool_event_data["data"]["timeout_detected"] = True
            
            # Save the event
            logger.debug("Attempting to save tool event to database")
            save_success = self.save_event(tool_event_data)
            logger.info(f"Database save result: {'Success' if save_success else 'Failed'}")
            
            # Analyze for security concerns
            logger.debug("Analyzing tool security")
            security_decision, security_reason = self.analyze_tool_security(
                tool_name, tool_input, response_parsed
            )
            logger.info(f"Security decision: {security_decision} - {security_reason}")
            
            # Create response
            if security_decision == "allow":
                return self.create_response(
                    continue_execution=True,
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        tool_success=response_parsed["success"],
                        mcp_tool=is_mcp,
                        mcp_server=mcp_server,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision
                    )
                )
            else:
                # Block or ask for permission
                return self.create_response(
                    continue_execution=security_decision != "deny",
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        mcp_tool=is_mcp,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision,
                        permission_decision_reason=security_reason
                    )
                )
            
        except Exception as e:
            logger.error(f"Hook processing error: {e}", exc_info=True)
            
            return self.create_response(
                continue_execution=True,
                suppress_output=False,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PostToolUse",
                    error=str(e)[:100],
                    event_saved=False,
                    tool_success=False
                )
            )
    
    def _summarize_tool_input(self, tool_input: Any) -> Dict[str, Any]:
        """Create a summary of tool input for logging."""
        if not tool_input:
            return {"input_provided": False}
        
        summary = {"input_provided": True}
        
        if isinstance(tool_input, dict):
            summary["param_count"] = len(tool_input)
            summary["param_names"] = list(tool_input.keys())
            
            try:
                input_str = json_impl.dumps(tool_input)
                summary["input_size"] = len(input_str.encode('utf-8'))
            except:
                summary["input_size"] = 0
            
            # Check for operations
            if any(key in tool_input for key in ["file_path", "path"]):
                summary["involves_file_operations"] = True
            
            if any(key in tool_input for key in ["url", "endpoint"]):
                summary["involves_network"] = True
            
            if "command" in tool_input:
                summary["involves_command_execution"] = True
        
        return summary
    
    def analyze_tool_security(self, tool_name: str, tool_input: Any, 
                             tool_response: Dict[str, Any]) -> Tuple[str, str]:
        """Fast security analysis for tool execution."""
        # Safe tools (fast path)
        safe_tools = {
            "Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch", 
            "mcp__ide__getDiagnostics", "mcp__ide__executeCode"
        }
        
        if tool_name in safe_tools:
            return "allow", f"Safe operation: {tool_name}"
        
        # Quick security checks for common dangerous patterns
        if tool_name == "Bash":
            return self._analyze_bash_security(tool_input)
        
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            return self._analyze_file_security(tool_input)
        
        if tool_name.startswith("mcp__"):
            return "allow", f"MCP tool allowed: {tool_name}"
        
        # Default allow
        return "allow", f"Tool {tool_name} allowed"
    
    def _analyze_bash_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick bash security analysis."""
        if not isinstance(tool_input, dict) or "command" not in tool_input:
            return "allow", "No command to analyze"
        
        command = str(tool_input["command"]).lower()
        
        # Only check most dangerous patterns for performance
        dangerous_patterns = [
            "rm -rf /",
            "sudo rm -rf",
            "mkfs.",
            "dd if=/dev/zero",
            ":(){ :|:& };:"
        ]
        
        for pattern in dangerous_patterns:
            if pattern in command:
                return "deny", f"Dangerous command blocked: {pattern}"
        
        return "allow", "Command appears safe"
    
    def _analyze_file_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick file operation security analysis."""
        if not isinstance(tool_input, dict):
            return "allow", "No file path to analyze"
        
        file_path = str(tool_input.get("file_path", "")).lower()
        
        # Check for critical system paths
        critical_paths = ["/etc/passwd", "/etc/shadow", "c:\\windows\\system32"]
        
        for critical in critical_paths:
            if critical in file_path:
                return "deny", f"Critical system file access blocked: {file_path}"
        
        return "allow", "File operation appears safe"


def main():
    """Main entry point for the hook script."""
    try:
        logger.info("=" * 60)
        logger.info("POST TOOL USE HOOK STARTED")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            
            # Log tool-specific details as per Claude Code spec
            tool_name = input_data.get('tool_name')
            if tool_name:
                logger.info(f"Tool name: {tool_name}")
            
            tool_input = input_data.get('tool_input')
            if tool_input:
                tool_input_size = len(str(tool_input))
                logger.info(f"Tool input size: {tool_input_size} characters")
            
            tool_response = input_data.get('tool_response')
            if tool_response:
                tool_response_size = len(str(tool_response))
                logger.info(f"Tool response size: {tool_response_size} characters")
            
            execution_time = input_data.get('execution_time')
            if execution_time:
                logger.info(f"Execution time: {execution_time}ms")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Initialize and run the hook
        start_time = time.perf_counter()
        logger.info("Initializing PostToolUseHook...")
        
        hook = PostToolUseHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        else:
            logger.info(f"Hook execution time: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Hook execution failed: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)


if __name__ == "__main__":
    main()