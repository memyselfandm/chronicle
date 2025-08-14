#!/usr/bin/env python3
"""
Post Tool Use Hook for Claude Code Observability

Captures tool execution results after tool completion including:
- Tool name and execution duration
- Success/failure status and error messages  
- Result size and metadata
- MCP tool detection and server identification
- Timeout and partial result handling

This hook implements the H3.2 requirement from the hooks PRD.
"""

import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from typing import Any, Dict, Optional

# Add the core directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

from base_hook import BaseHook

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MCP tool detection patterns
MCP_TOOL_PATTERN = re.compile(r'^mcp__(.+?)__(.+)$')
LARGE_RESULT_THRESHOLD = 100000  # 100KB threshold for large results


def is_mcp_tool(tool_name: str) -> bool:
    """
    Determine if a tool is an MCP tool based on naming pattern.
    
    Args:
        tool_name: Name of the tool to check
        
    Returns:
        True if tool follows MCP naming pattern (mcp__server__tool), False otherwise
    """
    if not tool_name or not isinstance(tool_name, str):
        return False
    
    return bool(MCP_TOOL_PATTERN.match(tool_name))


def extract_mcp_server_name(tool_name: str) -> Optional[str]:
    """
    Extract MCP server name from tool name.
    
    Args:
        tool_name: Name of the MCP tool
        
    Returns:
        Server name if tool is MCP tool, None otherwise
    """
    if not tool_name or not isinstance(tool_name, str):
        return None
    
    match = MCP_TOOL_PATTERN.match(tool_name)
    if match:
        return match.group(1)
    
    return None


def parse_tool_response(response_data: Any) -> Dict[str, Any]:
    """
    Parse tool response data and extract key metrics.
    
    Args:
        response_data: Raw tool response data
        
    Returns:
        Dictionary with parsed response metrics
    """
    if response_data is None:
        return {
            "success": False,
            "error": "No response data",
            "result_size": 0,
            "large_result": False
        }
    
    # Convert to string for size calculation
    try:
        response_str = json.dumps(response_data) if not isinstance(response_data, str) else response_data
        result_size = len(response_str.encode('utf-8'))
    except (TypeError, UnicodeEncodeError):
        result_size = 0
    
    # Extract success/failure status
    success = True
    error = None
    error_type = None
    
    if isinstance(response_data, dict):
        # Check status field
        status = response_data.get("status", "success")
        if status in ["error", "timeout", "failed"]:
            success = False
        
        # Extract error information
        if "error" in response_data:
            success = False
            error = response_data["error"]
        
        if "error_type" in response_data:
            error_type = response_data["error_type"]
        
        # Handle specific error patterns
        if error and "timeout" in str(error).lower():
            error_type = "timeout"
    
    parsed = {
        "success": success,
        "error": error,
        "error_type": error_type,
        "result_size": result_size,
        "large_result": result_size > LARGE_RESULT_THRESHOLD,
        "metadata": response_data if isinstance(response_data, dict) else None
    }
    
    # Include partial results if available (for timeouts)
    if isinstance(response_data, dict) and "partial_result" in response_data:
        parsed["partial_result"] = response_data["partial_result"]
    
    return parsed


def calculate_duration_ms(start_time: Optional[float] = None, 
                         end_time: Optional[float] = None,
                         execution_time_ms: Optional[int] = None) -> Optional[int]:
    """
    Calculate execution duration in milliseconds.
    
    Args:
        start_time: Start timestamp (seconds since epoch)
        end_time: End timestamp (seconds since epoch)  
        execution_time_ms: Direct execution time in milliseconds
        
    Returns:
        Duration in milliseconds, or None if calculation not possible
    """
    # Use direct execution time if provided
    if execution_time_ms is not None:
        return execution_time_ms
    
    # Calculate from timestamps
    if start_time is not None and end_time is not None:
        duration_seconds = end_time - start_time
        # Only return positive durations
        if duration_seconds >= 0:
            return int(duration_seconds * 1000)
    
    return None


class PostToolUseHook(BaseHook):
    """
    Hook to capture tool execution results and performance metrics.
    
    Implements the Tool Usage Tracking Hook specification (H3.2):
    - Parse Claude Code tool execution results
    - Extract tool name, execution duration, success/failure status
    - Capture result size and error messages
    - Store as event_type='tool_use' with comprehensive data
    - Identify and log MCP tools vs built-in tools
    - Handle timeout scenarios and partial results
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the post tool use hook."""
        super().__init__(config)
        logger.info("PostToolUseHook initialized")
    
    def process_hook(self, input_data: Any) -> Dict[str, Any]:
        """
        Process tool execution completion and capture metrics.
        
        Args:
            input_data: Hook input data containing tool execution results
            
        Returns:
            Hook response indicating whether to continue execution
        """
        try:
            # Handle None or invalid input gracefully
            if input_data is None:
                logger.warning("Received None input data")
                return self.create_response()
            
            # Process and sanitize input data
            processed_data = self.process_hook_data(input_data)
            
            # Extract tool execution details
            tool_name = processed_data.get("raw_input", {}).get("toolName")
            tool_input = processed_data.get("raw_input", {}).get("toolInput", {})
            tool_response = processed_data.get("raw_input", {}).get("toolResponse")
            execution_time = processed_data.get("raw_input", {}).get("executionTime")
            start_time = processed_data.get("raw_input", {}).get("startTime")
            end_time = processed_data.get("raw_input", {}).get("endTime")
            
            if not tool_name:
                logger.warning("No tool name found in input data")
                return self.create_response()
            
            # Parse tool response
            response_parsed = parse_tool_response(tool_response)
            
            # Calculate execution duration
            duration_ms = calculate_duration_ms(start_time, end_time, execution_time)
            
            # Detect MCP tool information
            is_mcp = is_mcp_tool(tool_name)
            mcp_server = extract_mcp_server_name(tool_name) if is_mcp else None
            
            # Create tool usage event data
            tool_event_data = {
                "event_type": "tool_use",
                "hook_event_name": processed_data.get("hook_event_name", "PostToolUse"),
                "session_id": processed_data.get("session_id"),
                "timestamp": processed_data.get("timestamp"),
                "data": {
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
                    "response_metadata": response_parsed.get("metadata"),
                }
            }
            
            # Include partial results for timeout scenarios
            if "partial_result" in response_parsed:
                tool_event_data["data"]["partial_result"] = response_parsed["partial_result"]
                tool_event_data["data"]["timeout_detected"] = True
            
            # Add project context
            project_context = self.load_project_context(processed_data.get("cwd"))
            tool_event_data["project_context"] = project_context
            
            # Save the event
            save_success = self.save_event(tool_event_data)
            
            if save_success:
                logger.info(f"Tool usage event saved: {tool_name} ({'MCP' if is_mcp else 'built-in'})")
            else:
                logger.error(f"Failed to save tool usage event for: {tool_name}")
            
            # Analyze tool execution for security concerns
            security_decision, security_reason = self.analyze_tool_security(
                tool_name, tool_input, response_parsed
            )
            
            # Create response based on security analysis
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
                        permission_decision=security_decision,
                        permission_decision_reason=security_reason
                    )
                )
            else:
                # Block or ask for permission
                return self.create_permission_response(
                    decision=security_decision,
                    reason=security_reason,
                    tool_name=tool_name,
                    mcp_tool=is_mcp,
                    execution_time=duration_ms,
                    event_saved=save_success
                )
            
        except Exception as e:
            logger.error(f"Error processing post tool use hook: {e}")
            self.log_error(e, "process_hook")
            
            # Return continue response even on error (don't break Claude execution)
            return self.create_response(
                continue_execution=True,
                suppress_output=False,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PostToolUse",
                    error=str(e),
                    event_saved=False,
                    tool_success=False
                )
            )
    
    def _summarize_tool_input(self, tool_input: Any) -> Dict[str, Any]:
        """
        Create a summary of tool input for logging (without sensitive data).
        
        Args:
            tool_input: Raw tool input data
            
        Returns:
            Summarized tool input information
        """
        if not tool_input:
            return {"input_provided": False}
        
        summary = {"input_provided": True}
        
        if isinstance(tool_input, dict):
            summary["param_count"] = len(tool_input)
            summary["param_names"] = list(tool_input.keys())
            
            # Calculate approximate size
            try:
                input_str = json.dumps(tool_input)
                summary["input_size"] = len(input_str.encode('utf-8'))
            except (TypeError, UnicodeEncodeError):
                summary["input_size"] = 0
            
            # Check for common parameter types
            if "file_path" in tool_input or "path" in tool_input:
                summary["involves_file_operations"] = True
            
            if "url" in tool_input or "endpoint" in tool_input:
                summary["involves_network"] = True
            
            if "command" in tool_input:
                summary["involves_command_execution"] = True
        
        return summary
    
    def analyze_tool_security(self, tool_name: str, tool_input: Any, 
                             tool_response: Dict[str, Any]) -> tuple[str, str]:
        """
        Analyze tool execution for security concerns.
        
        Args:
            tool_name: Name of the tool that was executed
            tool_input: Input parameters passed to the tool
            tool_response: Parsed response from tool execution
            
        Returns:
            Tuple of (decision, reason) where decision is "allow", "deny", or "ask"
        """
        # Safe tools that are generally allowed
        safe_tools = {
            "Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch", 
            "mcp__ide__getDiagnostics", "mcp__ide__executeCode"
        }
        
        if tool_name in safe_tools:
            return "allow", f"Safe operation: {tool_name} is considered secure"
        
        # Analyze based on tool type and input
        if tool_name == "Bash":
            return self._analyze_bash_security(tool_input, tool_response)
        
        elif tool_name in ["Write", "Edit", "MultiEdit"]:
            return self._analyze_file_write_security(tool_name, tool_input, tool_response)
        
        elif tool_name.startswith("mcp__"):
            return self._analyze_mcp_tool_security(tool_name, tool_input, tool_response)
        
        # Default to allow for unknown tools, but log for review
        logger.info(f"Unknown tool security analysis: {tool_name}")
        return "allow", f"Unknown tool {tool_name} - allowing by default"
    
    def _analyze_bash_security(self, tool_input: Any, tool_response: Dict[str, Any]) -> tuple[str, str]:
        """Analyze Bash command security."""
        if not isinstance(tool_input, dict) or "command" not in tool_input:
            return "allow", "No command to analyze"
        
        command = tool_input["command"].lower() if isinstance(tool_input["command"], str) else ""
        
        # Highly dangerous commands - deny immediately
        dangerous_patterns = [
            (r"rm\s+-rf\s+/", "Dangerous system deletion command"),
            (r"sudo\s+rm\s+-rf", "Dangerous sudo deletion command"),
            (r"mkfs\.", "File system formatting command"),
            (r"dd\s+if=/dev/zero", "Disk wiping command"),
            (r":(){ :|:& };:", "Fork bomb attempt"),
        ]
        
        import re
        for pattern, reason in dangerous_patterns:
            if re.search(pattern, command):
                return "deny", reason
        
        # Moderately risky commands - ask for confirmation
        risky_patterns = [
            (r"sudo", "Command requires elevated privileges"),
            (r"rm\s+.*-r", "Recursive file deletion"),
            (r"chmod\s+.*777", "Overly permissive file permissions"),
            (r"curl.*\|\s*(bash|sh)", "Downloading and executing scripts"),
            (r"wget.*\|\s*(bash|sh)", "Downloading and executing scripts"),
        ]
        
        for pattern, reason in risky_patterns:
            if re.search(pattern, command):
                return "ask", f"{reason}: {command[:100]}"
        
        return "allow", "Command appears safe"
    
    def _analyze_file_write_security(self, tool_name: str, tool_input: Any, 
                                    tool_response: Dict[str, Any]) -> tuple[str, str]:
        """Analyze file writing operations security."""
        if not isinstance(tool_input, dict):
            return "allow", "No file path to analyze"
        
        file_path = tool_input.get("file_path", "")
        if not isinstance(file_path, str):
            return "allow", "No valid file path"
        
        file_path = file_path.lower()
        
        # System critical files - deny
        critical_paths = [
            "/etc/passwd", "/etc/shadow", "/etc/sudoers", "/etc/hosts",
            "/boot/", "/sys/", "/proc/", "c:\\windows\\system32"
        ]
        
        for critical_path in critical_paths:
            if critical_path in file_path:
                return "deny", f"Attempt to modify critical system file: {file_path}"
        
        # Sensitive directories - ask for confirmation
        sensitive_paths = [
            "/etc/", "/usr/local/", "/opt/", "c:\\program files",
            "c:\\windows", "/var/log/", "/home/.*/.ssh"
        ]
        
        import re
        for sensitive_path in sensitive_paths:
            if re.search(sensitive_path, file_path):
                return "ask", f"Writing to sensitive location: {file_path}"
        
        return "allow", f"{tool_name} operation appears safe"
    
    def _analyze_mcp_tool_security(self, tool_name: str, tool_input: Any, 
                                  tool_response: Dict[str, Any]) -> tuple[str, str]:
        """Analyze MCP tool security."""
        server_name = extract_mcp_server_name(tool_name)
        
        # Known safe MCP servers/operations
        safe_servers = {"ide", "editor", "diagnostics"}
        if server_name in safe_servers:
            return "allow", f"Safe MCP operation: {tool_name}"
        
        # Network operations - ask for confirmation
        if "network" in server_name or "api" in server_name or "http" in server_name:
            return "ask", f"MCP network operation requires confirmation: {tool_name}"
        
        # File system operations - analyze like regular file operations
        if "filesystem" in server_name or "file" in server_name:
            return self._analyze_file_write_security(tool_name, tool_input, tool_response)
        
        # Database operations - ask for confirmation
        if "database" in server_name or "db" in server_name:
            return "ask", f"MCP database operation requires confirmation: {tool_name}"
        
        # Unknown MCP tool - be cautious
        return "ask", f"Unknown MCP tool requires confirmation: {tool_name}"


def main():
    """Main entry point for the hook script."""
    try:
        # Read input from stdin
        input_data = {}
        if not sys.stdin.isatty():
            input_text = sys.stdin.read().strip()
            if input_text:
                input_data = json.loads(input_text)
        
        # Initialize and run the hook
        hook = PostToolUseHook()
        result = hook.process_hook(input_data)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
        # Exit with success code
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        # Output minimal response for invalid JSON
        print(json.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Hook execution failed: {e}")
        # Output minimal response for any other error
        print(json.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)


if __name__ == "__main__":
    main()